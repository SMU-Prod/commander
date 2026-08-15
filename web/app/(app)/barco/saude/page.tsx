import Link from "next/link"
import { redirect } from "next/navigation"
import { Farol } from "@/components/farol"
import { Icone } from "@/components/icone"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { carregarPainel, hojeISO, itemMonitoradoToItemCalc } from "@/lib/consultas"
import { abaDoItem } from "@/lib/domain/diario"
import { ESTADOS_QUE_PESAM_NA_SAUDE } from "@/lib/domain/ocorrencias"
import { ROTULO_ABA } from "@/lib/domain/permissoes"
import {
  calcularSaudeEmbarcacao,
  FAROL_ESTADO_SAUDE,
  ROTULO_ESTADO_SAUDE,
  type FatorSaude,
  type ItemParaSaude,
  type OcorrenciaParaSaude,
} from "@/lib/domain/saude"
import { calcularSemaforo, temInformacaoSuficiente } from "@/lib/domain/semaforo"
import { supabaseServer } from "@/lib/supabase/server"
import type { Ocorrencia } from "@/lib/db/types"

const hrefDoFator = (f: FatorSaude) =>
  f.tipo === "manutencao" ? `/barco/itens/${f.id}/editar` : `/barco/ocorrencias/${f.id}`

export default async function SaudePage() {
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const { embarcacao, equipamentos, itens } = painel
  const hoje = hojeISO()

  const itensParaSaude: ItemParaSaude[] = itens.map((i) => {
    const eq = equipamentos.find((e) => e.id === i.equipamento_id) ?? null
    const calc = itemMonitoradoToItemCalc(i)
    const r = calcularSemaforo(calc, eq?.horas_atuais ?? null, hoje)
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

  const saude = calcularSaudeEmbarcacao(itensParaSaude, ocorrenciasParaSaude)

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref="/hoje"
        titulo="Saúde da Embarcação"
        descricao="Em que estado o barco está agora, e o que está pedindo ação."
      />

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
          {/* Sem número e sem barra (PRD §1.1/§27.2/§28) — o estado é o
              conteúdo. Ver `lib/domain/saude.ts` pro histórico da decisão. */}
          <div className="sombra-1 mt-6 flex items-center gap-3 rounded-[14px] border border-line bg-panel p-4">
            <Farol status={FAROL_ESTADO_SAUDE[saude.estado]} />
            <p className="titulo-card">{ROTULO_ESTADO_SAUDE[saude.estado]}</p>
            <span className="ml-auto font-mono-instr text-xs uppercase tracking-[.1em] text-dim">
              {saude.total} {saude.total === 1 ? "item acompanhado" : "itens acompanhados"}
            </span>
          </div>

          <p className="apoio mt-3 text-dim">
            O estado é o pior que houver hoje: <strong className="font-medium text-texto">Ação necessária</strong> quando
            existe pendência crítica — documento ou item de segurança vencido, ou ocorrência de gravidade
            alta em aberto; <strong className="font-medium text-texto">Atenção</strong> quando há algo perto do prazo
            ou uma pendência não crítica; <strong className="font-medium text-texto">Saudável</strong> quando não há
            nenhuma das duas. Itens sem informação cadastrada ficam de fora.
          </p>
          <p className="apoio mt-2 text-dim">
            É um retrato do que está registrado no Commander — não é declaração de navegabilidade.
          </p>

          {saude.fatores.length === 0 ? (
            <div className="sombra-1 mt-4 rounded-[14px] border border-line bg-panel p-4 corpo text-dim">
              Nada pendente agora. Bom vento e mar calmo.
            </div>
          ) : (
            <>
              {/* PRD §3.4: bloco "Precisa da sua atenção", ordenado por
                  criticidade. Quem ordena é `calcularSaudeEmbarcacao` (crítico
                  primeiro, depois peso da área × severidade) — a tela só
                  desenha a lista na ordem que recebeu. */}
              <p className="rotulo text-dim mt-6 mb-2 inline-flex items-center gap-1.5">
                <Icone nome="alerta" className="size-3.5" /> Precisa da sua atenção
              </p>
              <div className="space-y-2">
                {saude.fatores.map((f) => (
                  <Link
                    key={`${f.tipo}-${f.id}`}
                    href={hrefDoFator(f)}
                    className="sombra-1 flex items-center gap-3 rounded-[14px] border border-line bg-panel p-3.5"
                  >
                    <Farol status={f.farol} />
                    <div className="min-w-0 flex-1">
                      <p className="titulo-card truncate">{f.nome}</p>
                      <p className="apoio mt-0.5 truncate text-dim">{ROTULO_ABA[f.aba]} · {f.detalhe}</p>
                    </div>
                    {/* O selo de crítico substitui o "-18" que ficava aqui: diz
                        POR QUE o item está no topo sem reintroduzir número. */}
                    {f.critico && (
                      <span className="shrink-0 rounded border border-crit/40 px-1.5 py-0.5 font-mono-instr text-[11px] uppercase tracking-[.1em] text-crit">
                        Crítico
                      </span>
                    )}
                    <Icone nome="chevron" className="size-4 shrink-0 text-dim" />
                  </Link>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </main>
  )
}
