import { Esqueleto } from "@/components/ui/esqueleto"

/**
 * Explorar é lista pelo spec §2.2 ("quais parceiros existem?"), com seis
 * `await` — e é a tela mais provável de ser a PRIMEIRA que alguém de fora vê,
 * porque é a porta de descoberta do produto. A primeira transição que essa
 * pessoa assiste é esta.
 *
 * A tela ainda não adotou a `BarraFerramentas`: hoje o filtro é um formulário
 * de busca dentro de um cartão. A forma `lista` desenha a barra mesmo assim —
 * é a anatomia que o §2.2 declara, as duas ocupam a mesma faixa do topo, e
 * desenhar o que estamos construindo é melhor do que fossilizar o que sobrou.
 */
export default function Carregando() {
  return <Esqueleto forma="lista" itens={4} />
}
