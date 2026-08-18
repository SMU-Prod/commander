import Link from "next/link"
import { Icone } from "@/components/icone"
import { Chip, ChipLinha } from "@/components/ui/chip"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { LinhaLista } from "@/components/ui/linha-lista"
import { RedeNav } from "@/components/ui/rede-nav"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { carregarMapaTaxonomia, nomeDaRegiao, tituloDeDemanda } from "@/lib/consultas-marketplace"
import { hojeISO } from "@/lib/domain/datas"
import {
  contarPorTipo,
  demandasCompativeis,
  diasAteExpirar,
  filtroTipoDemandaValido,
  ROTULO_CURTO_TIPO_DEMANDA,
  ROTULO_STATUS_DEMANDA,
  tempoRelativo,
  TIPOS_DEMANDA,
  type InteresseParaMatching,
} from "@/lib/domain/marketplace"
import { supabaseServer } from "@/lib/supabase/server"
import type { Demanda, InteresseMarketplace, Proposta } from "@/lib/db/types"

/**
 * MARKETPLACE (onda 45, PRD upgrade2-master-final §11; anatomia da onda 62,
 * canvas tela-3i).
 *
 * "Marketplace é orientado por DEMANDA. Não é feed para empresas anunciarem
 * produtos aleatórios" (§11). Por isso a tela abre com o botão de PUBLICAR um
 * pedido, e a primeira lista é "compatíveis com você" — não um mural geral.
 *
 * A separação com o Explorar é a do §10/§11: Explorar mostra QUEM existe
 * (perfis, vitrine); Marketplace mostra O QUE alguém precisa.
 *
 * CANVAS TELA-3I — a anatomia do cartão: "o tipo é chip mono, o preço é
 * número de instrumento e a nota fica à direita — mesma anatomia para vaga,
 * serviço e pessoa. A ressalva de responsabilidade fecha a lista, não abre."
 * Uma demanda NÃO tem preço nem nota (isso é da proposta, §11.5) — então o
 * cartão dela usa a mesma gramática com o que ela tem de verdade: chip mono
 * do tipo, idade à direita ("há 2 h", `tempoRelativo`), título gerado pelo
 * Commander e o prazo em mono quando aperta. Nenhum número inventado.
 */
function avisoDePrazo(expiraEm: string, hoje: string): string | null {
  const dias = diasAteExpirar(expiraEm, hoje)
  if (dias < 0) return "Vencida"
  if (dias === 0) return "Vence hoje"
  if (dias <= 3) return `Vence em ${dias} dia${dias === 1 ? "" : "s"}`
  return null
}

export default async function MarketplacePage({
  searchParams,
}: {
  // §24, "nunca falhar silenciosamente" (onda 53): a ficha de um pedido
  // (`/marketplace/[id]`) devolve pra cá com `?erro=` quando o pedido não
  // existe mais ou já foi encerrado, e as actions de proposta usam
  // `/marketplace` como rota de erro de último caso. Sem este parâmetro a
  // pessoa era jogada na lista sem nenhuma explicação.
  searchParams: Promise<{ erro?: string; tipo?: string }>
}) {
  const { erro: aviso, tipo: tipoBruto } = await searchParams
  const filtroTipo = filtroTipoDemandaValido(tipoBruto)
  const supabase = await supabaseServer()
  const hoje = hojeISO()
  const agora = new Date().toISOString()
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

  // Chips com número (canvas: "Tudo 18 · Serviço 7 · Vaga 5"). Só existe chip
  // de tipo que TEM pedido aberto — oferecer um filtro que leva a uma lista
  // vazia é completude de menu contra honestidade de estado (§24). A contagem
  // é sobre os pedidos dos outros (os filtráveis); os seus não filtram.
  const contagem = contarPorTipo(todas)
  const filtrar = (lista: Demanda[]) => (filtroTipo ? lista.filter((d) => d.tipo === filtroTipo) : lista)
  const compativeisFiltradas = filtrar(compativeis)
  const outrasFiltradas = filtrar(outras)

  const cartao = (d: Demanda, subtituloProprio?: string) => {
    const prazo = avisoDePrazo(d.expira_em, hoje)
    return (
      <Link
        key={d.id}
        href={`/marketplace/${d.id}`}
        className="sombra-1 block rounded-[var(--raio-cartao)] border border-line bg-panel p-3"
      >
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-line px-2 py-0.5 font-mono-instr text-[11px] uppercase tracking-[.08em] text-dim-chip">
            {ROTULO_CURTO_TIPO_DEMANDA[d.tipo]}
          </span>
          <span className="flex-1" />
          <span className="font-mono-instr text-xs tabular-nums text-dim">{tempoRelativo(d.criado_em, agora)}</span>
        </div>
        <p className="titulo-card mt-2">{tituloDeDemanda(mapa, d)}</p>
        <p className="apoio mt-0.5 text-dim">
          {subtituloProprio ?? `${d.autor_nome} · ${nomeDaRegiao(mapa, d.regiao_id)}`}
        </p>
        {prazo && <p className="mt-2 font-mono-instr text-xs tabular-nums text-warn">{prazo}</p>}
      </Link>
    )
  }

  const hrefTipo = (t: string | null) => (t ? `/marketplace?tipo=${t}` : "/marketplace")

  return (
    <main>
      <h1 className="titulo-pagina">Marketplace</h1>
      <p className="apoio mt-1 text-dim">
        Diga o que você precisa — profissional, tripulação, peça, vaga ou caminhão de combustível — e quem
        atende a sua região responde por aqui.
      </p>
      {aviso && <p className="corpo mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{aviso}</p>}
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

      {/* Os chips do canvas, com a contagem em mono. O chip ativo é um dos
          dois dourados de conteúdo da tela (o outro é "Publicar um pedido") —
          régua do DESIGN §5. */}
      {todas.length > 0 && (
        <ChipLinha className="mt-4">
          <Chip href={hrefTipo(null)} ativo={filtroTipo === null}>
            Tudo <span className="ml-1.5 font-mono-instr tabular-nums">{todas.length}</span>
          </Chip>
          {TIPOS_DEMANDA.filter((t) => contagem[t] > 0 || t === filtroTipo).map((t) => (
            <Chip key={t} href={hrefTipo(t)} ativo={filtroTipo === t}>
              {ROTULO_CURTO_TIPO_DEMANDA[t]}{" "}
              <span className="ml-1.5 font-mono-instr tabular-nums">{contagem[t]}</span>
            </Chip>
          ))}
        </ChipLinha>
      )}

      {minhas.length > 0 && (
        <>
          <SecaoPagina icone="documento">Seus pedidos</SecaoPagina>
          <div className="flex flex-col gap-2">
            {minhas.map((d) =>
              cartao(d, `${ROTULO_STATUS_DEMANDA[d.status]} · ${nomeDaRegiao(mapa, d.regiao_id)}`),
            )}
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
      {interesses.length === 0 ? (
        <EstadoVazio
          icone="sinal"
          titulo="Você ainda não disse o que quer receber"
          descricao="Escolha suas regiões e áreas de atuação — só chegam os pedidos que combinam com elas."
          acao={{ href: "/marketplace/interesses", rotulo: "Escolher o que recebo" }}
        />
      ) : compativeisFiltradas.length === 0 ? (
        <EstadoVazio
          icone="sinal"
          titulo={filtroTipo ? "Nenhum pedido compatível desse tipo" : "Nenhum pedido compatível agora"}
          descricao={
            filtroTipo
              ? "Veja tudo de novo ou ajuste o que você recebe."
              : "Tente ampliar as regiões ou as categorias que você atende."
          }
          acao={
            filtroTipo
              ? { href: "/marketplace", rotulo: "Limpar filtro" }
              : { href: "/marketplace/interesses", rotulo: "Ajustar o que recebo" }
          }
        />
      ) : (
        <div className="flex flex-col gap-2">{compativeisFiltradas.map((d) => cartao(d))}</div>
      )}

      <SecaoPagina icone="marketplace">Todos os pedidos abertos</SecaoPagina>
      {outrasFiltradas.length === 0 ? (
        <EstadoVazio
          icone="marketplace"
          titulo={filtroTipo ? "Nada aberto desse tipo agora" : "Nada aberto no momento"}
          descricao={filtroTipo ? "Limpe o filtro pra ver todos os pedidos." : "Seja o primeiro a publicar o que precisa."}
          acao={
            filtroTipo
              ? { href: "/marketplace", rotulo: "Limpar filtro" }
              : { href: "/marketplace/nova", rotulo: "Publicar um pedido" }
          }
        />
      ) : (
        <div className="flex flex-col gap-2">{outrasFiltradas.map((d) => cartao(d))}</div>
      )}

      {/* Canvas tela-3i: "a ressalva de responsabilidade fecha a lista, não
          abre". É a mesma frase honesta que abria a tela — só mudou de lugar. */}
      <div className="mt-4 flex gap-2.5 rounded-[var(--raio-cartao)] border border-line bg-panel2 px-4 py-3">
        <Icone nome="escudo" className="mt-0.5 size-4 shrink-0 text-dim" />
        <p className="apoio text-dim-chip">
          O Commander apresenta as partes e não cobra comissão. Contrato, pagamento e responsabilidade
          ficam entre vocês.
        </p>
      </div>
    </main>
  )
}
