/** Aceita "HH:MM" ou "HH:MM:SS" (o banco devolve `time` com segundos).
 *  Devolve null para qualquer coisa fora desse formato — um <input type="time">
 *  emite string vazia e valores parciais enquanto a pessoa digita, e NaN
 *  vazando daqui apareceria como "NaN min" na tela. */
function paraMinutos(hora: string): number | null {
  const partes = hora.split(":")
  if (partes.length < 2 || partes.length > 3) return null
  const [h, m, s = 0] = partes.map(Number)
  if (![h, m, s].every(Number.isFinite)) return null
  if (h < 0 || h > 23 || m < 0 || m > 59 || s < 0 || s > 59) return null
  return h * 60 + m + s / 60
}

/**
 * Duracao entre saida e retorno, em horas. Retorno menor que a saida conta
 * como o dia seguinte (saida a noite, volta de madrugada). Saida e retorno
 * iguais nao tem duracao — nao presumimos 24h de bordo.
 *
 * LIMITE CONHECIDO: o modelo e de UMA meia-noite. Uma travessia de varios
 * dias (Rio->Angra no fim de semana) registrada como uma unica saida sai
 * subestimada, porque `eventos` nao guarda a data do retorno. Quem usa isto
 * precisa dizer na tela que o retorno caiu no dia seguinte — ver
 * `retornoNoDiaSeguinte`. Suporte a multiplos dias exige coluna nova.
 */
export function duracaoHoras(saida: string | null, retorno: string | null): number | null {
  if (saida == null || retorno == null) return null
  const inicio = paraMinutos(saida)
  const fim = paraMinutos(retorno)
  if (inicio == null || fim == null) return null
  if (inicio === fim) return null
  const diffMin = fim > inicio ? fim - inicio : fim + 24 * 60 - inicio
  return diffMin / 60
}

/** A saida atravessou a meia-noite? A tela precisa dizer isso em voz alta:
 *  sem essa marca, "22:00 -> 01:30 = 3h30" parece conta errada. */
export function retornoNoDiaSeguinte(saida: string | null, retorno: string | null): boolean {
  if (saida == null || retorno == null) return false
  const inicio = paraMinutos(saida)
  const fim = paraMinutos(retorno)
  if (inicio == null || fim == null) return false
  return fim < inicio
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
