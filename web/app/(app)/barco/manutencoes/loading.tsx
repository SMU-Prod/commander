import { Esqueleto } from "@/components/ui/esqueleto"

/**
 * Cancela a herança da foto de 176px do `loading.tsx` de `/barco` — ver o
 * gêmeo em `/barco/motores`. A tela abre com `CabecalhoDetalhe`, que é a
 * silhueta de `ficha`.
 */
export default function Carregando() {
  return <Esqueleto forma="ficha" itens={1} />
}
