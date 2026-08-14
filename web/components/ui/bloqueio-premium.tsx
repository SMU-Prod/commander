import Link from "next/link"
import { Icone } from "@/components/icone"

/**
 * Componente de bloqueio (onda 38) — cadeado + o que o Premium libera +
 * caminho pra assinar. É o cartão que aparece NO LUGAR de um formulário/ação
 * quando `recursoLiberado()` (`lib/domain/plano-acesso.ts`) diz não — nunca
 * esconde a entrada da funcionalidade (PRD §43: "recursos Premium aparecem,
 * porém bloqueados"), só troca o que tem dentro dela.
 *
 * Mesmo padrão visual de `EstadoVazio` (ícone + título + descrição + ação)
 * de propósito — este bloqueio não é um estado de erro, é um convite, e a
 * linguagem visual deixa isso claro por já ser familiar.
 */
export function BloqueioPremium({
  titulo,
  descricao,
  className = "",
}: {
  titulo: string
  descricao: string
  className?: string
}) {
  return (
    <div className={`sombra-1 rounded-[14px] border border-accent/30 bg-panel p-4 text-center ${className}`}>
      <Icone nome="cadeado" className="mx-auto size-6 text-accent-forte" />
      <p className="corpo mt-2 font-medium">{titulo}</p>
      <p className="apoio mt-1 text-dim">{descricao}</p>
      <Link
        href="/menu/assinatura"
        className="mt-3 inline-block rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-acao-texto"
      >
        Ver o Premium
      </Link>
    </div>
  )
}
