import { Esqueleto } from "@/components/ui/esqueleto"

/**
 * Agenda é lista pelo spec §2.2 e junta compromissos, manutenções e
 * ocorrências numa consulta só — sete `await`, e a tela ainda decide entre
 * vista de semana e de mês antes de pintar.
 *
 * Cinco linhas: é o teto do que cabe na primeira dobra de 390px depois do
 * cabeçalho, do seletor de período e da barra.
 */
export default function Carregando() {
  return <Esqueleto forma="lista" itens={5} />
}
