/**
 * ONDA 90 (achado 4.4) — O ETA COMO TEXTO DE PONTE.
 *
 * `etaMinutos` (lib/domain/navegacao.ts) devolve minutos, e minutos crus
 * servem pra um mostrador de duas casas ("48 min"), não pra uma travessia de
 * três horas: "203 min" obriga quem está no leme a dividir de cabeça. O
 * `ProgressoRota` (components/ui/progresso-rota.tsx) pede o ETA JÁ
 * FORMATADO, texto, exatamente pra essa decisão morar num lugar só.
 *
 * O til não é enfeite: o ETA é projeção da velocidade DESTE instante sobre a
 * distância que falta. Escrever "1 h 08 min" sem ele prometeria uma precisão
 * de relógio que o dado não tem.
 */

/** Minutos → "~48 min" / "~1 h 08 min". `null` (sem velocidade utilizável —
 *  ver `etaMinutos`) devolve o travessão de "não sei", NUNCA um zero: sem
 *  dado o app não finge, mesma regra de `lib/domain/patio.ts`. */
export function formatarEta(minutos: number | null | undefined): string {
  if (minutos == null || !Number.isFinite(minutos) || minutos < 0) return "—"
  const total = Math.round(minutos)
  if (total < 60) return `~${total} min`
  const horas = Math.floor(total / 60)
  const resto = total % 60
  // Minuto com dois dígitos: numa linha que atualiza a cada tick do GPS,
  // "~1 h 8 min" e "~1 h 18 min" têm larguras diferentes e o texto ao lado
  // dança. Mono tabular resolve a largura do dígito, não a quantidade deles.
  return `~${horas} h ${String(resto).padStart(2, "0")} min`
}
