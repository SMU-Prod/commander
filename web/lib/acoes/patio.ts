"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { subirArquivo } from "@/lib/acervo"
import { carregarPainel } from "@/lib/consultas"
import { parseDecimalPtBr } from "@/lib/domain/numeros"
import {
  ehPapelEnterprise, type ModoAprovacao, type Papel,
} from "@/lib/domain/enterprise"
import {
  movimentoNasceAprovado, podeDecidirMovimentoPatio, retornoViraAvaria,
} from "@/lib/domain/patio"
import { supabaseServer } from "@/lib/supabase/server"

/**
 * CHECK-OUT E CHECK-IN (onda 70b, PRD-UPGRADE-3-COTAS §6).
 *
 * A régua que o §6 impõe às duas actions: *"home de campo rápida, botões
 * grandes e poucos passos"*. Quase nada é obrigatório — quem está com o Jet
 * na rampa anota o que dá, e o domínio (`lib/domain/patio.ts`) devolve `null`
 * no que faltar em vez de inventar número.
 */

function erro(msg: string): never {
  redirect(`/patio?erro=${encodeURIComponent(msg)}`)
}

/** Número opcional em pt-BR. Vazio é `null` legítimo; texto que não é número
 *  é erro, porque gravar `null` calado esconderia a digitação errada. */
function numeroOpcional(formData: FormData, chave: string, rotulo: string): number | null {
  const bruto = String(formData.get(chave) ?? "").trim()
  if (!bruto) return null
  const n = parseDecimalPtBr(bruto)
  if (n === null || n < 0) erro(`Informe ${rotulo} com números.`)
  return n
}

function percentualOpcional(formData: FormData, chave: string): number | null {
  const n = numeroOpcional(formData, chave, "o combustível")
  if (n === null) return null
  if (n > 100) erro("O combustível vai de 0 a 100%.")
  return Math.round(n)
}

const texto = (formData: FormData, k: string) => String(formData.get(k) ?? "").trim() || null

/**
 * A FOTO DO CHECK-OUT E DO CHECK-IN (AUDITORIA 19/08, A6).
 *
 * `saida_foto_path` e `retorno_foto_path` existiam desde a migration 060 e
 * nenhuma escrita as tocava. É o registro que protege os dois lados numa
 * discussão sobre avaria: sem a foto de como o casco saiu, "já estava assim"
 * e "voltou assim" são a palavra de um contra a do outro — e numa marina
 * essa conversa acontece toda semana.
 *
 * NÃO É UM SEGUNDO JEITO DE SUBIR ARQUIVO. Reusa `subirArquivo` (`lib/acervo`)
 * e o bucket `acervo`, os mesmos do álbum da embarcação e do anexo de
 * ocorrência.
 *
 * A PASTA É "ocorrencias", E ISSO É ESCOLHA, NÃO DESCUIDO. A policy de storage
 * dá tratamento especial a duas pastas: "documentos" e "fotos" exigem
 * `permissao(embarcacao, 'fotos'|'documentos', 'editar')`; o resto exige só
 * `pode_ver_embarcacao`. Quem registra movimentação de pátio tem
 * `diario:editar` (é a permissão que a policy de `movimentos_patio` cobra) e
 * pode não ter Fotos liberado — subir em "fotos" barraria justamente o
 * funcionário do pátio, que é quem tira a foto. "ocorrencias" também é onde
 * mora a avaria que o retorno abre, então o arquivo fica ao lado do que ele
 * documenta.
 *
 * `null` sem arquivo: o §6 manda a home de campo ser rápida, e nada aqui é
 * obrigatório além do gesto.
 */
async function fotoDoMovimento(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  embarcacaoId: string,
  formData: FormData,
  campo: string,
): Promise<string | null> {
  const arquivo = formData.get(campo)
  if (!(arquivo instanceof File) || arquivo.size === 0) return null
  if (!["image/jpeg", "image/png", "image/webp"].includes(arquivo.type)) {
    erro("A foto precisa ser JPG, PNG ou WebP.")
  }
  const r = await subirArquivo(supabase, embarcacaoId, "ocorrencias", arquivo)
  if ("erro" in r) erro(r.erro)
  return r.path
}

/**
 * A RÉGUA DE CONFIANÇA DESTA PESSOA, NESTA UNIDADE (§3) — AUDITORIA 19/08, A6.
 *
 * Devolve se o movimento entra valendo ou nasce esperando o ADM. Quem responde
 * é o domínio; aqui só se busca o dado.
 *
 * A CONSULTA SÓ ACONTECE PARA QUEM ESTÁ SOB A RÉGUA. PROP e CMDT são o
 * Commander individual e não têm modo de aprovação nenhum — cobrar deles uma
 * ida ao banco a cada check-out seria pagar por uma pergunta cuja resposta já
 * se sabe (ver `movimentoNasceAprovado`).
 *
 * FILTRA POR `usuario_id`, e isso não é detalhe: a régua é POR PESSOA ("o mesmo
 * perfil pode ter réguas diferentes — funcionário novo exige conferência 1 a
 * 1", `lib/db/types.ts`). Buscar só por `papel` traria o vínculo de qualquer
 * colega com o mesmo cargo e aplicaria a régua do outro.
 *
 * Sem vínculo legível, o padrão é `tudo` — a régua mais apertada. Quem não
 * consegue provar em que nível de confiança está não estreia no mais solto:
 * falhar fechado deixa um registro a mais na fila do ADM, falhar aberto deixa
 * a conferência que ele ligou não acontecer e ninguém descobrir.
 */
async function nasceAprovado(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  embarcacaoId: string,
  userId: string | null,
  papel: Papel,
  acao: "check_out" | "check_in",
): Promise<boolean> {
  if (!ehPapelEnterprise(papel)) return true
  // Sem usuário não há régua a consultar — e `usuario_id = ''` não é uuid,
  // então a consulta voltaria com erro de sintaxe do Postgres em vez de com
  // "não achei". Falha fechada, sem ida ao banco.
  if (!userId) return movimentoNasceAprovado({ papel, modo: "tudo", acao })

  const { data } = await supabase.from("vinculos").select("modo_aprovacao")
    .eq("embarcacao_id", embarcacaoId).eq("usuario_id", userId).maybeSingle()
  const modo = (data?.modo_aprovacao as ModoAprovacao | null) ?? "tudo"
  return movimentoNasceAprovado({ papel, modo, acao })
}

/** O que a frase de sucesso ganha quando o registro fica esperando alguém.
 *  Sem isto a tela diria "Saída registrada" e a pessoa iria embora achando que
 *  fechou o assunto — e o §6 inteiro é sobre não fazer ninguém voltar. */
const AVISO_PENDENTE = " — aguardando conferência do ADM"

export async function registrarSaida(formData: FormData) {
  const supabase = await supabaseServer()
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const { data: { user } } = await supabase.auth.getUser()

  // Os números vêm ANTES do upload: `numeroOpcional` pode redirecionar com
  // "informe as horas com números", e subir o arquivo primeiro deixaria um
  // objeto órfão no bucket toda vez que alguém digitasse errado.
  const saidaHoras = numeroOpcional(formData, "saida_horas", "as horas")
  const saidaCombustivel = percentualOpcional(formData, "saida_combustivel_pct")
  const fotoPath = await fotoDoMovimento(supabase, painel.embarcacao.id, formData, "saida_foto")

  // A6 — a coluna que a migration 060 esperava e ninguém escrevia. O `default
  // true` do banco só serve pra quem NÃO está sob régua; escrever o valor
  // sempre deixa a decisão explícita na linha, em vez de depender de um padrão
  // que muda de significado conforme quem registrou.
  const aprovado = await nasceAprovado(
    supabase, painel.embarcacao.id, user?.id ?? null, painel.papel as Papel, "check_out",
  )

  const { data, error } = await supabase.from("movimentos_patio").insert({
    embarcacao_id: painel.embarcacao.id,
    responsavel_id: user?.id ?? null,
    saida_horas: saidaHoras,
    saida_combustivel_pct: saidaCombustivel,
    saida_estado: texto(formData, "saida_estado"),
    saida_foto_path: fotoPath,
    aprovado,
  }).select("id")

  // O índice único parcial (migration 060) impede duas saídas abertas na
  // mesma unidade. Quando ele dispara, a mensagem tem que explicar o que
  // aconteceu — "erro ao salvar" faria a pessoa tentar de novo pra sempre.
  if (error || !data?.length) {
    // Linha recusada é foto sem dono: sem esta limpeza o bucket junta um
    // arquivo por tentativa barrada, e ninguém nunca vai olhar pra ele. Mesmo
    // cuidado de `lib/acoes/fotos.ts`.
    if (fotoPath) await supabase.storage.from("acervo").remove([fotoPath])
    erro(
      error?.code === "23505"
        ? "Esta unidade já está fora. Registre o retorno antes de uma nova saída."
        : "Não deu pra registrar a saída. Se você não tem acesso ao Diário deste barco, fale com o proprietário.",
    )
  }

  revalidatePath("/patio")
  redirect(`/patio?ok=${encodeURIComponent(`Saída registrada${aprovado ? "" : AVISO_PENDENTE}`)}`)
}

export async function registrarRetorno(formData: FormData) {
  const supabase = await supabaseServer()
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const { data: { user } } = await supabase.auth.getUser()

  const id = String(formData.get("movimento_id") ?? "")
  if (!id) erro("Não encontramos essa saída. Atualize a página.")

  const retornoHoras = numeroOpcional(formData, "retorno_horas", "as horas")
  const retornoCombustivel = percentualOpcional(formData, "retorno_combustivel_pct")
  const estado = texto(formData, "retorno_estado")

  // §6: "Se houver problema no retorno, permitir transformar imediatamente
  // em avaria." Quem decide é a MARCAÇÃO da pessoa, nunca uma dedução do
  // app — ver `retornoViraAvaria`, com teste.
  const houveProblema = formData.get("houve_problema") === "on"
  const avaria = retornoViraAvaria(houveProblema, estado)

  // A6 — a foto sobe antes da ocorrência e antes do update, pelo mesmo motivo
  // da saída: se ela for recusada, nada mais aconteceu ainda.
  const fotoPath = await fotoDoMovimento(supabase, painel.embarcacao.id, formData, "retorno_foto")

  let ocorrenciaId: string | null = null
  if (avaria) {
    const { data: criada } = await supabase.from("ocorrencias").insert({
      embarcacao_id: painel.embarcacao.id,
      aba: "motores",
      titulo: avaria.titulo,
      descricao: avaria.descricao,
      estado: "aberta",
      criado_por: user?.id ?? null,
    }).select("id").maybeSingle()
    ocorrenciaId = criada?.id ?? null
  }

  const { data, error } = await supabase
    .from("movimentos_patio")
    .update({
      retorno_em: new Date().toISOString(),
      retorno_horas: retornoHoras,
      retorno_combustivel_pct: retornoCombustivel,
      retorno_estado: estado,
      retorno_foto_path: fotoPath,
      retorno_responsavel_id: user?.id ?? null,
      ocorrencia_id: ocorrenciaId,
    })
    .eq("id", id)
    // `is null` no retorno: sem isso, dois toques no botão de check-in
    // sobrescreveriam o retorno já gravado com um horário novo.
    .is("retorno_em", null)
    .select("id")

  // A constraint do banco recusa horímetro andando pra trás. É a única
  // validação que precisa virar frase: as outras são opcionais.
  if (error || !data?.length) {
    if (fotoPath) await supabase.storage.from("acervo").remove([fotoPath])
    erro(
      error?.code === "23514"
        ? "As horas do retorno não podem ser menores que as da saída. Confira o horímetro."
        : "Não deu pra registrar o retorno. Atualize a página e tente de novo.",
    )
  }

  // A6 — O CHECK-IN TAMBÉM ESTÁ NA RÉGUA, e ele é um caso próprio.
  //
  // A linha é uma só (saída e retorno moram juntos, migration 060), então não
  // há uma segunda coluna `aprovado` pro retorno. A pergunta que sobra é: e
  // quando a régua de quem DEVOLVE exige conferência e a saída entrou direto?
  // Acontece de verdade — quem tira pode não ser quem devolve, e o ADM pode ter
  // apertado a régua no meio do dia.
  //
  // A resposta é a única que não destrói informação: o retorno pode marcar a
  // linha como pendente, MAS NUNCA por cima de uma decisão já tomada. Por isso
  // o `is("aprovado_em", null).is("aprovado_por", null)` — uma linha que o ADM
  // já conferiu não volta pra fila porque alguém a devolveu. Não pegar linha
  // aqui não é erro: é a decisão anterior sendo respeitada.
  let pendenteAgora = false
  const aprovadoNoRetorno = await nasceAprovado(
    supabase, painel.embarcacao.id, user?.id ?? null, painel.papel as Papel, "check_in",
  )
  if (!aprovadoNoRetorno) {
    const { data: marcado } = await supabase.from("movimentos_patio")
      .update({ aprovado: false })
      .eq("id", id).eq("embarcacao_id", painel.embarcacao.id)
      .is("aprovado_em", null).is("aprovado_por", null)
      .select("id")
    pendenteAgora = Boolean(marcado?.length)
  }

  revalidatePath("/patio")
  revalidatePath("/barco/ocorrencias")
  // A frase segue a OCORRÊNCIA QUE EXISTE, não a intenção de abrir uma. O
  // insert lá em cima traz `criada` e ninguém conferia: `ocorrencias: criar
  // pela matriz` pede `motores:editar`, que é outra permissão que a do
  // movimento de pátio — quem faz check-in sem ela marcava "houve problema", o
  // banco recusava sem erro e a tela anunciava uma avaria aberta que não
  // existia em lugar nenhum. Nesse caso o retorno continua válido (ele é fato
  // do pátio e já foi conferido); o que muda é a pessoa ficar sabendo que a
  // avaria precisa ser registrada à mão.
  const base = ocorrenciaId
    ? "Retorno registrado e ocorrência aberta"
    : avaria
      ? "Retorno registrado, mas a ocorrência NÃO abriu — registre a avaria em Ocorrências"
      : "Retorno registrado"
  redirect(`/patio?ok=${encodeURIComponent(`${base}${pendenteAgora ? AVISO_PENDENTE : ""}`)}`)
}

/**
 * §3 E §22 — O ADM CONFERE, E A CONFERÊNCIA FICA COM NOME E HORA.
 *
 * AUDITORIA 19/08, A6: as três colunas de aprovação eram lidas por ninguém e
 * escritas por ninguém. Esta é a escrita que faltava — e ela é o único jeito
 * de "Tudo exige aprovação" na ficha do funcionário significar alguma coisa.
 *
 * RECUSAR NÃO APAGA NADA, e isso é decisão da migration 060, que deixou a
 * tabela SEM policy de delete de propósito: *"movimento errado se corrige pelo
 * retorno e pela avaria, não apagando a passagem da unidade pelo pátio"*. Uma
 * recusa é um carimbo em cima do registro — "isto aqui não confere" — e o
 * registro continua lá, que é o que serve numa conversa sobre avaria.
 *
 * O FILTRO É A IDEMPOTÊNCIA: só decide o que está pendente de verdade
 * (`aprovado = false` E sem carimbo). Sem ele, dois toques no botão reescreviam
 * a hora da conferência, e a hora é justamente o que dá valor ao registro —
 * mesma trava do `is("encerrada_em", null)` em `encerrarVotacao`.
 */
export async function decidirMovimentoPatio(formData: FormData) {
  const supabase = await supabaseServer()
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const { data: { user } } = await supabase.auth.getUser()

  // A policy de UPDATE da tabela cobra `diario:editar` e nada mais — ela NÃO
  // distingue quem confere de quem registra (ver `podeDecidirMovimentoPatio`).
  // Enquanto for assim, esta linha é a barreira inteira.
  if (!podeDecidirMovimentoPatio(painel.papel as Papel)) {
    erro("Quem confere movimentação de pátio é a administradora.")
  }

  const id = String(formData.get("movimento_id") ?? "")
  if (!id) erro("Não encontramos esse movimento. Atualize a página.")
  const bruto = String(formData.get("decisao") ?? "")
  if (bruto !== "aprovar" && bruto !== "recusar") erro("Decisão desconhecida.")
  const aprovar = bruto === "aprovar"

  const agora = new Date().toISOString()
  const { data, error } = await supabase.from("movimentos_patio")
    .update({ aprovado: aprovar, aprovado_por: user?.id ?? null, aprovado_em: agora })
    .eq("id", id).eq("embarcacao_id", painel.embarcacao.id)
    .eq("aprovado", false).is("aprovado_em", null)
    .select("id")
  // `.select()` + conferência da linha: escrita barrada por RLS volta com
  // `error: null`, e sem isto a tela anunciaria "conferido" sobre um registro
  // que continua pendente. É a lição que o pátio já pagou uma vez.
  if (error || !data?.length) {
    erro("Não deu pra registrar a decisão. Talvez este movimento já tenha sido conferido — atualize a página.")
  }

  // §22: "quem aprovou e quando" é linha de auditoria, não só coluna na
  // tabela de origem. O carimbo na própria linha responde "como está agora"; a
  // trilha responde "o que aconteceu" — e é a segunda que sobrevive quando o
  // movimento for conferido, recusado e reaberto meses depois.
  //
  // A trilha também pode ser recusada calada (`auditoria: registra em nome
  // proprio, na embarcacao que acessa`), e aí o pior acontece em silêncio: o
  // carimbo fica na linha e a história não fica em lugar nenhum, justamente na
  // conversa sobre avaria em que ela seria aberta. Não vira frase na tela
  // porque a decisão que a pessoa pediu foi tomada e conferida acima — vai pro
  // log do servidor, como `registrarLogAdmin` faz com o log de admin.
  const { data: rastro, error: erroRastro } = await supabase.from("auditoria").insert({
    embarcacao_id: painel.embarcacao.id,
    autor_id: user?.id ?? null,
    evento: aprovar ? "aprovou" : "recusou",
    entidade: "movimentos_patio",
    entidade_id: id,
    alvo: "Movimentação de pátio",
    antes: { aprovado: false, aprovado_em: null },
    depois: { aprovado: aprovar, aprovado_em: agora },
  }).select("id")
  if (erroRastro || !rastro?.length) {
    console.error("[patio] auditoria da decisão não foi gravada:", erroRastro?.message ?? "recusada sem erro", id)
  }

  revalidatePath("/patio")
  redirect(`/patio?ok=${encodeURIComponent(aprovar ? "Movimentação conferida" : "Movimentação recusada")}`)
}
