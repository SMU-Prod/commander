import { Esqueleto } from "@/components/ui/esqueleto"

/**
 * O arquivo existe para CANCELAR A HERANÇA, mesma razão do gêmeo em
 * `/barco/documentos`: `loading.tsx` vale para o segmento e para tudo abaixo,
 * e o de `/barco` desenha a foto de 176px do `CardEmbarcacao`. Aqui a foto não
 * chega nunca — a tela abre com o par "Voltar + título" de `CabecalhoDetalhe`,
 * que é exatamente a silhueta de `ficha`. Esqueleto que promete foto e entrega
 * texto é o salto de layout que a onda 86 desfez no app inteiro.
 *
 * `itens={1}`: abaixo do cabeçalho vem um bloco só — a grade de mostradores.
 */
export default function Carregando() {
  return <Esqueleto forma="ficha" itens={1} />
}
