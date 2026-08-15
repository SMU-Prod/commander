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
      {/* ONDA 54 — este link é A SAÍDA de ~46 telas do app, e media 16px de
          altura: menos da metade do alvo de toque que o resto do app já
          respeita (`min-h-11`). Dedo grande, barco balançando, tela molhada
          — errar o "Voltar" e cair na tela de trás é literalmente o
          "ficamos travados sem conseguir voltar" do relato.

          `-my-2.5` devolve ao layout 20 dos 28px que o `min-h-11` acrescenta:
          a área de TOQUE passa a 44px, mas a altura ocupada sobe só ~8px, e
          o título logo abaixo não desce meia tela em 46 arquivos. O
          `-ml-1 px-1` faz o mesmo na horizontal sem tirar o ícone do
          alinhamento com a margem da página. A folga de 10px que a margem
          negativa joga para baixo cabe dentro do `mt-3` do título — não
          encosta em nada. */}
      <Link
        href={voltarHref}
        className="-my-2.5 -ml-1 inline-flex min-h-11 items-center gap-1 px-1 rotulo text-accent-forte"
      >
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
