import Link from "next/link"
import { Abas } from "@/components/ui/abas"

export type SubabaFinanceiro = "visao" | "lancamentos" | "recorrentes" | "relatorios"

const SUBABAS: { valor: SubabaFinanceiro; href: string; rotulo: string }[] = [
  { valor: "visao", href: "/financeiro", rotulo: "Visão geral" },
  { valor: "lancamentos", href: "/financeiro/lancamentos", rotulo: "Lançamentos" },
  { valor: "recorrentes", href: "/financeiro/recorrentes", rotulo: "Recorrentes" },
  { valor: "relatorios", href: "/financeiro/relatorios", rotulo: "Relatórios" },
]

/**
 * As quatro subabas do Financeiro (PRD FINAL §9.1: "Visão Geral |
 * Lançamentos | Recorrentes | Relatórios").
 *
 * ONDA 60 — passou a renderizar `Abas` (onda 58) por dentro em vez de
 * pílulas escritas à mão: é a mesma anatomia de navegação-dentro-de-tela que
 * o Menu/Avisos e o catálogo (imagem 2, `docs/DESIGN-SYSTEM.md` §1) já usam,
 * e a régua "duas telas que fazem a mesma coisa parecem a mesma coisa"
 * (DESIGN §6.6) não perdoa um segundo estilo de aba só porque este nasceu
 * antes do componente existir. A API externa não mudou — `atual` e
 * `className` continuam os mesmos, as quatro telas do Financeiro chamam
 * exatamente como chamavam.
 *
 * O sublinhado dourado da aba ativa é o indicador de onde-a-pessoa-está:
 * dourado de MOLDURA, fora do orçamento de 2 por tela (DESIGN §5).
 */
export function FinanceiroNav({ atual, className = "" }: { atual: SubabaFinanceiro; className?: string }) {
  // `overflow-x-auto whitespace-nowrap`: só o Financeiro tem uma aba de dois
  // nomes ("Visão geral") — sem isto ela quebra em duas linhas, sozinha, na
  // largura de 390px, enquanto as outras três ficam numa linha só. `Abas` não
  // precisa disto nas telas de uma palavra só (Avisos), por isso a regra
  // entra por fora, via `className`, e não no componente compartilhado.
  return <Abas abas={SUBABAS} ativa={atual} className={`overflow-x-auto whitespace-nowrap ${className}`} />
}

/**
 * As duas ações universais do PRD §9.1 ("+ Despesa e + Entrada. Portanto o
 * Financeiro nunca depende de integração de Hub"). Ficam em TODA subaba de
 * propósito: o caminho pro lançamento manual não pode depender de estar na
 * tela certa.
 */
export function AcoesUniversais({ className = "" }: { className?: string }) {
  return (
    <div className={`flex gap-2 ${className}`}>
      <Link
        href="/financeiro/novo?tipo=despesa"
        className="flex h-11 flex-1 items-center justify-center rounded-xl bg-accent text-sm font-semibold text-acao-texto"
      >
        + Despesa
      </Link>
      <Link
        href="/financeiro/novo?tipo=entrada"
        className="flex h-11 flex-1 items-center justify-center rounded-xl border border-line bg-panel text-sm font-semibold"
      >
        + Entrada
      </Link>
    </div>
  )
}
