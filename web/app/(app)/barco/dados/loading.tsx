import { Esqueleto } from "@/components/ui/esqueleto"

/**
 * Cancela a herança da foto de 176px do `loading.tsx` de `/barco` — ver o
 * gêmeo em `/barco/motores`.
 *
 * Aqui a forma `ficha` não é aproximação, é o desenho literal: a tela é
 * `CabecalhoDetalhe` mais um painel de pares rótulo/valor em duas colunas, que
 * é exatamente o que `FormaFicha` repete.
 */
export default function Carregando() {
  return <Esqueleto forma="ficha" itens={1} />
}
