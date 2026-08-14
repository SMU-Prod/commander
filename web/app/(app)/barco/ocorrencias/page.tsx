import Link from "next/link"
import { redirect } from "next/navigation"
import { Farol } from "@/components/farol"
import { Icone } from "@/components/icone"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { carregarPainel } from "@/lib/consultas"
import { formatarCarimbo } from "@/lib/domain/datas"
import { ABAS_OCORRENCIA, ESTADOS_OCORRENCIA, faroDoEstado, ROTULO_ESTADO, type EstadoOcorrencia } from "@/lib/domain/ocorrencias"
import { ROTULO_ABA, type Aba } from "@/lib/domain/permissoes"
import { supabaseServer } from "@/lib/supabase/server"
import type { Ocorrencia } from "@/lib/db/types"

const ESTADO_FILTROS: { valor: EstadoOcorrencia | "tudo"; rotulo: string }[] = [
  { valor: "tudo", rotulo: "Tudo" },
  ...ESTADOS_OCORRENCIA.map((e) => ({ valor: e, rotulo: ROTULO_ESTADO[e] })),
]

export default async function OcorrenciasPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; setor?: string; erro?: string; ok?: string }>
}) {
  const { estado: estadoBruto, setor: setorBruto, erro, ok } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")

  const estado = (ESTADOS_OCORRENCIA as readonly string[]).includes(estadoBruto ?? "")
    ? (estadoBruto as EstadoOcorrencia)
    : "tudo"
  const setor = (ABAS_OCORRENCIA as readonly string[]).includes(setorBruto ?? "") ? (setorBruto as Aba) : "tudo"

  const supabase = await supabaseServer()
  let query = supabase.from("ocorrencias").select("*").eq("embarcacao_id", painel.embarcacao.id)
  if (estado !== "tudo") query = query.eq("estado", estado)
  if (setor !== "tudo") query = query.eq("aba", setor)
  const { data, error } = await query.order("created_at", { ascending: false })
  if (error) throw new Error("Não foi possível carregar as ocorrências. Recarregue a página.")
  const ocorrencias = (data ?? []) as Ocorrencia[]

  const comFiltro = (novo: Partial<{ estado: string; setor: string }>) => {
    const params = new URLSearchParams()
    const e = novo.estado ?? estado
    const s = novo.setor ?? setor
    if (e !== "tudo") params.set("estado", e)
    if (s !== "tudo") params.set("setor", s)
    const qs = params.toString()
    return qs ? `/barco/ocorrencias?${qs}` : "/barco/ocorrencias"
  }

  return (
    <main>
      <div className="flex items-baseline justify-between">
        <h1 className="titulo-pagina">Ocorrências</h1>
        <Link href="/barco/ocorrencias/nova" className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-acao-texto">
          <span className="inline-flex items-center gap-1">
            <Icone nome="mais" className="size-4" /> Registrar
          </span>
        </Link>
      </div>
      <p className="apoio mt-1 text-dim">Um problema apontado no Diário, ou registrado direto aqui — sempre ligado a um setor do barco.</p>

      {erro && <p className="mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 corpo">{erro}</p>}
      {ok && <p className="mt-3 rounded-lg border border-ok/40 bg-panel px-3 py-2 corpo">{ok}</p>}

      <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {ESTADO_FILTROS.map((f) => (
          <Link
            key={f.valor}
            href={comFiltro({ estado: f.valor })}
            className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 font-mono-instr text-[11.5px] tracking-wide ${
              estado === f.valor ? "border-accent bg-accent font-semibold text-acao-texto" : "border-line bg-panel text-dim"
            }`}
          >
            {f.rotulo}
          </Link>
        ))}
      </div>
      <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        <Link
          href={comFiltro({ setor: "tudo" })}
          className={`whitespace-nowrap rounded-full border px-3 py-1 font-mono-instr text-[11px] tracking-wide ${
            setor === "tudo" ? "border-accent-forte text-accent-forte" : "border-line text-dim"
          }`}
        >
          Todos os setores
        </Link>
        {ABAS_OCORRENCIA.map((aba) => (
          <Link
            key={aba}
            href={comFiltro({ setor: aba })}
            className={`whitespace-nowrap rounded-full border px-3 py-1 font-mono-instr text-[11px] tracking-wide ${
              setor === aba ? "border-accent-forte text-accent-forte" : "border-line text-dim"
            }`}
          >
            {ROTULO_ABA[aba]}
          </Link>
        ))}
      </div>

      {ocorrencias.length === 0 && (
        <EstadoVazio
          icone="alerta"
          titulo="Nenhuma ocorrência por aqui"
          descricao="Toque em “+ Registrar” pra abrir uma, ou aponte um problema num setor ao registrar uma saída no Diário."
          acao={{ href: "/barco/ocorrencias/nova", rotulo: "Registrar" }}
          className="mt-6"
        />
      )}

      <div className="mt-4 space-y-2">
        {ocorrencias.map((o) => (
          <Link key={o.id} href={`/barco/ocorrencias/${o.id}`}
            className="sombra-1 flex items-center gap-3 rounded-[14px] border border-line bg-panel p-3.5">
            <Farol status={faroDoEstado(o.estado)} />
            <div className="min-w-0 flex-1">
              <p className="titulo-card truncate">{o.titulo}</p>
              <p className="apoio mt-0.5 truncate text-dim">
                {ROTULO_ABA[o.aba]} · {formatarCarimbo(o.created_at)}
              </p>
            </div>
            <span className="shrink-0 font-mono-instr text-xs tabular-nums text-dim">{ROTULO_ESTADO[o.estado]}</span>
            <Icone nome="chevron" className="size-4 shrink-0 text-dim" />
          </Link>
        ))}
      </div>
    </main>
  )
}
