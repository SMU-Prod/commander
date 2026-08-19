import { Esqueleto } from "@/components/ui/esqueleto"

/**
 * A Início é O painel do app (spec de arquitetura §2.1: "uma só"), e é a
 * página mais pesada que existe aqui — 18 `await` antes de pintar o primeiro
 * pixel. É a tela onde a espera mais aparece e a única em que a foto de 176px
 * do `CardEmbarcacao` é uma promessa verdadeira.
 *
 * Três cartões: "Precisa da sua atenção", "Gastos do mês" e o da Saúde são os
 * que chegam em praticamente toda visita.
 */
export default function Carregando() {
  return <Esqueleto forma="painel" itens={3} />
}
