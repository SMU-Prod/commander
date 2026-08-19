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
 * ONDA 102 — COMO ESTAS CINCO SE ENCAIXAM NOS SEIS ITENS DO MENU PRINCIPAL.
 *
 * A spec de 19/08 (§2.1) fixa o menu do proprietário em seis: Início · Meu
 * Barco · Diário · Agenda · Serviços · Minha Conta. A barra cabe cinco, por
 * motivo físico (a conta está 30 linhas abaixo), então o encaixe é este:
 *
 *   · Início, Meu Barco e Diário têm vaga própria — são os três destinos que
 *     a pessoa abre todo dia;
 *   · Agenda, Serviços e Minha Conta moram no Menu, que é a quinta vaga e o
 *     gate de descoberta (PRD §9);
 *   · Avisos não é um dos seis e mesmo assim fica, pelo motivo escrito logo
 *     abaixo: é a única superfície de alerta presente em TODA tela do celular.
 *     Trocá-la por "Serviços" apagaria o aviso de seguro vencido de todo lugar
 *     pra ganhar um atalho que o Menu já dá a um toque.
 *
 * O rótulo continua "Barco" e não "Meu barco" pela MESMA restrição que tirou
 * "Comandantes" daqui na onda 57: a 375px cada coluna tem ~75px, e "MEU
 * BARCO" em caixa alta não cabe sem truncar ou sem descer a fonte abaixo do
 * piso de 11px da escala. O vocabulário completo do dono vive onde há largura
 * pra ele — o Menu e a pastilha do trilho.
 *
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
              className={`relative flex min-w-0 flex-1 flex-col items-center gap-[5px] pb-[max(0.625rem,env(safe-area-inset-bottom))] pt-2 text-[11px] font-medium uppercase ${TOQUE} ${
                ativa ? "text-accent-forte" : "text-dim"
              }`}
            >
              {/* ONDA 98 (HAULIX §24) — O SEGUNDO CANAL DA ABA ATIVA.
                  Conferido antes de mexer, como pedido: a barra de baixo
                  resolvia "você está aqui" com UM canal — a cor do texto e do
                  ícone (`text-accent-forte`). Cor sozinha não basta pela régra
                  3 do `docs/DESIGN.md` §6 ("estado é forma, não só cor"), e
                  aqui ela é ainda mais frágil que no trilho: o alvo tem 78px
                  de largura e o glifo 21px, então não há área para um fundo
                  cheio como o do §16 sem a barra inteira virar um bloco de
                  ouro — o que estouraria a contenção de 1–3%.
                  O §24 dá a forma certa para este caso: indicador de 2px no
                  eixo da aba, que é o mesmo gesto que `Abas` já usa dentro da
                  tela. Fica no TOPO (e não embaixo) porque o rodapé do
                  aparelho come a borda inferior na área segura do iPhone.
                  `aria-hidden`: o estado já é anunciado por `aria-current`. */}
              {ativa && (
                <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-accent" />
              )}
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
