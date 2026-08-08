/** Aceita "HH:MM" ou "HH:MM:SS" (o banco devolve `time` com segundos). */
function paraMinutos(hora: string): number {
  const [h, m, s] = hora.split(":").map(Number)
  return h * 60 + m + (s ?? 0) / 60
}

/**
 * Duracao entre saida e retorno, em horas. Retorno menor que a saida conta
 * como o dia seguinte (saida a noite, volta de madrugada). Saida e retorno
 * iguais nao tem duracao — nao presumimos 24h de bordo.
 */
export function duracaoHoras(saida: string | null, retorno: string | null): number | null {
  if (saida == null || retorno == null) return null
  const inicio = paraMinutos(saida)
  const fim = paraMinutos(retorno)
  if (inicio === fim) return null
  const diffMin = fim > inicio ? fim - inicio : fim + 24 * 60 - inicio
  return diffMin / 60
}

/** Arredonda para o decimo de hora — e o que se lanca no horimetro. Saidas curtas demais (<0,3h) nao sugerem nada. */
export function horasSugeridas(duracaoH: number | null): number | null {
  if (duracaoH == null || duracaoH < 0.3) return null
  return Math.round(duracaoH * 10) / 10
}

/** Compoe horas e minutos em texto legivel, omitindo a parte zerada. */
export function textoDuracao(h: number): string {
  const totalMin = Math.round(h * 60)
  const horas = Math.floor(totalMin / 60)
  const minutos = totalMin % 60
  if (horas > 0 && minutos > 0) return `${horas} h ${minutos} min`
  if (horas > 0) return `${horas} h`
  return `${minutos} min`
}
