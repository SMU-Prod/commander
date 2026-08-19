"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { subirArquivo } from "@/lib/acervo"
import { carregarPainel, hojeISO } from "@/lib/consultas"
import {
  MODOS_CARTEIRA, saldoCarteira, statusInicialMovimento, validarMovimento, type ModoCarteira,
} from "@/lib/domain/carteira"
import { CATEGORIAS_FINANCEIRAS, centavosDeReais, type CategoriaFinanceira } from "@/lib/domain/financeiro"
import { parseDecimalPtBr } from "@/lib/domain/numeros"
import { podeEditar } from "@/lib/domain/permissoes"
import { supabaseServer } from "@/lib/supabase/server"
import type { Carteira, CarteiraMovimento } from "@/lib/db/types"

/**
 * Server actions da Carteira da Tripulação (onda 42, PRD FINAL §9.4).
 *
 * Divisão de responsabilidade com o banco, de propósito:
 *   · REPASSE e DEVOLUÇÃO são inserts normais, barrados pela RLS da
 *     migration 043 (repasse só do proprietário; devolução do tripulante
 *     nasce pendente de confirmação).
 *   · GASTO e DECISÃO passam por função `security definer`
 *     (`carteira_registrar_gasto` / `carteira_decidir_movimento`). Não é
 *     preciosismo: um gasto aprovado tem que virar despesa no Financeiro no
 *     mesmo ato, e o tripulante normalmente NÃO tem a área `gastos` (o PRD
 *     diz que as duas permissões são independentes). Sem a função, ou o
 *     gasto não alimentaria o Financeiro, ou seria preciso dar ao
 *     tripulante um acesso ao dinheiro do barco que o PRD não previu.
 *
 * As validações do domínio (`validarMovimento`) rodam aqui pra dar mensagem
 * boa; o banco valida de novo por conta própria — quem manda é ele.
 */

function erroCarteira(id: string, msg: string): never {
  redirect(`/carteira/${id}?erro=${encodeURIComponent(msg)}`)
}
function erroLista(msg: string): never {
  redirect(`/carteira?erro=${encodeURIComponent(msg)}`)
}

function revalidarCarteira(id?: string) {
  revalidatePath("/carteira")
  if (id) revalidatePath(`/carteira/${id}`)
  // Gasto aprovado vira despesa lá — as duas telas mostram o mesmo dinheiro.
  revalidatePath("/financeiro")
  revalidatePath("/financeiro/lancamentos")
  revalidatePath("/hoje")
}

function texto(formData: FormData) {
  return (k: string) => {
    const v = String(formData.get(k) ?? "").trim()
    return v === "" ? null : v
  }
}

/** Carrega a carteira + movimentos e diz quem é quem. Toda action usa —
 *  saber se quem chamou é o proprietário muda o que pode fazer. */
async function contexto(carteiraId: string) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")

  const { data: bruta } = await supabase.from("carteiras").select("*").eq("id", carteiraId).maybeSingle()
  const carteira = bruta as Carteira | null
  if (!carteira) erroLista("Essa carteira não existe mais. Atualize a página.")

  const { data: movs } = await supabase.from("carteira_movimentos")
    .select("*").eq("carteira_id", carteira.id).order("data", { ascending: false })
  const movimentos = (movs ?? []) as CarteiraMovimento[]

  return {
    supabase, user, painel, carteira, movimentos,
    ehProprietario: painel.papel === "PROP" && painel.embarcacao.id === carteira.embarcacao_id,
    saldo: saldoCarteira(movimentos.map((m) => ({
      tipo: m.tipo, valorCentavos: m.valor_centavos, status: m.status,
    }))),
  }
}

/** Só o proprietário cria/libera uma Carteira, "para um tripulante
 *  específico em uma embarcação específica" (PRD §9.4). */
export async function criarCarteira(formData: FormData) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (painel.papel !== "PROP") erroLista("Só o proprietário libera uma Carteira.")

  const t = texto(formData)
  const tripulanteId = t("tripulante_id")
  if (!tripulanteId) redirect(`/carteira/nova?erro=${encodeURIComponent("Escolha para quem é a Carteira.")}`)

  // O tripulante precisa ter vínculo com ESTA embarcação — a RLS repete a
  // checagem, mas aqui a mensagem consegue explicar o que houve.
  const { data: vinculo } = await supabase.from("vinculos")
    .select("id").eq("embarcacao_id", painel.embarcacao.id).eq("usuario_id", tripulanteId).maybeSingle()
  if (!vinculo) {
    redirect(`/carteira/nova?erro=${encodeURIComponent("Essa pessoa não está na tripulação desta embarcação.")}`)
  }

  const modo = ((): ModoCarteira => {
    const v = t("modo")
    return (MODOS_CARTEIRA as readonly string[]).includes(v ?? "") ? (v as ModoCarteira) : "aprovacao"
  })()

  const { data: criada, error } = await supabase.from("carteiras").insert({
    embarcacao_id: painel.embarcacao.id,
    tripulante_id: tripulanteId,
    modo,
    exige_comprovante: formData.get("exige_comprovante") != null,
    observacao: t("observacao"),
    criado_por: user.id,
  }).select("id").maybeSingle()
  if (error || !criada) {
    redirect(`/carteira/nova?erro=${encodeURIComponent(
      error?.code === "23505"
        ? "Essa pessoa já tem Carteira nesta embarcação."
        : "Não deu para criar a Carteira agora. Tente de novo em instantes.",
    )}`)
  }

  revalidarCarteira(criada.id)
  redirect(`/carteira/${criada.id}?ok=${encodeURIComponent("Carteira liberada")}`)
}

/** Regras da carteira: comprovante obrigatório ou opcional, Registro Direto
 *  ou Aprovação do Proprietário (PRD §9.4), e encerrar/reabrir. */
export async function salvarRegrasCarteira(formData: FormData) {
  const id = String(formData.get("carteira_id") ?? "")
  const { supabase, ehProprietario } = await contexto(id)
  if (!ehProprietario) erroCarteira(id, "Só o proprietário muda as regras da Carteira.")

  const t = texto(formData)
  const modo = ((): ModoCarteira => {
    const v = t("modo")
    return (MODOS_CARTEIRA as readonly string[]).includes(v ?? "") ? (v as ModoCarteira) : "aprovacao"
  })()

  const { data, error } = await supabase.from("carteiras").update({
    modo,
    exige_comprovante: formData.get("exige_comprovante") != null,
    ativa: formData.get("ativa") != null,
    observacao: t("observacao"),
  }).eq("id", id).select("id").maybeSingle()
  if (error || !data) erroCarteira(id, "Não deu para salvar as regras agora. Tente de novo em instantes.")

  revalidarCarteira(id)
  redirect(`/carteira/${id}?ok=${encodeURIComponent("Regras salvas")}`)
}

/** Repasse: dinheiro entregue pelo proprietário. NÃO é despesa — o PRD é
 *  explícito ("vira saldo sob responsabilidade do tripulante"), então nada
 *  é lançado no Financeiro aqui. A despesa nasce quando o dinheiro for
 *  gasto, com a categoria do que foi comprado. */
export async function registrarRepasse(formData: FormData) {
  const id = String(formData.get("carteira_id") ?? "")
  const { supabase, user, carteira, ehProprietario } = await contexto(id)
  if (!ehProprietario) erroCarteira(id, "Só o proprietário registra repasse.")
  if (!carteira.ativa) erroCarteira(id, "Esta carteira está encerrada. Reabra nas regras para movimentar.")

  const t = texto(formData)
  const valorCentavos = centavosDeReais(parseDecimalPtBr(t("valor") ?? ""))
  const descricao = t("descricao") ?? "Repasse"
  if (valorCentavos == null || valorCentavos <= 0) {
    erroCarteira(id, "Informe um valor maior que zero (ex.: 500,00).")
  }

  const { data, error } = await supabase.from("carteira_movimentos").insert({
    carteira_id: id,
    tipo: "repasse",
    valor_centavos: valorCentavos,
    data: t("data") ?? hojeISO(),
    descricao,
    observacao: t("observacao"),
    // A20 — `"aprovado"` estava fixo aqui. Dá no mesmo HOJE, porque a linha 160
    // acima só deixa o proprietário repassar, e proprietário não espera
    // aprovação de si mesmo. O literal era o problema: ele guardava essa
    // dependência sem dizer, e no dia em que o §9.4 deixar o CMDT repassar,
    // esta linha continua gravando "aprovado" sem nenhum teste reclamar.
    status: statusInicialMovimento({ tipo: "repasse", modo: carteira.modo, ehProprietario }),
    criado_por: user.id,
    decidido_por: user.id,
    decidido_em: new Date().toISOString(),
  }).select("id").maybeSingle()
  if (error || !data) erroCarteira(id, "Não deu para registrar o repasse agora. Tente de novo em instantes.")

  revalidarCarteira(id)
  redirect(`/carteira/${id}?ok=${encodeURIComponent("Repasse registrado")}`)
}

/** Gasto do tripulante: reduz o saldo e alimenta o Financeiro da embarcação
 *  (PRD §9.4). Quem escreve é a função do banco — ver o comentário no topo
 *  deste arquivo. */
export async function registrarGasto(formData: FormData) {
  const id = String(formData.get("carteira_id") ?? "")
  const { supabase, painel, carteira, ehProprietario, saldo } = await contexto(id)

  const podeUsar = ehProprietario
    || (painel.embarcacao.id === carteira.embarcacao_id && podeEditar(painel.permissoes, "carteira"))
  if (!podeUsar) erroCarteira(id, "Seu acesso não permite registrar gastos nesta Carteira.")
  if (!carteira.ativa) erroCarteira(id, "Esta carteira está encerrada e não aceita novos gastos.")

  const t = texto(formData)
  const valorCentavos = centavosDeReais(parseDecimalPtBr(t("valor") ?? ""))
  const descricao = t("descricao")
  const categoriaBruta = t("categoria")
  const categoria = (CATEGORIAS_FINANCEIRAS as readonly string[]).includes(categoriaBruta ?? "")
    ? (categoriaBruta as CategoriaFinanceira)
    : null

  const arquivo = formData.get("comprovante")
  const temArquivo = arquivo instanceof File && arquivo.size > 0

  const v = validarMovimento({
    tipo: "gasto",
    valorCentavos,
    descricao,
    categoria,
    temComprovante: temArquivo,
    exigeComprovante: carteira.exige_comprovante,
    saldoCentavos: saldo.saldoCentavos,
  })
  if (!v.ok) erroCarteira(id, v.erro)

  let comprovante: string | null = null
  if (temArquivo) {
    const r = await subirArquivo(supabase, carteira.embarcacao_id, "carteira", arquivo as File)
    if ("erro" in r) erroCarteira(id, r.erro)
    else comprovante = r.path
  }

  const { error } = await supabase.rpc("carteira_registrar_gasto", {
    p_carteira_id: id,
    p_valor_centavos: valorCentavos,
    p_data: t("data") ?? hojeISO(),
    p_descricao: descricao,
    p_categoria: categoria,
    p_comprovante_path: comprovante,
    p_observacao: t("observacao"),
  })
  if (error) {
    if (comprovante) await supabase.storage.from("acervo").remove([comprovante])
    erroCarteira(id, "Não deu para registrar o gasto agora. Tente de novo em instantes.")
  }

  revalidarCarteira(id)
  // A20 — a mensagem tem que dizer o que o BANCO acabou de fazer. Quem grava o
  // status do gasto é `carteira_registrar_gasto`; `statusInicialMovimento` é a
  // cópia fiel dessa decisão, e é ela que deve montar a frase. A condição solta
  // que estava aqui era uma terceira escrita da mesma regra — a action, a tela
  // e a função do banco, cada uma por conta própria.
  const esperaOk = statusInicialMovimento({ tipo: "gasto", modo: carteira.modo, ehProprietario }) === "pendente"
  redirect(`/carteira/${id}?ok=${encodeURIComponent(
    esperaOk ? "Gasto enviado para aprovação" : "Gasto registrado",
  )}`)
}

/** Devolução de saldo — "confirmada pelo proprietário" (PRD §9.4). Quando é
 *  o próprio dono que registra, já nasce confirmada (ele é quem confirmaria).
 *  Devolução NÃO vira entrada no Financeiro: o dinheiro nunca foi receita do
 *  barco, só voltou de onde saiu. */
export async function registrarDevolucao(formData: FormData) {
  const id = String(formData.get("carteira_id") ?? "")
  const { supabase, user, painel, carteira, ehProprietario, saldo } = await contexto(id)

  const podeUsar = ehProprietario
    || (painel.embarcacao.id === carteira.embarcacao_id && podeEditar(painel.permissoes, "carteira"))
  if (!podeUsar) erroCarteira(id, "Seu acesso não permite registrar devolução nesta Carteira.")
  if (!carteira.ativa) erroCarteira(id, "Esta carteira está encerrada. Reabra nas regras para movimentar.")

  const t = texto(formData)
  const valorCentavos = centavosDeReais(parseDecimalPtBr(t("valor") ?? ""))
  const v = validarMovimento({
    tipo: "devolucao",
    valorCentavos,
    descricao: t("descricao") ?? "Devolução de saldo",
    categoria: null,
    temComprovante: false,
    exigeComprovante: false,
    saldoCentavos: saldo.saldoCentavos,
  })
  if (!v.ok) erroCarteira(id, v.erro)

  const { data, error } = await supabase.from("carteira_movimentos").insert({
    carteira_id: id,
    tipo: "devolucao",
    valor_centavos: valorCentavos,
    data: t("data") ?? hojeISO(),
    descricao: t("descricao") ?? "Devolução de saldo",
    observacao: t("observacao"),
    // A20 — a devolução do tripulante nasce pendente porque o §9.4 pede que o
    // proprietário CONFIRME o recebimento; a do próprio dono já nasce aprovada.
    // A regra é a mesma dos outros dois tipos e agora sai do mesmo lugar.
    status: statusInicialMovimento({ tipo: "devolucao", modo: carteira.modo, ehProprietario }),
    criado_por: user.id,
    decidido_por: ehProprietario ? user.id : null,
    decidido_em: ehProprietario ? new Date().toISOString() : null,
  }).select("id").maybeSingle()
  if (error || !data) erroCarteira(id, "Não deu para registrar a devolução agora. Tente de novo em instantes.")

  revalidarCarteira(id)
  redirect(`/carteira/${id}?ok=${encodeURIComponent(
    ehProprietario ? "Devolução registrada" : "Devolução enviada para confirmação",
  )}`)
}

/** Aprovar ou recusar o que está pendente. Só o proprietário — a função do
 *  banco recusa qualquer outro, mesmo que este guard falhasse. */
export async function decidirMovimento(formData: FormData) {
  const id = String(formData.get("carteira_id") ?? "")
  const { supabase, ehProprietario } = await contexto(id)
  if (!ehProprietario) erroCarteira(id, "Só o proprietário decide sobre a Carteira.")

  const movimentoId = String(formData.get("movimento_id") ?? "")
  const decisao = String(formData.get("decisao") ?? "") === "aprovado" ? "aprovado" : "recusado"
  const motivo = String(formData.get("motivo") ?? "").trim() || null

  const { error } = await supabase.rpc("carteira_decidir_movimento", {
    p_movimento_id: movimentoId,
    p_decisao: decisao,
    p_motivo: motivo,
  })
  if (error) erroCarteira(id, "Não deu para decidir agora. Atualize a página e tente de novo.")

  revalidarCarteira(id)
  redirect(`/carteira/${id}?ok=${encodeURIComponent(decisao === "aprovado" ? "Movimento confirmado" : "Movimento recusado")}`)
}
