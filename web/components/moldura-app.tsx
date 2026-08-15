"use client"
import { usePathname } from "next/navigation"
import {
  FOLGA_COM_FAB,
  FOLGA_SEM_FAB,
  LARGURA_CONTEUDO,
  OFFSET_TRILHO,
  mostrarRegistroRapido,
} from "@/lib/ui/superficies"
import { TrilhoLateral } from "./trilho-lateral"

/**
 * ONDA 54 — a folga inferior do conteúdo deixa de ser constante.
 *
 * Antes era um `pb-36` cravado no `layout.tsx`: um número só, para toda
 * tela, calculado supondo safe-area zero e supondo que o "+ Registrar"
 * sempre existe. As duas suposições são falsas — ver a conta completa em
 * `lib/ui/superficies.ts`. O resultado prático era o botão "Criar
 * manutenção" debaixo da bottom-nav no iPhone, e ~90px de espaço morto no
 * fim de toda tela que nem tem FAB.
 *
 * Aqui a folga passa a ser DERIVADA do que realmente flutua na tela: a
 * rota (via `mostrarRegistroRapido`) e a presença de motor editável
 * (`temFab`, que o layout calcula no servidor com a permissão da pessoa).
 * É client component só por causa do `usePathname` — `children` chega como
 * prop e continua renderizando no servidor, então nada da árvore vira
 * cliente por causa disto.
 *
 * ONDA 57 — esta virou a ÚNICA peça do app que conhece breakpoint de
 * layout. A largura do conteúdo deixa de ser 430px em qualquer tela e o
 * trilho de desktop entra aqui, porque casca é assunto de moldura: as 109
 * telas herdam a mudança sem serem tocadas uma a uma.
 */
export function MolduraApp({
  temFab,
  children,
}: {
  /** Há motor editável para o FAB registrar? Decidido no servidor, por permissão. */
  temFab: boolean
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const fabVisivel = temFab && mostrarRegistroRapido(pathname)
  return (
    <>
      <div
        className={`mx-auto min-h-dvh ${LARGURA_CONTEUDO} ${OFFSET_TRILHO} px-4 pt-5 print:max-w-full print:px-0 print:pb-0 print:pt-0 ${
          fabVisivel ? FOLGA_COM_FAB : FOLGA_SEM_FAB
        }`}
      >
        {children}
      </div>
      {/* DEPOIS do conteúdo, e isso NÃO é cosmético: a bottom-nav é filha
          desta moldura (ver `app/(app)/layout.tsx`) e `e2e/sem-saida.spec.ts`
          acha a moldura pelo `parentElement` do primeiro `nav.fixed` da
          página para medir a folga da safe-area da onda 54. O trilho também
          é um `nav.fixed`; se ele vier antes, o teste passa a medir o pai do
          trilho — que não tem folga nenhuma — e o guarda da regressão do
          iPhone quebra sem que nada de verdade tenha quebrado. Sendo `fixed`,
          a ordem não muda um pixel do que se vê. */}
      <TrilhoLateral />
    </>
  )
}
