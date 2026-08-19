import { supabaseServer } from "@/lib/supabase/server"
import { carregarPainel } from "@/lib/consultas"
import { estaAberto } from "@/lib/domain/patio"
import type { MovimentoPatio } from "@/lib/db/types"

/**
 * O QUE A HOME DE CAMPO PRECISA SABER (onda 70b, PRD §6).
 *
 * Duas perguntas, uma consulta: "esta unidade está fora agora?" e "o que
 * aconteceu antes?". A primeira é a que decide a tela inteira — com saída
 * aberta a home mostra CHECK-IN, sem ela mostra CHECK-OUT — e ela sai de
 * graça do mesmo `select`, porque a saída aberta é simplesmente a que tem
 * `retorno_em is null` (o índice único parcial da migration 060 garante que
 * existe no máximo uma).
 */
export interface LeituraDoPatio {
  /**
   * AUDITORIA 19/08, B7 — O CAMPO QUE FALTAVA PRA TELA PODER SER HONESTA.
   *
   * Antes desta rodada o `catch` era mudo: `if (error) return { aberto: null,
   * historico: [], ... }`. Falha de leitura ficava indistinguível de "não há
   * saída aberta e nunca houve movimentação" — a tela oferecia CHECK-OUT de
   * uma unidade que podia estar na água e ainda escrevia "Nenhuma
   * movimentação registrada ainda" por cima de um histórico que existe.
   *
   * Devolver `null` na função inteira (como quando não há painel) foi
   * considerado e descartado: `null` manda a página pra `/onboarding`, e
   * mandar o funcionário do pátio refazer o cadastro porque o banco piscou é
   * pior que a mentira que se queria corrigir. Quem sabe o que fazer com a
   * falha é a tela — a consulta só não pode escondê-la.
   */
  falhouLeitura: boolean
  aberto: MovimentoPatio | null
  historico: MovimentoPatio[]
  nomePorId: Map<string, string>
}

export async function carregarPatio(limite = 8): Promise<LeituraDoPatio | null> {
  const painel = await carregarPainel()
  if (!painel) return null
  const supabase = await supabaseServer()

  const { data, error } = await supabase
    .from("movimentos_patio")
    .select("*")
    .eq("embarcacao_id", painel.embarcacao.id)
    .order("saida_em", { ascending: false })
    .limit(limite + 1)

  if (error) {
    return { falhouLeitura: true, aberto: null, historico: [], nomePorId: new Map() }
  }

  const todos = (data ?? []) as MovimentoPatio[]
  // B10 — `estaAberto` em vez de `m.retorno_em == null` reescrito aqui. A
  // regra de "aberto" tem dono no domínio, com teste; duas cópias não quebram
  // hoje, só garantem que vão divergir amanhã.
  const aberto = todos.find((m) => estaAberto({ retornoEm: m.retorno_em })) ?? null
  const historico = todos.filter((m) => !estaAberto({ retornoEm: m.retorno_em })).slice(0, limite)

  // Os nomes de quem tirou e de quem devolveu. Uma consulta só pros dois
  // papéis, e só pros ids que apareceram — a home de campo é a tela mais
  // usada do dia e não pode pagar uma consulta por linha.
  const ids = [...new Set(
    [aberto, ...historico]
      .flatMap((m) => (m ? [m.responsavel_id, m.retorno_responsavel_id] : []))
      .filter((id): id is string => Boolean(id)),
  )]
  const nomePorId = new Map<string, string>()
  if (ids.length > 0) {
    const { data: perfis } = await supabase.from("profiles").select("id, nome").in("id", ids)
    for (const p of perfis ?? []) {
      if (p.nome) nomePorId.set(p.id, p.nome)
    }
  }

  return { falhouLeitura: false, aberto, historico, nomePorId }
}
