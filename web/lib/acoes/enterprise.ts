"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { carregarPainel } from "@/lib/consultas"
import { hojeISO } from "@/lib/consultas"
import { parseDecimalPtBr } from "@/lib/domain/numeros"
import { podeAbrirVotacao } from "@/lib/domain/mecanica"
import { retirarDoEstoque, validarSaidaDoTanque } from "@/lib/domain/estoque-combustivel"
import { converterEmAfazer } from "@/lib/domain/afazeres"
import { supabaseServer } from "@/lib/supabase/server"

/**
 * AS AÇÕES DO ENTERPRISE (onda 78) — mecânica, estoque, combustível,
 * envios do cotista e afazeres.
 *
 * Um arquivo só porque as cinco telas compartilham as mesmas três coisas:
 * quem é o usuário, qual é a unidade aberta, e a disciplina de sempre
 * conferir no `select` que a linha realmente mudou (a lição da onda 63: uma
 * escrita barrada por policy volta sem erro, e o app anuncia sucesso à toa).
 *
 * A REGRA que atravessa tudo: nenhuma action aqui repete decisão que já mora
 * no domínio. `podeAbrirVotacao`, `retirarDoEstoque`, `validarSaidaDoTanque` e
 * `converterEmAfazer` são chamados, não reimplementados — senão a tela e o
 * teste passariam a discordar na primeira mudança de regra.
 */

const texto = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || null

function num(f: FormData, k: string): number | null {
  const b = texto(f, k)
  if (b === null) return null
  const n = parseDecimalPtBr(b)
  return n === null ? null : n
}

/** Dinheiro do formulário em centavos. "1.234,56" → 123456. */
function centavos(f: FormData, k: string): number | null {
  const n = num(f, k)
  return n === null ? null : Math.round(n * 100)
}

function falhar(rota: string, msg: string): never {
  redirect(`${rota}?erro=${encodeURIComponent(msg)}`)
}

async function contexto() {
  const supabase = await supabaseServer()
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, painel, userId: user?.id ?? null }
}

// ---------------------------------------------------------------------------
// Mecânica (§7) e votação (§9)
// ---------------------------------------------------------------------------

export async function abrirServico(formData: FormData) {
  const { supabase, painel, userId } = await contexto()
  const problema = texto(formData, "problema_informado")
  if (!problema) falhar("/mecanica", "Diga qual é o problema.")

  const { error } = await supabase.from("servicos_mecanica").insert({
    embarcacao_id: painel.embarcacao.id,
    problema_informado: problema,
    diagnostico: texto(formData, "diagnostico"),
    entrada_em: texto(formData, "entrada_em"),
    criado_por: userId,
  })
  if (error) falhar("/mecanica", "Não deu pra abrir o serviço. Confira seu acesso a Motores.")

  revalidatePath("/mecanica")
  redirect(`/mecanica?ok=${encodeURIComponent("Serviço aberto")}`)
}

export async function atualizarServico(formData: FormData) {
  const { supabase } = await contexto()
  const id = String(formData.get("servico_id") ?? "")
  const estado = String(formData.get("estado") ?? "")
  const { data, error } = await supabase.from("servicos_mecanica")
    .update({
      estado,
      conserto: texto(formData, "conserto"),
      horas: num(formData, "horas"),
      conclusao_em: estado === "concluido" ? hojeISO() : null,
    })
    .eq("id", id).select("id")
  if (error || !data?.length) falhar("/mecanica", "Não deu pra atualizar o serviço.")

  revalidatePath("/mecanica")
  redirect(`/mecanica?ok=${encodeURIComponent("Serviço atualizado")}`)
}

/**
 * §7 e §25: "Mecânica NUNCA publica diretamente aos cotistas."
 *
 * Publicar é ato do dono da conta. A policy da migration 063 já esconde o
 * não-publicado de quem só vê Motores; esta action é o único jeito de a
 * coluna `publicado_em` ganhar valor, e ela exige PROP.
 */
export async function publicarServico(formData: FormData) {
  const { supabase, painel, userId } = await contexto()
  if (painel.papel !== "PROP") falhar("/mecanica", "Só o proprietário publica laudo para os cotistas.")
  const id = String(formData.get("servico_id") ?? "")

  const { data, error } = await supabase.from("servicos_mecanica")
    .update({ publicado_em: new Date().toISOString(), publicado_por: userId })
    .eq("id", id).eq("embarcacao_id", painel.embarcacao.id).select("id")
  if (error || !data?.length) falhar("/mecanica", "Não deu pra publicar.")

  // §22 — publicação para cotistas é evento auditado, com autor e hora.
  await supabase.from("auditoria").insert({
    embarcacao_id: painel.embarcacao.id,
    autor_id: userId,
    evento: "publicou_para_cotistas",
    entidade: "servicos_mecanica",
    entidade_id: id,
  })

  revalidatePath("/mecanica")
  redirect(`/mecanica?ok=${encodeURIComponent("Publicado para os cotistas")}`)
}

export async function criarOrcamento(formData: FormData) {
  const { supabase, painel, userId } = await contexto()
  const proposto = texto(formData, "servico_proposto")
  if (!proposto) falhar("/mecanica", "Descreva o serviço proposto.")

  const { error } = await supabase.from("orcamentos").insert({
    embarcacao_id: painel.embarcacao.id,
    servico_id: texto(formData, "servico_id"),
    problema: texto(formData, "problema"),
    servico_proposto: proposto,
    fornecedor: texto(formData, "fornecedor"),
    pecas: texto(formData, "pecas"),
    valor_centavos: centavos(formData, "valor"),
    valido_ate: texto(formData, "valido_ate"),
    criado_por: userId,
  })
  if (error) falhar("/mecanica", "Não deu pra salvar o orçamento.")

  revalidatePath("/mecanica")
  redirect(`/mecanica?ok=${encodeURIComponent("Orçamento salvo")}`)
}

export async function abrirVotacao(formData: FormData) {
  const { supabase, painel, userId } = await contexto()
  if (painel.papel !== "PROP") falhar("/mecanica", "Só o proprietário abre votação.")
  const id = String(formData.get("orcamento_id") ?? "")

  const { data: orc } = await supabase.from("orcamentos")
    .select("valido_ate").eq("id", id).maybeSingle()
  const { data: jaTem } = await supabase.from("votacoes")
    .select("id").eq("orcamento_id", id).maybeSingle()

  // A decisão mora no domínio, com teste — a action só pergunta.
  const r = podeAbrirVotacao(orc?.valido_ate ?? null, hojeISO(), Boolean(jaTem))
  if (!r.pode) falhar("/mecanica", r.motivo ?? "Não dá pra abrir votação neste orçamento.")

  const { error } = await supabase.from("votacoes").insert({
    embarcacao_id: painel.embarcacao.id, orcamento_id: id, aberta_por: userId,
  })
  if (error) falhar("/mecanica", "Não deu pra abrir a votação.")

  revalidatePath("/mecanica")
  redirect(`/mecanica?ok=${encodeURIComponent("Votação aberta para os cotistas")}`)
}

/** O voto do cotista. As cinco travas (em nome próprio, votação aberta, é
 *  cotista, não suspenso, um voto só) são da policy — aqui só a frase. */
export async function votar(formData: FormData) {
  const { supabase, userId } = await contexto()
  const { error } = await supabase.from("votos").insert({
    votacao_id: String(formData.get("votacao_id") ?? ""),
    votante_id: userId,
    voto: String(formData.get("voto") ?? ""),
  })
  if (error) {
    falhar("/mecanica", error.code === "23505"
      ? "Você já votou neste orçamento."
      : "Não deu pra registrar seu voto. Confira se seu acesso está ativo.")
  }
  revalidatePath("/mecanica")
  redirect(`/mecanica?ok=${encodeURIComponent("Voto registrado")}`)
}

// ---------------------------------------------------------------------------
// Estoque (§10)
// ---------------------------------------------------------------------------

export async function criarItemEstoque(formData: FormData) {
  const { supabase, userId } = await contexto()
  const nome = texto(formData, "nome")
  if (!nome) falhar("/estoque", "Dê um nome ao item.")

  const { error } = await supabase.from("estoque_itens").insert({
    dono_id: userId,
    nome,
    categoria: String(formData.get("categoria") ?? "outro"),
    unidade: texto(formData, "unidade"),
    quantidade: num(formData, "quantidade") ?? 0,
    minimo: num(formData, "minimo"),
    fornecedor: texto(formData, "fornecedor"),
    custo_unitario_centavos: centavos(formData, "custo_unitario"),
  })
  if (error) falhar("/estoque", "Não deu pra cadastrar o item.")

  revalidatePath("/estoque")
  redirect(`/estoque?ok=${encodeURIComponent("Item cadastrado")}`)
}

/**
 * Entrada, retirada e ajuste no mesmo lugar — mas a RETIRADA passa por
 * `retirarDoEstoque`, que é quem recusa deixar o saldo negativo e devolve a
 * frase dizendo quanto realmente há.
 */
export async function movimentarEstoque(formData: FormData) {
  const { supabase, painel, userId } = await contexto()
  const itemId = String(formData.get("item_id") ?? "")
  const tipo = String(formData.get("tipo") ?? "")
  const qtd = num(formData, "quantidade")
  if (qtd === null || qtd <= 0) falhar("/estoque", "Informe uma quantidade maior que zero.")

  const { data: item } = await supabase.from("estoque_itens")
    .select("quantidade").eq("id", itemId).maybeSingle()
  if (!item) falhar("/estoque", "Item não encontrado.")

  let nova: number
  if (tipo === "retirada") {
    const r = retirarDoEstoque(Number(item.quantidade), qtd)
    if (!r.ok) falhar("/estoque", r.erro)
    nova = r.nova
  } else if (tipo === "entrada") {
    nova = Number(item.quantidade) + qtd
  } else {
    // Ajuste grava o valor absoluto contado. §22: divergência exige motivo.
    if (!texto(formData, "motivo")) falhar("/estoque", "Ajuste exige o motivo da diferença.")
    nova = qtd
  }

  const { error } = await supabase.from("estoque_itens")
    .update({ quantidade: nova }).eq("id", itemId)
  if (error) falhar("/estoque", "Não deu pra atualizar o estoque.")

  await supabase.from("estoque_movimentos").insert({
    item_id: itemId,
    tipo,
    quantidade: qtd,
    embarcacao_id: tipo === "retirada" ? painel.embarcacao.id : null,
    motivo: texto(formData, "motivo"),
    autor_id: userId,
  })

  revalidatePath("/estoque")
  redirect(`/estoque?ok=${encodeURIComponent("Estoque atualizado")}`)
}

// ---------------------------------------------------------------------------
// Combustível (§11)
// ---------------------------------------------------------------------------

export async function criarTanque(formData: FormData) {
  const { supabase, userId } = await contexto()
  const nome = texto(formData, "nome")
  if (!nome) falhar("/combustivel", "Dê um nome ao tanque.")

  const { error } = await supabase.from("tanques").insert({
    dono_id: userId,
    nome,
    combustivel: texto(formData, "combustivel"),
    capacidade_litros: num(formData, "capacidade"),
    saldo_inicial_litros: num(formData, "saldo_inicial") ?? 0,
    minimo_litros: num(formData, "minimo"),
  })
  if (error) falhar("/combustivel", "Não deu pra cadastrar o tanque.")

  revalidatePath("/combustivel")
  redirect(`/combustivel?ok=${encodeURIComponent("Tanque cadastrado")}`)
}

export async function movimentarTanque(formData: FormData) {
  const { supabase, userId } = await contexto()
  const tanqueId = String(formData.get("tanque_id") ?? "")
  const tipo = String(formData.get("tipo") ?? "")
  const litros = num(formData, "litros")
  if (litros === null || litros < 0) falhar("/combustivel", "Informe os litros.")

  const destinoUnidade = texto(formData, "destino_embarcacao_id")
  const destinoLivre = texto(formData, "destino_livre")

  if (tipo === "saida") {
    // §11: destino obrigatório. A regra mora no domínio.
    const erro = validarSaidaDoTanque(litros, destinoUnidade, destinoLivre)
    if (erro) falhar("/combustivel", erro)
  }
  // §22: medição que diverge do teórico exige motivo. A tela manda o
  // teórico junto pra action não precisar recalcular o balanço inteiro.
  if (tipo === "medicao") {
    const teorico = num(formData, "teorico")
    if (teorico !== null && teorico !== litros && !texto(formData, "motivo")) {
      falhar("/combustivel", "A medição não bate com o saldo teórico. Registre o motivo da diferença.")
    }
  }

  const { data, error } = await supabase.from("tanque_movimentos").insert({
    tanque_id: tanqueId,
    tipo,
    litros,
    destino_embarcacao_id: tipo === "saida" ? destinoUnidade : null,
    destino_livre: tipo === "saida" ? destinoLivre : null,
    fornecedor: texto(formData, "fornecedor"),
    valor_centavos: centavos(formData, "valor"),
    motivo: texto(formData, "motivo"),
    autor_id: userId,
  }).select("id").maybeSingle()
  if (error || !data) falhar("/combustivel", "Não deu pra registrar o movimento.")

  // §11: "abastecimento pelo tanque baixa saldo E registra automaticamente
  // no Jet". A saída com destino de frota vira abastecimento da unidade.
  if (tipo === "saida" && destinoUnidade) {
    await supabase.from("abastecimentos").insert({
      embarcacao_id: destinoUnidade,
      tanque_movimento_id: data.id,
      litros,
      valor_centavos: centavos(formData, "valor"),
      responsavel_id: userId,
    })
  }

  revalidatePath("/combustivel")
  redirect(`/combustivel?ok=${encodeURIComponent("Movimento registrado")}`)
}

// ---------------------------------------------------------------------------
// Envios do cotista (§15)
// ---------------------------------------------------------------------------

export async function enviarAoAdm(formData: FormData) {
  const { supabase, painel, userId } = await contexto()
  const texto_ = texto(formData, "texto")
  if (!texto_) falhar("/atualizacoes", "Escreva o que você quer informar.")

  const { error } = await supabase.from("envios_cotista").insert({
    embarcacao_id: painel.embarcacao.id,
    cotista_id: userId,
    tipo: String(formData.get("tipo") ?? "observacao"),
    texto: texto_,
    horas: num(formData, "horas"),
    combustivel_pct: num(formData, "combustivel_pct"),
  })
  if (error) falhar("/atualizacoes", "Não deu pra enviar. Confira se seu acesso está ativo.")

  revalidatePath("/atualizacoes")
  redirect(`/atualizacoes?ok=${encodeURIComponent("Enviado à administradora")}`)
}

/** §15: nada altera o registro oficial sozinho — o ADM decide, e a decisão
 *  fica gravada com autor e hora (a procedência das duas pontas). */
export async function decidirEnvio(formData: FormData) {
  const { supabase, painel, userId } = await contexto()
  if (painel.papel !== "PROP") falhar("/atualizacoes", "Só o proprietário analisa os envios.")
  const id = String(formData.get("envio_id") ?? "")
  const acao = String(formData.get("acao") ?? "")
  const arquivar = acao === "arquivar"

  const { data, error } = await supabase.from("envios_cotista")
    .update({
      estado: arquivar ? "arquivado" : "incorporado",
      acao,
      decidido_por: userId,
      decidido_em: new Date().toISOString(),
    })
    .eq("id", id).eq("embarcacao_id", painel.embarcacao.id).select("id")
  if (error || !data?.length) falhar("/atualizacoes", "Não deu pra registrar a decisão.")

  revalidatePath("/atualizacoes")
  redirect(`/atualizacoes?ok=${encodeURIComponent(arquivar ? "Envio arquivado" : "Envio incorporado")}`)
}

// ---------------------------------------------------------------------------
// Afazeres (§20)
// ---------------------------------------------------------------------------

export async function criarAfazer(formData: FormData) {
  const { supabase, painel, userId } = await contexto()
  const titulo = texto(formData, "titulo")
  if (!titulo) falhar("/afazeres", "Dê um título à tarefa.")

  const { error } = await supabase.from("afazeres").insert({
    dono_id: userId,
    embarcacao_id: formData.get("da_unidade") === "on" ? painel.embarcacao.id : null,
    titulo,
    detalhe: texto(formData, "detalhe"),
    destino: String(formData.get("destino") ?? "qualquer"),
    prazo: texto(formData, "prazo"),
    criado_por: userId,
  })
  if (error) falhar("/afazeres", "Não deu pra criar a tarefa.")

  revalidatePath("/afazeres")
  redirect(`/afazeres?ok=${encodeURIComponent("Tarefa criada")}`)
}

export async function mudarEstadoAfazer(formData: FormData) {
  const { supabase } = await contexto()
  const id = String(formData.get("afazer_id") ?? "")
  const estado = String(formData.get("estado") ?? "")
  const { data, error } = await supabase.from("afazeres")
    .update({ estado, concluido_em: estado === "concluido" ? new Date().toISOString() : null })
    .eq("id", id).select("id")
  if (error || !data?.length) falhar("/afazeres", "Não deu pra mudar a tarefa.")

  revalidatePath("/afazeres")
  redirect(`/afazeres?ok=${encodeURIComponent("Tarefa atualizada")}`)
}

/** §20: manutenção/avaria vira tarefa — POR DECISÃO de alguém, nunca por
 *  gatilho automático. O título sai de `converterEmAfazer`, com teste. */
export async function converterEmTarefa(formData: FormData) {
  const { supabase, painel, userId } = await contexto()
  const tipo = String(formData.get("origem_tipo") ?? "avaria") as "manutencao" | "avaria"
  const origemId = String(formData.get("origem_id") ?? "")
  const tituloOrigem = texto(formData, "titulo_origem") ?? "Item"
  const destino = String(formData.get("destino") ?? "qualquer") as "operacoes" | "mecanica" | "qualquer"

  const novo = converterEmAfazer({ tipo, titulo: tituloOrigem }, destino)
  const { error } = await supabase.from("afazeres").insert({
    dono_id: userId,
    embarcacao_id: painel.embarcacao.id,
    titulo: novo.titulo,
    destino: novo.destino,
    origem_tipo: tipo,
    origem_id: origemId || null,
    criado_por: userId,
  })
  if (error) falhar("/afazeres", "Não deu pra converter em tarefa.")

  revalidatePath("/afazeres")
  redirect(`/afazeres?ok=${encodeURIComponent("Convertido em tarefa")}`)
}
