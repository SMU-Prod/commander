import Link from "next/link"

/**
 * ONDA 58 — navegação dentro de uma tela (spec de arquitetura §2.3).
 * Estado mora na URL, não em useState: RSC continua server, voltar do
 * navegador funciona, e link é compartilhável. Anatomia única — a régua
 * "duas telas que fazem a mesma coisa parecem a mesma coisa" só vale se
 * ninguém escrever abas à mão.
 *
 * Atenção pra quem consumir: o sublinhado dourado da aba ativa conta no
 * orçamento de dourado da tela (máximo dois usos por tela, ver
 * `docs/DESIGN.md`).
 */
export function Abas({
  abas,
  ativa,
  className = "",
}: {
  abas: { valor: string; rotulo: string; href: string; contagem?: number }[]
  ativa: string
  className?: string
}) {
  return (
    <nav aria-label="Seções desta tela" className={`flex gap-1 border-b border-line ${className}`}>
      {abas.map((a) => {
        const ehAtiva = a.valor === ativa
        return (
          <Link
            key={a.valor}
            href={a.href}
            aria-current={ehAtiva ? "page" : undefined}
            className={`flex min-h-11 items-center gap-1 border-b-2 px-3 text-sm font-medium ${
              ehAtiva ? "border-accent-forte text-texto" : "border-transparent text-dim"
            }`}
          >
            {a.rotulo}
            {a.contagem != null && a.contagem > 0 && (
              <span className="font-mono-instr text-[11px] tabular-nums text-dim">{a.contagem}</span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
