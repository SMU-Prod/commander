import { supabaseServer } from "@/lib/supabase/server"
import { carregarPainel } from "@/lib/consultas"
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
export async function carregarPatio(limite = 8): Promise<{
  aberto: MovimentoPatio | null
  historico: MovimentoPatio[]
  nomePorId: Map<string, string>
} | null> {
  const painel = await carregarPainel()
  if (!painel) return null
  const supabase = await supabaseServer()

  const { data, error } = await supabase
    .from("movimentos_patio")
    .select("*")
    .eq("embarcacao_id", painel.embarcacao.id)
    .order("saida_em", { ascending: false })
    .limit(limite + 1)

  if (error) return { aberto: null, historico: [], nomePorId: new Map() }

  const todos = (data ?? []) as MovimentoPatio[]
  const aberto = todos.find((m) => m.retorno_em == null) ?? null
  const historico = todos.filter((m) => m.retorno_em != null).slice(0, limite)

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

  return { aberto, historico, nomePorId }
}
