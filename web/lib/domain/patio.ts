/**
 * O PÁTIO — check-out e check-in (onda 70).
 * PRD-UPGRADE-3-COTAS §6 ("Operações / Pátio — Mobile first").
 *
 * O §6 abre com a régua que governa este módulo inteiro: *"Home de campo
 * deve ser rápida, com botões grandes e poucos passos."* Quem usa isto é o
 * funcionário do pátio, de pé, com o Jet na rampa e o cotista esperando.
 * Cada campo obrigatório a mais é meia hora somada no fim do dia.
 *
 * Por isso quase tudo aqui é opcional, e as funções abaixo são escritas pra
 * conviver com ausência: horas sem leitura, combustível não anotado, retorno
 * ainda não registrado. Nenhuma delas inventa número — devolvem `null` e a
 * tela diz o que não sabe.
 *
 * Módulo puro: nada consulta banco nem relógio (o "agora" entra por
 * parâmetro, como em `semaforo.ts`).
 */

// ---------------------------------------------------------------------------
// A forma mínima que o domínio recebe
// ---------------------------------------------------------------------------

export interface Movimento {
  saidaEm: string
  saidaHoras: number | null
  saidaCombustivelPct: number | null
  retornoEm: string | null
  retornoHoras: number | null
  retornoCombustivelPct: number | null
}

/** Aberto = saiu e ainda não voltou. É o estado que a home de campo destaca:
 *  o §6 quer que o pátio saiba de bate-pronto o que está fora. */
export function estaAberto(m: Pick<Movimento, "retornoEm">): boolean {
  return m.retornoEm == null
}

// ---------------------------------------------------------------------------
// §6 — "Comparação com check-out e duração/horas de uso"
// ---------------------------------------------------------------------------

/**
 * Quanto tempo a unidade ficou fora, em horas decimais.
 *
 * `null` enquanto não voltou — e isso é diferente de zero. Uma saída em curso
 * não tem duração ainda; mostrar "0 h" diria que o Jet voltou na hora, que é
 * mentira. (A auditoria da onda 63 encontrou exatamente essa confusão entre
 * "zero" e "não sei" espalhada por 16 lugares do app.)
 */
export function duracaoHoras(m: Pick<Movimento, "saidaEm" | "retornoEm">): number | null {
  if (m.retornoEm == null) return null
  const ms = new Date(m.retornoEm).getTime() - new Date(m.saidaEm).getTime()
  return ms >= 0 ? ms / 3_600_000 : null
}

/**
 * Horas de USO — a diferença de horímetro entre saída e retorno.
 *
 * Não é o mesmo que `duracaoHoras`, e a diferença importa: um Jet que ficou
 * quatro horas fora mas rodou uma e meia gastou motor por uma e meia. Quem
 * puxa o plano de manutenção é ESTE número (é ele que alimenta
 * `calcularSemaforo`), não o relógio de parede.
 *
 * `null` quando falta qualquer uma das duas leituras.
 */
export function horasDeUso(m: Pick<Movimento, "saidaHoras" | "retornoHoras">): number | null {
  if (m.saidaHoras == null || m.retornoHoras == null) return null
  const delta = m.retornoHoras - m.saidaHoras
  // Horímetro não anda pra trás. O banco tem a mesma trava (migration 060),
  // mas o domínio não confia em dado que já está gravado.
  return delta >= 0 ? delta : null
}

/**
 * Quanto combustível foi consumido, em pontos percentuais.
 *
 * Positivo = gastou. NEGATIVO É INFORMAÇÃO, não erro: significa que a unidade
 * voltou com mais combustível do que saiu, ou seja, alguém abasteceu durante
 * o uso — e isso é justamente o que o §11 quer ver aparecer. Zerar o negativo
 * esconderia um abastecimento não registrado.
 */
export function consumoCombustivelPp(
  m: Pick<Movimento, "saidaCombustivelPct" | "retornoCombustivelPct">,
): number | null {
  if (m.saidaCombustivelPct == null || m.retornoCombustivelPct == null) return null
  return m.saidaCombustivelPct - m.retornoCombustivelPct
}

// ---------------------------------------------------------------------------
// A frase da comparação
// ---------------------------------------------------------------------------

/** "3 h 20 min" / "45 min" / "1 h". Nunca "3.33 h": ninguém no pátio lê hora
 *  decimal. Zero minutos não vira "3 h 0 min". */
export function textoDuracao(horas: number | null): string | null {
  if (horas == null) return null
  const total = Math.round(horas * 60)
  const h = Math.floor(total / 60)
  const min = total % 60
  if (h === 0) return `${min} min`
  return min === 0 ? `${h} h` : `${h} h ${min} min`
}

/**
 * A linha que o §6 chama de "comparação com check-out": o que dá pra dizer
 * com o que foi anotado, e só isso.
 *
 * A ordem — tempo fora, horas de uso, combustível — é a da pergunta que o
 * pátio faz nessa sequência. Um movimento sem nenhuma das três devolve `null`
 * e a tela não desenha linha vazia.
 */
export function linhaDaComparacao(m: Movimento): string | null {
  const partes: string[] = []
  const fora = textoDuracao(duracaoHoras(m))
  if (fora) partes.push(`${fora} fora`)

  const uso = horasDeUso(m)
  if (uso != null) {
    partes.push(`${uso.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h de uso`)
  }

  const consumo = consumoCombustivelPp(m)
  if (consumo != null) {
    partes.push(
      consumo > 0 ? `−${consumo} pp de combustível`
        : consumo < 0 ? `abasteceu ${-consumo} pp durante o uso`
          : "combustível igual",
    )
  }

  return partes.length > 0 ? partes.join(" · ") : null
}

// ---------------------------------------------------------------------------
// §6 — "Se houver problema no retorno, permitir transformar imediatamente
//       em avaria"
// ---------------------------------------------------------------------------

/**
 * O retorno pede abertura de avaria?
 *
 * A regra é literal: a pessoa do pátio marcou que houve problema. Não se
 * deduz avaria de queda de combustível nem de horímetro alto — deduzir abriria
 * avaria fantasma toda vez que alguém navegasse bastante, e o pátio pararia de
 * confiar no aviso.
 *
 * O texto vira a descrição da ocorrência, então ele é preservado inteiro.
 */
export function retornoViraAvaria(
  houveProblema: boolean,
  descricao: string | null,
): { titulo: string; descricao: string | null } | null {
  if (!houveProblema) return null
  const limpo = descricao?.trim() || null
  return {
    // Título curto e específico o bastante pra lista de ocorrências não virar
    // uma coluna de "Problema no retorno" idênticos: quando há descrição, ela
    // é a primeira linha.
    titulo: limpo ? primeiraLinha(limpo) : "Problema constatado no retorno",
    descricao: limpo,
  }
}

/**
 * Primeira frase/linha, com teto — vira título de ocorrência, não parágrafo.
 *
 * O `(?=\s|$)` não é firula: sem ele, "barulho acima de 4.000 rpm" era
 * cortado em "barulho acima de 4", porque o ponto do separador de milhar
 * parecia fim de frase. E "4.000 rpm" é literalmente como o mecânico escreve.
 * Só termina frase o pontuação seguida de espaço ou de fim de texto.
 */
function primeiraLinha(texto: string, teto = 70): string {
  const primeira = texto.split(/\n|[.!?](?=\s|$)/)[0].trim() || texto.trim()
  return primeira.length <= teto ? primeira : `${primeira.slice(0, teto - 1).trimEnd()}…`
}

// ---------------------------------------------------------------------------
// §5 — a propulsão que só o Jet tem
// ---------------------------------------------------------------------------

/**
 * "Propulsão Jet: impeller, wear ring, intake grate, jet pump e ocorrências."
 *
 * Os nomes ficam em inglês de propósito: é como a peça é pedida no balcão da
 * revenda e como vem escrita no catálogo do fabricante. Traduzir "wear ring"
 * pra "anel de desgaste" deixaria o app mais bonito e o mecânico sem achar a
 * peça. (Mesma lógica que manteve "Grey Water" e "Black Water" na Hidráulica.)
 */
export const COMPONENTES_JET = [
  { slug: "impeller", nome: "Impeller", ajuda: "A hélice dentro da turbina." },
  { slug: "wear-ring", nome: "Wear ring", ajuda: "O anel que envolve o impeller." },
  { slug: "intake-grate", nome: "Intake grate", ajuda: "A grade de captação de água." },
  { slug: "jet-pump", nome: "Jet pump", ajuda: "O conjunto da turbina." },
] as const

export type ComponenteJet = (typeof COMPONENTES_JET)[number]["slug"]

/**
 * O §5 manda a ficha do Jet ser específica, não "uma interface de lancha
 * apenas reduzida" (§1, princípios). Esta é a pergunta que a tela faz.
 */
export function ehJet(tipo: string | null): boolean {
  return tipo === "jet"
}
