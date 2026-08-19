import Link from "next/link"
import { redirect } from "next/navigation"
import { FarolOcorrencia } from "@/components/farol"
import { Icone } from "@/components/icone"
import { Chip, ChipLinha } from "@/components/ui/chip"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { carregarPainel } from "@/lib/consultas"
import { agruparPorMes, eventoNoFiltro, TIPO_ROTULO, type FiltroDiario } from "@/lib/domain/diario"
import { ESTADOS_OCORRENCIA, ROTULO_ESTADO, type EstadoOcorrencia } from "@/lib/domain/ocorrencias"
import { podeVer } from "@/lib/domain/permissoes"
import { supabaseServer } from "@/lib/supabase/server"
import type { Evento, Ocorrencia } from "@/lib/db/types"

const FILTROS_SETOR: { valor: FiltroDiario; rotulo: string }[] = [
  { valor: "tudo", rotulo: "Tudo" }, { valor: "motores", rotulo: "Motores" },
  { valor: "eletrica", rotulo: "Elétrica" }, { valor: "casco", rotulo: "Casco" },
  { valor: "hidraulica", rotulo: "Hidráulica" }, { valor: "seguranca", rotulo: "Segurança" },
  { valor: "equipamentos", rotulo: "Equipamentos" }, { valor: "docs", rotulo: "Docs" },
]

const FILTROS_STATUS: { valor: EstadoOcorrencia | "tudo"; rotulo: string }[] = [
  { valor: "tudo", rotulo: "Tudo" },
  ...ESTADOS_OCORRENCIA.map((e) => ({ valor: e, rotulo: ROTULO_ESTADO[e] })),
]

type Entrada =
  | { data: string; tipo: "evento"; evento: Evento; grupo: string }
  | { data: string; tipo: "ocorrencia"; ocorrencia: Ocorrencia }

export default async function HistoricoPage({
  searchParams,
}: {
  searchParams: Promise<{ setor?: string; status?: string }>
}) {
  const { setor: setorBruto, status: statusBruto } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (!podeVer(painel.permissoes, "historico")) {
    redirect(`/hoje?erro=${encodeURIComponent("Seu acesso não inclui o histórico.")}`)
  }

  const setor = (FILTROS_SETOR.some((f) => f.valor === setorBruto) ? setorBruto : "tudo") as FiltroDiario
  const status = (ESTADOS_OCORRENCIA as readonly string[]).includes(statusBruto ?? "")
    ? (statusBruto as EstadoOcorrencia)
    : "tudo"

  const supabase = await supabaseServer()
  const [{ data: eventosBrutos, error: erroEventos }, { data: ocorrenciasBrutas, error: erroOcorrencias }] = await Promise.all([
    supabase.from("eventos")
      .select("id, embarcacao_id, equipamento_id, categoria, tipo, data, descricao, custo_centavos")
      .eq("embarcacao_id", painel.embarcacao.id)
      .order("data", { ascending: false }).limit(300),
    supabase.from("ocorrencias").select("*").eq("embarcacao_id", painel.embarcacao.id).order("created_at", { ascending: false }),
  ])
  if (erroEventos || erroOcorrencias) throw new Error("Não foi possível carregar o histórico. Recarregue a página.")

  const porId = new Map(painel.equipamentos.map((e) => [e.id, e]))

  // Filtro de status só existe pra ocorrências (eventos não têm estado) —
  // escolher um status específico foca só nelas, escondendo os eventos do
  // diário/manutenção (PRD §25: "filtros poderão incluir... status").
  const eventosFiltrados = status === "tudo"
    ? ((eventosBrutos ?? []) as Evento[]).filter((e) =>
        eventoNoFiltro(
          {
            tipo: e.tipo, categoria: e.categoria, custoCentavos: e.custo_centavos,
            tipoEquipamento: e.equipamento_id ? porId.get(e.equipamento_id)?.tipo ?? null : null,
          },
          setor,
        ),
      )
    : []

  const setorParaAba: Partial<Record<FiltroDiario, string>> = {
    motores: "motores", eletrica: "eletrica", casco: "casco", hidraulica: "hidraulica",
    seguranca: "seguranca", equipamentos: "equipamentos", docs: "documentos",
  }
  const ocorrenciasFiltradas = ((ocorrenciasBrutas ?? []) as Ocorrencia[]).filter((o) => {
    if (status !== "tudo" && o.estado !== status) return false
    if (setor !== "tudo" && o.aba !== setorParaAba[setor]) return false
    return true
  })

  const entradas: Entrada[] = [
    ...eventosFiltrados.map((evento): Entrada => ({ data: evento.data, tipo: "evento", evento, grupo: TIPO_ROTULO[evento.tipo] ?? evento.tipo })),
    ...ocorrenciasFiltradas.map((ocorrencia): Entrada => ({ data: ocorrencia.created_at.slice(0, 10), tipo: "ocorrencia", ocorrencia })),
  ].sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0))

  const grupos = agruparPorMes(entradas)

  return (
    <main>
      <h1 className="titulo-pagina">Histórico</h1>
      <p className="apoio mt-1 text-dim">Tudo que aconteceu no barco — diário, manutenções e ocorrências, num lugar só.</p>

      <ChipLinha className="mt-4">
        {FILTROS_SETOR.map((f) => (
          <Chip
            key={f.valor}
            ativo={setor === f.valor}
            href={f.valor === "tudo" && status === "tudo" ? "/barco/historico" : `/barco/historico?setor=${f.valor}${status !== "tudo" ? `&status=${status}` : ""}`}
          >
            {f.rotulo}
          </Chip>
        ))}
      </ChipLinha>
      <ChipLinha className="mt-2">
        {FILTROS_STATUS.map((f) => (
          <Chip
            key={f.valor}
            nivel="secundario"
            ativo={status === f.valor}
            href={f.valor === "tudo" && setor === "tudo" ? "/barco/historico" : `/barco/historico?status=${f.valor}${setor !== "tudo" ? `&setor=${setor}` : ""}`}
          >
            {f.rotulo}
          </Chip>
        ))}
      </ChipLinha>

      {grupos.length === 0 && (
        <EstadoVazio
          icone="calendario"
          titulo="Nada por aqui ainda com esse filtro"
          descricao="Registre no Diário ou abra uma ocorrência — tudo aparece aqui, agrupado por mês."
          className="mt-6"
        />
      )}

      {grupos.map((g) => (
        <section key={g.rotulo}>
          <SecaoPagina>{g.rotulo}</SecaoPagina>
          <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
            {g.eventos.map((entrada) =>
              entrada.tipo === "ocorrencia" ? (
                <Link
                  key={`o-${entrada.ocorrencia.id}`}
                  href={`/barco/ocorrencias/${entrada.ocorrencia.id}`}
                  className="flex items-center gap-3 border-b border-line py-3 last:border-0"
                >
                  {/* Anulada continua na linha do tempo — o §7 é explícito
                      que registro finalizado relevante não some — só riscada,
                      pra ficar claro de relance que não vale mais. */}
                  <FarolOcorrencia estado={entrada.ocorrencia.estado} />
                  <div className="min-w-0 flex-1">
                    <p className={`titulo-card truncate ${entrada.ocorrencia.estado === "anulada" ? "text-dim line-through decoration-dim/60" : ""}`}>
                      {entrada.ocorrencia.titulo}
                    </p>
                    <p className="apoio mt-0.5 text-dim">Ocorrência · {ROTULO_ESTADO[entrada.ocorrencia.estado]}</p>
                  </div>
                  <Icone nome="chevron" className="size-4 shrink-0 text-dim" />
                </Link>
              ) : (
                <div key={`e-${entrada.evento.id}`} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
                  {/* Onda 87 — o mês abreviado sob o dia é legenda de valor:
                      `rotulo-dado`, que já traz o 11px e uma entrelinha
                      própria (1,4). O `leading-tight` saiu junto porque a
                      classe vem depois na cascata e o venceria de qualquer
                      jeito — deixá-lo seria uma linha que não faz nada. A
                      altura da linha continua a mesma: quem a define é a
                      coluna do meio (título + apoio), não esta. */}
                  <div className="w-11 shrink-0 text-center font-mono-instr rotulo-dado tabular-nums text-dim">
                    <span className="block text-base text-texto">{entrada.evento.data.slice(8, 10)}</span>
                    {new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" })
                      .format(new Date(`${entrada.evento.data}T00:00:00Z`)).replace(".", "")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="titulo-card">{TIPO_ROTULO[entrada.evento.tipo] ?? entrada.evento.tipo}</p>
                    {entrada.evento.descricao && <p className="apoio mt-0.5 truncate text-dim">{entrada.evento.descricao}</p>}
                  </div>
                </div>
              ),
            )}
          </div>
        </section>
      ))}
    </main>
  )
}
