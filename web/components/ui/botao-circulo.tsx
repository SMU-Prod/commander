import Link from "next/link"
import { Icone, type NomeIcone } from "@/components/icone"
import { TOQUE } from "@/lib/ui/acoes"

/**
 * BOTÃO-CÍRCULO DE CARTÃO — o botãozinho redondo que aparece no canto de TODO
 * cartão da referência (atualizar, ···, expandir, +, −). Spec §3, item 5:
 * "presentes em todo cartão do Haulix, ausentes nos nossos".
 *
 * A PEÇA INTEIRA É UMA BRIGA ENTRE DOIS NÚMEROS. O desenho pede 30px — maior
 * que isso o botão compete com o título do cartão e o cabeçalho deixa de ser
 * um cabeçalho. A régua de toque pede 44px, e ela não é negociável (a
 * varredura mede). A saída é separar as duas coisas: o ALVO é uma caixa de
 * 44px, o DESENHO é um círculo de 30px dentro dela, e `-m-[7px]` devolve ao
 * layout os 7px de folga que sobram de cada lado — o cartão continua sendo
 * espaçado como se o botão tivesse 30px, e o dedo continua acertando 44.
 *
 * SEM `"use client"`, DE PROPÓSITO. O arquivo não tem hook nenhum, então
 * funciona nos dois lados: com `href` é um `<Link>` e serve a componente de
 * servidor; com `onClick` ele é montado pelo componente cliente que o importa.
 * O dia em que este arquivo ganhar a diretiva, todo cartão que só queria uma
 * seta de "expandir" arrasta um bundle de cliente atrás.
 */
export function BotaoCirculo({
  icone,
  rotulo,
  href,
  onClick,
  className = "",
}: {
  icone: NomeIcone
  /** Vira `aria-label` e `title`. Obrigatório: botão só de ícone sem nome é
   *  invisível para leitor de tela, e este vai para dezenas de cartões. */
  rotulo: string
  href?: string
  /** Só a partir de um componente cliente — ver a nota acima. */
  onClick?: () => void
  className?: string
}) {
  const alvo = `group grid size-11 shrink-0 place-items-center rounded-full -m-[7px] ${TOQUE} ${className}`
  const desenho = (
    <span className="grid size-[30px] place-items-center rounded-full border border-line bg-panel2 text-dim transition-colors group-hover:border-accent/40 group-hover:bg-panel group-hover:text-texto">
      <Icone nome={icone} className="size-3.5" />
    </span>
  )

  if (href) {
    return (
      <Link href={href} aria-label={rotulo} title={rotulo} className={alvo}>
        {desenho}
      </Link>
    )
  }

  return (
    <button type="button" onClick={onClick} aria-label={rotulo} title={rotulo} className={alvo}>
      {desenho}
    </button>
  )
}
