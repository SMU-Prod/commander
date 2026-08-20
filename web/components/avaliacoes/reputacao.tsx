import Link from "next/link"
import { Icone } from "@/components/icone"
import {
  barrasDaDistribuicao, formatarMedia, formatarQuantidade, SELO_NEGOCIO_CONFIRMADO, type Reputacao,
} from "@/lib/domain/avaliacoes"

/**
 * §14: "Perfil mostra média, quantidade e indicação 'Negócio confirmado pelo
 * Commander'." As três coisas juntas, sempre — a média sozinha não diz nada
 * (4,9 de duas avaliações é outra coisa), e sem o selo o número pareceria
 * nota de site aberto.
 *
 * ONDA 62 — a anatomia do canvas (tela-4c): a média vira o NÚMERO grande em
 * mono ("4,8" + "de 5,0" em rótulo), e ao lado entra o histograma real por
 * estrela (`barrasDaDistribuicao`) com a quantidade embaixo. Nenhuma estrela
 * desenhada aqui: no resumo a nota é instrumento, não enfeite — ★ só aparece
 * colado ao número mono nos cartões individuais.
 */
export function ResumoReputacao({ reputacao, className = "" }: { reputacao: Reputacao; className?: string }) {
  if (reputacao.quantidade === 0) {
    return (
      <div className={`rounded-[var(--raio-cartao)] border border-line bg-panel p-4 ${className}`}>
        <p className="corpo font-medium">{formatarQuantidade(0)}</p>
        <p className="apoio mt-1 text-dim">
          Aqui só entra avaliação de quem fechou negócio pelo Commander e confirmou o fechamento dos dois
          lados. Por isso demora a aparecer — e por isso vale.
        </p>
      </div>
    )
  }

  return (
    <div className={`sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-3.5 ${className}`}>
      <div className="flex items-center gap-4">
        <div className="shrink-0">
          <p className="tabular-nums text-[32px] font-semibold leading-none tabular-nums">
            {formatarMedia(reputacao.media)}
          </p>
          <p className="rotulo mt-1 text-dim">de 5,0</p>
        </div>
        <div className="min-w-0 flex-1 space-y-[5px]">
          {barrasDaDistribuicao(reputacao).map((b) => (
            <div key={b.estrela} className="flex items-center gap-2">
              <span className="w-3 shrink-0 tabular-nums text-xs tabular-nums text-dim">{b.estrela}</span>
              <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-[var(--raio-pilula)] bg-panel2">
                <div
                  className={`h-full rounded-[var(--raio-pilula)] ${b.destaque ? "bg-accent" : "bg-dim"}`}
                  style={{ width: `${b.percentual}%` }}
                />
              </div>
            </div>
          ))}
          <p className="pt-0.5 tabular-nums text-xs tabular-nums text-dim">
            {formatarQuantidade(reputacao.quantidade)}
          </p>
        </div>
      </div>
      <p className="apoio mt-3 inline-flex items-center gap-1.5 rounded-[var(--raio-pilula)] border border-ok/40 px-2.5 py-1 text-ok">
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
      className="apoio inline-flex items-center gap-1 rounded-[var(--raio-pilula)] border border-line px-2 py-0.5 text-dim"
    >
      <Icone nome="estrela" className="size-3.5 text-accent-forte" />
      <span className="tabular-nums tabular-nums">{formatarMedia(reputacao.media)}</span>
      <span>({reputacao.quantidade})</span>
    </Link>
  )
}
