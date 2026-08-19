import Link from "next/link"
import { redirect } from "next/navigation"
import { BotaoExportarPdf } from "@/components/botao-exportar-pdf"
import { Farol } from "@/components/farol"
import { Icone } from "@/components/icone"
import { Abas } from "@/components/ui/abas"
import { Chip, ChipLinha } from "@/components/ui/chip"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { GraficoBarras } from "@/components/ui/grafico-barras"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { carregarPainel, hojeISO } from "@/lib/consultas"
import { formatarReais } from "@/lib/domain/gastos"
import { podeVer, ROTULO_ABA, type Aba } from "@/lib/domain/permissoes"
import { mesSeguinte } from "@/lib/domain/relatorio"
import { resumoAno, type EventoParaResumoAno } from "@/lib/domain/resumo-ano"
import {
  custoPorHoraCentavos,
  gastosPorGrupoComBarra,
  mediaMensalGastosCentavos,
  mesesDoPeriodo,
  montarResumoPeriodo,
  opcoesAnuais,
  opcoesMensais,
  opcoesSemestrais,
  periodoSemAtividade,
  type OcorrenciaParaResumo,
  type TipoPeriodo,
} from "@/lib/domain/resumo-periodo"
import { supabaseServer } from "@/lib/supabase/server"

/**
 * RELATÓRIOS — CUSTO E USO (onda 62, canvas tela-1g).
 *
 * DECISÃO DE ROTA, registrada: o canvas desenha uma tela "Relatórios" que
 * funde custo (série mensal, por grupo, custo/hora) com uso (saídas, horas)
 * e o ano no mar. Das duas telas existentes, /barco/resumos JÁ era essa
 * fusão em embrião — gastos do Diário + saídas + horas de motor + gráfico
 * de meses + Exportar PDF — então a fatia alinhou AQUI, sem rota nova.
 * /financeiro/relatorios continua sendo outra coisa (lançamentos
 * financeiros: despesas × entradas, saldo, categorias, consolidado Pro) e
 * não foi tocada — os gastos DESTA tela vêm dos eventos do Diário
 * (`resumoDoMes`), e o subtítulo diz isso em voz alta.
 *
 * A anatomia do canvas: abas Gastos | Uso | Ano no mar, chips de período,
 * o cartão de custo com a série mensal, "Por grupo" com barras relativas ao
 * maior, o par de KPIs com o traço honesto ("Consumo médio" fica em traço
 * PERMANENTE: o Diário não registra litragem de abastecimento — o cartão
 * documenta exatamente o que falta registrar, DESIGN §6.7), e o Exportar
 * PDF flutuante que o e2e de sem-saída já cobra.
 */

const TIPOS: { valor: TipoPeriodo; rotulo: string }[] = [
  { valor: "mensal", rotulo: "Mensal" },
  { valor: "semestral", rotulo: "Semestral" },
  { valor: "anual", rotulo: "Anual" },
]

const ROTULO_HUB: Record<string, string> = {
  casco: "Casco", eletrica: "Elétrica", hidraulica: "Hidráulica",
  seguranca: "Segurança", equipamentos: "Equipamentos", documentos: "Documentação",
}

type AbaRelatorio = "gastos" | "uso" | "ano"

export default async function ResumosPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; periodo?: string; aba?: string }>
}) {
  const { tipo: tipoBruto, periodo: periodoBruto, aba: abaBruta } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (!podeVer(painel.permissoes, "historico")) {
    redirect(`/barco?erro=${encodeURIComponent("Seu acesso não inclui os Relatórios.")}`)
  }
  const { embarcacao, itens, equipamentos, permissoes } = painel
  const hoje = hojeISO()
  const vejaGastos = podeVer(permissoes, "gastos")

  // A aba Gastos só existe pra quem vê gastos — a porta segue a sala
  // (onda 52): pra quem não vê, o padrão é Uso e a aba nem aparece.
  const aba: AbaRelatorio =
    abaBruta === "uso" ? "uso"
    : abaBruta === "ano" ? "ano"
    : vejaGastos ? "gastos" : "uso"

  const tipo: TipoPeriodo = tipoBruto === "semestral" || tipoBruto === "anual" ? tipoBruto : "mensal"
  const opcoes = tipo === "mensal" ? opcoesMensais(hoje) : tipo === "semestral" ? opcoesSemestrais(hoje) : opcoesAnuais(hoje)
  const chave = opcoes.some((o) => o.chave === periodoBruto) ? (periodoBruto as string) : opcoes[0].chave

  const meses = mesesDoPeriodo(tipo, chave, hoje)
  const inicioJanela = meses.length > 0 ? `${meses[0]}-01` : hoje
  const fimJanelaExclusivo = meses.length > 0 ? `${mesSeguinte(meses[meses.length - 1])}-01` : hoje
  const anoAtual = Number(hoje.slice(0, 4))

  const supabase = await supabaseServer()
  const [{ data: eventos, error: erroEventos }, { data: ocorrencias, error: erroOcorrencias }, { data: eventosAno }] = await Promise.all([
    supabase.from("eventos").select("*").eq("embarcacao_id", embarcacao.id)
      .gte("data", inicioJanela).lt("data", fimJanelaExclusivo),
    supabase.from("ocorrencias").select("estado, created_at, resolvida_em").eq("embarcacao_id", embarcacao.id),
    // "Ano no mar" — só quando a aba pede: as saídas do ano corrente, com a
    // trilha (a distância só existe com trilha GPS de verdade, `resumoAno`).
    aba === "ano"
      ? supabase.from("eventos").select("tipo, data, hora_saida, hora_retorno, trilha")
          .eq("embarcacao_id", embarcacao.id).eq("tipo", "navegacao").gte("data", `${anoAtual}-01-01`)
      : Promise.resolve({ data: [] as EventoParaResumoAno[] }),
  ])
  if (erroEventos || erroOcorrencias) throw new Error("Não foi possível carregar o relatório. Recarregue a página.")

  const r = montarResumoPeriodo(
    {
      eventos: eventos ?? [],
      itens,
      equipamentos,
      ocorrencias: (ocorrencias ?? []) as OcorrenciaParaResumo[],
    },
    { tipo, chave },
    hoje,
  )

  const vazio = periodoSemAtividade(r)
  const hubsVisiveis = r.hubs.filter((h) => podeVer(permissoes, h.aba as Aba))
  const totaisAno = resumoAno((eventosAno ?? []) as EventoParaResumoAno[], anoAtual)

  const comFiltro = (novoTipo?: TipoPeriodo, novoPeriodo?: string) => {
    const t = novoTipo ?? tipo
    const opcoesDoTipo = t === "mensal" ? opcoesMensais(hoje) : t === "semestral" ? opcoesSemestrais(hoje) : opcoesAnuais(hoje)
    const p = novoTipo && novoTipo !== tipo ? opcoesDoTipo[0].chave : (novoPeriodo ?? chave)
    return `/barco/resumos?aba=${aba}&tipo=${t}&periodo=${encodeURIComponent(p)}`
  }
  // Trocar de aba PRESERVA o período — filtrar não é trocar de assunto
  // (mesma regra dos links de /notificacoes). "Ano no mar" não usa período
  // (é sempre o ano corrente) mas o carrega adiante sem quebrar nada.
  const linkAba = (a: AbaRelatorio) =>
    `/barco/resumos?aba=${a}&tipo=${tipo}&periodo=${encodeURIComponent(chave)}`

  const custoHora = custoPorHoraCentavos(r.totalGastosCentavos, r.horasMotor)
  const mediaMensal = mediaMensalGastosCentavos(r)
  const barras = gastosPorGrupoComBarra(r.gastosPorGrupo)

  return (
    <main>
      <Link href="/barco" className="no-imprimir inline-flex items-center gap-1 rotulo text-accent-forte">
        <Icone nome="voltar" className="size-4" /> Barco
      </Link>

      <h1 className="titulo-pagina mt-3">Relatórios</h1>
      <p className="apoio mt-1 text-dim">
        {embarcacao.nome} · custo por mês, uso e o que sai do bolso — do que está registrado no Diário.
      </p>

      <Abas
        className="no-imprimir mt-4"
        ativa={aba}
        abas={[
          ...(vejaGastos ? [{ valor: "gastos", rotulo: "Gastos", href: linkAba("gastos") }] : []),
          { valor: "uso", rotulo: "Uso", href: linkAba("uso") },
          { valor: "ano", rotulo: "Ano no mar", href: linkAba("ano") },
        ]}
      />

      {aba !== "ano" && (
        <>
          <ChipLinha className="no-imprimir mt-4">
            {TIPOS.map((t) => (
              <Chip key={t.valor} href={comFiltro(t.valor)} ativo={tipo === t.valor}>
                {t.rotulo}
              </Chip>
            ))}
          </ChipLinha>
          <ChipLinha className="no-imprimir mt-2">
            {opcoes.map((o) => (
              <Chip key={o.chave} href={comFiltro(tipo, o.chave)} ativo={chave === o.chave} nivel="secundario">
                {o.rotulo}
              </Chip>
            ))}
          </ChipLinha>

          {vazio && (
            <p className="mt-4 rounded-lg border border-line bg-panel px-3 py-2.5 corpo text-dim">
              Nenhuma atividade registrada em {r.rotulo.toLowerCase()}. O que está cadastrado no barco hoje continua
              logo abaixo — nenhum número foi inventado pra preencher o período.
            </p>
          )}
        </>
      )}

      {/* ============================== GASTOS ============================ */}
      {aba === "gastos" && vejaGastos && (
        <>
          {/* O cartão de custo do canvas: rótulo, número grande, média e a
              série mensal DENTRO do mesmo cartão. */}
          <div className="sombra-1 mt-4 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <p className="rotulo text-dim">Custo do período</p>
              <span className="apoio text-dim">{r.rotulo}</span>
            </div>
            <p className="font-mono-instr text-3xl tabular-nums">{formatarReais(r.totalGastosCentavos)}</p>
            {mediaMensal != null && (
              <p className="apoio mt-1 text-dim">
                média mensal <span className="font-mono-instr tabular-nums">{formatarReais(mediaMensal)}</span>
              </p>
            )}
            {/* Onda 79 (instrumentos) — mesma troca de `GraficoMesesGastos`
                por `GraficoBarras`; 110px fixo (não responsivo) porque este
                gráfico já vive dentro do cartão "Custo do período" acima,
                que tem altura própria — mesmo raciocínio do mini-gráfico de
                /hoje. */}
            {r.evolucaoMensal.length > 1 && (
              <div className="mt-4">
                <GraficoBarras
                  pontos={r.evolucaoMensal.map((m) => ({
                    rotulo: m.rotulo.slice(0, 3).toLowerCase(),
                    valor: m.gastosCentavos / 100,
                    destaque: m.mes === hoje.slice(0, 7),
                  }))}
                  cor="var(--dado)"
                  metrica="R$"
                  alturaClasse="h-[110px]"
                  rotulo="Evolução mensal de gastos"
                />
              </div>
            )}
          </div>

          {/* Por grupo, com barra relativa ao maior (canvas): a barra compara
              grupos entre si. O líder em `bg-texto`, não dourado — os dois
              dourados de conteúdo da tela já têm dono (chip ativo e o
              Exportar PDF flutuante). */}
          <div className="sombra-1 mt-3 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
            <p className="rotulo mb-3 text-dim">Por grupo — {r.rotulo}</p>
            {barras.length === 0 ? (
              <p className="corpo text-dim">Nenhum gasto registrado no período.</p>
            ) : (
              <div className="space-y-3">
                {barras.map((g, i) => (
                  <div key={g.grupo}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="corpo font-medium">{g.grupo}</span>
                      <span className="font-mono-instr text-sm font-semibold tabular-nums">{formatarReais(g.totalCentavos)}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-panel2">
                      <div
                        className={`h-full rounded-full ${i === 0 ? "bg-texto" : "bg-dim"}`}
                        style={{ width: `${g.percentual}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* O par de KPIs do canvas — com o traço honesto: sem hora de motor
              não há custo/hora, e o Diário não registra litragem, então
              consumo médio fica em traço com o motivo escrito (DESIGN §6.7). */}
          <div className="mt-3 flex gap-2">
            <div className="sombra-1 flex-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-3.5">
              <p className="rotulo text-dim">Custo por hora</p>
              <p className="mt-1.5 font-mono-instr text-[20px] font-semibold tabular-nums">
                {custoHora != null ? formatarReais(custoHora) : "—"}
              </p>
              <p className="apoio mt-0.5 text-dim">
                {/* `custoPorHoraCentavos` devolve null por DOIS motivos (sem
                    hora de motor OU sem gasto lançado) — a legenda antiga
                    citava só um, e um período com 12 h de motor e nenhum
                    gasto dizia "sem hora de motor" enquanto a aba Uso, na
                    mesma tela, mostrava as 12 h. */}
                {custoHora != null
                  ? `sobre ${Math.round(r.horasMotor)} h de motor`
                  : r.horasMotor > 0
                    ? "sem gasto lançado no período"
                    : "sem hora de motor no período"}
              </p>
            </div>
            <div className="sombra-1 flex-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-3.5">
              <p className="rotulo text-dim">Consumo médio</p>
              <p className="mt-1.5 font-mono-instr text-[20px] font-semibold tabular-nums">—</p>
              <p className="apoio mt-0.5 text-dim">sem abastecimento com litragem</p>
            </div>
          </div>

          <SecaoPagina icone="oleo">Abastecimentos</SecaoPagina>
          <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
            {r.abastecimentos.quantidade === 0 ? (
              <p className="corpo text-dim">Nenhum abastecimento registrado no período.</p>
            ) : (
              <p className="corpo">
                <span className="font-mono-instr text-xl tabular-nums">{r.abastecimentos.quantidade}</span>{" "}
                abastecimento{r.abastecimentos.quantidade === 1 ? "" : "s"} ·{" "}
                <span className="font-mono-instr tabular-nums">{formatarReais(r.abastecimentos.totalCentavos)}</span>
              </p>
            )}
          </div>
        </>
      )}

      {/* =============================== USO ============================== */}
      {aba === "uso" && (
        <>
          <SecaoPagina icone="grafico">Atividade no período</SecaoPagina>
          <div className="sombra-1 grid grid-cols-3 divide-x divide-line rounded-[var(--raio-cartao)] border border-line bg-panel">
            {[
              { rotulo: "Saídas", valor: String(r.saidas) },
              { rotulo: "Registros no diário", valor: String(r.totalDiario) },
              { rotulo: "Horas de motor", valor: `${Math.round(r.horasMotor)} h` },
            ].map((c) => (
              <div key={c.rotulo} className="p-3 text-center">
                <p className="font-mono-instr text-xl tabular-nums">{c.valor}</p>
                <p className="apoio mt-0.5 text-dim">{c.rotulo}</p>
              </div>
            ))}
          </div>

          <SecaoPagina icone="ferramenta">Manutenções</SecaoPagina>
          <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
            {r.manutencoesRealizadas === 0 ? (
              <p className="corpo text-dim">Nenhuma manutenção registrada no período.</p>
            ) : (
              <p className="corpo">
                <span className="font-mono-instr text-xl tabular-nums">{r.manutencoesRealizadas}</span>{" "}
                manutenç{r.manutencoesRealizadas === 1 ? "ão registrada" : "ões registradas"} no diário
              </p>
            )}
          </div>

          <SecaoPagina icone="alerta">Ocorrências</SecaoPagina>
          <div className="sombra-1 grid grid-cols-2 divide-x divide-line rounded-[var(--raio-cartao)] border border-line bg-panel">
            <div className="p-3 text-center">
              <p className="font-mono-instr text-xl tabular-nums">{r.ocorrenciasAbertasNoPeriodo}</p>
              <p className="apoio mt-0.5 text-dim">Abertas no período</p>
            </div>
            <div className="p-3 text-center">
              <p className="font-mono-instr text-xl tabular-nums">{r.ocorrenciasResolvidasNoPeriodo}</p>
              <p className="apoio mt-0.5 text-dim">Resolvidas no período</p>
            </div>
          </div>

          {r.evolucaoMensal.length > 1 && (
            <>
              <SecaoPagina icone="grafico">Evolução no período</SecaoPagina>
              <div className="sombra-1 overflow-x-auto rounded-[var(--raio-cartao)] border border-line bg-panel">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-line">
                      <th className="rotulo px-3 py-2 text-dim">Mês</th>
                      <th className="rotulo px-3 py-2 text-right text-dim">Saídas</th>
                      <th className="rotulo px-3 py-2 text-right text-dim">Horas motor</th>
                      {vejaGastos && <th className="rotulo px-3 py-2 text-right text-dim">Gastos</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {r.evolucaoMensal.map((m) => (
                      <tr key={m.mes} className="border-b border-line last:border-0">
                        <td className="corpo px-3 py-2">{m.rotulo}</td>
                        <td className="corpo px-3 py-2 text-right font-mono-instr tabular-nums">{m.saidas}</td>
                        <td className="corpo px-3 py-2 text-right font-mono-instr tabular-nums">{Math.round(m.horasMotor)} h</td>
                        {vejaGastos && (
                          <td className="corpo px-3 py-2 text-right font-mono-instr tabular-nums">{formatarReais(m.gastosCentavos)}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <SecaoPagina icone="escudo">Estado atual dos setores</SecaoPagina>
          <p className="apoio -mt-1 mb-2 text-dim">Retrato de hoje — não muda por período, o app não guarda o histórico de status de cada item.</p>
          <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
            {hubsVisiveis.length === 0 && (
              <p className="corpo py-4 text-center text-dim">Seu acesso não inclui esses setores.</p>
            )}
            {hubsVisiveis.map((h) => (
              <div key={h.aba} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
                <span className="min-w-0 flex-1 corpo">{ROTULO_HUB[h.aba] ?? ROTULO_ABA[h.aba as Aba]}</span>
                {h.total === 0 ? (
                  <span className="apoio text-dim">Nada cadastrado</span>
                ) : (
                  <span className="flex items-center gap-3 font-mono-instr text-xs tabular-nums text-dim">
                    {h.ok > 0 && <span className="inline-flex items-center gap-1"><Farol status="ok" /> {h.ok}</span>}
                    {h.atencao > 0 && <span className="inline-flex items-center gap-1"><Farol status="atencao" /> {h.atencao}</span>}
                    {h.vencido > 0 && <span className="inline-flex items-center gap-1"><Farol status="vencido" /> {h.vencido}</span>}
                    {h.semInformacao > 0 && <span>{h.semInformacao} sem regra</span>}
                  </span>
                )}
              </div>
            ))}
          </div>

          <SecaoPagina icone="calendario">A vencer no mês seguinte</SecaoPagina>
          <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
            {r.aVencer.length === 0 ? (
              <EstadoVazio variant="linha" icone="calendario" titulo="Nada vencendo logo depois deste período" />
            ) : (
              r.aVencer.map((i) => (
                <div key={`${i.nome}-${i.quando}`} className="flex items-center justify-between border-b border-line py-3 last:border-0">
                  <span className="corpo">{i.nome}</span>
                  <span className="apoio font-mono-instr tabular-nums text-dim">{i.quando.split("-").reverse().join("/")}</span>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* ============================ ANO NO MAR ========================== */}
      {aba === "ano" && (
        totaisAno == null ? (
          <EstadoVazio
            icone="embarcacao"
            titulo={`Nenhuma saída registrada em ${anoAtual}`}
            descricao="Registre as saídas no Diário de Bordo e o ano no mar se monta sozinho."
            className="mt-5"
          />
        ) : (
          <>
            <div className="sombra-1 mt-4 grid grid-cols-3 divide-x divide-line rounded-[var(--raio-cartao)] border border-line bg-panel">
              {[
                { rotulo: "Saídas", valor: String(totaisAno.saidas) },
                // Sem trilha GPS não há distância — o honesto é o traço:
                // "0 MN" diria que o barco saiu e não andou (mesma régua da
                // Início, `resumoAno`).
                { rotulo: "Distância", valor: totaisAno.milhasNm > 0 ? `${Math.round(totaisAno.milhasNm).toLocaleString("pt-BR")} MN` : "—" },
                { rotulo: "No mar", valor: totaisAno.horasNoMar > 0 ? `${Math.round(totaisAno.horasNoMar)} h` : "—" },
              ].map((c) => (
                <div key={c.rotulo} className="p-3 text-center">
                  <p className="font-mono-instr text-xl tabular-nums">{c.valor}</p>
                  <p className="apoio mt-0.5 text-dim">{c.rotulo}</p>
                </div>
              ))}
            </div>
            <p className="apoio mt-2 text-dim">
              {anoAtual} até hoje. Distância soma só saídas com trilha GPS; horas, só as com saída e retorno anotados.
            </p>
          </>
        )
      )}

      <p className="no-imprimir apoio mt-6 text-center text-dim">Gerado em {hoje.split("-").reverse().join("/")} pelo Commander.</p>

      <BotaoExportarPdf />
    </main>
  )
}
