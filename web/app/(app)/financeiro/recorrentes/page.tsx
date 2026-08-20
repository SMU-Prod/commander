import Link from "next/link"
import { redirect } from "next/navigation"
import { Icone } from "@/components/icone"
import { AcoesUniversais, FinanceiroNav } from "@/components/ui/financeiro-nav"
import { BotaoPendente } from "@/components/ui/botao-pendente"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { LinhaLista } from "@/components/ui/linha-lista"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { marcarVencimentoPago } from "@/lib/acoes/financeiro"
import { carregarPainel, hojeISO } from "@/lib/consultas"
import {
  ROTULO_CATEGORIA, ROTULO_FREQUENCIA, formatarDataBr, vencimentosNoIntervalo,
} from "@/lib/domain/financeiro"
import { formatarReais } from "@/lib/domain/gastos"
import { podeEditar, podeVer } from "@/lib/domain/permissoes"
import { supabaseServer } from "@/lib/supabase/server"
import { ALVO_ACAO, PILULA_ACAO } from "@/lib/ui/acoes"
import type { LancamentoFinanceiro, RecorrenciaFinanceira } from "@/lib/db/types"

/**
 * Financeiro · Recorrentes (PRD FINAL §9.2).
 *
 * O que esta tela mostra em cima são VENCIMENTOS EM ABERTO — calculados a
 * partir da regra da série, não linhas gravadas. É a tradução direta de "um
 * vencimento não é automaticamente 'pago'; usuário marca como pago": até
 * alguém clicar, o mês que vem não existe no banco. Quando o vencimento é
 * marcado (ou ganha valor próprio), vira lançamento e some daqui.
 */
export default async function RecorrentesPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (!podeVer(painel.permissoes, "gastos")) {
    redirect(`/hoje?erro=${encodeURIComponent("Seu acesso não inclui o Financeiro.")}`)
  }
  const editavel = podeEditar(painel.permissoes, "gastos")

  const hoje = hojeISO()
  // Janela: 3 meses pra trás (o que venceu e ninguém marcou) e 2 meses pra
  // frente (o que está chegando). Mais que isso vira lista de dívida
  // imaginária; menos esconde atraso.
  const de = new Date(Date.parse(`${hoje}T00:00:00Z`) - 92 * 86_400_000).toISOString().slice(0, 10)
  const ate = new Date(Date.parse(`${hoje}T00:00:00Z`) + 62 * 86_400_000).toISOString().slice(0, 10)

  const supabase = await supabaseServer()
  const [{ data: recBrutas, error }, { data: lancBrutos }] = await Promise.all([
    supabase.from("recorrencias_financeiras").select("*")
      .eq("embarcacao_id", painel.embarcacao.id).order("created_at", { ascending: false }),
    supabase.from("lancamentos_financeiros").select("id, recorrencia_id, data, status, valor_centavos")
      .eq("embarcacao_id", painel.embarcacao.id).not("recorrencia_id", "is", null).gte("data", de),
  ])
  if (error) throw new Error("Não foi possível carregar as recorrentes. Recarregue a página.")

  const recorrentes = (recBrutas ?? []) as RecorrenciaFinanceira[]
  const jaLancados = new Set(
    ((lancBrutos ?? []) as Pick<LancamentoFinanceiro, "recorrencia_id" | "data">[])
      .map((l) => `${l.recorrencia_id}:${l.data}`),
  )

  const emAberto = recorrentes
    .filter((r) => r.ativa)
    .flatMap((r) =>
      vencimentosNoIntervalo({ inicio: r.inicio, fim: r.fim, frequencia: r.frequencia }, de, ate)
        .filter((data) => !jaLancados.has(`${r.id}:${data}`))
        .map((data) => ({ rec: r, data })),
    )
    .sort((a, b) => a.data.localeCompare(b.data))

  const ativas = recorrentes.filter((r) => r.ativa)
  const encerradas = recorrentes.filter((r) => !r.ativa)

  return (
    <main>
      <h1 className="titulo-pagina">Financeiro</h1>

      <FinanceiroNav atual="recorrentes" className="mt-4" />
      <AcoesUniversais className="mt-3" />
      {erro && <p className="corpo mt-3 rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      <SecaoPagina icone="calendario">Vencimentos em aberto</SecaoPagina>
      <p className="apoio -mt-1 mb-2 text-dim">
        Nada aqui está pago até você marcar. O Commander não dá baixa sozinho.
      </p>
      <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
        {emAberto.length === 0 && (
          <EstadoVazio
            variant="linha"
            icone="calendario"
            titulo="Nenhum vencimento em aberto"
            descricao={ativas.length === 0 ? "Cadastre uma recorrente abaixo." : "Tudo em dia por aqui."}
          />
        )}
        {emAberto.map(({ rec, data }) => (
          <LinhaLista
            key={`${rec.id}:${data}`}
            titulo={rec.descricao}
            subtitulo={
              <>
                <span className={data < hoje ? "text-crit" : ""}>
                  {data < hoje ? "venceu " : "vence "}{formatarDataBr(data)}
                </span>
                {" · "}{formatarReais(rec.valor_centavos)}
              </>
            }
            trailing={
              editavel ? (
                <form action={marcarVencimentoPago} className="shrink-0">
                  <input type="hidden" name="recorrencia_id" value={rec.id} />
                  <input type="hidden" name="data" value={data} />
                  {/* Era uma caixa de 36px — 8px abaixo da régua — e o gesto
                      mais consequente da tela (dar baixa em conta). Agora é
                      o alvo de 44px com a pílula de 30px dentro, igual à
                      ação de todo cabeçalho de seção. */}
                  {/* ONDA 125 — `BotaoPendente`: dar baixa em conta é o gesto
                      mais consequente da tela, e o segundo toque lançava a
                      MESMA baixa duas vezes. A pílula pulsa enquanto grava. */}
                  <BotaoPendente className={ALVO_ACAO}>
                    <span className={PILULA_ACAO}>{rec.tipo === "entrada" ? "Recebi" : "Paguei"}</span>
                  </BotaoPendente>
                </form>
              ) : (
                <span className="apoio shrink-0 text-dim">{formatarReais(rec.valor_centavos)}</span>
              )
            }
          />
        ))}
      </div>

      <SecaoPagina
        icone="repetir"
        acao={editavel ? { href: "/financeiro/recorrentes/nova", rotulo: "Recorrente", icone: "mais" } : undefined}
      >
        Séries ativas
      </SecaoPagina>
      <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
        {ativas.length === 0 && (
          <EstadoVazio
            variant="linha"
            icone="repetir"
            titulo="Nenhuma recorrente cadastrada"
            descricao="Vaga da marina, seguro, diarista — o que se repete em intervalo fixo."
            acao={editavel ? { href: "/financeiro/recorrentes/nova", rotulo: "Cadastrar recorrente" } : undefined}
          />
        )}
        {ativas.map((r) => (
          <LinhaLista
            key={r.id}
            href={`/financeiro/recorrentes/${r.id}`}
            titulo={r.descricao}
            subtitulo={`${ROTULO_FREQUENCIA[r.frequencia]} · ${ROTULO_CATEGORIA[r.categoria]}${r.fim ? ` · até ${formatarDataBr(r.fim)}` : ""}`}
            valor={formatarReais(r.valor_centavos)}
            valorClassName={r.tipo === "entrada" ? "text-ok" : ""}
          />
        ))}
      </div>

      {encerradas.length > 0 && (
        <>
          <SecaoPagina>Encerradas</SecaoPagina>
          <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
            {encerradas.map((r) => (
              <LinhaLista
                key={r.id}
                href={`/financeiro/recorrentes/${r.id}`}
                titulo={r.descricao}
                subtitulo={`${ROTULO_FREQUENCIA[r.frequencia]} · encerrada`}
                valor={formatarReais(r.valor_centavos)}
                valorClassName="text-dim"
              />
            ))}
          </div>
        </>
      )}

      {editavel && (
        <Link
          href="/financeiro/recorrentes/nova"
          className="mt-6 flex h-12 items-center justify-center gap-1.5 rounded-[var(--raio-controle)] border border-line bg-panel text-sm font-semibold"
        >
          {/* "Cadastrar recorrente", a mesma palavra do estado vazio logo
              acima: duas frases para o mesmo destino na mesma tela é o
              começo dos oito rótulos que a auditoria contou (DESIGN §6
              regra 6). */}
          <Icone nome="mais" className="size-4" /> Cadastrar recorrente
        </Link>
      )}
    </main>
  )
}
