"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { exigirAdmin } from "@/lib/admin"
import { DECISOES_MODERACAO, type DecisaoModeracao } from "@/lib/domain/avaliacoes"
import { supabaseServer } from "@/lib/supabase/server"

/**
 * Moderação de avaliações (onda 49, PRD §14: "Admin analisa e pode Manter ou
 * Ocultar por violação. Admin nunca altera a nota").
 *
 * A decisão passa SEMPRE pela RPC `avaliacao_moderar` (migration 050) e nunca
 * por um `.update()` direto: é ela que checa `eh_admin()`, registra quem
 * decidiu e — o ponto do §14 — não menciona a coluna `nota` em lugar nenhum.
 * O banco também não deixa por fora: `update` em `avaliacoes` só está
 * concedido nas colunas `nota` e `comentario`, e um trigger derruba qualquer
 * mudança de nota que não venha do próprio autor.
 *
 * TODO (§21): quando o modelo de papéis do Admin assentar, esta tela é do
 * Suporte. Hoje `exigirAdmin()`/`eh_admin()` é o único conceito de admin que
 * existe — o papel fino entra depois, sem mudar nada aqui além da barreira.
 */

function erroAdmin(msg: string): never {
  redirect(`/admin/avaliacoes?erro=${encodeURIComponent(msg)}`)
}

export async function moderarAvaliacao(formData: FormData) {
  await exigirAdmin()
  const supabase = await supabaseServer()

  const avaliacaoId = String(formData.get("avaliacao_id") ?? "")
  const bruta = String(formData.get("decisao") ?? "")
  if (!(DECISOES_MODERACAO as readonly string[]).includes(bruta)) {
    erroAdmin("Escolha Manter ou Ocultar.")
  }
  const decisao = bruta as DecisaoModeracao

  const nota = String(formData.get("nota_admin") ?? "").trim() || null
  // Ocultar exige justificativa escrita: é uma decisão que apaga a voz de um
  // cliente da vitrine, e daqui a seis meses alguém vai perguntar por quê.
  if (decisao === "ocultar" && !nota) {
    erroAdmin("Escreva o motivo antes de ocultar — a decisão fica registrada na avaliação.")
  }

  const { error } = await supabase.rpc("avaliacao_moderar", {
    p_avaliacao_id: avaliacaoId,
    p_decisao: decisao,
    p_nota_admin: nota,
  })
  if (error) erroAdmin("Não foi possível registrar a decisão. Tente de novo.")

  revalidatePath("/admin/avaliacoes")
  revalidatePath("/avaliacoes")
  redirect(
    `/admin/avaliacoes?ok=${encodeURIComponent(
      decisao === "ocultar" ? "Avaliação ocultada por violação" : "Avaliação mantida",
    )}`,
  )
}
