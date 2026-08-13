import Link from "next/link"
import type { ReactNode } from "react"
import { Icone, type NomeIcone } from "@/components/icone"

/**
 * Cabeçalho de seção dentro de uma página (rótulo uppercase espaçado, ícone
 * opcional à esquerda, ação opcional à direita — "Ver tudo", "+ Motor",
 * "Editar"). É o padrão que /hoje já usava copiado à mão em cada tela;
 * aqui virou componente.
 *
 * Quando usar: todo título de bloco dentro de uma página (Motores, Casco,
 * Documentos, Histórico...). Não usar para o título da PÁGINA em si — esse
 * é o `<h1 className="titulo-pagina">`, ver `CabecalhoDetalhe`.
 */
export function SecaoPagina({
  icone,
  acao,
  children,
  className = "",
}: {
  /** Ícone à esquerda do rótulo — mesmo `NomeIcone` do resto do app. */
  icone?: NomeIcone
  /** Ação à direita, ex.: `{ href: "/barco/itens/novo", rotulo: "Manutenção", icone: "mais" }`. */
  acao?: { href: string; rotulo: string; icone?: NomeIcone }
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`mt-6 mb-2 flex items-baseline justify-between gap-2 ${className}`}>
      <p className="rotulo inline-flex items-center gap-1.5 text-dim">
        {icone && <Icone nome={icone} className="size-3.5" />}
        {children}
      </p>
      {acao && (
        <Link href={acao.href} className="corpo inline-flex shrink-0 items-center gap-1 text-accent-forte">
          {acao.icone && <Icone nome={acao.icone} className="size-4" />}
          {acao.rotulo}
        </Link>
      )}
    </div>
  )
}
