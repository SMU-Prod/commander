"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { exigirCeo } from "@/lib/admin"
import { exigeRegioes, PAPEIS_ADMIN, ROTULO_PAPEL, type PapelAdmin } from "@/lib/domain/admin-papeis"
import { registrarLogAdmin } from "@/lib/log-admin"
import { supabaseServer } from "@/lib/supabase/server"

/**
 * Gestão de administradores (PRD §21) — "O CEO/Super Admin é a conta-mãe que
 * cria e gerencia os demais administradores".
 *
 * Toda action confirma `exigirCeo()` primeiro e a RLS da migration 049
 * confirma de novo (`eh_ceo()` em insert e update de `admin_papeis`). A
 * checagem daqui existe pra dar mensagem decente; a que vale é a do banco.
 *
 * Nenhuma ação apaga papel: suspender é `ativo = false`. O DELETE está
 * revogado no banco justamente pra que "quem era admin em março?" continue
 * tendo resposta.
 */

const CAMINHO = "/admin/administradores"

function erro(msg: string): never {
  redirect(`${CAMINHO}?erro=${encodeURIComponent(msg)}`)
}
function ok(msg: string): never {
  redirect(`${CAMINHO}?ok=${encodeURIComponent(msg)}`)
}

function lerPapel(formData: FormData): PapelAdmin {
  const bruto = String(formData.get("papel") ?? "")
  const papel = PAPEIS_ADMIN.find((p) => p === bruto)
  if (!papel) erro("Função inválida.")
  return papel
}

/** Regiões só são gravadas pro Vistoriador — é o único papel com escopo
 *  regional. Guardar região num Suporte daria a impressão de que ele é
 *  limitado a ela, e ele não é. */
async function gravarRegioes(papelId: string, papel: PapelAdmin, regioes: string[]): Promise<void> {
  if (!exigeRegioes(papel)) return
  const supabase = await supabaseServer()
  // Não dá pra apagar (DELETE revogado na 049 pra proteger o histórico), então
  // o conjunto é montado por diferença: insere o que falta e ignora o resto.
  const { data: atuaisBrutos } = await supabase
    .from("admin_papel_regioes").select("regiao_id").eq("papel_id", papelId)
  const atuais = new Set(((atuaisBrutos as { regiao_id: string }[] | null) ?? []).map((r) => r.regiao_id))
  const novas = regioes.filter((r) => !atuais.has(r))
  if (novas.length > 0) {
    await supabase.from("admin_papel_regioes").insert(novas.map((regiao_id) => ({ papel_id: papelId, regiao_id })))
  }
}

export async function conceberPapelAdmin(formData: FormData) {
  await exigirCeo()
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  const usuarioId = String(formData.get("usuario_id") ?? "").trim()
  if (!usuarioId) erro("Escolha a pessoa que vai receber a função.")
  const papel = lerPapel(formData)
  const observacao = String(formData.get("observacao") ?? "").trim() || null
  const regioes = formData.getAll("regioes").map(String).filter(Boolean)

  // §21: vistoriador sem região é acesso que não abre nada (a RLS nega tudo).
  // Melhor barrar aqui do que entregar um admin que não consegue trabalhar.
  if (exigeRegioes(papel) && regioes.length === 0) {
    erro("Vistoriador precisa de pelo menos uma região autorizada — o papel não dá acesso nacional.")
  }

  const { data: inserido, error } = await supabase
    .from("admin_papeis")
    .insert({ usuario_id: usuarioId, papel, observacao, criado_por: user?.id ?? null })
    .select("id")
    .maybeSingle()
  if (error || !inserido) {
    erro(
      error?.code === "23505"
        ? "Essa pessoa já tem essa função. Edite a função existente em vez de criar outra."
        : "Não foi possível conceder a função. Tente de novo.",
    )
  }

  const papelId = (inserido as { id: string }).id
  await gravarRegioes(papelId, papel, regioes)

  await registrarLogAdmin({
    acao: "admin.papel.conceder",
    entidade: "admin_papeis",
    entidadeId: papelId,
    statusDepois: "ativo",
    detalhes: { papel, usuario_id: usuarioId, regioes: regioes.length },
  })

  revalidatePath(CAMINHO)
  ok(`${ROTULO_PAPEL[papel]} concedido.`)
}

export async function atualizarPapelAdmin(formData: FormData) {
  await exigirCeo()
  const supabase = await supabaseServer()

  const id = String(formData.get("id") ?? "")
  if (!id) erro("Função não encontrada.")
  const ativo = formData.get("ativo") === "on"
  const observacao = String(formData.get("observacao") ?? "").trim() || null

  const { data: antesBruto } = await supabase
    .from("admin_papeis").select("papel, ativo").eq("id", id).maybeSingle()
  const antes = antesBruto as { papel: PapelAdmin; ativo: boolean } | null
  if (!antes) erro("Função não encontrada.")

  const regioes = formData.getAll("regioes").map(String).filter(Boolean)
  if (ativo && exigeRegioes(antes.papel) && regioes.length === 0) {
    erro("Vistoriador precisa de pelo menos uma região autorizada.")
  }

  const { data: atualizado, error } = await supabase
    .from("admin_papeis")
    .update({ ativo, observacao, atualizado_em: new Date().toISOString() })
    .eq("id", id)
    .select("id")
  if (error || !atualizado?.length) erro("Não foi possível salvar. Tente de novo.")

  await gravarRegioes(id, antes.papel, regioes)

  await registrarLogAdmin({
    acao: ativo ? "admin.papel.reativar" : "admin.papel.suspender",
    entidade: "admin_papeis",
    entidadeId: id,
    statusAntes: antes.ativo ? "ativo" : "suspenso",
    statusDepois: ativo ? "ativo" : "suspenso",
    detalhes: { papel: antes.papel },
  })

  revalidatePath(CAMINHO)
  ok(ativo ? "Função reativada." : "Função suspensa — o acesso para agora.")
}
