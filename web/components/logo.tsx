/* Marca provisória — monograma "MM espelhado" fiel ao conceito aprovado.
   Substituir o <svg> pelo asset final quando o Erick fornecer. */
export function Logo({ compacto = false }: { compacto?: boolean }) {
  return (
    <span className="inline-flex items-baseline gap-2">
      <svg viewBox="0 0 48 34" className="h-[1.05em] w-auto self-center" aria-hidden="true">
        <path
          d="M4 32 V10 L15 22 24 5 33 22 44 10 V32 H36 V24 L28 32 H20 L12 24 V32 Z"
          fill="#d4af37"
        />
      </svg>
      {!compacto && (
        <span className="font-semibold uppercase tracking-[.28em] text-texto">Commander</span>
      )}
    </span>
  )
}
