import { Esqueleto } from "@/components/ui/esqueleto"

/**
 * Fotos é lista pelo spec de arquitetura §2.2 ("quais existem?"). Cinco
 * `await`, e é a tela onde a espera é mais longa por natureza — a listagem
 * conta espaço usado antes de pintar.
 *
 * Como as irmãs, cancela a foto herdada do `loading.tsx` de `/barco`: a ironia
 * de prometer UMA foto grande numa tela que vai mostrar VÁRIAS pequenas é
 * justamente o tipo de promessa quebrada do achado 3.2.
 */
export default function Carregando() {
  return <Esqueleto forma="lista" itens={4} />
}
