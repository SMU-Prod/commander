"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { carregarNivelPlano, carregarPainel } from "@/lib/consultas"
import {
  ehCompartilhavel,
  podeGerenciarEventos,
  visibilidadeEfetiva,
  VISIBILIDADES,
  type Visibilidade,
} from "@/lib/domain/agenda"
import { mensagemBloqueio, recursoLiberado } from "@/lib/domain/plano-acesso"
import { supabaseServer } from "@/lib/supabase/server"

/**
 * Server actions da AGENDA (onda 43, PRD §8).
 *
 * Padrão da casa (mesmo de `lib/acoes/itens.ts` e `lib/acoes/ocorrencias.ts`):
 * guard na TELA, guard na ACTION e RLS no BANCO — três camadas, porque a RLS
 * barrando devolve `error: null` com zero linhas e a tela anunciaria "salvo"
 * sem ter salvo. Todo insert/update/delete aqui vem com `.select()` e a
 * checagem do que voltou.
 *
 * O que a action NUNCA faz: confiar num `usuario_id` que chegou do formulário
 * sem conferir se ele é da tripulação deste barco. A RLS também barra
 * (`agenda_pode_compartilhar`, migration 044), mas o erro precisa chegar
 * legível na tela, não como "não deu pra salvar".
 */

function erroNovo(msg: string): never {
  redirect(`/agenda/novo?erro=${encodeURIComponent(msg)}`)
}
function erroDetalhe(id: string, msg: string): never {
  redirect(`/agenda/${id}?erro=${encodeURIComponent(msg)}`)
}
function erroAgenda(msg: string): never {
  redirect(`/agenda?erro=${encodeURIComponent(msg)}`)
}

function revalidar(id?: string) {
  revalidatePath("/agenda")
  if (id) revalidatePath(`/agenda/${id}`)
}

const texto = (formData: FormData, chave: string): string | null =>
  String(formData.get(chave) ?? "").trim() || null

/** "AAAA-MM-DD" e nada além — data inválida vira compromisso invisível. */
function dataValida(v: string | null): v is string {
  return v != null && /^\d{4}-\d{2}-\d{2}$/.test(v)
}

/** `<input type="time">` manda "HH:MM"; o Postgres aceita e devolve "HH:MM:SS". */
function horaValida(v: string | null): v is string {
  return v != null && /^\d{2}:\d{2}$/.test(v)
}

function lerVisibilidade(formData: FormData): Visibilidade {
  const v = texto(formData, "visibilidade")
  return (VISIBILIDADES as readonly string[]).includes(v ?? "") ? (v as Visibilidade) : "particular"
}

/** Ids marcados no formulário de compartilhar, sem repetição e sem o próprio criador. */
function lerParticipantes(formData: FormData, criadorId: string): string[] {
  return [...new Set(formData.getAll("participantes").map((v) => String(v)))]
    .filter((id) => id !== "" && id !== criadorId)
}

/** Quem, além de mim, tem vínculo com este barco — o universo do "compartilhar com". */
async function tripulacaoDoBarco(embarcacaoId: string, exceto: string): Promise<Set<string>> {
  const supabase = await supabaseServer()
  const { data } = await supabase.from("vinculos").select("usuario_id").eq("embarcacao_id", embarcacaoId)
  return new Set((data ?? []).map((v: { usuario_id: string }) => v.usuario_id).filter((id) => id !== exceto))
}

export async function criarCompromisso(formData: FormData) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  // PRD §8: "só pode criar/compartilhar eventos da embarcação se tiver
  // permissão 'Gerenciar eventos da embarcação'".
  if (!podeGerenciarEventos(painel.permissoes)) {
    erroNovo("Seu acesso não permite criar compromissos desta embarcação.")
  }
  // §2.3 — "Agenda e Financeiro podem ser VISUALIZADOS como estrutura, mas
  // criação/lançamento ficam bloqueados". Note a ordem: permissão primeiro,
  // plano depois. Quem não tem permissão não deve receber convite de upgrade
  // pra um recurso que não é dele nem quando pago.
  if (!recursoLiberado("agenda_criar", await carregarNivelPlano())) {
    erroNovo(mensagemBloqueio("agenda_criar").descricao)
  }

  const titulo = texto(formData, "titulo")
  if (!titulo) erroNovo("Dê um nome ao compromisso — por exemplo, “Saída sábado”.")

  const data = texto(formData, "data")
  if (!dataValida(data)) erroNovo("Escolha o dia do compromisso.")

  const horaBruta = texto(formData, "hora")
  if (horaBruta !== null && !horaValida(horaBruta)) erroNovo("Informe a hora no formato 08:00, ou deixe em branco.")

  const visibilidade = lerVisibilidade(formData)

  // O ponteiro pra manutenção/documento só vale se o item for DESTE barco e
  // desta pessoa enxergar — `painel.itens` já vem filtrado pela RLS, então
  // procurar aqui dentro é a checagem completa.
  const itemId = texto(formData, "item_monitorado_id")
  if (itemId && !painel.itens.some((i) => i.id === itemId)) {
    erroNovo("Não encontramos essa manutenção. Atualize a página e tente de novo.")
  }

  const participantes = lerParticipantes(formData, user.id)
  if (ehCompartilhavel(visibilidade) && participantes.length === 0) {
    erroNovo("Escolha com quem compartilhar, ou marque o compromisso como “Só pra mim”.")
  }
  if (participantes.length > 0) {
    const tripulacao = await tripulacaoDoBarco(painel.embarcacao.id, user.id)
    if (participantes.some((id) => !tripulacao.has(id))) {
      erroNovo("Só dá pra compartilhar com quem já tem acesso a esta embarcação.")
    }
  }

  const { data: criado, error } = await supabase.from("agenda_eventos").insert({
    embarcacao_id: painel.embarcacao.id,
    titulo,
    descricao: texto(formData, "descricao"),
    data,
    hora: horaBruta,
    // Marcou "compartilhado"/"atribuído" e não sobrou ninguém na lista?
    // Não existe compromisso compartilhado com ninguém — vira particular em
    // vez de mentir um cadeado aberto na tela.
    visibilidade: participantes.length === 0 ? "particular" : visibilidade,
    item_monitorado_id: itemId,
    criado_por: user.id,
  }).select("id").maybeSingle()
  if (error || !criado) erroNovo("Não deu para salvar o compromisso agora. Tente de novo em instantes.")

  if (participantes.length > 0) {
    const { error: erroPart } = await supabase.from("agenda_participantes").insert(
      participantes.map((usuarioId) => ({
        evento_id: criado.id,
        usuario_id: usuarioId,
        responsavel: visibilidade === "atribuido",
      })),
    ).select("evento_id")
    if (erroPart) {
      // O compromisso existe, o compartilhamento não. Dizer a verdade e
      // mandar pra tela onde dá pra refazer — nada de "criado" seco.
      erroDetalhe(criado.id, "O compromisso foi criado, mas não deu pra compartilhar. Tente compartilhar de novo aqui.")
    }
  }

  revalidar(criado.id)
  redirect(`/agenda/${criado.id}?ok=${encodeURIComponent("Compromisso criado")}`)
}

export async function salvarCompromisso(formData: FormData) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")

  const id = String(formData.get("compromisso_id") ?? "")
  if (!id) erroAgenda("Não encontramos esse compromisso. Atualize a página.")
  if (!podeGerenciarEventos(painel.permissoes)) {
    erroDetalhe(id, "Seu acesso não permite alterar compromissos desta embarcação.")
  }

  const titulo = texto(formData, "titulo")
  if (!titulo) erroDetalhe(id, "Dê um nome ao compromisso.")
  const data = texto(formData, "data")
  if (!dataValida(data)) erroDetalhe(id, "Escolha o dia do compromisso.")
  const horaBruta = texto(formData, "hora")
  if (horaBruta !== null && !horaValida(horaBruta)) erroDetalhe(id, "Informe a hora no formato 08:00, ou deixe em branco.")

  // A RLS já garante que só o criador altera (`agenda: só o criador altera`);
  // o `.select()` é quem transforma "barrado em silêncio" em erro visível.
  const { data: salvo, error } = await supabase.from("agenda_eventos")
    .update({ titulo, descricao: texto(formData, "descricao"), data, hora: horaBruta })
    .eq("id", id).select("id").maybeSingle()
  if (error || !salvo) erroDetalhe(id, "Não deu para salvar agora. Só quem criou o compromisso pode alterá-lo.")

  revalidar(id)
  redirect(`/agenda/${id}?ok=${encodeURIComponent("Compromisso salvo")}`)
}

/** Compartilhar depois de criado (ou atribuir a alguém). */
export async function compartilharCompromisso(formData: FormData) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")

  const id = String(formData.get("compromisso_id") ?? "")
  if (!id) erroAgenda("Não encontramos esse compromisso. Atualize a página.")
  if (!podeGerenciarEventos(painel.permissoes)) {
    erroDetalhe(id, "Seu acesso não permite compartilhar compromissos desta embarcação.")
  }

  const usuarioId = texto(formData, "usuario_id")
  if (!usuarioId) erroDetalhe(id, "Escolha com quem compartilhar.")
  const tripulacao = await tripulacaoDoBarco(painel.embarcacao.id, user.id)
  if (!tripulacao.has(usuarioId)) {
    erroDetalhe(id, "Só dá pra compartilhar com quem já tem acesso a esta embarcação.")
  }
  const responsavel = String(formData.get("responsavel") ?? "") === "1"

  const { data: incluido, error } = await supabase.from("agenda_participantes")
    .upsert({ evento_id: id, usuario_id: usuarioId, responsavel }, { onConflict: "evento_id,usuario_id" })
    .select("evento_id").maybeSingle()
  if (error || !incluido) {
    erroDetalhe(id, "Não deu para compartilhar agora. Só quem criou o compromisso pode compartilhá-lo.")
  }

  // A visibilidade acompanha o fato: assim que existe alguém na lista, o
  // compromisso deixa de ser particular; 'atribuido' só quando há
  // responsável. Quem chegou aqui é o criador (a RLS não deixaria outro
  // inserir), então este update passa.
  const { data: atual } = await supabase.from("agenda_participantes")
    .select("responsavel").eq("evento_id", id)
  await supabase.from("agenda_eventos")
    .update({ visibilidade: visibilidadeEfetiva(atual ?? []) }).eq("id", id)

  revalidar(id)
  redirect(`/agenda/${id}?ok=${encodeURIComponent(responsavel ? "Compromisso atribuído" : "Compromisso compartilhado")}`)
}

export async function descompartilharCompromisso(formData: FormData) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const id = String(formData.get("compromisso_id") ?? "")
  const usuarioId = String(formData.get("usuario_id") ?? "")
  if (!id || !usuarioId) erroAgenda("Não encontramos esse compartilhamento. Atualize a página.")

  const { data: evento } = await supabase.from("agenda_eventos").select("criado_por").eq("id", id).maybeSingle()

  const { data: removido, error } = await supabase.from("agenda_participantes")
    .delete().eq("evento_id", id).eq("usuario_id", usuarioId).select("evento_id")
  if (error || !removido?.length) erroDetalhe(id, "Não deu para remover agora. Tente de novo em instantes.")

  // Só o criador consegue reescrever `visibilidade` (policy "só o criador
  // altera"). Quando é o participante saindo sozinho, o campo fica como
  // estava — e é por isso que a TELA lê o rótulo de `visibilidadeEfetiva`,
  // que olha a lista real de participantes em vez do campo.
  if (evento?.criado_por === user.id) {
    const { data: restantes } = await supabase.from("agenda_participantes")
      .select("responsavel").eq("evento_id", id)
    await supabase.from("agenda_eventos")
      .update({ visibilidade: visibilidadeEfetiva(restantes ?? []) }).eq("id", id)
  }

  revalidar(id)
  // Quem saiu do próprio compromisso não tem mais o que ver na tela dele.
  if (usuarioId === user.id) redirect(`/agenda?ok=${encodeURIComponent("Você saiu do compromisso")}`)
  redirect(`/agenda/${id}?ok=${encodeURIComponent("Compartilhamento removido")}`)
}

/**
 * Concluir NÃO apaga: carimba `concluido_em` e o compromisso sai da agenda
 * normal (PRD §8: "histórico de coisas já realizadas não polui a Agenda
 * normal"). Continua acessível em "Já realizados".
 */
export async function concluirCompromisso(formData: FormData) {
  const supabase = await supabaseServer()
  const id = String(formData.get("compromisso_id") ?? "")
  if (!id) erroAgenda("Não encontramos esse compromisso. Atualize a página.")
  const reabrir = String(formData.get("reabrir") ?? "") === "1"

  const { data: salvo, error } = await supabase.from("agenda_eventos")
    .update({ concluido_em: reabrir ? null : new Date().toISOString() })
    .eq("id", id).select("id").maybeSingle()
  if (error || !salvo) {
    erroDetalhe(id, "Não deu para salvar agora. Só quem criou o compromisso pode concluí-lo.")
  }

  revalidar(id)
  redirect(`/agenda/${id}?ok=${encodeURIComponent(reabrir ? "Compromisso reaberto" : "Compromisso concluído")}`)
}

export async function excluirCompromisso(formData: FormData) {
  const supabase = await supabaseServer()
  const id = String(formData.get("compromisso_id") ?? "")
  if (!id) erroAgenda("Não encontramos esse compromisso. Atualize a página.")

  const { data: apagado, error } = await supabase.from("agenda_eventos")
    .delete().eq("id", id).select("id")
  if (error || !apagado?.length) {
    erroDetalhe(id, "Não deu para excluir agora. Só quem criou o compromisso pode excluí-lo.")
  }

  revalidar()
  redirect(`/agenda?ok=${encodeURIComponent("Compromisso excluído")}`)
}
