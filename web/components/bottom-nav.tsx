"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"

const abas = [
  { href: "/hoje", rotulo: "Hoje" },
  { href: "/barco", rotulo: "Barco" },
  { href: "/diario", rotulo: "Diário" },
  { href: "/rede", rotulo: "Rede" },
]

export function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-ink/95 backdrop-blur">
      <div className="mx-auto flex max-w-[430px]">
        {abas.map((a) => {
          const ativa = pathname.startsWith(a.href)
          return (
            <Link
              key={a.href}
              href={a.href}
              className={`flex-1 py-3 text-center font-mono-instr text-[11px] uppercase tracking-widest ${
                ativa ? "text-accent" : "text-dim"
              }`}
            >
              {a.rotulo}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
