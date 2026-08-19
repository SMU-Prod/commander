import { Esqueleto } from "@/components/ui/esqueleto"

/**
 * O ESQUELETO PADRÃO DO APP — e o padrão passou a ser LISTA.
 *
 * Este arquivo desenhava a silhueta da Início (foto de 176px, título, dois
 * cartões, dois KPIs) para as 92 telas de `(app)`. Em 90 delas a foto não
 * chegava nunca, e a auditoria de 19/08 (achados 3.2 e 6.4) mediu o efeito: a
 * primeira transição do app é um salto de layout, justo nos 5 segundos em que
 * se decide se o app parece caro.
 *
 * `lista` é o padrão porque é a natureza mais comum do app (spec de
 * arquitetura §2.2 lista onze áreas, e cada uma tem sub-listas) e porque é a
 * que erra menos quando erra: título e linhas existem em quase toda tela, e
 * nenhuma delas promete uma foto. Quem não é lista — a Início, a ficha do
 * barco, o Mapa da Embarcação — tem `loading.tsx` próprio ao lado da página.
 */
export default function Carregando() {
  return <Esqueleto forma="lista" itens={5} />
}
