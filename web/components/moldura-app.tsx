"use client"
import { usePathname } from "next/navigation"
import type { Permissoes } from "@/lib/domain/permissoes"
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
 *
 * `<TrilhoLateral />` vem ANTES da `<div>` de conteúdo de propósito: sendo
 * o primeiro irmão, é o primeiro destino de Tab da página no desktop — quem
 * navega por teclado chega na navegação principal sem atravessar o
 * conteúdo inteiro primeiro. A `<div>` carrega `data-moldura` como gancho
 * estável para quem precisa achá-la de fora (ver `e2e/sem-saida.spec.ts`),
 * então nada aqui depende da ordem dos irmãos ou de quantos `nav.fixed`
 * existem na página.
 */
export function MolduraApp({
  temFab,
  permissoes,
  avisos = 0,
  children,
}: {
  /** Há motor editável para o FAB registrar? Decidido no servidor, por permissão. */
  temFab: boolean
  /** As permissões desta pessoa neste barco, direto de `painel.permissoes`.
   *  Passam por aqui só para chegar ao trilho: quem decide o que ele mostra é
   *  o `podeVer` de `lib/domain/permissoes.ts`, o MESMO do "Acesso rápido" da
   *  Início e o mesmo dos gates de `/agenda` e `/financeiro`. `null` = PROP. */
  permissoes: Permissoes | null
  /** Contador do sino, já calculado e filtrado por permissão no layout. */
  avisos?: number
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const fabVisivel = temFab && mostrarRegistroRapido(pathname)
  return (
    <>
      <TrilhoLateral permissoes={permissoes} avisos={avisos} />
      <div
        data-moldura
        className={`mx-auto min-h-dvh ${LARGURA_CONTEUDO} ${OFFSET_TRILHO} px-4 pt-5 print:max-w-full print:px-0 print:pb-0 print:pt-0 ${
          fabVisivel ? FOLGA_COM_FAB : FOLGA_SEM_FAB
        }`}
      >
        {children}
      </div>
    </>
  )
}
