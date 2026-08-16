import Link from "next/link"
import { redirect } from "next/navigation"
import { FarolOcorrencia } from "@/components/farol"
import { Icone } from "@/components/icone"
import { BarraFerramentas } from "@/components/ui/barra-ferramentas"
import { Chip, ChipLinha } from "@/components/ui/chip"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { carregarPainel } from "@/lib/consultas"
import { formatarCarimbo } from "@/lib/domain/datas"
import { ABAS_OCORRENCIA, ESTADOS_OCORRENCIA, ROTULO_ESTADO, type EstadoOcorrencia } from "@/lib/domain/ocorrencias"
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
      <h1 className="titulo-pagina">Ocorrências</h1>
      <p className="apoio mt-1 text-dim">Um problema apontado no Diário, ou registrado direto aqui — sempre ligado a um setor do barco.</p>

      {erro && <p className="mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 corpo">{erro}</p>}
      {ok && <p className="mt-3 rounded-lg border border-ok/40 bg-panel px-3 py-2 corpo">{ok}</p>}

      {/* ONDA 59 — a barra recebe só o filtro PRIMÁRIO (estado), ao lado da
          ação "Registrar ocorrência" — o slot `filtros` da barra é UMA linha
          (regra em barra-ferramentas.tsx). O setor é refinamento
          SECUNDÁRIO dentro do estado, então mora fora da barra, numa
          `ChipLinha` solta logo abaixo, com `nivel="secundario"` (contorno,
          sem preenchimento) — por isso não soma ao orçamento de dourados:
          só a ação "Registrar ocorrência" e o chip de estado ativo (nivel
          primário, preenchido) contam — 2 no total, dentro do limite. */}
      <BarraFerramentas
        className="mt-4"
        filtros={
          <>
            {ESTADO_FILTROS.map((f) => (
              <Chip key={f.valor} href={comFiltro({ estado: f.valor })} ativo={estado === f.valor}>
                {f.rotulo}
              </Chip>
            ))}
          </>
        }
        acao={{ href: "/barco/ocorrencias/nova", rotulo: "Registrar ocorrência" }}
      />
      <ChipLinha className="mt-2">
        <Chip href={comFiltro({ setor: "tudo" })} ativo={setor === "tudo"} nivel="secundario">
          Todos os setores
        </Chip>
        {ABAS_OCORRENCIA.map((aba) => (
          <Chip key={aba} href={comFiltro({ setor: aba })} ativo={setor === aba} nivel="secundario">
            {ROTULO_ABA[aba]}
          </Chip>
        ))}
      </ChipLinha>

      {ocorrencias.length === 0 && (
        <EstadoVazio
          icone="alerta"
          titulo="Nenhuma ocorrência por aqui"
          descricao="Toque em “Registrar ocorrência” pra abrir uma, ou aponte um problema num setor ao registrar uma saída no Diário."
          acao={{ href: "/barco/ocorrencias/nova", rotulo: "Registrar ocorrência" }}
          className="mt-6"
        />
      )}

      {/* Anuladas continuam na lista — "registros finalizados relevantes não
          são apagados silenciosamente" (PRD §7) — mas apagadas: título
          riscado e o cartão inteiro em meio-tom. Some do caminho sem sumir
          do histórico. */}
      <div className="mt-4 space-y-2">
        {ocorrencias.map((o) => {
          const anulada = o.estado === "anulada"
          return (
            <Link key={o.id} href={`/barco/ocorrencias/${o.id}`}
              className={`sombra-1 flex items-center gap-3 rounded-[14px] border border-line bg-panel p-3.5 ${anulada ? "opacity-60" : ""}`}>
              <FarolOcorrencia estado={o.estado} />
              <div className="min-w-0 flex-1">
                <p className={`titulo-card truncate ${anulada ? "line-through decoration-dim/60" : ""}`}>{o.titulo}</p>
                <p className="apoio mt-0.5 truncate text-dim">
                  {ROTULO_ABA[o.aba]} · {formatarCarimbo(o.created_at)}
                </p>
              </div>
              <span className="shrink-0 font-mono-instr text-xs tabular-nums text-dim">{ROTULO_ESTADO[o.estado]}</span>
              <Icone nome="chevron" className="size-4 shrink-0 text-dim" />
            </Link>
          )
        })}
      </div>
    </main>
  )
}
