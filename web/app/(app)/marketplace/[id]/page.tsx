import Link from "next/link"
import { redirect } from "next/navigation"
import { CartaoAvaliacao } from "@/components/avaliacoes/cartao-avaliacao"
import { SeletorNota } from "@/components/avaliacoes/estrelas"
import { SeloReputacao } from "@/components/avaliacoes/reputacao"
import { Confirmar } from "@/components/confirmar"
import { Icone } from "@/components/icone"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { Campo, CampoSelect, CampoTextarea } from "@/components/ui/campo"
import { publicarAvaliacao } from "@/lib/acoes/avaliacoes"
import {
  enviarProposta,
  marcarNegocioRealizado,
  responderConfirmacaoNegocio,
  responderProposta,
  retirarProposta,
  atualizarStatusDemanda,
} from "@/lib/acoes/marketplace"
import {
  carregarAvaliacaoDoNegocio, carregarReputacoes, type AvaliacaoCompleta,
} from "@/lib/consultas-avaliacoes"
import { carregarMapaTaxonomia, nomeDaRegiao, nomeDe, tituloDeDemanda } from "@/lib/consultas-marketplace"
import { calcularReputacao, podeAvaliar, SELO_NEGOCIO_CONFIRMADO } from "@/lib/domain/avaliacoes"
import { hojeISO } from "@/lib/domain/datas"
import { formatarReais } from "@/lib/domain/gastos"
import {
  avaliacaoLiberada,
  CONDICOES_PRODUTO,
  demandaViva,
  estadoDoNegocio,
  etapaComercial,
  faltaConfirmacaoDe,
  FORMAS_ENTREGA,
  formatarDiaCurto,
  ICONE_TIPO_DEMANDA,
  PERIODOS_VAGA,
  propostaTem,
  resumoDaProposta,
  ROTULO_CONDICAO,
  ROTULO_ENTREGA,
  ROTULO_ESTADO_NEGOCIO,
  ROTULO_ETAPA_COMERCIAL,
  ROTULO_PERIODO_VAGA,
  ROTULO_STATUS_DEMANDA,
  ROTULO_TIPO_DEMANDA,
  rotuloDaResposta,
  type ConfirmacaoNegocio,
} from "@/lib/domain/marketplace"
import { supabaseServer } from "@/lib/supabase/server"
import type {
  Demanda, DemandaContato, Negocio, NegocioConfirmacao, Proposta,
} from "@/lib/db/types"

/**
 * Ficha de um pedido do Marketplace (onda 45, PRD §11.5 e §11.6).
 *
 * A mesma tela serve os dois lados, porque o §11.6 descreve um fluxo único e
 * bilateral: quem publicou vê as propostas e aceita uma; quem propôs vê o
 * andamento da sua; e a partir do aceite qualquer um dos dois marca o negócio
 * como realizado e o outro confirma ou nega.
 *
 * §22 é respeitado no banco, não aqui: o contato de quem publicou vem de
 * `demandas_contato`, cuja RLS só devolve linha para o autor ou para quem
 * teve a proposta ACEITA (migration 046). Se esta tela esquecesse de
 * esconder, o dado continuaria protegido.
 */
export default async function DemandaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ erro?: string; ok?: string }>
}) {
  const { id } = await params
  const { erro, ok } = await searchParams
  const supabase = await supabaseServer()
  const hoje = hojeISO()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [mapa, { data: bruta }] = await Promise.all([
    carregarMapaTaxonomia(),
    supabase.from("demandas").select("*").eq("id", id).maybeSingle(),
  ])
  const demanda = bruta as Demanda | null
  // A RLS devolve linha só quando a demanda está viva ou é sua — "não existe
  // mais" cobre id errado e pedido encerrado sem distinguir os dois (não
  // vaza pra quem não pode ver que ele existiu).
  if (!demanda) {
    redirect(`/marketplace?erro=${encodeURIComponent("Esse pedido não existe mais ou já foi encerrado.")}`)
  }

  const ehAutor = demanda.autor_id === user.id
  const viva = demandaViva(demanda, hoje)

  const [{ data: propostasBrutas }, { data: contatoBruto }, { data: negociosBrutos }] = await Promise.all([
    supabase.from("propostas").select("*").eq("demanda_id", id).order("criado_em"),
    supabase.from("demandas_contato").select("*").eq("demanda_id", id).maybeSingle(),
    supabase.from("negocios").select("*").eq("demanda_id", id),
  ])
  const propostas = (propostasBrutas as Proposta[] | null) ?? []
  const contato = contatoBruto as DemandaContato | null
  const negocios = (negociosBrutos as Negocio[] | null) ?? []

  const { data: confirmacoesBrutas } = negocios.length
    ? await supabase.from("negocios_confirmacoes").select("*").in("negocio_id", negocios.map((n) => n.id))
    : { data: null }
  const confirmacoes = (confirmacoesBrutas as NegocioConfirmacao[] | null) ?? []
  const confirmacoesDe = (negocioId: string): ConfirmacaoNegocio[] =>
    confirmacoes.filter((c) => c.negocio_id === negocioId)

  const minhaProposta = propostas.find((p) => p.autor_id === user.id) ?? null
  const aceita = propostas.find((p) => p.status === "aceita") ?? null
  const negocioDaAceita = aceita ? negocios.find((n) => n.proposta_id === aceita.id) ?? null : null

  const etapa = etapaComercial({
    temProposta: propostas.some((p) => p.status !== "retirada"),
    temPropostaAceita: aceita != null,
    temNegocio: negocioDaAceita != null,
    confirmacoes: negocioDaAceita ? confirmacoesDe(negocioDaAceita.id) : [],
  })

  // §14 — a avaliação nasce aqui, colada no negócio que a liberou. Quem
  // gerencia respostas e contestações depois é /avaliacoes.
  const avaliacaoDoNegocio = negocioDaAceita
    ? await carregarAvaliacaoDoNegocio(negocioDaAceita.id)
    : null
  // A reputação de quem propôs, ao lado do nome: é neste momento — escolher
  // entre três propostas — que a média do §14 vale alguma coisa.
  const reputacoes = await carregarReputacoes(propostas.map((p) => p.autor_id))

  const substantivo = rotuloDaResposta(demanda.tipo)
  const podePropor = !ehAutor && viva && minhaProposta == null
  // Marcar "negócio realizado" é dos dois lados envolvidos (§11.6) e só faz
  // sentido uma vez: depois que existe negócio, a tela mostra a confirmação.
  const souUmDosDoisLados = ehAutor || (aceita != null && aceita.autor_id === user.id)
  const podeMarcarRealizado = aceita != null && negocioDaAceita == null && souUmDosDoisLados

  return (
    <main>
      <CabecalhoDetalhe voltarHref="/marketplace" voltarRotulo="Marketplace" />
      {erro && <p className="mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 text-sm">{erro}</p>}
      {ok && <p className="mt-3 rounded-lg border border-ok/40 bg-ok/10 px-3 py-2 text-sm">{ok}</p>}

      {/* --- O cartão gerado pelo Commander (§11.2) --- */}
      <div className="sombra-1 mt-3 rounded-[14px] border border-line bg-panel p-4">
        <div className="flex items-start justify-between gap-2">
          <h1 className="titulo-pagina">{tituloDeDemanda(mapa, demanda)}</h1>
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 font-mono-instr text-[11px] uppercase tracking-[.1em] ${
              viva ? "border-ok/40 text-ok" : "border-line text-dim"
            }`}
          >
            {viva ? ROTULO_STATUS_DEMANDA[demanda.status] : "Encerrado"}
          </span>
        </div>
        <p className="apoio mt-1 inline-flex items-center gap-1.5 text-dim">
          <Icone nome={ICONE_TIPO_DEMANDA[demanda.tipo]} className="size-4" />
          {ROTULO_TIPO_DEMANDA[demanda.tipo]} · {nomeDaRegiao(mapa, demanda.regiao_id)}
        </p>
        <p className="apoio mt-1 text-dim">Publicado por {demanda.autor_nome}</p>

        <dl className="mt-3 space-y-1">
          {demanda.categoria_id && (
            <Detalhe rotulo="Categoria" valor={nomeDe(mapa, demanda.categoria_id)} />
          )}
          {demanda.funcao_id && <Detalhe rotulo="Função" valor={nomeDe(mapa, demanda.funcao_id)} />}
          {demanda.marca_id && <Detalhe rotulo="Marca" valor={nomeDe(mapa, demanda.marca_id)} />}
          {demanda.combustivel_id && <Detalhe rotulo="Combustível" valor={nomeDe(mapa, demanda.combustivel_id)} />}
          {demanda.quantidade_litros != null && (
            <Detalhe rotulo="Quantidade" valor={`${demanda.quantidade_litros.toLocaleString("pt-BR")} L`} />
          )}
          {demanda.porte_pes != null && <Detalhe rotulo="Porte" valor={`${demanda.porte_pes} pés`} />}
          {demanda.data_desejada && (
            <Detalhe
              rotulo="Quando"
              valor={
                demanda.data_fim && demanda.data_fim !== demanda.data_desejada
                  ? `${formatarDiaCurto(demanda.data_desejada)} a ${formatarDiaCurto(demanda.data_fim)}`
                  : formatarDiaCurto(demanda.data_desejada)
              }
            />
          )}
          <Detalhe rotulo="Fica no ar até" valor={formatarDiaCurto(demanda.expira_em)} />
        </dl>

        {demanda.observacao && <p className="corpo mt-3 whitespace-pre-line">{demanda.observacao}</p>}
      </div>

      {/* --- Onde estamos na esteira (§11.6) --- */}
      <p className="apoio mt-3 rounded-lg border border-line bg-panel px-3 py-2 text-dim">
        <span className="rotulo">Situação</span> · {ROTULO_ETAPA_COMERCIAL[etapa]}
      </p>

      {/* --- Contato liberado (§22) --- */}
      {contato && (contato.telefone || contato.email) && (
        <div className="sombra-1 mt-3 rounded-[14px] border border-ok/40 bg-ok/10 p-4">
          <p className="titulo-card">{ehAutor ? "Seu contato neste pedido" : "Contato liberado"}</p>
          {!ehAutor && (
            <p className="apoio mt-0.5 text-dim">
              Você recebeu porque sua {substantivo} foi aceita. Combine direto.
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {contato.telefone && (
              <a
                href={`https://wa.me/55${contato.telefone.replace(/\D/g, "")}`}
                target="_blank" rel="noopener noreferrer"
                className="rounded-lg border border-ok/40 px-2.5 py-1.5 text-xs text-ok"
              >
                WhatsApp {contato.telefone}
              </a>
            )}
            {contato.email && (
              <a href={`mailto:${contato.email}`} className="rounded-lg border border-line px-2.5 py-1.5 text-xs">
                {contato.email}
              </a>
            )}
          </div>
        </div>
      )}

      {/* --- Ações do autor sobre o próprio pedido --- */}
      {ehAutor && viva && (
        <div className="mt-3 flex gap-2">
          <form action={atualizarStatusDemanda} className="flex-1">
            <input type="hidden" name="demanda_id" value={demanda.id} />
            <input type="hidden" name="status" value="fechada" />
            <button className="h-11 w-full rounded-lg border border-line text-sm font-medium text-dim">
              Já resolvi — encerrar
            </button>
          </form>
          <form action={atualizarStatusDemanda} className="flex-1">
            <input type="hidden" name="demanda_id" value={demanda.id} />
            <input type="hidden" name="status" value="cancelada" />
            <Confirmar
              mensagem="Cancelar este pedido? Quem já respondeu deixa de poder falar com você."
              rotulo="Cancelar pedido"
              className="flex h-11 w-full items-center justify-center rounded-lg border border-crit/40 text-sm font-medium text-crit"
            />
          </form>
        </div>
      )}

      {/* --- Fechamento bilateral (§11.6) — qualquer um dos dois lados
              envolvidos pode marcar; o outro confirma ou nega depois. --- */}
      {podeMarcarRealizado && aceita && (
        <FormNegocioRealizado
          demandaId={demanda.id}
          propostaId={aceita.id}
          clienteId={demanda.autor_id}
          fornecedorId={aceita.autor_id}
        />
      )}

      {negocioDaAceita && (
        <BlocoNegocio
          demandaId={demanda.id}
          negocio={negocioDaAceita}
          confirmacoes={confirmacoesDe(negocioDaAceita.id)}
          usuarioId={user.id}
          avaliacao={avaliacaoDoNegocio}
        />
      )}

      {/* --- Propostas recebidas (visão de quem publicou) --- */}
      {ehAutor ? (
        <>
          <p className="rotulo mt-6 mb-2 text-dim">
            {propostas.length} {propostas.length === 1 ? substantivo : `${substantivo}s`}
          </p>
          {propostas.length === 0 ? (
            <p className="apoio rounded-[14px] border border-line bg-panel p-4 text-center text-dim">
              Ninguém respondeu ainda. Quem atende essa categoria na sua região já foi avisado.
            </p>
          ) : (
            <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
              {propostas.map((p) => (
                <div key={p.id} className="border-b border-line py-3.5 last:border-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="titulo-card inline-flex flex-wrap items-center gap-2">
                      {p.autor_nome}
                      <SeloReputacao
                        reputacao={reputacoes.get(p.autor_id) ?? calcularReputacao([])}
                        href={`/avaliacoes/${p.autor_id}`}
                      />
                    </p>
                    {p.status !== "enviada" && (
                      <span className="apoio shrink-0 text-dim">
                        {p.status === "aceita" ? "Aceita" : p.status === "recusada" ? "Recusada" : "Retirada"}
                      </span>
                    )}
                  </div>
                  <ResumoProposta tipo={demanda.tipo} proposta={p} />
                  {p.observacao && <p className="corpo mt-1">{p.observacao}</p>}
                  {p.status === "enviada" && viva && aceita == null && (
                    <div className="mt-3 flex gap-2">
                      <form action={responderProposta} className="flex-1">
                        <input type="hidden" name="demanda_id" value={demanda.id} />
                        <input type="hidden" name="proposta_id" value={p.id} />
                        <input type="hidden" name="decisao" value="aceita" />
                        <button className="h-10 w-full rounded-lg border border-ok/40 text-sm font-medium text-ok">
                          Aceitar e liberar meu contato
                        </button>
                      </form>
                      <form action={responderProposta} className="flex-1">
                        <input type="hidden" name="demanda_id" value={demanda.id} />
                        <input type="hidden" name="proposta_id" value={p.id} />
                        <input type="hidden" name="decisao" value="recusada" />
                        <button className="h-10 w-full rounded-lg border border-line text-sm font-medium text-dim">
                          Recusar
                        </button>
                      </form>
                    </div>
                  )}
                  {p.status === "aceita" && p.telefone && (
                    <a
                      href={`https://wa.me/55${p.telefone.replace(/\D/g, "")}`}
                      target="_blank" rel="noopener noreferrer"
                      className="mt-2 inline-block rounded-lg border border-ok/40 px-2.5 py-1.5 text-xs text-ok"
                    >
                      WhatsApp {p.telefone}
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      ) : minhaProposta ? (
        <div className="mt-6 rounded-[14px] border border-line bg-panel p-4">
          <p className="titulo-card">
            Sua {substantivo} — {minhaProposta.status === "enviada" ? "aguardando resposta" : minhaProposta.status}
          </p>
          <ResumoProposta tipo={demanda.tipo} proposta={minhaProposta} />
          {minhaProposta.observacao && <p className="corpo mt-1 text-dim">{minhaProposta.observacao}</p>}
          {minhaProposta.status === "enviada" && (
            <form action={retirarProposta} className="mt-3">
              <input type="hidden" name="demanda_id" value={demanda.id} />
              <Confirmar mensagem={`Retirar sua ${substantivo}?`} rotulo="Retirar" className="apoio text-crit" />
            </form>
          )}
        </div>
      ) : podePropor ? (
        <FormProposta demanda={demanda} />
      ) : (
        <p className="apoio mt-6 rounded-[14px] border border-line bg-panel p-4 text-center text-dim">
          Este pedido não está mais aceitando resposta.
        </p>
      )}
    </main>
  )
}

function Detalhe({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  if (!valor) return null
  return (
    <div className="flex justify-between gap-3">
      <dt className="apoio text-dim">{rotulo}</dt>
      <dd className="apoio text-right">{valor}</dd>
    </div>
  )
}

function ResumoProposta({
  tipo,
  proposta,
}: {
  tipo: Demanda["tipo"]
  proposta: Proposta
}) {
  const linhas = resumoDaProposta(tipo, proposta)
  if (linhas.length === 0) return null
  return <p className="apoio mt-1 text-dim">{linhas.join(" · ")}</p>
}

/** §11.6 — "Um lado marca como realizado". Qualquer um dos dois pode; o valor
 *  final é opcional e pode ser diferente do proposto. */
function FormNegocioRealizado({
  demandaId,
  propostaId,
  clienteId,
  fornecedorId,
}: {
  demandaId: string
  propostaId: string
  clienteId: string
  fornecedorId: string
}) {
  return (
    <form action={marcarNegocioRealizado} className="sombra-1 mt-3 rounded-[14px] border border-line bg-panel p-4">
      <input type="hidden" name="demanda_id" value={demandaId} />
      <input type="hidden" name="proposta_id" value={propostaId} />
      <input type="hidden" name="cliente_id" value={clienteId} />
      <input type="hidden" name="fornecedor_id" value={fornecedorId} />
      <p className="titulo-card">Fechou o negócio?</p>
      <p className="apoio mt-0.5 text-dim">
        Marque como realizado e o outro lado confirma. Só depois dos dois confirmarem o negócio conta como
        fechado no Commander.
      </p>
      <div className="mt-3 space-y-3">
        <Campo
          label="Valor final (opcional)" id="valor_final" name="valor_final" inputMode="decimal"
          placeholder="1.850,00"
          dica="Pode ser diferente do que foi proposto. Em branco se preferir não informar."
        />
        <CampoTextarea label="Observação (opcional)" id="observacao" name="observacao" rows={2} maxLength={300} />
      </div>
      <button className="mt-3 h-11 w-full rounded-xl bg-accent text-sm font-semibold text-acao-texto">
        Marcar como realizado
      </button>
    </form>
  )
}

function BlocoNegocio({
  demandaId,
  negocio,
  confirmacoes,
  usuarioId,
  avaliacao,
}: {
  demandaId: string
  negocio: Negocio
  confirmacoes: ConfirmacaoNegocio[]
  usuarioId: string
  avaliacao: AvaliacaoCompleta | null
}) {
  const estado = estadoDoNegocio(confirmacoes)
  const souParte = negocio.cliente_id === usuarioId || negocio.fornecedor_id === usuarioId
  const devoResponder = souParte && faltaConfirmacaoDe(confirmacoes, usuarioId)
  const posso = podeAvaliar({
    usuarioId,
    clienteId: negocio.cliente_id,
    confirmacoes,
    jaAvaliou: avaliacao != null,
  })

  return (
    <div
      className={`sombra-1 mt-3 rounded-[14px] border p-4 ${
        estado === "confirmado" ? "border-ok/40 bg-ok/10" : estado === "negado" ? "border-crit/40 bg-crit/10" : "border-line bg-panel"
      }`}
    >
      <p className="titulo-card">{ROTULO_ESTADO_NEGOCIO[estado]}</p>
      {negocio.valor_final_centavos != null && (
        <p className="apoio mt-0.5 text-dim">Valor informado: {formatarReais(negocio.valor_final_centavos)}</p>
      )}

      {devoResponder && (
        <div className="mt-3 flex gap-2">
          <form action={responderConfirmacaoNegocio} className="flex-1">
            <input type="hidden" name="demanda_id" value={demandaId} />
            <input type="hidden" name="negocio_id" value={negocio.id} />
            <input type="hidden" name="decisao" value="confirmado" />
            <button className="h-11 w-full rounded-lg border border-ok/40 text-sm font-medium text-ok">
              Confirmo que aconteceu
            </button>
          </form>
          <form action={responderConfirmacaoNegocio} className="flex-1">
            <input type="hidden" name="demanda_id" value={demandaId} />
            <input type="hidden" name="negocio_id" value={negocio.id} />
            <input type="hidden" name="decisao" value="negado" />
            <button className="h-11 w-full rounded-lg border border-crit/40 text-sm font-medium text-crit">
              Não reconheço
            </button>
          </form>
        </div>
      )}

      {/* §11.6 → §14: "Após confirmação bilateral, liberar avaliação". A
          avaliação aparece exatamente aqui, no momento em que destrava.
          TODO: "Adicionar ao Financeiro" (§11.6) — o módulo existe (onda 42),
          falta a ponte; fica registrado como pendência da onda. */}
      {avaliacaoLiberada(confirmacoes) && (
        <div className="mt-3 border-t border-line pt-3">
          {avaliacao ? (
            <>
              <CartaoAvaliacao
                item={avaliacao}
                cabecalho={
                  avaliacao.avaliacao.avaliador_id === usuarioId
                    ? `Sobre ${avaliacao.avaliacao.avaliado_nome}`
                    : undefined
                }
              />
              <p className="apoio mt-2">
                <Link href="/avaliacoes" className="text-accent-forte">
                  {avaliacao.avaliacao.avaliado_id === usuarioId
                    ? "Responder, contestar ou marcar como solucionado"
                    : "Ver e editar em Avaliações"}
                </Link>
              </p>
            </>
          ) : posso ? (
            <FormAvaliacao demandaId={demandaId} negocioId={negocio.id} />
          ) : (
            <p className="apoio text-dim">
              Avaliação liberada — quem publicou o pedido pode avaliar quem atendeu.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/** §14 — o formulário só existe onde o negócio já está confirmado pelos dois
 *  lados. Mesmo assim ele não é a trava: a policy de insert (migration 050)
 *  recusa a linha se a confirmação bilateral não estiver lá. */
function FormAvaliacao({ demandaId, negocioId }: { demandaId: string; negocioId: string }) {
  return (
    <form action={publicarAvaliacao} className="space-y-3">
      <input type="hidden" name="negocio_id" value={negocioId} />
      <input type="hidden" name="volta" value={`/marketplace/${demandaId}`} />
      <p className="titulo-card">Como foi?</p>
      <p className="apoio text-dim">
        Sua avaliação fica no perfil de quem atendeu, com a marca “{SELO_NEGOCIO_CONFIRMADO}”. Você pode
        editá-la por 30 dias.
      </p>
      <SeletorNota />
      <CampoTextarea
        label="Comentário (opcional)" id="comentario" name="comentario" rows={3} maxLength={800}
        placeholder="O que funcionou, o que não funcionou."
      />
      <button className="h-11 w-full rounded-xl bg-accent text-sm font-semibold text-acao-texto">
        Publicar avaliação
      </button>
    </form>
  )
}

/** §11.5 — cada tipo pergunta o que o PRD lista pra ele, e só isso. A lista
 *  vem de `CAMPOS_PROPOSTA` (domínio), então tela e gravação não podem
 *  divergir sobre o que aquele tipo aceita. */
function FormProposta({ demanda }: { demanda: Demanda }) {
  const tipo = demanda.tipo
  const usa = (c: Parameters<typeof propostaTem>[1]) => propostaTem(tipo, c)
  const substantivo = rotuloDaResposta(tipo)

  return (
    <form action={enviarProposta} className="mt-6 space-y-3">
      <input type="hidden" name="demanda_id" value={demanda.id} />
      <input type="hidden" name="tipo_demanda" value={tipo} />
      <p className="rotulo text-dim">Enviar {substantivo}</p>

      {usa("perfil_profissional") && (
        <p className="apoio rounded-lg border border-line bg-panel px-3 py-2 text-dim">
          Quem publicou vê o seu perfil profissional junto da candidatura. Mantenha-o atualizado em Prestadores.
        </p>
      )}

      {usa("tipo_vaga") && (
        <CampoSelect label="Tipo de vaga que você tem" id="tipo_vaga" name="tipo_vaga" defaultValue="molhada">
          <option value="molhada">Vaga molhada</option>
          <option value="seca">Vaga seca</option>
        </CampoSelect>
      )}

      {usa("marca_modelo") && (
        <Campo label="Marca e modelo" id="marca_modelo" name="marca_modelo" placeholder="Icom IC-M330" />
      )}

      {usa("condicao") && (
        <CampoSelect label="Condição" id="condicao" name="condicao" defaultValue="">
          <option value="">Não informar</option>
          {CONDICOES_PRODUTO.map((c) => <option key={c} value={c}>{ROTULO_CONDICAO[c]}</option>)}
        </CampoSelect>
      )}

      {usa("disponibilidade") && (
        <Campo
          label="Disponibilidade" id="disponibilidade" name="disponibilidade"
          placeholder={tipo === "vaga_embarcacao" ? "Tenho vaga a partir de setembro" : "Posso na próxima semana"}
        />
      )}

      {usa("periodo") && (
        <CampoSelect label="Cobrança" id="periodo" name="periodo" defaultValue="">
          <option value="">Não informar</option>
          {PERIODOS_VAGA.map((p) => <option key={p} value={p}>{ROTULO_PERIODO_VAGA[p]}</option>)}
        </CampoSelect>
      )}

      {usa("data_possivel") && (
        <Campo label="Data possível" id="data_possivel" name="data_possivel" type="date" />
      )}

      {usa("preco_litro") && (
        <Campo label="Preço por litro (R$)" id="preco_litro" name="preco_litro" inputMode="decimal" placeholder="6,40" />
      )}

      {usa("quantidade_litros") && (
        <Campo
          label="Quantidade que consegue entregar (L)" id="quantidade_litros" name="quantidade_litros"
          inputMode="numeric" placeholder="1500"
        />
      )}

      {usa("taxa_deslocamento") && (
        <Campo
          label="Taxa de deslocamento (R$)" id="taxa_deslocamento" name="taxa_deslocamento"
          inputMode="decimal" placeholder="0,00" dica="Deixe 0 se não cobra."
        />
      )}

      {usa("valor_estimado") && (
        <Campo
          label="Valor estimado total (R$)" id="valor_estimado" name="valor_estimado"
          inputMode="decimal" placeholder="9.600,00"
        />
      )}

      {usa("valor") && (
        <>
          <Campo label="Valor (R$)" id="valor" name="valor" inputMode="decimal" placeholder="850,00" />
          <label className="apoio flex items-center gap-2 text-dim">
            <input type="checkbox" name="valor_a_combinar" value="sim" className="size-4 accent-[#d4af37]" />
            Prefiro combinar o valor depois
          </label>
        </>
      )}

      {usa("entrega") && (
        <CampoSelect label="Entrega" id="entrega" name="entrega" defaultValue="">
          <option value="">Não informar</option>
          {FORMAS_ENTREGA.map((e) => <option key={e} value={e}>{ROTULO_ENTREGA[e]}</option>)}
        </CampoSelect>
      )}

      {usa("prazo_dias") && (
        <Campo label="Prazo (dias)" id="prazo_dias" name="prazo_dias" inputMode="numeric" placeholder="3" />
      )}

      {usa("agua_energia") && (
        <CampoSelect label="Água e energia na vaga" id="agua_energia" name="agua_energia" defaultValue="">
          <option value="">Não informar</option>
          <option value="sim">Tem água e energia</option>
          <option value="nao">Não tem</option>
        </CampoSelect>
      )}

      {usa("precisa_visita") && (
        <CampoSelect label="Precisa visitar o barco antes?" id="precisa_visita" name="precisa_visita" defaultValue="">
          <option value="">Não informar</option>
          <option value="sim">Sim, preciso ver antes de orçar</option>
          <option value="nao">Não, consigo resolver direto</option>
        </CampoSelect>
      )}

      <CampoTextarea
        label="Observação curta (opcional)" id="observacao" name="observacao" rows={3} maxLength={400}
        placeholder="O que os campos acima não cobriram."
      />

      <Campo
        label="Telefone / WhatsApp (opcional)" id="telefone" name="telefone" inputMode="tel"
        placeholder="21 99999-0000"
        dica="Aparece para quem publicou quando ele aceitar a sua resposta."
      />

      <button className="w-full rounded-xl bg-accent py-3.5 font-semibold text-acao-texto">
        Enviar {substantivo}
      </button>
    </form>
  )
}
