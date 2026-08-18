/**
 * TIPO DA EMBARCAÇÃO (onda 62) — o vocabulário do enum `tipo_embarcacao`.
 * Canvas `docs/design-mobile/tela-3j.html` ("Onboarding — cadastrar
 * embarcação"): os chips do passo "Qual é a sua embarcação?" são Lancha,
 * Veleiro, Iate e Bote — estes quatro, nesta ordem, e mais nenhum.
 *
 * Mesmo papel de `mapa-embarcacao.ts` pra zona: espelha o enum do banco
 * (migration 056) valor por valor e é a fonte única de lista, ordem e
 * rótulo — nenhuma tela escreve esses nomes à mão.
 *
 * O tipo é OPCIONAL em toda parte (só o nome do barco é obrigatório no
 * onboarding) e também é o seletor do modelo 3D padrão do Mapa da
 * Embarcação de uma onda futura — decisão do dono: "modelo padrão baseado
 * na escolha do barco". Por isso enum fechado, não texto livre.
 *
 * Regra pura, como a casa manda: nada aqui consulta banco, sessão ou
 * relógio.
 */

/** Espelha o enum `tipo_embarcacao` do banco (migration 056). */
export type TipoEmbarcacao = "lancha" | "veleiro" | "iate" | "bote"

/** Ordem de exibição: a do canvas tela-3j, chip por chip. */
export const TIPOS_EMBARCACAO = [
  "lancha",
  "veleiro",
  "iate",
  "bote",
] as const satisfies readonly TipoEmbarcacao[]

/** Rótulos do canvas, palavra por palavra. */
export const ROTULO_TIPO_EMBARCACAO: Record<TipoEmbarcacao, string> = {
  lancha: "Lancha",
  veleiro: "Veleiro",
  iate: "Iate",
  bote: "Bote",
}

/** Valida o que veio de formulário — §27.2, a regra nos dois lados: o
 *  banco recusa valor fora do enum, e o servidor confere ANTES pra falha
 *  de forma nunca virar erro de banco na tela. Valor estranho não derruba
 *  o cadastro: o campo é opcional, então ele simplesmente não é gravado. */
export function ehTipoEmbarcacao(v: unknown): v is TipoEmbarcacao {
  return typeof v === "string" && (TIPOS_EMBARCACAO as readonly string[]).includes(v)
}
