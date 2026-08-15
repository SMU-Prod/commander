"use client"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { Campo } from "@/components/ui/campo"
import { registrarVoltaAoMar } from "@/lib/acoes/registro"
import { mostrarRegistroRapido, SLOT_ACAO_FLUTUANTE } from "@/lib/ui/superficies"

export function RegistroRapido({
  motores,
}: {
  motores: { id: string; rotulo: string; horas: number | null }[]
}) {
  const [aberto, setAberto] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const pathname = usePathname()
  // ONDA 54 — onde este botão pode flutuar é uma regra só, em
  // `lib/ui/superficies.ts`, com teste. Ela guarda a exceção antiga do mapa
  // (`/navegar`, onde o FAB cobria os controles de navegação) e acrescenta
  // a desta onda: nada de FAB em tela de formulário, onde ele tapava campo
  // de verdade — o "Horas no último serviço" de `/barco/itens/novo` era o
  // caso confirmado em imagem. `MolduraApp` usa a MESMA função para decidir
  // a folga inferior do conteúdo; se as duas divergirem, volta a sobrar
  // espaço morto ou a faltar folga.
  if (!mostrarRegistroRapido(pathname)) return null

  async function enviar(formData: FormData) {
    if (enviando) return
    setEnviando(true)
    setAberto(false)
    try {
      await registrarVoltaAoMar(formData)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        className={`no-imprimir ${SLOT_ACAO_FLUTUANTE}`}
      >
        + Registrar
      </button>
      {aberto && (
        <div
          className="no-imprimir fixed inset-0 z-30 flex items-end bg-black/60"
          onClick={(e) => e.target === e.currentTarget && setAberto(false)}
        >
          <div className="w-full rounded-t-[20px] border-t border-line bg-panel px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-5">
            <h2 className="text-lg font-semibold">Registrar volta ao mar</h2>
            <p className="mb-4 text-sm text-dim">30 segundos — é isso que mantém os alertas vivos.</p>
            <form action={enviar} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {motores.map((m) => (
                  <Campo
                    key={m.id}
                    label={`Horas ${m.rotulo}`}
                    id={`equipamento_${m.id}`}
                    name={`equipamento_${m.id}`}
                    inputMode="decimal"
                    defaultValue={m.horas ?? undefined}
                    className="font-mono-instr tabular-nums"
                  />
                ))}
              </div>
              <Campo label="Combustível abastecido (L) — opcional" id="litros" name="litros" inputMode="numeric" className="font-mono-instr tabular-nums" />
              <Campo label="Observação — opcional" id="obs" name="obs" placeholder="Ex.: saída às Cagarras" className="font-mono-instr tabular-nums" />
              <button disabled={enviando} className="w-full rounded-xl bg-accent py-3.5 font-semibold text-acao-texto disabled:opacity-60">
                Registrar no diário
              </button>
              <button type="button" onClick={() => setAberto(false)} className="w-full py-2 text-sm text-dim">
                Cancelar
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
