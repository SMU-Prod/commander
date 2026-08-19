"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { carregarMapaTaxonomia, tituloDeDemanda } from "@/lib/consultas-marketplace"
import { corpoValido, motivoCorpoInvalido, podeConversar } from "@/lib/domain/mensagens"
import { supabaseServer } from "@/lib/supabase/server"
import type { Demanda, Proposta } from "@/lib/db/types"

/**
 * Ações da conversa entre as duas partes (migration 090).
 *
 * Toda regra vive em `lib/domain/mensagens.ts` — aqui só se lê formulário,
 * valida o mínimo e grava.
 *
 * TODA ESCRITA USA `.select()` E CHECA SE VOLTOU LINHA. Não é formalidade: a
 * RLS que barra devolve `error: null` com ZERO linhas, e num chat isso é o
 * pior defeito possível — a tela diria "enviado", a mensagem sumiria, e a
 * pessoa passaria o dia achando que o outro lado a está ignorando. É a regra
 * da casa (docs/CONTRIBUTING.md) e aqui ela é a diferença entre um registro e
 * uma promessa vazia.
 */

type Supabase = Awaited<ReturnType<typeof supabaseServer>>

function erro(rota: string, msg: string): never {
  redirect(`${rota}${rota.includes("?") ? "&" : "?"}erro=${encodeURIComponent(msg)}`)
}

async function usuarioLogado(supabase: Supabase): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  return user.id
}

// ---------------------------------------------------------------------------
// Abrir a conversa — o gesto que nasce na ficha do pedido
// ---------------------------------------------------------------------------
/**
 * Cria a conversa de uma proposta e leva para ela. Os dois lados podem chamar.
 *
 * OS QUATRO IDs DO FORMULÁRIO NÃO SÃO CONFIÁVEIS, e este código não confia
 * neles: `dono_id`, `parceiro_id` e `assunto` são relidos do banco a partir do
 * único par que importa (`demanda_id`, `proposta_id`) antes de gravar. Um
 * formulário adulterado que trocasse `parceiro_id` por um estranho seria
 * recusado três vezes — aqui, pela releitura; na policy, por
 * `conversa_par_valido()`; e ainda pelo `auth.uid() in (dono_id, parceiro_id)`.
 * A trava do banco é a que vale; esta existe para a mensagem sair em português.
 */
export async function abrirConversa(formData: FormData) {
  const supabase = await supabaseServer()
  const userId = await usuarioLogado(supabase)

  const demandaId = String(formData.get("demanda_id") ?? "")
  const propostaId = String(formData.get("proposta_id") ?? "")
  const volta = String(formData.get("volta") ?? `/marketplace/${demandaId}`)

  // Já existe? Dois toques no botão, ou o outro lado tendo aberto primeiro.
  // Perguntar antes é o que transforma a corrida numa navegação em vez de num
  // erro — e a unique `conversas_uma_por_proposta` cobre o instante entre esta
  // leitura e o insert (ver o `catch` do resultado, abaixo).
  const { data: existente } = await supabase
    .from("conversas").select("id").eq("proposta_id", propostaId).maybeSingle()
  if (existente?.id) redirect(`/mensagens/${existente.id}`)

  const [{ data: demandaBruta }, { data: propostaBruta }] = await Promise.all([
    supabase.from("demandas").select("*").eq("id", demandaId).maybeSingle(),
    supabase.from("propostas").select("*").eq("id", propostaId).maybeSingle(),
  ])
  const demanda = demandaBruta as Demanda | null
  const proposta = propostaBruta as Proposta | null
  if (!demanda || !proposta || proposta.demanda_id !== demanda.id) {
    erro(volta, "Não encontrei esse pedido ou essa resposta. Recarregue a página.")
  }

  if (!podeConversar({
    usuarioId: userId,
    donoId: demanda.autor_id,
    parceiroId: proposta.autor_id,
    statusProposta: proposta.status,
  })) {
    erro(volta, "Só quem publicou o pedido e quem respondeu a ele podem conversar aqui.")
  }

  // O assunto é o título gerado pelo Commander (§11.2) congelado no instante
  // do nascimento. Ver a migration 090: sem a cópia, o cabeçalho da conversa
  // ficaria vazio para quem RESPONDEU assim que o pedido vencesse.
  const mapa = await carregarMapaTaxonomia()

  const { data: criada, error } = await supabase.from("conversas").insert({
    demanda_id: demanda.id,
    proposta_id: proposta.id,
    dono_id: demanda.autor_id,
    parceiro_id: proposta.autor_id,
    assunto: tituloDeDemanda(mapa, demanda),
    // Os nomes autodeclarados que `demandas` e `propostas` já guardam
    // (migrations 038/046) — `profiles` tem RLS que impede qualquer JOIN.
    dono_nome: demanda.autor_nome?.trim() || "Comandante",
    parceiro_nome: proposta.autor_nome?.trim() || "Parceiro",
  }).select("id").maybeSingle()

  if (error || !criada) {
    // A unique pode ter batido porque o outro lado abriu no mesmo instante —
    // e nesse caso o certo é entrar na conversa dele, não pedir para tentar de
    // novo. Só depois de olhar é que a falha vira mensagem de erro.
    const { data: agora } = await supabase
      .from("conversas").select("id").eq("proposta_id", propostaId).maybeSingle()
    if (agora?.id) redirect(`/mensagens/${agora.id}`)
    erro(volta, "Não foi possível abrir a conversa agora. Tente de novo.")
  }

  revalidatePath(volta)
  revalidatePath("/mensagens")
  redirect(`/mensagens/${criada.id}`)
}

// ---------------------------------------------------------------------------
// Enviar
// ---------------------------------------------------------------------------
/**
 * Grava uma mensagem na conversa.
 *
 * SEM `?ok=` NO FIM, e é decisão de produto: num chat a confirmação de que
 * deu certo é a própria mensagem aparecendo na thread. Um toast verde
 * "Enviado" por cima disso repetiria a informação e cobriria a tela justamente
 * onde ela é lida.
 *
 * O `redirect` para a MESMA rota existe por um motivo mecânico: é ele que
 * remonta o formulário e limpa o campo. Uma action que só revalida devolve a
 * página nova com o texto ainda digitado dentro — e o segundo toque manda a
 * mesma frase duas vezes.
 */
export async function enviarMensagem(formData: FormData) {
  const supabase = await supabaseServer()
  const userId = await usuarioLogado(supabase)

  const conversaId = String(formData.get("conversa_id") ?? "")
  const rota = `/mensagens/${conversaId}`

  const bruto = String(formData.get("corpo") ?? "")
  const corpo = corpoValido(bruto)
  if (corpo == null) erro(rota, motivoCorpoInvalido(bruto))

  const { data: salvo, error } = await supabase.from("mensagens").insert({
    conversa_id: conversaId,
    autor_id: userId,
    corpo,
  }).select("id")

  // Zero linhas sem erro é a RLS recusando (não sou parte desta conversa, ou
  // ela não existe). A frase cobre os dois sem dizer qual — revelar que a
  // conversa existe já seria informação a mais para quem não participa dela.
  if (error || !salvo?.length) {
    erro(rota, "Não foi possível enviar. Recarregue a página e tente de novo.")
  }

  revalidatePath(rota)
  revalidatePath("/mensagens")
  redirect(rota)
}

// ---------------------------------------------------------------------------
// Apagar a própria
// ---------------------------------------------------------------------------
/**
 * Apaga a PRÓPRIA mensagem, deixando a marca de que ela existiu.
 *
 * O update manda só `apagada_em`; o gatilho `mensagem_so_apagar` (migration
 * 090) é quem carimba a hora de verdade e esvazia o corpo. Ou seja: nem esta
 * action nem um POST à mão escolhem a data do próprio apagamento.
 *
 * `.eq("autor_id", userId)` além da policy: a policy é a trava, isto é o que
 * faz a operação devolver ZERO LINHAS (e portanto uma mensagem honesta) em vez
 * de esbarrar no gatilho e virar um erro de banco na cara da pessoa.
 */
export async function apagarMensagem(formData: FormData) {
  const supabase = await supabaseServer()
  const userId = await usuarioLogado(supabase)

  const conversaId = String(formData.get("conversa_id") ?? "")
  const mensagemId = String(formData.get("mensagem_id") ?? "")
  const rota = `/mensagens/${conversaId}`

  const { data: salvo, error } = await supabase
    .from("mensagens")
    .update({ apagada_em: new Date().toISOString() })
    .eq("id", mensagemId).eq("autor_id", userId).is("apagada_em", null)
    .select("id")

  if (error || !salvo?.length) {
    erro(rota, "Não foi possível apagar. Você só apaga as suas mensagens, e só uma vez.")
  }

  revalidatePath(rota)
  revalidatePath("/mensagens")
  redirect(rota)
}

// ---------------------------------------------------------------------------
// Marcar como lida — o único dado deste módulo que é MEU sobre a conversa
// ---------------------------------------------------------------------------
/**
 * Avança a minha marca de leitura até o carimbo `ate`.
 *
 * ARGUMENTOS SOLTOS E NÃO `FormData` porque quem chama não é um formulário: é
 * o `<MarcarLida>` da thread, um efeito que roda depois de a lista ter sido
 * pintada. Marcar durante a renderização do Server Component seria escrever no
 * banco durante um GET — e com o `router.refresh()` da atualização periódica,
 * cada recarga viraria uma escrita.
 *
 * NÃO REVALIDA NADA, de propósito. Revalidar aqui devolveria a página no meio
 * da leitura, e a divisória "novas mensagens" — que é a única pista de onde a
 * pessoa parou — desapareceria debaixo do olho dela. O contador do Menu se
 * acerta na próxima navegação, que é quando ele volta a ser olhado.
 *
 * `ate` é o carimbo da última mensagem RECEBIDA, nunca `now()`: ver
 * `marcaDeLeitura` no domínio — com `now()`, a mensagem que chega no mesmo
 * segundo em que a tela abre seria marcada como lida sem nunca ter aparecido.
 */
export async function marcarConversaLida(conversaId: string, ate: string): Promise<void> {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const quando = Date.parse(ate)
  if (!Number.isFinite(quando)) return

  const { data: salvo } = await supabase
    .from("conversas_leitura")
    .upsert(
      { conversa_id: conversaId, usuario_id: user.id, lido_ate: new Date(quando).toISOString() },
      { onConflict: "usuario_id,conversa_id" },
    )
    .select("conversa_id")

  // Aqui o zero-linhas NÃO vira mensagem de erro, e é a única escrita deste
  // arquivo onde isso é certo: ninguém pediu para marcar como lido — foi a
  // tela que ofereceu. Interromper a leitura com uma faixa vermelha porque um
  // carimbo de conveniência não gravou seria trocar um problema invisível por
  // um visível e pior. O efeito de não gravar é o contador continuar subindo,
  // que é o lado seguro do erro.
  if (!salvo?.length) return
}
