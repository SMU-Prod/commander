import { Esqueleto } from "@/components/ui/esqueleto"

/**
 * O Diário é a lista canônica do app (spec §2.2) e uma das telas mais pesadas
 * — sete `await`, e a consulta principal traz até 300 registros antes de
 * agrupar por mês.
 *
 * Seis linhas, não as cinco do padrão: aqui a primeira dobra da tela chega
 * cheia praticamente sempre, e esqueleto que desenha menos do que vai chegar
 * encolhe e depois cresce — o mesmo salto, só que para dentro.
 *
 * Este arquivo repete a forma do `loading.tsx` raiz de propósito: ele declara
 * a natureza AO LADO da página, para que mudar o padrão da raiz um dia não
 * mude em silêncio a tela mais usada do app.
 */
export default function Carregando() {
  return <Esqueleto forma="lista" itens={6} />
}
