"use client"
import { useEffect, useId, useRef, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Icone } from "@/components/icone"
import { TOQUE } from "@/lib/ui/acoes"

/**
 * ONDA 146 — A GAVETA: o painel lateral da imagem 12 do Guia do Dono.
 * ===========================================================================
 * A terceira cena da imagem 12 (ficha do Motor BB) mostra "Registrar
 * manutenção" abrindo POR CIMA da ficha, num painel encostado à direita — a
 * pessoa preenche o serviço sem perder de vista de onde veio. Era a última
 * anatomia grande do redesign sem peça própria: o app tinha bottom-sheet
 * escrito à mão duas vezes (`AvisoNavegar`, `CardParceiro`) e um modal
 * (`ModalGold`), cada um com um véu e um raio, e NENHUM com foco preso ou
 * Esc — quem navega por teclado tabulava pra trás do véu e se perdia.
 *
 * O ESTADO MORA NA URL, NÃO NUM `useState`. Padrão da casa desde os filtros
 * (`?filtroManut=`, `?aba=`): quem ABRE a gaveta é um `<Link href="?registrar=1">`
 * do server component, e este componente só existe na árvore enquanto o
 * parâmetro existe — presença É abertura. O que isso compra: o voltar do
 * navegador fecha a gaveta (era um push), F5 reabre no mesmo lugar, e o
 * link é compartilhável. Fechar aqui é `router.push(fecharHref)` — push e
 * não `back()`, porque quem chegou com `?registrar=1` colado num link
 * compartilhado não tem "anterior" pra voltar sem sair da ficha.
 *
 * O QUE A PEÇA CARREGA, além do desenho:
 *   · FOCO PRESO — Tab e Shift+Tab circulam só entre os controles do painel
 *     (role="dialog" + aria-modal); ao fechar, o foco volta pra quem abriu.
 *   · ESC FECHA — junto do véu clicável e do "Cancelar": três saídas, a
 *     régua de `docs/CONTRIBUTING.md` de nunca deixar a pessoa travada.
 *   · CORPO SEM SCROLL — a página de trás não rola enquanto a gaveta está
 *     aberta; quem rola é o miolo do painel.
 *   · ENTRADA ANIMADA — sobe do rodapé no celular (sheet de ~90% da altura),
 *     desliza da direita a partir de `sm` (~420px, altura inteira). As
 *     classes `.gaveta-*` moram no fim de `app/globals.css`, e a regra
 *     global de `prefers-reduced-motion` já zera a duração das duas.
 *
 * `--raio-painel` e não os 20px cravados: a folha CONTÉM conteúdo e está no
 * primeiro nível — o mesmo degrau que `AvisoNavegar` documenta. `z-40`/`z-50`
 * são o par que o próprio `AvisoNavegar` já usa pra véu + folha por cima do
 * chrome inteiro (bottom-nav e trilho ficam abaixo).
 */

/** O que conta como focável dentro do painel — a lista clássica, sem
 *  `[tabindex="-1"]` (que é focável por script, não por Tab). */
const FOCAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Gaveta({
  titulo,
  fecharHref,
  children,
}: {
  titulo: string
  /** A MESMA URL da tela, sem o parâmetro que abriu a gaveta — é pra onde o
   *  véu, o Esc, o "×" e o "Cancelar" navegam. */
  fecharHref: string
  children: ReactNode
}) {
  const router = useRouter()
  const painelRef = useRef<HTMLDivElement>(null)
  const idTitulo = useId()

  const fechar = () => router.push(fecharHref, { scroll: false })

  useEffect(() => {
    const painel = painelRef.current
    if (!painel) return

    // Quem estava focado antes (o botão que abriu) recebe o foco de volta no
    // fechamento — sem isso, fechar a gaveta jogava o foco pro <body> e o
    // leitor de tela recomeçava a página do zero.
    const focoAnterior = document.activeElement instanceof HTMLElement ? document.activeElement : null
    painel.focus()

    // O corpo para de rolar enquanto a gaveta está aberta. Guarda o valor
    // anterior em vez de assumir vazio: outra peça pode ter mexido antes.
    const overflowAnterior = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        router.push(fecharHref, { scroll: false })
        return
      }
      if (e.key !== "Tab") return
      // O laço do foco: Tab no último volta pro primeiro, Shift+Tab no
      // primeiro vai pro último. `offsetParent` filtra o que está oculto
      // (um <details> fechado, por exemplo) — elemento invisível não pode
      // receber Tab, senão o foco "some" da tela.
      const focaveis = Array.from(painel.querySelectorAll<HTMLElement>(FOCAVEIS)).filter(
        (el) => el.offsetParent !== null,
      )
      if (focaveis.length === 0) {
        e.preventDefault()
        painel.focus()
        return
      }
      const primeiro = focaveis[0]
      const ultimo = focaveis[focaveis.length - 1]
      const ativo = document.activeElement
      if (e.shiftKey && (ativo === primeiro || ativo === painel)) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && ativo === ultimo) {
        e.preventDefault()
        primeiro.focus()
      } else if (ativo instanceof HTMLElement && !painel.contains(ativo)) {
        // O foco escapou (clique no véu, extensão do navegador): o próximo
        // Tab traz de volta pra dentro em vez de passear pela página coberta.
        e.preventDefault()
        primeiro.focus()
      }
    }
    document.addEventListener("keydown", aoTeclar)
    return () => {
      document.removeEventListener("keydown", aoTeclar)
      document.body.style.overflow = overflowAnterior
      focoAnterior?.focus()
    }
  }, [router, fecharHref])

  return (
    <>
      {/* bg-black e não o navy da marca: mesmo motivo escrito em
          `AvisoNavegar` — véu é véu, e este arquivo nasce sem direito a cor
          literal na catraca de tokens.test.ts. */}
      <div className="gaveta-veu fixed inset-0 z-40 bg-black/40" onClick={fechar} aria-hidden="true" />
      <div
        ref={painelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
        className="gaveta-painel sombra-2 fixed inset-x-0 bottom-0 z-50 flex h-[90dvh] flex-col rounded-t-[var(--raio-painel)] border-t border-line bg-panel outline-none sm:inset-y-0 sm:left-auto sm:right-0 sm:h-auto sm:w-[420px] sm:max-w-[92vw] sm:rounded-l-[var(--raio-painel)] sm:rounded-tr-none sm:border-l sm:border-t-0"
      >
        {/* A alça do sheet — só no celular, onde a folha sobe do rodapé e o
            gesto de arrastar pra baixo é o vocabulário nativo. */}
        <span aria-hidden="true" className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-[var(--raio-pilula)] bg-line sm:hidden" />
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-4 py-2.5">
          <h2 id={idTitulo} className="titulo-card">{titulo}</h2>
          {/* O mesmo "×" do ModalGold: `mais` girado 45°, sem inventar ícone
              novo. Caixa de 44px (`size-11`), régua de toque que não se
              negocia; `-mr-2` devolve ao layout parte da folga. */}
          <button
            type="button"
            onClick={fechar}
            aria-label="Fechar"
            className={`-mr-2 flex size-11 shrink-0 items-center justify-center text-dim ${TOQUE}`}
          >
            <Icone nome="mais" className="size-5 rotate-45" />
          </button>
        </div>
        {/* Quem rola é o miolo (o corpo da página está travado). A folga de
            safe-area vale no sheet do celular, onde o rodapé encosta na
            barra de gestos. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
          {children}
          {/* O "Cancelar" do mock, fechando o par com o submit que vem dentro
              de `children` (BotaoEnviar). Contorno de propósito: a ação
              principal da gaveta é salvar; esta só devolve a ficha. */}
          <button
            type="button"
            onClick={fechar}
            className={`mt-3 flex min-h-[var(--altura-controle)] w-full items-center justify-center rounded-[var(--raio-pilula)] border border-line bg-panel2 text-sm font-medium text-texto ${TOQUE}`}
          >
            Cancelar
          </button>
        </div>
      </div>
    </>
  )
}
