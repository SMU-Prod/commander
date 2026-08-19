import type { ReactNode } from "react"
import { Icone, type NomeIcone } from "@/components/icone"

/**
 * CABEÇALHO DE CARTÃO — "🔲 Cargo Layout [Fully loaded] ⟳" da referência:
 * ícone + título EM DESTAQUE + pílula de estado colada, botão de ícone à
 * direita. Spec §3, item 5 ("presentes em todo cartão do Haulix").
 *
 * NÃO é o mesmo cabeçalho que `Cartao` (`components/ui/cartao.tsx`) já
 * desenha — e a diferença é o ponto inteiro deste componente novo. O
 * cabeçalho do `Cartao` usa `.rotulo text-dim`: pequeno, cinza, maiúsculo —
 * correto pra ~90% dos cartões do Commander, que têm título-legenda
 * ("Motores", "Documentos"). A referência usa outra coisa pro cartão que É
 * o assunto da tela: título GRANDE e CLARO (`titulo-card`, `text-texto`),
 * não uma legenda. `Cartao` serve 4 arquivos hoje (`hoje`, `atualizacoes`,
 * `afazeres`, `admin`); mudar o desenho dele por baixo dos pés mudaria os
 * quatro sem revisão. Este componente é a variante nova, explícita, pra
 * quando o cartão pede destaque — hoje só a ficha de equipamento pede.
 */
export function CabecalhoCartao({
  icone,
  titulo,
  selo,
  acao,
  className = "",
}: {
  icone?: NomeIcone
  titulo: string
  /** Pílula de estado colada ao título — mesmo slot/uso do `Selo`. */
  selo?: ReactNode
  /** Ação à direita, tipicamente um `BotaoCirculo` (atualizar, filtro, +). */
  acao?: ReactNode
  className?: string
}) {
  return (
    <header className={`mb-3 flex items-center gap-2 ${className}`}>
      {icone && <Icone nome={icone} className="size-4 shrink-0 text-dim" />}
      <h2 className="titulo-card min-w-0 flex-1 truncate">{titulo}</h2>
      {selo}
      {acao}
    </header>
  )
}
