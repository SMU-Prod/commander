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
