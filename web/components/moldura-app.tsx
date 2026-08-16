"use client"
import { usePathname } from "next/navigation"
import type { Permissoes } from "@/lib/domain/permissoes"
import {
  FOLGA_BASE,
  FOLGA_COM_ACAO_FLUTUANTE,
  LARGURA_CONTEUDO,
  OFFSET_TRILHO,
  temAcaoFlutuantePropria,
} from "@/lib/ui/superficies"
import { TrilhoLateral } from "./trilho-lateral"

/**
 * ONDA 54 — a folga inferior do conteúdo deixa de ser constante.
 *
 * Antes era um `pb-36` cravado no `layout.tsx`: um número só, para toda
 * tela, calculado supondo safe-area zero. A suposição é falsa — ver a conta
 * completa em `lib/ui/superficies.ts`. O resultado prático era o botão
 * "Criar manutenção" debaixo da bottom-nav no iPhone.
 *
 * Aqui a folga é DERIVADA do que realmente flutua na tela: toda tela paga a
 * folga da bottom-nav (`FOLGA_BASE`); quem tem ação flutuante própria
 * (`temAcaoFlutuantePropria` — hoje só `/barco/resumos`, com o "Exportar
 * PDF") paga a maior, pra caber o botão inteiro. Até a onda 60 esta conta
 * era mais complicada porque existia o FAB global "+ Registrar" em quase
 * toda tela — ele aposentou (a história está em `superficies.ts`), e com
 * ele foi embora a prop `temFab` que o layout calculava no servidor.
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
  permissoes,
  avisos = 0,
  faixa,
  children,
}: {
  /** As permissões desta pessoa neste barco, direto de `painel.permissoes`.
   *  Passam por aqui só para chegar ao trilho: quem decide o que ele mostra é
   *  o `podeVer` de `lib/domain/permissoes.ts`, o MESMO do "Acesso rápido" da
   *  Início e o mesmo dos gates de `/agenda` e `/financeiro`. `null` = PROP. */
  permissoes: Permissoes | null
  /** Contador do sino, já calculado e filtrado por permissão no layout. */
  avisos?: number
  /** ONDA 60 — a faixa de topo do desktop (`FaixaTopo`), montada no layout
   *  com os dados que ele já tem e entregue pronta: casca é assunto de
   *  moldura, mas o DADO da faixa é do servidor — como `children`, ela chega
   *  por prop e continua renderizando lá. Vive DENTRO da `[data-moldura]`,
   *  antes do conteúdo: primeiro filho da caixa, herda `OFFSET_TRILHO` e a
   *  largura máxima (alinha com o conteúdo, nunca passa por baixo do
   *  trilho) e, por estar no fluxo, empurra o conteúdo pra baixo em vez de
   *  cobri-lo. Sem barco o layout simplesmente não a passa. */
  faixa?: React.ReactNode
  children: React.ReactNode
}) {
  const pathname = usePathname()
  return (
    <>
      <TrilhoLateral permissoes={permissoes} avisos={avisos} />
      <div
        data-moldura
        className={`mx-auto min-h-dvh ${LARGURA_CONTEUDO} ${OFFSET_TRILHO} px-4 pt-5 print:max-w-full print:px-0 print:pb-0 print:pt-0 ${
          temAcaoFlutuantePropria(pathname) ? FOLGA_COM_ACAO_FLUTUANTE : FOLGA_BASE
        }`}
      >
        {faixa}
        {children}
      </div>
    </>
  )
}
