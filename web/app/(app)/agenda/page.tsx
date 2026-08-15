import Link from "next/link"
import { redirect } from "next/navigation"
import { Farol } from "@/components/farol"
import { Icone } from "@/components/icone"
import { Chip, ChipLinha } from "@/components/ui/chip"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { LinhaLista } from "@/components/ui/linha-lista"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import {
  agruparPorDia,
  camadaTemFonte,
  CAMADAS,
  diasDaSemana,
  gradeDoMes,
  janelaDaVisualizacao,
  montarAgenda,
  NOMES_DIA_SEMANA,
  podeGerenciarEventos,
  podeVerAgenda,
  ROTULO_CAMADA,
  ROTULO_VISUALIZACAO,
  rotuloDia,
  rotuloMes,
  rotuloSemana,
  somarDias,
  VISUALIZACOES,
  type Camada,
  type CompromissoParaAgenda,
  type DerivadoParaAgenda,
  type ItemAgenda,
  type Visualizacao,
} from "@/lib/domain/agenda"
import { carregarPainel, hojeISO, itemMonitoradoToItemCalc } from "@/lib/consultas"
import { abaDoItem, nomeDoEquipamento } from "@/lib/domain/diario"
import { ESTADOS_QUE_PESAM_NA_SAUDE, faroDoEstado, ROTULO_ESTADO } from "@/lib/domain/ocorrencias"
import { podeEditar, podeVer, ROTULO_ABA, type Aba } from "@/lib/domain/permissoes"
import { mesAnteriorISO, mesSeguinte } from "@/lib/domain/relatorio"
import { calcularSemaforo, vencimentoPorData } from "@/lib/domain/semaforo"
import { supabaseServer } from "@/lib/supabase/server"
import type { AgendaEvento, Documento, Ocorrencia } from "@/lib/db/types"

/**
 * AGENDA (onda 43, PRD §8) — Mês, Semana e Lista.
 *
 * Vocabulário da tela (PRD é explícito): ninguém "cria uma agenda", cria
 * COMPROMISSO. A palavra "evento" não aparece pro usuário aqui — no
 * Commander ela já é o registro do Diário de Bordo, e usar a mesma palavra
 * pras duas coisas foi exatamente o que o glossário do CONTRIBUTING.md
 * proíbe ("um conceito, um nome").
 *
 * As camadas da Agenda Detalhada são DERIVADAS, nunca copiadas: o
 * vencimento sai de `itens_monitorados`/`documentos` com o MESMO
 * `calcularSemaforo` que pinta o farol do hub, e a pendência sai de
 * `ocorrencias`. Some o item, some da agenda — não há segunda cópia pra
 * divergir.
 */

/** Pra onde a linha derivada leva quem só pode VER (o editar tem tela própria). */
function rotaDoHub(aba: Aba): string {
  if (aba === "eletrica") return "/barco/eletrica"
  if (aba === "hidraulica") return "/barco/hidraulica"
  if (aba === "seguranca") return "/barco/seguranca"
  if (aba === "documentos") return "/barco/documentos"
  if (aba === "equipamentos") return "/barco/equipamentos"
  return "/barco"
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ v?: string; d?: string; c?: string; feitos?: string; erro?: string; ok?: string }>
}) {
  const { v: vBruto, d: dBruto, c: cBruto, feitos, erro } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (!podeVerAgenda(painel.permissoes)) {
    redirect(`/hoje?erro=${encodeURIComponent("Seu acesso não inclui a Agenda desta embarcação.")}`)
  }
  const podeCriar = podeGerenciarEventos(painel.permissoes)

  const hoje = hojeISO()
  const visualizacao: Visualizacao = (VISUALIZACOES as readonly string[]).includes(vBruto ?? "")
    ? (vBruto as Visualizacao)
    : "mes"
  const ancora = /^\d{4}-\d{2}-\d{2}$/.test(dBruto ?? "") ? (dBruto as string) : hoje
  const janela = janelaDaVisualizacao(visualizacao, ancora)
  const incluirConcluidos = feitos === "1"

  // Filtros de camada pela URL — só as que têm fonte de dado hoje entram
  // (`camadaTemFonte`), então um link antigo com "financeiro" não faz a
  // tela prometer o que ela não tem.
  const camadas = (cBruto ?? "")
    .split(",")
    .filter((c): c is Camada => (CAMADAS as readonly string[]).includes(c) && camadaTemFonte(c as Camada))
  const detalhada = camadas.length > 0

  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  // Compromissos: a RLS (migration 044) já devolve SÓ os meus e os que
  // compartilharam comigo — não existe filtro de dono aqui, de propósito.
  const { data: compromissosBrutos, error: erroCompromissos } = await supabase
    .from("agenda_eventos")
    .select("*")
    .eq("embarcacao_id", painel.embarcacao.id)
    .gte("data", janela.de)
    .lte("data", janela.ate)
    .order("data")
  if (erroCompromissos) throw new Error("Não foi possível carregar a Agenda. Recarregue a página.")
  const compromissos = ((compromissosBrutos ?? []) as AgendaEvento[]).map<CompromissoParaAgenda>((c) => ({
    id: c.id,
    titulo: c.titulo,
    descricao: c.descricao,
    data: c.data,
    hora: c.hora,
    visibilidade: c.visibilidade,
    concluido_em: c.concluido_em,
    criado_por: c.criado_por,
  }))

  // ---- camadas derivadas -------------------------------------------------
  // Nada é consultado quando a camada está desligada: a Agenda normal
  // (o padrão) não paga o preço das camadas técnicas.
  const derivados: DerivadoParaAgenda[] = []

  for (const item of camadas.length > 0 ? painel.itens : []) {
    const vencimento = vencimentoPorData(itemMonitoradoToItemCalc(item))
    if (vencimento == null) continue // sem data não há dia pra pendurar na agenda
    const aba = abaDoItem(item, painel.equipamentos)
    const camada: Camada = aba === "documentos" ? "documentos" : aba === "seguranca" ? "seguranca" : "manutencoes"
    const eq = painel.equipamentos.find((e) => e.id === item.equipamento_id) ?? null
    const r = calcularSemaforo(itemMonitoradoToItemCalc(item), eq?.horas_atuais ?? null, hoje)
    derivados.push({
      id: item.id,
      data: vencimento,
      titulo: item.nome,
      detalhe: eq ? nomeDoEquipamento(eq) : ROTULO_ABA[aba],
      camada,
      href: podeEditar(painel.permissoes, aba) ? `/barco/itens/${item.id}/editar` : rotaDoHub(aba),
      status: r.status,
    })
  }

  // Documentos avulsos com validade (a tabela `documentos`) — os que estão
  // amarrados a um item já entraram acima; incluir de novo duplicaria a
  // mesma validade em dois lugares da mesma tela.
  if (camadas.includes("documentos") && podeVer(painel.permissoes, "documentos")) {
    const { data: docs } = await supabase
      .from("documentos").select("*").eq("embarcacao_id", painel.embarcacao.id)
      .not("validade", "is", null).is("item_monitorado_id", null)
    for (const d of (docs ?? []) as Documento[]) {
      if (d.validade == null) continue
      derivados.push({
        id: d.id,
        data: d.validade,
        titulo: d.nome,
        detalhe: "Documento",
        camada: "documentos",
        href: "/barco/documentos",
        status: calcularSemaforo({ intervaloHoras: null, intervaloMeses: null, dataFixa: d.validade, ultimoCicloData: null, ultimoCicloHoras: null }, null, hoje).status,
      })
    }
  }

  // "Tarefas" = ocorrência ainda não resolvida — no Commander é literalmente
  // "o que precisa de ação" (PRD §7: "Diário gera histórico. Ocorrência gera
  // ação."). Ancorada no dia em que foi aberta, que é a única data real que
  // existe: a Agenda não inventa prazo que ninguém definiu.
  // Lista explícita em vez de "tudo menos resolvida": a onda 44 (paralela a
  // esta) criou o estado `anulada` — ocorrência aberta por engano. Anulada
  // não é tarefa pendente de ninguém, e com o filtro por negação ela viraria
  // item da Agenda pra sempre. `ESTADOS_QUE_PESAM_NA_SAUDE` é a mesma origem
  // que a Início e a Saúde usam, então as três telas nunca divergem.
  const { data: ocorrenciasBrutas } = camadas.includes("tarefas")
    ? await supabase.from("ocorrencias").select("*")
        .eq("embarcacao_id", painel.embarcacao.id)
        .in("estado", ESTADOS_QUE_PESAM_NA_SAUDE as readonly string[])
    : { data: [] as Ocorrencia[] }
  for (const o of (ocorrenciasBrutas ?? []) as Ocorrencia[]) {
    derivados.push({
      id: o.id,
      data: o.created_at.slice(0, 10),
      titulo: o.titulo,
      detalhe: `${ROTULO_ABA[o.aba]} · ${ROTULO_ESTADO[o.estado]}`,
      camada: "tarefas",
      href: `/barco/ocorrencias/${o.id}`,
      // `?? "vencido"`: o filtro acima já garante aberta/em_acompanhamento, que
      // nunca devolvem null — o fallback existe só pra não precisar de `as`,
      // que foi exatamente o cast mentiroso que escondeu o NaN na Saúde.
      status: faroDoEstado(o.estado) ?? "vencido",
    })
  }

  const itens = montarAgenda({ compromissos, derivados }, {
    usuarioId: user?.id ?? null,
    janela,
    camadas,
    incluirConcluidos,
  })
  const porDia = agruparPorDia(itens)

  // ---- navegação por URL -------------------------------------------------
  const link = (novo: Partial<{ v: Visualizacao; d: string; c: string; feitos: string }>) => {
    const p = new URLSearchParams()
    const vv = novo.v ?? visualizacao
    const dd = novo.d ?? ancora
    const cc = novo.c ?? camadas.join(",")
    const ff = novo.feitos ?? (incluirConcluidos ? "1" : "")
    if (vv !== "mes") p.set("v", vv)
    if (dd !== hoje) p.set("d", dd)
    if (cc) p.set("c", cc)
    if (ff === "1") p.set("feitos", "1")
    const qs = p.toString()
    return qs ? `/agenda?${qs}` : "/agenda"
  }

  // Semana anda 7 dias; Mês e Lista andam um mês (reaproveita `mesSeguinte`/
  // `mesAnteriorISO` do relatório em vez de escrever outra virada de ano).
  const porSemana = visualizacao === "semana"
  const anterior = porSemana ? somarDias(ancora, -7) : `${mesAnteriorISO(ancora)}-01`
  const proximo = porSemana ? somarDias(ancora, 7) : `${mesSeguinte(ancora.slice(0, 7))}-01`
  const tituloPeriodo = visualizacao === "semana" ? rotuloSemana(ancora) : rotuloMes(ancora.slice(0, 7))

  const alternarCamada = (c: Camada) => {
    const set = new Set(camadas)
    if (set.has(c)) set.delete(c)
    else set.add(c)
    return link({ c: [...set].join(",") })
  }

  return (
    <main>
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="titulo-pagina">Agenda</h1>
        {podeCriar && (
          <Link href="/agenda/novo" className="shrink-0 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-acao-texto">
            <span className="inline-flex items-center gap-1">
              <Icone nome="mais" className="size-4" /> Compromisso
            </span>
          </Link>
        )}
      </div>
      <p className="apoio mt-1 text-dim">
        Seus compromissos e os que compartilharam com você. Ligue a Agenda detalhada para ver
        também o que vence no barco.
      </p>

      {erro && <p className="corpo mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      {/* Mês | Semana | Lista — PRD §8 */}
      <div className="mt-4 flex gap-1.5">
        {VISUALIZACOES.map((vv) => (
          <Link
            key={vv}
            href={link({ v: vv })}
            aria-current={visualizacao === vv ? "page" : undefined}
            /* Onda 56 — mesmas medidas do `Chip` (h-11, sans, px-4). Este
               seletor não usa o componente porque as três opções dividem a
               largura em partes iguais (`flex-1`), e não rolam numa fila; o
               que importa é que ele deixe de ser a quarta altura de pílula
               desta mesma tela. */
            className={`flex h-11 flex-1 items-center justify-center rounded-full border text-sm ${
              visualizacao === vv ? "border-accent bg-accent font-semibold text-acao-texto" : "border-line bg-panel text-dim"
            }`}
          >
            {ROTULO_VISUALIZACAO[vv]}
          </Link>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <Link href={link({ d: anterior })} aria-label="Período anterior"
          className="flex size-9 items-center justify-center rounded-full border border-line bg-panel text-dim">
          <Icone nome="voltar" className="size-4" />
        </Link>
        <div className="min-w-0 text-center">
          <p className="titulo-card truncate">{tituloPeriodo}</p>
          {ancora.slice(0, 7) !== hoje.slice(0, 7) && (
            <Link href={link({ d: hoje })} className="apoio text-accent-forte">Voltar para hoje</Link>
          )}
        </div>
        <Link href={link({ d: proximo })} aria-label="Próximo período"
          className="flex size-9 items-center justify-center rounded-full border border-line bg-panel text-dim">
          <Icone nome="chevron" className="size-4" />
        </Link>
      </div>

      {/* Agenda Detalhada — camadas técnicas com filtro (PRD §8). Só as
          camadas que têm fonte de dado viram chip: prometer "Financeiro"
          antes de o módulo existir seria porta pra sala vazia. */}
      <SecaoPagina icone="ferramenta">Agenda detalhada</SecaoPagina>
      <ChipLinha quebra>
        {CAMADAS.filter(camadaTemFonte).map((c) => (
          <Chip key={c} href={alternarCamada(c)} ativo={camadas.includes(c)} nivel="secundario">
            {ROTULO_CAMADA[c]}
          </Chip>
        ))}
        {detalhada && (
          <Chip href={link({ c: "" })} ativo={false} nivel="secundario">
            Limpar
          </Chip>
        )}
      </ChipLinha>
      {!detalhada && (
        <p className="apoio mt-2 text-dim">
          Toque em uma camada para trazer manutenções, documentos, segurança e tarefas do barco
          para dentro da agenda.
        </p>
      )}

      {visualizacao === "mes" && (
        <VistaMes mesISO={ancora.slice(0, 7)} diaSelecionado={ancora} hoje={hoje} porDia={porDia} link={link} />
      )}
      {visualizacao === "semana" && <VistaSemana ancora={ancora} hoje={hoje} porDia={porDia} />}
      {visualizacao === "lista" && <VistaLista itens={itens} hoje={hoje} podeCriar={podeCriar} />}

      {/* "Histórico de coisas já realizadas não polui a Agenda normal" (PRD
          §8) — mas continua alcançável, nunca apagado. */}
      <div className="mt-6 text-center">
        <Link href={link({ feitos: incluirConcluidos ? "" : "1" })} className="apoio text-accent-forte">
          {incluirConcluidos ? "Esconder o que já foi feito" : "Mostrar o que já foi feito"}
        </Link>
      </div>
    </main>
  )
}

/** Bolinha do dia na grade: farol quando vem de uma camada, ponto de acento
 *  quando é compromisso de gente. */
function Marcador({ item }: { item: ItemAgenda }) {
  if (item.status) return <Farol status={item.status} />
  return <span className="inline-block size-2 shrink-0 rounded-full bg-accent-forte" />
}

function LinhaAgenda({ item }: { item: ItemAgenda }) {
  return (
    <LinhaLista
      href={item.href ?? undefined}
      leading={<Marcador item={item} />}
      titulo={
        <span className={item.concluido ? "line-through text-dim" : undefined}>
          {item.titulo}
          {item.compartilhado && (
            <Icone nome="pessoas" className="ml-1.5 inline size-3.5 align-[-2px] text-dim" />
          )}
        </span>
      }
      subtitulo={item.origem === "compromisso" ? item.detalhe ?? undefined : `${ROTULO_CAMADA[item.origem]}${item.detalhe ? ` · ${item.detalhe}` : ""}`}
      valor={item.hora ?? undefined}
    />
  )
}

function VistaMes({
  mesISO, diaSelecionado, hoje, porDia, link,
}: {
  mesISO: string
  diaSelecionado: string
  hoje: string
  porDia: Map<string, ItemAgenda[]>
  link: (novo: { d: string }) => string
}) {
  const semanas = gradeDoMes(mesISO)
  const doDia = porDia.get(diaSelecionado) ?? []
  return (
    <>
      <div className="sombra-1 mt-4 rounded-[14px] border border-line bg-panel p-2">
        <div className="grid grid-cols-7 text-center">
          {NOMES_DIA_SEMANA.map((n, i) => (
            <span key={i} className="rotulo py-1 text-dim">{n}</span>
          ))}
        </div>
        {semanas.map((semana) => (
          <div key={semana[0].data} className="grid grid-cols-7">
            {semana.map((dia) => {
              const itens = porDia.get(dia.data) ?? []
              const selecionado = dia.data === diaSelecionado
              return (
                <Link
                  key={dia.data}
                  href={link({ d: dia.data })}
                  aria-current={selecionado ? "date" : undefined}
                  className={`flex min-h-[46px] flex-col items-center gap-1 rounded-[10px] py-1.5 ${
                    selecionado ? "bg-accent/15 ring-1 ring-accent" : ""
                  }`}
                >
                  <span className={`font-mono-instr text-sm tabular-nums ${
                    !dia.doMes ? "text-dim/40" : dia.data === hoje ? "font-bold text-accent-forte" : ""
                  }`}>
                    {Number(dia.data.slice(8))}
                  </span>
                  <span className="flex h-2 items-center gap-0.5">
                    {itens.slice(0, 3).map((i) => <Marcador key={i.chave} item={i} />)}
                  </span>
                </Link>
              )
            })}
          </div>
        ))}
      </div>

      <SecaoPagina icone="calendario">{rotuloDia(diaSelecionado)}</SecaoPagina>
      <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
        {doDia.length === 0 ? (
          <EstadoVazio variant="linha" icone="calendario" titulo="Nada marcado neste dia" />
        ) : (
          doDia.map((i) => <LinhaAgenda key={i.chave} item={i} />)
        )}
      </div>
    </>
  )
}

function VistaSemana({
  ancora, hoje, porDia,
}: {
  ancora: string
  hoje: string
  porDia: Map<string, ItemAgenda[]>
}) {
  const dias = diasDaSemana(ancora)
  return (
    <div className="mt-4 space-y-3">
      {dias.map((dia) => {
        const itens = porDia.get(dia) ?? []
        return (
          <div key={dia}>
            <p className={`rotulo mb-1 ${dia === hoje ? "text-accent-forte" : "text-dim"}`}>
              {rotuloDia(dia)}{dia === hoje ? " · hoje" : ""}
            </p>
            <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
              {itens.length === 0 ? (
                <p className="apoio py-3 text-dim">Livre</p>
              ) : (
                itens.map((i) => <LinhaAgenda key={i.chave} item={i} />)
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function VistaLista({ itens, hoje, podeCriar }: { itens: ItemAgenda[]; hoje: string; podeCriar: boolean }) {
  if (itens.length === 0) {
    return (
      <EstadoVazio
        icone="calendario"
        titulo="Nenhum compromisso por aqui"
        descricao="Marque uma saída, uma vistoria ou uma visita do mecânico — e compartilhe com quem precisa saber."
        acao={podeCriar ? { href: "/agenda/novo", rotulo: "Marcar compromisso" } : undefined}
        className="mt-5"
      />
    )
  }
  const porDia = agruparPorDia(itens)
  return (
    <div className="mt-4 space-y-3">
      {[...porDia.entries()].map(([dia, doDia]) => (
        <div key={dia}>
          <p className={`rotulo mb-1 ${dia === hoje ? "text-accent-forte" : "text-dim"}`}>
            {rotuloDia(dia)}{dia === hoje ? " · hoje" : ""}
          </p>
          <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
            {doDia.map((i) => <LinhaAgenda key={i.chave} item={i} />)}
          </div>
        </div>
      ))}
    </div>
  )
}
