"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import {
  calcularExpiracao,
  CONDICOES_PRODUTO,
  FORMAS_ENTREGA,
  PERIODOS_VAGA,
  propostaTem,
  tituloDaDemanda,
  TIPOS_DEMANDA,
  TIPOS_TAXONOMIA,
  TIPOS_TRABALHO,
  TIPOS_VAGA,
  type CondicaoProduto,
  type FormaEntrega,
  type PapelNegocio,
  type PeriodoVaga,
  type TipoDemanda,
  type TipoTaxonomia,
  type TipoTrabalho,
  type TipoVaga,
} from "@/lib/domain/marketplace"
import { avisarCompativeis } from "@/lib/avisos/marketplace"
import { carregarAssinatura, carregarNivelPlano } from "@/lib/consultas"
import { carregarMapaTaxonomia, nomeDe } from "@/lib/consultas-marketplace"
import { carreiraLiberada, mensagemCarreiraBloqueada } from "@/lib/domain/captain"
import { parseDecimalPtBr } from "@/lib/domain/numeros"
import { mensagemBloqueio, recursoLiberado } from "@/lib/domain/plano-acesso"
import { supabaseServer } from "@/lib/supabase/server"

/**
 * Ações do Marketplace (onda 45, PRD upgrade2-master-final §11).
 *
 * Toda regra de negócio vive em `lib/domain/marketplace.ts` — aqui só se lê
 * formulário, valida o mínimo e grava. Toda escrita passa por `.select()` +
 * checagem do retorno: RLS que barra devolve `error: null` com zero linhas, e
 * sem a checagem a tela diria "salvo" sem ter salvado nada (regra da casa,
 * docs/CONTRIBUTING.md).
 *
 * PORTÕES DE PLANO (onda 47) — o TODO da onda 45 esperava a decisão de
 * planos, que o PRD FINAL fechou. Dois dos três portões vivem aqui:
 *   · §2.3 — Free "pode preencher o fluxo de uma demanda, mas o botão
 *     Publicar aciona o paywall" → `publicarDemanda`. Repare no que o portão
 *     NÃO faz: ele não impede montar o pedido nem apaga o que foi digitado.
 *     A tela `/marketplace/nova` continua inteira e o bloqueio só entra no
 *     Publicar, que é exatamente o que o PRD descreve;
 *   · §11.3 — "Somente Captain Pro pode publicar disponibilidade profissional
 *     estruturada" → `publicarDisponibilidade`.
 * O terceiro (§13 — vitrine/dashboard por tipo de Partner) continua fora
 * deste arquivo: depende do módulo de Partner por tipo, que não existe.
 *
 * Comissão: não existe e não deve existir aqui — §11.6, "Não cobrar comissão
 * sobre transações no Upgrade 2".
 */

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
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

/** Nome exibido a estranhos: `profiles` tem RLS de "próprio ou tripulação"
 *  (migration 008), então ninguém consegue ler o nome de quem publicou via
 *  JOIN — ele é autodeclarado no momento da publicação. Mesma solução da
 *  migration 038, mantida aqui porque o problema é o mesmo. */
async function nomeAutodeclarado(supabase: Supabase, userId: string): Promise<string> {
  const { data: profissional } = await supabase
    .from("perfis_comandante").select("nome_publico").eq("usuario_id", userId).maybeSingle()
  if (profissional?.nome_publico) return profissional.nome_publico
  const { data: perfil } = await supabase.from("profiles").select("nome").eq("id", userId).maybeSingle()
  return perfil?.nome?.trim() || "Comandante"
}

function texto(fd: FormData, chave: string): string | null {
  const v = String(fd.get(chave) ?? "").trim()
  return v === "" ? null : v
}

function inteiro(fd: FormData, chave: string): number | null {
  const bruto = texto(fd, chave)
  if (bruto == null) return null
  const n = parseDecimalPtBr(bruto)
  return n == null || !Number.isFinite(n) ? null : Math.round(n)
}

/** Campo de dinheiro em reais (pt-BR) -> centavos. "1.234,56" vira 123456 —
 *  o app inteiro guarda dinheiro em centavos (nunca float de reais). */
function centavos(fd: FormData, chave: string): number | null {
  const bruto = texto(fd, chave)
  if (bruto == null) return null
  const n = parseDecimalPtBr(bruto)
  if (n == null || !Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100)
}

function booleano(fd: FormData, chave: string): boolean | null {
  const v = texto(fd, chave)
  if (v == null) return null
  return v === "sim" || v === "true" || v === "on"
}

function umDe<T extends string>(fd: FormData, chave: string, validos: readonly T[]): T | null {
  const v = texto(fd, chave)
  return v != null && (validos as readonly string[]).includes(v) ? (v as T) : null
}

// ---------------------------------------------------------------------------
// §11.1/§11.2 — publicar uma demanda
// ---------------------------------------------------------------------------
export async function publicarDemanda(formData: FormData) {
  const supabase = await supabaseServer()
  const userId = await usuarioLogado(supabase)

  const tipo = umDe<TipoDemanda>(formData, "tipo", TIPOS_DEMANDA)
  if (!tipo) erro("/marketplace/nova", "Escolha o tipo do que você precisa.")

  const rota = `/marketplace/nova?tipo=${tipo}`

  // §2.3 — o paywall entra AQUI, no Publicar, e não antes: no Free a pessoa
  // monta a demanda inteira e só descobre o limite ao publicar, com o texto
  // dizendo que o que ela preencheu não se perde (`mensagemBloqueio`).
  const nivel = await carregarNivelPlano()
  if (!recursoLiberado("marketplace_publicar", nivel)) {
    erro(rota, mensagemBloqueio("marketplace_publicar").descricao)
  }
  const regiaoId = texto(formData, "regiao_id")
  if (!regiaoId) erro(rota, "Escolha a região — é o que decide quem vai receber o pedido.")

  const categoriaId = texto(formData, "categoria_id")
  const funcaoId = texto(formData, "funcao_id")
  const combustivelId = texto(formData, "combustivel_id")
  const portePes = inteiro(formData, "porte_pes")
  const tipoVaga = umDe<TipoVaga>(formData, "tipo_vaga", TIPOS_VAGA)
  const quantidadeLitros = inteiro(formData, "quantidade_litros")

  // Os mesmos requisitos que a constraint `demandas_campos_por_tipo` exige no
  // banco (migration 046) — checados aqui pra virar mensagem em português em
  // vez de um erro de constraint que a pessoa não entende.
  if ((tipo === "profissional" || tipo === "produto") && !categoriaId) {
    erro(rota, "Escolha a categoria — sem ela o pedido não chega em ninguém.")
  }
  if (tipo === "tripulacao" && !funcaoId) erro(rota, "Escolha a função de quem você precisa a bordo.")
  if (tipo === "vaga_embarcacao" && (portePes == null || !tipoVaga)) {
    erro(rota, "Informe o porte em pés e se a vaga é seca ou molhada.")
  }
  if (tipo === "caminhao" && (!combustivelId || quantidadeLitros == null)) {
    erro(rota, "Informe o combustível e quantos litros você precisa.")
  }

  const dataDesejada = texto(formData, "data_desejada")
  const dataFim = texto(formData, "data_fim")
  if (dataDesejada && dataFim && dataFim < dataDesejada) {
    erro(rota, "A data final não pode ser antes da data inicial.")
  }

  const agora = new Date().toISOString()
  const autorNome = await nomeAutodeclarado(supabase, userId)

  const marcaId = texto(formData, "marca_id")
  const { data: criada, error } = await supabase.from("demandas").insert({
    autor_id: userId,
    autor_nome: autorNome,
    tipo,
    regiao_id: regiaoId,
    categoria_id: categoriaId,
    funcao_id: funcaoId,
    marca_id: marcaId,
    combustivel_id: combustivelId,
    porte_pes: portePes,
    tipo_vaga: tipoVaga,
    quantidade_litros: quantidadeLitros,
    data_desejada: dataDesejada,
    data_fim: dataFim,
    observacao: texto(formData, "observacao"),
    // §11.2 — sem data específica expira em 30 dias; com data/período, no
    // prazo da própria demanda. A regra é do domínio, não da tela.
    expira_em: calcularExpiracao(agora, dataDesejada, dataFim),
  }).select("id").single()
  if (error || !criada) erro(rota, "Não foi possível publicar agora. Tente de novo.")

  // §22 — o contato do proprietário vai pra tabela separada, que a RLS só
  // libera pra quem tiver proposta ACEITA. Guardar aqui e não em `demandas`
  // é o que impede um parceiro qualquer de varrer telefones.
  const telefone = texto(formData, "telefone")
  const email = texto(formData, "email")
  if (telefone || email) {
    await supabase.from("demandas_contato").insert({ demanda_id: criada.id, telefone, email })
  }

  // ONDA 99 — O PEDIDO PASSA A AVISAR QUEM ATENDE (§11.4 + §5.2).
  //
  // Era exatamente aqui que a onda 45 parou: inseria, revalidava, redirecionava
  // — e ninguém ficava sabendo. A régua de quem avisar já existia e estava
  // testada (`usuariosCompativeis`); o que faltava era esta linha.
  //
  // Depois do insert e nunca antes, por dois motivos: só existe o que avisar
  // quando a demanda tem id, e o aviso não pode ser o que impede a publicação.
  // `avisarCompativeis` nunca lança (ver o cabeçalho dela) — se o disparo
  // falhar, o pedido continua publicado e visível na vitrine, que é o
  // comportamento de antes desta onda.
  //
  // O título vai montado daqui porque é aqui que existe a sessão do usuário
  // para ler `taxonomia` — o disparo roda com chave de serviço e não deve
  // reabrir essa porta só para traduzir três uuid em nome.
  const mapa = await carregarMapaTaxonomia()
  await avisarCompativeis({
    id: criada.id,
    autor_id: userId,
    tipo,
    regiao_id: regiaoId,
    categoria_id: categoriaId,
    funcao_id: funcaoId,
    combustivel_id: combustivelId,
    tipo_vaga: tipoVaga,
    porte_pes: portePes,
    titulo: tituloDaDemanda({
      tipo,
      regiaoNome: mapa.get(regiaoId)?.nome ?? "sua região",
      categoriaNome: nomeDe(mapa, categoriaId),
      funcaoNome: nomeDe(mapa, funcaoId),
      marcaNome: nomeDe(mapa, marcaId),
      combustivelNome: nomeDe(mapa, combustivelId),
      portePes,
      tipoVaga,
      quantidadeLitros,
      dataDesejada,
      dataFim,
    }),
  })

  revalidatePath("/marketplace")
  ok(`/marketplace/${criada.id}`, "Publicado")
}

export async function atualizarStatusDemanda(formData: FormData) {
  const supabase = await supabaseServer()
  const userId = await usuarioLogado(supabase)

  const id = String(formData.get("demanda_id") ?? "")
  const novo = umDe(formData, "status", ["aberta", "em_negociacao", "fechada", "cancelada"] as const)
  if (!novo) erro(`/marketplace/${id}`, "Não entendi para qual situação mudar.")

  const { data: salvo, error } = await supabase
    .from("demandas").update({ status: novo }).eq("id", id).eq("autor_id", userId).select("id")
  if (error || !salvo?.length) erro(`/marketplace/${id}`, "Não foi possível atualizar agora. Tente de novo.")

  revalidatePath("/marketplace")
  revalidatePath(`/marketplace/${id}`)
  ok(`/marketplace/${id}`, "Atualizado")
}

// ---------------------------------------------------------------------------
// §11.5 — propostas e candidaturas
// ---------------------------------------------------------------------------
export async function enviarProposta(formData: FormData) {
  const supabase = await supabaseServer()
  const userId = await usuarioLogado(supabase)

  const demandaId = String(formData.get("demanda_id") ?? "")
  const rota = `/marketplace/${demandaId}`
  const tipo = umDe<TipoDemanda>(formData, "tipo_demanda", TIPOS_DEMANDA)
  if (!tipo) erro(rota, "Não foi possível identificar o pedido. Recarregue a página.")

  // Só grava o que aquele tipo usa (§11.5). Sem esse filtro, um formulário
  // adulterado gravaria "preço por litro" numa proposta de estofamento — e o
  // resumo da proposta mostraria isso a quem publicou.
  const usa = (c: Parameters<typeof propostaTem>[1]) => propostaTem(tipo, c)

  const valorACombinar = booleano(formData, "valor_a_combinar") === true
  const valorCentavos = usa("valor") && !valorACombinar ? centavos(formData, "valor") : null

  const linha = {
    demanda_id: demandaId,
    autor_id: userId,
    autor_nome: await nomeAutodeclarado(supabase, userId),
    telefone: texto(formData, "telefone"),
    disponibilidade: usa("disponibilidade") ? texto(formData, "disponibilidade") : null,
    data_possivel: usa("data_possivel") ? texto(formData, "data_possivel") : null,
    valor_centavos: valorCentavos,
    valor_a_combinar: usa("valor") ? valorACombinar : false,
    observacao: texto(formData, "observacao"),
    precisa_visita: usa("precisa_visita") ? booleano(formData, "precisa_visita") : null,
    marca_modelo: usa("marca_modelo") ? texto(formData, "marca_modelo") : null,
    condicao: usa("condicao") ? umDe<CondicaoProduto>(formData, "condicao", CONDICOES_PRODUTO) : null,
    entrega: usa("entrega") ? umDe<FormaEntrega>(formData, "entrega", FORMAS_ENTREGA) : null,
    prazo_dias: usa("prazo_dias") ? inteiro(formData, "prazo_dias") : null,
    tipo_vaga: usa("tipo_vaga") ? umDe<TipoVaga>(formData, "tipo_vaga", TIPOS_VAGA) : null,
    periodo: usa("periodo") ? umDe<PeriodoVaga>(formData, "periodo", PERIODOS_VAGA) : null,
    tem_agua_energia: usa("agua_energia") ? booleano(formData, "agua_energia") : null,
    preco_litro_centavos: usa("preco_litro") ? centavos(formData, "preco_litro") : null,
    quantidade_litros: usa("quantidade_litros") ? inteiro(formData, "quantidade_litros") : null,
    taxa_deslocamento_centavos: usa("taxa_deslocamento") ? centavos(formData, "taxa_deslocamento") : null,
    valor_estimado_centavos: usa("valor_estimado") ? centavos(formData, "valor_estimado") : null,
  }

  const { data: salvo, error } = await supabase.from("propostas").insert(linha).select("id")
  if (error || !salvo?.length) {
    // A RLS barra proposta em demanda vencida/fechada e na própria demanda;
    // a unique barra a segunda proposta da mesma pessoa. Uma frase cobre os
    // três casos sem revelar qual foi.
    erro(rota, "Não foi possível enviar. O pedido pode ter sido encerrado ou você já respondeu a ele.")
  }

  revalidatePath(rota)
  ok(rota, "Enviado")
}

/** Aceitar move a demanda pra "em negociação" — é o momento em que o §22
 *  libera o contato do proprietário pra ESTA pessoa (a RLS de
 *  `demandas_contato` lê exatamente este `status = 'aceita'`). */
export async function responderProposta(formData: FormData) {
  const supabase = await supabaseServer()
  const userId = await usuarioLogado(supabase)

  const demandaId = String(formData.get("demanda_id") ?? "")
  const propostaId = String(formData.get("proposta_id") ?? "")
  const rota = `/marketplace/${demandaId}`
  const decisao = umDe(formData, "decisao", ["aceita", "recusada"] as const)
  if (!decisao) erro(rota, "Não entendi a resposta. Tente de novo.")

  const { data: salvo, error } = await supabase
    .from("propostas").update({ status: decisao }).eq("id", propostaId).select("id")
  if (error || !salvo?.length) erro(rota, "Não foi possível responder agora. Tente de novo.")

  if (decisao === "aceita") {
    await supabase
      .from("demandas").update({ status: "em_negociacao" }).eq("id", demandaId).eq("autor_id", userId)
  }

  revalidatePath(rota)
  ok(rota, decisao === "aceita" ? "Proposta aceita — o contato foi liberado" : "Proposta recusada")
}

export async function retirarProposta(formData: FormData) {
  const supabase = await supabaseServer()
  const userId = await usuarioLogado(supabase)

  const demandaId = String(formData.get("demanda_id") ?? "")
  const rota = `/marketplace/${demandaId}`
  const { data: salvo, error } = await supabase
    .from("propostas").update({ status: "retirada" })
    .eq("demanda_id", demandaId).eq("autor_id", userId).select("id")
  if (error || !salvo?.length) erro(rota, "Não foi possível retirar agora. Tente de novo.")

  revalidatePath(rota)
  ok(rota, "Retirada")
}

// ---------------------------------------------------------------------------
// §11.6 — fechamento e confirmação bilateral
// ---------------------------------------------------------------------------
/**
 * "Um lado marca como realizado" (§11.6). Cria o negócio E a declaração de
 * quem marcou, na mesma ação — um negócio sem a primeira declaração seria um
 * registro pela metade, e o estado bilateral se calcula das declarações.
 *
 * TODO: integrar com Financeiro (onda 42) — depois da confirmação bilateral o
 * §11.6 pede "Adicionar ao Financeiro". O módulo está sendo construído por
 * outro agente agora; quando existir, o lançamento nasce daqui com
 * `valor_final_centavos` e a categoria do tipo da demanda.
 */
export async function marcarNegocioRealizado(formData: FormData) {
  const supabase = await supabaseServer()
  const userId = await usuarioLogado(supabase)

  const demandaId = String(formData.get("demanda_id") ?? "")
  const propostaId = String(formData.get("proposta_id") ?? "")
  const clienteId = String(formData.get("cliente_id") ?? "")
  const fornecedorId = String(formData.get("fornecedor_id") ?? "")
  const rota = `/marketplace/${demandaId}`

  const papel: PapelNegocio | null =
    userId === clienteId ? "cliente" : userId === fornecedorId ? "fornecedor" : null
  if (!papel) erro(rota, "Só quem publicou o pedido ou quem fez a proposta pode marcar o negócio.")

  const { data: negocio, error } = await supabase.from("negocios").insert({
    demanda_id: demandaId,
    proposta_id: propostaId,
    cliente_id: clienteId,
    fornecedor_id: fornecedorId,
    // §11.6: "Valor final é opcional e pode ser diferente do valor
    // inicialmente proposto" — por isso não copiamos o valor da proposta.
    valor_final_centavos: centavos(formData, "valor_final"),
  }).select("id").single()
  if (error || !negocio) erro(rota, "Não foi possível registrar o negócio agora. Tente de novo.")

  const { error: erroConfirmacao } = await supabase.from("negocios_confirmacoes").insert({
    negocio_id: negocio.id,
    usuario_id: userId,
    papel,
    decisao: "realizado",
    observacao: texto(formData, "observacao"),
  })
  if (erroConfirmacao) erro(rota, "O negócio foi criado, mas a sua confirmação falhou. Abra o pedido e tente de novo.")

  revalidatePath(rota)
  ok(rota, "Marcado como realizado — falta o outro lado confirmar")
}

/** "O outro confirma ou nega" (§11.6). A unique (negocio, usuário) do banco é
 *  o que impede quem marcou realizado de confirmar sozinho. */
export async function responderConfirmacaoNegocio(formData: FormData) {
  const supabase = await supabaseServer()
  const userId = await usuarioLogado(supabase)

  const demandaId = String(formData.get("demanda_id") ?? "")
  const negocioId = String(formData.get("negocio_id") ?? "")
  const rota = `/marketplace/${demandaId}`
  const decisao = umDe(formData, "decisao", ["confirmado", "negado"] as const)
  if (!decisao) erro(rota, "Não entendi a resposta. Tente de novo.")

  const { data: negocio } = await supabase
    .from("negocios").select("cliente_id, fornecedor_id").eq("id", negocioId).maybeSingle()
  if (!negocio) erro(rota, "Não encontrei esse negócio. Recarregue a página.")

  const papel: PapelNegocio | null =
    userId === negocio.cliente_id ? "cliente" : userId === negocio.fornecedor_id ? "fornecedor" : null
  if (!papel) erro(rota, "Só quem participou do negócio pode confirmar ou negar.")

  const { data: salvo, error } = await supabase.from("negocios_confirmacoes").insert({
    negocio_id: negocioId,
    usuario_id: userId,
    papel,
    decisao,
    observacao: texto(formData, "observacao"),
  }).select("id")
  if (error || !salvo?.length) erro(rota, "Não foi possível registrar agora — talvez você já tenha respondido.")

  // Confirmado dos dois lados fecha a demanda. Negado não fecha: as partes
  // continuam conversando, e travar a demanda esconderia a chance de acerto.
  if (decisao === "confirmado") {
    await supabase.from("demandas").update({ status: "fechada" }).eq("id", demandaId).eq("autor_id", userId)
  }

  revalidatePath(rota)
  ok(
    rota,
    decisao === "confirmado"
      ? "Negócio confirmado pelos dois lados"
      : "Registramos que você não reconhece esse negócio",
  )
}

// ---------------------------------------------------------------------------
// §11.4 — interesses do parceiro (o cadastro que alimenta o matching)
// ---------------------------------------------------------------------------
export async function salvarInteresse(formData: FormData) {
  const supabase = await supabaseServer()
  const userId = await usuarioLogado(supabase)

  const tipoDemanda = umDe<TipoDemanda>(formData, "tipo_demanda", TIPOS_DEMANDA)
  const regiaoId = texto(formData, "regiao_id")
  if (!tipoDemanda || !regiaoId) erro("/marketplace/interesses", "Escolha o tipo de pedido e a região.")

  const { data: salvo, error } = await supabase.from("interesses_marketplace").insert({
    usuario_id: userId,
    tipo_demanda: tipoDemanda,
    regiao_id: regiaoId,
    categoria_id: texto(formData, "categoria_id"),
    funcao_id: texto(formData, "funcao_id"),
    combustivel_id: texto(formData, "combustivel_id"),
    porte_max_pes: inteiro(formData, "porte_max_pes"),
  }).select("id")
  if (error || !salvo?.length) {
    erro("/marketplace/interesses", "Não foi possível salvar — você provavelmente já tem esse interesse cadastrado.")
  }

  revalidatePath("/marketplace")
  revalidatePath("/marketplace/interesses")
  ok("/marketplace/interesses", "Interesse adicionado")
}

export async function removerInteresse(formData: FormData) {
  const supabase = await supabaseServer()
  const userId = await usuarioLogado(supabase)

  const id = String(formData.get("interesse_id") ?? "")
  const { data: salvo, error } = await supabase
    .from("interesses_marketplace").delete().eq("id", id).eq("usuario_id", userId).select("id")
  if (error || !salvo?.length) erro("/marketplace/interesses", "Não foi possível remover agora. Tente de novo.")

  revalidatePath("/marketplace")
  revalidatePath("/marketplace/interesses")
  ok("/marketplace/interesses", "Interesse removido")
}

// ---------------------------------------------------------------------------
// §11.3 — Ofereço / Estou disponível
// ---------------------------------------------------------------------------
export async function publicarDisponibilidade(formData: FormData) {
  const supabase = await supabaseServer()
  const userId = await usuarioLogado(supabase)
  const rota = "/marketplace/disponibilidades/nova"

  // §11.3: "Somente Captain Pro pode publicar disponibilidade profissional
  // estruturada." Aqui o degrau é o do PRÓPRIO usuário (a assinatura dele),
  // não o da embarcação — publicar disponibilidade é ato de carreira, e §12
  // deixa claro que os dois não se misturam ("Captain Pro nunca concede acesso
  // adicional à embarcação por si só"). Commander Pro do barco de outra pessoa
  // não paga a carreira dele.
  // Onda 50 — a régua e o texto saíram daqui e viraram fonte única em
  // `lib/domain/captain.ts`. E, desde a migration 051, a RLS do INSERT de
  // `disponibilidades` também exige Captain Pro: esta checagem existe pra dar
  // uma mensagem boa, não pra ser a única guarda — um POST direto no
  // PostgREST batia só na policy.
  const { plano } = await carregarAssinatura()
  if (!carreiraLiberada("disponibilidade", plano)) {
    const m = mensagemCarreiraBloqueada("disponibilidade")
    erro(rota, `${m.titulo}. ${m.descricao}`)
  }

  const funcaoId = texto(formData, "funcao_id")
  const regiaoId = texto(formData, "regiao_id")
  const tipoTrabalho = umDe<TipoTrabalho>(formData, "tipo_trabalho", TIPOS_TRABALHO)
  if (!funcaoId || !regiaoId || !tipoTrabalho) {
    erro(rota, "Escolha a função, a região e o tipo de trabalho.")
  }

  const dataInicio = texto(formData, "data_inicio")
  const dataFim = texto(formData, "data_fim")
  if (dataInicio && dataFim && dataFim < dataInicio) erro(rota, "A data final não pode ser antes da inicial.")

  const { data: salvo, error } = await supabase.from("disponibilidades").insert({
    autor_id: userId,
    autor_nome: await nomeAutodeclarado(supabase, userId),
    funcao_id: funcaoId,
    regiao_id: regiaoId,
    tipo_trabalho: tipoTrabalho,
    data_inicio: dataInicio,
    data_fim: dataFim,
    experiencia_anos: inteiro(formData, "experiencia_anos"),
    porte_max_pes: inteiro(formData, "porte_max_pes"),
    certificacoes: texto(formData, "certificacoes"),
    observacao: texto(formData, "observacao"),
    telefone: texto(formData, "telefone"),
    // Mesma régua do §11.2: sem período declarado, 30 dias.
    expira_em: calcularExpiracao(new Date().toISOString(), dataInicio, dataFim),
  }).select("id")
  if (error || !salvo?.length) erro(rota, "Não foi possível publicar agora. Tente de novo.")

  revalidatePath("/marketplace/disponibilidades")
  ok("/marketplace/disponibilidades", "Publicado")
}

export async function encerrarDisponibilidade(formData: FormData) {
  const supabase = await supabaseServer()
  const userId = await usuarioLogado(supabase)

  const id = String(formData.get("disponibilidade_id") ?? "")
  const { data: salvo, error } = await supabase
    .from("disponibilidades").update({ ativo: false }).eq("id", id).eq("autor_id", userId).select("id")
  if (error || !salvo?.length) {
    erro("/marketplace/disponibilidades", "Não foi possível encerrar agora. Tente de novo.")
  }

  revalidatePath("/marketplace/disponibilidades")
  ok("/marketplace/disponibilidades", "Encerrado")
}

// ---------------------------------------------------------------------------
// §21.2 — pedir uma categoria/região/marca que não existe na lista
// ---------------------------------------------------------------------------
/** "Usuário pode solicitar inclusão de marca/categoria ausente; evitar
 *  duplicatas livres" (§21.2). É esta válvula que permite manter os campos
 *  padronizados sem deixar ninguém sem saída. */
export async function solicitarTaxonomia(formData: FormData) {
  const supabase = await supabaseServer()
  const userId = await usuarioLogado(supabase)
  const volta = String(formData.get("volta") ?? "/marketplace")

  const tipo = umDe<TipoTaxonomia>(formData, "tipo", TIPOS_TAXONOMIA)
  const nome = texto(formData, "nome")
  if (!tipo || !nome) erro(volta, "Diga o que está faltando e de que tipo é.")

  const { data: salvo, error } = await supabase.from("taxonomia_solicitacoes").insert({
    solicitante_id: userId,
    tipo,
    nome,
    observacao: texto(formData, "observacao"),
  }).select("id")
  if (error || !salvo?.length) erro(volta, "Não foi possível enviar o pedido agora. Tente de novo.")

  ok(volta, "Pedido enviado — vamos avaliar a inclusão")
}
