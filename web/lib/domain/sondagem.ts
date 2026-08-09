import { haversineNm } from "@/lib/domain/geo"

/**
 * Sondagem colaborativa (onda 13) — o equivalente do SonarChart do Navionics.
 * Todo barco com ecobatimetro ja mede profundidade sob o casco; aqui a gente
 * grava esse numero junto da posicao e agrega com o de outros barcos.
 *
 * Este arquivo e SO o dominio (parser NMEA + validacao + reducao) — puro,
 * sem I/O. O transporte que alimenta esses parsers vive em `web/lib/nmea/`
 * (Signal K hoje via WebSocket; TCP/UDP nativo depois, mesma interface).
 */

// ---------------------------------------------------------------------------
// Parser NMEA 0183 — sentencas DPT (depth + offset do transdutor) e DBT
// (depth below transducer, sem offset). Formato e checksum pesquisados nas
// especs publicas do NMEA 0183 (ver relatorio da onda pra fontes).
// ---------------------------------------------------------------------------

/** XOR de todos os bytes entre `$` e `*`, em hex maiusculo de 2 digitos —
 *  o checksum do NMEA 0183. Sentenca sem esse par batendo e descartada: dado
 *  de profundidade CORROMPIDO virando sondagem e pior que nenhum dado (uma
 *  leitura falsa de "2m" por causa de ruido de linha serial pode marcar um
 *  baixio que nao existe pra sempre). */
export function validarChecksum(sentenca: string): boolean {
  const m = /^\$([^*]*)\*([0-9A-Fa-f]{2})$/.exec(sentenca.trim())
  if (!m) return false
  const [, corpo, hex] = m
  let calc = 0
  for (let i = 0; i < corpo.length; i++) calc ^= corpo.charCodeAt(i)
  return calc.toString(16).toUpperCase().padStart(2, "0") === hex.toUpperCase()
}

const NUMERO = /^-?\d+(\.\d+)?$/

function paraNumero(campo: string | undefined): number | null {
  if (campo == null || !NUMERO.test(campo)) return null
  return Number(campo)
}

/** Separa endereco (ex.: "SDDPT") dos campos de dados — so chama depois de
 *  `validarChecksum` confirmar que a sentenca nao esta corrompida. */
function corpoDaSentenca(sentenca: string): { endereco: string; campos: string[] } | null {
  const asterisco = sentenca.indexOf("*")
  if (asterisco < 0 || !sentenca.trim().startsWith("$")) return null
  const corpo = sentenca.trim().slice(1, asterisco)
  const [endereco, ...campos] = corpo.split(",")
  if (!endereco) return null
  return { endereco, campos }
}

/** `$--DPT,profundidade,offset[,alcance_maximo]*hh` — profundidade e offset
 *  em metros. Offset: positivo = distancia do transdutor ATE A LINHA D'AGUA
 *  (somar da profundidade abaixo da linha d'agua); negativo = distancia do
 *  transdutor ATE A QUILHA (somar da profundidade abaixo da quilha — offset
 *  ja vem negativo, entao "somar" na pratica subtrai). Campo de alcance
 *  maximo e do v3.0 e e ignorado aqui. Offset ausente (nem todo equipamento
 *  permite configurar) conta como zero. */
export function parseDPT(sentenca: string): { profundidadeBrutaM: number; offsetM: number } | null {
  if (!validarChecksum(sentenca)) return null
  const partes = corpoDaSentenca(sentenca)
  if (!partes || !partes.endereco.endsWith("DPT")) return null
  const profundidadeBrutaM = paraNumero(partes.campos[0])
  if (profundidadeBrutaM == null) return null
  const campoOffset = partes.campos[1]
  const offsetM = campoOffset === "" || campoOffset == null ? 0 : paraNumero(campoOffset)
  if (offsetM == null) return null
  return { profundidadeBrutaM, offsetM }
}

/** `$--DBT,pes,f,metros,M,bracas,F*hh` — sem campo de offset (diferenca
 *  crucial pro DPT: DBT nao sabe onde fica a linha d'agua nem a quilha, so
 *  a distancia direta ate o transdutor). Preferimos o campo em metros;
 *  cai pra pes (*0,3048) ou bracas (*1,8288) quando o equipamento nao
 *  preenche metros (alguns só mandam um dos tres). */
export function parseDBT(sentenca: string): { profundidadeBrutaM: number } | null {
  if (!validarChecksum(sentenca)) return null
  const partes = corpoDaSentenca(sentenca)
  if (!partes || !partes.endereco.endsWith("DBT")) return null
  const metros = paraNumero(partes.campos[2])
  if (metros != null) return { profundidadeBrutaM: metros }
  const pes = paraNumero(partes.campos[0])
  if (pes != null) return { profundidadeBrutaM: pes * 0.3048 }
  const bracas = paraNumero(partes.campos[4])
  if (bracas != null) return { profundidadeBrutaM: bracas * 1.8288 }
  return null
}

export type FonteSentencaProfundidade = "DPT" | "DBT"

export interface LeituraNMEA {
  /** Profundidade ja normalizada pelo offset (DPT) — abaixo da linha d'agua
   *  quando o offset e de superficie, abaixo da quilha quando e de quilha.
   *  DBT nao tem offset: fica "abaixo do transdutor" (leve subestimativa da
   *  profundidade real, o transdutor fica alguns cm/dezenas de cm abaixo da
   *  linha d'agua — erro pequeno e do lado seguro seria o ideal, mas aqui e
   *  do lado otimista; ver concern no relatorio da onda). */
  profundidadeM: number
  fonte: FonteSentencaProfundidade
}

/** Ponto de entrada do parser: tenta DPT primeiro (mais informacao, tem
 *  offset), depois DBT. Sentenca corrompida (checksum) ou de outro tipo
 *  (GGA, RMC etc.) devolve null — quem chama decide o que fazer (descartar
 *  em silencio, contar como erro de leitura etc.), este modulo nunca
 *  inventa um numero. */
export function parseSentencaProfundidade(sentenca: string): LeituraNMEA | null {
  const dpt = parseDPT(sentenca)
  if (dpt) return { profundidadeM: dpt.profundidadeBrutaM + dpt.offsetM, fonte: "DPT" }
  const dbt = parseDBT(sentenca)
  if (dbt) return { profundidadeM: dbt.profundidadeBrutaM, fonte: "DBT" }
  return null
}

// ---------------------------------------------------------------------------
// Validacao — descarta o que nao presta ANTES de guardar. Cada limite abaixo
// tem uma razao escrita do lado; nenhum e "porque sim".
// ---------------------------------------------------------------------------

/** Acima disso, quase certo que e erro de sensor/decodificacao, nao um baixio
 *  real: o Commander opera em navegacao costeira recreativa (a mesma area
 *  da grade de profundidade da onda 12); ecobatimetros de lancha/veleiro de
 *  passeio raramente tem alcance nominal acima de 200-300 m — acima disso o
 *  aparelho normalmente perde o fundo e devolve um valor de "sem eco"
 *  qualquer, nao uma leitura de verdade. */
const PROFUNDIDADE_MAXIMA_M = 300

/** GPS com mais de 10s de idade: a 20 kt (nosso proprio teto de velocidade
 *  logo abaixo), o barco anda ~103 m nesses 10s — bem mais que a resolucao
 *  da celula (15 m, ver `RESOLUCAO_CELULA_M`). Acima disso a posicao
 *  carimbada na leitura de profundidade deixa de representar o ponto onde
 *  ela foi medida. */
const IDADE_POSICAO_MAXIMA_S = 10

/** Ecobatimetro de casco (single-beam) precisa do eco voltar quase reto;
 *  em alta velocidade o feixe nao acompanha (bolhas/cavitacao sob o
 *  transdutor, e o angulo do casco em planeio muda o angulo de emissao) —
 *  20 kt e um teto conservador pra lancha de passeio tipica, acima disso a
 *  leitura fica poluida com frequencia. */
const VELOCIDADE_MAXIMA_KT = 20

export interface CandidatoLeituraSondagem {
  profundidadeM: number
  lat: number | null
  lon: number | null
  /** Idade da posicao GPS usada nesta leitura, em segundos. */
  idadePosicaoS: number
  /** SOG em nos; `null` quando o transporte nao informa velocidade (nem todo
   *  Signal K expoe `navigation.speedOverGround`) — nesse caso nao bloqueia,
   *  so deixa de aplicar esse filtro especifico. */
  velocidadeKt: number | null
}

export type ResultadoValidacaoSondagem = { ok: true } | { ok: false; motivo: string }

export function validarLeituraSondagem(c: CandidatoLeituraSondagem): ResultadoValidacaoSondagem {
  if (!Number.isFinite(c.profundidadeM) || c.profundidadeM <= 0) {
    return { ok: false, motivo: "Profundidade zero, negativa ou invalida." }
  }
  if (c.profundidadeM > PROFUNDIDADE_MAXIMA_M) {
    return { ok: false, motivo: "Profundidade maior que o esperado pra navegacao costeira — provavel erro do sensor." }
  }
  if (c.lat == null || c.lon == null) {
    return { ok: false, motivo: "Sem posicao GPS." }
  }
  if (c.idadePosicaoS > IDADE_POSICAO_MAXIMA_S) {
    return { ok: false, motivo: "Posicao GPS velha demais pra confiar na sondagem." }
  }
  if (c.velocidadeKt != null && c.velocidadeKt > VELOCIDADE_MAXIMA_KT) {
    return { ok: false, motivo: "Barco rapido demais — o feixe do sonar nao acompanha." }
  }
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Reducao por celula — varias leituras da mesma celula viram uma so. Vem
// antes da secao de movimento porque o filtro de "barco parado" usa a
// mesma resolucao de celula como referencia de distancia.
// ---------------------------------------------------------------------------

/** Tamanho do lado da celula, em metros. 15 m fica na ordem da precisao de
 *  GPS civil em condicao boa (tipicamente 3-8 m, ate ~15 m no pior caso
 *  razoavel) — celula menor que isso separaria leituras do MESMO ponto
 *  fisico em celulas diferentes so por ruido do GPS; celula muito maior
 *  perderia detalhe de canal estreito/baixio pontual, que e exatamente o
 *  que a sondagem colaborativa quer capturar. */
export const RESOLUCAO_CELULA_M = 15

const METROS_POR_GRAU_LAT = 111_320

/** Chave de celula: grade regular em graus, com o passo em longitude
 *  corrigido por cos(lat) (mesma correcao ja usada em `navegacao.ts`/
 *  `pontosCirculo` pro alarme de ancora) pra manter celulas aproximadamente
 *  quadradas em qualquer latitude. */
export function celulaId(lat: number, lon: number, resolucaoM: number = RESOLUCAO_CELULA_M): string {
  const passoLat = resolucaoM / METROS_POR_GRAU_LAT
  const passoLon = resolucaoM / (METROS_POR_GRAU_LAT * Math.cos((lat * Math.PI) / 180))
  const iLat = Math.floor(lat / passoLat)
  const iLon = Math.floor(lon / passoLon)
  return `${iLat}:${iLon}`
}

export interface LeituraParaReducao {
  lat: number
  lon: number
  profundidadeM: number
}

export interface CelulaReduzida {
  celulaId: string
  lat: number
  lon: number
  profundidadeM: number
  leituras: number
}

/** Mediana das profundidades da celula; com quantidade PAR de leituras,
 *  desempata pro MENOR dos dois valores centrais — nunca a media simetrica.
 *  Mesma filosofia "piso conservador" de `scripts/gerar-grade-profundidade.mjs`
 *  (onda 12): quando ha ambiguidade, o produto erra pro raso, nunca pro
 *  fundo. Mediana em vez de MINIMO puro porque minimo trava a celula pra
 *  sempre no primeiro bounce de sonar isolado (peixe, popa de outro barco,
 *  cavitacao) sem nunca se recuperar; mediana precisa de leituras ruins
 *  REPETIDAS pra puxar o valor — uma unica leitura absurda isolada nao
 *  destroi a celula (ver teste "mediana perdoa 1 outlier"). */
function medianaConservadora(valores: number[]): number {
  const ordenado = [...valores].sort((a, b) => a - b)
  const meio = ordenado.length / 2
  if (ordenado.length % 2 === 1) return ordenado[Math.floor(meio)]
  return ordenado[meio - 1]
}

/** Agrupa leituras por celula e reduz cada grupo a um unico ponto: posicao
 *  = centroide (media) das leituras do grupo; profundidade = mediana
 *  conservadora; `leituras` = quantas leituras formaram esse ponto (usado
 *  tanto pra UI — "N leituras nesta saida" — quanto como sinal de confianca
 *  de quem consome a base agregada). */
export function reduzirPorCelula(
  leituras: LeituraParaReducao[],
  resolucaoM: number = RESOLUCAO_CELULA_M,
): CelulaReduzida[] {
  const grupos = new Map<string, LeituraParaReducao[]>()
  for (const l of leituras) {
    const id = celulaId(l.lat, l.lon, resolucaoM)
    const grupo = grupos.get(id)
    if (grupo) grupo.push(l)
    else grupos.set(id, [l])
  }
  const resultado: CelulaReduzida[] = []
  for (const [id, grupo] of grupos) {
    const lat = grupo.reduce((s, l) => s + l.lat, 0) / grupo.length
    const lon = grupo.reduce((s, l) => s + l.lon, 0) / grupo.length
    const profundidadeM = medianaConservadora(grupo.map((l) => l.profundidadeM))
    resultado.push({ celulaId: id, lat, lon, profundidadeM, leituras: grupo.length })
  }
  return resultado
}

// ---------------------------------------------------------------------------
// Redundancia por movimento — barco parado (ou quase) nao acrescenta
// informacao nova a cada tick do NMEA (que pode chegar a 1 Hz ou mais).
// ---------------------------------------------------------------------------

export interface PontoAceitoSondagem {
  lat: number
  lon: number
  /** epoch em segundos */
  t: number
}

/** Metade da resolucao da celula: mover menos que isso quase certo cai na
 *  mesma celula de novo (ver `celulaId`), entao nao muda o resultado da
 *  reducao — nao vale a pena gravar mais uma linha por isso. */
const DISTANCIA_MINIMA_M = RESOLUCAO_CELULA_M / 2

/** Mesmo parado (fundeado), a mare muda a profundidade ao longo de horas —
 *  vale registrar de novo de tempos em tempos. 10 min e frequente o
 *  suficiente pra acompanhar mare (que se move em horas) sem inundar o
 *  banco com leituras identicas de um barco ancorado o dia inteiro. */
const INTERVALO_MAXIMO_S = 600

/** Decide se uma leitura NOVA (ja validada por `validarLeituraSondagem`)
 *  acrescenta informacao em relacao a ULTIMA leitura aceita nesta saida.
 *  Estado explicito por parametro (nao guardado aqui) — quem chama decide
 *  o que e "ultima aceita" e mantem esse estado. */
export function deveAceitarPorMovimento(ultima: PontoAceitoSondagem | null, nova: PontoAceitoSondagem): boolean {
  if (!ultima) return true
  const distanciaM = haversineNm({ la: ultima.lat, lo: ultima.lon }, { la: nova.lat, lo: nova.lon }) * 1852
  if (distanciaM >= DISTANCIA_MINIMA_M) return true
  return nova.t - ultima.t >= INTERVALO_MAXIMO_S
}
