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

/** Compoe horas e minutos em texto legivel, omitindo a parte zerada.
 *
 *  ONDA 62 — o formato vira o do canvas do dono (docs/design-mobile/
 *  tela-3a): "4 h 20", "6 h 05" — minuto SEMPRE com dois digitos, sem o
 *  "min" atras quando ha horas. O zero a esquerda nao e capricho: nas
 *  pilhas do feed as duracoes ficam lado a lado em fonte tabular, e
 *  "6 h 5" ao lado de "4 h 20" desalinha a coluna e le como "6 h 5?".
 *  Menos de uma hora continua "30 min" — "0 h 30" seria leitura de
 *  instrumento pra um numero que nao precisa dela. */
export function textoDuracao(h: number): string {
  const totalMin = Math.round(h * 60)
  const horas = Math.floor(totalMin / 60)
  const minutos = totalMin % 60
  if (horas > 0 && minutos > 0) return `${horas} h ${String(minutos).padStart(2, "0")}`
  if (horas > 0) return `${horas} h`
  return `${minutos} min`
}

/**
 * O titulo de uma SAIDA no feed do Diario (canvas tela-3a: "Angra dos Reis
 * → Ilha Grande") — a rota no titulo, nao o rotulo generico "Navegação".
 * Com um lado so, o titulo e esse lado sozinho; sem nenhum, devolve null e
 * quem chama cai no rotulo do tipo — o feed nunca inventa rota.
 */
export function tituloDaSaida(localSaida: string | null, destino: string | null): string | null {
  const de = localSaida?.trim() || null
  const para = destino?.trim() || null
  if (de && para) return `${de} → ${para}`
  return para ?? de
}

/**
 * O titulo de um registro NAO-saida no feed (canvas tela-3a: "Troca de
 * impelidor — Motor BB"): a descricao digitada vira o titulo, com o
 * equipamento atras.
 *
 * ONDA 122 — O TITULO PAROU DE REPETIR O TIPO. O cartao do feed ganhou o
 * cartucho "data · tipo" da imagem 5 do guia ("12/08 · Abastecimento"), e
 * com ele os dois casos que escreviam o rotulo do tipo no titulo viraram
 * eco: "Abastecimento — 320 L" embaixo de "Abastecimento" e a mesma
 * redundancia dos subtitulos que o dono mandou cortar. Agora a descricao
 * fica sozinha; sem descricao, o equipamento responde ("Motor BE"); so sem
 * os dois e que sobra o rotulo do tipo — o cartao precisa de UM titulo, e
 * nesse caso degenerado o eco e menos ruim que um vazio. Nunca titulo
 * inventado. (O parametro `tipo` saiu junto: so existia pro caso especial
 * do abastecimento.)
 */
export function tituloDoRegistro(
  rotuloTipo: string,
  descricao: string | null,
  nomeEquipamento: string | null,
): string {
  const texto = descricao?.trim() || null
  if (texto) return `${texto.charAt(0).toUpperCase()}${texto.slice(1)}${nomeEquipamento ? ` — ${nomeEquipamento}` : ""}`
  return nomeEquipamento ?? rotuloTipo
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
