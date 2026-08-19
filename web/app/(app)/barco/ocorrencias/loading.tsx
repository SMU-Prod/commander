import { Esqueleto } from "@/components/ui/esqueleto"

/**
 * Ocorrências é lista pelo spec de arquitetura §2.2, e a tela já tem a
 * anatomia inteira: `BarraFerramentas` com filtros e `LinhaLista` repetida.
 * Seis `await`.
 *
 * Como `/barco/documentos`, este arquivo existe para cancelar a foto que o
 * `loading.tsx` de `/barco` imporia às sub-rotas.
 */
export default function Carregando() {
  return <Esqueleto forma="lista" itens={5} />
}
