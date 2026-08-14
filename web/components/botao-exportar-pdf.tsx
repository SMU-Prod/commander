"use client"
import { Icone } from "@/components/icone"

/**
 * Exportação em PDF do Resumo (onda 37) — usa a impressão nativa do
 * navegador em vez de gerar o PDF no servidor ou embutir uma lib de PDF no
 * bundle. Justificativa (ver relatório da onda): a tela já é HTML puro,
 * `@media print` em `globals.css` já esconde a navegação e força o tema
 * claro, então "Salvar como PDF" do próprio navegador entrega o mesmo
 * resultado de uma lib client-side (ex.: jsPDF/react-pdf, ~200-300kB de
 * bundle) sem adicionar peso nenhum e sem depender de um serviço externo de
 * renderização (custo operacional zero). `print:hidden` neste botão garante
 * que ele mesmo não apareça no PDF gerado.
 */
export function BotaoExportarPdf() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-20 inline-flex items-center gap-1.5 rounded-full bg-accent px-5 py-3.5 text-sm font-semibold text-acao-texto shadow-lg shadow-accent/30"
    >
      <Icone nome="relatorio" className="size-4" /> Exportar PDF
    </button>
  )
}
