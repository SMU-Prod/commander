import { Farol } from "@/components/farol"
import type { StatusFarol } from "@/lib/domain/semaforo"

/**
 * ONDA 94 — O FAROL DO MOTOR PARA DE MENTIR VERDE.
 *
 * O mostrador já era honesto com o NÚMERO desde sempre (ver o comentário
 * abaixo: `null` vira "—", nunca "0,0 h"). O farol ao lado não era: `status`
 * era obrigatório, e quem chamava resolvia a ausência com `?? "ok"` — então
 * um motor SEM NENHUM item monitorado acendia verde, afirmando "em dia" sobre
 * um motor de que o app não sabe absolutamente nada.
 *
 * É o mesmo defeito que a onda 7 consertou na Início ("Tudo em dia" mentia
 * com manutenções recém-criadas) e que o passe de densidade acabou de
 * consertar no escudo do herói de `/barco`. Aqui ele estava um nível abaixo,
 * no mostrador de cada motor — o lugar onde o dono realmente olha.
 *
 * `null` agora é um estado de primeira classe e desenha o ANEL VAZIO que o
 * Casco e o Mapa da Embarcação (`FarolZona`) já usam para "sem dados": ponto
 * presente, contorno só, sem brilho. Presente na leitura, visivelmente fora
 * de jogo — que é a verdade.
 */
export function Horimetro({
  rotulo,
  horas,
  status,
  grande = false,
}: {
  rotulo: string
  horas: number | null
  /** `null` = não há item monitorado com informação suficiente. Nunca troque
   *  por `"ok"` em quem chama: é exatamente isso que o farol existe pra não
   *  dizer. */
  status: StatusFarol | null
  grande?: boolean
}) {
  // horas null (equipamento sem leitura) é bem diferente de 0,0 h (motor
  // zerado de verdade) — mostrar "0,0 h" pra quem nunca informou nada
  // destrói a confiança na primeira olhada.
  const texto = horas != null
    ? horas.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    : "—"
  return (
    <div className="rounded-[10px] border border-line bg-meter text-meter-texto px-3 py-2 font-mono-instr tabular-nums">
      <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-[.16em] text-meter-dim">
        {rotulo}{" "}
        {status ? (
          <Farol status={status} />
        ) : (
          <span
            aria-label="Sem dados de manutenção"
            className="inline-block size-2 shrink-0 rounded-full border border-meter-dim"
          />
        )}
      </div>
      <div className={grande ? "text-4xl" : "text-2xl"}>
        {texto} <small className="text-sm text-meter-dim">{horas != null ? "h" : "sem leitura"}</small>
      </div>
    </div>
  )
}
