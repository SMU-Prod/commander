export function hojeISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date())
}

/** Epoch (segundos) -> "HH:MM" no fuso America/Sao_Paulo — mesma abordagem via
 *  Intl de `hojeISO`, sem fazer o offset UTC-3 na mao (Brasil aboliu o horario
 *  de verao em 2019, mas o fuso e quem sabe disso, nao um numero fixo aqui). */
export function horaSP(epocaSegundos: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Sao_Paulo",
  }).format(new Date(epocaSegundos * 1000))
}

/** "há X min"/"há X h" pra carimbos recentes (ex.: último envio da fila de
 *  sondagem, onda 14 — `web/lib/nmea/fila.ts`) — não precisa de precisão de
 *  segundo, só transmitir "faz pouco tempo" vs "faz um tempo" de forma
 *  honesta, sem exigir que a pessoa faça conta de fuso. */
export function tempoRelativo(epocaMs: number, agoraMs: number = Date.now()): string {
  const diffS = Math.max(0, Math.round((agoraMs - epocaMs) / 1000))
  if (diffS < 60) return "agora mesmo"
  const diffMin = Math.round(diffS / 60)
  if (diffMin < 60) return `há ${diffMin} min`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return `há ${diffH} h`
  const diffD = Math.round(diffH / 24)
  return `há ${diffD} d`
}
