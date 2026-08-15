import Link from "next/link"
import { redirect } from "next/navigation"
import { Icone, type NomeIcone } from "@/components/icone"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { LinhaLista } from "@/components/ui/linha-lista"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { carregarMapaTaxonomia, nomeDaRegiao, tituloDeDemanda } from "@/lib/consultas-marketplace"
import { carregarMeuPartner } from "@/lib/consultas-partner"
import { hojeISO } from "@/lib/domain/datas"
import {
  demandasParaPartner,
  recebeDemandas,
  ROTULO_MEU_PERFIL,
  ROTULO_TIPO_PARTNER,
  type AtividadeDeclarada,
} from "@/lib/domain/partner"
import { supabaseServer } from "@/lib/supabase/server"
import type { Demanda, Negocio, Proposta } from "@/lib/db/types"

/**
 * INÍCIO DO PARTNER (PRD §13.1: "Dashboard: oportunidades compatíveis,
 * propostas, negociações, visualizações e atalhos").
 *
 * §13 manda o Dashboard exibir o TIPO REAL — por isso o título é "Marina",
 * "Loja Náutica", "Prestador de Serviço", e não "Commander Partner", que é o
 * nome do plano.
 *
 * Os quatro números do §13.1 valem pros tipos que recebem demanda. Restaurante
 * e Pousada não recebem nenhuma (§13.5/§13.6 não descrevem Marketplace), então
 * pra eles o Dashboard mostra o que de fato existe — visualizações e o estado
 * do perfil — em vez de três zeros que nunca vão sair do lugar. Zero fabricado
 * em painel é pior que a ausência honesta.
 */
export default async function ParceiroInicioPage() {
  const meu = await carregarMeuPartner()
  if (!meu) {
    const supabase = await supabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect("/login?volta=/parceiro")
    return (
      <main>
        <h1 className="titulo-pagina">Commander Partner</h1>
        <p className="corpo mt-2 text-dim">
          Publique seu perfil pra aparecer no Explorar e receber pedidos de proprietários.
        </p>
        <EstadoVazio
          className="mt-4"
          icone="marketplace"
          titulo="Você ainda não tem perfil de parceiro"
          descricao="Escolha o tipo do seu negócio — marina, posto, loja, prestador, restaurante ou pousada — e publique."
          acao={{ href: "/parceiro/perfil", rotulo: "Criar meu perfil" }}
        />
      </main>
    )
  }

  const { parceiro, atividades, vagas } = meu
  const tipo = parceiro.categoria
  const supabase = await supabaseServer()
  const hoje = hojeISO()

  const [mapaTaxonomia, { data: demandasBrutas }, { data: propostasBrutas }, { data: negociosBrutos }] =
    await Promise.all([
      carregarMapaTaxonomia(),
      recebeDemandas(tipo)
        ? supabase
            .from("demandas").select("*")
            .in("status", ["aberta", "em_negociacao"])
            .gte("expira_em", hoje)
            .order("criado_em", { ascending: false })
            .limit(100)
        : Promise.resolve({ data: null }),
      supabase.from("propostas").select("*").eq("autor_id", parceiro.usuario_id),
      supabase.from("negocios").select("*").eq("fornecedor_id", parceiro.usuario_id),
    ])

  const paraMatching = {
    categoria: tipo,
    tambem_vende_produtos: parceiro.tambem_vende_produtos,
    tambem_presta_servicos: parceiro.tambem_presta_servicos,
    regiao_id: parceiro.regiao_id,
    atividades: atividades.map((a): AtividadeDeclarada => ({ id: a.taxonomia_id, tipo: a.tipo })),
  }
  const todas = ((demandasBrutas as Demanda[] | null) ?? []).filter((d) => d.autor_id !== parceiro.usuario_id)
  const compativeis = demandasParaPartner(todas, paraMatching, vagas)

  const propostas = (propostasBrutas as Proposta[] | null) ?? []
  const negocios = (negociosBrutos as Negocio[] | null) ?? []
  const emNegociacao = propostas.filter((p) => p.status === "aceita").length

  return (
    <main>
      <h1 className="titulo-pagina">{ROTULO_TIPO_PARTNER[tipo]}</h1>
      <p className="apoio mt-1 text-dim">
        {parceiro.nome} · {nomeDaRegiao(mapaTaxonomia, parceiro.regiao_id)}
      </p>

      {!parceiro.visivel && (
        <p className="corpo mt-3 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2">
          Seu perfil está oculto: ninguém encontra você no Explorar. Ative a visibilidade em{" "}
          {ROTULO_MEU_PERFIL[tipo]}.
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {recebeDemandas(tipo) && (
          <>
            <Numero
              icone="marketplace"
              valor={compativeis.length}
              rotulo={tipo === "posto" ? "Solicitações compatíveis" : "Oportunidades compatíveis"}
              href="/parceiro/marketplace"
            />
            <Numero icone="documento" valor={propostas.length} rotulo="Propostas enviadas" href="/parceiro/marketplace" />
            <Numero icone="repetir" valor={emNegociacao} rotulo="Em negociação" href="/parceiro/marketplace" />
          </>
        )}
        <Numero icone="grafico" valor={parceiro.visualizacoes} rotulo="Visualizações do perfil" />
        {negocios.length > 0 && (
          <Numero icone="selo" valor={negocios.length} rotulo="Negócios registrados" href="/avaliacoes" />
        )}
      </div>

      {recebeDemandas(tipo) && (
        <>
          <SecaoPagina
            icone="marketplace"
            acao={compativeis.length > 0 ? { href: "/parceiro/marketplace", rotulo: "Ver tudo" } : undefined}
          >
            {tipo === "posto" ? "Solicitações de caminhão" : "Compatíveis com você"}
          </SecaoPagina>
          {compativeis.length === 0 ? (
            <EstadoVazio
              icone="marketplace"
              titulo="Nada compatível agora"
              descricao={`Você recebe pedidos de ${nomeDaRegiao(mapaTaxonomia, parceiro.regiao_id)} nas atividades que declarou. Ampliar região ou atividades aumenta o que chega até você.`}
              acao={{ href: "/parceiro/perfil", rotulo: `Ajustar ${ROTULO_MEU_PERFIL[tipo].toLowerCase()}` }}
            />
          ) : (
            <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
              {compativeis.slice(0, 5).map((d) => (
                <LinhaLista
                  key={d.id}
                  href={`/marketplace/${d.id}`}
                  titulo={tituloDeDemanda(mapaTaxonomia, d)}
                  subtitulo={d.autor_nome || "Proprietário"}
                />
              ))}
            </div>
          )}
        </>
      )}

      <SecaoPagina icone="mais">Atalhos</SecaoPagina>
      <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
        <LinhaLista href="/parceiro/perfil" titulo={ROTULO_MEU_PERFIL[tipo]} subtitulo="Fotos, contato e o que você atende" />
        <LinhaLista href="/explorar" titulo="Explorar Parceiros" subtitulo="Veja como os outros parceiros se apresentam" />
        <LinhaLista href="/parceiro/conta" titulo="Minha Conta" subtitulo="Plano, cobrança e visibilidade" />
      </div>
    </main>
  )
}

/** Cartão de número do dashboard. Vira link quando existe destino — número
 *  sem para-onde-ir é enfeite. */
function Numero({
  icone,
  valor,
  rotulo,
  href,
}: {
  icone: NomeIcone
  valor: number
  rotulo: string
  href?: string
}) {
  const miolo = (
    <>
      <Icone nome={icone} className="size-5 text-accent-forte" />
      <p className="mt-1.5 text-2xl font-semibold tabular-nums">{valor}</p>
      <p className="apoio mt-0.5 text-dim">{rotulo}</p>
    </>
  )
  const classe = "sombra-1 block rounded-[14px] border border-line bg-panel p-3.5"
  return href ? <Link href={href} className={classe}>{miolo}</Link> : <div className={classe}>{miolo}</div>
}
