import Link from "next/link"
import { redirect } from "next/navigation"
import { Icone } from "@/components/icone"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { Campo } from "@/components/ui/campo"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { registrarVoltaAoMar } from "@/lib/acoes/registro"
import { carregarPainel } from "@/lib/consultas"
import { duracaoHoras, textoDuracao } from "@/lib/domain/bordo"
import { podeEditar } from "@/lib/domain/permissoes"
import { supabaseServer } from "@/lib/supabase/server"
import type { Evento } from "@/lib/db/types"

function erroHoras(msg: string): never {
  redirect(`/diario?erro=${encodeURIComponent(msg)}`)
}

/**
 * A sinergia do Livro de Bordo: depois de registrar uma saida, esta tela
 * curta pergunta se vale atualizar o horimetro. "Agora não" precisa ser tao
 * facil quanto "Atualizar": nunca vira armadilha.
 *
 * ONDA 53 — O CAMPO NAO VEM MAIS SOMADO. Ate aqui o `defaultValue` era
 * `horas_atuais + horasSugeridas(duracao)`, e isso violava tres linhas do
 * PRD de uma vez: §6 ("Nunca inferir ou somar horas do motor pela duracao do
 * passeio"), §6 de novo ("usuario digita manualmente os horimetros e
 * confirma") e o criterio de aceite do §27.2 ("Diario nunca altera horimetro
 * sem confirmacao e entrada manual").
 *
 * A diferenca nao e teorica: motor de barco quase nunca gira o tempo todo do
 * passeio (fundeio, almoco, banho), entao a soma erra pra mais — e quem
 * tocasse "Atualizar" sem reparar gravava um horimetro FALSO, que depois
 * antecipa troca de oleo e distorce a Saude. Agora o campo chega VAZIO e a
 * duracao continua na tela como informacao (o titulo diz "essa saida durou
 * X"), pra pessoa fazer a conta que so ela pode fazer: ler o painel.
 */
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
          <p className="apoio rounded-lg border border-line bg-panel px-3 py-2 text-dim">
            Leia o horímetro no painel e digite o número que está lá. O Commander não calcula essas horas
            pela duração da saída — motor parado no fundeio não roda horímetro.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {motores.map((m) => (
              <Campo
                key={m.id}
                label={`Horas ${m.posicao ?? "Motor"}`}
                id={`equipamento_${m.id}`}
                name={`equipamento_${m.id}`}
                inputMode="decimal"
                placeholder={
                  m.horas_atuais != null
                    ? m.horas_atuais.toLocaleString("pt-BR", { maximumFractionDigits: 1 })
                    : undefined
                }
                className="font-mono-instr tabular-nums"
              >
                {m.horas_atuais != null && (
                  <p className="mt-1 font-mono-instr rotulo-dado tabular-nums text-dim">
                    atual: {m.horas_atuais.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h
                  </p>
                )}
              </Campo>
            ))}
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
