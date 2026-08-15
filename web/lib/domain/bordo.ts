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

/**
 * A duracao da saida arredondada ao decimo de hora, ou `null` quando a saida
 * foi curta demais (<0,3 h) pra valer a conversa.
 *
 * ONDA 53 — LEIA O NOME COM CUIDADO: isto NAO e uma sugestao de horimetro, e
 * nao pode voltar a ser. O PRD §6 e o criterio §27.2 proibem inferir ou somar
 * horas de motor a partir da duracao do passeio, e ate a onda 52 esta funcao
 * alimentava o `defaultValue` do campo — o que fazia o app gravar um numero
 * que ninguem leu no painel. O unico uso legitimo que sobrou, e o que
 * `lib/acoes/eventos.ts` e `lib/acoes/trilha.ts` fazem, e decidir SE VALE
 * PERGUNTAR ("a saida foi longa o bastante?"). A resposta continua sendo
 * digitada a mao, sempre.
 */
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

/**
 * Lê o campo livre de Passageiros (PRD §23) — a pessoa digita "Pedro, Ana,
 * João" num campo só porque no celular isso é muito mais rápido que uma
 * lista com botão de "adicionar".
 *
 * Descarta espaço em volta e nome vazio ("Pedro,,Ana" e "Pedro, " são
 * acidentes de digitação, não passageiros anônimos), e não deduplica: dois
 * "João" a bordo podem ser duas pessoas diferentes — não cabe ao app decidir
 * que uma delas não existe.
 */
export function lerPassageiros(bruto: string | null): string[] {
  if (bruto == null) return []
  return bruto.split(",").map((n) => n.trim()).filter((n) => n !== "")
}
