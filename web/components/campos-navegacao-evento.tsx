"use client"
import { useMemo, useState } from "react"
import { Icone } from "@/components/icone"
import { duracaoHoras, textoDuracao } from "@/lib/domain/bordo"

const campo = "w-full rounded-[10px] border border-line bg-campo px-3 py-3 text-base"
const rotulo = "mb-1.5 block font-mono-instr text-[11px] uppercase tracking-[.14em] text-dim"

const TIPOS = [
  ["manutencao", "Manutenção"], ["abastecimento", "Abastecimento"], ["navegacao", "Navegação"],
  ["avaria", "Avaria"], ["docagem", "Docagem"], ["outro", "Outro"],
] as const

/** Pequeno pedaço client do formulário de evento — só o suficiente pra
 *  alternar os campos de saida (quando tipo = navegacao) e mostrar a duracao
 *  ao vivo. O resto do formulario (em novo/page.tsx) continua 100% server. */
export function CamposNavegacaoEvento({
  tipoInicial,
  dataInicial,
  tripulacao,
}: {
  tipoInicial: string
  dataInicial: string
  tripulacao: { id: string; nome: string }[]
}) {
  const [tipo, setTipo] = useState(tipoInicial)
  const [horaSaida, setHoraSaida] = useState("")
  const [horaRetorno, setHoraRetorno] = useState("")

  const duracao = useMemo(
    () => duracaoHoras(horaSaida || null, horaRetorno || null),
    [horaSaida, horaRetorno],
  )

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={rotulo} htmlFor="tipo">Tipo</label>
          <select
            id="tipo"
            name="tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className={campo}
          >
            {TIPOS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className={rotulo} htmlFor="data">Data</label>
          <input id="data" name="data" type="date" defaultValue={dataInicial} className={campo} />
        </div>
      </div>

      {tipo === "navegacao" && (
        <div className="space-y-4 rounded-[14px] border border-line bg-panel2 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={rotulo} htmlFor="hora_saida">Hora de saída</label>
              <input
                id="hora_saida"
                name="hora_saida"
                type="time"
                value={horaSaida}
                onChange={(e) => setHoraSaida(e.target.value)}
                className={`${campo} font-mono-instr tabular-nums`}
              />
            </div>
            <div>
              <label className={rotulo} htmlFor="hora_retorno">Hora de retorno</label>
              <input
                id="hora_retorno"
                name="hora_retorno"
                type="time"
                value={horaRetorno}
                onChange={(e) => setHoraRetorno(e.target.value)}
                className={`${campo} font-mono-instr tabular-nums`}
              />
            </div>
          </div>

          {duracao != null && (
            <p className="flex items-center gap-1.5 font-mono-instr text-sm tabular-nums text-dim">
              <Icone nome="relogio" className="size-4" /> Duração: {textoDuracao(duracao)}
            </p>
          )}

          <div>
            <label className={rotulo} htmlFor="destino">Destino</label>
            <input id="destino" name="destino" placeholder="Ex.: Ilha de Búzios" className={campo} />
          </div>

          {tripulacao.length > 0 && (
            <div>
              <p className={rotulo}>Tripulação a bordo</p>
              <div className="grid grid-cols-2 gap-2">
                {tripulacao.map((p) => (
                  <label
                    key={p.id}
                    className="flex min-h-11 items-center gap-2 rounded-[10px] border border-line bg-campo px-3 py-2 text-sm"
                  >
                    <input type="checkbox" name="tripulacao" value={p.id} className="size-4" />
                    {p.nome}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}
