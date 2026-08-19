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
/**
 * ONDA 102 — *"PARECE QUE NUNCA CONSEGUIMOS SAIR DA MANUTENÇÃO DO BARCO."*
 *
 * O dono, na spec de 19/08 §5: *"O cabeçalho repete em absolutamente todas as
 * telas: Motor BB, Motor BE, Revisão em 250 horas, Avisos, Perfil, Seletor do
 * barco. Isso até faz sentido em Início e Barco, mas é desnecessário em
 * Marketplace, Explorar, Mensagens e outras áreas."*
 *
 * A regra que ele fixou tem duas metades, e a segunda é a que salva a
 * navegação: o cabeçalho *"some — ou fica reduzido ao que aquela área
 * precisa"*. Por isso o que desaparece fora daqui é só o ESTADO DO BARCO
 * (nome/seletor, pílulas de motor, revisão); o sino e o avatar ficam em toda
 * tela, porque no desktop eles não são contexto do barco — são a navegação
 * global, e sumir com o sino apagaria o aviso de seguro vencido de todo lugar
 * a partir de 1024px (o mesmo argumento que mantém "Avisos" na barra de
 * baixo, em `components/bottom-nav.tsx`).
 *
 * A LISTA É DE PREFIXOS, e são exatamente os dois itens do §2.1 que falam do
 * barco: `/hoje` (Início) e Meu Barco. Fora deles, contexto de barco é ruído:
 * quem está no Marketplace pedindo um mecânico não está decidindo nada com
 * "Revisão em 250 horas" no topo da tela.
 *
 * ONDA 103 — "MEU BARCO" PASSOU A SER DUAS ROTAS, E AS DUAS ENTRAM.
 * O §2.1 pede seis itens de menu com Meu Barco como AGRUPADOR, e a onda 103
 * fez dele uma tela (`/meu-barco`) para tirar as treze linhas de dentro do
 * Menu. A central técnica que a onda 101 construiu continua em `/barco`, e é a
 * primeira linha de lá. As duas SÃO "Meu Barco" na régua do dono — o índice do
 * barco e o estado técnico dele —, então a faixa completa vale nas duas: é
 * onde o nome do barco, o horímetro dos motores e a próxima revisão decidem
 * alguma coisa. (Custo: zero. A faixa é `hidden lg:flex` e as duas árvores já
 * chegam prontas do layout — ver `faixaReduzida` abaixo.)
 *
 * Por que a decisão mora AQUI e não no layout: `app/(app)/layout.tsx` é
 * Server Component e não tem pathname. Esta moldura já é a única peça do app
 * que conhece rota e breakpoint (é o que ela faz desde a onda 54), então a
 * regra cabe nela sem espalhar `usePathname` por mais nenhum lugar.
 */
const COM_ESTADO_DO_BARCO = ["/hoje", "/barco", "/meu-barco"]

export function temEstadoDoBarco(pathname: string): boolean {
  return COM_ESTADO_DO_BARCO.some((r) => pathname === r || pathname.startsWith(`${r}/`))
}

export function MolduraApp({
  permissoes,
  avisos = 0,
  faixa,
  faixaReduzida,
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
   *  cobri-lo. Sem barco o layout simplesmente não a passa.
   *
   *  ONDA 102 — esta é a faixa COMPLETA, com o estado do barco. Ela só entra
   *  em Início e Meu Barco (ver `temEstadoDoBarco`). */
  faixa?: React.ReactNode
  /** A mesma faixa sem o estado do barco: só sino e avatar. É o *"reduzido ao
   *  que aquela área precisa"* do §5 da spec, e é o que aparece em Serviços,
   *  Diário, Agenda e no resto do app.
   *
   *  São duas árvores prontas em vez de uma prop booleana porque quem sabe a
   *  rota é esta moldura (cliente) e quem tem os dados é o layout (servidor):
   *  passar os DADOS pra cá transformaria `FaixaTopo` em client component e
   *  arrastaria `calcularSemaforo` e o resto do domínio pro bundle do
   *  navegador. Renderizar duas vezes um cabeçalho de 56px no servidor não
   *  custa consulta nenhuma — o único preço que este app não paga de bom
   *  grado é ida ao banco (ver `carregarPainel` em `lib/consultas.ts`). */
  faixaReduzida?: React.ReactNode
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
        {temEstadoDoBarco(pathname) ? faixa : faixaReduzida}
        {children}
      </div>
    </>
  )
}
