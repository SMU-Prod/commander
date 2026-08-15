import Link from "next/link"
import { Estrelas } from "@/components/avaliacoes/estrelas"
import { Icone } from "@/components/icone"
import {
  estrelasCheias, formatarMedia, formatarQuantidade, SELO_NEGOCIO_CONFIRMADO, type Reputacao,
} from "@/lib/domain/avaliacoes"

/**
 * §14: "Perfil mostra média, quantidade e indicação 'Negócio confirmado pelo
 * Commander'." As três coisas juntas, sempre — a média sozinha não diz nada
 * (4,9 de duas avaliações é outra coisa), e sem o selo o número pareceria
 * nota de site aberto.
 */
export function ResumoReputacao({ reputacao, className = "" }: { reputacao: Reputacao; className?: string }) {
  if (reputacao.quantidade === 0) {
    return (
      <div className={`rounded-[14px] border border-line bg-panel p-4 ${className}`}>
        <p className="corpo font-medium">{formatarQuantidade(0)}</p>
        <p className="apoio mt-1 text-dim">
          Aqui só entra avaliação de quem fechou negócio pelo Commander e confirmou o fechamento dos dois
          lados. Por isso demora a aparecer — e por isso vale.
        </p>
      </div>
    )
  }

  return (
    <div className={`sombra-1 rounded-[14px] border border-line bg-panel p-4 ${className}`}>
      <div className="flex items-center gap-3">
        <p className="font-mono-instr text-3xl tabular-nums text-accent-forte">
          {formatarMedia(reputacao.media)}
        </p>
        <div>
          <Estrelas nota={estrelasCheias(reputacao.media)} />
          <p className="apoio mt-0.5 text-dim">{formatarQuantidade(reputacao.quantidade)}</p>
        </div>
      </div>
      <p className="apoio mt-3 inline-flex items-center gap-1.5 rounded-full border border-ok/40 px-2.5 py-1 text-ok">
        <Icone nome="guardado" className="size-3.5" />
        {SELO_NEGOCIO_CONFIRMADO}
      </p>
    </div>
  )
}

/** Versão de uma linha, pros cartões das vitrines. Some quando não há
 *  avaliação: um "0 avaliações" em cada cartão só faria a lista inteira
 *  parecer vazia. */
export function SeloReputacao({ reputacao, href }: { reputacao: Reputacao; href: string }) {
  if (reputacao.quantidade === 0) return null
  return (
    <Link
      href={href}
      className="apoio inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-dim"
    >
      <Icone nome="estrela" className="size-3.5 text-accent-forte" />
      <span className="font-mono-instr tabular-nums">{formatarMedia(reputacao.media)}</span>
      <span>({reputacao.quantidade})</span>
    </Link>
  )
}
