"use client"
import { usePathname } from "next/navigation"
import { FOLGA_COM_FAB, FOLGA_SEM_FAB, mostrarRegistroRapido } from "@/lib/ui/superficies"

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
    <div
      className={`mx-auto min-h-dvh max-w-[430px] px-4 pt-5 print:max-w-full print:px-0 print:pb-0 print:pt-0 ${
        fabVisivel ? FOLGA_COM_FAB : FOLGA_SEM_FAB
      }`}
    >
      {children}
    </div>
  )
}
