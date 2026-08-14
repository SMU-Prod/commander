import Link from "next/link"
import { redirect } from "next/navigation"
import { BotaoExportarPdf } from "@/components/botao-exportar-pdf"
import { Farol } from "@/components/farol"
import { GraficoMesesGastos } from "@/components/grafico-meses-gastos"
import { Icone } from "@/components/icone"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { carregarPainel, hojeISO } from "@/lib/consultas"
import { formatarReais } from "@/lib/domain/gastos"
import { podeVer, ROTULO_ABA, type Aba } from "@/lib/domain/permissoes"
import { mesSeguinte } from "@/lib/domain/relatorio"
import {
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

const TIPOS: { valor: TipoPeriodo; rotulo: string }[] = [
  { valor: "mensal", rotulo: "Mensal" },
  { valor: "semestral", rotulo: "Semestral" },
  { valor: "anual", rotulo: "Anual" },
]

const ROTULO_HUB: Record<string, string> = {
  casco: "Casco", eletrica: "Elétrica", hidraulica: "Hidráulica",
  seguranca: "Segurança", equipamentos: "Equipamentos", documentos: "Documentação",
}

export default async function ResumosPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; periodo?: string }>
}) {
  const { tipo: tipoBruto, periodo: periodoBruto } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (!podeVer(painel.permissoes, "historico")) {
    redirect(`/barco?erro=${encodeURIComponent("Seu acesso não inclui os Resumos.")}`)
  }
  const { embarcacao, itens, equipamentos, permissoes } = painel
  const hoje = hojeISO()

  const tipo: TipoPeriodo = tipoBruto === "semestral" || tipoBruto === "anual" ? tipoBruto : "mensal"
  const opcoes = tipo === "mensal" ? opcoesMensais(hoje) : tipo === "semestral" ? opcoesSemestrais(hoje) : opcoesAnuais(hoje)
  const chave = opcoes.some((o) => o.chave === periodoBruto) ? (periodoBruto as string) : opcoes[0].chave

  const meses = mesesDoPeriodo(tipo, chave, hoje)
  const inicioJanela = meses.length > 0 ? `${meses[0]}-01` : hoje
  const fimJanelaExclusivo = meses.length > 0 ? `${mesSeguinte(meses[meses.length - 1])}-01` : hoje

  const supabase = await supabaseServer()
  const [{ data: eventos, error: erroEventos }, { data: ocorrencias, error: erroOcorrencias }] = await Promise.all([
    supabase.from("eventos").select("*").eq("embarcacao_id", embarcacao.id)
      .gte("data", inicioJanela).lt("data", fimJanelaExclusivo),
    supabase.from("ocorrencias").select("estado, created_at, resolvida_em").eq("embarcacao_id", embarcacao.id),
  ])
  if (erroEventos || erroOcorrencias) throw new Error("Não foi possível carregar o resumo. Recarregue a página.")

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
  const vejaGastos = podeVer(permissoes, "gastos")
  const hubsVisiveis = r.hubs.filter((h) => podeVer(permissoes, h.aba as Aba))

  const comFiltro = (novoTipo?: TipoPeriodo, novoPeriodo?: string) => {
    const t = novoTipo ?? tipo
    const opcoesDoTipo = t === "mensal" ? opcoesMensais(hoje) : t === "semestral" ? opcoesSemestrais(hoje) : opcoesAnuais(hoje)
    const p = novoTipo && novoTipo !== tipo ? opcoesDoTipo[0].chave : (novoPeriodo ?? chave)
    return `/barco/resumos?tipo=${t}&periodo=${encodeURIComponent(p)}`
  }

  return (
    <main>
      <Link href="/barco" className="no-imprimir inline-flex items-center gap-1 rotulo text-accent-forte">
        <Icone nome="voltar" className="size-4" /> Barco
      </Link>

      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="titulo-pagina truncate">Resumos</h1>
          <p className="apoio mt-1 text-dim">{embarcacao.nome} · {r.rotulo}</p>
        </div>
      </div>

      <div className="no-imprimir mt-4 flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {TIPOS.map((t) => (
          <Link
            key={t.valor}
            href={comFiltro(t.valor)}
            className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 font-mono-instr text-[11.5px] tracking-wide ${
              tipo === t.valor ? "border-accent bg-accent font-semibold text-acao-texto" : "border-line bg-panel text-dim"
            }`}
          >
            {t.rotulo}
          </Link>
        ))}
      </div>
      <div className="no-imprimir mt-2 flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {opcoes.map((o) => (
          <Link
            key={o.chave}
            href={comFiltro(tipo, o.chave)}
            className={`whitespace-nowrap rounded-full border px-3 py-1 font-mono-instr text-[11px] tracking-wide ${
              chave === o.chave ? "border-accent-forte text-accent-forte" : "border-line text-dim"
            }`}
          >
            {o.rotulo}
          </Link>
        ))}
      </div>

      {vazio && (
        <p className="mt-4 rounded-lg border border-line bg-panel px-3 py-2.5 corpo text-dim">
          Nenhuma atividade registrada em {r.rotulo.toLowerCase()}. O que está cadastrado no barco hoje continua
          logo abaixo — nenhum número foi inventado pra preencher o período.
        </p>
      )}

      <SecaoPagina icone="grafico">Atividade no período</SecaoPagina>
      <div className="sombra-1 grid grid-cols-3 divide-x divide-line rounded-[14px] border border-line bg-panel">
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
      <div className="sombra-1 rounded-[14px] border border-line bg-panel p-4">
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
      <div className="sombra-1 grid grid-cols-2 divide-x divide-line rounded-[14px] border border-line bg-panel">
        <div className="p-3 text-center">
          <p className="font-mono-instr text-xl tabular-nums">{r.ocorrenciasAbertasNoPeriodo}</p>
          <p className="apoio mt-0.5 text-dim">Abertas no período</p>
        </div>
        <div className="p-3 text-center">
          <p className="font-mono-instr text-xl tabular-nums">{r.ocorrenciasResolvidasNoPeriodo}</p>
          <p className="apoio mt-0.5 text-dim">Resolvidas no período</p>
        </div>
      </div>

      {vejaGastos && (
        <>
          <SecaoPagina icone="oleo">Abastecimentos</SecaoPagina>
          <div className="sombra-1 rounded-[14px] border border-line bg-panel p-4">
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

          <SecaoPagina icone="cifrao" acao={{ href: "/barco/gastos", rotulo: "Ver tudo" }}>Gastos</SecaoPagina>
          <div className="sombra-1 rounded-[14px] border border-line bg-panel p-4">
            <p className="font-mono-instr text-3xl tabular-nums">{formatarReais(r.totalGastosCentavos)}</p>
            {r.gastosPorGrupo.length === 0 ? (
              <p className="apoio mt-1 text-dim">Nenhum gasto registrado no período.</p>
            ) : (
              <div className="mt-3 space-y-1.5">
                {r.gastosPorGrupo.map((g) => (
                  <div key={g.grupo} className="corpo flex justify-between">
                    <span className="text-dim">{g.grupo}</span>
                    <span className="font-mono-instr tabular-nums">{formatarReais(g.totalCentavos)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {r.evolucaoMensal.length > 1 && (
        <>
          <SecaoPagina icone="grafico">Evolução no período</SecaoPagina>
          {vejaGastos && (
            <GraficoMesesGastos
              meses={r.evolucaoMensal.map((m) => ({ mes: m.mes, rotulo: m.rotulo.slice(0, 3).toLowerCase(), totalCentavos: m.gastosCentavos }))}
              mesAtual={hoje.slice(0, 7)}
            />
          )}
          <div className={`sombra-1 overflow-x-auto rounded-[14px] border border-line bg-panel ${vejaGastos ? "mt-2" : ""}`}>
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
      <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
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
      <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
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

      <p className="no-imprimir apoio mt-6 text-center text-dim">Gerado em {hoje.split("-").reverse().join("/")} pelo Commander.</p>

      <BotaoExportarPdf />
    </main>
  )
}
