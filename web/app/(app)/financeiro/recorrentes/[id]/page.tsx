import { notFound, redirect } from "next/navigation"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { Campo, CampoSelect } from "@/components/ui/campo"
import { LinhaLista } from "@/components/ui/linha-lista"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { alterarValorRecorrente, alternarRecorrente } from "@/lib/acoes/financeiro"
import { carregarPainel, hojeISO } from "@/lib/consultas"
import {
  ROTULO_CATEGORIA, ROTULO_FORMA_PAGAMENTO, ROTULO_FREQUENCIA, formatarDataBr,
  proximoVencimento, vencimentosNoIntervalo,
} from "@/lib/domain/financeiro"
import { formatarReais } from "@/lib/domain/gastos"
import { podeEditar, podeVer } from "@/lib/domain/permissoes"
import { supabaseServer } from "@/lib/supabase/server"
import type { LancamentoFinanceiro, RecorrenciaFinanceira } from "@/lib/db/types"

/**
 * Detalhe de uma recorrente. O bloco central é a alteração de valor com as
 * duas opções que o PRD §9.2 exige — "somente este lançamento" ou "este e
 * os próximos" —, com a consequência de cada uma escrita na tela, não só no
 * código: a segunda FECHA esta série e abre outra, e é assim que o histórico
 * de quanto se pagava antes continua verdadeiro.
 */
export default async function RecorrentePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ erro?: string }>
}) {
  const { id } = await params
  const { erro } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (!podeVer(painel.permissoes, "gastos")) {
    redirect(`/hoje?erro=${encodeURIComponent("Seu acesso não inclui o Financeiro.")}`)
  }
  const editavel = podeEditar(painel.permissoes, "gastos")

  const supabase = await supabaseServer()
  const { data: bruta } = await supabase.from("recorrencias_financeiras")
    .select("*").eq("id", id).eq("embarcacao_id", painel.embarcacao.id).maybeSingle()
  const rec = bruta as RecorrenciaFinanceira | null
  if (!rec) notFound()

  const { data: lancBrutos } = await supabase.from("lancamentos_financeiros")
    .select("*").eq("recorrencia_id", rec.id).order("data", { ascending: false }).limit(24)
  const lancados = (lancBrutos ?? []) as LancamentoFinanceiro[]

  const hoje = hojeISO()
  const serie = { inicio: rec.inicio, fim: rec.fim, frequencia: rec.frequencia }
  const proximo = rec.ativa ? proximoVencimento(serie, hoje) : null
  const jaLancados = new Set(lancados.map((l) => l.data))
  const ate = new Date(Date.parse(`${hoje}T00:00:00Z`) + 366 * 86_400_000).toISOString().slice(0, 10)
  const abertos = rec.ativa
    ? vencimentosNoIntervalo(serie, rec.inicio, ate).filter((d) => !jaLancados.has(d))
    : []

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref="/financeiro/recorrentes"
        voltarRotulo="Recorrentes"
        titulo={rec.descricao}
        descricao={`${ROTULO_FREQUENCIA[rec.frequencia]} · ${ROTULO_CATEGORIA[rec.categoria]}`}
      />
      {erro && <p className="corpo mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      <div className="sombra-1 mt-5 rounded-[14px] border border-line bg-panel p-4">
        <p className="rotulo text-dim">{rec.tipo === "entrada" ? "Entrada recorrente" : "Despesa recorrente"}</p>
        <p className={`mt-1 font-mono-instr text-3xl tabular-nums ${rec.tipo === "entrada" ? "text-ok" : ""}`}>
          {formatarReais(rec.valor_centavos)}
        </p>
        <div className="mt-3 space-y-1 border-t border-line pt-3">
          <p className="corpo flex justify-between gap-3">
            <span className="text-dim">Começou em</span>
            <span className="font-mono-instr tabular-nums">{formatarDataBr(rec.inicio)}</span>
          </p>
          {rec.fim && (
            <p className="corpo flex justify-between gap-3">
              <span className="text-dim">Até</span>
              <span className="font-mono-instr tabular-nums">{formatarDataBr(rec.fim)}</span>
            </p>
          )}
          <p className="corpo flex justify-between gap-3">
            <span className="text-dim">Próximo vencimento</span>
            <span className="font-mono-instr tabular-nums">{proximo ? formatarDataBr(proximo) : "—"}</span>
          </p>
          {rec.fornecedor && (
            <p className="corpo flex justify-between gap-3">
              <span className="text-dim">Fornecedor</span>
              <span className="text-right">{rec.fornecedor}</span>
            </p>
          )}
          {rec.forma_pagamento && (
            <p className="corpo flex justify-between gap-3">
              <span className="text-dim">Forma</span>
              <span>{ROTULO_FORMA_PAGAMENTO[rec.forma_pagamento]}</span>
            </p>
          )}
        </div>
        {rec.origem_id && (
          <p className="apoio mt-3 text-dim">
            Esta série substituiu outra a partir de {formatarDataBr(rec.inicio)}, quando o valor mudou.
            A anterior continua no histórico com o valor que tinha.
          </p>
        )}
        {!rec.ativa && <p className="apoio mt-3 text-dim">Série encerrada — não gera mais vencimentos.</p>}
      </div>

      {editavel && rec.ativa && abertos.length > 0 && (
        <>
          <SecaoPagina icone="cifrao">Mudar o valor</SecaoPagina>
          <form action={alterarValorRecorrente} className="space-y-4 rounded-[14px] border border-line bg-panel p-4">
            <input type="hidden" name="recorrencia_id" value={rec.id} />
            <div className="grid grid-cols-2 gap-3">
              <Campo
                label="Valor novo (R$)" id="valor" name="valor" inputMode="decimal" required
                defaultValue={String(rec.valor_centavos / 100).replace(".", ",")}
              />
              <CampoSelect label="A partir do vencimento" id="data" name="data" defaultValue={proximo ?? abertos[0]}>
                {abertos.slice(0, 12).map((d) => (
                  <option key={d} value={d}>{formatarDataBr(d)}</option>
                ))}
              </CampoSelect>
            </div>
            <CampoSelect
              label="Vale para" id="escopo" name="escopo" defaultValue="somente_este"
              dica="“Este e os próximos” encerra esta série na data escolhida e abre outra com o valor novo — o que foi pago antes continua registrado como era."
            >
              <option value="somente_este">Somente este vencimento</option>
              <option value="proximos">Este e os próximos</option>
            </CampoSelect>
            <button className="w-full rounded-xl bg-accent py-3.5 font-semibold text-acao-texto">Aplicar</button>
          </form>
        </>
      )}

      <SecaoPagina>Já lançados</SecaoPagina>
      <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
        {lancados.length === 0 && (
          <p className="apoio py-6 text-center text-dim">Nenhum vencimento desta série foi lançado ainda.</p>
        )}
        {lancados.map((l) => (
          <LinhaLista
            key={l.id}
            href={`/financeiro/lancamentos/${l.id}`}
            titulo={formatarDataBr(l.data)}
            subtitulo={l.status === "pago" ? (l.tipo === "entrada" ? "Recebido" : "Pago") : "Pendente"}
            valor={formatarReais(l.valor_centavos)}
            valorClassName={l.status === "pendente" ? "text-dim" : ""}
          />
        ))}
      </div>

      {editavel && (
        <form action={alternarRecorrente} className="mt-6">
          <input type="hidden" name="recorrencia_id" value={rec.id} />
          <input type="hidden" name="ativa" value={rec.ativa ? "0" : "1"} />
          <button className={`w-full rounded-xl py-3 text-sm font-semibold ${
            rec.ativa ? "border border-crit/40 text-crit" : "border border-line"
          }`}>
            {rec.ativa ? "Encerrar recorrente" : "Reativar recorrente"}
          </button>
          <p className="apoio mt-2 text-center text-dim">
            Encerrar não apaga nada: os vencimentos já lançados continuam no extrato.
          </p>
        </form>
      )}
    </main>
  )
}
