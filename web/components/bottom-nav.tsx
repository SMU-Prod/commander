"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"

const abas = [
  {
    href: "/hoje",
    rotulo: "Início",
    icone: <path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1v-8z" />,
  },
  {
    href: "/barco",
    rotulo: "Embarcação",
    icone: <path d="M3 15h18l-3 5H6l-3-5zM6 15V9h12v6M12 9V4" />,
  },
  {
    href: "/marketplace",
    rotulo: "Marketplace",
    icone: <path d="M4 9l1.5-5h13L20 9M4 9h16M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9M9 13h6" />,
  },
  {
    href: "/notificacoes",
    rotulo: "Avisos",
    icone: <path d="M6 16V10a6 6 0 0 1 12 0v6l2 3H4l2-3zM10 19a2 2 0 0 0 4 0" />,
  },
  {
    href: "/menu",
    rotulo: "Menu",
    icone: <path d="M4 6h16M4 12h16M4 18h16" />,
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
              className={`flex flex-1 flex-col items-center gap-1 pb-2.5 pt-2 text-[9.5px] font-medium uppercase tracking-wider ${
                ativa ? "text-accent-forte" : "text-dim"
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                className="size-[21px]"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {a.icone}
              </svg>
              {a.rotulo}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
