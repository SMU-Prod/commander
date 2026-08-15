import Link from "next/link"
import { Icone } from "@/components/icone"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { LinhaLista } from "@/components/ui/linha-lista"
import { RedeNav } from "@/components/ui/rede-nav"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { carregarMapaTaxonomia, nomeDaRegiao, tituloDeDemanda } from "@/lib/consultas-marketplace"
import { hojeISO } from "@/lib/domain/datas"
import {
  demandasCompativeis,
  diasAteExpirar,
  ICONE_TIPO_DEMANDA,
  ROTULO_STATUS_DEMANDA,
  ROTULO_TIPO_DEMANDA,
  type InteresseParaMatching,
} from "@/lib/domain/marketplace"
import { supabaseServer } from "@/lib/supabase/server"
import type { Demanda, InteresseMarketplace, Proposta } from "@/lib/db/types"

/**
 * MARKETPLACE (onda 45, PRD upgrade2-master-final §11).
 *
 * "Marketplace é orientado por DEMANDA. Não é feed para empresas anunciarem
 * produtos aleatórios" (§11). Por isso a tela abre com o botão de PUBLICAR um
 * pedido, e a primeira lista é "compatíveis com você" — não um mural geral.
 *
 * A separação com o Explorar é a do §10/§11: Explorar mostra QUEM existe
 * (perfis, vitrine); Marketplace mostra O QUE alguém precisa.
 */
function avisoDePrazo(expiraEm: string, hoje: string): string | null {
  const dias = diasAteExpirar(expiraEm, hoje)
  if (dias < 0) return "Vencida"
  if (dias === 0) return "Vence hoje"
  if (dias <= 3) return `Vence em ${dias} dia${dias === 1 ? "" : "s"}`
  return null
}

export default async function MarketplacePage() {
  const supabase = await supabaseServer()
  const hoje = hojeISO()
  const { data: { user } } = await supabase.auth.getUser()

  const [mapa, { data: vivasBrutas, error }] = await Promise.all([
    carregarMapaTaxonomia(),
    supabase
      .from("demandas").select("*")
      .in("status", ["aberta", "em_negociacao"])
      .gte("expira_em", hoje)
      .order("criado_em", { ascending: false })
      .limit(100),
  ])
  if (error) throw new Error("Não foi possível carregar o Marketplace. Recarregue a página.")

  const todas = ((vivasBrutas as Demanda[] | null) ?? []).filter((d) => d.autor_id !== user?.id)

  const [{ data: minhasBrutas }, { data: interessesBrutos }, { data: minhasPropostasBrutas }] = user
    ? await Promise.all([
        supabase.from("demandas").select("*").eq("autor_id", user.id).order("criado_em", { ascending: false }),
        supabase.from("interesses_marketplace").select("*").eq("usuario_id", user.id),
        supabase.from("propostas").select("*").eq("autor_id", user.id).order("criado_em", { ascending: false }),
      ])
    : [{ data: null }, { data: null }, { data: null }]

  const minhas = (minhasBrutas as Demanda[] | null) ?? []
  const interesses = ((interessesBrutos as InteresseMarketplace[] | null) ?? []) as InteresseParaMatching[]
  const minhasPropostas = (minhasPropostasBrutas as Proposta[] | null) ?? []

  // §11.4 — a compatibilidade é calculada pela regra pura, com os interesses
  // que a própria pessoa cadastrou. Sem interesse cadastrado a lista vem
  // vazia, e a tela convida a cadastrar em vez de fingir que não há demanda.
  const compativeis = demandasCompativeis(todas, interesses)
  const idsCompativeis = new Set(compativeis.map((d) => d.id))
  const outras = todas.filter((d) => !idsCompativeis.has(d.id))
  const demandaPorId = new Map([...todas, ...minhas].map((d) => [d.id, d]))

  const cartao = (d: Demanda) => {
    const prazo = avisoDePrazo(d.expira_em, hoje)
    return (
      <LinhaLista
        key={d.id}
        href={`/marketplace/${d.id}`}
        variant="grupo"
        leading={<Icone nome={ICONE_TIPO_DEMANDA[d.tipo]} className="size-5 shrink-0 text-dim" />}
        titulo={tituloDeDemanda(mapa, d)}
        subtitulo={`${ROTULO_TIPO_DEMANDA[d.tipo]} · ${nomeDaRegiao(mapa, d.regiao_id)}`}
        valor={prazo ?? undefined}
        valorClassName={prazo ? "text-warn" : ""}
      />
    )
  }

  return (
    <main>
      <h1 className="titulo-pagina">Marketplace</h1>
      <p className="apoio mt-1 text-dim">
        Diga o que você precisa — profissional, tripulação, peça, vaga ou caminhão de combustível — e quem
        atende a sua região responde por aqui.
      </p>
      <p className="apoio mt-1 text-dim">
        O Commander não cobra comissão e não intermedeia pagamento: o combinado é direto entre vocês.
      </p>
      <RedeNav atual="marketplace" className="mt-4" />

      <Link
        href="/marketplace/nova"
        className="sombra-1 mt-4 flex h-11 items-center justify-center gap-1.5 rounded-xl bg-accent px-4 text-sm font-semibold text-acao-texto"
      >
        <Icone nome="mais" className="size-4" /> Publicar um pedido
      </Link>

      <div className="mt-3 flex flex-wrap gap-3">
        <Link href="/marketplace/interesses" className="apoio inline-flex items-center gap-1 text-accent-forte">
          <Icone nome="sinal" className="size-4" /> O que eu quero receber
        </Link>
        <Link href="/marketplace/disponibilidades" className="apoio inline-flex items-center gap-1 text-accent-forte">
          <Icone nome="pessoas" className="size-4" /> Profissionais disponíveis
        </Link>
        {/* §14 — a avaliação nasce do negócio fechado aqui, então a porta de
            entrada dela é esta tela, não um item solto no menu. */}
        <Link href="/avaliacoes" className="apoio inline-flex items-center gap-1 text-accent-forte">
          <Icone nome="estrela" className="size-4" /> Avaliações
        </Link>
      </div>

      {minhas.length > 0 && (
        <>
          <SecaoPagina icone="documento">Seus pedidos</SecaoPagina>
          <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
            {minhas.map((d) => (
              <LinhaLista
                key={d.id}
                href={`/marketplace/${d.id}`}
                variant="grupo"
                leading={<Icone nome={ICONE_TIPO_DEMANDA[d.tipo]} className="size-5 shrink-0 text-dim" />}
                titulo={tituloDeDemanda(mapa, d)}
                subtitulo={`${ROTULO_STATUS_DEMANDA[d.status]} · ${nomeDaRegiao(mapa, d.regiao_id)}`}
              />
            ))}
          </div>
        </>
      )}

      {minhasPropostas.length > 0 && (
        <>
          <SecaoPagina icone="chat">Suas respostas</SecaoPagina>
          <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
            {minhasPropostas.map((p) => {
              const d = demandaPorId.get(p.demanda_id)
              return (
                <LinhaLista
                  key={p.id}
                  href={`/marketplace/${p.demanda_id}`}
                  variant="grupo"
                  titulo={d ? tituloDeDemanda(mapa, d) : "Pedido encerrado"}
                  subtitulo={
                    p.status === "aceita"
                      ? "Aceita — o contato de quem publicou está liberado"
                      : p.status === "recusada"
                        ? "Recusada"
                        : p.status === "retirada"
                          ? "Você retirou"
                          : "Aguardando resposta"
                  }
                />
              )
            })}
          </div>
        </>
      )}

      <SecaoPagina icone="sinal">Combinam com você</SecaoPagina>
      <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
        {interesses.length === 0 ? (
          <EstadoVazio
            variant="linha"
            icone="sinal"
            titulo="Você ainda não disse o que quer receber"
            descricao="Escolha suas regiões e áreas de atuação — só chegam os pedidos que combinam com elas."
            acao={{ href: "/marketplace/interesses", rotulo: "Escolher o que recebo" }}
          />
        ) : compativeis.length === 0 ? (
          <EstadoVazio
            variant="linha"
            icone="sinal"
            titulo="Nenhum pedido compatível agora"
            descricao="Tente ampliar as regiões ou as categorias que você atende."
            acao={{ href: "/marketplace/interesses", rotulo: "Ajustar o que recebo" }}
          />
        ) : (
          compativeis.map(cartao)
        )}
      </div>

      <SecaoPagina icone="marketplace">Todos os pedidos abertos</SecaoPagina>
      <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
        {outras.length === 0 ? (
          <EstadoVazio
            variant="linha"
            icone="marketplace"
            titulo="Nada aberto no momento"
            descricao="Seja o primeiro a publicar o que precisa."
            acao={{ href: "/marketplace/nova", rotulo: "Publicar um pedido" }}
          />
        ) : (
          outras.map(cartao)
        )}
      </div>
    </main>
  )
}
