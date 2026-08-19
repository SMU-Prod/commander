"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ContadorAvisos } from "./ui/contador-avisos"
import { Icone, type NomeIcone } from "./icone"
import { TOQUE } from "@/lib/ui/acoes"

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
    // Onda 57 — Comandantes sai, Diário entra. A troca é UMA só, de
    // propósito: "Avisos" fica, porque é o único indicador de alerta
    // crítico presente em toda tela (o app não tem barra superior, ver
    // onda 44) e tirá-lo apagaria o aviso de seguro vencido de todo lugar.
    //
    // O PRD chama o Diário de coração do app e ele era um ícone num grid
    // de cinco atalhos. De brinde, conserta o defeito tipográfico
    // documentado abaixo: "Comandantes" não cabia em 11px e precisou da
    // exceção de 9.5px — "Diário" cabe.
    //
    // Comandantes continua alcançável pelo Menu e pela RedeNav.
    href: "/diario",
    rotulo: "Diário",
    icone: "relatorio",
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
 * abas, e 71px por coluna já é pouco pra rótulo longo: era o caso de
 * "Comandantes", que forçou a exceção de 9.5px removida na onda 57 ao
 * trocá-lo por "Diário". Uma sexta aba não encolhe o rótulo: encolhe todas
 * as seis até nenhuma ser legível.
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
          const badge = a.href === "/notificacoes"
          return (
            <Link
              key={a.href}
              href={a.href}
              aria-current={ativa ? "page" : undefined}
              /* gap de 5px entre ícone e rótulo — o do canvas
                 (nav-inferior.dc.html); o resto da anatomia já batia:
                 ícone 21px stroke 1.7, rótulo 11px 500 uppercase, ativa
                 em `accent-forte` — que nos dois temas vale exatamente os
                 dois tons de dourado que o canvas pede. */
              /* ONDA 84 — a barra mais tocada do app não dava retorno nenhum:
                 trocava a cor do texto e só, sem transição, sem `active:`. O
                 toque ficava sem resposta até a rota trocar — e quando a rota
                 demora, a pessoa toca de novo. `TOQUE` (e não `TOQUE_AMPLO`)
                 porque cada aba tem ~78px de largura: aqui os 3% são o
                 afundar certo, não um tremor. */
              className={`flex min-w-0 flex-1 flex-col items-center gap-[5px] pb-[max(0.625rem,env(safe-area-inset-bottom))] pt-2 text-[11px] font-medium uppercase ${TOQUE} ${
                ativa ? "text-accent-forte" : "text-dim"
              }`}
            >
              <span className="relative">
                <Icone nome={a.icone} className="size-[21px]" />
                {/* Onda 57 (revisão) — o badge saiu daqui pra
                    `ui/contador-avisos.tsx`. Ele era escrito à mão neste
                    arquivo e SÓ neste arquivo; quando o trilho de desktop
                    nasceu, nasceu sem número. Agora os dois desenham o mesmo
                    componente e nenhum dos dois pode divergir do outro. */}
                {badge && <ContadorAvisos avisos={avisos} />}
              </span>
              {/* min-w-0 + truncate: sem isso os rótulos longos ("Embarcação")
                  estouram o flex-1 e encostam um no outro em tela de 375px —
                  foi o que acontecia com "Comandantes". tracking removido
                  pelo mesmo motivo.
                  Onda 57 — a exceção de 9.5px ao piso de 11px de globals.css
                  (documentada lá, acima de .titulo-pagina) foi removida
                  junto com Comandantes: "Diário" cabe no piso padrão, então
                  a barra inteira volta a ele. */}
              <span className="w-full truncate px-0.5 text-center">{a.rotulo}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
