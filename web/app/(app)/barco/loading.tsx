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
