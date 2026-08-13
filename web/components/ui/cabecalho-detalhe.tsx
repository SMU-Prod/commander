import Link from "next/link"
import type { ReactNode } from "react"
import { Icone } from "@/components/icone"

/**
 * Topo de uma tela de detalhe: link "Voltar" (sempre), título opcional e
 * ação primária opcional à direita do título (ex.: "Editar").
 *
 * Quando usar: telas fora do fluxo de abas (criar/editar/detalhe de item,
 * documento, equipamento...). Quando a própria tela já tem um elemento que
 * funciona como título (ex.: o horímetro na ficha do equipamento), passe só
 * `voltarHref` e omita `titulo` — o componente cuida só da navegação de volta.
 */
export function CabecalhoDetalhe({
  voltarHref,
  voltarRotulo = "Voltar",
  titulo,
  descricao,
  acao,
  className = "",
}: {
  voltarHref: string
  voltarRotulo?: string
  titulo?: string
  descricao?: string
  acao?: ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <Link href={voltarHref} className="inline-flex items-center gap-1 rotulo text-accent-forte">
        <Icone nome="voltar" className="size-4" /> {voltarRotulo}
      </Link>
      {titulo && (
        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="titulo-pagina truncate">{titulo}</h1>
            {descricao && <p className="apoio mt-1 text-dim">{descricao}</p>}
          </div>
          {acao}
        </div>
      )}
    </div>
  )
}
