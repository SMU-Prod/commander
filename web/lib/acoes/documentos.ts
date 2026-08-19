"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { subirArquivo } from "@/lib/acervo"
import { carregarPainel } from "@/lib/consultas"
import { supabaseServer } from "@/lib/supabase/server"

const volta = (msg?: string): never =>
  redirect(msg ? `/barco/documentos?erro=${encodeURIComponent(msg)}` : "/barco/documentos")

async function contexto() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  return { supabase, painel: painel! }
}

export async function criarDocumento(formData: FormData) {
  const { supabase, painel } = await contexto()
  const nome = String(formData.get("nome") ?? "").trim()
  if (nome === "") volta("Dê um nome ao documento.")
  const validade = String(formData.get("validade") ?? "").trim() || null

  let itemId: string | null = null
  if (validade) {
    const { data: item, error } = await supabase
      .from("itens_monitorados")
      .insert({ embarcacao_id: painel.embarcacao.id, nome, categoria: "documento", data_fixa: validade })
      .select("id").single()
    if (error || !item) volta("Não deu para salvar a data de vencimento. Tente de novo.")
    itemId = item!.id
  }

  let arquivoPath: string | null = null
  const arquivo = formData.get("arquivo")
  if (arquivo instanceof File && arquivo.size > 0) {
    const r = await subirArquivo(supabase, painel.embarcacao.id, "documentos", arquivo)
    if ("erro" in r) {
      // Desfazer o vencimento criado há duas linhas: aqui zero linha É o
      // esperado quando o próprio insert acima não colou, e não há nada a
      // anunciar — quem manda na tela é o `r.erro` do arquivo.
      if (itemId) await supabase.from("itens_monitorados").delete().eq("id", itemId)
      volta(r.erro)
    } else arquivoPath = r.path
  }

  const { data: documento, error } = await supabase.from("documentos").insert({
    embarcacao_id: painel.embarcacao.id, nome, arquivo_path: arquivoPath,
    validade, item_monitorado_id: itemId,
  }).select("id")
  // `documentos: criar pela matriz` pede `permissao(embarcacao_id,
  // 'documentos', 'editar')` — quem só lê a aba chegava até aqui, o banco
  // recusava calado e a lista voltava sem o documento recém-"salvo".
  if (error || !documento?.length) {
    if (arquivoPath) await supabase.storage.from("acervo").remove([arquivoPath])
    // Mesmo caso do rollback acima: se o item também foi recusado, não há linha
    // para apagar e o delete vazio é o desfecho correto.
    if (itemId) await supabase.from("itens_monitorados").delete().eq("id", itemId)
    volta("O documento não foi salvo. Tente de novo; se continuar, fale com quem administra a embarcação.")
  }

  revalidatePath("/barco/documentos")
  revalidatePath("/barco")
  revalidatePath("/hoje")
  volta()
}

export async function anexarArquivo(formData: FormData) {
  const { supabase, painel } = await contexto()
  const itemId = String(formData.get("item_id") ?? "")
  const item = painel.itens.find((i) => i.id === itemId)
  if (!item) volta("Não encontramos esse documento. Atualize a página e tente de novo.")

  const arquivo = formData.get("arquivo")
  if (!(arquivo instanceof File) || arquivo.size === 0) volta("Escolha um arquivo.")
  const r = await subirArquivo(supabase, painel.embarcacao.id, "documentos", arquivo as File)
  if ("erro" in r) volta(r.erro)

  const arquivoPath = (r as { path: string }).path

  const { data: existente } = await supabase.from("documentos")
    .select("id").eq("item_monitorado_id", itemId).is("arquivo_path", null).maybeSingle()

  // Os dois ramos gravam por policies distintas (`documentos: atualizar pela
  // matriz` e `documentos: criar pela matriz`), ambas presas a
  // `permissao(embarcacao_id, 'documentos', 'editar')` e ambas recusando com
  // zero linha e `error` nulo. Sem conferir a linha, o arquivo ficava no acervo
  // e o vínculo não existia: a tela dizia "anexado" e o documento continuava
  // sem anexo nenhum.
  if (existente) {
    const { data: vinculado, error } = await supabase.from("documentos")
      .update({ arquivo_path: arquivoPath }).eq("id", existente.id).select("id")
    if (error || !vinculado?.length) {
      await supabase.storage.from("acervo").remove([arquivoPath])
      volta("O arquivo não foi anexado. Tente de novo; se continuar, fale com quem administra a embarcação.")
    }
  } else {
    const { data: criado, error } = await supabase.from("documentos").insert({
      embarcacao_id: painel.embarcacao.id, nome: item!.nome,
      arquivo_path: arquivoPath, validade: item!.data_fixa, item_monitorado_id: itemId,
    }).select("id")
    if (error || !criado?.length) {
      await supabase.storage.from("acervo").remove([arquivoPath])
      volta("O arquivo não foi anexado. Tente de novo; se continuar, fale com quem administra a embarcação.")
    }
  }
  revalidatePath("/barco/documentos")
  volta()
}

export async function excluirDocumento(formData: FormData) {
  const { supabase, painel } = await contexto()
  const id = String(formData.get("documento_id") ?? "")
  const { data: doc } = await supabase.from("documentos")
    .select("id, arquivo_path, item_monitorado_id")
    .eq("id", id).eq("embarcacao_id", painel.embarcacao.id).maybeSingle()
  if (!doc) volta("Documento não encontrado.")

  if (doc!.item_monitorado_id) {
    // Aqui zero linha é desfecho esperado, não recusa disfarçada: o vencimento
    // pode já ter sido apagado pela tela de itens, e o vínculo do documento
    // sobrevive ao item. Quanto à permissão, as duas policies são a MESMA
    // pergunta — `itens: excluir pela matriz` chama `aba_alvo(null,
    // 'documento')`, que devolve literalmente 'documentos'. Então quem for
    // barrado aqui será barrado no delete abaixo, e é de lá que sai a frase.
    const { error: erroItem } = await supabase
      .from("itens_monitorados").delete().eq("id", doc!.item_monitorado_id)
    if (erroItem) volta("Não foi possível excluir o vencimento vinculado. Tente de novo.")
  }
  // `documentos: excluir pela matriz` recusa com zero linha e `error` nulo.
  // Conferir a linha é o que segura o resto da action: logo abaixo o arquivo
  // sai do acervo, e fazer isso com a linha de pé deixaria na lista um
  // documento cujo anexo não abre mais.
  const { data: apagado, error } = await supabase.from("documentos").delete().eq("id", id).select("id")
  if (error || !apagado?.length) volta("O documento não foi excluído. Atualize a página e tente de novo.")
  if (doc!.arquivo_path) {
    // best-effort: arquivo órfão é aceitável; linha fantasma não.
    await supabase.storage.from("acervo").remove([doc!.arquivo_path])
  }
  revalidatePath("/barco/documentos")
  revalidatePath("/barco")
  revalidatePath("/hoje")
  volta()
}
