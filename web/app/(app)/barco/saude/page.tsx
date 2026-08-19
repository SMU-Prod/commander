import { redirect } from "next/navigation"
import { Farol } from "@/components/farol"
import { Icone } from "@/components/icone"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { LinhaLista } from "@/components/ui/linha-lista"
import { carregarPainel, hojeISO, itemMonitoradoToItemCalc } from "@/lib/consultas"
import { abaDoItem } from "@/lib/domain/diario"
import { contagemDaSaude } from "@/lib/domain/inicio"
import { ESTADOS_QUE_PESAM_NA_SAUDE, ROTULO_ESTADO } from "@/lib/domain/ocorrencias"
import { ROTULO_ABA } from "@/lib/domain/permissoes"
import {
  calcularSaudeEmbarcacao,
  contarEmDiaPorAba,
  FAROL_ESTADO_SAUDE,
  ROTULO_ESTADO_SAUDE,
  type FatorSaude,
  type ItemParaSaude,
  type OcorrenciaParaSaude,
} from "@/lib/domain/saude"
import { calcularSemaforo, temInformacaoSuficiente, textoRestante, type ResultadoCalc } from "@/lib/domain/semaforo"
import { supabaseServer } from "@/lib/supabase/server"
import type { Ocorrencia } from "@/lib/db/types"

const hrefDoFator = (f: FatorSaude) =>
  f.tipo === "manutencao" ? `/barco/itens/${f.id}/editar` : `/barco/ocorrencias/${f.id}`

// A casca do cartão de estado (canvas tela-3k): a borda e a palavra ganham a
// cor do farol do estado — cor E palavra, nunca só cor (DESIGN §6, regra 3).
const CASCA_ESTADO: Record<"ok" | "atencao" | "vencido", { borda: string; texto: string }> = {
  ok: { borda: "border-ok/40", texto: "text-ok" },
  atencao: { borda: "border-warn/40", texto: "text-warn" },
  vencido: { borda: "border-crit/40", texto: "text-crit" },
}

export default async function SaudePage() {
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const { embarcacao, equipamentos, itens } = painel
  const hoje = hojeISO()

  // `resultadoPorItem` fica guardado pro subtítulo relativo da lista
  // ("vencido há 19 dias", "em 18 h") — MESMO ResultadoCalc que decide o
  // farol, formatado por `textoRestante` (semaforo.ts); nenhuma régua nova.
  const resultadoPorItem = new Map<string, ResultadoCalc>()
  const itensParaSaude: ItemParaSaude[] = itens.map((i) => {
    const eq = equipamentos.find((e) => e.id === i.equipamento_id) ?? null
    const calc = itemMonitoradoToItemCalc(i)
    const r = calcularSemaforo(calc, eq?.horas_atuais ?? null, hoje)
    resultadoPorItem.set(i.id, r)
    return {
      id: i.id,
      nome: i.nome,
      aba: abaDoItem(i, equipamentos),
      status: r.status,
      temInformacao: temInformacaoSuficiente(calc, eq?.horas_atuais ?? null),
    }
  })

  const supabase = await supabaseServer()
  // `ESTADOS_QUE_PESAM_NA_SAUDE` em vez de "tudo que não é resolvida": desde
  // a onda 44 existe também "anulada" (PRD §7), e ocorrência anulada não pode
  // continuar contando — foi declarada inexistente por escrito. A filtragem é
  // aqui, na ORIGEM: a régua e os pesos de `saude.ts` não mudam.
  const { data: ocorrenciasBrutas, error } = await supabase
    .from("ocorrencias").select("*").eq("embarcacao_id", embarcacao.id)
    .in("estado", [...ESTADOS_QUE_PESAM_NA_SAUDE]).order("created_at", { ascending: false })
  if (error) throw new Error("Não foi possível carregar a saúde da embarcação. Recarregue a página.")
  const ocorrenciasParaSaude: OcorrenciaParaSaude[] = ((ocorrenciasBrutas ?? []) as Ocorrencia[]).map((o) => ({
    id: o.id, titulo: o.titulo, aba: o.aba, estado: o.estado, gravidade: o.gravidade,
  }))
  const estadoPorOcorrencia = new Map(ocorrenciasParaSaude.map((o) => [o.id, o.estado]))

  const saude = calcularSaudeEmbarcacao(itensParaSaude, ocorrenciasParaSaude)
  const contagem = contagemDaSaude(saude, ocorrenciasParaSaude.length)
  const emDiaPorAba = contarEmDiaPorAba(itensParaSaude)
  const foraDaConta = itensParaSaude.filter((i) => !i.temInformacao).length

  // O subtítulo relativo de cada fator (canvas: "Documentos · vencido há 19
  // dias", "Motores · faltam 18 h", "Casco · ocorrência em acompanhamento").
  const subtituloDoFator = (f: FatorSaude): string => {
    if (f.tipo === "ocorrencia") {
      const estado = estadoPorOcorrencia.get(f.id)
      return `${ROTULO_ABA[f.aba]} · ocorrência ${estado ? ROTULO_ESTADO[estado].toLowerCase() : "registrada"}`
    }
    const r = resultadoPorItem.get(f.id)
    const relativo = r ? textoRestante(r) : ""
    return `${ROTULO_ABA[f.aba]} · ${relativo || f.detalhe.toLowerCase()}`
  }

  return (
    <main>
      <CabecalhoDetalhe voltarHref="/hoje" voltarRotulo="Início" titulo="Saúde" />

      {saude.estado == null ? (
        <EstadoVazio
          icone="escudo"
          titulo="Ainda sem dados suficientes"
          descricao="Cadastre motores com horas, vencimentos com data, ou registre uma ocorrência pra saber como está a embarcação."
          acao={{ href: "/barco", rotulo: "Completar em Embarcação" }}
          className="mt-6"
        />
      ) : (
        <>
          {/* Canvas tela-3k — sem anel, sem porcentagem, sem nota (PRD
              §1.1/§27.2/§28): o cartão diz a PALAVRA, com o escudo e a
              borda na cor do estado, e embaixo a contagem do que pesa —
              a mesma linha da Início (`contagemDaSaude`). Ver
              `lib/domain/saude.ts` pro histórico da decisão. */}
          <div className={`sombra-1 mt-6 rounded-[var(--raio-cartao)] border bg-panel p-4 ${CASCA_ESTADO[FAROL_ESTADO_SAUDE[saude.estado]].borda}`}>
            <div className="flex items-center gap-2.5">
              <Icone nome="escudo" className={`size-5 shrink-0 ${CASCA_ESTADO[FAROL_ESTADO_SAUDE[saude.estado]].texto}`} />
              <p className={`text-lg font-semibold leading-tight ${CASCA_ESTADO[FAROL_ESTADO_SAUDE[saude.estado]].texto}`}>
                {ROTULO_ESTADO_SAUDE[saude.estado]}
              </p>
            </div>
            <p className="corpo mt-2.5 text-dim">
              {contagem && (
                <>
                  {contagem.map((p, i) => (
                    <span key={p.rotulo}>
                      {i > 0 && " · "}
                      <span className="font-mono-instr tabular-nums text-texto">{p.numero}</span> {p.rotulo}
                    </span>
                  ))}
                  {". "}
                </>
              )}
              O pior estado prevalece — não existe nota nem porcentagem aqui.
            </p>
          </div>
          <p className="apoio mt-2 text-dim">
            É um retrato do que está registrado no Commander — não é declaração de navegabilidade.
          </p>

          {saude.fatores.length === 0 ? (
            <div className="sombra-1 mt-4 rounded-[var(--raio-cartao)] border border-line bg-panel p-4 corpo text-dim">
              Nada pendente agora. Bom vento e mar calmo.
            </div>
          ) : (
            <>
              {/* PRD §3.4: ordenado por criticidade. Quem ordena é
                  `calcularSaudeEmbarcacao` (crítico primeiro, depois peso da
                  área × severidade) — a tela só desenha a lista na ordem que
                  recebeu, num painel único (canvas tela-3k); o farol diz a
                  cor, o subtítulo diz o prazo. */}
              <p className="rotulo mt-6 mb-2 text-dim">
                O que pesa hoje — <span className="tabular-nums">{saude.fatores.length}</span>
              </p>
              <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
                {saude.fatores.map((f) => (
                  <LinhaLista
                    key={`${f.tipo}-${f.id}`}
                    href={hrefDoFator(f)}
                    leading={<Farol status={f.farol} />}
                    titulo={f.nome}
                    subtitulo={subtituloDoFator(f)}
                  />
                ))}
              </div>
            </>
          )}

          {(emDiaPorAba.length > 0 || foraDaConta > 0) && (
            <>
              {emDiaPorAba.length > 0 && (
                <p className="rotulo mt-6 mb-2 text-dim">
                  Em dia — <span className="tabular-nums">{saude.emDia}</span>
                </p>
              )}
              <div className={`sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-3.5 ${emDiaPorAba.length === 0 ? "mt-6" : ""}`}>
                {emDiaPorAba.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {emDiaPorAba.map((c) => (
                      <span key={c.aba} className="flex items-center gap-1.5 rounded-[var(--raio-pilula)] border border-line px-3 py-1.5">
                        <span aria-hidden="true" className="size-1.5 rounded-[var(--raio-pilula)] bg-ok" />
                        <span className="apoio text-dim">
                          {ROTULO_ABA[c.aba]} <span className="font-mono-instr tabular-nums text-texto">{c.quantidade}</span>
                        </span>
                      </span>
                    ))}
                  </div>
                )}
                {foraDaConta > 0 && (
                  <p className={`apoio text-dim ${emDiaPorAba.length > 0 ? "mt-3" : ""}`}>
                    {foraDaConta === 1
                      ? "1 item ficou fora da conta por não ter intervalo ou leitura informada."
                      : `${foraDaConta} itens ficaram fora da conta por não ter intervalo ou leitura informada.`}
                  </p>
                )}
              </div>
            </>
          )}
        </>
      )}
    </main>
  )
}
