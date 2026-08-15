"use client"
import { Icone } from "@/components/icone"
import { SLOT_ACAO_FLUTUANTE } from "@/lib/ui/superficies"

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
      // ONDA 54 — a posição vem de `SLOT_ACAO_FLUTUANTE`, não mais escrita à
      // mão aqui. Escrita à mão ela era IDÊNTICA à do "+ Registrar", e os
      // dois botões ficavam empilhados no mesmo ponto em /barco/resumos: o
      // "+ Registrar" por cima comia o toque e exportar PDF virou impossível
      // no celular. Agora quem decide quem ocupa o slot em cada tela é
      // `mostrarRegistroRapido`, num lugar só.
      className={`print:hidden inline-flex items-center gap-1.5 ${SLOT_ACAO_FLUTUANTE}`}
    >
      <Icone nome="relatorio" className="size-4" /> Exportar PDF
    </button>
  )
}
