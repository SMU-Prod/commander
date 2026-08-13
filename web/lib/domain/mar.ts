export interface SeloMar {
  nivel: "ok" | "atencao" | "crit"
  rotulo: string
}

// Onda 20 (tempo no mar) — link único pra tábua oficial de marés do CHM
// (Marinha do Brasil). Fonte única: toda tela que mostra maré linka pra CÁ
// (glossário "um conceito, um nome", CONTRIBUTING.md) — nunca uma URL
// duplicada solta em cada componente. A licença do CHM proíbe EMBUTIR os
// dados da tábua ("fins científicos"), mas linkar pra ela é livre.
export const LINK_TABUA_MARE_CHM = "https://www.marinha.mil.br/chm/dados-do-segnav-publicacoes/tabuas-das-mares"

const ONDA_OK_M = 1.0
const ONDA_ATENCAO_M = 1.8
const VENTO_OK_KT = 15
const VENTO_ATENCAO_KT = 22

export function avaliarMar(ondaM: number | null, ventoKt: number | null): SeloMar {
  if (ondaM === null && ventoKt === null) return { nivel: "atencao", rotulo: "Sem dados do mar" }
  const ondaCrit = ondaM !== null && ondaM > ONDA_ATENCAO_M
  const ventoCrit = ventoKt !== null && ventoKt > VENTO_ATENCAO_KT
  if (ondaCrit || ventoCrit) return { nivel: "crit", rotulo: "Mar pesado" }
  const ondaAtencao = ondaM !== null && ondaM > ONDA_OK_M
  const ventoAtencao = ventoKt !== null && ventoKt > VENTO_OK_KT
  if (ondaAtencao || ventoAtencao) return { nivel: "atencao", rotulo: "Atenção no mar" }
  return { nivel: "ok", rotulo: "Bom pra sair" }
}

// Onda 20 (tempo no mar) — rosa dos ventos de 8 rumos em PT-BR. "L" (Leste) e
// "O" (Oeste), nunca "E"/"W" (padrão náutico brasileiro, não o inglês).
export type PontoCardeal = "N" | "NE" | "L" | "SE" | "S" | "SO" | "O" | "NO"
const RUMOS: PontoCardeal[] = ["N", "NE", "L", "SE", "S", "SO", "O", "NO"]

/** Converte graus (0-360, sentido horário a partir do Norte — convenção
 *  meteorológica padrão, é de onde o vento SOPRA) no rumo mais próximo da
 *  rosa dos ventos de 8 pontas. Normaliza antes de arredondar, então aceita
 *  qualquer grau (negativo, ou >360) sem lançar. */
export function pontoCardeal(graus: number): PontoCardeal {
  const normalizado = ((graus % 360) + 360) % 360
  const indice = Math.round(normalizado / 45) % 8
  return RUMOS[indice]
}

/** Um ponto por hora do nível do mar (Open-Meteo Marine, `sea_level_height_msl`)
 *  — é a curva de maré ESTIMADA POR MODELO, nunca a tábua oficial (ver
 *  ressalva de honestidade no CONTRIBUTING.md e em toda tela que usa isto). */
export interface NivelMarHora {
  hora: number
  nivelM: number
}

export interface EventoMare extends NivelMarHora {
  tipo: "preamar" | "baixa-mar"
}

/** Acha todos os máximos/mínimos LOCAIS da série do dia — preamares e
 *  baixa-mares ESTIMADAS pelo modelo (nunca a tábua oficial do CHM, que tem
 *  restrição de uso — ver ressalva no CONTRIBUTING.md). Início de um platô
 *  (dois pontos seguidos no mesmo nível) conta como a virada; o resto do
 *  platô não gera um segundo evento. */
export function extremosMare(serie: NivelMarHora[]): EventoMare[] {
  const extremos: EventoMare[] = []
  for (let i = 1; i < serie.length - 1; i++) {
    const anterior = serie[i - 1].nivelM
    const atual = serie[i].nivelM
    const proximo = serie[i + 1].nivelM
    if (atual > anterior && atual >= proximo) extremos.push({ ...serie[i], tipo: "preamar" })
    else if (atual < anterior && atual <= proximo) extremos.push({ ...serie[i], tipo: "baixa-mar" })
  }
  return extremos
}

/** A próxima virada (preamar OU baixa-mar) a partir da hora atual, inclusive
 *  — `null` quando não há mais nenhuma virada estimada na série do dia (ex.:
 *  já passou da última). Sempre rotulada como estimativa pelo tipo de retorno
 *  (`EventoMare`), nunca "tábua oficial" — quem exibe deve repetir a ressalva
 *  em texto (CONTRIBUTING.md). */
export function proximaMare(serie: NivelMarHora[], horaAtual: number): EventoMare | null {
  return extremosMare(serie).find((e) => e.hora >= horaAtual) ?? null
}

// --- gráfico de maré (painel de tempo, onda 20) --------------------------
// SVG próprio, sem lib de gráfico nenhuma — só a matemática de escala fica
// aqui (pura, testada); quem desenha o <path>/<circle> é o componente
// (web/components/mapa/tempo-painel.tsx).

/** Escala compartilhada por todo ponto desenhado no gráfico (linha da maré,
 *  marcador de "agora", marcador da próxima virada) — construída uma vez a
 *  partir do min/max da série do dia, pra três desenhos diferentes usarem
 *  exatamente a mesma régua. `null` quando a série não tem pontos o
 *  suficiente pra definir uma escala (0 ou 1 ponto: sem variação pra
 *  desenhar linha nenhuma). */
export interface EscalaMare {
  min: number
  max: number
  larguraPx: number
  alturaPx: number
  margemYPx: number
}

export function calcularEscalaMare(
  serie: NivelMarHora[],
  larguraPx: number,
  alturaPx: number,
  margemYPx = 6,
): EscalaMare | null {
  if (serie.length < 2) return null
  const niveis = serie.map((p) => p.nivelM)
  return { min: Math.min(...niveis), max: Math.max(...niveis), larguraPx, alturaPx, margemYPx }
}

/** Projeta um ponto (hora do dia 0-23, nível em metros) em coordenadas SVG
 *  segundo `escala`. Eixo X é a HORA em si (0 = borda esquerda, 23 = borda
 *  direita) — não o índice dentro do array — então um ponto ausente no meio
 *  da série não desloca os que vêm depois. Eixo Y cresce pra baixo (convenção
 *  SVG): nível máximo vira `margemYPx` (perto do topo), nível mínimo vira
 *  `alturaPx - margemYPx` (perto da base). Amplitude zero (maré chapada, ou
 *  min===max) nunca divide por zero — a linha fica reta no meio vertical. */
export function projetarPonto(hora: number, nivelM: number, escala: EscalaMare): { x: number; y: number } {
  const amplitude = escala.max - escala.min
  const alturaUtil = escala.alturaPx - escala.margemYPx * 2
  const x = (hora / 23) * escala.larguraPx
  const y = amplitude === 0 ? escala.alturaPx / 2 : escala.margemYPx + alturaUtil * (1 - (nivelM - escala.min) / amplitude)
  return { x, y }
}

/** Path SVG (`M x,y L x,y ...`) da curva de nível do mar do dia inteiro.
 *  String vazia quando não há pontos suficientes pra traçar uma linha (0 ou
 *  1 ponto) — quem chama decide o que mostrar nesse caso (ex.: omitir o
 *  gráfico e avisar "sem dado de maré agora"). */
export function pathNivelMar(serie: NivelMarHora[], escala: EscalaMare): string {
  if (serie.length < 2) return ""
  const pontos = serie.map((p) => projetarPonto(p.hora, p.nivelM, escala))
  return `M${pontos.map((pt) => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(" L")}`
}
