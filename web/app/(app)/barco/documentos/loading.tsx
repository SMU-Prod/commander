import { Esqueleto } from "@/components/ui/esqueleto"

/**
 * Dez `await` — a sub-rota mais pesada de `/barco` e a terceira do app. É uma
 * lista ("quais documentos existem, e quais vencem"), e o corpo dela é
 * `LinhaLista` repetida.
 *
 * O arquivo existe para CANCELAR a herança: `loading.tsx` vale para o segmento
 * e para tudo abaixo dele, então sem esta linha a foto de 176px do
 * `loading.tsx` de `/barco` apareceria aqui — o mesmo salto que a onda 86
 * está desfazendo.
 */
export default function Carregando() {
  return <Esqueleto forma="lista" itens={5} />
}
