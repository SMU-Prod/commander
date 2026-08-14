import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { Icone } from "@/components/icone"
import { CampoTextarea } from "@/components/ui/campo"
import {
  atualizarStatusAgendamentoConsultor, concluirAvaliacaoGold, iniciarAvaliacaoGold, salvarItemProtocolo,
} from "@/lib/acoes/gold-consultor"
import { carregarDetalheSolicitacaoGold, carregarMeuPerfilConsultor } from "@/lib/consultas-gold"
import {
  HUBS_PROTOCOLO_GOLD, ROTULO_ESTADO_ITEM, ROTULO_ESTADO_SOLICITACAO, ROTULO_FAIXA_PORTE, ROTULO_HUB_GOLD,
} from "@/lib/domain/gold"
import { supabaseServer } from "@/lib/supabase/server"

const ESTADOS_ITEM = ["avaliado", "atencao", "na"] as const

export default async function ConsultorProtocoloPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ ok?: string; erro?: string }>
}) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login?volta=/consultor")

  const { id } = await params
  const { ok, erro } = await searchParams
  const meuConsultor = await carregarMeuPerfilConsultor()
  if (!meuConsultor) redirect("/consultor")

  const detalhe = await carregarDetalheSolicitacaoGold(id)
  if (!detalhe) notFound()
  const { solicitacao, agendamento, avaliacao, itens } = detalhe

  const { data: embarcacao } = solicitacao.embarcacao_id
    ? await supabase.from("embarcacoes").select("nome, marina").eq("id", solicitacao.embarcacao_id).maybeSingle()
    : { data: null }
  const nomeEmbarcacao = embarcacao?.nome ?? solicitacao.embarcacao_externa_nome ?? "Embarcação"

  return (
    <main>
      <Link href="/consultor" className="inline-flex items-center gap-1 rotulo text-accent-forte">
        <Icone nome="voltar" className="size-4" /> Sua agenda
      </Link>
      <h1 className="titulo-pagina mt-3">{nomeEmbarcacao}</h1>
      <p className="apoio mt-1 text-dim">
        {ROTULO_ESTADO_SOLICITACAO[solicitacao.estado]} · {ROTULO_FAIXA_PORTE[solicitacao.faixa_porte]}
      </p>
      {(embarcacao?.marina || solicitacao.embarcacao_externa_local) && (
        <p className="apoio text-dim">Local: {embarcacao?.marina ?? solicitacao.embarcacao_externa_local}</p>
      )}

      {ok && <p className="corpo mt-3 rounded-lg border border-ok/40 bg-ok/10 px-3 py-2">{ok}</p>}
      {erro && <p className="corpo mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      {agendamento && (
        <div className="sombra-1 mt-4 rounded-[14px] border border-line bg-panel p-4">
          <p className="rotulo mb-1 text-dim">Agendamento</p>
          <p className="corpo">
            {new Date(agendamento.data_hora).toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" })}
          </p>
          {agendamento.local && <p className="apoio text-dim">{agendamento.local}</p>}
          <form action={atualizarStatusAgendamentoConsultor} className="mt-2 flex flex-wrap gap-2">
            <input type="hidden" name="id" value={agendamento.id} />
            <input type="hidden" name="solicitacao_id" value={solicitacao.id} />
            {agendamento.status !== "confirmado" && (
              <button name="status" value="confirmado" className="rounded-lg border border-line bg-panel2 px-3 py-1.5 apoio font-medium">
                Confirmar
              </button>
            )}
          </form>
        </div>
      )}

      {!avaliacao ? (
        <form action={iniciarAvaliacaoGold} className="mt-4">
          <input type="hidden" name="solicitacao_id" value={solicitacao.id} />
          <button className="w-full rounded-xl bg-accent py-3 font-semibold text-acao-texto">
            Abrir Protocolo Commander
          </button>
        </form>
      ) : (
        <>
          <p className="rotulo mt-6 mb-2 text-dim">Protocolo Commander</p>
          <div className="space-y-3">
            {HUBS_PROTOCOLO_GOLD.map((hub) => {
              const item = itens.find((i) => i.hub === hub)
              return (
                <form
                  key={hub} action={salvarItemProtocolo}
                  className="sombra-1 space-y-2 rounded-[14px] border border-line bg-panel p-4"
                >
                  <input type="hidden" name="avaliacao_id" value={avaliacao.id} />
                  <input type="hidden" name="solicitacao_id" value={solicitacao.id} />
                  <input type="hidden" name="hub" value={hub} />
                  <p className="corpo font-medium">{ROTULO_HUB_GOLD[hub]}</p>
                  <div className="flex gap-2">
                    {ESTADOS_ITEM.map((estado) => (
                      <label
                        key={estado}
                        className="has-[:checked]:border-accent-forte has-[:checked]:text-accent-forte flex-1 cursor-pointer rounded-lg border border-line px-2 py-1.5 text-center apoio"
                      >
                        <input
                          type="radio" name="estado" value={estado} defaultChecked={(item?.estado ?? "na") === estado}
                          className="sr-only"
                        />
                        {ROTULO_ESTADO_ITEM[estado]}
                      </label>
                    ))}
                  </div>
                  <CampoTextarea
                    label="Observação (opcional)" id={`obs_${hub}`} name="observacao" rows={2}
                    defaultValue={item?.observacao ?? ""}
                  />
                  <button className="w-full rounded-lg border border-line bg-panel2 py-2 apoio font-medium">Salvar {ROTULO_HUB_GOLD[hub]}</button>
                </form>
              )
            })}
          </div>

          {avaliacao.status === "em_andamento" ? (
            <form action={concluirAvaliacaoGold} className="sombra-1 mt-4 space-y-2 rounded-[14px] border border-line bg-panel p-4">
              <input type="hidden" name="avaliacao_id" value={avaliacao.id} />
              <p className="corpo font-medium">Concluir avaliação presencial</p>
              <CampoTextarea label="Observações gerais (opcional)" id="observacoes_gerais" name="observacoes_gerais" rows={3} />
              <button className="w-full rounded-xl bg-accent py-3 font-semibold text-acao-texto">
                Concluir e enviar para análise
              </button>
            </form>
          ) : (
            <p className="apoio mt-4 rounded-[14px] border border-line bg-panel p-4 text-dim">
              Avaliação concluída — a equipe Commander está analisando o resultado.
            </p>
          )}
        </>
      )}
    </main>
  )
}
