import { Icone } from "@/components/icone"
import { rot } from "@/lib/ui/form"

/**
 * As estrelas do §14 (1 a 5), em duas formas: leitura e escolha.
 *
 * Nada aqui é client component: a escolha é um grupo de `radio` de verdade,
 * então funciona com o JavaScript ainda carregando, é navegável por teclado e
 * o leitor de tela anuncia "1 estrela ... 5 estrelas" sem `aria` inventado.
 */

export function Estrelas({ nota, className = "" }: { nota: number; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-0.5 ${className}`}
      aria-label={`${nota} de 5 estrelas`}
      title={`${nota} de 5`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Icone
          key={i}
          nome="estrela"
          className={`size-4 ${i <= nota ? "text-accent-forte" : "text-dim opacity-30"}`}
        />
      ))}
    </span>
  )
}

export function SeletorNota({ defaultValue }: { defaultValue?: number }) {
  return (
    <fieldset>
      <legend className={rot}>Sua nota</legend>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="flex-1">
            <input
              type="radio" name="nota" value={n} required
              defaultChecked={defaultValue === n}
              className="peer sr-only"
            />
            <span
              className="flex h-14 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-[var(--raio-controle)] border border-line bg-campo text-dim peer-checked:border-accent peer-checked:bg-accent/10 peer-checked:text-accent-forte peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent"
            >
              <Icone nome="estrela" className="size-4" />
              <span className="font-mono-instr text-xs">{n}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
