import Link from "next/link"
import { redirect } from "next/navigation"
import { Icone } from "@/components/icone"
import { registrarVoltaAoMar } from "@/lib/acoes/registro"
import { carregarPainel } from "@/lib/consultas"
import { duracaoHoras, horasSugeridas, textoDuracao } from "@/lib/domain/bordo"
import { podeEditar } from "@/lib/domain/permissoes"
import { supabaseServer } from "@/lib/supabase/server"
import type { Evento } from "@/lib/db/types"

const campo = "w-full rounded-[10px] border border-line bg-campo px-3 py-3 font-mono-instr text-base tabular-nums"
const rotulo = "mb-1.5 block font-mono-instr text-[11px] uppercase tracking-[.14em] text-dim"

function erroHoras(msg: string): never {
  redirect(`/diario?erro=${encodeURIComponent(msg)}`)
}

/** A sinergia do Livro de Bordo: depois de registrar uma saida, esta tela
 *  curta pergunta se vale atualizar o horimetro — com o numero ja pronto.
 *  "Agora não" precisa ser tao facil quanto "Atualizar": nunca vira armadilha. */
export default async function HorasDaSaidaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (!podeEditar(painel.permissoes, "motores")) {
    erroHoras("Você não tem permissão para atualizar as horas dos motores.")
  }

  const supabase = await supabaseServer()
  const { data: evento } = await supabase.from("eventos").select("*").eq("id", id).maybeSingle()
  const e = evento as Evento | null
  // Evento inexistente ou de outra embarcacao: nunca revela nada, so volta com erro.
  if (!e || e.embarcacao_id !== painel.embarcacao.id) {
    erroHoras("Evento não encontrado.")
  }

  const duracao = duracaoHoras(e!.hora_saida, e!.hora_retorno)
  const sugestao = horasSugeridas(duracao)
  const motores = painel.equipamentos.filter((eq) => eq.tipo === "motor")

  return (
    <main>
      <Link href="/diario" className="inline-flex items-center gap-1 rotulo text-accent-forte">
        <Icone nome="voltar" className="size-4" /> Diário
      </Link>

      <div className="mt-5 flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent/12 text-accent-forte">
          <Icone nome="relogio" className="size-5" />
        </span>
        <div className="min-w-0">
          <h1 className="titulo-pagina">
            {duracao != null ? `Essa saída durou ${textoDuracao(duracao)}.` : "Saída registrada."}
          </h1>
          <p className="mt-0.5 text-sm text-dim">Atualizar as horas dos motores?</p>
        </div>
      </div>

      {motores.length === 0 ? (
        <div className="mt-6 rounded-[14px] border border-line bg-panel p-4 text-sm text-dim">
          Nenhum motor cadastrado nesta embarcação ainda.
        </div>
      ) : (
        <form action={registrarVoltaAoMar} className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {motores.map((m) => {
              const padrao = sugestao != null && m.horas_atuais != null ? m.horas_atuais + sugestao : undefined
              return (
                <div key={m.id}>
                  <label className={rotulo} htmlFor={`equipamento_${m.id}`}>
                    Horas {m.posicao ?? "Motor"}
                  </label>
                  <input
                    id={`equipamento_${m.id}`}
                    name={`equipamento_${m.id}`}
                    inputMode="decimal"
                    defaultValue={padrao}
                    className={campo}
                  />
                  {m.horas_atuais != null && (
                    <p className="mt-1 font-mono-instr text-[11px] tabular-nums text-dim">
                      atual: {m.horas_atuais.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h
                    </p>
                  )}
                </div>
              )
            })}
          </div>
          <button className="w-full rounded-xl bg-accent py-3.5 font-semibold text-acao-texto">
            Atualizar
          </button>
        </form>
      )}

      <Link href="/diario" className="mt-3 flex h-11 items-center justify-center text-sm text-dim">
        Agora não
      </Link>
    </main>
  )
}
