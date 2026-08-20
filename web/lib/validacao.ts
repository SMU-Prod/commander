import { centavosDeReais } from "@/lib/domain/financeiro"
import { parseDecimalPtBr } from "@/lib/domain/numeros"

/**
 * VALIDADOR DECLARATIVO DOS FORMULÁRIOS DE DINHEIRO (auditoria 360 de
 * 20/08/2026, recomendação nº 10).
 *
 * A auditoria apontou que a validação artesanal — cada action lendo `formData`
 * com seus próprios `String(...).trim()` — é disciplinada mas depende de o
 * autor LEMBRAR de cada regra a cada campo novo. Nos fluxos de dinheiro
 * (`lib/acoes/financeiro.ts`, `carteira.ts`, `assinatura.ts`) o preço de um
 * esquecimento é o mais alto do app, então só eles ganham schema; o resto
 * continua artesanal de propósito — a decisão de rodada foi NÃO adotar zod.
 *
 * O contrato, em uma frase: a action descreve os campos num objeto e recebe ou
 * os dados tipados ou a PRIMEIRA mensagem de erro, pronta pra viajar no
 * `?erro=` — na voz do app: diz o que a pessoa deve fazer, nunca diagnostica o
 * que não tem como saber.
 *
 * Três regras de desenho, e o porquê de cada uma:
 *
 *   1. NENHUM parser novo. Dinheiro e número passam por `parseDecimalPtBr` +
 *      `centavosDeReais`, os mesmos que as actions já usavam — um segundo
 *      parser de centavos seria a receita clássica pra "1.850" valer uma coisa
 *      na tela e outra no banco.
 *   2. Campo desconhecido é IGNORADO, não recusado. O validador protege o que
 *      a action vai usar; um POST forjado com campo extra não pode derrubar o
 *      formulário legítimo de quem está do lado de cá.
 *   3. Limites GENEROSOS, pensados pra nunca barrar uso real: R$ 10 milhões
 *      por lançamento, 500 caracteres por texto. Quem esbarra neles não está
 *      usando um formulário — está testando a fechadura.
 */

/** R$ 10.000.000,00 em centavos. Nenhum lançamento legítimo de embarcação
 *  chega perto; acima disso é dedo a mais ou POST forjado. */
export const TETO_DINHEIRO_CENTAVOS = 1_000_000_000

/** Teto padrão de qualquer campo de texto. Descrição, fornecedor e observação
 *  cabem folgados; o que ele barra é o payload gigante indo pro banco. */
export const TETO_TEXTO = 500

interface RegraBase {
  /** Sem valor no formulário: `true` recusa; ausente/`false` devolve null. */
  obrigatorio?: boolean
  /** A mensagem quando o campo falta ou não dá pra entender — na voz do app,
   *  dizendo o que fazer. Só os limites (teto de texto, teto de dinheiro,
   *  min/max de inteiro) têm mensagem própria, montada aqui com o número do
   *  limite dentro. */
  erro?: string
}

export interface RegraTexto extends RegraBase {
  tipo: "texto"
  /** Teto de caracteres deste campo; sem ele vale `TETO_TEXTO`. */
  max?: number
}
export interface RegraOpcao extends RegraBase {
  tipo: "opcao"
  /** A lista fechada — normalmente uma das constantes de domínio
   *  (`CATEGORIAS_FINANCEIRAS`, `FREQUENCIAS`...), nunca uma lista paralela. */
  valores: readonly string[]
}
/** Valor em reais digitado à brasileira ("1.850,00"); sai em CENTAVOS
 *  inteiros, sempre maiores que zero e dentro do teto. */
export interface RegraDinheiro extends RegraBase {
  tipo: "dinheiro"
}
/** Data ISO (AAAA-MM-DD) que existe no calendário — "2026-02-31" passa em
 *  qualquer regex de formato e era recusada só lá no Postgres, com mensagem
 *  genérica; aqui ela morre com a mensagem do campo. */
export interface RegraData extends RegraBase {
  tipo: "data"
}
export interface RegraInteiro extends RegraBase {
  tipo: "inteiro"
  min?: number
  max?: number
}

export type Regra = RegraTexto | RegraOpcao | RegraDinheiro | RegraData | RegraInteiro
export type Esquema = Record<string, Regra>

/** `obrigatorio: true` estreita o tipo: o campo chega garantido; sem a marca,
 *  a action recebe `| null` e decide o padrão (ex.: data ausente = hoje). */
type ComNulo<R extends Regra, V> = R extends { obrigatorio: true } ? V : V | null

/** O tipo de cada campo validado, derivado da regra — opção devolve a UNIÃO
 *  dos valores da lista (não `string`), dinheiro e inteiro devolvem `number`. */
export type ValorValidado<R extends Regra> =
  R extends { tipo: "opcao"; valores: readonly (infer V extends string)[] } ? ComNulo<R, V>
    : R extends { tipo: "dinheiro" | "inteiro" } ? ComNulo<R, number>
      : ComNulo<R, string>

export type DadosValidados<E extends Esquema> = { [K in keyof E]: ValorValidado<E[K]> }

export type ResultadoValidacao<E extends Esquema> =
  | { ok: true; dados: DadosValidados<E> }
  | { ok: false; erro: string }

/** Rede de segurança pra regra sem `erro` — só fala em corrigir e tentar de
 *  novo porque, se ela aparecer, foi o schema que esqueceu a frase. */
const MENSAGEM_PADRAO = "Confira o que você preencheu e tente de novo."

const MENSAGEM_TETO_DINHEIRO = `Esse valor passa de R$ ${(
  TETO_DINHEIRO_CENTAVOS / 100
).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} — confira se digitou certo.`

function mensagemTetoTexto(max: number): string {
  return `Esse texto ficou longo demais — use até ${max} caracteres.`
}

/** AAAA-MM-DD que existe de verdade: o dia tem que caber no mês daquele ano
 *  (fevereiro bissexto incluso). Formato certo com dia impossível é o buraco
 *  clássico do regex sozinho. */
function dataDeCalendario(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const [ano, mes, dia] = v.split("-").map(Number)
  if (mes < 1 || mes > 12 || dia < 1) return false
  // `Date.UTC(ano, mes, 0)` é o último dia do próprio `mes` (o dia zero do
  // mês seguinte) — a mesma manobra de `somarMeses` em lib/domain/financeiro.
  return dia <= new Date(Date.UTC(ano, mes, 0)).getUTCDate()
}

type ValorOuErro = { ok: true; valor: string | number } | { ok: false; erro: string }

/** Um campo PRESENTE contra a sua regra. Ausência já foi tratada por quem
 *  chama — aqui só se decide se o que veio presta. */
function validarPresente(texto: string, regra: Regra): ValorOuErro {
  const erro = regra.erro ?? MENSAGEM_PADRAO
  switch (regra.tipo) {
    case "texto": {
      const max = regra.max ?? TETO_TEXTO
      if (texto.length > max) return { ok: false, erro: mensagemTetoTexto(max) }
      return { ok: true, valor: texto }
    }
    case "opcao":
      return regra.valores.includes(texto) ? { ok: true, valor: texto } : { ok: false, erro }
    case "dinheiro": {
      // O caminho oficial do dinheiro no app, na ordem oficial: string pt-BR
      // vira reais, reais viram centavos inteiros. Negativo já morre em
      // `centavosDeReais` (vira null); zero morre aqui.
      const centavos = centavosDeReais(parseDecimalPtBr(texto))
      if (centavos == null || centavos <= 0) return { ok: false, erro }
      if (centavos > TETO_DINHEIRO_CENTAVOS) return { ok: false, erro: MENSAGEM_TETO_DINHEIRO }
      return { ok: true, valor: centavos }
    }
    case "data":
      return dataDeCalendario(texto) ? { ok: true, valor: texto } : { ok: false, erro }
    case "inteiro": {
      const n = parseDecimalPtBr(texto)
      if (n == null || !Number.isInteger(n)) return { ok: false, erro }
      if (regra.min != null && n < regra.min) return { ok: false, erro: `Use um número a partir de ${regra.min}.` }
      if (regra.max != null && n > regra.max) return { ok: false, erro: `Use um número até ${regra.max}.` }
      return { ok: true, valor: n }
    }
  }
}

/**
 * Valida um `FormData` contra um schema e devolve ou os dados tipados ou a
 * primeira mensagem de erro (na ordem em que o schema declara os campos — a
 * mesma ordem em que a tela os mostra, então a pessoa corrige de cima pra
 * baixo, um de cada vez, como o app sempre fez).
 *
 * `<const E>` preserva os literais do schema escrito inline: é o que faz
 * `dados.tipo` sair como `"despesa" | "entrada"` em vez de `string`.
 */
export function validar<const E extends Esquema>(formData: FormData, esquema: E): ResultadoValidacao<E> {
  const dados: Record<string, string | number | null> = {}
  for (const [campo, regra] of Object.entries(esquema)) {
    const bruto = formData.get(campo)
    // File numa chave de texto conta como ausente: nenhum destes campos aceita
    // arquivo, e "[object File]" gravado no banco seria pior que a recusa.
    const texto = typeof bruto === "string" ? bruto.trim() : ""
    if (texto === "") {
      if (regra.obrigatorio) return { ok: false, erro: regra.erro ?? MENSAGEM_PADRAO }
      dados[campo] = null
      continue
    }
    const r = validarPresente(texto, regra)
    if (!r.ok) return r
    dados[campo] = r.valor
  }
  return { ok: true, dados: dados as DadosValidados<E> }
}
