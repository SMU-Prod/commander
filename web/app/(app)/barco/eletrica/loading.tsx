import { Esqueleto } from "@/components/ui/esqueleto"

/**
 * ONDA 125 — o gêmeo que faltava: motores/casco/documentos/manutenções já
 * cancelavam a herança do `loading.tsx` de `/barco` (que desenha a foto de
 * 176px do herói), mas Elétrica, Hidráulica, Segurança e Equipamentos ainda
 * abriam prometendo foto e entregando ficha — o salto de layout que a onda
 * 86 desfez no app inteiro voltava só nestes quatro hubs.
 */
export default function Carregando() {
  return <Esqueleto forma="ficha" itens={1} />
}
