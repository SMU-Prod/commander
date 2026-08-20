import Link from "next/link"
import { Icone, type NomeIcone } from "@/components/icone"
import { hub, type ChaveHub } from "@/lib/ui/hubs"
import { TOQUE } from "@/lib/ui/acoes"

/**
 * A TRINCA DE NÚMEROS DO TOPO DE UM HUB, E O BOTÃO QUE FECHA A TELA.
 * ===========================================================================
 * Anatomia da imagem 3 do Guia de Design v1 (as quatro telas de hub lado a
 * lado), que é normativa para composição pelo §1. Depois do objeto grande, as
 * quatro telas mostram exatamente a mesma coisa: **três cartões de número** e,
 * abaixo deles, **um botão de largura cheia** com a ação daquele hub.
 *
 * ---------------------------------------------------------------------------
 * A COR DO NÚMERO NÃO É SEMPRE A DO HUB, E A EXCEÇÃO É A REGRA INTEIRA
 * ---------------------------------------------------------------------------
 * Repare no cartão de Segurança da imagem: "Itens 24" e "Em dia 22" saem em
 * VERDE (a cor do hub), e "Atenção 2" sai em ÂMBAR. Não é inconsistência do
 * desenho — é o §4 e o §5 do guia funcionando juntos:
 *
 *   · o número é MOLDURA do hub enquanto ele é só uma contagem → cor do hub;
 *   · o número vira ESTADO quando ele responde "isto precisa de você" →
 *     `--warn` ou `--crit`, que é o que verde/âmbar/vermelho significam nesta
 *     casa e em nenhum outro lugar.
 *
 * Por isso `estado` é uma prop, e não uma inferência: quem monta a tela sabe
 * se aquele "2" é um censo ou um alerta. `undefined` = contagem.
 *
 * E VALOR ZERO CONTINUA APARECENDO, mas nunca em cor de alerta — "Atenção 0"
 * é a confirmação ativa de que nada pede nada, e pintá-lo de âmbar diria o
 * contrário do que ele diz. Quem chama passa `estado` só quando o número é
 * maior que zero; há teste.
 *
 * ---------------------------------------------------------------------------
 * O BOTÃO É DE LARGURA CHEIA, E ISSO NÃO É SÓ ESTÉTICA
 * ---------------------------------------------------------------------------
 * Nas oito telas de hub a ação vivia numa pílula dourada de ~100px encostada
 * no canto superior direito, ao lado do título. A imagem 3 põe um botão de
 * largura cheia, com o verbo por extenso e uma seta. É a diferença entre um
 * controle que a pessoa PROCURA e um que ela ENCONTRA — e o pedido do dono
 * nesta rodada foi literal: *"uma criança deve saber mexer nele com
 * facilidade"*.
 *
 * ELE É NA COR DO HUB E NÃO NO DOURADO, e isso não fura o §3.4 (dourado é a
 * ação principal): o §5 autoriza a cor do hub *"no card daquele sistema"*, e
 * dentro da tela de Segurança o botão de Segurança é exatamente isso. Fura
 * seria pintar um botão de Segurança dentro de Motores. O dourado continua
 * sendo a ação de nível APP (Registrar saída, Salvar, Assinar) — e é por isso
 * que a pílula dourada do cabeçalho SAI quando este botão entra: duas ações
 * principais na mesma tela é a coisa que o §6.2 do `docs/DESIGN.md` proíbe, e
 * as duas eram a mesma ação escrita duas vezes.
 */
export function NumerosDoHub({
  chave,
  numeros,
  className = "",
}: {
  chave: ChaveHub
  /** Exatamente três — é o que a imagem desenha e o que cabe em 390px sem
   *  truncar rótulo. O tipo cobra os três; o teste cobra o resto. */
  numeros: readonly [NumeroDoHub, NumeroDoHub, NumeroDoHub]
  className?: string
}) {
  const h = hub(chave)
  return (
    <div className={`grid grid-cols-3 gap-2 ${className}`}>
      {numeros.map((n) => (
        <div
          key={n.rotulo}
          className={`raio-cartao flex flex-col items-center gap-1 border bg-panel px-2 py-3 text-center ${h.borda}`}
        >
          {/* O rótulo primeiro e o valor depois — ordem de leitura da imagem, e
              a que faz sentido em áudio: "Em dia, 22" é uma frase; "22, em
              dia" é um número à procura de contexto.
              `leading-tight` e `break-words`: "Sem informação" a 390px divide
              a coluna em três de ~110px, e sem isso ele estoura. */}
          <span className="rotulo-dado leading-tight break-words text-dim">{n.rotulo}</span>
          <span
            className={`font-mono-instr tabular-nums text-[28px] font-bold leading-none ${
              n.estado === "critico" ? "text-crit" : n.estado === "atencao" ? "text-warn" : h.tom
            }`}
          >
            {n.valor}
          </span>
          {n.icone && (
            <Icone
              nome={n.icone}
              aria-hidden="true"
              className={`mt-0.5 size-4 ${
                n.estado === "critico" ? "text-crit" : n.estado === "atencao" ? "text-warn" : h.tom
              }`}
            />
          )}
        </div>
      ))}
    </div>
  )
}

export type NumeroDoHub = {
  rotulo: string
  /** Já formatado. Este componente não formata número — quem chama decide a
   *  régua, como em `Kpi` e `PastilhaKpi`. */
  valor: string
  icone?: NomeIcone
  /** Só quando o número É um alerta. Contagem comum fica sem, e sai na cor do
   *  hub. Nunca passar em valor zero. */
  estado?: "atencao" | "critico"
}

export function AcaoDoHub({
  chave,
  href,
  children,
  className = "",
}: {
  chave: ChaveHub
  href: string
  children: string
  className?: string
}) {
  const h = hub(chave)
  return (
    <Link
      href={href}
      /* `min-h-[var(--altura-campo)]` (48px) e não `--altura-controle` (44):
         a régua da casa é que a ação que FECHA uma tela herda a altura do
         campo, e é o que alinha esta barra com o resto da coluna. */
      className={`raio-controle transicao-ui flex min-h-[var(--altura-campo)] w-full items-center justify-center gap-2 border bg-panel corpo font-semibold hover:bg-panel2 ${h.borda} ${h.tom} ${TOQUE} ${className}`}
    >
      {children}
      <Icone nome="chevron" aria-hidden="true" className="size-4" />
    </Link>
  )
}
