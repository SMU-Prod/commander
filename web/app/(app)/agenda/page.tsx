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
  agruparPorPeriodo,
  camadaTemFonte,
  CAMADAS,
  diaCompacto,
  diasDaSemana,
  gradeDoMes,
  janelaDaVisualizacao,
  montarAgenda,
  NOMES_DIA_SEMANA,
  podeGerenciarEventos,
  podeVerAgenda,
  ROTULO_CAMADA,
  ROTULO_CAMADA_PILULA,
  ROTULO_VISUALIZACAO,
  rotuloDia,
  rotuloMes,
  rotuloSemana,
  somarDias,
  VISUALIZACOES,
  type Camada,
  type CamadaComFonte,
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
import { ALVO_ACAO, PILULA_ACAO, TOQUE } from "@/lib/ui/acoes"
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
  // ONDA 62 (canvas tela-1h) — a LISTA é a cara da Agenda: "o que está
  // marcado" se responde lendo de cima pra baixo, não caçando bolinha na
  // grade. Mês e Semana continuam a um toque; só o padrão mudou.
  const visualizacao: Visualizacao = (VISUALIZACOES as readonly string[]).includes(vBruto ?? "")
    ? (vBruto as Visualizacao)
    : "lista"
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
    if (vv !== "lista") p.set("v", vv)
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
      <h1 className="titulo-pagina">Agenda</h1>
      {/* A frase do canvas (tela-1h): o que mora aqui, em seis palavras. */}
      <p className="apoio mt-1 text-dim">Serviços, vencimentos e saídas planejadas.</p>

      {erro && <p className="corpo mt-3 rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      {/* A barra do canvas (tela-1h): filtros à esquerda, a ação de criar à
          direita, uma altura só (44px). Os chips são as camadas da Agenda
          Detalhada (PRD §8) — só as que têm fonte de dado viram chip:
          prometer "Financeiro" antes de o módulo existir seria porta pra
          sala vazia. Sem contagem nos chips, de propósito: contar camada
          desligada exigiria consultar tudo sempre, e a página só consulta a
          camada que está ligada. */}
      <div className="mt-4 flex items-center gap-2">
        <ChipLinha className="min-w-0 flex-1">
          <Chip href={link({ c: "" })} ativo={!detalhada}>
            Todas
          </Chip>
          {CAMADAS.filter(camadaTemFonte).map((c) => (
            <Chip key={c} href={alternarCamada(c)} ativo={camadas.includes(c)} nivel="secundario">
              {ROTULO_CAMADA[c]}
            </Chip>
          ))}
        </ChipLinha>
        {podeCriar && (
          <Link
            href="/agenda/novo"
            className="mb-1 flex h-11 shrink-0 items-center gap-1 rounded-[var(--raio-pilula)] bg-accent px-4 text-sm font-semibold text-acao-texto"
          >
            <Icone nome="mais" className="size-4" /> Novo
          </Link>
        )}
      </div>
      {!detalhada && (
        <p className="apoio mt-2 text-dim">
          Toque em uma camada para trazer manutenções, documentos, segurança e tarefas do barco
          para dentro da agenda.
        </p>
      )}

      {/* Lista | Semana | Mês — PRD §8; a Lista virou o padrão (canvas). */}
      <div className="mt-3 flex gap-1.5">
        {([...VISUALIZACOES].reverse() as Visualizacao[]).map((vv) => (
          <Link
            key={vv}
            href={link({ v: vv })}
            aria-current={visualizacao === vv ? "page" : undefined}
            /* Onda 56 — mesmas medidas do `Chip` (h-11, sans, px-4). Este
               seletor não usa o componente porque as três opções dividem a
               largura em partes iguais (`flex-1`), e não rolam numa fila; o
               que importa é que ele deixe de ser a quarta altura de pílula
               desta mesma tela. Contorno no ativo, não dourado cheio: os
               dois dourados de conteúdo da tela já têm dono (chip "Todas" e
               "+ Novo"). */
            className={`flex h-11 flex-1 items-center justify-center rounded-[var(--raio-pilula)] border text-sm ${
              visualizacao === vv ? "border-accent-forte font-semibold text-accent-forte" : "border-line bg-panel text-dim"
            }`}
          >
            {ROTULO_VISUALIZACAO[vv]}
          </Link>
        ))}
      </div>

      {/* `size-11` e não `size-9`: os dois botões que andam o calendário
          tinham 36px — 8px abaixo da régua de toque (DESIGN §5) — e são os
          dois alvos mais repetidos desta tela. E "Voltar para hoje" era
          texto dourado de 18px espremido sob o título: virou pílula, que é
          o que o app inteiro usa pra dizer "aqui se toca". */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <Link href={link({ d: anterior })} aria-label="Período anterior"
          className={`flex size-11 shrink-0 items-center justify-center rounded-[var(--raio-pilula)] border border-line bg-panel text-dim ${TOQUE}`}>
          <Icone nome="voltar" className="size-4" />
        </Link>
        <div className="min-w-0 text-center">
          <p className="titulo-card truncate">{tituloPeriodo}</p>
          {ancora.slice(0, 7) !== hoje.slice(0, 7) && (
            <Link href={link({ d: hoje })} className={ALVO_ACAO}>
              <span className={PILULA_ACAO}>Voltar para hoje</span>
            </Link>
          )}
        </div>
        <Link href={link({ d: proximo })} aria-label="Próximo período"
          className={`flex size-11 shrink-0 items-center justify-center rounded-[var(--raio-pilula)] border border-line bg-panel text-dim ${TOQUE}`}>
          <Icone nome="chevron" className="size-4" />
        </Link>
      </div>

      {visualizacao === "mes" && (
        <VistaMes mesISO={ancora.slice(0, 7)} diaSelecionado={ancora} hoje={hoje} porDia={porDia} link={link} podeCriar={podeCriar} />
      )}
      {visualizacao === "semana" && <VistaSemana ancora={ancora} hoje={hoje} porDia={porDia} />}
      {visualizacao === "lista" && <VistaLista itens={itens} hoje={hoje} podeCriar={podeCriar} />}

      {/* "Histórico de coisas já realizadas não polui a Agenda normal" (PRD
          §8) — mas continua alcançável, nunca apagado. */}
      <div className="mt-6 text-center">
        <Link href={link({ feitos: incluirConcluidos ? "" : "1" })} className={ALVO_ACAO}>
          <span className={PILULA_ACAO}>
            {incluirConcluidos ? "Esconder o que já foi feito" : "Mostrar o que já foi feito"}
          </span>
        </Link>
      </div>
    </main>
  )
}

/** Bolinha do dia na grade: farol quando vem de uma camada, ponto de acento
 *  quando é compromisso de gente. */
function Marcador({ item }: { item: ItemAgenda }) {
  if (item.status) return <Farol status={item.status} />
  return <span className="inline-block size-2 shrink-0 rounded-[var(--raio-pilula)] bg-accent-forte" />
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
  mesISO, diaSelecionado, hoje, porDia, link, podeCriar,
}: {
  mesISO: string
  diaSelecionado: string
  hoje: string
  porDia: Map<string, ItemAgenda[]>
  link: (novo: { d: string }) => string
  podeCriar: boolean
}) {
  const semanas = gradeDoMes(mesISO)
  const doDia = porDia.get(diaSelecionado) ?? []
  return (
    <>
      <div className="sombra-1 mt-4 rounded-[var(--raio-cartao)] border border-line bg-panel p-2">
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
                  className={`flex min-h-11 flex-col items-center gap-1 rounded-[var(--raio-controle)] py-1.5 ${
                    selecionado ? "bg-accent/15 ring-1 ring-accent" : ""
                  }`}
                >
                  {/* 46px era um número escolhido no olho; a régua da casa é
                      44 e a célula continua acima dela. O dia é DADO —
                      `.valor` traz o tabular e a cor de dado (onda 87). */}
                  <span className={`tabular-nums valor ${
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
      <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
        {/* DESIGN §6 regra 4 — o vazio explica o valor da área e oferece a
            ação. Só o título era uma constatação; agora ele diz o que cabe
            num dia da Agenda e leva a marcar, que é o que a pessoa veio
            fazer ao tocar num dia vazio da grade. */}
        {doDia.length === 0 ? (
          <EstadoVazio
            variant="linha"
            icone="calendario"
            titulo="Nada marcado neste dia"
            descricao="Saída, vistoria, visita do mecânico — e, com as camadas ligadas, os vencimentos do barco caem aqui sozinhos."
            acao={podeCriar ? { href: "/agenda/novo", rotulo: "Marcar compromisso" } : undefined}
          />
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
            <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
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

/** Cores da pílula de origem — verde/âmbar/vermelho é ESTADO (DESIGN §5):
 *  a pílula escreve de onde o item veio e veste a cor do farol que a área de
 *  origem já calculou. Sem status (não deveria acontecer numa derivada), fica
 *  neutra em vez de inventar urgência. */
const ESTILO_PILULA: Record<string, string> = {
  ok: "border-ok/40 text-ok",
  atencao: "border-warn/40 text-warn",
  vencido: "border-crit/40 text-crit",
}

/**
 * A linha da Lista (canvas tela-1h): a data em mono à esquerda substitui o
 * cabeçalho de dia — menos linha, mesma leitura. Derivada ganha pílula de
 * origem à direita; compromisso leva a hora junto do detalhe, como no canvas
 * ("Náutica Verolme · 09:00").
 */
function LinhaAgendaData({ item }: { item: ItemAgenda }) {
  const { dia, semana } = diaCompacto(item.data)
  const derivada = item.origem !== "compromisso" && camadaTemFonte(item.origem)
  const detalhe = item.origem === "compromisso"
    ? [item.detalhe, item.hora].filter(Boolean).join(" · ")
    : item.detalhe ?? ""
  const conteudo = (
    <>
      {/* `.valor-forte` (20px) e `.rotulo` (11px) no lugar de `text-base` e
          `text-xs tracking-[.12em]`: 17px não é degrau de escala nenhuma,
          e o rótulo era uma cópia à mão do `.rotulo` que derivou no tracking
          (achado 5.12 da auditoria). Cabe nos 42px: dois dígitos de mono a
          20px medem ~24px. */}
      <span className="w-[42px] shrink-0 text-center">
        <span className="block tabular-nums valor-forte font-semibold leading-none">{dia}</span>
        <span className="rotulo mt-1 block leading-none text-dim">{semana}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className={`titulo-card block truncate ${item.concluido ? "text-dim line-through" : ""}`}>
          {item.titulo}
          {item.compartilhado && (
            <Icone nome="pessoas" className="ml-1.5 inline size-3.5 align-[-2px] text-dim" />
          )}
        </span>
        {detalhe && <span className="apoio mt-0.5 block truncate text-dim">{detalhe}</span>}
      </span>
      {derivada && (
        <span
          className={`rotulo shrink-0 rounded-[var(--raio-pilula)] border px-2 py-0.5 font-bold ${
            (item.status && ESTILO_PILULA[item.status]) || "border-line text-dim-chip"
          }`}
        >
          {ROTULO_CAMADA_PILULA[item.origem as CamadaComFonte]}
        </span>
      )}
    </>
  )
  const cls = "flex min-h-11 items-center gap-3 border-b border-line py-3 last:border-0"
  return item.href ? (
    <Link href={item.href} className={cls}>{conteudo}</Link>
  ) : (
    <div className={cls}>{conteudo}</div>
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
        className="mt-6"
      />
    )
  }
  // "Esta semana", depois o nome do mês (canvas tela-1h) — a régua é
  // `agruparPorPeriodo`, testada em lib/domain/agenda.test.ts.
  const secoes = agruparPorPeriodo(itens, hoje)
  return (
    <div className="mt-2">
      {secoes.map((secao) => (
        <div key={`${secao.rotulo}:${secao.itens[0].chave}`}>
          <p className="rotulo mb-2 mt-6 text-dim">{secao.rotulo}</p>
          <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-3">
            {secao.itens.map((i) => <LinhaAgendaData key={i.chave} item={i} />)}
          </div>
        </div>
      ))}
    </div>
  )
}
