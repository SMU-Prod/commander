"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Icone, type NomeIcone } from "./icone"

const abas: { href: string; rotulo: string; icone: NomeIcone }[] = [
  {
    href: "/hoje",
    rotulo: "Início",
    icone: "inicio",
  },
  {
    href: "/barco",
    rotulo: "Embarcação",
    icone: "embarcacao",
  },
  {
    href: "/marketplace",
    rotulo: "Comandantes",
    icone: "marketplace",
  },
  {
    href: "/notificacoes",
    rotulo: "Avisos",
    icone: "alerta",
  },
  {
    href: "/menu",
    rotulo: "Menu",
    icone: "menu",
  },
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
              aria-current={ativa ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-1 pb-[max(0.625rem,env(safe-area-inset-bottom))] pt-2 text-[10.5px] font-medium uppercase tracking-wider ${
                ativa ? "text-accent-forte" : "text-dim"
              }`}
            >
              <Icone nome={a.icone} className="size-[21px]" />
              {a.rotulo}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
