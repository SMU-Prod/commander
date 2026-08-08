"use client"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { registrarVoltaAoMar } from "@/lib/acoes/registro"

const campo = "w-full rounded-[10px] border border-line bg-campo px-3 py-3 font-mono-instr text-base tabular-nums"
const rotulo = "mb-1.5 block font-mono-instr text-[11px] uppercase tracking-[.14em] text-dim"

export function RegistroRapido({
  motores,
}: {
  motores: { id: string; rotulo: string; horas: number | null }[]
}) {
  const [aberto, setAberto] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const pathname = usePathname()
  // no mapa o FAB cobria os controles de navegacao — la o registro de horas
  // ja tem casa propria (a sugestao pos-trilha do Livro de Bordo)
  if (pathname === "/navegar") return null

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
        className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-20 rounded-full bg-accent px-5 py-3.5 text-sm font-semibold text-acao-texto shadow-lg shadow-accent/30"
      >
        + Registrar
      </button>
      {aberto && (
        <div
          className="fixed inset-0 z-30 flex items-end bg-black/60"
          onClick={(e) => e.target === e.currentTarget && setAberto(false)}
        >
          <div className="w-full rounded-t-[20px] border-t border-line bg-panel px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-5">
            <h2 className="text-lg font-semibold">Registrar volta ao mar</h2>
            <p className="mb-4 text-sm text-dim">30 segundos — é isso que mantém os alertas vivos.</p>
            <form action={enviar} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {motores.map((m) => (
                  <div key={m.id}>
                    <label className={rotulo} htmlFor={`equipamento_${m.id}`}>Horas {m.rotulo}</label>
                    <input
                      id={`equipamento_${m.id}`}
                      name={`equipamento_${m.id}`}
                      inputMode="decimal"
                      defaultValue={m.horas ?? undefined}
                      className={campo}
                    />
                  </div>
                ))}
              </div>
              <div>
                <label className={rotulo} htmlFor="litros">Combustível abastecido (L) — opcional</label>
                <input id="litros" name="litros" inputMode="numeric" className={campo} />
              </div>
              <div>
                <label className={rotulo} htmlFor="obs">Observação — opcional</label>
                <input id="obs" name="obs" placeholder="Ex.: saída às Cagarras" className={campo} />
              </div>
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
