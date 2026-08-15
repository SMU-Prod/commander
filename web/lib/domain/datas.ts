export function hojeISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date())
}

/**
 * Quantos dias faltam de `hojeISO` até `dataISO`: 0 = é hoje, negativo = já
 * passou. Aritmética em UTC sobre as duas datas civis, nunca `new Date(iso)`
 * direto — "2026-08-22" é lido como UTC pelo runtime e viraria 21/08 no
 * Brasil.
 *
 * Existe aqui (onda 53) porque a Central de Notificações precisa da mesma
 * conta pra Agenda e pro Financeiro, e a alternativa era uma quarta cópia
 * dessa aritmética — já havia três (`alertas.ts`, `assinatura-ciclo.ts`,
 * `marketplace.ts`), cada uma com um nome diferente pro mesmo cálculo.
 */
export function diasAteData(dataISO: string, hojeISO: string): number {
  const [ay, am, ad] = dataISO.split("-").map(Number)
  const [hy, hm, hd] = hojeISO.split("-").map(Number)
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(hy, hm - 1, hd)) / 86_400_000)
}

/** Epoch (segundos) -> "AAAA-MM-DD" no fuso America/Sao_Paulo — mesmo raciocinio
 *  de `hojeISO`, mas pra um instante qualquer no passado (onda 21: a data de
 *  uma saida importada de um GPX vem do primeiro ponto da trilha, nao de hoje). */
export function dataSP(epocaSegundos: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(epocaSegundos * 1000))
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

function diaSP(data: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(data)
}

/** "Hoje, 08:30" / "Ontem, 08:30" / "20/08, 08:30" — carimbo da leitura mais
 *  recente pro hero de /hoje (regra de honestidade: só chama quando existe
 *  leitura real). Recebe `agora` explícito pra ser testável sem mockar
 *  relógio, mesmo espírito de `tempoRelativo`. Compara datas em SP (não em
 *  UTC): sem isso, madrugada UTC vira "ontem" mesmo sendo "hoje" na marina
 *  (Brasil não tem horário de verão desde 2019, mas o fuso segue UTC-3). */
export function formatarCarimbo(iso: string, agora: Date = new Date()): string {
  const quando = new Date(iso)
  const hora = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Sao_Paulo",
  }).format(quando)

  const diaQuando = diaSP(quando)
  const diaAgora = diaSP(agora)
  if (diaQuando === diaAgora) return `Hoje, ${hora}`

  const [y, m, d] = diaAgora.split("-").map(Number)
  // Meio-dia UTC do dia anterior evita qualquer virada de fuso ao formatar de novo em SP.
  const diaOntem = diaSP(new Date(Date.UTC(y, m - 1, d - 1, 12)))
  if (diaQuando === diaOntem) return `Ontem, ${hora}`

  const dataCurta = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo",
  }).format(quando)
  return `${dataCurta}, ${hora}`
}
