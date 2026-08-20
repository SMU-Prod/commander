import { redirect } from "next/navigation"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { BotaoEnviar } from "@/components/ui/botao-enviar"
import { Campo, CampoSelect } from "@/components/ui/campo"
import { DonutNivel } from "@/components/ui/donut-nivel"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { Selo } from "@/components/ui/selo"
import { criarTanque, movimentarTanque } from "@/lib/acoes/enterprise"
import { carregarPainel, hojeISO } from "@/lib/consultas"
import {
  consolidarConsumo, divergenciaDoTanque, formatarLitros, precoPorLitroCentavos, saldoTeorico,
} from "@/lib/domain/estoque-combustivel"
import { inicioDoPeriodo } from "@/lib/domain/financeiro-frota"
import { formatarReais } from "@/lib/domain/gastos"
import { horasDeUso } from "@/lib/domain/patio"
import { supabaseServer } from "@/lib/supabase/server"
import type { Tanque, TanqueMovimento } from "@/lib/db/types"

/**
 * HUB COMBUSTÍVEL (onda 78 — PRD §11).
 *
 * O centro da tela é o BALANÇO: saldo inicial + entradas − saídas = teórico,
 * comparado com a última medição da régua. É a conta que o §11 pede e a única
 * que revela combustível sumindo.
 *
 * O saldo teórico é calculado a cada abertura, nunca guardado — número
 * derivado que se guarda é número que sai de sincronia (migration 064).
 */
export default async function CombustivelPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")

  const supabase = await supabaseServer()
  // AUDITORIA 19/08, A5 e A10 — O RELATÓRIO CENTRAL DO §11 NÃO EXISTIA.
  //
  // `abastecimentos` recebia insert em toda saída do tanque para uma unidade e
  // nenhuma tela do app conseguia exibi-la — nem na ficha da unidade, nem no
  // diário, nem no custo. Do outro lado, `consumoPorHora` estava escrita e
  // testada sem consumidor. As duas metades da mesma pergunta: "qual unidade
  // bebe mais".
  //
  // As horas vêm do PÁTIO (horímetro de saída × de chegada) e não do relógio:
  // um Jet que ficou quatro horas fora e rodou uma e meia bebeu por uma e
  // meia. Recorte de seis meses, fixo e dito na tela — período configurável
  // aqui seria mais um controle numa tela que já tem formulário por tanque.
  const desde = inicioDoPeriodo("semestre", hojeISO())
  const [{ data: tanques }, { data: movimentos }, { data: abastecidos }, { data: usos }] =
    await Promise.all([
      supabase.from("tanques").select("*").order("nome"),
      supabase.from("tanque_movimentos").select("*").order("criado_em", { ascending: false }).limit(200),
      supabase.from("abastecimentos").select("embarcacao_id, litros")
        .gte("abastecido_em", desde),
      supabase.from("movimentos_patio").select("embarcacao_id, saida_horas, retorno_horas")
        .gte("saida_em", desde).not("retorno_em", "is", null),
    ])

  // ONDA 99 (P2-5) — as duas formas saem de `lib/db/types.ts`, derivadas do
  // banco vivo. As cópias que moravam aqui eram o caso didático do achado:
  //
  //  · `Tanque` não declarava `dono_id` — e `dono_id` é o PREDICADO DA RLS
  //    desta tabela. O tipo escondia justamente a coluna que decide quem
  //    enxerga a linha, então a tela raciocinava sobre um tanque sem dono.
  //  · `Mov` foi onde a auditoria A15 achou `fornecedor` faltando: pedido no
  //    formulário logo abaixo, gravado por `movimentarTanque`, e ausente do
  //    tipo — o histórico não tinha como mostrá-lo nem por engano. Quem
  //    digitou "Posto Ilha" numa entrada de 800 litros nunca mais viu de quem
  //    comprou. Copiar a linha à mão é como uma coluna some da tela sem
  //    ninguém apagar nada.
  const lista = (tanques ?? []) as Tanque[]
  const movs = (movimentos ?? []) as TanqueMovimento[]

  // AUDITORIA 19/08, B4 — o histórico só renderizava `destino_livre`, o caso
  // EXCEPCIONAL. Toda saída para uma unidade cadastrada — o caso normal, e o
  // único que o formulário chama de obrigatório — aparecia sem destino
  // nenhum: pedia-se o dado à pessoa e ele sumia. O mapa resolve o id pelo
  // nome; id que não está aqui é unidade que esta conta não enxerga, e a
  // linha diz isso em vez de inventar um nome ou apagar o destino.
  const nomeDaUnidade = new Map(painel.embarcacoes.map((e) => [e.id, e.nome]))

  // `horasDeUso` devolve `null` quando falta uma das duas leituras — e essas
  // linhas são descartadas aqui, não convertidas em zero. Movimento sem
  // horímetro anotado não é movimento de zero hora; é movimento que não sabe
  // dizer quanto rodou, e somá-lo como zero puxaria o L/h da unidade pra
  // cima como se ela bebesse mais.
  const horasPorUnidade = ((usos ?? []) as {
    embarcacao_id: string; saida_horas: number | null; retorno_horas: number | null
  }[]).flatMap((m) => {
    const h = horasDeUso({ saidaHoras: m.saida_horas, retornoHoras: m.retorno_horas })
    return h == null ? [] : [{ embarcacaoId: m.embarcacao_id, horas: h }]
  })
  const consumo = consolidarConsumo(
    painel.embarcacoes,
    ((abastecidos ?? []) as { embarcacao_id: string; litros: number }[])
      .map((a) => ({ embarcacaoId: a.embarcacao_id, litros: Number(a.litros) })),
    horasPorUnidade,
  )

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref="/menu"
        voltarRotulo="Menu"
        titulo="Combustível"
        descricao="Tanque próprio, abastecimentos e o balanço entre a conta e a régua."
      />
      {erro && <p className="corpo mt-3 rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      {lista.length === 0 ? (
        <EstadoVazio
          icone="oleo"
          titulo="Nenhum tanque cadastrado"
          descricao="Cadastre o tanque da base abaixo para acompanhar entrada, saída e balanço."
          className="mt-4"
        />
      ) : (
        lista.map((t) => {
          const doTanque = movs.filter((m) => m.tanque_id === t.id)
          const entradas = doTanque.filter((m) => m.tipo === "entrada").reduce((s, m) => s + Number(m.litros), 0)
          const saidas = doTanque.filter((m) => m.tipo === "saida").reduce((s, m) => s + Number(m.litros), 0)
          const teorico = saldoTeorico(Number(t.saldo_inicial_litros), entradas, saidas)
          // A medição mais recente é a primeira da lista (ordenada desc).
          const ultimaMedicao = doTanque.find((m) => m.tipo === "medicao")
          const div = ultimaMedicao ? divergenciaDoTanque(teorico, Number(ultimaMedicao.litros)) : null
          const abaixoDoMinimo = t.minimo_litros != null && teorico <= Number(t.minimo_litros)

          return (
            <section key={t.id}>
              <SecaoPagina icone="oleo">{t.nome}</SecaoPagina>

              {/* Onda 79 (instrumentos) — troca da barra fina desenhada à mão
                  pelo `DonutNivel` (spec §2 item 2, "Fuel level 3.61 gal" da
                  referência): mesma leitura de tanque, agora com o líquido.
                  `percentual` só existe quando o tanque tem capacidade
                  cadastrada — sem capacidade não há teto pra medir contra, e
                  o donut mostra o litro real sem inventar o anel (§7). O
                  "abaixo do mínimo" continua como `Selo`, e não como cor do
                  próprio donut: o líquido do donut é sempre dourado (é assim
                  na referência, tanque não fica vermelho) — quem carrega o
                  alarme operacional é o selo ao lado, igual ao chip de canto
                  do velocímetro. */}
              <div className="sombra-1 relative rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
                {abaixoDoMinimo && (
                  <div className="absolute right-4 top-4 z-10">
                    <Selo estado="atencao">Abaixo do mínimo</Selo>
                  </div>
                )}
                <DonutNivel
                  valor={teorico}
                  unidade="L"
                  percentual={
                    t.capacidade_litros != null
                      ? Math.round((teorico / Number(t.capacidade_litros)) * 100)
                      : null
                  }
                  apoio={t.minimo_litros != null ? `mín. ${formatarLitros(Number(t.minimo_litros))}` : undefined}
                  rotulo={`Saldo teórico de ${t.nome}`}
                />
                <p className="apoio mt-2 text-dim">
                  Inicial <span className="tabular-nums tabular-nums">{formatarLitros(Number(t.saldo_inicial_litros))}</span>
                  {" · entradas "}<span className="tabular-nums tabular-nums text-ok">+{formatarLitros(entradas)}</span>
                  {" · saídas "}<span className="tabular-nums tabular-nums">−{formatarLitros(saidas)}</span>
                </p>

                {/* A comparação com a régua — o coração do §11. */}
                {div && (
                  <p className={`apoio mt-2 ${div.exigeMotivo ? "text-warn" : "text-dim"}`}>
                    Última medição: <span className="tabular-nums tabular-nums">{formatarLitros(div.fisico)}</span>
                    {" — "}{div.frase}
                  </p>
                )}
              </div>

              {/* `--raio-cartao` e não `--raio-painel`: os 14px cravados aqui
                  eram o mesmo desenho do painel do donut logo acima, que já
                  vinha por token. Promover só o que estava à mão deixaria dois
                  raios no mesmo nível da mesma tela. Subir a tela inteira é
                  decisão de tela, e está no relatório. */}
              <form action={movimentarTanque} className="sombra-1 mt-2 space-y-3 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
                <input type="hidden" name="tanque_id" value={t.id} />
                {/* O teórico viaja junto pra action saber se a medição
                    diverge sem recalcular o balanço inteiro. */}
                <input type="hidden" name="teorico" value={teorico} />
                <div className="grid grid-cols-2 gap-3">
                  <CampoSelect label="Movimento" id={`tipo-${t.id}`} name="tipo">
                    <option value="entrada">Entrada de combustível</option>
                    <option value="saida">Saída para unidade</option>
                    <option value="medicao">Medição da régua</option>
                  </CampoSelect>
                  <Campo label="Litros" id={`litros-${t.id}`} name="litros" inputMode="decimal" className="tabular-nums tabular-nums" />
                </div>
                <CampoSelect
                  label="Destino — obrigatório na saída"
                  id={`destino-${t.id}`}
                  name="destino_embarcacao_id"
                  defaultValue=""
                >
                  <option value="">Escolha a unidade</option>
                  {painel.embarcacoes.map((e) => (
                    <option key={e.id} value={e.id}>{e.nome}</option>
                  ))}
                </CampoSelect>
                <Campo
                  label="Ou outro destino"
                  id={`destino-livre-${t.id}`}
                  name="destino_livre"
                  placeholder="Ex.: caminhão da marina"
                />
                <div className="grid grid-cols-3 gap-3">
                  <Campo label="Fornecedor" id={`forn-${t.id}`} name="fornecedor" />
                  <Campo label="Valor (R$)" id={`valor-${t.id}`} name="valor" inputMode="decimal" className="tabular-nums tabular-nums" />
                  {/* §11: "valor total E/OU preço/litro" — quem abastece anota
                      um ou outro, conforme o que a bomba mostrou, e o app
                      completa (`totalCentavosPorLitro`). Este campo não
                      existia, e por isso a metade "preço por litro" do §11
                      nunca tinha por onde entrar. */}
                  <Campo
                    label="R$/L"
                    id={`preco-litro-${t.id}`}
                    name="preco_litro"
                    inputMode="decimal"
                    className="tabular-nums tabular-nums"
                    dica="Se preencher o total, este é ignorado."
                  />
                </div>
                <Campo
                  label="Motivo"
                  id={`motivo-${t.id}`}
                  name="motivo"
                  dica="Obrigatório quando a medição não bate com o teórico."
                />
                {/* Era `rounded-xl` — 12px, degrau que a escala não tem. Botão
                    se TOCA, então `--raio-controle`, o mesmo desenho dos
                    outros botões de formulário do app. Menos redondo que o
                    painel de propósito: raio maior contém, raio menor aperta.
                    Vale também pro "Cadastrar tanque" no fim da tela. */}
                {/* ONDA 125 — "Registrando movimento…" no lugar do silêncio;
                    a pílula de contorno é o desenho de submit secundário da
                    casa (BotaoEnviar). */}
                <BotaoEnviar rotulo="Registrar movimento" variante="contorno" />
              </form>

              {doTanque.length > 0 && (
                <div className="sombra-1 mt-2 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
                  {doTanque.slice(0, 8).map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-2 border-b border-line py-3 last:border-0">
                      <span className="min-w-0">
                        <span className="corpo block truncate">
                          {m.tipo === "entrada" ? "Entrada" : m.tipo === "saida" ? "Saída" : "Medição"}
                          {m.destino_embarcacao_id
                            ? ` · ${nomeDaUnidade.get(m.destino_embarcacao_id) ?? "unidade fora da sua lista"}`
                            : m.destino_livre
                              ? ` · ${m.destino_livre}`
                              : ""}
                        </span>
                        <span className="apoio block text-dim">
                          <span className="tabular-nums tabular-nums">
                            {new Date(m.criado_em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                          </span>
                          {/* A15 — de quem veio o combustível. Só aparece
                              quando foi anotado: movimento sem fornecedor não
                              é movimento "sem fornecedor", é movimento em que
                              ninguém digitou — e escrever um travessão ali
                              seria afirmar o contrário. */}
                          {m.fornecedor && ` · ${m.fornecedor}`}
                          {m.motivo && ` · ${m.motivo}`}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block tabular-nums text-sm tabular-nums">
                          {m.tipo === "saida" ? "−" : m.tipo === "entrada" ? "+" : ""}
                          {formatarLitros(Number(m.litros))}
                        </span>
                        {m.valor_centavos != null && (
                          <span className="apoio block tabular-nums tabular-nums text-dim">
                            {formatarReais(m.valor_centavos)}
                            {/* A10 — o formulário sempre pediu o valor e a
                                tela nunca o converteu em R$/L, que é o número
                                pelo qual se compara um posto com o outro.
                                `precoPorLitroCentavos` devolve `null` quando
                                não há litro, e aí não se escreve nada — nunca
                                "R$ 0,00/L". */}
                            {(() => {
                              const porLitro = precoPorLitroCentavos(m.valor_centavos, Number(m.litros))
                              return porLitro == null ? null : ` · ${formatarReais(porLitro)}/L`
                            })()}
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )
        })
      )}

      {/* A5 + A10 — o relatório do §11, finalmente ligado. Só aparece quando
          há o que dizer: sem abastecimento pelo tanque no período, a seção
          inteira some em vez de desenhar uma lista de zeros. */}
      {consumo.length > 0 && (
        <>
          <SecaoPagina icone="relatorio">Consumo por unidade — últimos 6 meses</SecaoPagina>
          <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
            {consumo.map((u) => (
              <div key={u.embarcacaoId} className="flex items-center justify-between gap-3 border-b border-line py-3 last:border-0">
                <span className="min-w-0">
                  <span className="corpo block truncate">{u.nome}</span>
                  <span className="apoio block tabular-nums text-dim">{u.frase}</span>
                </span>
                {u.litrosPorHora != null && (
                  <span className="shrink-0 tabular-nums text-sm font-semibold tabular-nums">
                    {u.litrosPorHora.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} L/h
                  </span>
                )}
              </div>
            ))}
          </div>
          <p className="apoio mt-2 text-dim">
            Conta só o que saiu deste tanque para a unidade. Quem abasteceu no posto não entra —
            e as horas são as do horímetro anotado no Pátio, não o tempo de relógio.
          </p>
        </>
      )}

      <SecaoPagina icone="mais">Novo tanque</SecaoPagina>
      <form action={criarTanque} className="sombra-1 space-y-3 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
        <Campo label="Nome" id="nome" name="nome" placeholder="Ex.: Tanque da base — Marina da Glória" />
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Combustível" id="combustivel" name="combustivel" placeholder="Gasolina" />
          <Campo label="Capacidade (L)" id="capacidade" name="capacidade" inputMode="decimal" className="tabular-nums tabular-nums" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Saldo inicial (L)" id="saldo_inicial" name="saldo_inicial" inputMode="decimal" className="tabular-nums tabular-nums" />
          <Campo label="Mínimo (L)" id="minimo" name="minimo" inputMode="decimal" className="tabular-nums tabular-nums" />
        </div>
        <BotaoEnviar rotulo="Cadastrar tanque" variante="contorno" />
      </form>
    </main>
  )
}
