import Link from "next/link"
import { redirect } from "next/navigation"
import { BarraCapacidade } from "@/components/ui/barra-capacidade"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { Chip, ChipLinha } from "@/components/ui/chip"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { GraficoBarras } from "@/components/ui/grafico-barras"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { carregarPainel, hojeISO } from "@/lib/consultas"
import {
  consolidarFrota, fraseSemProcedencia, inicioDoPeriodo, linhaDaUnidade, origensQuePesaram,
  PERIODOS_FROTA, ROTULO_ORIGEM, ROTULO_PERIODO,
  type CustoLancado, type OrigemCusto, type PeriodoFrota,
} from "@/lib/domain/financeiro-frota"
import { formatarReais } from "@/lib/domain/gastos"
import { podeVer } from "@/lib/domain/permissoes"
import { supabaseServer } from "@/lib/supabase/server"

/**
 * CUSTO DA FROTA (onda 78 — PRD §12).
 *
 * Responde a pergunta do ADM em três níveis, de cima pra baixo: quanto a
 * frota custou no período, em que isso foi gasto, e quais unidades puxaram o
 * total. As unidades vêm ordenadas por maior custo — numa frota de 40, quem
 * está no topo é quem merece a próxima conversa.
 *
 * O que esta tela NÃO mostra, por decisão do §12: receita, margem, cobrança
 * de cotista. É custo operacional e só.
 */
export default async function FrotaPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>
}) {
  const { periodo: periodoBruto } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (!podeVer(painel.permissoes, "gastos")) {
    redirect(`/hoje?erro=${encodeURIComponent("Seu acesso não inclui o Financeiro.")}`)
  }

  const periodo = (PERIODOS_FROTA as readonly string[]).includes(periodoBruto ?? "")
    ? (periodoBruto as PeriodoFrota)
    : "mes"
  const desde = inicioDoPeriodo(periodo, hojeISO())

  const supabase = await supabaseServer()
  const { data } = await supabase
    .from("lancamentos_financeiros")
    .select("embarcacao_id, origem, valor_centavos")
    .eq("tipo", "despesa")
    .gte("data", desde)
    .in("embarcacao_id", painel.embarcacoes.map((e) => e.id))

  // AUDITORIA 19/08, B1 — AQUI ESTAVA `l.origem ?? "manual"`, E ERA A ÚNICA
  // AFIRMAÇÃO FALSA DO APP.
  //
  // A coluna existe (migration 065) mas nenhum insert a preenchia, então todo
  // custo virava "Lançamento manual" e o gráfico "Em quê" tinha uma barra só,
  // 100%, em qualquer conta e para sempre. O conserto tem duas metades e as
  // duas eram necessárias:
  //
  //   1. Passar a GRAVAR a origem de verdade. Retirada de estoque e saída do
  //      tanque para uma unidade agora criam o lançamento com procedência
  //      (`lancarCustoComOrigem`, em lib/acoes/enterprise.ts) — é a "entrada
  //      automática no Financeiro" que o §12 pede e que faltava.
  //
  //   2. Parar de fingir sobre o que já existe. Os lançamentos antigos, e todo
  //      lançamento feito à mão em /financeiro, continuam sem origem — e
  //      marcá-los em massa seria inventar procedência. Então `null` desce
  //      como `null` e a consolidação o mantém no total sem escolher gaveta.
  //
  // Sem a metade 2 a tela mentiria por mais um ano (até a base antiga secar);
  // sem a metade 1 ela nunca teria o que mostrar.
  const lancamentos: CustoLancado[] = (data ?? []).map((l: {
    embarcacao_id: string; origem: OrigemCusto | null; valor_centavos: number
  }) => ({
    embarcacaoId: l.embarcacao_id,
    origem: l.origem,
    valorCentavos: l.valor_centavos,
  }))

  const r = consolidarFrota(painel.embarcacoes, lancamentos)
  const origens = origensQuePesaram(r.porOrigem)
  const semProcedencia = fraseSemProcedencia(r.totalCentavos, r.semProcedenciaCentavos)

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref="/financeiro"
        voltarRotulo="Financeiro"
        titulo="Custo da frota"
        descricao="Quanto cada unidade custou para operar — e em quê."
      />

      <ChipLinha className="mt-4">
        {PERIODOS_FROTA.map((p) => (
          <Chip key={p} href={p === "mes" ? "/frota" : `/frota?periodo=${p}`} ativo={p === periodo}>
            {ROTULO_PERIODO[p]}
          </Chip>
        ))}
      </ChipLinha>

      <div className="sombra-1 mt-4 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
        <p className="rotulo text-dim">Total da frota</p>
        <p className="mt-1 tabular-nums text-2xl font-semibold tabular-nums">
          {formatarReais(r.totalCentavos)}
        </p>
        <p className="apoio mt-1 text-dim">
          {painel.embarcacoes.length === 1 ? "1 unidade" : `${painel.embarcacoes.length} unidades`}
          {" · desde "}
          <span className="tabular-nums tabular-nums">{desde.split("-").reverse().join("/")}</span>
        </p>
      </div>

      {/* O "Em quê" só aparece quando ALGUMA coisa tem procedência. Quando nada
          tem, o lugar dele é ocupado por um estado vazio que diz a verdade e
          ensina como sair dela — antes desta correção era aqui que morava a
          barra única de 100% "Lançamento manual". */}
      {origens.length === 0 ? (
        r.totalCentavos > 0 && (
          <>
            <SecaoPagina icone="relatorio">Em quê</SecaoPagina>
            <EstadoVazio
              variant="linha"
              icone="relatorio"
              titulo="Nenhum custo do período diz de onde veio"
              descricao={
                "Retirada pelo Estoque e saída pelo Combustível entram no Financeiro já com a " +
                "procedência. Lançamento feito à mão em /financeiro não tem como saber, e o app " +
                "não escolhe por ele."
              }
            />
          </>
        )
      ) : (
        <>
          {/* Onda 79 (instrumentos) — a lista virou `GraficoBarras` (spec §2
              item 5, "Fleet Utilization Trend"): a origem que mais pesou
              entra em destaque (tooltip já aberto), igual à barra do dia
              atual na referência — aqui não há "hoje", então o destaque vai
              para quem mais custou, que é a pergunta que esta seção
              responde. `cor="var(--dado)"` e não o dourado padrão do
              componente: a onda 63 já corrigiu esse mesmo erro em
              `GraficoMesesGastos` (dourado é ação/marca, não dado), e usar o
              padrão aqui reabriria o mesmo defeito. */}
          <SecaoPagina icone="relatorio">Em quê</SecaoPagina>
          <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
            <GraficoBarras
              pontos={origens.map((o) => ({
                rotulo: ROTULO_ORIGEM[o],
                valor: r.porOrigem[o] / 100,
                apoio: `${Math.round((r.porOrigem[o] / r.totalCentavos) * 100)}% do total`,
                destaque: o === origens[0],
              }))}
              cor="var(--dado)"
              metrica="R$"
              rotulo="Custo por origem"
            />
            {/* As barras somam menos que o total da frota sempre que houver
                lançamento sem origem — dizer QUANTO falta é o que impede o
                leitor de concluir que o gráfico cobre tudo. */}
            {semProcedencia && <p className="apoio mt-3 text-dim">{semProcedencia}</p>}
          </div>
        </>
      )}

      <SecaoPagina icone="embarcacao">Por unidade</SecaoPagina>
      {r.unidades.length === 0 ? (
        <EstadoVazio
          variant="linha"
          icone="embarcacao"
          titulo="Nenhuma unidade cadastrada"
          // A PORTA DA IMPORTAÇÃO (§21, A9). Ela mora aqui e não no Menu de
          // propósito: quem tem a planilha de 40 unidades na mão está sem
          // NENHUMA cadastrada, e é este estado vazio que ele encontra
          // primeiro. Um item permanente no Menu para uma ação que se faz uma
          // vez na vida da conta custaria mais atenção do que vale. O link
          // repetido embaixo cobre quem já tem frota e vai crescer.
          acao={{ href: "/frota/importar", rotulo: "Importar planilha" }}
        />
      ) : (
        <div className="space-y-2">
          {r.unidades.map((u) => (
            // AUDITORIA 19/08, B11 — ISTO ERA UM `<Link href="/financeiro">`.
            // O chevron implícito prometia "clique para ver os lançamentos
            // DESTA unidade" e entregava a lista genérica, que /financeiro
            // monta sempre pela unidade ATIVA (não aceita filtro por
            // embarcação). Link que leva a um lugar que não responde a
            // pergunta é pior que ausência de link: gasta o toque e devolve
            // outra tela. Enquanto /financeiro não souber receber a unidade,
            // esta é uma linha de dado, e se comporta como tal.
            <div
              key={u.embarcacaoId}
              className="sombra-1 block rounded-[var(--raio-cartao)] border border-line bg-panel p-3.5"
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="titulo-card min-w-0 flex-1 truncate">{u.nome}</p>
                {/* O valor em texto: a barra dá a proporção, e a proporção
                    sozinha não responde "quanto foi", que é a pergunta que
                    leva alguém a abrir esta tela. */}
                <span className="shrink-0 tabular-nums text-sm font-semibold tabular-nums">
                  {formatarReais(u.totalCentavos)}
                </span>
              </div>
              {/* Onda 79 (instrumentos) — a barra fina + texto separado virou
                  `BarraCapacidade` (spec §2 item 3): o mesmo par número/barra
                  da referência, agora com chip de % e cor por faixa. `total`
                  é o custo da FROTA inteira, não um teto arbitrário — a
                  pergunta que a barra responde continua sendo "que fatia do
                  gasto total é desta unidade", a mesma da barra antiga.
                  `unidadeAntes`: "R$" vem antes do número em português.
                  Zero cai em `neutro` por conta própria (nunca "ok"), o que
                  já é a leitura certa: unidade parada não é uma boa notícia,
                  só não é uma leitura ruim ainda. */}
              <BarraCapacidade
                className="mt-2"
                usado={u.totalCentavos / 100}
                total={r.totalCentavos / 100}
                unidade="R$"
                unidadeAntes
                // A frase mora no domínio (`linhaDaUnidade`, com teste): ela
                // decide o que a tela PODE afirmar sobre a procedência, e foi
                // exatamente essa decisão que estava errada aqui no JSX.
                rotulo={linhaDaUnidade(u)}
              />
            </div>
          ))}
        </div>
      )}

      {r.unidades.length > 0 && (
        <Link
          href="/frota/importar"
          className="mt-3 flex min-h-11 items-center justify-center rounded-[var(--raio-controle)] border border-line px-4 text-sm font-medium"
        >
          Importar mais unidades de uma planilha
        </Link>
      )}

      <p className="apoio mt-4 text-dim">
        Só custo operacional. Cobrança de cotista, venda de cota e receita da administradora não
        passam pelo Commander.
      </p>
    </main>
  )
}
