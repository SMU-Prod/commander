import { Esqueleto } from "@/components/ui/esqueleto"

/**
 * `/barco` é ficha pela taxonomia (spec §2.3 lista "embarcação"), mas o
 * esqueleto se escolhe pelo que a tela DESENHA, não pelo verbete: a identidade
 * daqui não é o par "Voltar + título" de `CabecalhoDetalhe` — é a foto de
 * 176px do `CardEmbarcacao`, primeira coisa da página (`/barco` é aba da barra
 * de baixo, não tem "Voltar"). A forma `painel` é a silhueta exata disso; a
 * forma `ficha` abriria com 86px de cabeçalho de texto que não chega, e o
 * salto voltaria pela outra ponta.
 *
 * `saudacao={false}` porque a fileira de avatar é da Início; aqui a foto começa
 * no topo da tela.
 *
 * ONDA 101 — O QUE VEM DEPOIS DA FOTO MUDOU, E ESTE ARQUIVO NÃO CONSEGUE
 * ACOMPANHAR INTEIRO. A /barco virou central técnica: abaixo do herói agora há
 * uma GRADE de oito cards de 120px (`grid-cols-2`), não a pilha de cartões
 * largos que `FormaPainel` desenha. A foto — que é a maior peça e a primeira
 * meia-tela, onde a auditoria diz que se decide se o app parece caro —
 * continua exata, e `itens={2}` continua aproximando bem a altura visível
 * antes da dobra. Abaixo dela o esqueleto promete blocos largos e chegam
 * cards em duas colunas. O conserto de verdade é uma forma `grade` em
 * `components/ui/esqueleto.tsx`, que é de outro agente nesta rodada — está no
 * relatório, não inventado aqui à mão: o valor deste componente é o
 * `role="status"`, o `aria-busy` e o tratamento de quem pediu menos movimento,
 * e reescrever a silhueta neste arquivo jogaria os três fora.
 *
 * O PREÇO DESTE ARQUIVO, ESCRITO PARA QUEM VIER DEPOIS: em App Router o
 * `loading.tsx` vale para o segmento E para tudo abaixo dele, e `/barco` tem
 * 33 sub-rotas. As três mais pesadas — `documentos` (10 `await`),
 * `ocorrencias` (6) e `fotos` (5) — mais `mapa` já têm `loading.tsx` próprio
 * cancelando a foto. As demais herdam esta forma; todas esperam pouco (≤4
 * `await`) e todas já herdavam uma foto do `loading.tsx` raiz antes desta
 * onda, então nenhuma piorou. Quando uma delas ficar pesada, o conserto é um
 * arquivo de quatro linhas ao lado da página, igual aos que já estão aqui.
 */
export default function Carregando() {
  return <Esqueleto forma="painel" saudacao={false} itens={2} />
}
