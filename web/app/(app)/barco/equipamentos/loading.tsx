import { Esqueleto } from "@/components/ui/esqueleto"

/** ONDA 125 — ver o comentário em `../eletrica/loading.tsx`: os quatro hubs
 *  sem `loading.tsx` próprio herdavam o esqueleto COM foto de `/barco`. */
export default function Carregando() {
  return <Esqueleto forma="ficha" itens={1} />
}
