import Link from "next/link"
import { Icone } from "@/components/icone"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { exigirAdmin } from "@/lib/admin"
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
  await exigirAdmin()
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
      <p className="rotulo text-dim">Admin Commander</p>
      <h1 className="titulo-pagina mt-1 inline-flex items-center gap-2">
        <Icone nome="medalha" className="size-5 text-accent-forte" /> Commander Gold
      </h1>
      <div className="mt-3 flex gap-3 apoio">
        <Link href="/admin/gold/precos" className="text-accent-forte">Preços</Link>
        <Link href="/admin/gold/consultores" className="text-accent-forte">Consultores</Link>
      </div>

      {ok && <p className="corpo mt-3 rounded-lg border border-ok/40 bg-ok/10 px-3 py-2">{ok}</p>}
      {erro && <p className="corpo mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        {ABAS.map((a) => (
          <Link
            key={a.chave}
            href={`/admin/gold?filtro=${a.chave}`}
            className={`rounded-full border px-3 py-1.5 apoio ${
              filtro === a.chave ? "border-accent-forte bg-accent/10 text-accent-forte" : "border-line text-dim"
            }`}
          >
            {a.rotulo}
          </Link>
        ))}
      </div>

      <div className="sombra-1 mt-4 rounded-[14px] border border-line bg-panel px-4">
        {linhas.length === 0 ? (
          <EstadoVazio variant="linha" icone="medalha" titulo="Nada por aqui" />
        ) : (
          linhas.map((l, i) => (
            <Link key={`${l.href}-${i}`} href={l.href} className="flex items-center justify-between gap-2 border-b border-line py-3 last:border-0">
              <div className="min-w-0">
                <p className="corpo truncate">{l.titulo}</p>
                <p className="apoio text-dim">{l.sub}</p>
              </div>
              <Icone nome="chevron" className="size-4 shrink-0 text-dim" />
            </Link>
          ))
        )}
      </div>
    </main>
  )
}
