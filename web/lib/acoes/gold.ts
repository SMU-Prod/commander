"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import {
  AsaasRecusa, asaasConfigurado, cancelarCobrancaAvulsaAsaas, criarClienteAsaas, criarCobrancaAvulsaAsaas,
} from "@/lib/asaas"
import { carregarAssinatura, carregarPainel, hojeISO } from "@/lib/consultas"
import { ROTULO_FAIXA_PORTE, sugerirFaixaPorte } from "@/lib/domain/gold"
import { formatarPreco, precoGoldComDesconto } from "@/lib/domain/planos"
import { supabaseServer } from "@/lib/supabase/server"
import type { FaixaPorteGold, GoldPreco, GoldSolicitacao } from "@/lib/db/types"

/**
 * Ações do lado do dono/solicitante do Commander Gold (onda 35) — o fluxo
 * completo do PRD de Correções: SOLICITAR → PAGAMENTO → AGENDAMENTO →
 * AVALIAÇÃO PRESENCIAL → PROTOCOLO COMMANDER → ANÁLISE → APROVAÇÃO →
 * COMMANDER GOLD. As transições de `estado` sempre passam pela RPC
 * `gold_definir_estado` (migration 033) — nunca um `.update()` direto, ela é
 * quem valida autoridade + transição num lugar só.
 */

const FAIXAS_VALIDAS: readonly FaixaPorteGold[] = ["ate_30", "31_40", "41_50", "51_60", "61_80", "81_mais"]

function erroLista(msg: string): never {
  redirect(`/barco/selos/gold?erro=${encodeURIComponent(msg)}`)
}
function erroDetalhe(id: string, msg: string): never {
  redirect(`/barco/selos/gold/${id}?erro=${encodeURIComponent(msg)}`)
}
function okDetalhe(id: string, msg: string): never {
  redirect(`/barco/selos/gold/${id}?ok=${encodeURIComponent(msg)}`)
}

function revalidarGold(solicitacaoId?: string) {
  revalidatePath("/barco/selos/gold")
  revalidatePath("/barco/selos")
  revalidatePath("/barco")
  if (solicitacaoId) revalidatePath(`/barco/selos/gold/${solicitacaoId}`)
}

/** CPF: 11 dígitos após limpar máscara — mesma regra de `lib/acoes/assinatura.ts`. */
function cpfLimpo(bruto: string): string | null {
  const d = bruto.replace(/\D/g, "")
  return d.length === 11 ? d : null
}

function urlRetornoPosPagamentoGold(): string {
  return `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/barco/selos/gold`
}

/**
 * `solicitado` → `aguardando_pagamento`, a transição que travava o produto
 * inteiro (achado A-04 da auditoria de 19/08/2026).
 *
 * ---------------------------------------------------------------------------
 * O QUE ESTAVA ERRADO, E ONDE
 * ---------------------------------------------------------------------------
 * A RPC `gold_definir_estado` não tinha ramo para `aguardando_pagamento`:
 * caía no `else` e exigia `tem_papel_admin('suporte')`. Todo pedido de Gold
 * de cliente comum gravava a linha e parava em `solicitado`, com a tela
 * pedindo "recarregue e tente de novo" — muro de permissão vestido de erro
 * transitório. Recarregar nunca resolveu, e não resolveria nem com a chave do
 * Asaas ligada: o Gold era invendável por RLS, não por gateway.
 *
 * A migration 074 abre exatamente esta transição para o PRÓPRIO solicitante,
 * e só ela. Este arquivo continua sem tocar `estado` por `.update()` — a
 * autoridade segue toda na RPC, que é a regra da casa.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ISTO É UMA FUNÇÃO E NÃO DUAS CÓPIAS
 * ---------------------------------------------------------------------------
 * Os dois braços de `criarSolicitacaoGold` (minha embarcação / outra
 * embarcação) faziam a mesma chamada com o mesmo tratamento, copiado. Copiar
 * a transição é como a máquina de estados se espalha por três lugares e passa
 * a ter três versões — foi assim que o A-12 nasceu.
 */
async function avancarParaPagamento(
  supabase: Awaited<ReturnType<typeof supabaseServer>>, solicitacaoId: string,
): Promise<boolean> {
  const { error } = await supabase.rpc("gold_definir_estado", {
    p_solicitacao_id: solicitacaoId, p_novo_estado: "aguardando_pagamento",
  })
  if (error) {
    console.error(`[gold] não avançou ${solicitacaoId} para aguardando_pagamento:`, error.message)
    return false
  }
  return true
}

/** O que a pessoa lê quando a transição falha DEPOIS da 074 aplicada.
 *
 *  A frase antiga ("Recarregue e tente de novo") prometia que a próxima
 *  tentativa podia dar certo — e não podia. Esta admite que o pedido está
 *  guardado e que o caminho é falar com a equipe, sem inventar prazo. O
 *  redirect vai para o DETALHE, não para a lista: o pedido existe, tem número
 *  e estado, e mandar a pessoa para a lista faria parecer que se perdeu. */
const AVISO_NAO_AVANCOU =
  "Seu pedido está registrado, mas ainda não conseguimos liberar o pagamento. " +
  "A equipe Commander já consegue ver este pedido — você não precisa pedir de novo."

/**
 * Solicitar o Commander Gold — "minha embarcação" (o dono pede pra própria)
 * ou "outra embarcação" (Correção 09: interessado/comprador avaliando barco
 * de terceiro, sem cadastro no Commander). Nasce em `estado = 'solicitado'`
 * e já avança pra `aguardando_pagamento` — a tabela de preços é pública, não
 * há passo manual da equipe entre pedir e poder pagar.
 */
export async function criarSolicitacaoGold(formData: FormData) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")

  const tipo = String(formData.get("tipo") ?? "")
  const quemPaga = String(formData.get("quem_paga") ?? "") === "interessado" ? "interessado" : "proprio"
  const faixaBruta = String(formData.get("faixa_porte") ?? "") as FaixaPorteGold
  if (!FAIXAS_VALIDAS.includes(faixaBruta)) erroLista("Escolha o porte da embarcação.")

  if (tipo === "minha") {
    if (painel.papel !== "PROP") erroLista("Só o proprietário pode solicitar o Commander Gold da própria embarcação.")

    const { data: aberta } = await supabase
      .from("gold_solicitacoes").select("id, estado")
      .eq("embarcacao_id", painel.embarcacao.id)
      .order("criado_em", { ascending: false }).limit(1).maybeSingle()
    if (aberta && !["aprovado", "reprovado", "cancelado"].includes(aberta.estado)) {
      redirect(`/barco/selos/gold/${aberta.id}`)
    }

    const { data: inserida, error } = await supabase.from("gold_solicitacoes").insert({
      embarcacao_id: painel.embarcacao.id,
      faixa_porte: faixaBruta,
      solicitante_id: user.id,
      papel_solicitante: "proprietario",
      quem_paga: quemPaga,
    }).select("id")
    if (error || !inserida?.length) erroLista("Não foi possível registrar o pedido. Tente de novo.")

    const id = inserida![0].id as string
    revalidarGold(id)
    if (!(await avancarParaPagamento(supabase, id))) erroDetalhe(id, AVISO_NAO_AVANCOU)
    redirect(`/barco/selos/gold/${id}`)
  }

  // Outra embarcação — Correção 09 e §16 ("pode ser solicitado por
  // proprietário, vendedor ou interessado/comprador, inclusive para
  // embarcação ainda não cadastrada"). O vendedor é o corretor/dono que quer
  // o Gold pra vender melhor um barco que não está no Commander; até a
  // migration 050 ele era obrigado a se declarar "interessado", o que
  // falseava o relatório de quem pede avaliação.
  const papelSolicitante = String(formData.get("papel_solicitante") ?? "") === "vendedor"
    ? "vendedor"
    : "interessado"
  const nomeEmbarcacao = String(formData.get("embarcacao_externa_nome") ?? "").trim()
  if (!nomeEmbarcacao) erroLista("Informe o nome ou identificação da embarcação a avaliar.")
  const local = String(formData.get("embarcacao_externa_local") ?? "").trim() || null
  const obs = String(formData.get("embarcacao_externa_obs") ?? "").trim() || null

  const { data: inserida, error } = await supabase.from("gold_solicitacoes").insert({
    embarcacao_id: null,
    embarcacao_externa_nome: nomeEmbarcacao,
    embarcacao_externa_local: local,
    embarcacao_externa_obs: obs,
    faixa_porte: faixaBruta,
    solicitante_id: user.id,
    papel_solicitante: papelSolicitante,
    quem_paga: quemPaga,
  }).select("id")
  if (error || !inserida?.length) erroLista("Não foi possível registrar o pedido. Tente de novo.")

  const id = inserida![0].id as string
  revalidarGold(id)
  if (!(await avancarParaPagamento(supabase, id))) erroDetalhe(id, AVISO_NAO_AVANCOU)
  redirect(`/barco/selos/gold/${id}`)
}

/**
 * Pagamento da avaliação — cobre os dois braços da Correção 08 (EU /
 * INTERESSADO). Sem `ASAAS_API_KEY` configurada, a tela nunca finge que
 * abriu uma cobrança: registra o pedido de pagamento como pendente e avisa
 * honestamente que a contratação abre em breve (mesmo comportamento que a
 * vitrine já tinha antes desta onda, atrás da mesma flag dormente).
 */
export async function iniciarPagamentoGold(formData: FormData) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const solicitacaoId = String(formData.get("solicitacao_id") ?? "")
  const { data: solBruta } = await supabase.from("gold_solicitacoes").select("*").eq("id", solicitacaoId).maybeSingle()
  if (!solBruta) erroLista("Não encontramos essa solicitação.")
  const solicitacao = solBruta as GoldSolicitacao
  // A-04 — RESGATE DOS PEDIDOS QUE JÁ FICARAM PRESOS.
  //
  // Todo pedido feito antes da migration 074 parou em `solicitado` e não tem
  // como sair de lá sozinho: `iniciarPagamentoGold` exigia
  // `aguardando_pagamento` e a única forma de chegar lá era um admin. Com a
  // 074 aplicada, o próprio solicitante pode dar esse passo — então damos
  // aqui, em vez de obrigar a pessoa a abrir um pedido novo e deixar o antigo
  // apodrecendo na lista. Se ainda assim não avançar, a frase diz a verdade.
  if (solicitacao.estado === "solicitado") {
    if (!(await avancarParaPagamento(supabase, solicitacaoId))) {
      erroDetalhe(solicitacaoId, AVISO_NAO_AVANCOU)
    }
  } else if (solicitacao.estado !== "aguardando_pagamento") {
    erroDetalhe(solicitacaoId, "Esta solicitação não está aguardando pagamento.")
  }

  const nome = String(formData.get("nome") ?? "").trim()
  const email = String(formData.get("email") ?? "").trim()
  const cpf = cpfLimpo(String(formData.get("cpf") ?? ""))
  if (nome.length < 5 || !nome.includes(" ")) {
    erroDetalhe(solicitacaoId, `Informe o nome completo ${solicitacao.quem_paga === "proprio" ? "de quem vai pagar" : "de quem vai receber o link"}.`)
  }
  if (!email.includes("@")) erroDetalhe(solicitacaoId, "Informe um e-mail válido.")
  if (!cpf) erroDetalhe(solicitacaoId, "Informe um CPF válido (11 dígitos).")

  const { data: precoBruto } = await supabase.from("gold_precos").select("*").eq("faixa", solicitacao.faixa_porte).maybeSingle()
  const preco = precoBruto as GoldPreco | null
  const valorDeTabela = preco?.valor_centavos ?? null
  if (valorDeTabela == null) {
    erroDetalhe(solicitacaoId, `A faixa "${ROTULO_FAIXA_PORTE[solicitacao.faixa_porte]}" está sob consulta — fale com a equipe Commander para o valor.`)
  }

  // AUDITORIA 19/08, A20 — O DESCONTO QUE O BANCO GUARDAVA E NUNCA VIRAVA
  // PREÇO.
  //
  // O §2.1 promete "20% de desconto na avaliação para Commander Gold" a quem
  // está na promoção de migração. A linha existe em `assinatura_promocoes`,
  // `carregarAssinatura` já a lê e devolve `descontoGoldPercentual` — e
  // `precoGoldComDesconto`, escrita e testada, nunca rodava. A cobrança saía
  // pelo valor cheio: promessa comercial quebrada no único ponto em que ela
  // custa dinheiro de verdade a quem confiou nela.
  //
  // Aqui, e não na tela: este é o lugar onde o número vira COBRANÇA. Uma tela
  // que mostra o desconto e uma cobrança que não o aplica seria pior que
  // nenhuma das duas.
  //
  // `carregarAssinatura` lê a promoção da pessoa LOGADA por RLS — e é a
  // pessoa logada que solicitou. Quando `quem_paga` é "interessado", o
  // desconto continua sendo o de quem pediu: a promoção é do cliente
  // Commander, não de quem ele indicou para pagar.
  const { promocao } = await carregarAssinatura()
  const valorCentavos = precoGoldComDesconto(
    valorDeTabela,
    promocao ? { promocao: promocao.promocao, validoAte: promocao.validoAte } : null,
    hojeISO(),
  )
  const avisoDesconto = valorCentavos < valorDeTabela
    ? ` (de ${formatarPreco(valorDeTabela)} por ${formatarPreco(valorCentavos)}, com o desconto da sua promoção)`
    : ""

  if (!asaasConfigurado()) {
    const { data: inserido, error } = await supabase.from("gold_pagamentos").insert({
      solicitacao_id: solicitacaoId,
      quem_paga: solicitacao.quem_paga,
      valor_centavos: valorCentavos,
      status: "pendente",
    }).select("id")
    if (error || !inserido?.length) erroDetalhe(solicitacaoId, "Não foi possível registrar o pagamento agora. Tente de novo.")
    revalidarGold(solicitacaoId)
    okDetalhe(
      solicitacaoId,
      "A contratação da avaliação Commander Gold abre em breve. Já registramos seu interesse — " +
        "a equipe Commander entra em contato assim que o pagamento estiver disponível.",
    )
  }

  let customerId: string
  try {
    customerId = await criarClienteAsaas({ nome, email, cpfCnpj: cpf })
  } catch (e) {
    if (e instanceof AsaasRecusa) erroDetalhe(solicitacaoId, `O sistema de pagamento recusou os dados: ${e.message}`)
    erroDetalhe(solicitacaoId, "Não foi possível falar com o sistema de pagamento. Tente de novo em instantes.")
  }

  let cobranca: { id: string; invoiceUrl: string | null }
  try {
    cobranca = await criarCobrancaAvulsaAsaas({
      customerId,
      valorCentavos,
      descricao: `Commander Gold — avaliação presencial (${ROTULO_FAIXA_PORTE[solicitacao.faixa_porte]})`,
      externalReference: solicitacaoId,
      urlRetorno: urlRetornoPosPagamentoGold(),
    })
  } catch (e) {
    if (e instanceof AsaasRecusa) erroDetalhe(solicitacaoId, `O sistema de pagamento recusou os dados: ${e.message}`)
    erroDetalhe(solicitacaoId, "Não foi possível gerar a cobrança agora. Tente de novo em instantes.")
  }

  const { data: inserido, error } = await supabase.from("gold_pagamentos").insert({
    solicitacao_id: solicitacaoId,
    quem_paga: solicitacao.quem_paga,
    valor_centavos: valorCentavos,
    status: "pendente",
    asaas_customer_id: customerId,
    asaas_payment_id: cobranca.id,
    link_pagamento: cobranca.invoiceUrl,
  }).select("id")
  if (error || !inserido?.length) {
    await cancelarCobrancaAvulsaAsaas(cobranca.id).catch(() => {})
    erroDetalhe(solicitacaoId, "Não foi possível registrar o pagamento. Tente de novo.")
  }

  revalidarGold(solicitacaoId)
  // O desconto aplicado é DITO, não só cobrado: a tela de detalhe mostra o
  // preço de tabela da faixa, e uma cobrança menor sem explicação pareceria
  // erro. Vazio quando não houve desconto.
  if (solicitacao.quem_paga === "proprio") {
    if (cobranca.invoiceUrl) redirect(cobranca.invoiceUrl)
    okDetalhe(solicitacaoId, `Cobrança criada${avisoDesconto} — o link de pagamento chega por e-mail.`)
  }
  // Interessado: não redireciona pra fora — a tela mostra o link/QR pra compartilhar.
  okDetalhe(solicitacaoId, `Link de pagamento gerado${avisoDesconto} — copie e envie para quem vai pagar.`)
}

/** Cancelamento — dono da embarcação vinculada ou o próprio solicitante,
 *  a qualquer momento antes do resultado final (RLS/RPC decidem, não a UI). */
export async function cancelarSolicitacaoGold(formData: FormData) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const solicitacaoId = String(formData.get("solicitacao_id") ?? "")
  const { error } = await supabase.rpc("gold_definir_estado", {
    p_solicitacao_id: solicitacaoId, p_novo_estado: "cancelado",
  })
  if (error) erroDetalhe(solicitacaoId, "Não foi possível cancelar agora. Tente de novo.")

  revalidarGold(solicitacaoId)
  redirect(`/barco/selos/gold?ok=${encodeURIComponent("Pedido cancelado")}`)
}

export { sugerirFaixaPorte }
