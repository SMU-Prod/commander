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
    rotulo: "Barco",
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
              className={`flex min-w-0 flex-1 flex-col items-center gap-1 pb-[max(0.625rem,env(safe-area-inset-bottom))] pt-2 text-[9.5px] font-medium uppercase ${
                ativa ? "text-accent-forte" : "text-dim"
              }`}
            >
              <Icone nome={a.icone} className="size-[21px]" />
              {/* min-w-0 + truncate: sem isso os rótulos longos ("Embarcação",
                  "Comandantes") estouram o flex-1 e encostam um no outro em
                  tela de 375px — foi o que aconteceu ao trocar Marketplace por
                  Comandantes. tracking removido pelo mesmo motivo. */}
              <span className="w-full truncate px-0.5 text-center">{a.rotulo}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
