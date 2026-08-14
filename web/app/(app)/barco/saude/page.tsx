import Link from "next/link"
import { redirect } from "next/navigation"
import { Farol } from "@/components/farol"
import { Icone } from "@/components/icone"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { carregarPainel, hojeISO, itemMonitoradoToItemCalc } from "@/lib/consultas"
import { abaDoItem } from "@/lib/domain/diario"
import { ROTULO_ABA } from "@/lib/domain/permissoes"
import { calcularSaudeEmbarcacao, type FatorSaude, type ItemParaSaude, type OcorrenciaParaSaude } from "@/lib/domain/saude"
import { calcularSemaforo, temInformacaoSuficiente } from "@/lib/domain/semaforo"
import { supabaseServer } from "@/lib/supabase/server"
import type { Ocorrencia } from "@/lib/db/types"

// Farol de cada fator a partir do `detalhe` que `calcularSaudeEmbarcacao`
// já monta — vocabulário fechado ("Vencido"/"Atenção" pra manutenção,
// "Aberta"/"Em acompanhamento" pra ocorrência, ver `lib/domain/saude.ts`),
// então dá pra inferir a cor sem duplicar o status bruto no tipo `FatorSaude`.
const faroDoFator = (f: FatorSaude) =>
  f.detalhe.startsWith("Vencido") || f.detalhe.startsWith("Aberta") ? "vencido" : "atencao"

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
  const { data: ocorrenciasBrutas, error } = await supabase
    .from("ocorrencias").select("*").eq("embarcacao_id", embarcacao.id)
    .neq("estado", "resolvida").order("created_at", { ascending: false })
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
        descricao="O que a nota mede, e o que está pesando nela."
      />

      {saude.nota == null || saude.rotulo == null ? (
        <EstadoVazio
          icone="escudo"
          titulo="Ainda sem dados suficientes"
          descricao="Cadastre motores com horas, vencimentos com data, ou registre uma ocorrência pra calcular a nota."
          acao={{ href: "/barco", rotulo: "Completar em Embarcação" }}
          className="mt-6"
        />
      ) : (
        <>
          <div className="sombra-1 mt-6 flex items-center justify-between rounded-[14px] border border-line bg-panel p-4">
            <div>
              <p className="apoio text-dim">Nota atual</p>
              <p className="font-mono-instr text-3xl font-semibold tabular-nums">
                {saude.nota}<span className="text-base font-normal text-dim">/100</span>
              </p>
            </div>
            <span className="rounded-full border border-line px-3 py-1 font-mono-instr text-xs uppercase tracking-[.1em]">
              {saude.rotulo}
            </span>
          </div>

          <p className="apoio mt-3 text-dim">
            A nota começa em 100 e cada problema tira pontos: quanto mais crítica a área — segurança e
            documentação pesam mais que estética — e quanto pior o status — vencido pesa mais que atenção —,
            mais pontos saem. Itens sem informação cadastrada ficam de fora da conta.
          </p>

          {saude.fatores.length === 0 ? (
            <div className="sombra-1 mt-4 rounded-[14px] border border-line bg-panel p-4 corpo text-dim">
              Nada puxando a nota pra baixo agora. Bom vento e mar calmo.
            </div>
          ) : (
            <>
              <p className="rotulo text-dim mt-6 mb-2 inline-flex items-center gap-1.5">
                <Icone nome="alerta" className="size-3.5" /> Puxando a nota pra baixo, do maior pro menor impacto
              </p>
              <div className="space-y-2">
                {saude.fatores.map((f) => (
                  <Link
                    key={`${f.tipo}-${f.id}`}
                    href={hrefDoFator(f)}
                    className="sombra-1 flex items-center gap-3 rounded-[14px] border border-line bg-panel p-3.5"
                  >
                    <Farol status={faroDoFator(f)} />
                    <div className="min-w-0 flex-1">
                      <p className="titulo-card truncate">{f.nome}</p>
                      <p className="apoio mt-0.5 truncate text-dim">{ROTULO_ABA[f.aba]} · {f.detalhe}</p>
                    </div>
                    <span className="shrink-0 font-mono-instr text-sm font-semibold tabular-nums text-crit">
                      -{f.pontos}
                    </span>
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
