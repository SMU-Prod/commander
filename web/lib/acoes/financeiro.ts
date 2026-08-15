"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { subirArquivo } from "@/lib/acervo"
import { carregarNivelPlano, carregarPainel, hojeISO } from "@/lib/consultas"
import {
  CATEGORIAS_FINANCEIRAS, FORMAS_PAGAMENTO, FREQUENCIAS, TIPOS_LANCAMENTO,
  centavosDeReais, validarLancamento, validarRecorrente,
  type CategoriaFinanceira, type FormaPagamento, type Frequencia, type TipoLancamento,
} from "@/lib/domain/financeiro"
import { parseDecimalPtBr } from "@/lib/domain/numeros"
import { podeEditar } from "@/lib/domain/permissoes"
import { mensagemBloqueio, recursoLiberado } from "@/lib/domain/plano-acesso"
import { supabaseServer } from "@/lib/supabase/server"
import type { RecorrenciaFinanceira } from "@/lib/db/types"

/**
 * Server actions do Financeiro (onda 42, PRD FINAL §9.1–9.3).
 *
 * Padrão da casa aplicado em todas: guard NA TELA, guard AQUI e RLS no banco
 * (ver `lib/acoes/itens.ts`). O guard aqui não é redundante — um POST direto,
 * ou uma aba aberta desde antes de o acesso ser revogado, não passa pela
 * tela; e a RLS sozinha barra em silêncio, fazendo o app anunciar "salvo"
 * pra algo que não foi salvo. Por isso todo insert/update leva `.select()` e
 * a checagem do que voltou.
 *
 * A área de permissão é `gastos` — chave antiga, rótulo "Financeiro"
 * (ver `lib/domain/permissoes.ts`).
 */

function erroNovo(tipo: string, msg: string): never {
  redirect(`/financeiro/novo?tipo=${tipo}&erro=${encodeURIComponent(msg)}`)
}
function erroLancamento(id: string, msg: string): never {
  redirect(`/financeiro/lancamentos/${id}?erro=${encodeURIComponent(msg)}`)
}
function erroRecorrenteNova(msg: string): never {
  redirect(`/financeiro/recorrentes/nova?erro=${encodeURIComponent(msg)}`)
}
function erroRecorrente(id: string, msg: string): never {
  redirect(`/financeiro/recorrentes/${id}?erro=${encodeURIComponent(msg)}`)
}

function revalidarFinanceiro() {
  revalidatePath("/financeiro")
  revalidatePath("/financeiro/lancamentos")
  revalidatePath("/financeiro/recorrentes")
  revalidatePath("/financeiro/relatorios")
  // /hoje mostra o cartão do mês e lê da mesma fonte desde a onda 42.
  revalidatePath("/hoje")
  revalidatePath("/barco")
}

function ler(formData: FormData) {
  return (k: string) => {
    const v = String(formData.get(k) ?? "").trim()
    return v === "" ? null : v
  }
}

function opcao<T extends string>(valor: string | null, lista: readonly T[]): T | null {
  return valor != null && (lista as readonly string[]).includes(valor) ? (valor as T) : null
}

/** Campos comuns a lançamento e recorrente. Devolve os valores já
 *  normalizados; quem chama decide a mensagem de erro (cada tela volta pra
 *  um lugar diferente). */
function camposDoFormulario(formData: FormData) {
  const texto = ler(formData)
  const valorBruto = texto("valor")
  const reais = valorBruto != null ? parseDecimalPtBr(valorBruto) : null
  return {
    tipo: opcao<TipoLancamento>(texto("tipo"), TIPOS_LANCAMENTO),
    categoria: opcao<CategoriaFinanceira>(texto("categoria"), CATEGORIAS_FINANCEIRAS),
    descricao: texto("descricao"),
    valorCentavos: centavosDeReais(reais),
    data: texto("data") ?? hojeISO(),
    fornecedor: texto("fornecedor"),
    formaPagamento: opcao<FormaPagamento>(texto("forma_pagamento"), FORMAS_PAGAMENTO),
    observacao: texto("observacao"),
    // "pago/pendente ou recebido/pendente" — a caixa da tela marca "já foi
    // pago/recebido"; desmarcada, o lançamento fica pendente. O PRD é firme
    // em que orçamento NÃO é despesa: pendente aqui é conta assumida, e o
    // texto da tela diz isso.
    status: formData.get("pago") != null ? ("pago" as const) : ("pendente" as const),
  }
}

export async function criarLancamento(formData: FormData) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")

  const c = camposDoFormulario(formData)
  const tipoUrl = c.tipo ?? "despesa"
  if (!podeEditar(painel.permissoes, "gastos")) {
    erroNovo(tipoUrl, "Seu acesso não permite lançar no Financeiro.")
  }
  // §2.3 — no Free o Financeiro é visível como estrutura, mas o lançamento
  // fica bloqueado. Permissão primeiro, plano depois: quem não tem acesso a
  // gastos não recebe convite de upgrade pra algo que não é dele.
  if (!recursoLiberado("financeiro_lancar", await carregarNivelPlano())) {
    erroNovo(tipoUrl, mensagemBloqueio("financeiro_lancar").descricao)
  }
  const v = validarLancamento(c)
  if (!v.ok) erroNovo(tipoUrl, v.erro)

  let comprovante: string | null = null
  const arquivo = formData.get("comprovante")
  if (arquivo instanceof File && arquivo.size > 0) {
    const r = await subirArquivo(supabase, painel.embarcacao.id, "financeiro", arquivo)
    if ("erro" in r) erroNovo(tipoUrl, r.erro)
    else comprovante = r.path
  }

  // Evento do Diário virando lançamento ("Adicionar ao Financeiro", PRD
  // §9.1: "cria o mesmo lançamento central, não uma cópia"). O índice único
  // em `evento_id` faz o segundo clique esbarrar no banco em vez de somar
  // duas vezes na tela.
  const eventoId = ler(formData)("evento_id")
  if (eventoId) {
    const { data: evento } = await supabase.from("eventos")
      .select("id").eq("id", eventoId).eq("embarcacao_id", painel.embarcacao.id).maybeSingle()
    if (!evento) erroNovo(tipoUrl, "Esse registro do Diário não existe mais. Atualize a página.")
  }

  const { data: criado, error } = await supabase.from("lancamentos_financeiros").insert({
    embarcacao_id: painel.embarcacao.id,
    tipo: c.tipo,
    categoria: c.categoria,
    descricao: c.descricao,
    valor_centavos: c.valorCentavos,
    data: c.data,
    status: c.status,
    fornecedor: c.fornecedor,
    forma_pagamento: c.formaPagamento,
    comprovante_path: comprovante,
    observacao: c.observacao,
    evento_id: eventoId,
    criado_por: user.id,
  }).select("id").maybeSingle()

  if (error || !criado) {
    if (comprovante) await supabase.storage.from("acervo").remove([comprovante])
    if (error?.code === "23505") {
      erroNovo(tipoUrl, "Esse gasto do Diário já está no Financeiro — ele não entra duas vezes.")
    }
    erroNovo(tipoUrl, "Não deu para salvar o lançamento agora. Tente de novo em instantes.")
  }

  revalidarFinanceiro()
  redirect(`/financeiro/lancamentos?ok=${encodeURIComponent(c.tipo === "entrada" ? "Entrada registrada" : "Despesa registrada")}`)
}

export async function salvarLancamento(formData: FormData) {
  const supabase = await supabaseServer()
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const id = String(formData.get("lancamento_id") ?? "")
  if (!podeEditar(painel.permissoes, "gastos")) {
    erroLancamento(id, "Seu acesso não permite alterar o Financeiro.")
  }

  const c = camposDoFormulario(formData)
  const v = validarLancamento(c)
  if (!v.ok) erroLancamento(id, v.erro)

  const { data, error } = await supabase.from("lancamentos_financeiros").update({
    tipo: c.tipo,
    categoria: c.categoria,
    descricao: c.descricao,
    valor_centavos: c.valorCentavos,
    data: c.data,
    status: c.status,
    fornecedor: c.fornecedor,
    forma_pagamento: c.formaPagamento,
    observacao: c.observacao,
  }).eq("id", id).eq("embarcacao_id", painel.embarcacao.id).select("id").maybeSingle()
  if (error || !data) erroLancamento(id, "Não deu para salvar agora. Tente de novo em instantes.")

  revalidarFinanceiro()
  revalidatePath(`/financeiro/lancamentos/${id}`)
  redirect(`/financeiro/lancamentos?ok=${encodeURIComponent("Lançamento salvo")}`)
}

/** Marcar pago/recebido (ou voltar pra pendente). O PRD §9.2 insiste que
 *  "um vencimento não é automaticamente pago" — este é o botão que existe
 *  justamente pra que a confirmação seja um ato de alguém. */
export async function alternarStatusLancamento(formData: FormData) {
  const supabase = await supabaseServer()
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const id = String(formData.get("lancamento_id") ?? "")
  if (!podeEditar(painel.permissoes, "gastos")) {
    erroLancamento(id, "Seu acesso não permite alterar o Financeiro.")
  }
  const novo = String(formData.get("status") ?? "") === "pago" ? "pago" : "pendente"

  const { data, error } = await supabase.from("lancamentos_financeiros")
    .update({ status: novo }).eq("id", id).eq("embarcacao_id", painel.embarcacao.id)
    .select("id, tipo").maybeSingle()
  if (error || !data) erroLancamento(id, "Não deu para atualizar agora. Tente de novo em instantes.")

  revalidarFinanceiro()
  revalidatePath(`/financeiro/lancamentos/${id}`)
  const ok = novo === "pendente"
    ? "Voltou para pendente"
    : data.tipo === "entrada" ? "Marcado como recebido" : "Marcado como pago"
  redirect(`/financeiro/lancamentos?ok=${encodeURIComponent(ok)}`)
}

export async function excluirLancamento(formData: FormData) {
  const supabase = await supabaseServer()
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const id = String(formData.get("lancamento_id") ?? "")
  if (!podeEditar(painel.permissoes, "gastos")) {
    erroLancamento(id, "Seu acesso não permite excluir lançamentos.")
  }

  // Gasto que veio da Carteira não se apaga por aqui: ele é a contrapartida
  // de um movimento que o tripulante registrou e o proprietário confirmou.
  // Apagar só o lado do Financeiro deixaria o extrato da Carteira apontando
  // pra uma despesa que não existe mais.
  const { data: atual } = await supabase.from("lancamentos_financeiros")
    .select("carteira_movimento_id, comprovante_path")
    .eq("id", id).eq("embarcacao_id", painel.embarcacao.id).maybeSingle()
  if (atual?.carteira_movimento_id) {
    erroLancamento(id, "Este gasto veio da Carteira da Tripulação. Ajuste por lá, no extrato do tripulante.")
  }

  const { data, error } = await supabase.from("lancamentos_financeiros")
    .delete().eq("id", id).eq("embarcacao_id", painel.embarcacao.id).select("id")
  if (error || !data?.length) erroLancamento(id, "Não deu para excluir agora. Tente de novo em instantes.")
  if (atual?.comprovante_path) await supabase.storage.from("acervo").remove([atual.comprovante_path])

  revalidarFinanceiro()
  redirect(`/financeiro/lancamentos?ok=${encodeURIComponent("Lançamento excluído")}`)
}

export async function criarRecorrente(formData: FormData) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (!podeEditar(painel.permissoes, "gastos")) {
    erroRecorrenteNova("Seu acesso não permite criar recorrentes.")
  }
  // §2.3 — mesmo portão do lançamento avulso: recorrente é lançamento.
  if (!recursoLiberado("financeiro_lancar", await carregarNivelPlano())) {
    erroRecorrenteNova(mensagemBloqueio("financeiro_lancar").descricao)
  }

  const texto = ler(formData)
  const c = camposDoFormulario(formData)
  const frequencia = opcao<Frequencia>(texto("frequencia"), FREQUENCIAS)
  const fim = texto("fim")
  const v = validarRecorrente({ ...c, frequencia, fim })
  if (!v.ok) erroRecorrenteNova(v.erro)

  const { data: criada, error } = await supabase.from("recorrencias_financeiras").insert({
    embarcacao_id: painel.embarcacao.id,
    tipo: c.tipo,
    categoria: c.categoria,
    descricao: c.descricao,
    valor_centavos: c.valorCentavos,
    frequencia,
    inicio: c.data,
    fim,
    fornecedor: c.fornecedor,
    forma_pagamento: c.formaPagamento,
    observacao: c.observacao,
    criado_por: user.id,
  }).select("id").maybeSingle()
  if (error || !criada) erroRecorrenteNova("Não deu para salvar a recorrente agora. Tente de novo em instantes.")

  revalidarFinanceiro()
  redirect(`/financeiro/recorrentes?ok=${encodeURIComponent("Recorrente criada")}`)
}

/**
 * Mudança de valor de uma recorrente — o ponto fino do PRD §9.2:
 * "Alteração de valor permite 'somente este lançamento' ou 'este e os
 * próximos'".
 *
 *  · SOMENTE ESTE: grava um lançamento avulso daquele vencimento com o
 *    valor novo. Como o vencimento gerado em memória some da lista assim
 *    que existe linha pra ele (índice único recorrencia_id + data), a série
 *    continua intacta e só aquele mês sai diferente.
 *  · ESTE E OS PRÓXIMOS: FECHA a série no dia anterior e abre outra, com o
 *    valor novo, a partir daquela data (`origem_id` liga as duas). Assim o
 *    histórico do que se pagava antes continua verdadeiro — sobrescrever o
 *    valor da série faria o app dizer que a vaga da marina sempre custou o
 *    preço de hoje.
 */
export async function alterarValorRecorrente(formData: FormData) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const id = String(formData.get("recorrencia_id") ?? "")
  if (!podeEditar(painel.permissoes, "gastos")) {
    erroRecorrente(id, "Seu acesso não permite alterar recorrentes.")
  }

  const texto = ler(formData)
  const reais = parseDecimalPtBr(texto("valor") ?? "")
  const valorCentavos = centavosDeReais(reais)
  if (valorCentavos == null || valorCentavos <= 0) {
    erroRecorrente(id, "Informe um valor maior que zero (ex.: 1.850,00).")
  }
  const data = texto("data")
  if (!data) erroRecorrente(id, "Escolha a partir de qual vencimento o valor muda.")
  const escopo = texto("escopo") === "proximos" ? "proximos" : "somente_este"

  const { data: bruta } = await supabase.from("recorrencias_financeiras")
    .select("*").eq("id", id).eq("embarcacao_id", painel.embarcacao.id).maybeSingle()
  const rec = bruta as RecorrenciaFinanceira | null
  if (!rec) erroRecorrente(id, "Essa recorrente não existe mais. Atualize a página.")

  if (escopo === "somente_este") {
    const { error } = await supabase.from("lancamentos_financeiros").insert({
      embarcacao_id: rec.embarcacao_id,
      tipo: rec.tipo,
      categoria: rec.categoria,
      descricao: rec.descricao,
      valor_centavos: valorCentavos,
      data,
      status: "pendente",
      fornecedor: rec.fornecedor,
      forma_pagamento: rec.forma_pagamento,
      observacao: rec.observacao,
      recorrencia_id: rec.id,
      criado_por: user.id,
    }).select("id")
    if (error) {
      erroRecorrente(id, error.code === "23505"
        ? "Esse vencimento já tem lançamento próprio. Edite ele direto em Lançamentos."
        : "Não deu para salvar agora. Tente de novo em instantes.")
    }
    revalidarFinanceiro()
    redirect(`/financeiro/recorrentes?ok=${encodeURIComponent("Valor ajustado só neste vencimento")}`)
  }

  // "este e os próximos": mudar a partir do PRIMEIRO vencimento da série é
  // só corrigir o valor dela — não há histórico anterior pra preservar, e
  // criar uma série de um dia seria ruído.
  if (data <= rec.inicio) {
    const { data: salva, error } = await supabase.from("recorrencias_financeiras")
      .update({ valor_centavos: valorCentavos }).eq("id", rec.id).select("id").maybeSingle()
    if (error || !salva) erroRecorrente(id, "Não deu para salvar agora. Tente de novo em instantes.")
    revalidarFinanceiro()
    redirect(`/financeiro/recorrentes?ok=${encodeURIComponent("Valor atualizado")}`)
  }

  const diaAnterior = new Date(Date.parse(`${data}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10)
  const { data: fechada, error: erroFechar } = await supabase.from("recorrencias_financeiras")
    .update({ fim: diaAnterior }).eq("id", rec.id).select("id").maybeSingle()
  if (erroFechar || !fechada) erroRecorrente(id, "Não deu para salvar agora. Tente de novo em instantes.")

  const { error: erroNova } = await supabase.from("recorrencias_financeiras").insert({
    embarcacao_id: rec.embarcacao_id,
    tipo: rec.tipo,
    categoria: rec.categoria,
    descricao: rec.descricao,
    valor_centavos: valorCentavos,
    frequencia: rec.frequencia,
    inicio: data,
    fim: rec.fim,
    fornecedor: rec.fornecedor,
    forma_pagamento: rec.forma_pagamento,
    observacao: rec.observacao,
    origem_id: rec.id,
    criado_por: user.id,
  }).select("id")
  if (erroNova) {
    // Volta a série antiga ao que era: melhor não ter feito nada do que
    // deixar a recorrente encerrada sem a substituta.
    await supabase.from("recorrencias_financeiras").update({ fim: rec.fim }).eq("id", rec.id)
    erroRecorrente(id, "Não deu para salvar agora. Tente de novo em instantes.")
  }

  revalidarFinanceiro()
  redirect(`/financeiro/recorrentes?ok=${encodeURIComponent("Valor alterado deste vencimento em diante")}`)
}

/** Encerrar (ou reativar) uma série. Nunca apaga: os vencimentos já pagos
 *  são lançamentos de verdade e continuam no extrato. */
export async function alternarRecorrente(formData: FormData) {
  const supabase = await supabaseServer()
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const id = String(formData.get("recorrencia_id") ?? "")
  if (!podeEditar(painel.permissoes, "gastos")) {
    erroRecorrente(id, "Seu acesso não permite alterar recorrentes.")
  }
  const ativa = String(formData.get("ativa") ?? "") === "1"

  const { data, error } = await supabase.from("recorrencias_financeiras")
    .update({ ativa }).eq("id", id).eq("embarcacao_id", painel.embarcacao.id).select("id").maybeSingle()
  if (error || !data) erroRecorrente(id, "Não deu para atualizar agora. Tente de novo em instantes.")

  revalidarFinanceiro()
  redirect(`/financeiro/recorrentes?ok=${encodeURIComponent(ativa ? "Recorrente reativada" : "Recorrente encerrada")}`)
}

/** Marcar um vencimento como pago/recebido. É AQUI que o vencimento vira
 *  linha no banco pela primeira vez: até este clique ele só existia
 *  calculado (`vencimentosNoIntervalo`), porque o PRD proíbe considerar
 *  pago o que ninguém confirmou. */
export async function marcarVencimentoPago(formData: FormData) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const id = String(formData.get("recorrencia_id") ?? "")
  if (!podeEditar(painel.permissoes, "gastos")) {
    erroRecorrente(id, "Seu acesso não permite lançar no Financeiro.")
  }
  const data = String(formData.get("data") ?? "")
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) erroRecorrente(id, "Vencimento inválido. Atualize a página.")

  const { data: bruta } = await supabase.from("recorrencias_financeiras")
    .select("*").eq("id", id).eq("embarcacao_id", painel.embarcacao.id).maybeSingle()
  const rec = bruta as RecorrenciaFinanceira | null
  if (!rec) erroRecorrente(id, "Essa recorrente não existe mais. Atualize a página.")

  const { error } = await supabase.from("lancamentos_financeiros").insert({
    embarcacao_id: rec.embarcacao_id,
    tipo: rec.tipo,
    categoria: rec.categoria,
    descricao: rec.descricao,
    valor_centavos: rec.valor_centavos,
    data,
    status: "pago",
    fornecedor: rec.fornecedor,
    forma_pagamento: rec.forma_pagamento,
    observacao: rec.observacao,
    recorrencia_id: rec.id,
    criado_por: user.id,
  }).select("id")
  if (error) {
    erroRecorrente(id, error.code === "23505"
      ? "Esse vencimento já foi lançado."
      : "Não deu para salvar agora. Tente de novo em instantes.")
  }

  revalidarFinanceiro()
  redirect(`/financeiro/recorrentes?ok=${encodeURIComponent(rec.tipo === "entrada" ? "Entrada registrada" : "Vencimento pago")}`)
}
