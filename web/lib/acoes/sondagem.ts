"use server"
import { carregarPainel } from "@/lib/consultas"
import { supabaseServer } from "@/lib/supabase/server"
import type { TransporteSondagem } from "@/lib/db/types"

/** Leitura ja passada por validacao + reducao por celula no cliente (ver
 *  `reduzirPorCelula` em `web/lib/domain/sondagem.ts`) — o que chega aqui e
 *  UM ponto por celula por saida, nao o NMEA cru tick a tick. */
export interface LeituraParaGravar {
  lat: number
  lon: number
  profundidadeM: number
  celulaId: string
  transporte: TransporteSondagem
  /** ISO — momento da leitura (nao de quando foi enviada ao servidor). */
  medidoEm: string
}

/** Nunca gravar mais que isso numa unica chamada — mesma logica defensiva
 *  de `MAX_PONTOS_TRILHA` em `salvarTrilha`: mesmo com a reducao por celula
 *  do cliente ja limitando o volume na pratica, uma saida absurdamente longa
 *  (ou um bug no cliente) nao pode virar um payload sem teto. */
const LIMITE_LEITURAS_POR_ENVIO = 2000

export type ResultadoGravarSondagens = { ok: true; gravadas: number } | { ok: false; erro: string }

export async function gravarSondagens(
  leituras: LeituraParaGravar[],
  transporte: TransporteSondagem,
): Promise<ResultadoGravarSondagens> {
  const validas = (Array.isArray(leituras) ? leituras : []).filter(
    (l) =>
      typeof l?.lat === "number" && l.lat >= -90 && l.lat <= 90 &&
      typeof l?.lon === "number" && l.lon >= -180 && l.lon <= 180 &&
      typeof l?.profundidadeM === "number" && l.profundidadeM > 0 &&
      typeof l?.celulaId === "string" && l.celulaId.length > 0 &&
      typeof l?.medidoEm === "string",
  ).slice(0, LIMITE_LEITURAS_POR_ENVIO)
  if (validas.length === 0) return { ok: false, erro: "Nenhuma leitura valida para gravar." }

  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, erro: "Sessão expirada — entre de novo." }
  const painel = await carregarPainel()
  if (!painel) return { ok: false, erro: "Cadastre a embarcação primeiro." }

  const linhas = validas.map((l) => ({
    embarcacao_id: painel.embarcacao.id,
    usuario_id: user.id,
    lat: l.lat,
    lon: l.lon,
    profundidade_m: l.profundidadeM,
    celula_id: l.celulaId,
    transporte,
    medido_em: l.medidoEm,
  }))

  const { data: inseridas, error } = await supabase.from("sondagens").insert(linhas).select("id")
  if (error || !inseridas) {
    return { ok: false, erro: "Não foi possível gravar a sondagem — ela continua nesta saída, tente enviar de novo." }
  }
  return { ok: true, gravadas: inseridas.length }
}
