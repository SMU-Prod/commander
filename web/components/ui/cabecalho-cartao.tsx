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
  subtitulo,
  selo,
  acao,
  className = "",
}: {
  icone?: NomeIcone
  titulo: string
  /** ONDA 91 (spec §3, item 3) — o subtítulo explicativo da referência
   *  ("Weekly on-time vs delayed delivery percentage"). O spec nomeia ESTA
   *  linha como a que faz o painel parecer instrumento documentado em vez de
   *  caixa com rótulo, e ela não existia em componente nenhum: era dívida de
   *  API, não de aplicação. Em `.rotulo-dado` — caixa de frase, sem tracking
   *  — porque é legenda de conteúdo, não etiqueta de instrumento (o mesmo
   *  corte que a onda 79 mediu ao separar as duas vozes de rótulo). */
  subtitulo?: string
  /** Pílula de estado colada ao título — mesmo slot/uso do `Selo`. */
  selo?: ReactNode
  /** Ação à direita, tipicamente um `BotaoCirculo` (atualizar, filtro, +). */
  acao?: ReactNode
  className?: string
}) {
  return (
    <header className={`mb-3 flex items-center gap-2 ${className}`}>
      {icone && <Icone nome={icone} className="size-4 shrink-0 text-dim" />}
      {/* Mesma coluna título/subtítulo do `Cartao` — ver o porquê do
          `items-center` lá; aqui o desalinhamento do ícone é de 2px contra a
          linha de `.titulo-card` (15px × 1,35 = 20,25px contra os 16px do
          `size-4`). */}
      <div className="min-w-0 flex-1">
        <h2 className="titulo-card truncate">{titulo}</h2>
        {subtitulo && <p className="rotulo-dado mt-0.5 line-clamp-2">{subtitulo}</p>}
      </div>
      {selo}
      {acao}
    </header>
  )
}
