"use client"
import Link from "next/link"
import { useMemo, useState } from "react"
import { Icone, type NomeIcone } from "@/components/icone"
import type { Equipamento, ItemMonitorado } from "@/lib/db/types"
import { duracaoHoras, retornoNoDiaSeguinte, textoDuracao } from "@/lib/domain/bordo"
import { CATEGORIAS_CASCO, nomeDoEquipamento, ROTULO_CASCO } from "@/lib/domain/diario"

const campo = "w-full rounded-[10px] border border-line bg-campo px-3 py-3 text-base"
const rotulo = "mb-1.5 block font-mono-instr text-[11px] uppercase tracking-[.14em] text-dim"

const TIPOS: { valor: string; rotulo: string; icone: NomeIcone }[] = [
  { valor: "manutencao", rotulo: "Manutenção", icone: "ferramenta" },
  { valor: "abastecimento", rotulo: "Abastecimento", icone: "oleo" },
  { valor: "navegacao", rotulo: "Navegação", icone: "mapa" },
  { valor: "avaria", rotulo: "Avaria", icone: "alerta" },
  { valor: "docagem", rotulo: "Docagem", icone: "ancora" },
  { valor: "outro", rotulo: "Outro", icone: "mais" },
]

// Os tipos "leves": o mínimo pra registrar é onde + o que houve + custo +
// anexo. Abastecimento entra no custo/anexo mas não tem "onde" (não faz
// sentido perguntar sistema pra um reabastecimento) nem em Navegação (que
// tem seus próprios campos de saída, nada disso).
const TIPOS_COM_ONDE = new Set(["manutencao", "avaria", "docagem", "outro"])
const TIPOS_COM_CUSTO_ANEXO = new Set(["manutencao", "abastecimento", "avaria", "docagem", "outro"])
// Zerar o ciclo não é exclusivo de "Manutenção": uma docagem renova a pintura
// de fundo, um conserto de avaria renova o item consertado. Prender a pergunta
// a um tipo só fazia o app seguir avisando vencimento de serviço já feito.
const TIPOS_COM_RENOVACAO = new Set(["manutencao", "docagem", "avaria"])
// Abastecer é o momento mais natural pra anotar o horímetro depois de navegar.
const TIPOS_COM_HORAS = new Set(["manutencao", "abastecimento"])

const DESCRICAO_POR_TIPO: Record<string, { rotulo: string; placeholder: string }> = {
  manutencao: { rotulo: "O que foi feito?", placeholder: "Ex.: troca de óleo e filtros" },
  abastecimento: { rotulo: "Quantos litros / detalhes", placeholder: "Ex.: 120 litros de diesel" },
  avaria: { rotulo: "Descrição", placeholder: "Ex.: rachadura no casco de fibra" },
  docagem: { rotulo: "Descrição", placeholder: "Ex.: pintura de fundo e troca de ânodos" },
  outro: { rotulo: "Descrição", placeholder: "Ex.: o que aconteceu" },
}

const campoAnexo = (
  <div>
    <label className={rotulo} htmlFor="anexo">Anexo (NF, relatório, foto) — opcional, até 10 MB</label>
    <input id="anexo" name="anexo" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className={`${campo} py-2.5 text-sm`} />
  </div>
)

/** O formulário inteiro de "Novo registro" — client porque tudo, a partir do
 *  tipo escolhido, decide o que mais aparece na tela. Antes eram 9 campos de
 *  uma vez (nove!) pra qualquer tipo; agora só os que fazem sentido pro que
 *  a pessoa apontou em "O que aconteceu?". */
export function FormularioNovoEvento({
  tipoInicial,
  dataInicial,
  tripulacao,
  equipamentos,
  itens,
  contatos,
  alvoInicial,
  itemInicial,
  custoInicial,
}: {
  tipoInicial: string | null
  dataInicial: string
  tripulacao: { id: string; nome: string }[]
  equipamentos: Equipamento[]
  itens: ItemMonitorado[]
  contatos: { id: string; nome: string; especialidade: string | null }[]
  alvoInicial: string
  itemInicial: string
  custoInicial: string
}) {
  const [tipo, setTipo] = useState<string | null>(tipoInicial)
  const [horaSaida, setHoraSaida] = useState("")
  const [horaRetorno, setHoraRetorno] = useState("")

  const duracao = useMemo(
    () => duracaoHoras(horaSaida || null, horaRetorno || null),
    [horaSaida, horaRetorno],
  )

  // Estado inicial honesto: sem motor cadastrado, "horas do motor agora" não
  // existe pra essa embarcação — não perguntamos o que ela não tem como
  // responder.
  const temMotor = equipamentos.some((e) => e.tipo === "motor")

  const nomeDoAlvo = (id: string | null) => {
    const eq = equipamentos.find((e) => e.id === id)
    return eq ? nomeDoEquipamento(eq) : ""
  }

  const mostraOnde = tipo != null && TIPOS_COM_ONDE.has(tipo)
  const mostraDescricao = tipo != null && tipo !== "navegacao"
  const mostraCustoAnexo = tipo != null && TIPOS_COM_CUSTO_ANEXO.has(tipo)
  const mostraMaisDetalhes = tipo === "manutencao"

  return (
    <>
      <div>
        <p className={rotulo}>O que aconteceu?</p>
        <div className="mt-2 grid grid-cols-2 gap-3">
          {TIPOS.map((t) => {
            const selecionado = tipo === t.valor
            return (
              <button
                key={t.valor}
                type="button"
                aria-pressed={selecionado}
                onClick={() => setTipo(t.valor)}
                className={`flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-[14px] border px-3 py-4 text-sm font-medium ${
                  selecionado ? "border-accent-forte bg-accent/10 text-accent-forte" : "border-line bg-panel2 text-dim"
                }`}
              >
                <Icone nome={t.icone} className="size-6" />
                {t.rotulo}
              </button>
            )
          })}
        </div>
      </div>

      {tipo && (
        <>
          <input type="hidden" name="tipo" value={tipo} />

          <div>
            <label className={rotulo} htmlFor="data">Data</label>
            <input id="data" name="data" type="date" defaultValue={dataInicial} className={campo} />
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
                  {/* sem dizer isso em voz alta, "22:00 → 01:30 = 3 h 30" parece
                      conta errada — e uma travessia de MAIS de um dia sai
                      subestimada sem ninguém perceber */}
                  {retornoNoDiaSeguinte(horaSaida || null, horaRetorno || null) && (
                    <span className="corpo text-warn">· retorno no dia seguinte</span>
                  )}
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

              {/* a saída também merece um campo livre: "mar grosso na volta",
                  "parei em Angra pra almoçar". Sem isso, navegação era o único
                  tipo sem nenhum lugar para escrever o que aconteceu. */}
              <div>
                <label className={rotulo} htmlFor="descricao-nav">Observações — opcional</label>
                <input id="descricao-nav" name="descricao" placeholder="Ex.: mar grosso na volta" className={campo} />
              </div>
            </div>
          )}

          {mostraOnde && (
            <div>
              <label className={rotulo} htmlFor="alvo">Onde no barco?</label>
              <select id="alvo" name="alvo" defaultValue={alvoInicial} className={campo}>
                <optgroup label="Embarcação">
                  <option value="">Embarcação (geral)</option>
                </optgroup>
                {/* separa de verdade: o barco pode ter gerador e baterias
                    (fluxo real em /barco/eletrica), e listá-los sob "Motores"
                    era rótulo errado */}
                {equipamentos.some((e) => e.tipo === "motor") && (
                  <optgroup label="Motores">
                    {equipamentos.filter((e) => e.tipo === "motor").map((e) => (
                      <option key={e.id} value={`eq:${e.id}`}>{nomeDoEquipamento(e)}</option>
                    ))}
                  </optgroup>
                )}
                {equipamentos.some((e) => e.tipo !== "motor") && (
                  <optgroup label="Elétrica">
                    {equipamentos.filter((e) => e.tipo !== "motor").map((e) => (
                      <option key={e.id} value={`eq:${e.id}`}>{nomeDoEquipamento(e)}</option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Casco">
                  {CATEGORIAS_CASCO.map((c) => (
                    <option key={c} value={`cat:${c}`}>{ROTULO_CASCO[c]}</option>
                  ))}
                </optgroup>
                <optgroup label="Documentos">
                  <option value="cat:documento">Documentos</option>
                </optgroup>
              </select>
            </div>
          )}

          {mostraDescricao && (
            <div>
              <label className={rotulo} htmlFor="descricao">{DESCRICAO_POR_TIPO[tipo]?.rotulo ?? "Descrição"}</label>
              <input
                id="descricao"
                name="descricao"
                placeholder={DESCRICAO_POR_TIPO[tipo]?.placeholder}
                className={campo}
              />
            </div>
          )}

          {TIPOS_COM_RENOVACAO.has(tipo) && itens.length > 0 && (
            <div>
              <label className={rotulo} htmlFor="item_id">Isso renova alguma manutenção? (opcional)</label>
              <p className="mb-1.5 apoio text-dim">
                Escolha a manutenção que passa a valer a partir de hoje — ex.: a troca de óleo.
              </p>
              <select id="item_id" name="item_id" defaultValue={itemInicial} className={campo}>
                <option value="">Nenhuma</option>
                {itens.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nome}{i.equipamento_id ? ` — ${nomeDoAlvo(i.equipamento_id)}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {mostraCustoAnexo && (
            TIPOS_COM_HORAS.has(tipo) && temMotor ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={rotulo} htmlFor="custo">Custo (R$) — opcional</label>
                  <input id="custo" name="custo" inputMode="decimal" defaultValue={custoInicial} placeholder="1.850,00" className={`${campo} font-mono-instr tabular-nums`} />
                </div>
                <div>
                  <label className={rotulo} htmlFor="horas">Horas do motor agora — opcional</label>
                  <input id="horas" name="horas" inputMode="decimal" className={`${campo} font-mono-instr tabular-nums`} />
                </div>
              </div>
            ) : (
              <div>
                <label className={rotulo} htmlFor="custo">Custo (R$) — opcional</label>
                <input id="custo" name="custo" inputMode="decimal" defaultValue={custoInicial} placeholder="1.850,00" className={`${campo} font-mono-instr tabular-nums`} />
              </div>
            )
          )}

          {mostraCustoAnexo && !mostraMaisDetalhes && campoAnexo}

          {mostraMaisDetalhes && (
            <details className="group rounded-[14px] border border-line bg-panel2">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 py-3 [&::-webkit-details-marker]:hidden">
                <span className={rotulo}>Mais detalhes</span>
                <Icone nome="chevron" className="size-4 shrink-0 text-dim transition-transform group-open:rotate-90" />
              </summary>
              <div className="space-y-4 border-t border-line p-4">
                <div>
                  <label className={rotulo} htmlFor="contato_id">Prestador (opcional)</label>
                  {contatos.length > 0 ? (
                    <select id="contato_id" name="contato_id" defaultValue="" className={campo}>
                      <option value="">Nenhum</option>
                      {contatos.map((c) => (
                        <option key={c.id} value={c.id}>{c.nome}{c.especialidade ? ` — ${c.especialidade}` : ""}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="corpo text-dim">
                      Nenhum prestador cadastrado ainda. <Link href="/barco/contatos" className="text-accent-forte">Cadastrar</Link>
                    </p>
                  )}
                </div>
                {campoAnexo}
              </div>
            </details>
          )}

          <button className="w-full rounded-xl bg-accent py-3.5 font-semibold text-acao-texto">
            Registrar no diário
          </button>
        </>
      )}
    </>
  )
}
