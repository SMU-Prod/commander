"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { nomePublicoDoUsuario } from "@/lib/consultas-avaliacoes"
import {
  CODIGOS_MOTIVO, CODIGOS_RESPOSTA, notaValida, RESPOSTAS_SOLUCAO, type RespostaSolucao,
} from "@/lib/domain/avaliacoes"
import { supabaseServer } from "@/lib/supabase/server"
import type { Negocio, Proposta } from "@/lib/db/types"

/**
 * Ações das Avaliações (onda 49, PRD §14).
 *
 * A regra mora em `lib/domain/avaliacoes.ts` e, principalmente, na RLS da
 * migration 050 — aqui só se lê formulário, valida o mínimo e grava. Repare
 * que NENHUMA destas funções verifica "o negócio está confirmado?": quem
 * verifica é a policy de insert. Se a checagem estivesse aqui, existiria um
 * caminho (outro código, outro cliente, um curl) que passa por fora dela.
 *
 * Toda escrita passa por `.select()` + checagem do retorno: RLS que barra
 * devolve `error: null` com zero linhas, e sem a checagem a tela diria
 * "salvo" sem ter salvado nada (regra da casa, docs/CONTRIBUTING.md).
 */

type Supabase = Awaited<ReturnType<typeof supabaseServer>>

function erro(rota: string, msg: string): never {
  redirect(`${rota}${rota.includes("?") ? "&" : "?"}erro=${encodeURIComponent(msg)}`)
}

function ok(rota: string, msg: string): never {
  redirect(`${rota}${rota.includes("?") ? "&" : "?"}ok=${encodeURIComponent(msg)}`)
}

async function usuarioLogado(supabase: Supabase): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  return user.id
}

/** Pra onde voltar depois de gravar. A mesma ação é usada da ficha do pedido
 *  (/marketplace/[id]) e da tela de Avaliações, e cada uma quer voltar pra si. */
function volta(formData: FormData): string {
  const bruto = String(formData.get("volta") ?? "/avaliacoes")
  // Só caminho interno: um `volta` vindo do formulário não pode virar redirect
  // pra fora do app.
  return bruto.startsWith("/") && !bruto.startsWith("//") ? bruto : "/avaliacoes"
}

function texto(fd: FormData, chave: string): string | null {
  const v = String(fd.get(chave) ?? "").trim()
  return v === "" ? null : v
}

function revalidar(rota: string) {
  revalidatePath("/avaliacoes")
  revalidatePath(rota)
}

// ---------------------------------------------------------------------------
// §14 — publicar a avaliação
// ---------------------------------------------------------------------------
/**
 * "Avaliação somente após negócio confirmado bilateralmente no Commander."
 *
 * A trava é a policy de insert (migration 050). O que esta função faz é
 * traduzir a recusa em português e preencher os nomes: `avaliado_nome` sai do
 * que o próprio fornecedor publicou na proposta, porque `profiles` tem RLS de
 * "próprio ou tripulação" e um JOIN pra pegar o nome dele voltaria vazio.
 */
export async function publicarAvaliacao(formData: FormData) {
  const supabase = await supabaseServer()
  const userId = await usuarioLogado(supabase)
  const rota = volta(formData)

  const negocioId = String(formData.get("negocio_id") ?? "")
  const nota = Number(formData.get("nota") ?? 0)
  if (!notaValida(nota)) erro(rota, "Escolha de 1 a 5 estrelas.")

  const { data: negocioBruto } = await supabase
    .from("negocios").select("*").eq("id", negocioId).maybeSingle()
  const negocio = negocioBruto as Negocio | null
  if (!negocio) erro(rota, "Não encontramos esse negócio. Recarregue a página.")
  if (negocio.cliente_id !== userId) {
    erro(rota, "Só quem contratou avalia — quem prestou o serviço não avalia o cliente.")
  }

  const { data: propostaBruta } = await supabase
    .from("propostas").select("autor_nome").eq("id", negocio.proposta_id).maybeSingle()
  const avaliadoNome = (propostaBruta as Pick<Proposta, "autor_nome"> | null)?.autor_nome || "Parceiro"

  const { data: salvo, error } = await supabase.from("avaliacoes").insert({
    negocio_id: negocioId,
    avaliador_id: userId,
    avaliado_id: negocio.fornecedor_id,
    avaliador_nome: await nomePublicoDoUsuario(userId),
    avaliado_nome: avaliadoNome,
    nota,
    comentario: texto(formData, "comentario"),
  }).select("id")
  if (error || !salvo?.length) {
    // A policy barra dois casos: negócio ainda não confirmado pelos dois lados
    // e segunda avaliação do mesmo negócio. Uma frase cobre os dois sem
    // revelar qual foi.
    erro(rota, "Não foi possível publicar. A avaliação abre depois que os dois lados confirmam o negócio — e vale uma por negócio.")
  }

  revalidar(rota)
  ok(rota, "Avaliação publicada")
}

/** §14: "Cliente pode editar a própria avaliação por até 30 dias." O prazo é
 *  da policy de update — passou, o banco devolve zero linhas e a mensagem
 *  abaixo explica. */
export async function editarAvaliacao(formData: FormData) {
  const supabase = await supabaseServer()
  const userId = await usuarioLogado(supabase)
  const rota = volta(formData)

  const id = String(formData.get("avaliacao_id") ?? "")
  const nota = Number(formData.get("nota") ?? 0)
  if (!notaValida(nota)) erro(rota, "Escolha de 1 a 5 estrelas.")

  const { data: salvo, error } = await supabase
    .from("avaliacoes")
    .update({ nota, comentario: texto(formData, "comentario") })
    .eq("id", id).eq("avaliador_id", userId).select("id")
  if (error || !salvo?.length) {
    erro(rota, "Não foi possível editar. O prazo de 30 dias para mudar a sua avaliação pode ter passado.")
  }

  revalidar(rota)
  ok(rota, "Avaliação atualizada")
}

// ---------------------------------------------------------------------------
// §14.1 — a resposta do avaliado, uma só e padronizada
// ---------------------------------------------------------------------------
export async function responderAvaliacao(formData: FormData) {
  const supabase = await supabaseServer()
  const userId = await usuarioLogado(supabase)
  const rota = volta(formData)

  const avaliacaoId = String(formData.get("avaliacao_id") ?? "")
  const codigo = String(formData.get("resposta_codigo") ?? "")
  if (!CODIGOS_RESPOSTA.includes(codigo)) erro(rota, "Escolha uma das respostas disponíveis.")

  const { data: salvo, error } = await supabase.from("avaliacoes_respostas").insert({
    avaliacao_id: avaliacaoId,
    autor_id: userId,
    resposta_codigo: codigo,
  }).select("avaliacao_id")
  if (error || !salvo?.length) {
    // A policy recusa resposta fora do tom da nota e a PK recusa a segunda.
    erro(rota, "Não foi possível responder — você já respondeu esta avaliação, ou a resposta não corresponde à nota.")
  }

  revalidar(rota)
  ok(rota, "Resposta publicada")
}

// ---------------------------------------------------------------------------
// §14.2 — contestar (só nota 1 ou 2)
// ---------------------------------------------------------------------------
/** A contestação NÃO tira a avaliação do ar (§14) — ela abre um pedido de
 *  análise. Quem decide Manter ou Ocultar é o Admin, e até lá a nota continua
 *  contando na média. */
export async function contestarAvaliacao(formData: FormData) {
  const supabase = await supabaseServer()
  const userId = await usuarioLogado(supabase)
  const rota = volta(formData)

  const avaliacaoId = String(formData.get("avaliacao_id") ?? "")
  const motivo = String(formData.get("motivo_codigo") ?? "")
  if (!CODIGOS_MOTIVO.includes(motivo)) erro(rota, "Escolha um dos motivos da lista.")
  const detalhe = texto(formData, "detalhe")
  if (motivo === "outro" && !detalhe) erro(rota, "Explique o motivo — foi você quem escolheu “Outro motivo”.")

  const { data: salvo, error } = await supabase.from("avaliacoes_contestacoes").insert({
    avaliacao_id: avaliacaoId,
    autor_id: userId,
    motivo_codigo: motivo,
    detalhe,
  }).select("id")
  if (error || !salvo?.length) {
    erro(rota, "Não foi possível contestar — só avaliações de 1 ou 2 estrelas podem ser contestadas, e uma vez cada.")
  }

  revalidar(rota)
  ok(rota, "Contestação enviada — a equipe Commander vai analisar")
}

// ---------------------------------------------------------------------------
// §14 — "Problema solucionado"
// ---------------------------------------------------------------------------
/** O avaliado declara que resolveu. Isso não muda a nota nem esconde nada:
 *  vira um selo ao lado da avaliação, e o cliente ainda vai confirmar ou
 *  negar. */
export async function marcarProblemaSolucionado(formData: FormData) {
  const supabase = await supabaseServer()
  const userId = await usuarioLogado(supabase)
  const rota = volta(formData)

  const avaliacaoId = String(formData.get("avaliacao_id") ?? "")
  const { data: salvo, error } = await supabase.from("avaliacoes_solucoes").insert({
    avaliacao_id: avaliacaoId,
    marcado_por: userId,
    descricao: texto(formData, "descricao"),
  }).select("avaliacao_id")
  if (error || !salvo?.length) {
    erro(rota, "Não foi possível registrar — você já marcou esta avaliação como solucionada.")
  }

  revalidar(rota)
  ok(rota, "Registrado — o cliente vai confirmar ou negar")
}

/** "Cliente confirma ou nega. A nota não muda automaticamente." Se o cliente
 *  quiser melhorar a nota depois de resolvido, ele edita a avaliação — dentro
 *  dos 30 dias, e por decisão dele. */
export async function responderProblemaSolucionado(formData: FormData) {
  const supabase = await supabaseServer()
  await usuarioLogado(supabase)
  const rota = volta(formData)

  const avaliacaoId = String(formData.get("avaliacao_id") ?? "")
  const bruta = String(formData.get("resposta") ?? "")
  if (!(RESPOSTAS_SOLUCAO as readonly string[]).includes(bruta)) {
    erro(rota, "Não entendi a resposta. Tente de novo.")
  }
  const resposta = bruta as RespostaSolucao

  const { data: salvo, error } = await supabase
    .from("avaliacoes_solucoes")
    .update({ resposta, respondido_em: new Date().toISOString() })
    .eq("avaliacao_id", avaliacaoId).select("avaliacao_id")
  if (error || !salvo?.length) {
    erro(rota, "Não foi possível responder agora — talvez você já tenha respondido.")
  }

  revalidar(rota)
  ok(
    rota,
    resposta === "confirmado"
      ? "Você confirmou que o problema foi solucionado. A nota continua sendo sua — edite se quiser mudá-la."
      : "Registramos que você não reconhece a solução informada.",
  )
}
