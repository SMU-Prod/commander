import Link from "next/link"
import { notFound } from "next/navigation"
import { Icone } from "@/components/icone"
import { Campo, CampoSelect, CampoTextarea } from "@/components/ui/campo"
import {
  aprovarSolicitacaoGold, atualizarAgendamentoGold, criarAgendamentoGold, definirRegiaoGold, iniciarAnaliseGold,
  reprovarSolicitacaoGold,
} from "@/lib/acoes/gold-admin"
import { exigirAreaAdmin } from "@/lib/admin"
import { carregarDetalheSolicitacaoGold } from "@/lib/consultas-gold"
import { carregarTaxonomia, itensDoTipo } from "@/lib/consultas-marketplace"
import { temPapelAdmin } from "@/lib/domain/admin-papeis"
import {
  HUBS_PROTOCOLO_GOLD, ROTULO_ESTADO_ITEM, ROTULO_ESTADO_SOLICITACAO, ROTULO_FAIXA_PORTE, ROTULO_HUB_GOLD,
} from "@/lib/domain/gold"
import { supabaseServer } from "@/lib/supabase/server"
import type { GoldConsultor } from "@/lib/db/types"

export default async function AdminDetalheGoldPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ ok?: string; erro?: string }>
}) {
  const papeis = await exigirAreaAdmin("gold")
  const { id } = await params
  const { ok, erro } = await searchParams
  const detalhe = await carregarDetalheSolicitacaoGold(id)
  if (!detalhe) notFound()
  const { solicitacao, pagamento, agendamento, avaliacao, itens } = detalhe

  // Só Suporte/CEO define região. O vistoriador vê a solicitação (a RLS
  // liberou porque a região é dele), mas não escolhe onde trabalha.
  const podeDefinirRegiao = temPapelAdmin(papeis, "suporte")
  const regioes = podeDefinirRegiao ? itensDoTipo(await carregarTaxonomia(), "regiao") : []

  const supabase = await supabaseServer()
  const [{ data: embarcacao }, { data: consultoresBrutos }] = await Promise.all([
    solicitacao.embarcacao_id
      ? supabase.from("embarcacoes").select("nome").eq("id", solicitacao.embarcacao_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("gold_consultores").select("*").eq("ativo", true).order("nome"),
  ])
  const consultores = (consultoresBrutos as GoldConsultor[] | null) ?? []
  const nomeEmbarcacao = embarcacao?.nome ?? solicitacao.embarcacao_externa_nome ?? "Embarcação"

  return (
    <main>
      <Link href="/admin/gold" className="inline-flex items-center gap-1 rotulo text-accent-forte">
        <Icone nome="voltar" className="size-4" /> Commander Gold
      </Link>
      <h1 className="titulo-pagina mt-3">{nomeEmbarcacao}</h1>
      <p className="apoio mt-1 text-dim">
        {ROTULO_ESTADO_SOLICITACAO[solicitacao.estado]} · {ROTULO_FAIXA_PORTE[solicitacao.faixa_porte]}
        {!solicitacao.embarcacao_id && " · embarcação sem cadastro no Commander"}
      </p>
      {solicitacao.embarcacao_externa_local && (
        <p className="apoio text-dim">Local informado: {solicitacao.embarcacao_externa_local}</p>
      )}

      {ok && <p className="corpo mt-3 rounded-lg border border-ok/40 bg-ok/10 px-3 py-2">{ok}</p>}
      {erro && <p className="corpo mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      {/* Região da vistoria (onda 48, §21) — não é etiqueta, é a chave do
          escopo: a RLS libera esta solicitação exatamente pros vistoriadores
          autorizados nesta região. Sem região, nenhum vistoriador enxerga. */}
      {podeDefinirRegiao && (
        <div className="sombra-1 mt-4 rounded-[14px] border border-line bg-panel p-4">
          <p className="rotulo mb-2 text-dim">Região da vistoria</p>
          <form action={definirRegiaoGold} className="space-y-2">
            <input type="hidden" name="solicitacao_id" value={solicitacao.id} />
            <CampoSelect label="Região" id="regiao_id" name="regiao_id" defaultValue={solicitacao.regiao_id ?? ""}>
              <option value="">Sem região definida</option>
              {regioes.map((r) => (
                <option key={r.id} value={r.id}>{r.uf ? `${r.nome} · ${r.uf}` : r.nome}</option>
              ))}
            </CampoSelect>
            <p className="apoio text-dim">
              Define quem enxerga esta vistoria: só vistoriadores autorizados nesta região. Sem região, nenhum
              vistoriador tem acesso.
            </p>
            <button className="w-full rounded-xl border border-line bg-panel2 py-2.5 font-semibold">Salvar região</button>
          </form>
        </div>
      )}

      {pagamento && (
        <div className="sombra-1 mt-4 rounded-[14px] border border-line bg-panel p-4">
          <p className="rotulo mb-1 text-dim">Pagamento</p>
          <p className="corpo">Status: {pagamento.status} · {pagamento.quem_paga === "proprio" ? "pelo solicitante" : "por interessado (link)"}</p>
        </div>
      )}

      {agendamento && (
        <div className="sombra-1 mt-4 rounded-[14px] border border-line bg-panel p-4">
          <p className="rotulo mb-2 text-dim">Agendamento</p>
          <form action={atualizarAgendamentoGold} className="space-y-2">
            <input type="hidden" name="id" value={agendamento.id} />
            <input type="hidden" name="solicitacao_id" value={solicitacao.id} />
            <div className="grid grid-cols-2 gap-2">
              <Campo
                label="Data" id="data_ag" name="data" type="date"
                defaultValue={agendamento.data_hora.slice(0, 10)}
              />
              <Campo
                label="Hora" id="hora_ag" name="hora" type="time"
                defaultValue={new Date(agendamento.data_hora).toISOString().slice(11, 16)}
              />
            </div>
            <Campo label="Local" id="local_ag" name="local" defaultValue={agendamento.local ?? ""} />
            <CampoSelect label="Status" id="status_ag" name="status" defaultValue={agendamento.status}>
              <option value="agendado">Agendado</option>
              <option value="confirmado">Confirmado</option>
              <option value="realizado">Realizado</option>
              <option value="reagendado">Reagendado</option>
              <option value="cancelado">Cancelado</option>
            </CampoSelect>
            <CampoTextarea label="Observações" id="obs_ag" name="observacoes" rows={2} defaultValue={agendamento.observacoes ?? ""} />
            <button className="w-full rounded-xl border border-line bg-panel2 py-2.5 font-semibold">Salvar agendamento</button>
          </form>
        </div>
      )}

      {solicitacao.estado === "aguardando_agendamento" && (
        <div className="sombra-1 mt-4 rounded-[14px] border border-line bg-panel p-4">
          <p className="rotulo mb-2 text-dim">Agendar avaliação presencial</p>
          {consultores.length === 0 && (
            <p className="apoio mb-2 text-dim">
              Nenhum consultor cadastrado ainda — <Link href="/admin/gold/consultores" className="text-accent-forte">cadastre um</Link> antes
              de agendar, ou agende sem consultor definido e atualize depois.
            </p>
          )}
          <form action={criarAgendamentoGold} className="space-y-2">
            <input type="hidden" name="solicitacao_id" value={solicitacao.id} />
            <CampoSelect label="Consultor" id="consultor_id" name="consultor_id" defaultValue="">
              <option value="">A definir</option>
              {consultores.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.regiao ? ` — ${c.regiao}` : ""}</option>)}
            </CampoSelect>
            <div className="grid grid-cols-2 gap-2">
              <Campo label="Data" id="data" name="data" type="date" required />
              <Campo label="Hora" id="hora" name="hora" type="time" defaultValue="09:00" />
            </div>
            <Campo label="Local" id="local" name="local" />
            <CampoTextarea label="Observações" id="observacoes" name="observacoes" rows={2} />
            <button className="w-full rounded-xl bg-accent py-3 font-semibold text-acao-texto">Confirmar agendamento</button>
          </form>
        </div>
      )}

      {avaliacao && (
        <div className="sombra-1 mt-4 rounded-[14px] border border-line bg-panel p-4">
          <p className="rotulo mb-2 text-dim">Protocolo Commander</p>
          <div className="divide-y divide-line">
            {HUBS_PROTOCOLO_GOLD.map((hub) => {
              const item = itens.find((i) => i.hub === hub)
              const estado = item?.estado ?? "na"
              return (
                <div key={hub} className="py-2">
                  <div className="flex items-center justify-between">
                    <p className="corpo">{ROTULO_HUB_GOLD[hub]}</p>
                    <p className={`apoio font-medium ${estado === "avaliado" ? "text-ok" : estado === "atencao" ? "text-warn" : "text-dim"}`}>
                      {ROTULO_ESTADO_ITEM[estado]}
                    </p>
                  </div>
                  {item?.observacao && <p className="apoio text-dim">{item.observacao}</p>}
                </div>
              )
            })}
          </div>
          {avaliacao.observacoes_gerais && <p className="apoio mt-2 text-dim">{avaliacao.observacoes_gerais}</p>}
        </div>
      )}

      {solicitacao.estado === "avaliacao_realizada" && (
        <form action={iniciarAnaliseGold} className="mt-4">
          <input type="hidden" name="solicitacao_id" value={solicitacao.id} />
          <button className="w-full rounded-xl bg-accent py-3 font-semibold text-acao-texto">Abrir análise</button>
        </form>
      )}

      {solicitacao.estado === "em_analise" && (
        <div className="mt-4 space-y-3">
          <form action={aprovarSolicitacaoGold} className="sombra-1 space-y-2 rounded-[14px] border border-ok/40 bg-panel p-4">
            <input type="hidden" name="solicitacao_id" value={solicitacao.id} />
            <p className="corpo font-medium">Aprovar Commander Gold</p>
            <CampoSelect label="Validade do selo" id="validade_meses" name="validade_meses" defaultValue="12">
              <option value="6">6 meses</option>
              <option value="12">12 meses</option>
            </CampoSelect>
            <button className="w-full rounded-xl bg-ok py-2.5 font-semibold text-white">Aprovar</button>
          </form>
          <form action={reprovarSolicitacaoGold} className="sombra-1 space-y-2 rounded-[14px] border border-crit/40 bg-panel p-4">
            <input type="hidden" name="solicitacao_id" value={solicitacao.id} />
            <p className="corpo font-medium">Reprovar</p>
            <CampoTextarea label="Motivo (opcional)" id="motivo" name="motivo" rows={2} />
            <button className="w-full rounded-xl border border-crit/60 py-2.5 font-semibold text-crit">Reprovar</button>
          </form>
        </div>
      )}
    </main>
  )
}
