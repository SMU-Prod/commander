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

/**
 * O RÓTULO APARECE NO HOVER E NO FOCO — NÃO FICA ESCRITO EMBAIXO DO ÍCONE.
 *
 * É o que o spec aprovou, palavra por palavra: "Trilho de ícones à esquerda,
 * 72px, fixo, **com rótulo no hover/foco**"
 * (`docs/superpowers/specs/2026-08-15-fundacao-visual-design.md` §3.3).
 *
 * A primeira versão desta onda escreveu o rótulo permanente embaixo do
 * ícone e pagou o preço na mesma linha: "FINANCEIRO" em caixa alta não cabe
 * numa coluna de 72px, então a fonte desceu a 9px — degrau que não existe
 * na escala do spec (`11 · 12 · 14 · 16 · 20 · 26 · 34`, §2.5) e exatamente
 * o defeito que a bottom-nav ACABOU de perder nesta onda, ao trocar
 * "Comandantes" por "Diário" (ver o bloco da escala em `globals.css`).
 * Baixar 9px para 11px sem mexer no desenho só trocaria o problema por um
 * rótulo truncado: a causa não era a fonte, era o rótulo permanente
 * disputando os 72px do trilho.
 *
 * Com a pastilha em `absolute` FORA do trilho, o comprimento do texto para
 * de negociar com a largura da coluna: "Financeiro" pode crescer o quanto
 * quiser que o trilho continua com 72px, o alvo continua quadrado e o
 * conteúdo ao lado não é empurrado (a pastilha não ocupa espaço no fluxo).
 * É o padrão de trilho que Linear, GitHub e Vercel usam, e é o que permite
 * o rótulo voltar para um degrau legítimo da escala (12px, `text-xs`).
 */
export function TrilhoLateral() {
  const pathname = usePathname()
  return (
    <nav
      // `aria-label` porque esta é a navegação principal do desktop e a
      // página tem mais de um <nav>; sem rótulo, o leitor de tela anuncia
      // "navegação" duas vezes e a pessoa não sabe qual é qual.
      aria-label="Navegação principal"
      // SEM `overflow-hidden` aqui, e isso é requisito e não descuido: as
      // pastilhas de rótulo vivem fora dos 72px. Qualquer `overflow` que não
      // seja `visible` neste <nav> corta o rótulo no meio da palavra.
      className="no-imprimir fixed inset-y-0 left-0 z-20 hidden w-[72px] flex-col items-center gap-1 border-r border-line bg-panel py-4 lg:flex"
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
            // `aria-label` e não `title`: com o rótulo escondido, o link fica
            // sem texto visível, e link sem nome acessível é anunciado como
            // "link" e o destino vira adivinhação. `title` não serve de nome
            // acessível confiável (leitor de tela pode ignorá-lo conforme a
            // configuração, e no toque ele nunca aparece). A pastilha abaixo
            // é `aria-hidden` justamente para não duplicar este nome.
            aria-label={d.rotulo}
            // `size-11` = 44px, o piso de alvo de toque que o resto do app
            // já respeita (a varredura de tela reprova abaixo disso). Alvo
            // quadrado só com ícone: é o que dispensa reservar largura para
            // texto. `group` é o gancho do hover/foco da pastilha.
            className={`group relative flex size-11 items-center justify-center rounded-[var(--raio-controle)] ${
              // O estado ativo NÃO pode depender de hover — é a única pista
              // de onde a pessoa está. Fundo tingido + cor do ícone: dois
              // canais, nunca só cor (docs/DESIGN.md).
              ativo ? "bg-accent/12 text-accent-forte" : "text-dim hover:bg-panel2"
            }`}
          >
            <Icone nome={d.icone} className="size-5" />
            {/* A PASTILHA.
                `left-full ml-[22px]`: o alvo tem 44px centrado nos 72px do
                trilho, então sobram 14px até a borda direita — 14 + 8 de
                respiro põem a pastilha 8px FORA do trilho, sem encostar na
                borda. Se mudar a largura do trilho ou o tamanho do alvo,
                esta conta muda junto.
                `opacity` (e não `hidden`/`display:none`) para revelar: o
                elemento continua no fluxo do desenho e a transição existe;
                e como o nome acessível vem do `aria-label` do link, esconder
                aqui não custa nada ao leitor de tela.
                `group-focus-visible` além do `group-hover`: quem chega de Tab
                precisa ver onde está. Fica 22px afastado do alvo, então não
                briga com o `:focus-visible` global (2px de traço + 2px de
                offset, `globals.css`).
                `pointer-events-none` para a pastilha nunca roubar o clique
                do link nem de quem estiver embaixo dela.
                `z-30` para ficar acima dos irmãos do trilho; o trilho inteiro
                já é `z-20`, então ela cobre o conteúdo da página sem passar
                por cima do toast (`z-40`).
                `sombra-2` é a elevação de "isto flutua" que o resto do app
                usa em menu e pastilha (`--elev-flutuante`, spec §2.3) — a
                mesma do menu do SeletorEmbarcacao. */}
            <span
              aria-hidden="true"
              className="sombra-2 pointer-events-none absolute left-full top-1/2 z-30 ml-[22px] -translate-y-1/2 whitespace-nowrap rounded-[var(--raio-controle)] border border-line bg-panel px-2.5 py-1.5 text-xs font-medium text-texto opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
            >
              {d.rotulo}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
