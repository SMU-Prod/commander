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
    // Onda 39 — renomeada de /marketplace pra /comandantes; o rótulo já
    // tinha trocado numa auditoria de usabilidade anterior, só a URL
    // continuava desatualizada (ver docs/CONTRIBUTING.md, Glossário).
    href: "/comandantes",
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

/**
 * DECISÃO FECHADA (onda 46) — A AGENDA NÃO VIRA ABA AQUI.
 *
 * A onda 43 entregou a Agenda e deixou a pergunta em aberto: ela merece uma
 * das posições do menu de baixo? O dono respondeu em 15/08/2026: NÃO.
 * O motivo é físico e já está documentado 30 linhas abaixo — só cabem 5
 * abas, e "Comandantes" já não cabe em 11px nos 71px por coluna (por isso a
 * exceção de 9.5px). Uma sexta aba não encolhe o rótulo: encolhe todas as
 * seis até nenhuma ser legível.
 *
 * A Agenda continua a 1 toque da Início (atalho de "Acesso rápido") e
 * listada no Menu — os dois caminhos que o gate de descoberta exige
 * (docs/CONTRIBUTING.md). Não é falta de acesso; é escolha de onde.
 * Não reabra esta discussão sem trazer um rótulo mais curto ou uma aba pra
 * sacrificar.
 *
 * `avisos` é o contador do sino (PRD §5.2), calculado no layout e já
 * filtrado por permissão — ver `carregarNotificacoes`. Fica no rodapé
 * porque a aba Avisos é a única superfície de notificação presente em TODA
 * tela; o sino em si mora no topo da Início.
 */
export function BottomNav({ avisos = 0 }: { avisos?: number }) {
  const pathname = usePathname()
  return (
    // Onda 57 — `lg:hidden` porque a partir de `lg` quem navega é o
    // `TrilhoLateral`. As duas ao mesmo tempo seriam duas navegações
    // principais competindo na mesma tela; o breakpoint é o mesmo lá e cá.
    <nav className="no-imprimir fixed inset-x-0 bottom-0 z-10 border-t border-line bg-ink/95 backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-[430px]">
        {abas.map((a) => {
          const ativa = pathname.startsWith(a.href)
          const badge = a.href === "/notificacoes" && avisos > 0
          return (
            <Link
              key={a.href}
              href={a.href}
              aria-current={ativa ? "page" : undefined}
              className={`flex min-w-0 flex-1 flex-col items-center gap-1 pb-[max(0.625rem,env(safe-area-inset-bottom))] pt-2 text-[9.5px] font-medium uppercase ${
                ativa ? "text-accent-forte" : "text-dim"
              }`}
            >
              <span className="relative">
                <Icone nome={a.icone} className="size-[21px]" />
                {badge && (
                  <span
                    aria-label={`${avisos} avisos que pedem atenção`}
                    className="absolute -right-2 -top-1 flex min-w-[16px] items-center justify-center rounded-full bg-crit px-1 font-mono-instr text-[9px] font-semibold leading-4 tabular-nums text-white"
                  >
                    {avisos > 9 ? "9+" : avisos}
                  </span>
                )}
              </span>
              {/* min-w-0 + truncate: sem isso os rótulos longos ("Embarcação",
                  "Comandantes") estouram o flex-1 e encostam um no outro em
                  tela de 375px — foi o que aconteceu ao trocar Marketplace por
                  Comandantes. tracking removido pelo mesmo motivo.
                  text-[9.5px] é exceção documentada ao piso de 11px de
                  globals.css — "COMANDANTES" maiúsculo não cabe em 11px nos
                  71px disponíveis por aba (medido: precisa de 81px); 9.5px é
                  o maior tamanho que ainda cabe (ver comentário completo em
                  globals.css, acima de .titulo-pagina). */}
              <span className="w-full truncate px-0.5 text-center">{a.rotulo}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
