"use client"
import { useState } from "react"
import {
  HUBS_CHECKLIST_DIARIO, ROTULO_HUB_CHECKLIST, type EstadoChecklistHub, type HubChecklistDiario,
} from "@/lib/domain/checklist-diario"

type LinhaEstado = { estado: EstadoChecklistHub | null; nota: string; ocorrencia: boolean }
type Estados = Record<HubChecklistDiario, LinhaEstado>

function estadoInicial(): Estados {
  return Object.fromEntries(
    HUBS_CHECKLIST_DIARIO.map((h) => [h, { estado: null, nota: "", ocorrencia: false }]),
  ) as Estados
}

const botaoEstado = (ativo: boolean, cor: "ok" | "warn") =>
  `min-h-11 min-w-11 rounded-[var(--raio-pilula)] border px-3 py-1 text-xs font-medium ${
    ativo
      ? cor === "ok" ? "border-ok bg-ok/10 text-ok" : "border-warn bg-warn/10 text-warn"
      : "border-line text-dim"
  }`

/**
 * Checklist rápido do Diário por hub (onda 40, PRD §23) — vive dentro do
 * fecho de uma saída, ao lado dos outros campos opcionais. "OK GERAL" resolve
 * o caso comum (nada aconteceu) num toque; tocar um hub por vez é só pra quem
 * tem algo pra registrar NAQUELE hub — os outros não entram no envio (um hub
 * não tocado nunca vira "OK" inventado, ver `lerChecklistDoFormulario` em
 * `lib/domain/checklist-diario.ts`, que lê exatamente os
 * `checklist_<hub>_estado`/`_nota`/`_ocorrencia` que este componente
 * emite como inputs — visíveis quando editáveis, ocultos quando só
 * espelham o estado já escolhido nos botões acima).
 *
 * "Isso é um problema — abrir ocorrência" reusa o mesmo caminho que já
 * existe desde a onda 32 (`inserirOcorrenciaDoDiario`, chamado em
 * `lib/acoes/eventos.ts`) — este componente só entrega os dados; quem decide
 * criar a ocorrência é o server action.
 */
export function ChecklistDiario() {
  const [estados, setEstados] = useState<Estados>(estadoInicial)

  function tudoOk() {
    setEstados(
      Object.fromEntries(
        HUBS_CHECKLIST_DIARIO.map((h) => [h, { estado: "ok" as const, nota: "", ocorrencia: false }]),
      ) as Estados,
    )
  }

  function definirEstado(hub: HubChecklistDiario, estado: EstadoChecklistHub) {
    setEstados((prev) => ({ ...prev, [hub]: { ...prev[hub], estado } }))
  }

  function atualizarNota(hub: HubChecklistDiario, nota: string) {
    setEstados((prev) => ({ ...prev, [hub]: { ...prev[hub], nota } }))
  }

  function alternarOcorrencia(hub: HubChecklistDiario, ocorrencia: boolean) {
    setEstados((prev) => ({ ...prev, [hub]: { ...prev[hub], ocorrencia } }))
  }

  const todosOk = HUBS_CHECKLIST_DIARIO.every((h) => estados[h].estado === "ok")
  const algumTocado = HUBS_CHECKLIST_DIARIO.some((h) => estados[h].estado !== null)

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={tudoOk}
        className={`flex min-h-11 w-full items-center justify-center rounded-[var(--raio-controle)] border px-3 py-2.5 text-sm font-semibold ${
          todosOk ? "border-ok bg-ok/10 text-ok" : "border-line bg-panel2 text-texto"
        }`}
      >
        {todosOk ? "✓ Tudo OK" : "✓ OK GERAL — motores, casco, elétrica, hidráulica, segurança"}
      </button>

      <div className="divide-y divide-line rounded-[var(--raio-cartao)] border border-line bg-panel">
        {HUBS_CHECKLIST_DIARIO.map((hub) => {
          const linha = estados[hub]
          return (
            <div key={hub} className="p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="corpo font-medium">{ROTULO_HUB_CHECKLIST[hub]}</p>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    aria-pressed={linha.estado === "ok"}
                    onClick={() => definirEstado(hub, "ok")}
                    className={botaoEstado(linha.estado === "ok", "ok")}
                  >
                    OK
                  </button>
                  <button
                    type="button"
                    aria-pressed={linha.estado === "observacao"}
                    onClick={() => definirEstado(hub, "observacao")}
                    className={botaoEstado(linha.estado === "observacao", "warn")}
                  >
                    Observação
                  </button>
                </div>
              </div>

              {linha.estado === "observacao" && (
                <div className="mt-2.5 space-y-2">
                  <textarea
                    value={linha.nota}
                    onChange={(e) => atualizarNota(hub, e.target.value)}
                    placeholder={`O que aconteceu em ${ROTULO_HUB_CHECKLIST[hub]}?`}
                    rows={2}
                    className="w-full rounded-[var(--raio-controle)] border border-line bg-campo px-3 py-2 text-sm"
                  />
                  <label className="flex min-h-11 items-center gap-2 text-sm text-dim">
                    <input
                      type="checkbox"
                      checked={linha.ocorrencia}
                      onChange={(e) => alternarOcorrencia(hub, e.target.checked)}
                      className="size-4"
                    />
                    Isso é um problema — abrir ocorrência em {ROTULO_HUB_CHECKLIST[hub]}
                  </label>
                </div>
              )}

              {/* Estado sempre viaja no form (mesmo "" quando ninguém tocou —
                  o server action ignora hub sem estado reconhecido). Nota e
                  ocorrência só existem quando há algo a dizer. */}
              <input type="hidden" name={`checklist_${hub}_estado`} value={linha.estado ?? ""} />
              {linha.estado === "observacao" && (
                <>
                  <input type="hidden" name={`checklist_${hub}_nota`} value={linha.nota} />
                  {linha.ocorrencia && <input type="hidden" name={`checklist_${hub}_ocorrencia`} value="1" />}
                </>
              )}
            </div>
          )
        })}
      </div>

      {algumTocado && !todosOk && (
        <p className="apoio text-dim">Só os hubs marcados entram no registro — o resto fica como está.</p>
      )}
    </div>
  )
}
