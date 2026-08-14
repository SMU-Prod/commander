import { NextResponse, type NextRequest } from "next/server"
import { supabaseServer } from "@/lib/supabase/server"
import { checarLimite } from "@/lib/seguranca/limitador"

// Onda 31 (robustez) — cada recálculo de rota no worker pode bater aqui;
// limite generoso pra não atrapalhar navegação normal, só cortar loop/abuso.
// Por USUÁRIO (não por IP): mais preciso que IP atrás de wifi de marina
// compartilhado. Mitigação em memória por instância, não muralha — ver
// `lib/seguranca/limitador.ts`.
const JANELA_CORREDORES_MS = 60_000
const LIMITE_CORREDORES_POR_JANELA = 60

/** Nunca mais que isso numa resposta — um bbox gigante (trecho nacional
 *  longo) nao pode virar payload sem teto; o worker so usa isso pra
 *  PREFERENCIA (onda 17), um recorte parcial do corredor ainda e util, nunca
 *  obrigatorio. */
const LIMITE_LINHAS = 5000

/** Corredores (onda 17) — agregado ANONIMO de passagens reais de barcos por
 *  celula (ver migration 029_corredores.sql e web/lib/domain/rota.ts).
 *  Leitura publica autenticada: a tabela nao tem embarcacao_id/usuario_id
 *  nenhum (RLS `to authenticated using(true)`), entao o SELECT direto JA E
 *  o agregado — sem precisar de uma RPC agregadora como
 *  `sondagens_por_celula` (migration 025), que existe pra nao vazar a linha
 *  bruta de quem tem dono.
 *
 *  Chamado pelo Worker de rota (web/components/mapa/rota.worker.ts) via
 *  `buscarCorredores` (web/lib/mapa/corredores.ts) — fetch same-origin, as
 *  mesmas cookies de sessao do navegador valem aqui. Qualquer falha (sem
 *  sessao, bbox invalido, erro de banco) devolve um corpo que o cliente
 *  trata como "sem corredores" — NUNCA aparece na tela como erro; a rota
 *  cai pra calculo normal sem preferencia nenhuma. */
export async function GET(req: NextRequest) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erro: "não autorizado" }, { status: 401 })

  const limite = checarLimite(`corredores:${user.id}`, JANELA_CORREDORES_MS, LIMITE_CORREDORES_POR_JANELA)
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

  const { data, error } = await supabase
    .from("corredores")
    .select("celula_id, lat, lon, passagens")
    .gte("lat", latMin)
    .lte("lat", latMax)
    .gte("lon", lngMin)
    .lte("lon", lngMax)
    .limit(LIMITE_LINHAS)
  if (error) return NextResponse.json({ erro: "falha ao consultar corredores" }, { status: 500 })

  return NextResponse.json(data ?? [])
}
