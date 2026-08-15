"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Icone, type NomeIcone } from "./icone"

/**
 * ONDA 57 — A NAVEGAÇÃO DE DESKTOP QUE NÃO EXISTIA.
 *
 * Trilho de 72px, não sidebar larga: sidebar de 272px come a densidade que
 * a referência escolhida pelo dono tem, e o Commander mostra UM barco — não
 * precisa de menu com doze rótulos escritos. É a mesma lição do Waze
 * (docs/DESIGN.md §3): a moldura é uma camada fina, o conteúdo é o assunto.
 *
 * NO CELULAR ELE NÃO EXISTE. Quem navega lá é a bottom-nav, que ganhou
 * `lg:hidden` nesta mesma onda. Duas navegações visíveis ao mesmo tempo é o
 * erro clássico do "app esticado" — por isso `hidden lg:flex` aqui e
 * `lg:hidden` lá, no MESMO breakpoint dos dois lados. Mexeu num, mexa no
 * outro, senão em 1024px aparecem as duas (ou nenhuma).
 *
 * POR QUE SETE DESTINOS E NÃO CINCO: a bottom-nav só cabe cinco por motivo
 * físico (71px por coluna, ver o comentário dela). Aqui cabe a coluna
 * inteira, então Diário, Agenda e Financeiro — que no celular vivem a um
 * toque de distância — ganham posição fixa. Todos conferidos contra
 * `app/(app)/`: rota que não existe vira 404 silencioso.
 */
const DESTINOS: { href: string; rotulo: string; icone: NomeIcone }[] = [
  { href: "/hoje", rotulo: "Início", icone: "inicio" },
  { href: "/barco", rotulo: "Barco", icone: "embarcacao" },
  { href: "/diario", rotulo: "Diário", icone: "relatorio" },
  { href: "/agenda", rotulo: "Agenda", icone: "calendario" },
  { href: "/financeiro", rotulo: "Financeiro", icone: "cifrao" },
  { href: "/notificacoes", rotulo: "Avisos", icone: "alerta" },
  { href: "/menu", rotulo: "Menu", icone: "menu" },
]

export function TrilhoLateral() {
  const pathname = usePathname()
  return (
    <nav
      // `aria-label` porque esta é a navegação principal do desktop e a
      // página tem mais de um <nav>; sem rótulo, o leitor de tela anuncia
      // "navegação" duas vezes e a pessoa não sabe qual é qual.
      aria-label="Navegação principal"
      className="no-imprimir fixed inset-y-0 left-0 z-20 hidden w-[72px] flex-col items-center gap-1 border-r border-line bg-panel px-1 py-4 lg:flex"
    >
      {DESTINOS.map((d) => {
        // `startsWith` com a barra: sem ela `/barco` acenderia junto com
        // qualquer rota que só COMECE com essas letras.
        const ativo = pathname === d.href || pathname.startsWith(`${d.href}/`)
        return (
          <Link
            key={d.href}
            href={d.href}
            aria-current={ativo ? "page" : undefined}
            // `title` porque o rótulo é minúsculo: quem tem dúvida sobre o
            // ícone confirma no hover sem precisar clicar.
            title={d.rotulo}
            // Sem padding lateral de propósito: "FINANCEIRO", o rótulo mais
            // longo, mede 54px e a coluna tem 64px. Com um `px-1` aqui
            // sobrariam 0,8px de folga — qualquer ajuste de fonte depois
            // truncaria o rótulo sem ninguém perceber.
            className={`flex w-full flex-col items-center justify-center gap-1 rounded-[var(--raio-controle)] py-2 text-[9px] uppercase tracking-[.06em] ${
              ativo ? "bg-accent/12 text-accent-forte" : "text-dim hover:bg-panel2"
            }`}
          >
            <Icone nome={d.icone} className="size-5" />
            {/* Mesma defesa da bottom-nav: rótulo longo estoura a coluna e
                encosta na borda do trilho em vez de quebrar. */}
            <span className="w-full truncate text-center">{d.rotulo}</span>
          </Link>
        )
      })}
    </nav>
  )
}
