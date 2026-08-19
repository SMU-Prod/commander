"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { exigirAreaAdmin } from "@/lib/admin"
import { TIPOS_TAXONOMIA, type TipoTaxonomia } from "@/lib/domain/marketplace"
import { registrarLogAdmin } from "@/lib/log-admin"
import { supabaseServer } from "@/lib/supabase/server"
import type { TaxonomiaSolicitacao } from "@/lib/db/types"

/**
 * Conteúdo padronizado (PRD §21.2) — "Admin controla categorias de serviço/
 * produto, marcas, regiões, funções profissionais, tipos de Partner e demais
 * taxonomias. Usuário pode solicitar inclusão de marca/categoria ausente;
 * evitar duplicatas livres."
 *
 * As tabelas `taxonomia` e `taxonomia_solicitacoes` já nasceram na onda 45
 * (migration 046). Aqui é só a operação: criar, editar e decidir pedido.
 *
 * "Evitar duplicatas livres" é o motivo do `slug`: dois nomes diferentes que
 * viram o mesmo slug são o mesmo item, e a unicidade `(tipo, slug)` no banco
 * rejeita antes de virar duas categorias iguais na vitrine.
 */

const CAMINHO = "/admin/taxonomia"
const CAMINHO_PEDIDOS = "/admin/taxonomia/solicitacoes"

function erro(caminho: string, msg: string): never {
  redirect(`${caminho}?erro=${encodeURIComponent(msg)}`)
}
function ok(caminho: string, msg: string): never {
  redirect(`${caminho}?ok=${encodeURIComponent(msg)}`)
}

/** Slug estável a partir do nome: sem acento, minúsculo, hifenizado. É a
 *  chave que o código referencia — por isso não pode depender de como a
 *  pessoa digitou ("Búzios", "buzios" e "BÚZIOS" viram o mesmo). */
function paraSlug(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function lerTipo(formData: FormData, caminho: string): TipoTaxonomia {
  const bruto = String(formData.get("tipo") ?? "")
  const tipo = TIPOS_TAXONOMIA.find((t) => t === bruto)
  if (!tipo) erro(caminho, "Tipo inválido.")
  return tipo
}

export async function criarItemTaxonomia(formData: FormData) {
  await exigirAreaAdmin("taxonomia")
  const supabase = await supabaseServer()

  const tipo = lerTipo(formData, CAMINHO)
  const nome = String(formData.get("nome") ?? "").trim()
  if (!nome) erro(CAMINHO, "Informe o nome.")
  const uf = String(formData.get("uf") ?? "").trim().toUpperCase() || null
  const ordemBruta = String(formData.get("ordem") ?? "").trim()
  const ordem = ordemBruta === "" ? 0 : Number(ordemBruta)
  if (!Number.isFinite(ordem)) erro(CAMINHO, "Ordem inválida — use um número.")
  const slug = paraSlug(nome)
  if (!slug) erro(CAMINHO, "Esse nome não gera um identificador válido.")

  const { data: inserido, error } = await supabase
    .from("taxonomia")
    .insert({ tipo, slug, nome, uf: tipo === "regiao" ? uf : null, ordem })
    .select("id")
    .maybeSingle()
  if (error || !inserido) {
    erro(CAMINHO, error?.code === "23505" ? `Já existe "${nome}" nesse tipo.` : "Não foi possível criar. Tente de novo.")
  }

  await registrarLogAdmin({
    acao: "taxonomia.criar",
    entidade: "taxonomia",
    entidadeId: (inserido as { id: string }).id,
    statusDepois: "ativo",
    detalhes: { tipo, slug, nome },
  })

  revalidatePath(CAMINHO)
  ok(CAMINHO, `"${nome}" criado.`)
}

export async function atualizarItemTaxonomia(formData: FormData) {
  await exigirAreaAdmin("taxonomia")
  const supabase = await supabaseServer()

  const id = String(formData.get("id") ?? "")
  if (!id) erro(CAMINHO, "Item não encontrado.")
  const nome = String(formData.get("nome") ?? "").trim()
  if (!nome) erro(CAMINHO, "Informe o nome.")
  const ativo = formData.get("ativo") === "on"
  const ordemBruta = String(formData.get("ordem") ?? "").trim()
  const ordem = ordemBruta === "" ? 0 : Number(ordemBruta)
  if (!Number.isFinite(ordem)) erro(CAMINHO, "Ordem inválida — use um número.")

  const { data: antesBruto } = await supabase.from("taxonomia").select("ativo, nome").eq("id", id).maybeSingle()
  const antes = antesBruto as { ativo: boolean; nome: string } | null

  // O `slug` NÃO é reescrito ao renomear: demandas e perfis já publicados
  // apontam pra ele. Corrigir a grafia de "Buzios" pra "Búzios" não pode
  // desassociar tudo que já foi criado.
  const { data: atualizado, error } = await supabase
    .from("taxonomia").update({ nome, ativo, ordem }).eq("id", id).select("id")
  if (error || !atualizado?.length) erro(CAMINHO, "Não foi possível salvar. Tente de novo.")

  await registrarLogAdmin({
    acao: "taxonomia.editar",
    entidade: "taxonomia",
    entidadeId: id,
    statusAntes: antes ? (antes.ativo ? "ativo" : "inativo") : null,
    statusDepois: ativo ? "ativo" : "inativo",
    detalhes: { nome_antes: antes?.nome ?? null, nome_depois: nome },
  })

  revalidatePath(CAMINHO)
  ok(CAMINHO, "Item atualizado.")
}

/** Aprova o pedido do usuário (§21.2) criando o item de verdade. Se já existir
 *  algo com o mesmo slug, o pedido é marcado como aprovado do mesmo jeito — o
 *  que a pessoa queria (o termo existir) já é verdade, e criar duplicata seria
 *  exatamente o que o PRD manda evitar. */
export async function aprovarSolicitacaoTaxonomia(formData: FormData) {
  await exigirAreaAdmin("taxonomia")
  const supabase = await supabaseServer()

  const id = String(formData.get("id") ?? "")
  const { data: pedidoBruto } = await supabase.from("taxonomia_solicitacoes").select("*").eq("id", id).maybeSingle()
  const pedido = pedidoBruto as TaxonomiaSolicitacao | null
  if (!pedido) erro(CAMINHO_PEDIDOS, "Pedido não encontrado.")
  if (pedido.status !== "pendente") erro(CAMINHO_PEDIDOS, "Esse pedido já foi decidido.")

  // O admin pode corrigir o nome antes de aprovar — é a curadoria que impede
  // "mercruser" de virar uma marca ao lado de "MerCruiser".
  const nome = String(formData.get("nome") ?? "").trim() || pedido.nome
  const slug = paraSlug(nome)
  if (!slug) erro(CAMINHO_PEDIDOS, "Esse nome não gera um identificador válido.")

  const { data: existente } = await supabase
    .from("taxonomia").select("id").eq("tipo", pedido.tipo).eq("slug", slug).maybeSingle()

  let itemId = (existente as { id: string } | null)?.id ?? null
  if (!itemId) {
    const { data: criado, error } = await supabase
      .from("taxonomia").insert({ tipo: pedido.tipo, slug, nome, ordem: 500 }).select("id").maybeSingle()
    if (error || !criado) erro(CAMINHO_PEDIDOS, "Não foi possível criar o item. Tente de novo.")
    itemId = (criado as { id: string }).id
  }

  // `taxonomia_solicitacoes: admin decide` (`eh_admin()`) recusa com zero linha
  // e `error` nulo. O `exigirAreaAdmin` lá em cima pergunta pelo papel na
  // aplicação, não no banco, e são checagens diferentes — sem conferir a linha,
  // o pedido continuava pendente na fila enquanto a tela dizia que foi aprovado
  // e o item já existia. A frase serve tanto à recusa quanto ao pedido decidido
  // por outro admin nesse intervalo.
  const { data: fechado, error: erroStatus } = await supabase
    .from("taxonomia_solicitacoes").update({ status: "aprovada" }).eq("id", id).select("id")
  if (erroStatus || !fechado?.length) erro(CAMINHO_PEDIDOS, "O item foi criado, mas o pedido não fechou. Recarregue e confira.")

  await registrarLogAdmin({
    acao: "taxonomia.solicitacao.aprovar",
    entidade: "taxonomia_solicitacoes",
    entidadeId: id,
    statusAntes: "pendente",
    statusDepois: "aprovada",
    detalhes: { tipo: pedido.tipo, nome, item_id: itemId, reaproveitou_existente: existente != null },
  })

  revalidatePath(CAMINHO_PEDIDOS)
  revalidatePath(CAMINHO)
  ok(CAMINHO_PEDIDOS, existente ? `Já existia — pedido fechado apontando para "${nome}".` : `"${nome}" criado e pedido aprovado.`)
}

export async function recusarSolicitacaoTaxonomia(formData: FormData) {
  await exigirAreaAdmin("taxonomia")
  const supabase = await supabaseServer()

  const id = String(formData.get("id") ?? "")
  const motivo = String(formData.get("motivo") ?? "").trim() || null

  const { data: atualizado, error } = await supabase
    .from("taxonomia_solicitacoes").update({ status: "recusada" }).eq("id", id).eq("status", "pendente").select("id")
  if (error || !atualizado?.length) erro(CAMINHO_PEDIDOS, "Não foi possível recusar — talvez já tenha sido decidido.")

  await registrarLogAdmin({
    acao: "taxonomia.solicitacao.recusar",
    entidade: "taxonomia_solicitacoes",
    entidadeId: id,
    statusAntes: "pendente",
    statusDepois: "recusada",
    detalhes: motivo ? { motivo } : null,
  })

  revalidatePath(CAMINHO_PEDIDOS)
  ok(CAMINHO_PEDIDOS, "Pedido recusado.")
}
