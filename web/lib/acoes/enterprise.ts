"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { carregarPainel } from "@/lib/consultas"
import { hojeISO } from "@/lib/consultas"
import { parseDecimalPtBr } from "@/lib/domain/numeros"
import { podeAbrirVotacao } from "@/lib/domain/mecanica"
import {
  retirarDoEstoque, totalCentavosPorLitro, validarSaidaDoTanque,
} from "@/lib/domain/estoque-combustivel"
import {
  converterEmAfazer, ESTADOS_AFAZER, recusaDoResponsavel, type EstadoAfazer,
} from "@/lib/domain/afazeres"
import { valorAlancar } from "@/lib/domain/financeiro-frota"
import {
  exigeMotivoDeAjuste, podePublicarParaCotistas,
  type ModoAprovacao, type Papel,
} from "@/lib/domain/enterprise"
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

/**
 * A régua de confiança desta pessoa nesta unidade (§3).
 *
 * Consulta separada e não no `contexto()` porque só duas actions precisam
 * dela — cobrar uma ida ao banco de toda ação do Enterprise pra servir duas
 * seria pagar caro pela conveniência.
 *
 * Sem vínculo legível, o padrão é `tudo`: a régua mais apertada. Quem não
 * consegue provar em que nível de confiança está não estreia no mais solto —
 * essa é a diferença entre falhar fechado e falhar aberto, e num gesto que
 * publica laudo para dez cotistas ela não é acadêmica.
 */
async function modoAprovacaoDe(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  embarcacaoId: string,
  papel: string,
): Promise<ModoAprovacao> {
  const { data } = await supabase.from("vinculos").select("modo_aprovacao")
    .eq("embarcacao_id", embarcacaoId).eq("papel", papel).maybeSingle()
  return (data?.modo_aprovacao as ModoAprovacao | null) ?? "tudo"
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

  const { data, error } = await supabase.from("lancamentos_financeiros").insert({
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
  }).select("id")
  // O "NÃO ENGOLE A RECUSA" do cabeçalho estava escrito e não estava
  // acontecendo: `lancamentos: criar pela matriz` recusa quem não tem
  // `gastos:editar` devolvendo zero linha com `error` NULO, e o `if (!error)`
  // de antes lia isso como sucesso. O mecânico retirava a peça, a tela dizia
  // "custo lançado no Financeiro" e `/frota` ficava com o custo faltando —
  // exatamente o desfecho que esta função nasceu para denunciar.
  if (error) return error.code === "23505" ? "lancado" : "recusado"
  return data?.length ? "lancado" : "recusado"
}

/** O sufixo que a mensagem de sucesso ganha — a pessoa precisa saber se o
 *  custo entrou no Financeiro, porque é ele que alimenta `/frota`. */
function sufixoDoLancamento(r: ResultadoLancamento, oQueFaltou: string): string {
  switch (r) {
    case "lancado": return " · custo lançado no Financeiro"
    case "sem_valor": return ` · sem ${oQueFaltou}, nada foi lançado no Financeiro`
    // Sem diagnóstico: "recusado" cobre tanto a policy barrando quanto um erro
    // do banco, e a função não distingue os dois. O que ela sabe — e o que a
    // pessoa precisa ouvir — é que o custo não está lá e alguém tem que lançar.
    case "recusado": return " · o custo NÃO entrou no Financeiro; lance à mão em Financeiro"
  }
}

// ---------------------------------------------------------------------------
// Mecânica (§7) e votação (§9)
// ---------------------------------------------------------------------------

export async function abrirServico(formData: FormData) {
  const { supabase, painel, userId } = await contexto()
  const problema = texto(formData, "problema_informado")
  if (!problema) falhar("/mecanica", "Diga qual é o problema.")

  // `servicos_mecanica: quem edita motores registra` recusa com zero linha e
  // `error` nulo. A frase não nomeia mais o acesso a Motores: este `if` cobre
  // também erro de banco, e apontar a causa errada manda a pessoa conferir
  // permissão quando o problema pode ser outro.
  const { data, error } = await supabase.from("servicos_mecanica").insert({
    embarcacao_id: painel.embarcacao.id,
    problema_informado: problema,
    diagnostico: texto(formData, "diagnostico"),
    entrada_em: texto(formData, "entrada_em"),
    criado_por: userId,
  }).select("id")
  if (error || !data?.length) {
    falhar("/mecanica", "O serviço não foi aberto. Tente de novo; se continuar, fale com quem administra a unidade.")
  }

  revalidatePath("/mecanica")
  redirect(`/mecanica?ok=${encodeURIComponent("Serviço aberto")}`)
}

/**
 * §12 — QUANTO ESTE SERVIÇO CUSTOU DE VERDADE, SEM CONTAR PEÇA DUAS VEZES.
 *
 * AUDITORIA 19/08, A11. `avisoDeDuplicidade` e `valorAlancar` existiam,
 * testadas, sem nenhum consumidor — e a armadilha que elas evitam é real e
 * silenciosa: o mecânico retira R$ 800 em peças do estoque (que já viraram
 * custo da unidade, §10) e depois a oficina cobra R$ 2.000 pelo serviço,
 * valor que na nota JÁ INCLUI as mesmas peças. A unidade fica com R$ 2.800 de
 * custo tendo gasto R$ 2.000, e ninguém percebe porque os dois lançamentos
 * estão certos separadamente.
 *
 * O app não pode adivinhar qual dos dois casos é. Ele pergunta — e só quando
 * faz sentido perguntar: sem peça retirada PARA ESTE SERVIÇO
 * (`estoque_movimentos.servico_id`), não há duplicidade possível e a pergunta
 * seria ruído. Quem decide é quem tem a nota na mão.
 */
async function pecasJaLancadasDoServico(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  servicoId: string,
): Promise<number> {
  const { data } = await supabase
    .from("estoque_movimentos")
    .select("quantidade, estoque_itens(custo_unitario_centavos)")
    .eq("servico_id", servicoId)
    .eq("tipo", "retirada")
  let total = 0
  for (const m of (data ?? []) as { quantidade: number }[]) {
    // Item sem custo unitário não entra na conta — e é por isso que a conta é
    // um PISO, não um total. Estimar o que falta transformaria a pergunta ao
    // ADM numa afirmação sobre um número que o app não tem.
    //
    // A relação é muitos-para-um e vem como objeto em runtime, mas os tipos
    // gerados do PostgREST descrevem toda relação embutida como lista — as
    // duas formas são aceitas aqui em vez de um `as unknown as` que passaria
    // a mentir se a consulta mudar.
    const rel = (m as { estoque_itens?: unknown }).estoque_itens
    const alvo = Array.isArray(rel) ? rel[0] : rel
    const unitario = (alvo as { custo_unitario_centavos?: number | null } | null | undefined)
      ?.custo_unitario_centavos
    if (unitario != null) total += Math.round(Number(m.quantidade) * unitario)
  }
  return total
}

export async function atualizarServico(formData: FormData) {
  const { supabase, painel, userId } = await contexto()
  const id = String(formData.get("servico_id") ?? "")
  const estado = String(formData.get("estado") ?? "")
  const { data, error } = await supabase.from("servicos_mecanica")
    .update({
      estado,
      conserto: texto(formData, "conserto"),
      horas: num(formData, "horas"),
      conclusao_em: estado === "concluido" ? hojeISO() : null,
    })
    .eq("id", id).select("id, problema_informado")
  if (error || !data?.length) falhar("/mecanica", "Não deu pra atualizar o serviço.")

  // §12, a linha "Mecânica → entrada automática no Financeiro" que faltava: o
  // serviço concluído com valor informado vira custo da unidade, com
  // procedência. Era a única das seis origens que nenhum insert produzia.
  let sufixo = ""
  const valorInformado = centavos(formData, "valor")
  if (estado === "concluido" && valorInformado != null) {
    const pecas = await pecasJaLancadasDoServico(supabase, id)
    // A resposta do ADM ao aviso. Sem peça retirada pra este serviço a
    // pergunta nem aparece na tela, e `jaInclui` chega falso — que é o valor
    // certo: não há o que descontar.
    const jaInclui = formData.get("ja_inclui") === "1"
    const aLancar = valorAlancar(valorInformado, pecas, jaInclui)
    sufixo = aLancar <= 0 && jaInclui
      ? " · nada a lançar: as peças já cobriam o valor informado"
      : sufixoDoLancamento(
        await lancarCustoComOrigem(supabase, {
          embarcacaoId: painel.embarcacao.id,
          origem: "mecanica",
          origemId: id,
          categoria: "manutencao",
          descricao: `Serviço na oficina — ${(data[0].problema_informado as string | null) ?? "conserto"}`,
          valorCentavos: aLancar,
          userId,
        }),
        "valor da oficina",
      )
  }

  revalidatePath("/mecanica")
  revalidatePath("/frota")
  redirect(`/mecanica?ok=${encodeURIComponent(`Serviço atualizado${sufixo}`)}`)
}

/**
 * §7 e §25: "Mecânica NUNCA publica diretamente aos cotistas."
 *
 * AUDITORIA 19/08, B6 — esta action decidia com `painel.papel !== "PROP"`,
 * escrito à mão, enquanto `podePublicarParaCotistas` (domínio, 12 casos de
 * teste, conhece os sete papéis e a régua de confiança) não era chamada por
 * ninguém. A diferença não é de estilo: a policy da migration 063
 * ("quem edita motores atualiza") deixa o próprio mecânico gravar
 * `publicado_em` — a única barreira entre o laudo cru e dez cotistas é esta
 * decisão aqui. Ela tem dono agora.
 *
 * O motivo da recusa vem do domínio junto com a recusa, e não é um texto
 * genérico: o mecânico precisa ler que a trava é do §7 e não um bug, senão
 * ele tenta de novo achando que errou o botão.
 */
export async function publicarServico(formData: FormData) {
  const { supabase, painel, userId } = await contexto()
  const regua = podePublicarParaCotistas(
    painel.papel as Papel,
    await modoAprovacaoDe(supabase, painel.embarcacao.id, painel.papel),
  )
  if (!regua.pode) falhar("/mecanica", regua.motivo ?? "Você não publica laudo para os cotistas.")
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
  //
  // A policy `auditoria: registra em nome proprio, na embarcacao que acessa`
  // também recusa calada, e aí o laudo aparece para dez cotistas sem que exista
  // registro de quem o publicou. Não vira frase na tela — a publicação que a
  // pessoa pediu está conferida acima —, vai pro log do servidor, no mesmo
  // desenho de `registrarLogAdmin`.
  const { data: rastro, error: erroRastro } = await supabase.from("auditoria").insert({
    embarcacao_id: painel.embarcacao.id,
    autor_id: userId,
    evento: "publicou_para_cotistas",
    entidade: "servicos_mecanica",
    entidade_id: id,
    alvo: (data[0].problema_informado as string | null)?.trim() || null,
    antes: { publicado_em: null },
    depois: { publicado_em: publicadoEm },
  }).select("id")
  if (erroRastro || !rastro?.length) {
    console.error("[enterprise] auditoria de publicação não foi gravada:", erroRastro?.message ?? "recusada sem erro", id)
  }

  revalidatePath("/mecanica")
  redirect(`/mecanica?ok=${encodeURIComponent("Publicado para os cotistas")}`)
}

export async function criarOrcamento(formData: FormData) {
  const { supabase, painel, userId } = await contexto()
  const proposto = texto(formData, "servico_proposto")
  if (!proposto) falhar("/mecanica", "Descreva o serviço proposto.")

  // `orcamentos: quem edita motores cria` recusa sem erro. O orçamento é o que
  // vai à votação dos cotistas: dizer "salvo" sobre um que não existe deixa o
  // ADM esperando por uma urna que nunca vai abrir.
  const { data, error } = await supabase.from("orcamentos").insert({
    embarcacao_id: painel.embarcacao.id,
    servico_id: texto(formData, "servico_id"),
    problema: texto(formData, "problema"),
    servico_proposto: proposto,
    fornecedor: texto(formData, "fornecedor"),
    pecas: texto(formData, "pecas"),
    valor_centavos: centavos(formData, "valor"),
    valido_ate: texto(formData, "valido_ate"),
    criado_por: userId,
  }).select("id")
  if (error || !data?.length) {
    falhar("/mecanica", "O orçamento não foi salvo. Tente de novo; se continuar, fale com quem administra a unidade.")
  }

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

  // `votacoes: so o dono abre` (`eh_prop`) pergunta ao banco o que o `if` lá em
  // cima perguntou ao painel — e os dois discordam quando o papel mudou depois
  // da página carregar. Zero linha, `error` nulo, e os cotistas nunca veriam a
  // urna que o app disse ter aberto.
  const { data, error } = await supabase.from("votacoes").insert({
    embarcacao_id: painel.embarcacao.id, orcamento_id: id, aberta_por: userId,
  }).select("id")
  if (error || !data?.length) falhar("/mecanica", "A votação não foi aberta. Atualize a página e tente de novo.")

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
  // AS CINCO TRAVAS DA POLICY VOLTAM COMO ZERO LINHA, NÃO COMO ERRO. `votos:
  // cotista vota uma vez, em nome proprio` recusa quem não é cotista daquela
  // unidade, quem está suspenso e quem chega depois de `encerrada_em` — e nos
  // três o PostgREST devolve `error: null`. O voto sumia e a tela dizia "Voto
  // registrado": numa decisão que se apura por contagem, é o pior lugar
  // possível para uma escrita mentir.
  //
  // A frase não escolhe entre as travas porque a action não sabe qual delas
  // pegou; ela manda a pessoa olhar a votação, que é onde qualquer uma das
  // causas fica visível.
  const { data, error } = await supabase.from("votos").insert({
    votacao_id: String(formData.get("votacao_id") ?? ""),
    votante_id: userId,
    voto: String(formData.get("voto") ?? ""),
  }).select("id")
  if (error?.code === "23505") falhar("/mecanica", "Você já votou neste orçamento.")
  if (error || !data?.length) {
    falhar("/mecanica", "Seu voto não foi registrado. Atualize a página e confira se a votação ainda está aberta.")
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

  // `estoque: o dono cria` compara `dono_id` com `auth.uid()`. Quando o
  // `contexto()` volta com `userId` nulo — sessão que expirou entre carregar a
  // tela e enviar o formulário —, o predicado vira `null = uid`, que é NULL, e
  // o Postgres recusa sem uma palavra de erro.
  const { data, error } = await supabase.from("estoque_itens").insert({
    dono_id: userId,
    nome,
    categoria: String(formData.get("categoria") ?? "outro"),
    unidade: texto(formData, "unidade"),
    quantidade: num(formData, "quantidade") ?? 0,
    minimo: num(formData, "minimo"),
    fornecedor: texto(formData, "fornecedor"),
    custo_unitario_centavos: centavos(formData, "custo_unitario"),
  }).select("id")
  if (error || !data?.length) falhar("/estoque", "O item não foi cadastrado. Atualize a página e tente de novo.")

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
    // Ajuste grava o valor absoluto contado. §22: "ajustes de tanque/estoque
    // exigem motivo QUANDO GERAREM DIVERGÊNCIA" — e a palavra que carrega a
    // regra é "quando". A action exigia motivo em todo ajuste, inclusive no
    // que confirma o saldo (contei 12, tinha 12): pedir justificativa pra
    // "está certo" ensina a equipe a digitar ponto pra passar da tela, e
    // motivo inventado é pior que motivo nenhum. `exigeMotivoDeAjuste` é quem
    // sabe disso, com teste, e não era chamada por lugar nenhum (A7).
    if (exigeMotivoDeAjuste(Number(item.quantidade), qtd) && !texto(formData, "motivo")) {
      falhar("/estoque", "Este ajuste muda o saldo. Registre o motivo da diferença.")
    }
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

  // O SALDO É A ESCRITA QUE NÃO PODE PASSAR BATIDA. A leitura do item algumas
  // linhas acima passa pela policy de SELECT; esta passa por `estoque: o dono
  // corrige`, que exige `dono_id = auth.uid()` — quem enxerga o almoxarifado da
  // base não é necessariamente quem o possui. Com a recusa engolida, a action
  // seguia em frente: gravava o movimento, lançava o custo no Financeiro e
  // anunciava "Estoque atualizado" com a quantidade exatamente onde estava.
  const { data: saldo, error } = await supabase.from("estoque_itens")
    .update({ quantidade: nova }).eq("id", itemId).select("id")
  if (error || !saldo?.length) falhar("/estoque", "O estoque não foi atualizado. Atualize a página e tente de novo.")

  const { data: movimento } = await supabase.from("estoque_movimentos").insert({
    item_id: itemId,
    tipo,
    quantidade: qtd,
    embarcacao_id: destinoRetirada,
    // §12, a armadilha da duplicidade — `servico_id` existe desde a migration
    // 064 e NUNCA era preenchido (auditoria 19/08, A4). Sem ele não há como
    // saber que a peça de R$ 800 que saiu da prateleira é a mesma que a
    // oficina vai cobrar dentro do orçamento de R$ 2.000, e a unidade aparece
    // com R$ 2.800 tendo gasto R$ 2.000. Opcional: retirada de almoxarifado
    // que não é pra serviço nenhum é o caso comum.
    servico_id: tipo === "retirada" ? texto(formData, "servico_id") : null,
    motivo: texto(formData, "motivo"),
    autor_id: userId,
  }).select("id").maybeSingle()

  // §12 — a peça que sai da prateleira vira custo DA UNIDADE que a recebeu,
  // com procedência "estoque". Sem custo unitário cadastrado no item o app
  // não tem como saber quanto ela vale, e não chuta (ver
  // `lancarCustoComOrigem`).
  let sufixo = ""
  // `movimento` vinha de um `.select()` que ninguém lia fora do `&&` abaixo: o
  // saldo mudava, a linha do histórico não entrava e a tela dizia só "Estoque
  // atualizado". O saldo já está conferido e gravado — não dá para desfazer —,
  // então o que resta é contar o que ficou faltando em vez de omitir.
  if (!movimento) sufixo = " · o movimento NÃO entrou no histórico do estoque"
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

  // Mesma armadilha de `criarItemEstoque`: `tanques: o dono cria` pede
  // `dono_id = auth.uid()`, e `dono_id` nulo recusa em silêncio.
  const { data, error } = await supabase.from("tanques").insert({
    dono_id: userId,
    nome,
    combustivel: texto(formData, "combustivel"),
    capacidade_litros: num(formData, "capacidade"),
    saldo_inicial_litros: num(formData, "saldo_inicial") ?? 0,
    minimo_litros: num(formData, "minimo"),
  }).select("id")
  if (error || !data?.length) falhar("/combustivel", "O tanque não foi cadastrado. Atualize a página e tente de novo.")

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

  // §11: "valor total E/OU preço/litro". Quem abastece anota o que a bomba
  // mostrou; o app completa o outro. O TOTAL ganha quando os dois vêm: ele é
  // o que a nota fiscal diz, e o R$/L digitado pode estar arredondado.
  // AUDITORIA 19/08, A10 — `totalCentavosPorLitro` existia e não tinha por
  // onde entrar, porque o formulário não pedia R$/L.
  const totalDigitado = centavos(formData, "valor")
  const porLitro = centavos(formData, "preco_litro")
  const valorCentavos = totalDigitado
    ?? (porLitro == null ? null : totalCentavosPorLitro(porLitro, litros))

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
    valor_centavos: valorCentavos,
    motivo: texto(formData, "motivo"),
    autor_id: userId,
  }).select("id").maybeSingle()
  if (error || !data) falhar("/combustivel", "Não deu pra registrar o movimento.")

  // §11: "abastecimento pelo tanque baixa saldo E registra automaticamente
  // no Jet". A saída com destino de frota vira abastecimento da unidade.
  let sufixo = ""
  if (tipo === "saida" && destinoUnidade) {
    // AUDITORIA 19/08, A5 — este insert existia e NENHUMA tela lia a tabela.
    // Agora /combustivel monta com ele o consumo por unidade do §11, e é por
    // isso que o `.select()` passou a valer aqui: um abastecimento barrado
    // pela policy sumia em silêncio e a unidade aparecia bebendo menos do que
    // bebe. Falha não derruba o movimento do tanque (esse é fato do
    // almoxarifado e já está gravado) — ela vira aviso na frase de sucesso.
    const { data: abastecimento } = await supabase.from("abastecimentos").insert({
      embarcacao_id: destinoUnidade,
      tanque_movimento_id: data.id,
      litros,
      valor_centavos: valorCentavos,
      responsavel_id: userId,
    }).select("id").maybeSingle()
    // Sem diagnóstico: `abastecimento` vazio tanto pode ser a policy recusando
    // quanto erro do banco, e a frase precisa valer para os dois. O que a
    // pessoa precisa saber é que o consumo ficou de fora e onde lançá-lo.
    if (!abastecimento) sufixo += " · o consumo desta unidade NÃO registrou; lance à mão em Combustível"

    // §12 — e o abastecimento vira custo da unidade, com procedência
    // "combustivel". Sem valor informado não há lançamento: o litro do tanque
    // próprio custou o que a empresa pagou na compra, e essa conta o app não
    // tem.
    sufixo += sufixoDoLancamento(
      await lancarCustoComOrigem(supabase, {
        embarcacaoId: destinoUnidade,
        origem: "combustivel",
        origemId: data.id,
        categoria: "combustivel",
        descricao: `Abastecimento pelo tanque da base — ${litros.toLocaleString("pt-BR")} L`,
        valorCentavos,
        userId,
      }),
      "valor nem preço por litro",
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

  // `envios: cotista envia em nome proprio` cobra `cotista_id = auth.uid()` E um
  // vínculo COTISTA ativo naquela unidade. Um cotista suspenso continua com a
  // tela de /atualizacoes aberta no navegador: ele escrevia, o banco recusava
  // sem erro, e a mensagem para a administradora simplesmente não existia — do
  // lado dele, "enviado".
  const { data, error } = await supabase.from("envios_cotista").insert({
    embarcacao_id: painel.embarcacao.id,
    cotista_id: userId,
    tipo: String(formData.get("tipo") ?? "observacao"),
    texto: texto_,
    horas: num(formData, "horas"),
    combustivel_pct: num(formData, "combustivel_pct"),
  }).select("id")
  if (error || !data?.length) {
    falhar("/atualizacoes", "A mensagem não foi enviada. Atualize a página e tente de novo.")
  }

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

  const embarcacaoId = formData.get("da_unidade") === "on" ? painel.embarcacao.id : null

  // AUDITORIA 19/08, A16 — O CAMPO QUE A POLICY VALIDAVA E NINGUÉM ENVIAVA.
  //
  // A consulta de vínculos só sai quando alguém foi escolhido: no caso comum
  // (tarefa sem responsável) ela seria uma ida ao banco pra confirmar nada.
  // E ela é NECESSÁRIA — sem a lista, a recusa da policy voltaria como o
  // "Não deu pra criar a tarefa" genérico, que é a mentira que a onda 63
  // ensinou a não repetir: erro que não diz o que houve faz a pessoa tentar
  // de novo pra sempre.
  const responsavelId = texto(formData, "responsavel_id")
  let vinculadosAtivos: string[] = []
  if (responsavelId !== null && embarcacaoId !== null) {
    const { data: equipe } = await supabase.from("vinculos").select("usuario_id")
      .eq("embarcacao_id", embarcacaoId).is("suspenso_em", null)
    vinculadosAtivos = ((equipe ?? []) as { usuario_id: string }[]).map((v) => v.usuario_id)
  }
  const recusa = recusaDoResponsavel({
    responsavelId,
    donoId: userId ?? "",
    embarcacaoId,
    vinculadosAtivos,
  })
  if (recusa) falhar("/afazeres", recusa)

  const { data, error } = await supabase.from("afazeres").insert({
    dono_id: userId,
    embarcacao_id: embarcacaoId,
    titulo,
    detalhe: texto(formData, "detalhe"),
    destino: String(formData.get("destino") ?? "qualquer"),
    responsavel_id: responsavelId,
    prazo: texto(formData, "prazo"),
    criado_por: userId,
  }).select("id")
  if (error || !data?.length) falhar("/afazeres", "Não deu pra criar a tarefa.")

  revalidatePath("/afazeres")
  redirect(`/afazeres?ok=${encodeURIComponent("Tarefa criada")}`)
}

/**
 * PASSAR A TAREFA PARA OUTRA PESSOA (AUDITORIA 19/08, A16 — a segunda metade).
 *
 * `criarAfazer` passou a mandar `responsavel_id`, mas só na CRIAÇÃO — e tarefa
 * só se resolve na criação em app de demonstração. A vida real é a outra: a
 * tarefa nasce "para Operações", o Marcos entra de férias, e alguém precisa
 * passá-la adiante. Sem esta action a única saída era concluir a tarefa que
 * ninguém fez e abrir outra igual, o que apaga o histórico do que foi
 * combinado.
 *
 * A VALIDAÇÃO É NOSSA, E ISSO NÃO É DESCONFIANÇA DO BANCO — É LEITURA DELE. A
 * policy de INSERT (migration 069) confere que o responsável tem vínculo não
 * suspenso na unidade; a de UPDATE, no MESMO arquivo, confere só
 * `dono_id = uid OR responsavel_id = uid` e não olha o novo responsável. Ou
 * seja: pelo caminho do UPDATE dá para carimbar a tarefa em cima de qualquer
 * uuid do sistema, que é exatamente a brecha 1 que a 069 fechou no INSERT.
 * `recusaDoResponsavel` é a mesma régua do domínio aplicada aqui antes de a
 * escrita sair.
 *
 * O `.select("id")` NÃO É DECORAÇÃO NESTE GESTO ESPECÍFICO. O `with check` da
 * policy de UPDATE é avaliado sobre a linha NOVA: quem está com a tarefa mas
 * não a criou e a passa para um terceiro deixa de casar com o predicado no
 * mesmo instante em que grava — o Postgres recusa, o PostgREST devolve zero
 * linha e `error` vem `null`. Sem conferir o retorno, a tela diria "passei"
 * para uma tarefa que continua onde estava. É a lição da onda 63 no caso mais
 * traiçoeiro dela.
 */
export async function atribuirAfazer(formData: FormData) {
  const { supabase } = await contexto()
  const id = String(formData.get("afazer_id") ?? "")
  // Campo vazio é `null` e continua sendo uma resposta legítima: o §20 admite
  // tarefa sem dono, e "Ninguém" é o jeito de DESFAZER uma atribuição. O que
  // esta action nunca faz é inventar um responsável por não ter recebido um.
  const responsavelId = texto(formData, "responsavel_id")

  const { data: atual } = await supabase.from("afazeres")
    .select("dono_id, embarcacao_id, responsavel_id").eq("id", id).maybeSingle()
  if (!atual) falhar("/afazeres", "Tarefa não encontrada.")

  // Nada a fazer quando a escolha é a que já está gravada. Sem este atalho, a
  // tarefa de alguém que foi SUSPENSO depois de recebê-la seria recusada por
  // "essa pessoa não tem acesso ativo" ao ser reenviada sem mudança nenhuma —
  // uma recusa correta na regra e absurda na tela.
  if (responsavelId === ((atual.responsavel_id as string | null) ?? null)) {
    redirect(`/afazeres?ok=${encodeURIComponent("Nada mudou — a tarefa já estava assim")}`)
  }

  const embarcacaoId = (atual.embarcacao_id as string | null) ?? null
  let vinculadosAtivos: string[] = []
  if (responsavelId !== null && embarcacaoId !== null) {
    const { data: equipe } = await supabase.from("vinculos").select("usuario_id")
      .eq("embarcacao_id", embarcacaoId).is("suspenso_em", null)
    vinculadosAtivos = ((equipe ?? []) as { usuario_id: string }[]).map((v) => v.usuario_id)
  }
  const recusa = recusaDoResponsavel({
    responsavelId,
    donoId: (atual.dono_id as string | null) ?? "",
    embarcacaoId,
    vinculadosAtivos,
  })
  if (recusa) falhar("/afazeres", recusa)

  const { data, error } = await supabase.from("afazeres")
    .update({ responsavel_id: responsavelId })
    .eq("id", id).select("id")
  if (error || !data?.length) {
    // A frase diz a regra em vez de "não deu": quem está com a tarefa nas mãos
    // sem tê-la criado consegue tocá-la, mas não repassá-la — e sem esta
    // explicação a pessoa tentaria de novo para sempre.
    falhar("/afazeres", "Não deu pra passar a tarefa. Quem repassa é quem abriu a tarefa; peça a essa pessoa.")
  }

  revalidatePath("/afazeres")
  redirect(`/afazeres?ok=${encodeURIComponent(
    responsavelId === null ? "Tarefa ficou sem responsável" : "Tarefa passada adiante",
  )}`)
}

export async function mudarEstadoAfazer(formData: FormData) {
  const { supabase } = await contexto()
  const id = String(formData.get("afazer_id") ?? "")
  // §27.2, a regra nos dois lados: o estado vinha do formulário e ia cru pro
  // update. `ESTADOS_AFAZER` é o enum do domínio (e o `check` da migration
  // 066) e não era conferido em lugar nenhum do app — um valor forjado
  // dependia do banco recusar, e a tela mostraria "Não deu pra mudar" sem
  // ninguém entender o quê.
  const bruto = String(formData.get("estado") ?? "")
  if (!(ESTADOS_AFAZER as readonly string[]).includes(bruto)) {
    falhar("/afazeres", "Estado de tarefa desconhecido.")
  }
  const estado = bruto as EstadoAfazer
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
  // A16, O SEGUNDO INSERT DO ACHADO — E ELE CONTINUA SEM `responsavel_id` DE
  // PROPÓSITO. Este gesto acontece longe de /afazeres (na avaria, na
  // manutenção), onde não há lista de equipe na tela nem pergunta a fazer: o
  // que se decide ali é que aquilo VIRA tarefa, não de quem ela é. Escolher um
  // responsável aqui seria inventar um — a tarefa nasce sem dono, aparece na
  // lista, e `atribuirAfazer` é por onde alguém a assume.
  const { data, error } = await supabase.from("afazeres").insert({
    dono_id: userId,
    embarcacao_id: painel.embarcacao.id,
    titulo: novo.titulo,
    destino: novo.destino,
    origem_tipo: tipo,
    origem_id: origemId || null,
    criado_por: userId,
  }).select("id")
  // A conversão passava com `error` nulo e zero linha quando a policy da 069
  // recusava: a tela dizia "Convertido em tarefa" e /afazeres abria sem ela.
  //
  // A FRASE NÃO NOMEIA MAIS O DIÁRIO. `afazeres: o dono cria` tem três
  // condições, e a falta de `diario:editar` é só uma delas — `dono_id =
  // auth.uid()` recusa igual quando a sessão expirou entre abrir a avaria e
  // clicar, e este `if` ainda cobre erro de banco. Mandar conferir o acesso ao
  // Diário em qualquer um dos outros casos é despachar a pessoa para o lugar
  // errado com ar de certeza.
  if (error || !data?.length) {
    falhar("/afazeres", "Não deu pra converter em tarefa — nada foi criado. Atualize a página e tente de novo.")
  }

  revalidatePath("/afazeres")
  redirect(`/afazeres?ok=${encodeURIComponent("Convertido em tarefa")}`)
}
