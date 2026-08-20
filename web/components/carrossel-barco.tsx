"use client"
/* eslint-disable @next/next/no-img-element */
import { useRef, useState } from "react"
import { Icone } from "@/components/icone"

/**
 * O CARROSSEL DE FOTOS DO BARCO — na anatomia do mockup do dono (onda 132).
 * ===========================================================================
 * A primeira versão (onda 120) atendeu a frase ("bordas diminuindo a
 * opacidade") mas não o DESENHO: o mockup que o dono mandou em 20/08 mostra
 * um carrossel de PALCO CENTRAL — a foto da vez grande e arredondada no
 * meio, as vizinhas espiando apagadas nas laterais, setas nos dois lados,
 * e "2 de 3" + dots + "Deslize para ver" ABAIXO da foto, não por cima dela.
 * "NOSSO SLIDE CARROSSEL NÃO É IGUAL AO QUE PEDI" — agora é.
 *
 * O deslize continua sendo o scroll nativo (snap obrigatório no centro); as
 * setas só chamam `scrollBy` — atalho, nunca autoplay (§11 segue valendo).
 * O slide da vez é o de centro mais próximo do centro da caixa, medido no
 * `onScroll`; os vizinhos saem encolhidos e apagados como no mock.
 *
 * A máscara de bordas esvaídas fica: é ela que faz as vizinhas derreterem
 * na borda da tela em vez de serem cortadas a seco.
 *
 * COM UMA FOTO SÓ, nada de palco: a foto ocupa a largura inteira, sem seta,
 * sem dot, sem dica — carrossel de um item é moldura vazia.
 */
export function CarrosselBarco({ urls, nomeBarco }: { urls: string[]; nomeBarco: string }) {
  const trilhoRef = useRef<HTMLDivElement>(null)
  const [indice, setIndice] = useState(0)
  const varias = urls.length > 1

  const aoRolar = () => {
    const t = trilhoRef.current
    if (!t) return
    const centro = t.scrollLeft + t.clientWidth / 2
    let melhor = 0
    let menor = Number.POSITIVE_INFINITY
    Array.from(t.children).forEach((el, i) => {
      const alvo = el as HTMLElement
      const d = Math.abs(alvo.offsetLeft + alvo.offsetWidth / 2 - centro)
      if (d < menor) {
        menor = d
        melhor = i
      }
    })
    setIndice(melhor)
  }

  const pular = (direcao: -1 | 1) => {
    const t = trilhoRef.current
    if (!t) return
    t.scrollBy({ left: direcao * t.clientWidth * 0.78, behavior: "smooth" })
  }

  return (
    <section aria-label={`Fotos de ${nomeBarco}`}>
      <div className="mascara-borda-esvaida relative">
        <div
          ref={trilhoRef}
          onScroll={aoRolar}
          tabIndex={0}
          className={`flex snap-x snap-mandatory overflow-x-auto ${varias ? "gap-3" : ""}`}
          style={{ scrollbarWidth: "none" }}
        >
          {urls.map((url, i) => (
            <img
              key={url}
              src={url}
              alt={i === 0 ? `Foto de ${nomeBarco}` : ""}
              draggable={false}
              /* `max-h-72` — o mesmo teto de palco da onda 120: 16:9 governa
                 no celular, o teto segura o desktop. Vizinha encolhe e apaga
                 (o mock as mostra a meia-luz); a transição é a da casa. */
              className={`transicao-ui aspect-video max-h-72 shrink-0 snap-center rounded-[var(--raio-painel)] object-cover ${
                varias
                  ? `w-[78%] ${i === indice ? "" : "scale-[.94] opacity-55"} ${i === 0 ? "ml-[11%]" : ""} ${i === urls.length - 1 ? "mr-[11%]" : ""}`
                  : "w-full"
              }`}
            />
          ))}
        </div>
        {varias && (
          <>
            {/* As setas do mock — atalho de toque com o disco de 32px dentro
                do alvo de 44px (a separação alvo/desenho de lib/ui/acoes).
                Nas pontas elas apagam em vez de sumir: layout estável. */}
            <button
              type="button"
              onClick={() => pular(-1)}
              disabled={indice === 0}
              aria-label="Foto anterior"
              className="absolute inset-y-0 left-1 my-auto flex size-11 items-center justify-center disabled:opacity-40"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-meter/70 text-meter-texto backdrop-blur">
                <Icone nome="voltar" className="size-4" />
              </span>
            </button>
            <button
              type="button"
              onClick={() => pular(1)}
              disabled={indice === urls.length - 1}
              aria-label="Próxima foto"
              className="absolute inset-y-0 right-1 my-auto flex size-11 items-center justify-center disabled:opacity-40"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-meter/70 text-meter-texto backdrop-blur">
                <Icone nome="chevron" className="size-4" />
              </span>
            </button>
          </>
        )}
      </div>

      {varias && (
        /* O rodapé do mock, FORA da foto: contador, dots, e a dica por
           extenso. `aria-live` no contador — quem desliza sem ver ouve
           "2 de 3". Os dots são leitura (6px), nunca alvo. */
        <div className="mt-2 flex flex-col items-center gap-1">
          <div className="flex items-center gap-2.5">
            <p aria-live="polite" className="apoio tabular-nums text-dim">
              {indice + 1} de {urls.length}
            </p>
            <div className="flex items-center gap-1.5">
              {urls.map((url, i) => (
                <span
                  key={url}
                  aria-hidden="true"
                  className={`size-1.5 rounded-[var(--raio-pilula)] transition-colors ${
                    i === indice ? "bg-accent" : "bg-texto/25"
                  }`}
                />
              ))}
            </div>
          </div>
          <p className="apoio text-dim">Deslize para ver</p>
        </div>
      )}
    </section>
  )
}
