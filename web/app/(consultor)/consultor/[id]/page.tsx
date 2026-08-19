import { notFound, redirect } from "next/navigation"
import { BotaoEnviar } from "@/components/ui/botao-enviar"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { CampoTextarea } from "@/components/ui/campo"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { TOQUE } from "@/lib/ui/acoes"
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
      <CabecalhoDetalhe
        voltarHref="/consultor"
        voltarRotulo="Sua agenda"
        titulo={nomeEmbarcacao}
        descricao={`${ROTULO_ESTADO_SOLICITACAO[solicitacao.estado]} · ${ROTULO_FAIXA_PORTE[solicitacao.faixa_porte]}`}
      />
      {(embarcacao?.marina || solicitacao.embarcacao_externa_local) && (
        <p className="apoio text-dim">Local: {embarcacao?.marina ?? solicitacao.embarcacao_externa_local}</p>
      )}

      {ok && <p className="corpo mt-3 rounded-[var(--raio-controle)] border border-ok/40 bg-ok/10 px-3 py-2">{ok}</p>}
      {erro && <p className="corpo mt-3 rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      {agendamento && (
        <div className="sombra-1 mt-4 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
          <p className="rotulo mb-1 text-dim">Agendamento</p>
          <p className="corpo">
            {new Date(agendamento.data_hora).toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" })}
          </p>
          {agendamento.local && <p className="apoio text-dim">{agendamento.local}</p>}
          <form action={atualizarStatusAgendamentoConsultor} className="mt-2 flex flex-wrap gap-2">
            <input type="hidden" name="id" value={agendamento.id} />
            <input type="hidden" name="solicitacao_id" value={solicitacao.id} />
            {agendamento.status !== "confirmado" && (
              // Mesma limitação de `/admin/avaliacoes`: `name`/`value` levam a
              // decisão à action e `BotaoEnviar` não os repassa. O que dá pra
              // trazer é a altura de pílula do app (44px — eram 30) e a
              // confirmação de toque.
              <button
                name="status" value="confirmado"
                className={`h-11 rounded-full border border-line bg-panel2 px-5 text-sm font-medium ${TOQUE}`}
              >
                Confirmar
              </button>
            )}
          </form>
        </div>
      )}

      {!avaliacao ? (
        <form action={iniciarAvaliacaoGold} className="mt-4">
          <input type="hidden" name="solicitacao_id" value={solicitacao.id} />
          <BotaoEnviar rotulo="Abrir Protocolo Commander" larguraCheia />
        </form>
      ) : (
        <>
          <SecaoPagina>Protocolo Commander</SecaoPagina>
          <div className="space-y-3">
            {HUBS_PROTOCOLO_GOLD.map((hub) => {
              const item = itens.find((i) => i.hub === hub)
              return (
                <form
                  key={hub} action={salvarItemProtocolo}
                  className="sombra-1 space-y-2 rounded-[var(--raio-cartao)] border border-line bg-panel p-4"
                >
                  <input type="hidden" name="avaliacao_id" value={avaliacao.id} />
                  <input type="hidden" name="solicitacao_id" value={solicitacao.id} />
                  <input type="hidden" name="hub" value={hub} />
                  <p className="corpo font-medium">{ROTULO_HUB_GOLD[hub]}</p>
                  <div className="flex gap-2">
                    {ESTADOS_ITEM.map((estado) => (
                      // 30px de altura para o controle mais tocado da vistoria
                      // — o consultor marca isto seis vezes por barco, em pé
                      // no píer. `h-11` é a régua, e não custa layout: o
                      // ladrilho já ocupava a linha inteira em três colunas.
                      <label
                        key={estado}
                        className={`has-[:checked]:border-accent-forte has-[:checked]:text-accent-forte flex h-11 flex-1 cursor-pointer items-center justify-center rounded-[var(--raio-controle)] border border-line px-2 text-center apoio ${TOQUE}`}
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
                  <BotaoEnviar rotulo={`Salvar ${ROTULO_HUB_GOLD[hub]}`} variante="contorno" larguraCheia />
                </form>
              )
            })}
          </div>

          {avaliacao.status === "em_andamento" ? (
            <form action={concluirAvaliacaoGold} className="sombra-1 mt-4 space-y-2 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
              <input type="hidden" name="avaliacao_id" value={avaliacao.id} />
              <p className="corpo font-medium">Concluir avaliação presencial</p>
              <CampoTextarea label="Observações gerais (opcional)" id="observacoes_gerais" name="observacoes_gerais" rows={3} />
              <BotaoEnviar rotulo="Concluir e enviar para análise" larguraCheia />
            </form>
          ) : (
            <p className="apoio mt-4 rounded-[var(--raio-cartao)] border border-line bg-panel p-4 text-dim">
              Avaliação concluída — a equipe Commander está analisando o resultado.
            </p>
          )}
        </>
      )}
    </main>
  )
}
