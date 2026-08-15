import Link from "next/link"

export type SubabaFinanceiro = "visao" | "lancamentos" | "recorrentes" | "relatorios"

const SUBABAS: { valor: SubabaFinanceiro; href: string; rotulo: string }[] = [
  { valor: "visao", href: "/financeiro", rotulo: "Visão geral" },
  { valor: "lancamentos", href: "/financeiro/lancamentos", rotulo: "Lançamentos" },
  { valor: "recorrentes", href: "/financeiro/recorrentes", rotulo: "Recorrentes" },
  { valor: "relatorios", href: "/financeiro/relatorios", rotulo: "Relatórios" },
]

/**
 * As quatro subabas do Financeiro (PRD FINAL §9.1: "Visão Geral |
 * Lançamentos | Recorrentes | Relatórios"). Mesmo desenho do `RedeNav` da
 * onda 39 — pílulas roláveis no topo, a ativa em dourado — porque o app já
 * ensinou esse gesto e inventar um segundo estilo de aba faria a pessoa
 * reaprender navegação dentro do mesmo produto.
 */
export function FinanceiroNav({ atual, className = "" }: { atual: SubabaFinanceiro; className?: string }) {
  return (
    <nav
      aria-label="Seções do Financeiro"
      className={`flex gap-1.5 overflow-x-auto pb-1 ${className}`}
      style={{ scrollbarWidth: "none" }}
    >
      {SUBABAS.map((s) => {
        const ativo = s.valor === atual
        return (
          <Link
            key={s.valor}
            href={s.href}
            aria-current={ativo ? "page" : undefined}
            className={`flex h-11 shrink-0 items-center whitespace-nowrap rounded-full border px-4 text-sm font-medium ${
              ativo ? "border-accent bg-accent text-acao-texto" : "border-line bg-panel text-dim"
            }`}
          >
            {s.rotulo}
          </Link>
        )
      })}
    </nav>
  )
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
