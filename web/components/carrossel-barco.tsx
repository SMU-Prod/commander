"use client"
/* eslint-disable @next/next/no-img-element */
import { useRef, useState } from "react"

/**
 * O CARROSSEL DE FOTOS DO BARCO — Início, pedido do dono na onda 120.
 * ===========================================================================
 * *"precisamos do carrossel de imagens do barco, mas a linha do card não deve
 * existir... como se as bordas fossem diminuindo a opacidade, para tornar
 * mais premium"*. E é o §11 do Guia de Design, que já especificava o resto:
 * swipe horizontal, dots, contador, e AUTOPLAY PROIBIDO — quem muda é a
 * pessoa.
 *
 * SEM BORDA, COM MÁSCARA. O pedido é literal: nada de linha de card. O
 * contorno é `mask-image` — a foto esvai para o fundo da página nos quatro
 * lados em vez de terminar num risco. São DOIS gradientes lineares compostos
 * por interseção (e não um radial): o radial derrete as diagonais muito antes
 * das laterais e come os cantos da foto; a interseção fade uniforme de 32px
 * em cada borda, que é o "diminuindo a opacidade" do pedido sem sacrificar
 * área útil. Fica em `style` porque é valor composto que o Tailwind não tem
 * como utilitária e nenhum outro lugar usa — é a assinatura DESTA peça, não
 * um token.
 *
 * SCROLL-SNAP, NÃO ESTADO. O deslize é o scroll nativo com `snap-x
 * mandatory`: o navegador cuida do gesto, da inércia e do teclado (setas com
 * o foco no trilho). O JS só OBSERVA (`onScroll` calcula o índice para os
 * dots e o contador) e nunca move a foto — mover seria autoplay disfarçado.
 *
 * FOTO REAL, NUNCA RECORTADA POR SURPRESA: `object-cover` corta para caber
 * no palco 16:9 do herói (§13). A foto inteira continua a um toque em
 * /barco/fotos.
 */
export function CarrosselBarco({
  urls,
  nomeBarco,
  veuInferior = false,
}: {
  urls: string[]
  nomeBarco: string
  /**
   * Escurece a base DENTRO da máscara, para quem sobrepõe texto ao rodapé
   * (o herói da Início põe nome + anel ali). Dentro, e não por cima: um véu
   * externo é um retângulo — nas bordas já esvaídas da foto ele desenharia
   * exatamente a linha que este componente existe para não ter.
   */
  veuInferior?: boolean
}) {
  const trilhoRef = useRef<HTMLDivElement>(null)
  const [indice, setIndice] = useState(0)

  const aoRolar = () => {
    const t = trilhoRef.current
    if (!t) return
    setIndice(Math.round(t.scrollLeft / t.clientWidth))
  }

  return (
    <section aria-label={`Fotos de ${nomeBarco}`} className="relative">
      {/* `mascara-borda-esvaida` (app/globals.css) — nasceu aqui na onda 120
          e virou classe da casa na 122, quando o Diário passou a usar o mesmo
          contorno no barco do topo. O trilho NÃO veste `rolagem-lateral`: a
          máscara de borda direita dela, aninhada nesta, só duplicaria o fade. */}
      <div className="mascara-borda-esvaida relative">
        <div
          ref={trilhoRef}
          onScroll={aoRolar}
          tabIndex={0}
          className="flex snap-x snap-mandatory overflow-x-auto"
          style={{ scrollbarWidth: "none" }}
        >
          {urls.map((url, i) => (
            <img
              key={url}
              src={url}
              alt={i === 0 ? `Foto de ${nomeBarco}` : ""}
              draggable={false}
              /* `max-h-72` — o teto do palco. No celular o 16:9 governa
                 (390px → 219 de altura); no desktop, onde 16:9 daria ~480px
                 e empurraria o resto da Início pra fora da dobra, vale o
                 mesmo teto de 288px que o herói de foto única sempre teve
                 (`lg:h-72`) e o recorte vira faixa panorâmica via
                 `object-cover`. */
              className="aspect-video max-h-72 w-full shrink-0 snap-center object-cover"
            />
          ))}
        </div>
        {veuInferior && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-meter/80 via-meter/35 to-transparent"
          />
        )}
      </div>

      {urls.length > 1 && (
        <>
          {/* Dots + contador do §11. `pointer-events-none` nos dois: são
              leitura — o gesto é o deslize, e um alvo de 6px seria uma
              promessa de toque que a régua de 44px proíbe cumprir aqui.
              O contador vai de chip no TOPO, e não junto aos dots: o rodapé
              é o lugar do nome e do anel de Saúde de quem usa o carrossel
              como herói, e "2 de 6" competindo com o nome do barco é ruído. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-2 flex items-center justify-center gap-1.5">
            {urls.map((url, i) => (
              <span
                key={url}
                aria-hidden="true"
                className={`size-1.5 rounded-[var(--raio-pilula)] transition-colors ${
                  i === indice ? "bg-accent" : "bg-meter-texto/40"
                }`}
              />
            ))}
          </div>
          <p
            aria-live="polite"
            className="apoio pointer-events-none absolute right-3 top-3 rounded-[var(--raio-pilula)] bg-meter/60 px-2 py-0.5 tabular-nums text-meter-texto backdrop-blur"
          >
            {indice + 1} de {urls.length}
          </p>
        </>
      )}
    </section>
  )
}
