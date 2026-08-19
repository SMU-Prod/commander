import { Esqueleto } from "@/components/ui/esqueleto"

/**
 * Cancela a herança da foto de 176px do `loading.tsx` de `/barco` — ver o
 * gêmeo em `/barco/motores`. A tela abre com `CabecalhoDetalhe`, que é a
 * silhueta de `ficha`.
 *
 * `itens={2}`: um painel de categorias com item e o painel das que ainda não
 * têm — os dois blocos que a tela desenha na maioria dos barcos.
 */
export default function Carregando() {
  return <Esqueleto forma="ficha" itens={2} />
}
