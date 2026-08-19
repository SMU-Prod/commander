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
// §12 — A ENTRADA AUTOMÁTICA NO FINANCEIRO, COM PROCEDÊNCIA
// ---------------------------------------------------------------------------

/**
 * O §12 traz uma tabela chamada "Origem → Entrada automática no Financeiro", e
 * até a auditoria de 19/08 ela não existia em lugar nenhum: as ações abaixo
 * escreviam em `estoque_movimentos`, `tanque_movimentos` e `abastecimentos`, e
 * NUNCA em `lancamentos_financeiros`. Consequência visível: `/frota` prometia
 * "em quê cada unidade gastou" lendo uma coluna que ninguém preenchia.
 *
 * O que esta função faz, e principalmente o que ela se RECUSA a fazer:
 *
 *   NÃO INVENTA VALOR. Sem custo unitário no item, ou sem valor informado no
 *   abastecimento, ela devolve `"sem_valor"` e não lança nada. Estimar (pelo
 *   último preço, pela média do mercado) transformaria o custo da frota — um
 *   número que o ADM leva para conversa com cliente — num palpite com cara de
 *   fato. É a mesma regra do `null` que a casa aplica na tela, aplicada uma
 *   camada antes: se não sabe quanto custou, não escreve custo.
 *
 *   NÃO ENGOLE A RECUSA. O insert passa pela policy `permissao(embarcacao_id,
 *   'gastos', 'editar')` — um Operações que retira peça pode muito bem não
 *   tê-la. Nesse caso o movimento de estoque continua válido (é fato do
 *   almoxarifado) mas o lançamento não entra, e quem clicou precisa LER isso,
 *   senão vai acreditar num custo de frota que está faltando dinheiro.
 *
 *   NÃO DUPLICA. `lancamentos_uma_entrada_por_origem` (migration 065) é único
 *   por (origem, origem_id); um duplo clique bate no 23505 e a segunda
 *   tentativa é tratada como sucesso, não como erro — porque o lançamento que
 *   ela queria criar já está lá.
 */
type ResultadoLancamento = "lancado" | "sem_valor" | "recusado"

async function lancarCustoComOrigem(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  dados: {
    embarcacaoId: string
    origem: "combustivel" | "mecanica" | "estoque" | "avaria" | "documentacao"
    origemId: string
    categoria: string
    descricao: string
    valorCentavos: number | null
    userId: string | null
  },
): Promise<ResultadoLancamento> {
  if (dados.valorCentavos == null || dados.valorCentavos <= 0) return "sem_valor"

  const { error } = await supabase.from("lancamentos_financeiros").insert({
    embarcacao_id: dados.embarcacaoId,
    tipo: "despesa",
    categoria: dados.categoria,
    descricao: dados.descricao,
    valor_centavos: dados.valorCentavos,
    data: hojeISO(),
    // "pago" e não "pendente": a peça já foi comprada quando entrou no
    // estoque, e o combustível já foi comprado quando encheu o tanque. Não há
    // conta a vencer aqui — o que acontece agora é o custo achar a unidade.
    status: "pago",
    origem: dados.origem,
    origem_id: dados.origemId,
    criado_por: dados.userId,
  })
  if (!error) return "lancado"
  return error.code === "23505" ? "lancado" : "recusado"
}

/** O sufixo que a mensagem de sucesso ganha — a pessoa precisa saber se o
 *  custo entrou no Financeiro, porque é ele que alimenta `/frota`. */
function sufixoDoLancamento(r: ResultadoLancamento, oQueFaltou: string): string {
  switch (r) {
    case "lancado": return " · custo lançado no Financeiro"
    case "sem_valor": return ` · sem ${oQueFaltou}, nada foi lançado no Financeiro`
    case "recusado": return " · o custo NÃO entrou no Financeiro (seu acesso não permite editar Financeiro)"
  }
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

  const publicadoEm = new Date().toISOString()
  const { data, error } = await supabase.from("servicos_mecanica")
    .update({ publicado_em: publicadoEm, publicado_por: userId })
    .eq("id", id).eq("embarcacao_id", painel.embarcacao.id)
    .select("id, problema_informado")
  if (error || !data?.length) falhar("/mecanica", "Não deu pra publicar.")

  // §22 — publicação para cotistas é evento auditado, com autor e hora.
  // A3 (auditoria 19/08): `alvo`, `antes` e `depois` estavam vazios aqui
  // também. `alvo` é o problema que o laudo trata — é assim que a linha fica
  // legível meses depois, quando ninguém lembra do uuid do serviço.
  await supabase.from("auditoria").insert({
    embarcacao_id: painel.embarcacao.id,
    autor_id: userId,
    evento: "publicou_para_cotistas",
    entidade: "servicos_mecanica",
    entidade_id: id,
    alvo: (data[0].problema_informado as string | null)?.trim() || null,
    antes: { publicado_em: null },
    depois: { publicado_em: publicadoEm },
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

/**
 * §9 — APURAR E FECHAR. AUDITORIA 19/08, A14 e B6.
 *
 * `votacoes.encerrada_em` era lida em dois lugares de `/mecanica` e escrita em
 * nenhum: a tela escondia os botões de voto quando a votação estivesse
 * encerrada, e nada no app produzia esse estado. A votação ficava aberta para
 * sempre, e nunca havia o momento em que o ADM diz "apurado, seguimos" — o
 * orçamento não avança nem morre.
 *
 * A migration 063 já previa o gesto: a policy de UPDATE se chama, com todas as
 * letras, "votacoes: so o dono encerra". Faltava a action.
 *
 * Encerrar NÃO decide nada por ninguém: o placar continua o que os cotistas
 * votaram (`apurarVotacao` é quem lê), e a única coisa que muda é que a urna
 * fecha. Por isso não há campo de "resultado" aqui — inventar um deixaria o
 * ADM sobrescrever a votação que ele mesmo abriu.
 */
export async function encerrarVotacao(formData: FormData) {
  const { supabase, painel } = await contexto()
  if (painel.papel !== "PROP") falhar("/mecanica", "Só o proprietário encerra a votação.")
  const id = String(formData.get("votacao_id") ?? "")

  const { data, error } = await supabase.from("votacoes")
    .update({ encerrada_em: new Date().toISOString() })
    .eq("id", id).eq("embarcacao_id", painel.embarcacao.id)
    .is("encerrada_em", null)
    .select("id")
  // `is("encerrada_em", null)` no filtro: encerrar duas vezes reescreveria a
  // hora da apuração, e a hora é justamente o que dá valor ao registro.
  if (error || !data?.length) falhar("/mecanica", "Não deu pra encerrar. Talvez ela já esteja encerrada.")

  revalidatePath("/mecanica")
  redirect(`/mecanica?ok=${encodeURIComponent("Votação encerrada")}`)
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
    .select("quantidade, nome, custo_unitario_centavos").eq("id", itemId).maybeSingle()
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

  // AUDITORIA 19/08, B5 — A UNIDADE PASSOU A SER PERGUNTADA.
  //
  // O cabeçalho de /estoque sempre disse que "a unidade entra na RETIRADA", e
  // até aqui a action gravava a unidade ATIVA sem perguntar. Numa base que
  // atende 40 unidades, quem está no balcão tirando um filtro raramente tem a
  // unidade certa aberta no app — o rastro saía errado com aparência de
  // certo, que é o mesmo defeito do B2 em /afazeres. Sem escolha no
  // formulário, a unidade ativa segue como padrão.
  const destinoRetirada = tipo === "retirada"
    ? (texto(formData, "embarcacao_id") ?? painel.embarcacao.id)
    : null

  const { error } = await supabase.from("estoque_itens")
    .update({ quantidade: nova }).eq("id", itemId)
  if (error) falhar("/estoque", "Não deu pra atualizar o estoque.")

  const { data: movimento } = await supabase.from("estoque_movimentos").insert({
    item_id: itemId,
    tipo,
    quantidade: qtd,
    embarcacao_id: destinoRetirada,
    motivo: texto(formData, "motivo"),
    autor_id: userId,
  }).select("id").maybeSingle()

  // §12 — a peça que sai da prateleira vira custo DA UNIDADE que a recebeu,
  // com procedência "estoque". Sem custo unitário cadastrado no item o app
  // não tem como saber quanto ela vale, e não chuta (ver
  // `lancarCustoComOrigem`).
  let sufixo = ""
  if (tipo === "retirada" && movimento && destinoRetirada) {
    const unitario = item.custo_unitario_centavos as number | null
    sufixo = sufixoDoLancamento(
      await lancarCustoComOrigem(supabase, {
        embarcacaoId: destinoRetirada,
        origem: "estoque",
        origemId: movimento.id,
        categoria: "pecas_equipamentos",
        descricao: `Retirada do estoque — ${item.nome}`,
        valorCentavos: unitario == null ? null : Math.round(qtd * unitario),
        userId,
      }),
      "custo unitário cadastrado no item",
    )
  }

  revalidatePath("/estoque")
  revalidatePath("/frota")
  redirect(`/estoque?ok=${encodeURIComponent(`Estoque atualizado${sufixo}`)}`)
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
  let sufixo = ""
  if (tipo === "saida" && destinoUnidade) {
    await supabase.from("abastecimentos").insert({
      embarcacao_id: destinoUnidade,
      tanque_movimento_id: data.id,
      litros,
      valor_centavos: centavos(formData, "valor"),
      responsavel_id: userId,
    })

    // §12 — e o abastecimento vira custo da unidade, com procedência
    // "combustivel". Sem valor informado não há lançamento: o litro do tanque
    // próprio custou o que a empresa pagou na compra, e essa conta o app não
    // tem (ver A10 da auditoria — `precoPorLitroCentavos` existe no domínio e
    // ainda não tem por onde entrar).
    sufixo = sufixoDoLancamento(
      await lancarCustoComOrigem(supabase, {
        embarcacaoId: destinoUnidade,
        origem: "combustivel",
        origemId: data.id,
        categoria: "combustivel",
        descricao: `Abastecimento pelo tanque da base — ${litros.toLocaleString("pt-BR")} L`,
        valorCentavos: centavos(formData, "valor"),
        userId,
      }),
      "valor informado",
    )
  }

  revalidatePath("/combustivel")
  revalidatePath("/frota")
  redirect(`/combustivel?ok=${encodeURIComponent(`Movimento registrado${sufixo}`)}`)
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
