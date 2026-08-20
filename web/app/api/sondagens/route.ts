import { NextResponse, type NextRequest } from "next/server"
import { supabaseServer } from "@/lib/supabase/server"
import { checarLimite } from "@/lib/seguranca/limitador"
import type { CelulaSondagemAgregada } from "@/lib/db/types"
import { TETO_CELULAS_POR_CONSULTA, type CelulaSondagemMapa, type RespostaSondagensMapa } from "@/lib/mapa/sondagens"

// Auditoria 360 de 20/08/2026 (recomendação nº 3) — a consulta que fecha o
// loop coleta→mapa: a camada "Sondagens da comunidade" de /navegar busca aqui
// o agregado do bbox do viewport a cada moveend (com debounce no cliente).
// Mesmo limite generoso de /api/corredores: navegação normal (pan/zoom
// contínuo já debounced) nunca chega perto; só corta loop/abuso. Por USUÁRIO,
// não por IP — mais preciso atrás de wifi de marina compartilhado. Mitigação
// em memória por instância, não muralha — ver `lib/seguranca/limitador.ts`.
const JANELA_SONDAGENS_MS = 60_000
const LIMITE_SONDAGENS_POR_JANELA = 60

/** Agregado ANÔNIMO de profundidade por célula de 15 m (migration
 *  025_sondagens.sql) — este endpoint NUNCA toca a tabela `sondagens` direto:
 *  toda leitura entre barcos passa pela função security definer
 *  `sondagens_por_celula`, que devolve só centroide + mediana + contagem por
 *  célula, nunca uma linha bruta, nunca embarcacao_id/usuario_id. A RLS da
 *  tabela continua valendo pra todo o resto (o bruto só é visível pra quem
 *  tem vínculo com a embarcação que gravou).
 *
 *  Chamado por `buscarSondagens` (web/lib/mapa/sondagens.ts) — fetch
 *  same-origin, as cookies de sessão do navegador valem aqui. Qualquer falha
 *  vira "sem células" no cliente, nunca um erro na tela. */
export async function GET(req: NextRequest) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 })

  const limite = checarLimite(`sondagens-mapa:${user.id}`, JANELA_SONDAGENS_MS, LIMITE_SONDAGENS_POR_JANELA)
  if (!limite.permitido) {
    return NextResponse.json(
      { erro: "muitas requisições, tente novamente em instantes" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limite.retryAfterMs / 1000)) } },
    )
  }

  const params = req.nextUrl.searchParams
  const lngMin = Number(params.get("lngMin"))
  const latMin = Number(params.get("latMin"))
  const lngMax = Number(params.get("lngMax"))
  const latMax = Number(params.get("latMax"))
  if (![lngMin, latMin, lngMax, latMax].every(Number.isFinite)) {
    return NextResponse.json({ erro: "bbox inválido" }, { status: 400 })
  }

  // Teto + 1 de propósito: pedir UMA linha além do teto é o que permite saber
  // COM CERTEZA que o corte aconteceu (`cortado`), em vez de adivinhar pelo
  // tamanho exato — dado honesto até no metadado. `order by leituras desc`
  // faz o corte descartar as células menos confirmadas, não as melhores.
  const { data, error } = await supabase
    .rpc("sondagens_por_celula", {
      p_lat_min: latMin,
      p_lat_max: latMax,
      p_lon_min: lngMin,
      p_lon_max: lngMax,
    })
    .order("leituras", { ascending: false })
    .limit(TETO_CELULAS_POR_CONSULTA + 1)
  if (error) return NextResponse.json({ erro: "falha ao consultar sondagens" }, { status: 500 })

  const linhas = (data ?? []) as CelulaSondagemAgregada[]
  const cortado = linhas.length > TETO_CELULAS_POR_CONSULTA
  if (cortado) {
    // Log honesto do lado do servidor também — o cliente avisa no console do
    // navegador; aqui fica o rastro de que o teto foi atingido de verdade
    // (sinal pra rever teto/zoom mínimo quando a base crescer).
    console.warn(
      `[sondagens] teto de ${TETO_CELULAS_POR_CONSULTA} células por consulta atingido no bbox ` +
        `[${lngMin}, ${latMin}, ${lngMax}, ${latMax}] — resposta cortada (ficam as mais confirmadas).`,
    )
  }

  // Repassa SÓ o que o desenho precisa — `ultima_leitura` fica de fora de
  // propósito (mesma decisão de anonimato documentada em `CorredorAgregado`,
  // lib/db/types.ts: carimbo de hora cruzado com célula pequena aponta de
  // volta pra uma saída específica).
  const celulas: CelulaSondagemMapa[] = linhas.slice(0, TETO_CELULAS_POR_CONSULTA).map((l) => ({
    celula_id: l.celula_id,
    lat: l.lat,
    lon: l.lon,
    profundidade_m: l.profundidade_m,
    leituras: l.leituras,
  }))

  return NextResponse.json({ celulas, cortado } satisfies RespostaSondagensMapa)
}
