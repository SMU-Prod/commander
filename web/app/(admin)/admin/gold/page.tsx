import Link from "next/link"
import { Icone } from "@/components/icone"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { Chip, ChipLinha } from "@/components/ui/chip"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { LinhaLista } from "@/components/ui/linha-lista"
import { ALVO_ACAO, PILULA_ACAO } from "@/lib/ui/acoes"
import { exigirAreaAdmin } from "@/lib/admin"
import { hojeISO } from "@/lib/consultas-gold"
import { formatarPrecoGold, ROTULO_ESTADO_SOLICITACAO, ROTULO_FAIXA_PORTE, statusSeloGold } from "@/lib/domain/gold"
import { supabaseServer } from "@/lib/supabase/server"
import type {
  GoldAgendamento, GoldAvaliacao, GoldPagamento, GoldSelo, GoldSolicitacao,
} from "@/lib/db/types"

const ABAS = [
  { chave: "solicitacoes", rotulo: "Solicitações" },
  { chave: "pagamentos", rotulo: "Pagamentos" },
  { chave: "agendamentos", rotulo: "Agendamentos" },
  { chave: "avaliacoes", rotulo: "Avaliações" },
  { chave: "aprovados", rotulo: "Aprovados" },
  { chave: "reprovados", rotulo: "Reprovados" },
  { chave: "ativos", rotulo: "Ativos" },
  { chave: "expirados", rotulo: "Expirados" },
] as const
type Aba = (typeof ABAS)[number]["chave"]

function nomeDaEmbarcacao(s: GoldSolicitacao, embarcacoes: Map<string, string>): string {
  if (s.embarcacao_id) return embarcacoes.get(s.embarcacao_id) ?? "Embarcação"
  return s.embarcacao_externa_nome ?? "Embarcação externa"
}

export default async function AdminGoldPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string; ok?: string; erro?: string }>
}) {
  await exigirAreaAdmin("gold")
  const { filtro: filtroBruto, ok, erro } = await searchParams
  const filtro = (ABAS.some((a) => a.chave === filtroBruto) ? filtroBruto : "solicitacoes") as Aba

  const supabase = await supabaseServer()

  const [{ data: solicitacoesBrutas }, { data: embarcacoesBrutas }] = await Promise.all([
    supabase.from("gold_solicitacoes").select("*").order("criado_em", { ascending: false }).limit(200),
    supabase.from("embarcacoes").select("id, nome"),
  ])
  const solicitacoes = (solicitacoesBrutas as GoldSolicitacao[] | null) ?? []
  const embarcacoes = new Map((embarcacoesBrutas ?? []).map((e) => [e.id as string, e.nome as string]))
  const solicitacoesPorId = new Map(solicitacoes.map((s) => [s.id, s]))

  let linhas: { href: string; titulo: string; sub: string }[] = []

  if (filtro === "solicitacoes") {
    linhas = solicitacoes.map((s) => ({
      href: `/admin/gold/${s.id}`,
      titulo: nomeDaEmbarcacao(s, embarcacoes),
      sub: `${ROTULO_ESTADO_SOLICITACAO[s.estado]} · ${ROTULO_FAIXA_PORTE[s.faixa_porte]}`,
    }))
  } else if (filtro === "pagamentos") {
    const { data } = await supabase.from("gold_pagamentos").select("*").order("criado_em", { ascending: false }).limit(200)
    linhas = ((data as GoldPagamento[] | null) ?? []).map((p) => {
      const s = solicitacoesPorId.get(p.solicitacao_id)
      return {
        href: `/admin/gold/${p.solicitacao_id}`,
        titulo: s ? nomeDaEmbarcacao(s, embarcacoes) : "Solicitação",
        sub: `${formatarPrecoGold(p.valor_centavos)} · ${p.status}${p.quem_paga === "interessado" ? " · pago por interessado" : ""}`,
      }
    })
  } else if (filtro === "agendamentos") {
    const { data } = await supabase.from("gold_agendamentos").select("*").order("data_hora", { ascending: false }).limit(200)
    linhas = ((data as GoldAgendamento[] | null) ?? []).map((a) => {
      const s = solicitacoesPorId.get(a.solicitacao_id)
      return {
        href: `/admin/gold/${a.solicitacao_id}`,
        titulo: s ? nomeDaEmbarcacao(s, embarcacoes) : "Solicitação",
        sub: `${new Date(a.data_hora).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} · ${a.status}`,
      }
    })
  } else if (filtro === "avaliacoes") {
    const { data } = await supabase.from("gold_avaliacoes").select("*").order("atualizado_em", { ascending: false }).limit(200)
    linhas = ((data as GoldAvaliacao[] | null) ?? []).map((av) => {
      const s = solicitacoesPorId.get(av.solicitacao_id)
      return {
        href: `/admin/gold/${av.solicitacao_id}`,
        titulo: s ? nomeDaEmbarcacao(s, embarcacoes) : "Solicitação",
        sub: `${av.status}${av.resultado ? ` · ${av.resultado}` : ""} · protocolo v${av.versao_protocolo}`,
      }
    })
  } else if (filtro === "aprovados" || filtro === "reprovados") {
    const alvo = filtro === "aprovados" ? "aprovado" : "reprovado"
    linhas = solicitacoes.filter((s) => s.estado === alvo).map((s) => ({
      href: `/admin/gold/${s.id}`,
      titulo: nomeDaEmbarcacao(s, embarcacoes),
      sub: `${ROTULO_FAIXA_PORTE[s.faixa_porte]} · atualizado em ${new Date(s.atualizado_em).toLocaleDateString("pt-BR")}`,
    }))
  } else {
    const { data } = await supabase.from("gold_selos").select("*").order("validade_ate", { ascending: false }).limit(200)
    const hoje = hojeISO()
    const selos = ((data as GoldSelo[] | null) ?? []).filter((sel) => {
      const status = statusSeloGold(sel.validade_ate, hoje)
      return filtro === "ativos" ? status !== "expirado" : status === "expirado"
    })
    linhas = selos.map((sel) => ({
      href: `/admin/gold/${sel.solicitacao_id}`,
      titulo: embarcacoes.get(sel.embarcacao_id) ?? "Embarcação",
      sub: `Válido até ${new Date(`${sel.validade_ate}T00:00:00`).toLocaleDateString("pt-BR")}`,
    }))
  }

  return (
    <main>
      {/* ONDA 93 — ESTA TELA NÃO TINHA SAÍDA.
          O rótulo "Admin Commander" era texto puro: nenhum link levava de
          volta pra `/admin`, o layout do Admin não tem navegação, e o
          wordmark não é clicável. No navegador dá pra voltar; no app
          INSTALADO não existe botão de voltar, e a pessoa fica presa aqui.
          É o mesmo beco que a onda 54 caçou em ~46 telas de `(app)` — o
          Admin ficou de fora daquela varredura porque o usuário de teste
          nunca teve papel administrativo.
          `CabecalhoDetalhe` sem `titulo` é o uso documentado pra tela que já
          tem o próprio elemento de título: ele cuida só da navegação, e o h1
          abaixo continua igual. */}
      <CabecalhoDetalhe voltarHref="/admin" voltarRotulo="Admin Commander" />
      <h1 className="titulo-pagina mt-3 inline-flex items-center gap-2">
        <Icone nome="medalha" className="size-5 text-accent-forte" /> Commander Gold
      </h1>
      {/* Eram dois textos dourados de 18px de altura, colados um no outro:
          ação secundária vestida de texto é justamente o que a onda 82
          diagnosticou (`lib/ui/acoes.ts`), e 18px é menos da metade do alvo
          de toque. `ALVO_ACAO` dá a caixa de 44px, `PILULA_ACAO` o contorno
          que diz "aqui se toca" sem gastar o orçamento de dourado. */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link href="/admin/gold/precos" className={ALVO_ACAO}>
          <span className={PILULA_ACAO}>Preços</span>
        </Link>
        <Link href="/admin/gold/consultores" className={ALVO_ACAO}>
          <span className={PILULA_ACAO}>Consultores</span>
        </Link>
      </div>

      {ok && <p className="corpo mt-3 rounded-[var(--raio-controle)] border border-ok/40 bg-ok/10 px-3 py-2">{ok}</p>}
      {erro && <p className="corpo mt-3 rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      <ChipLinha className="mt-4">
        {ABAS.map((a) => (
          <Chip key={a.chave} href={`/admin/gold?filtro=${a.chave}`} ativo={filtro === a.chave}>
            {a.rotulo}
          </Chip>
        ))}
      </ChipLinha>

      <div className="sombra-1 mt-4 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
        {linhas.length === 0 ? (
          <EstadoVazio variant="linha" icone="medalha" titulo="Nada por aqui" />
        ) : (
          linhas.map((l, i) => (
            <LinhaLista key={`${l.href}-${i}`} href={l.href} titulo={l.titulo} subtitulo={l.sub} />
          ))
        )}
      </div>
    </main>
  )
}
