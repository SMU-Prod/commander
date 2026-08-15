import Link from "next/link"
import { Icone } from "@/components/icone"
import type { CardVitrine } from "@/lib/consultas-partner"

/**
 * §10 — "Experiência principal: cards QUADRADOS/VISUAIS com foto, nome,
 * categoria e localização básica. Clique abre perfil completo para usuários
 * elegíveis."
 *
 * Quadrado de verdade (`aspect-square`), foto sangrando e o texto por cima
 * num gradiente: o PRD pede uma vitrine que se lê pela imagem, não uma lista
 * de linhas com miniatura. Sem foto, o cartão vira o bloco de cor + ícone que
 * o próprio parceiro escolheu pro pino (mesma identidade do mapa) — nunca um
 * retângulo cinza de "imagem faltando".
 *
 * `bloqueado` é o §2.3: no Free, `tipoRotulo` e `local` já chegam nulos do
 * servidor (ver `cardAmostraFree`), e o cartão deixa de ser clicável — não há
 * perfil completo pra abrir, e um clique que só leva a paywall irrita mais do
 * que informa. O cadeado diz o porquê em voz alta, como o §24 exige de todo
 * limite.
 */
export function CardsParceiros({
  cards,
  bloqueado = false,
}: {
  cards: readonly CardVitrine[]
  bloqueado?: boolean
}) {
  return (
    <ul className="grid grid-cols-2 gap-3">
      {cards.map((c) => {
        const miolo = (
          <>
            {c.fotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- URL pública do bucket parceiros
              <img
                src={c.fotoUrl}
                alt=""
                className="absolute inset-0 size-full object-cover"
                loading="lazy"
              />
            ) : (
              <span
                className="absolute inset-0 flex items-center justify-center"
                style={{ backgroundColor: c.cor }}
              >
                <Icone nome={c.icone} className="size-10 text-white/85" />
              </span>
            )}

            {/* Gradiente só na base: mantém a foto legível e garante contraste
                do texto sobre qualquer imagem (praia clara ou marina à noite). */}
            <span className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-[#0B1D2D]/90 to-transparent" />

            {c.destaque && (
              <span className="apoio absolute left-2 top-2 rounded-full bg-[#0B1D2D]/70 px-2 py-0.5 text-[#D4AF37]">
                Destaque
              </span>
            )}
            {bloqueado && (
              <span
                className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-[#0B1D2D]/70"
                aria-hidden
              >
                <Icone nome="cadeado" className="size-3.5 text-white/90" />
              </span>
            )}

            <span className="absolute inset-x-0 bottom-0 p-2.5">
              <span className="titulo-card block truncate text-white">{c.nome}</span>
              {c.tipoRotulo && (
                <span className="apoio block truncate text-white/80">{c.tipoRotulo}</span>
              )}
              {c.local && <span className="apoio block truncate text-white/65">{c.local}</span>}
            </span>
          </>
        )

        return (
          <li key={c.id}>
            {bloqueado ? (
              <div className="sombra-1 relative aspect-square overflow-hidden rounded-[14px] border border-line bg-panel2">
                {miolo}
              </div>
            ) : (
              <Link
                href={`/explorar/${c.id}`}
                className="sombra-1 relative block aspect-square overflow-hidden rounded-[14px] border border-line bg-panel2"
              >
                {miolo}
              </Link>
            )}
          </li>
        )
      })}
    </ul>
  )
}
