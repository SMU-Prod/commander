import { Esqueleto } from "@/components/ui/esqueleto"

/**
 * O Mapa da Embarcação é ficha — o spec de arquitetura §5 diz isso com todas
 * as letras — e a página abre exatamente com `CabecalhoDetalhe` ("Voltar ·
 * Mapa da Embarcação · selo · descrição"), que é o cabeçalho que a forma
 * `ficha` desenha.
 *
 * Este arquivo é obrigatório, não decorativo: sem ele o `loading.tsx` de
 * `/barco` valeria aqui e prometeria a foto de 176px do `CardEmbarcacao`, que
 * nesta tela não existe. É o achado 3.2 inteiro, só que uma pasta abaixo.
 */
export default function Carregando() {
  return <Esqueleto forma="ficha" itens={2} />
}
