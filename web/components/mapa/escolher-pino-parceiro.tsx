"use client"
import { useState } from "react"
import { Icone } from "@/components/icone"
import { CORES_PARCEIRO, ICONES_PARCEIRO, type NomeIconeParceiro } from "@/lib/mapa/pino-parceiro"

/** Seletor visual do ícone+cor do pino (onda 10, Pedido 2 — "o parceiro
 *  escolhe o ícone e a cor do próprio pino"). Client component embutido no
 *  form server-rendered de /parceiro (mesmo padrão de EscolherPonto): guarda
 *  o estado localmente e sobe pro FormData via dois `<input type="hidden">`
 *  — o `<form action={salvarParceiro}>` continua submetendo do jeito normal,
 *  sem fetch nenhum daqui.
 *
 *  A pré-visualização usa EXATAMENTE a mesma receita visual do marcador real
 *  no mapa (círculo preenchido com a cor + ícone branco + anel — ver
 *  `criarElementoMarcador` em navegar-mapa.tsx): fundo colorido + ícone
 *  branco + anel branco (ou dourado, se `destaque`) é o que garante
 *  legibilidade sobre água/satélite pra QUALQUER cor da paleta. */
export function EscolherPinoParceiro({
  iconeInicial,
  corInicial,
  destaque,
}: {
  iconeInicial: NomeIconeParceiro
  corInicial: string
  destaque: boolean
}) {
  const [icone, setIcone] = useState<NomeIconeParceiro>(iconeInicial)
  const [cor, setCor] = useState(corInicial)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-[var(--raio-cartao)] border border-line bg-panel2 px-3 py-3">
        <div
          className={`relative flex size-11 shrink-0 items-center justify-center rounded-[var(--raio-pilula)] ${
            destaque ? "ring-2 ring-accent" : "ring-2 ring-white"
          }`}
          style={{ backgroundColor: cor }}
        >
          <Icone nome={icone} className="size-5 text-white" />
        </div>
        <p className="apoio text-dim">É assim que seu pino aparece pra quem navega perto.</p>
      </div>

      <div>
        <p className="rotulo mb-1.5 text-dim">Cor do pino</p>
        <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label="Cor do pino">
          {CORES_PARCEIRO.map((c) => {
            const selecionada = cor === c.valor
            return (
              <button
                key={c.valor}
                type="button"
                role="radio"
                aria-checked={selecionada}
                aria-label={c.rotulo}
                title={c.rotulo}
                onClick={() => setCor(c.valor)}
                className={`size-9 rounded-[var(--raio-pilula)] transition-transform ${
                  selecionada ? "ring-2 ring-accent-forte scale-110" : "ring-1 ring-line"
                }`}
                style={{ backgroundColor: c.valor }}
              />
            )
          })}
        </div>
      </div>

      <div>
        <p className="rotulo mb-1.5 text-dim">Ícone do pino</p>
        <div role="radiogroup" aria-label="Ícone do pino" className="grid grid-cols-4 gap-2">
          {ICONES_PARCEIRO.map((i) => {
            const selecionado = icone === i.valor
            return (
              <button
                key={i.valor}
                type="button"
                role="radio"
                aria-checked={selecionado}
                onClick={() => setIcone(i.valor)}
                className={`flex flex-col items-center gap-1 rounded-[var(--raio-controle)] border px-2 py-2.5 text-center ${
                  selecionado ? "border-accent bg-accent/10 text-accent-forte" : "border-line text-dim"
                }`}
              >
                <Icone nome={i.valor} className="size-5" />
                <span className="apoio">{i.rotulo}</span>
              </button>
            )
          })}
        </div>
      </div>

      <input type="hidden" name="icone" value={icone} />
      <input type="hidden" name="cor" value={cor} />
    </div>
  )
}
