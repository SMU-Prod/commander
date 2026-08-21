import { cache } from "react"
import { carregarPainel } from "@/lib/consultas"
import { supabaseServer } from "@/lib/supabase/server"
import { JANELA_TELEMETRIA_MS, type MapaTelemetria } from "@/lib/domain/telemetria"

/**
 * ONDA 141 — A LEITURA "O ESTADO AGORA" DA TELEMETRIA DO CONNECTOR.
 * ===========================================================================
 * O plugin de Signal K (connector/) grava leituras em `telemetria` desde
 * 20/08; esta é a primeira consulta que as lê pra tela. A pergunta dela é
 * uma só: **a leitura mais recente de cada path** da embarcação ativa, dentro
 * da janela de 48h — o primeiro dos "dois caminhos de leitura reais" que a
 * migration `20260820_conector_tokens_telemetria.sql` declarou ao criar o
 * índice `(embarcacao_id, path, ts desc)`. Série temporal fica pra tela de
 * histórico, que ainda não existe.
 *
 * COMO: uma consulta só — as últimas ~200 linhas da janela, do mais novo pro
 * mais velho — e o dedupe por path em JS, ficando com a primeira ocorrência
 * (= a mais recente) de cada um. O amostrador do plugin já retém UMA leitura
 * por path por lote (`connector/src/amostrador.ts`), então 200 linhas cobrem
 * dezenas de lotes; um `distinct on` por path faria o banco varrer a janela
 * inteira pra devolver o mesmo topo.
 *
 * O LIMITE TEM UM PREÇO DECLARADO: se um path frequente dominar as 200
 * linhas, um path que só falou horas atrás (mas dentro da janela) pode ficar
 * de fora — o cartão mostra menos, nunca errado. É a troca certa pra um
 * cartão de "agora"; quem precisar de cobertura total da janela é a tela de
 * histórico, com a consulta por path dela.
 *
 * RLS: `telemetria_select` já filtra por vínculo — o `.eq(embarcacao_id)`
 * em cima é o recorte da embarcação ATIVA, não a segurança.
 */
export const carregarTelemetriaRecente = cache(async (): Promise<{
  /** path → leitura mais recente. Vazio = conector nunca falou na janela. */
  leituras: MapaTelemetria
  /** O ts mais novo do conjunto inteiro — o candidato a carimbo do cartão
   *  (cada hub carimba pelo recorte DELE, via domínio). `null` sem dado. */
  tsMaisNovo: string | null
} | null> => {
  const painel = await carregarPainel()
  if (!painel) return null

  const supabase = await supabaseServer()
  const corte = new Date(Date.now() - JANELA_TELEMETRIA_MS).toISOString()
  const { data, error } = await supabase
    .from("telemetria")
    .select("path, valor, ts")
    .eq("embarcacao_id", painel.embarcacao.id)
    .gte("ts", corte)
    .order("ts", { ascending: false })
    .limit(200)

  // Falha de leitura sai como "sem dado" DE PROPÓSITO, e a régua é diferente
  // da do pátio (B7): lá, esconder a falha oferecia uma AÇÃO errada
  // (check-out de barco na água); aqui o contrato do cartão é "só existe
  // quando há telemetria" e não haver cartão não induz ninguém a nada — o
  // estado do barco continua nas leituras manuais que a tela já mostra.
  if (error) return { leituras: {}, tsMaisNovo: null }

  const leituras: MapaTelemetria = {}
  for (const linha of data ?? []) {
    // Do mais novo pro mais velho: a primeira vez que um path aparece É a
    // leitura mais recente dele — as repetições ficam pelo caminho.
    if (!(linha.path in leituras)) leituras[linha.path] = { valor: linha.valor, ts: linha.ts }
  }
  return { leituras, tsMaisNovo: data?.[0]?.ts ?? null }
})
