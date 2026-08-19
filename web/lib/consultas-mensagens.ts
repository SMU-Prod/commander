import { cache } from "react"
import {
  contarNaoLidas,
  idDoOutro,
  nomeDoOutro,
  ordenarConversas,
  papelNaConversa,
  previaDaConversa,
  ultimaMensagem,
  type Conversa,
  type LeituraConversa,
  type Mensagem,
  type PapelConversa,
} from "@/lib/domain/mensagens"
import { supabaseServer } from "@/lib/supabase/server"

/**
 * Leituras da conversa entre as duas partes (migration 090).
 *
 * NENHUMA FUNÇÃO AQUI FILTRA VISIBILIDADE NA MÃO, e é proposital: a RLS da 090
 * é quem decide, e ela é o único lugar onde essa decisão pode morar com
 * segurança. Se uma consulta daqui esquecesse um `.eq()`, o banco continuaria
 * não entregando conversa de terceiro — enquanto o inverso (a tela ser a única
 * guarda) é o desenho em que um esquecimento vira vazamento.
 *
 * O CUSTO, dito antes que alguém meça: a caixa de entrada busca os carimbos de
 * TODAS as mensagens das minhas conversas para contar as não lidas em memória
 * (`contarNaoLidas`, no domínio, testado). É exato e sem limite — um `limit`
 * aqui produziria uma contagem que mente para baixo, que é pior que contagem
 * nenhuma. A conta cresce com o total de mensagens de UMA pessoa, não do app;
 * quando isso incomodar, o caminho é uma RPC `contar_nao_lidas()` em SQL, e o
 * domínio continua sendo quem define a regra (as minhas não contam, apagada
 * conta, carimbo ilegível não conta).
 */

/** Uma linha da caixa de entrada, com tudo que ela desenha já resolvido. */
export interface ConversaNaLista {
  conversa: Conversa
  /** Meu lado. Nunca `null` aqui: a RLS só devolveu conversa de que eu faço
   *  parte, então o `null` de `papelNaConversa` é impossível — e se acontecer,
   *  a linha é descartada em vez de virar uma tela meio montada. */
  papel: PapelConversa
  nomeDoOutro: string
  /** `null` = conversa aberta e ainda sem mensagem. A tela escreve a frase
   *  desse estado; nunca uma linha em branco. */
  previa: string | null
  naoLidas: number
}

/** A thread inteira, do jeito que a tela precisa. */
export interface ConversaAberta {
  conversa: Conversa
  papel: PapelConversa
  nomeDoOutro: string
  mensagens: Mensagem[]
  /** Até onde EU já tinha lido quando esta página renderizou — é o que desenha
   *  a divisória "novas". A RLS só devolve a minha marca; a do outro lado não
   *  é legível nem por engano, e é isso que impede um "visto às 14h". */
  lidoAte: string | null
}

async function usuarioAtual(): Promise<string | null> {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

/**
 * A caixa de entrada: as minhas conversas, da que mexeu por último para a mais
 * antiga.
 *
 * Três consultas, nunca N: as conversas, as MINHAS marcas de leitura e os
 * carimbos das mensagens dessas conversas. O nome do outro e o assunto vêm
 * copiados na própria linha da conversa (ver a migration 090), então não há
 * JOIN com `profiles` nem com `demandas` — os dois seriam recusados pela RLS
 * deles de qualquer forma.
 */
export const carregarCaixaDeEntrada = cache(async (): Promise<ConversaNaLista[]> => {
  const usuarioId = await usuarioAtual()
  if (!usuarioId) return []
  const supabase = await supabaseServer()

  // Sem `.eq()` de participante: a policy "conversas: só as duas partes" já é
  // esse filtro, e escrevê-lo aqui daria a impressão de que ele é o que
  // protege. O `or` explícito existiria só para ajudar o planner — mas a RLS
  // aplica o mesmo predicado e os dois índices já cobrem os dois lados.
  const { data: brutas } = await supabase
    .from("conversas").select("*").order("ultima_mensagem_em", { ascending: false })
  const conversas = ordenarConversas((brutas as Conversa[] | null) ?? [])
  if (conversas.length === 0) return []

  const ids = conversas.map((c) => c.id)
  const [{ data: leiturasBrutas }, { data: mensagensBrutas }] = await Promise.all([
    supabase.from("conversas_leitura").select("*").in("conversa_id", ids),
    // Só as três colunas que a lista usa (mais o corpo, para a prévia). Puxar
    // `select("*")` traria o texto inteiro de toda mensagem de toda conversa
    // só para exibir a última de cada uma.
    supabase
      .from("mensagens").select("id, conversa_id, autor_id, corpo, apagada_em, criado_em")
      .in("conversa_id", ids).order("criado_em"),
  ])

  const leituras = (leiturasBrutas as LeituraConversa[] | null) ?? []
  const mensagens = (mensagensBrutas as Mensagem[] | null) ?? []

  return conversas.flatMap((conversa) => {
    const papel = papelNaConversa(conversa, usuarioId)
    const nome = nomeDoOutro(conversa, usuarioId)
    if (papel == null || nome == null) return []

    const daConversa = mensagens.filter((m) => m.conversa_id === conversa.id)
    const lidoAte = leituras.find((l) => l.conversa_id === conversa.id)?.lido_ate ?? null

    return [{
      conversa,
      papel,
      nomeDoOutro: nome,
      previa: previaDaConversa(ultimaMensagem(daConversa), usuarioId),
      naoLidas: contarNaoLidas({ mensagens: daConversa, usuarioId, lidoAte }),
    }]
  })
})

/**
 * Uma conversa aberta. Devolve `null` quando o id não existe OU quando eu não
 * sou parte dela — e os dois casos são deliberadamente o mesmo `null`.
 *
 * Não distinguir é a decisão: "essa conversa não existe" para quem não
 * participa dela não revela nem que ela existe. É a mesma postura de
 * `app/(app)/marketplace/[id]/page.tsx` com demanda encerrada.
 */
export const carregarConversa = cache(async (conversaId: string): Promise<ConversaAberta | null> => {
  const usuarioId = await usuarioAtual()
  if (!usuarioId) return null
  const supabase = await supabaseServer()

  const { data: bruta } = await supabase
    .from("conversas").select("*").eq("id", conversaId).maybeSingle()
  const conversa = bruta as Conversa | null
  if (!conversa) return null

  const papel = papelNaConversa(conversa, usuarioId)
  const nome = nomeDoOutro(conversa, usuarioId)
  if (papel == null || nome == null) return null

  const [{ data: mensagensBrutas }, { data: leituraBruta }] = await Promise.all([
    supabase.from("mensagens").select("*").eq("conversa_id", conversaId).order("criado_em"),
    // `.eq("usuario_id", ...)` além da RLS: a policy já devolve só a minha, e
    // o filtro explícito é o que faz esta consulta continuar correta se um dia
    // a policy mudar para "as duas marcas". Redundância barata num lugar onde
    // ler a marca do outro seria o começo de um "visto às 14h".
    supabase
      .from("conversas_leitura").select("*")
      .eq("conversa_id", conversaId).eq("usuario_id", usuarioId).maybeSingle(),
  ])

  return {
    conversa,
    papel,
    nomeDoOutro: nome,
    mensagens: (mensagensBrutas as Mensagem[] | null) ?? [],
    lidoAte: (leituraBruta as LeituraConversa | null)?.lido_ate ?? null,
  }
})

/**
 * A conversa de UMA proposta, para a porta na ficha do pedido.
 *
 * `null` quer dizer "ainda não existe" — e a tela oferece o botão que a cria.
 * A RLS garante que um terceiro receba `null` também, mas por outro motivo
 * (não é dele), e a tela dele nem chega a perguntar porque `podeConversar` já
 * disse não.
 */
export const carregarConversaDaProposta = cache(async (propostaId: string): Promise<Conversa | null> => {
  const supabase = await supabaseServer()
  const { data } = await supabase
    .from("conversas").select("*").eq("proposta_id", propostaId).maybeSingle()
  return (data as Conversa | null) ?? null
})

/**
 * Quantas conversas têm mensagem por ler — o número ao lado de "Mensagens" no
 * Menu.
 *
 * CONTA CONVERSAS, NÃO MENSAGENS, e a diferença importa: "3" ao lado da porta
 * quer dizer "três pessoas esperando você", que é o que decide se vale abrir
 * agora. "17" (mensagens) diria que uma pessoa falante vale mais que três
 * negociações paradas.
 *
 * Reaproveita `carregarCaixaDeEntrada`, que é `cache()` — no Menu isto não é
 * uma segunda ida ao banco quando a mesma tela já listou as conversas.
 */
export const contarConversasComNaoLidas = cache(async (): Promise<number> => {
  const caixa = await carregarCaixaDeEntrada()
  return caixa.filter((c) => c.naoLidas > 0).length
})

/** O id do outro lado, quando a tela precisa linkar o perfil/reputação dele.
 *  Fica aqui e não na tela para o `null` de "não sou parte" ser tratado uma
 *  vez só. */
export function idDoInterlocutor(conversa: Conversa, usuarioId: string): string | null {
  return idDoOutro(conversa, usuarioId)
}
