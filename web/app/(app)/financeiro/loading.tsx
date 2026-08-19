import { Esqueleto } from "@/components/ui/esqueleto"

/**
 * Financeiro é lista pelo spec §2.2. A tela abre com título, frase de apoio e
 * a `FinanceiroNav` — quatro abas de `h-11`, a mesma altura da fila de chips
 * que a forma `lista` desenha, então a banda de navegação bate sem precisar de
 * forma nova.
 *
 * Quatro linhas porque é o que a página corta (`slice(0, 4)` nos maiores
 * gastos) — o número não é chute, é o da consulta.
 */
export default function Carregando() {
  return <Esqueleto forma="lista" itens={4} />
}
