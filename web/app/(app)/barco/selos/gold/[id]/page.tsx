import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { Icone } from "@/components/icone"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { Campo } from "@/components/ui/campo"
import { asaasConfigurado } from "@/lib/asaas"
import { cancelarSolicitacaoGold, iniciarPagamentoGold } from "@/lib/acoes/gold"
import { carregarDetalheSolicitacaoGold, carregarPainel } from "@/lib/consultas-gold"
import {
  DESCRICAO_ESTADO_SOLICITACAO, HUBS_PROTOCOLO_GOLD, PASSOS_GOLD, podeCancelarGold,
  ROTULO_ESTADO_ITEM, ROTULO_ESTADO_SOLICITACAO, ROTULO_FAIXA_PORTE, ROTULO_HUB_GOLD, TEXTO_MODAL_GOLD,
} from "@/lib/domain/gold"

const INDICE_PASSO: Record<string, number> = {
  solicitado: 0, aguardando_pagamento: 1, pago: 1, aguardando_agendamento: 1,
  agendado: 2, avaliacao_realizada: 3, em_analise: 5, aprovado: 7, reprovado: 6, cancelado: 0,
}

const ESTILO_ITEM: Record<string, string> = {
  avaliado: "text-ok",
  atencao: "text-warn",
  na: "text-dim",
}

export default async function DetalheSolicitacaoGoldPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ ok?: string; erro?: string }>
}) {
  const { id } = await params
  const { ok, erro } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")

  const detalhe = await carregarDetalheSolicitacaoGold(id)
  if (!detalhe) notFound()
  const { solicitacao, pagamento, agendamento, consultor, avaliacao, itens } = detalhe

  const nomeEmbarcacao = solicitacao.embarcacao_id === painel.embarcacao.id
    ? painel.embarcacao.nome
    : solicitacao.embarcacao_externa_nome ?? "Embarcação"
  const passoAtual = INDICE_PASSO[solicitacao.estado] ?? 0
  const chaveComAsaas = asaasConfigurado()

  return (
    <main>
      <CabecalhoDetalhe voltarHref="/barco/selos/gold" voltarRotulo="Commander Gold" titulo={nomeEmbarcacao} />

      {ok && <p className="corpo mt-3 rounded-lg border border-ok/40 bg-ok/10 px-3 py-2">{ok}</p>}
      {erro && <p className="corpo mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      <div className="sombra-1 mt-4 rounded-[14px] border border-line bg-panel p-4">
        <p className="titulo-card">{ROTULO_ESTADO_SOLICITACAO[solicitacao.estado]}</p>
        <p className="apoio mt-1 text-dim">{DESCRICAO_ESTADO_SOLICITACAO[solicitacao.estado]}</p>
      </div>

      {solicitacao.estado !== "cancelado" && (
        <div className="sombra-1 mt-3 rounded-[14px] border border-line bg-panel px-4">
          {PASSOS_GOLD.map((passo, i) => (
            <div key={passo} className="flex items-center gap-3 border-b border-line py-2.5 last:border-0">
              <span
                className={`flex size-6 shrink-0 items-center justify-center rounded-full border font-mono-instr text-xs ${
                  i <= passoAtual ? "border-accent-forte text-accent-forte" : "border-line text-dim"
                }`}
              >
                {i < passoAtual ? <Icone nome="guardado" className="size-3.5" /> : i + 1}
              </span>
              <p className={`corpo ${i === passoAtual ? "font-medium" : i < passoAtual ? "text-dim" : "text-dim"}`}>{passo}</p>
            </div>
          ))}
        </div>
      )}

      {solicitacao.estado === "aguardando_pagamento" && (
        <div className="sombra-1 mt-4 rounded-[14px] border border-line bg-panel p-4">
          <p className="rotulo mb-2 text-dim">Pagamento da avaliação</p>
          <p className="corpo">
            {ROTULO_FAIXA_PORTE[solicitacao.faixa_porte]} — {solicitacao.quem_paga === "proprio" ? "você paga" : "você vai gerar um link para outra pessoa pagar"}
          </p>

          {pagamento?.link_pagamento && pagamento.status === "pendente" ? (
            solicitacao.quem_paga === "interessado" ? (
              <div className="mt-3 space-y-2">
                <p className="apoio text-dim">Envie este link para quem vai pagar. Ele mostra Pix e cartão, com QR Code na própria página.</p>
                <p className="corpo break-all rounded-lg border border-line bg-panel2 px-3 py-2 font-mono-instr text-xs">
                  {pagamento.link_pagamento}
                </p>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Link de pagamento da avaliação Commander Gold: ${pagamento.link_pagamento}`)}`}
                  target="_blank" rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1.5 text-accent-forte apoio"
                >
                  <Icone nome="compartilhar" className="size-4" /> Compartilhar por WhatsApp
                </a>
              </div>
            ) : (
              <a href={pagamento.link_pagamento} className="mt-3 block rounded-xl bg-accent py-3 text-center font-semibold text-acao-texto">
                Continuar para pagamento
              </a>
            )
          ) : (
            <form action={iniciarPagamentoGold} className="mt-3 space-y-3">
              <input type="hidden" name="solicitacao_id" value={solicitacao.id} />
              {!chaveComAsaas && (
                <p className="apoio rounded-lg border border-line bg-panel2 px-3 py-2 text-dim">
                  A contratação online ainda está sendo preparada — ao confirmar, registramos seu
                  interesse e a equipe Commander entra em contato para o pagamento.
                </p>
              )}
              <Campo
                label={solicitacao.quem_paga === "proprio" ? "Seu nome completo" : "Nome de quem vai pagar"}
                id="nome" name="nome" required minLength={5} autoComplete="name"
              />
              <Campo
                label={solicitacao.quem_paga === "proprio" ? "Seu e-mail" : "E-mail de quem vai pagar"}
                id="email" name="email" type="email" required
              />
              <Campo label="CPF" id="cpf" name="cpf" required inputMode="numeric" placeholder="000.000.000-00" />
              <button className="w-full rounded-xl bg-accent py-3 font-semibold text-acao-texto">
                {solicitacao.quem_paga === "proprio" ? "Continuar para pagamento" : "Gerar link de pagamento"}
              </button>
            </form>
          )}
        </div>
      )}

      {agendamento && (
        <div className="sombra-1 mt-4 rounded-[14px] border border-line bg-panel p-4">
          <p className="rotulo mb-2 text-dim">Avaliação presencial</p>
          <p className="corpo font-medium">
            {new Date(agendamento.data_hora).toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" })}
          </p>
          {agendamento.local && <p className="apoio mt-0.5 text-dim">{agendamento.local}</p>}
          {consultor && <p className="apoio mt-0.5 text-dim">Consultor: {consultor.nome}</p>}
        </div>
      )}

      {avaliacao && (
        <div className="sombra-1 mt-4 rounded-[14px] border border-line bg-panel p-4">
          <p className="rotulo mb-2 text-dim">Commander Gold</p>
          <p className="apoio text-dim">{TEXTO_MODAL_GOLD}</p>
          <div className="mt-3 divide-y divide-line">
            {HUBS_PROTOCOLO_GOLD.map((hub) => {
              const item = itens.find((i) => i.hub === hub)
              const estado = item?.estado ?? "na"
              return (
                <div key={hub} className="flex items-center justify-between py-2">
                  <p className="corpo">{ROTULO_HUB_GOLD[hub]}</p>
                  <p className={`apoio font-medium ${ESTILO_ITEM[estado]}`}>{ROTULO_ESTADO_ITEM[estado]}</p>
                </div>
              )
            })}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 apoio text-dim">
            {avaliacao.data_avaliacao && (
              <p>Data: {new Date(`${avaliacao.data_avaliacao}T00:00:00`).toLocaleDateString("pt-BR")}</p>
            )}
            <p>Protocolo: v{avaliacao.versao_protocolo}</p>
            {avaliacao.validade_meses && <p>Validade: {avaliacao.validade_meses} meses</p>}
            {consultor && <p>Consultor: {consultor.nome}</p>}
          </div>
          {avaliacao.observacoes_gerais && (
            <p className="apoio mt-2 text-dim">Observações: {avaliacao.observacoes_gerais}</p>
          )}
        </div>
      )}

      {solicitacao.estado === "reprovado" && (
        <p className="apoio mt-3 rounded-lg border border-line bg-panel p-3 text-dim">
          Esta avaliação não atingiu os critérios do Commander Gold. Você pode solicitar uma nova
          avaliação quando quiser.
        </p>
      )}

      {podeCancelarGold(solicitacao.estado) && (
        <form action={cancelarSolicitacaoGold} className="mt-4">
          <input type="hidden" name="solicitacao_id" value={solicitacao.id} />
          <button className="apoio text-crit">Cancelar este pedido</button>
        </form>
      )}

      {solicitacao.embarcacao_id && (
        <p className="apoio mt-6">
          <Link href="/barco/selos" className="text-accent-forte">Ver todos os selos Commander</Link>
        </p>
      )}
    </main>
  )
}
