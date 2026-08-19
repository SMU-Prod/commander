"use client"

import { useMemo, useState } from "react"
import { Selo } from "@/components/ui/selo"
import {
  PESO,
  calcularSemaforo,
  linhaDaRegra,
  rotuloDoFarol,
  seloDoFarol,
  textoRestante,
  type ItemCalc,
} from "@/lib/domain/semaforo"

/**
 * A SEGUNDA DEMONSTRAÇÃO, E ELA EXISTE PARA CONSERTAR UMA MENTIRA.
 * ===========================================================================
 * A landing anterior dizia, letra por letra: *"Cruzamos horas de motor com
 * prazos de documento e mostramos o que vence primeiro."* A primeira metade é
 * falsa, e a auditoria de 19/08 (`produto-promessa-x-entrega.md` §3.6) mostrou
 * por quê: documento não tem `intervaloHoras` em lugar nenhum do domínio, e
 * não faria sentido ter. O cruzamento que o Commander faz é OUTRO, e é melhor
 * — ele acontece DENTRO do mesmo item: uma revisão que vence a cada 300 horas
 * OU a cada 24 meses tem as duas contagens correndo juntas, e o farol assume a
 * pior das duas (`calcularSemaforo`, a linha `candidatos.sort`).
 *
 * Explicar isso em prosa custa um parágrafo que ninguém lê. Este controle
 * ensina em um gesto: arraste o horímetro e veja o item de DUAS réguas mudar
 * de estado enquanto o de data fica parado — e a lista se reordenar sozinha.
 *
 * A CONTA É A DO APP, NÃO UMA IMITAÇÃO. `calcularSemaforo`, `linhaDaRegra`,
 * `textoRestante`, `seloDoFarol` e `PESO` vêm de `lib/domain/semaforo.ts` — o
 * mesmo módulo, com os mesmos testes, que pinta o farol de `/hoje` e das oito
 * fichas técnicas. A ordenação por `PESO` também é a de `/hoje`.
 */

interface Demonstrado {
  chave: string
  rotulo: string
  sistema: string
  item: ItemCalc
}

/** Isola UMA das duas réguas do item, para a frase de baixo poder dizer qual
 *  delas está mandando. Reaproveita `calcularSemaforo` em vez de recalcular o
 *  limiar aqui: os 15% de margem de horas não são exportados, e reescrevê-los
 *  nesta tela criaria uma segunda régua que ninguém compara com a primeira —
 *  que é exatamente a deriva que o domínio existe pra impedir. */
function soPorHoras(item: ItemCalc): ItemCalc {
  return { ...item, intervaloMeses: null, dataFixa: null, ultimoCicloData: null }
}
function soPorData(item: ItemCalc): ItemCalc {
  return { ...item, intervaloHoras: null, ultimoCicloHoras: null }
}

const HORAS_MIN = 1000
const HORAS_MAX = 1400
const HORAS_INICIAL = 1180

export function VencePrimeiro({
  hoje,
  extintoresEm,
  ultimoImpelidor,
}: {
  hoje: string
  /** Data fixa da recarga dos extintores. */
  extintoresEm: string
  /** Data do último serviço do impelidor — somada aos 24 meses de intervalo,
   *  é ela que produz a contagem em dias que corre ao lado da de horas. */
  ultimoImpelidor: string
}) {
  const [horas, setHoras] = useState(HORAS_INICIAL)

  // As três datas chegam prontas do servidor. Calcular `new Date()` aqui faria
  // o primeiro render do cliente divergir do HTML do servidor sempre que a
  // virada do dia caísse entre os dois — e hidratação divergente numa página
  // pública é erro de console em produção, não detalhe de estilo.
  const itens: Demonstrado[] = useMemo(
    () => [
      {
        chave: "oleo",
        rotulo: "Óleo e filtros",
        sistema: "Motor BB",
        item: { intervaloHoras: 250, intervaloMeses: null, dataFixa: null, ultimoCicloData: null, ultimoCicloHoras: 1069 },
      },
      {
        // O ITEM QUE É O ASSUNTO DESTA PEÇA: as duas réguas no mesmo item.
        chave: "impelidor",
        rotulo: "Impelidor da bomba d'água",
        sistema: "Motor BE",
        item: {
          intervaloHoras: 300,
          intervaloMeses: 24,
          dataFixa: null,
          ultimoCicloData: ultimoImpelidor,
          ultimoCicloHoras: 980,
        },
      },
      {
        chave: "extintores",
        rotulo: "Recarga dos extintores",
        sistema: "Segurança",
        item: { intervaloHoras: null, intervaloMeses: null, dataFixa: extintoresEm, ultimoCicloData: null, ultimoCicloHoras: null },
      },
    ],
    [extintoresEm, ultimoImpelidor],
  )

  const calculados = useMemo(
    () =>
      itens
        .map((d) => ({ ...d, resultado: calcularSemaforo(d.item, horas, hoje) }))
        // A MESMA ordenação de `/hoje`: peso do farol primeiro. É por isso que
        // as linhas trocam de lugar quando você arrasta — não é enfeite, é o
        // app decidindo o que precisa ser visto antes.
        .sort((a, b) => PESO[b.resultado.status] - PESO[a.resultado.status]),
    [itens, horas, hoje],
  )

  const duasReguas = itens.find((d) => d.chave === "impelidor")!
  const porHoras = calcularSemaforo(soPorHoras(duasReguas.item), horas, hoje)
  const porData = calcularSemaforo(soPorData(duasReguas.item), null, hoje)
  const mandaHoras = PESO[porHoras.status] >= PESO[porData.status]

  return (
    <div>
      <label htmlFor="horas-demo" className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="rotulo text-dim">Horímetro do motor</span>
        <span className="valor-forte font-mono-instr">{horas.toLocaleString("pt-BR")} h</span>
      </label>
      {/* `accent-[var(--acao)]` e não um hexadecimal: o controle nativo pinta
          trilho e polegar pela `accent-color`, e é o token que impede o dourado
          de ser escrito à mão aqui. `h-11` porque num `range` o alvo de toque É
          o próprio elemento — a régua de 44px do docs/DESIGN.md §5 não tem
          onde se esconder. */}
      <input
        id="horas-demo"
        type="range"
        min={HORAS_MIN}
        max={HORAS_MAX}
        step={10}
        value={horas}
        onChange={(e) => setHoras(Number(e.target.value))}
        aria-describedby="vence-primeiro-veredito"
        className="mt-2 h-11 w-full cursor-pointer accent-[var(--acao)]"
      />

      {/* Lista, não grade de cartões: são três linhas do mesmo tipo de coisa, e
          o docs/DESIGN.md §1 nomeia "cartão para tudo" como assinatura de tela
          gerada. A separação é a linha de baixo — o desenho de lista do §27 do
          HAULIX. */}
      <ul className="mt-4">
        {calculados.map((c) => (
          <li key={c.chave} className="flex items-center gap-3 border-b border-line py-3 last:border-b-0">
            <div className="min-w-0 flex-1">
              <p className="valor truncate">{c.rotulo}</p>
              <p className="rotulo-dado truncate">
                {c.sistema} · {linhaDaRegra(c.item)}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="valor font-mono-instr whitespace-nowrap">{textoRestante(c.resultado)}</p>
              <div className="mt-1 flex justify-end">
                <Selo estado={seloDoFarol(c.resultado.status)}>{rotuloDoFarol(c.resultado.status)}</Selo>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <p id="vence-primeiro-veredito" aria-live="polite" className="corpo mt-4 text-dim">
        O impelidor tem duas contagens correndo:{" "}
        <span className="font-mono-instr text-texto">{textoRestante(porHoras)}</span> pelo horímetro e{" "}
        <span className="font-mono-instr text-texto">{textoRestante(porData)}</span> pelo calendário. Neste
        momento quem acende o farol é a de {mandaHoras ? "horas" : "dias"} — o Commander sempre assume a pior
        das duas.
      </p>
    </div>
  )
}
