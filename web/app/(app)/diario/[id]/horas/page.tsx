import Link from "next/link"
import { redirect } from "next/navigation"
import { Icone } from "@/components/icone"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { Campo } from "@/components/ui/campo"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { registrarVoltaAoMar } from "@/lib/acoes/registro"
import { carregarPainel } from "@/lib/consultas"
import { duracaoHoras, horasSugeridas, textoDuracao } from "@/lib/domain/bordo"
import { podeEditar } from "@/lib/domain/permissoes"
import { supabaseServer } from "@/lib/supabase/server"
import type { Evento } from "@/lib/db/types"

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
      <CabecalhoDetalhe voltarHref="/diario" voltarRotulo="Diário" />

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
        <EstadoVazio icone="motor" titulo="Nenhum motor cadastrado nesta embarcação ainda" className="mt-6" />
      ) : (
        <form action={registrarVoltaAoMar} className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {motores.map((m) => {
              const padrao = sugestao != null && m.horas_atuais != null ? m.horas_atuais + sugestao : undefined
              return (
                <Campo
                  key={m.id}
                  label={`Horas ${m.posicao ?? "Motor"}`}
                  id={`equipamento_${m.id}`}
                  name={`equipamento_${m.id}`}
                  inputMode="decimal"
                  defaultValue={padrao}
                  className="font-mono-instr tabular-nums"
                >
                  {m.horas_atuais != null && (
                    <p className="mt-1 font-mono-instr text-[11px] tabular-nums text-dim">
                      atual: {m.horas_atuais.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h
                    </p>
                  )}
                </Campo>
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
