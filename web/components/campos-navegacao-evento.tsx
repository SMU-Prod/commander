"use client"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { ChecklistDiario } from "@/components/checklist-diario"
import { Icone, type NomeIcone } from "@/components/icone"
import { Campo, CampoSelect } from "@/components/ui/campo"
import type { Equipamento, ItemMonitorado } from "@/lib/db/types"
import { duracaoHoras, retornoNoDiaSeguinte, textoDuracao } from "@/lib/domain/bordo"
import {
  CATEGORIA_SEGURANCA, CATEGORIAS_CASCO, CATEGORIAS_HIDRAULICA,
  nomeDoEquipamento, ROTULO_CASCO, ROTULO_HIDRAULICA,
} from "@/lib/domain/diario"

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
  <Campo
    label="Anexo (NF, relatório, foto) — opcional, até 10 MB"
    id="anexo"
    name="anexo"
    type="file"
    accept="application/pdf,image/jpeg,image/png,image/webp"
    className="py-2.5 text-sm"
  />
)

/** O formulário inteiro de "Novo registro" — client porque tudo, a partir do
 *  tipo escolhido, decide o que mais aparece na tela. Antes eram 9 campos de
 *  uma vez (nove!) pra qualquer tipo; agora só os que fazem sentido pro que
 *  a pessoa apontou em "O que aconteceu?". */
export function FormularioNovoEvento({
  tipoInicial,
  tipoFixo = false,
  dataInicial,
  tripulacao,
  equipamentos,
  itens,
  contatos,
  alvoInicial,
  itemInicial,
  custoInicial,
  descricaoInicial = "",
  horasInicial = "",
  contatoInicial = "",
}: {
  tipoInicial: string | null
  /** A tela chegou já sabendo o tipo (ex.: "Registrar saída" da Início,
   *  canvas tela-3b) — o seletor de 6 cartões não aparece; o título da
   *  página é quem diz o que se está registrando. */
  tipoFixo?: boolean
  dataInicial: string
  tripulacao: { id: string; nome: string }[]
  equipamentos: Equipamento[]
  itens: ItemMonitorado[]
  contatos: { id: string; nome: string; especialidade: string | null }[]
  alvoInicial: string
  itemInicial: string
  custoInicial: string
  descricaoInicial?: string
  horasInicial?: string
  contatoInicial?: string
}) {
  const router = useRouter()
  const [tipo, setTipo] = useState<string | null>(tipoInicial)
  const [horaSaida, setHoraSaida] = useState("")
  const [horaRetorno, setHoraRetorno] = useState("")

  // "Cadastrar" (prestador) navegava embora e apagava tudo que já tinha sido
  // digitado — não tinha volta. Em vez de um <Link> mudo, lê os campos do
  // form (pelo FormData, sem precisar de estado controlado extra por campo)
  // e leva junto na querystring — mesmo padrão que `alvo`/`item`/`custo` já
  // usam pra chegar pré-preenchidos vindos da ficha do equipamento.
  function irCadastrarContato(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault()
    const form = e.currentTarget.closest("form")
    const params = new URLSearchParams()
    if (form) {
      const dados = new FormData(form)
      // nome do campo no form -> nome do parametro que /diario/novo le de volta
      // (so "item_id" diverge — o form usa o nome da coluna, a URL usa "item",
      // igual o link que ja chega da ficha do equipamento).
      const CAMPO_PARA_PARAM: Record<string, string> = {
        tipo: "tipo", data: "data", alvo: "alvo", descricao: "descricao",
        item_id: "item", custo: "custo", horas: "horas",
      }
      for (const [campo, param] of Object.entries(CAMPO_PARA_PARAM)) {
        const v = dados.get(campo)
        if (v != null && String(v) !== "") params.set(param, String(v))
      }
    }
    const query = params.toString()
    const voltaPara = query ? `/diario/novo?${query}` : "/diario/novo"
    router.push(`/barco/contatos?volta=${encodeURIComponent(voltaPara)}`)
  }

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
      {/* Chegando pelo botão "Registrar saída" (canvas tela-3b) o tipo é
          FIXO e a tela é do formulário — os 6 cartões só existem no "Novo
          registro" genérico. */}
      {!tipoFixo && (
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
                    selecionado ? "border-accent-forte bg-accent/10 text-accent-forte" : "border-line bg-panel2 text-dim-chip"
                  }`}
                >
                  <Icone nome={t.icone} className="size-6" />
                  {t.rotulo}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {tipo && (
        <>
          <input type="hidden" name="tipo" value={tipo} />

          {/* Na saída a data entra na fileira Data · Saída · Retorno abaixo
              (canvas tela-3b); nos demais tipos segue campo próprio. */}
          {tipo !== "navegacao" && (
            <Campo label="Data" id="data" name="data" type="date" defaultValue={dataInicial} />
          )}

          {tipo === "navegacao" && (
            /* ONDA 62 — a anatomia do canvas (tela-3b): os campos correm
               soltos na página, sem painel dentro de painel; Data, Saída e
               Retorno dividem UMA fileira em mono tabular — horário é
               leitura de instrumento, e ninguém deve errar dígito com o
               barco balançando. */
            <div className="space-y-3.5">
              {/* A célula da data leva um fio a mais de largura: o <input
                  type="date"> nativo desenha "16/08/2026" + o ícone de
                  calendário, e em três colunas iguais a 390px o ano era
                  cortado no meio. */}
              <div className="grid grid-cols-[1.25fr_1fr_1fr] gap-2.5">
                <Campo
                  label="Data"
                  id="data"
                  name="data"
                  type="date"
                  defaultValue={dataInicial}
                  className="font-mono-instr tabular-nums"
                />
                <Campo
                  label="Saída"
                  id="hora_saida"
                  name="hora_saida"
                  type="time"
                  value={horaSaida}
                  onChange={(e) => setHoraSaida(e.target.value)}
                  className="font-mono-instr tabular-nums"
                />
                <Campo
                  label="Retorno"
                  id="hora_retorno"
                  name="hora_retorno"
                  type="time"
                  value={horaRetorno}
                  onChange={(e) => setHoraRetorno(e.target.value)}
                  className="font-mono-instr tabular-nums"
                />
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

              <div className="grid grid-cols-2 gap-2.5">
                <Campo label="Local de saída" id="local_saida" name="local_saida" placeholder="Ex.: Marina da Glória" />
                <Campo label="Destino" id="destino" name="destino" placeholder="Ex.: Ilha de Búzios" />
              </div>

              {tripulacao.length > 0 && (
                <div>
                  <p className={rotulo}>Tripulação a bordo</p>
                  <div className="grid grid-cols-2 gap-2">
                    {tripulacao.map((p) => (
                      <label
                        key={p.id}
                        className="flex min-h-11 items-center gap-2 rounded-[var(--raio-controle)] border border-line bg-campo px-3 py-2 text-sm"
                      >
                        <input type="checkbox" name="tripulacao" value={p.id} className="size-4" />
                        {p.nome}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Passageiros (PRD §23) é campo separado da tripulação de
                  propósito: tripulante tem conta no app e vínculo com o
                  barco, passageiro é só um nome digitado — convidado,
                  família, cliente. Por ser nome de terceiro, é dado pessoal
                  e o PRD §27 manda NÃO levar numa transferência de
                  propriedade (quem apaga é `aceitar_transferencia`). */}
              <Campo
                label="Passageiros — opcional"
                id="passageiros"
                name="passageiros"
                placeholder="Nomes separados por vírgula"
              />

              {/* a saída também merece um campo livre: "mar grosso na volta",
                  "parei em Angra pra almoçar". Sem isso, navegação era o único
                  tipo sem nenhum lugar para escrever o que aconteceu. */}
              <Campo label="Observações — opcional" id="descricao-nav" name="descricao" placeholder="Ex.: mar grosso na volta" />

              {/* Checklist rápido por hub (onda 40, PRD §23) — substitui o
                  antigo seletor de um setor só: "Motores/Casco/Elétrica/
                  Hidráulica/Segurança — ✓ OK / observação" + atalho "OK
                  GERAL". Uma observação marcada como problema nasce
                  ocorrência já vinculada ao setor certo ao salvar (onda 32,
                  mesmo `inserirOcorrenciaDoDiario` de sempre) — sem obrigar a
                  pessoa a tocar em nada quando não aconteceu nada. */}
              <details className="group rounded-[14px] border border-line bg-panel">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 py-3 [&::-webkit-details-marker]:hidden">
                  <span className={rotulo}>Checklist rápido dos hubs — opcional</span>
                  <Icone nome="chevron" className="size-4 shrink-0 text-dim transition-transform group-open:rotate-90" />
                </summary>
                <div className="border-t border-line p-4">
                  <ChecklistDiario />
                </div>
              </details>
            </div>
          )}

          {mostraOnde && (
            <CampoSelect label="Onde no barco?" id="alvo" name="alvo" defaultValue={alvoInicial}>
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
              {equipamentos.some((e) => e.tipo === "gerador" || e.tipo === "bateria") && (
                <optgroup label="Elétrica">
                  {equipamentos.filter((e) => e.tipo === "gerador" || e.tipo === "bateria").map((e) => (
                    <option key={e.id} value={`eq:${e.id}`}>{nomeDoEquipamento(e)}</option>
                  ))}
                </optgroup>
              )}
              <optgroup label="Casco">
                {CATEGORIAS_CASCO.map((c) => (
                  <option key={c} value={`cat:${c}`}>{ROTULO_CASCO[c]}</option>
                ))}
              </optgroup>
              <optgroup label="Hidráulica">
                {CATEGORIAS_HIDRAULICA.map((c) => (
                  <option key={c} value={`cat:${c}`}>{ROTULO_HIDRAULICA[c]}</option>
                ))}
              </optgroup>
              <optgroup label="Segurança">
                <option value={`cat:${CATEGORIA_SEGURANCA}`}>Segurança</option>
              </optgroup>
              {equipamentos.some((e) => e.tipo === "outro") && (
                <optgroup label="Equipamentos">
                  {equipamentos.filter((e) => e.tipo === "outro").map((e) => (
                    <option key={e.id} value={`eq:${e.id}`}>{nomeDoEquipamento(e)}</option>
                  ))}
                </optgroup>
              )}
              <optgroup label="Documentos">
                <option value="cat:documento">Documentos</option>
              </optgroup>
            </CampoSelect>
          )}

          {mostraDescricao && (
            <Campo
              label={DESCRICAO_POR_TIPO[tipo]?.rotulo ?? "Descrição"}
              id="descricao"
              name="descricao"
              defaultValue={descricaoInicial}
              placeholder={DESCRICAO_POR_TIPO[tipo]?.placeholder}
            />
          )}

          {TIPOS_COM_RENOVACAO.has(tipo) && itens.length > 0 && (
            <CampoSelect
              label="Isso renova alguma manutenção? (opcional)"
              id="item_id"
              name="item_id"
              defaultValue={itemInicial}
              dica="Escolha a manutenção que passa a valer a partir de hoje — ex.: a troca de óleo."
            >
              <option value="">Nenhuma</option>
              {itens.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nome}{i.equipamento_id ? ` — ${nomeDoAlvo(i.equipamento_id)}` : ""}
                </option>
              ))}
            </CampoSelect>
          )}

          {mostraCustoAnexo && (
            TIPOS_COM_HORAS.has(tipo) && temMotor ? (
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Custo (R$) — opcional" id="custo" name="custo" inputMode="decimal" defaultValue={custoInicial} placeholder="1.850,00" className="font-mono-instr tabular-nums" />
                <Campo label="Horas do motor agora — opcional" id="horas" name="horas" inputMode="decimal" defaultValue={horasInicial} className="font-mono-instr tabular-nums" />
              </div>
            ) : (
              <Campo label="Custo (R$) — opcional" id="custo" name="custo" inputMode="decimal" defaultValue={custoInicial} placeholder="1.850,00" className="font-mono-instr tabular-nums" />
            )
          )}

          {mostraCustoAnexo && !mostraMaisDetalhes && campoAnexo}

          {mostraMaisDetalhes && (
            <details className="group rounded-[14px] border border-line bg-panel2" open={contatoInicial !== ""}>
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 py-3 [&::-webkit-details-marker]:hidden">
                <span className={rotulo}>Mais detalhes</span>
                <Icone nome="chevron" className="size-4 shrink-0 text-dim transition-transform group-open:rotate-90" />
              </summary>
              <div className="space-y-4 border-t border-line p-4">
                <div>
                  {contatos.length > 0 ? (
                    <>
                      <CampoSelect label="Prestador (opcional)" id="contato_id" name="contato_id" defaultValue={contatoInicial}>
                        <option value="">Nenhum</option>
                        {contatos.map((c) => (
                          <option key={c.id} value={c.id}>{c.nome}{c.especialidade ? ` — ${c.especialidade}` : ""}</option>
                        ))}
                      </CampoSelect>
                      <p className="mt-1.5 apoio text-dim">
                        Não achou quem procurava? <a href="/barco/contatos" onClick={irCadastrarContato} className="text-accent-forte">Cadastrar</a>
                      </p>
                    </>
                  ) : (
                    <>
                      <p className={rotulo}>Prestador (opcional)</p>
                      <p className="corpo mt-1.5 text-dim">
                        Nenhum prestador cadastrado ainda. <a href="/barco/contatos" onClick={irCadastrarContato} className="text-accent-forte">Cadastrar</a>
                      </p>
                    </>
                  )}
                </div>
                {campoAnexo}
              </div>
            </details>
          )}

          {/* 48px, raio de controle (8px) e 15px — o botão do canvas
              (tela-3b). Era `rounded-xl` (12px), um quarto raio fora da
              escala de três do DESIGN §5. A saída fala "Salvar saída", como
              no canvas; os demais tipos seguem com o verbo genérico. */}
          <button className="h-12 w-full rounded-[var(--raio-controle)] bg-accent text-[15px] font-semibold text-acao-texto">
            {tipo === "navegacao" ? "Salvar saída" : "Registrar no diário"}
          </button>
        </>
      )}
    </>
  )
}
