import { redirect } from "next/navigation"
import { Icone } from "@/components/icone"
import { AcoesUniversais, FinanceiroNav } from "@/components/ui/financeiro-nav"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { GraficoBarras } from "@/components/ui/grafico-barras"
import { LinhaLista } from "@/components/ui/linha-lista"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { carregarPainel, hojeISO } from "@/lib/consultas"
import {
  ROTULO_CATEGORIA, compararPeriodos, formatarDataBr, periodoAnterior, periodoMensal,
  proximoVencimento, resumoFinanceiro, rotuloStatus,
} from "@/lib/domain/financeiro"
import { formatarReais, resumoGastos } from "@/lib/domain/gastos"
import { podeVer } from "@/lib/domain/permissoes"
import { supabaseServer } from "@/lib/supabase/server"
import type { LancamentoFinanceiro, RecorrenciaFinanceira } from "@/lib/db/types"

/**
 * Financeiro · Visão Geral (PRD FINAL §9.1). O panorama do mês: quanto saiu,
 * quanto entrou, o que ainda vence e para onde o dinheiro está indo.
 *
 * Lê SÓ de `lancamentos_financeiros` — `eventos.custo_centavos` continua
 * existindo como histórico do evento no Diário, mas somar as duas fontes
 * contaria o mesmo gasto duas vezes (ver migration 042).
 */
export default async function FinanceiroPage({
  searchParams,
}: {
  // §24, "nunca falhar silenciosamente" (onda 53): `/financeiro/novo` e
  // `/financeiro/recorrentes/nova` mandam a pessoa de volta pra cá com
  // `?erro=` quando a permissão não permite. Sem este parâmetro a mensagem
  // morria na URL e a pessoa voltava pra Visão Geral sem entender o que
  // aconteceu — o silêncio que o §24 proíbe.
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (!podeVer(painel.permissoes, "gastos")) {
    redirect(`/hoje?erro=${encodeURIComponent("Seu acesso não inclui o Financeiro.")}`)
  }

  const hoje = hojeISO()
  const [ano, mes] = hoje.split("-").map(Number)
  const periodo = periodoMensal(ano, mes)
  const anterior = periodoAnterior(periodo)
  // Janela de 13 meses: cobre o gráfico de 6 meses e o mês anterior da
  // comparação com folga, sem puxar o extrato inteiro da embarcação.
  const inicioJanela = periodoMensal(ano - 1, mes).de

  const supabase = await supabaseServer()
  const [{ data: brutos, error }, { data: recorrentes }] = await Promise.all([
    supabase.from("lancamentos_financeiros").select("*")
      .eq("embarcacao_id", painel.embarcacao.id).gte("data", inicioJanela)
      .order("data", { ascending: false }),
    supabase.from("recorrencias_financeiras").select("*")
      .eq("embarcacao_id", painel.embarcacao.id).eq("ativa", true),
  ])
  if (error) throw new Error("Não foi possível carregar o Financeiro. Recarregue a página.")

  const lancamentos = (brutos ?? []) as LancamentoFinanceiro[]
  const paraResumo = lancamentos.map((l) => ({
    tipo: l.tipo, categoria: l.categoria, valorCentavos: l.valor_centavos,
    data: l.data, status: l.status, recorrente: l.recorrencia_id != null,
  }))
  const r = resumoFinanceiro(paraResumo, periodo)
  const comparacao = compararPeriodos(r, resumoFinanceiro(paraResumo, anterior))

  // Barras dos 6 meses reaproveitam `resumoGastos` (onda 8) — mesma leitura
  // visual do cartão de /hoje, agora alimentada pelo Financeiro.
  const seisMeses = resumoGastos(
    lancamentos
      .filter((l) => l.tipo === "despesa" && l.status === "pago")
      .map((l) => ({ data: l.data, custoCentavos: l.valor_centavos, grupo: ROTULO_CATEGORIA[l.categoria] })),
    hoje,
  )

  // Próximos vencimentos das séries ativas — o que ainda vai vencer, não o
  // que já foi lançado (PRD §9.2: vencimento não é pago até alguém marcar).
  const proximos = ((recorrentes ?? []) as RecorrenciaFinanceira[])
    .map((rec) => ({ rec, data: proximoVencimento({ inicio: rec.inicio, fim: rec.fim, frequencia: rec.frequencia }, hoje) }))
    .filter((x): x is { rec: RecorrenciaFinanceira; data: string } => x.data != null)
    .sort((a, b) => a.data.localeCompare(b.data))
    .slice(0, 4)

  const pendentes = lancamentos
    .filter((l) => l.status === "pendente")
    .sort((a, b) => a.data.localeCompare(b.data))
    .slice(0, 5)

  return (
    <main>
      <h1 className="titulo-pagina">Financeiro</h1>
      {erro && <p className="corpo mt-3 rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      <FinanceiroNav atual="visao" className="mt-4" />
      <AcoesUniversais className="mt-3" />

      <SecaoPagina icone="cifrao">{periodo.rotulo}</SecaoPagina>
      <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="rotulo text-dim">Despesas pagas</p>
          {comparacao.despesasPercentual != null && (
            <span className={`apoio inline-flex items-center gap-0.5 ${
              comparacao.despesasPercentual > 0 ? "text-crit" : comparacao.despesasPercentual < 0 ? "text-ok" : "text-dim"
            }`}>
              <Icone nome="chevron" className={`size-3 ${comparacao.despesasPercentual >= 0 ? "-rotate-90" : "rotate-90"}`} />
              {Math.abs(comparacao.despesasPercentual)}% vs. mês anterior
            </span>
          )}
        </div>
        {/* ONDA 87, os três degraus do número (globals.css). O gasto do mês é
            o assunto desta tela — `.valor-instrumento`; entradas e saldo são
            o degrau de KPI — `.valor-forte`. Antes eram `text-3xl` e
            `text-xl`, dois tamanhos que não existem em régua nenhuma e que
            deixavam o número sem peso e sem a cor de dado. */}
        <p className="mt-1 tabular-nums valor-instrumento">{formatarReais(r.despesasCentavos)}</p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <p className="rotulo text-dim">Entradas</p>
            <p className="mt-0.5 tabular-nums valor-forte text-ok">{formatarReais(r.entradasCentavos)}</p>
          </div>
          <div>
            <p className="rotulo text-dim">Saldo do mês</p>
            <p className={`mt-0.5 tabular-nums valor-forte ${r.saldoCentavos < 0 ? "text-crit" : ""}`}>
              {formatarReais(r.saldoCentavos)}
            </p>
          </div>
        </div>

        {(r.aPagarCentavos > 0 || r.aReceberCentavos > 0) && (
          <div className="mt-4 border-t border-line pt-3">
            {r.aPagarCentavos > 0 && (
              <p className="corpo flex justify-between">
                <span className="text-dim">A pagar</span>
                <span className="tabular-nums valor">{formatarReais(r.aPagarCentavos)}</span>
              </p>
            )}
            {r.aReceberCentavos > 0 && (
              <p className="corpo mt-1 flex justify-between">
                <span className="text-dim">A receber</span>
                <span className="tabular-nums valor">{formatarReais(r.aReceberCentavos)}</span>
              </p>
            )}
            {/* O PRD é taxativo: orçamento/proposta não é despesa. "Pendente"
                aqui é conta já assumida — por isso não entra no total pago. */}
            <p className="apoio mt-2 text-dim">Pendente é conta assumida que ainda não foi paga — não entra no total acima.</p>
          </div>
        )}
      </div>

      {r.totalLancamentos === 0 && (
        <EstadoVazio
          className="mt-4"
          icone="cifrao"
          titulo="Nada lançado neste mês ainda"
          descricao="Use + Despesa ou + Entrada acima. O Financeiro funciona sozinho, sem depender de nenhuma outra tela."
        />
      )}

      {/* Onda 79 (instrumentos) — `GraficoMesesGastos` refinado para
          `GraficoBarras` (spec §2 item 5, que já nasceu com este exato
          objetivo — ver o comentário do próprio componente). `cor="var(--dado)"`
          de propósito, não o dourado padrão: é o mesmo bug que a onda 63 já
          tinha corrigido no componente antigo (dourado é ação/marca, não
          dado) — usar o padrão do componente novo reabriria o defeito.
          `metrica="R$"` entra como rótulo do tooltip, e não como sufixo:
          "R$" em português vem ANTES do número, e o `sufixo` do componente
          só cola DEPOIS — ver o mesmo raciocínio no `unidadeAntes` novo de
          `BarraCapacidade`. */}
      <SecaoPagina icone="grafico">Despesas dos últimos 6 meses</SecaoPagina>
      <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
        <GraficoBarras
          pontos={seisMeses.meses.map((m) => ({
            rotulo: m.rotulo,
            valor: m.totalCentavos / 100,
            destaque: m.mes === hoje.slice(0, 7),
          }))}
          cor="var(--dado)"
          metrica="R$"
          rotulo="Despesas dos últimos 6 meses"
        />
      </div>

      {r.porCategoria.length > 0 && (
        <>
          <SecaoPagina icone="relatorio" acao={{ href: "/financeiro/relatorios", rotulo: "Relatórios" }}>
            Por categoria no mês
          </SecaoPagina>
          <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
            {r.porCategoria.map((c) => (
              <LinhaLista
                key={c.categoria}
                titulo={c.rotulo}
                subtitulo={c.entradasCentavos > 0 ? `Entradas: ${formatarReais(c.entradasCentavos)}` : undefined}
                valor={formatarReais(c.despesasCentavos)}
              />
            ))}
          </div>
        </>
      )}

      {proximos.length > 0 && (
        <>
          {/* "Ver tudo" e não "Ver todas": um rótulo só pro gesto "abrir a
              seção" (DESIGN §6 regra 6). A concordância com "recorrentes"
              parecia mais caprichada e custava um oitavo vocabulário — quem
              lê a tela reconhece a FORMA da ação, não o gênero dela. */}
          <SecaoPagina icone="repetir" acao={{ href: "/financeiro/recorrentes", rotulo: "Ver tudo" }}>
            Próximos vencimentos
          </SecaoPagina>
          <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
            {proximos.map(({ rec, data }) => (
              <LinhaLista
                key={rec.id}
                href={`/financeiro/recorrentes/${rec.id}`}
                titulo={rec.descricao}
                subtitulo={`${ROTULO_CATEGORIA[rec.categoria]} · vence ${formatarDataBr(data)}`}
                valor={formatarReais(rec.valor_centavos)}
              />
            ))}
          </div>
        </>
      )}

      {pendentes.length > 0 && (
        <>
          <SecaoPagina icone="alerta">Aguardando pagamento</SecaoPagina>
          <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
            {pendentes.map((l) => (
              <LinhaLista
                key={l.id}
                href={`/financeiro/lancamentos/${l.id}`}
                titulo={l.descricao}
                subtitulo={`${formatarDataBr(l.data)} · ${rotuloStatus(l.tipo, l.status)}`}
                valor={formatarReais(l.valor_centavos)}
                valorClassName={l.tipo === "entrada" ? "text-ok" : ""}
              />
            ))}
          </div>
        </>
      )}
    </main>
  )
}
