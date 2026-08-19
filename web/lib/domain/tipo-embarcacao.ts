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

/** Espelha o enum `tipo_embarcacao` do banco (migrations 056 e 060). */
export type TipoEmbarcacao = "lancha" | "veleiro" | "iate" | "bote" | "jet"

/**
 * Ordem de exibição: a do canvas tela-3j, chip por chip — e "Jet Ski" no
 * fim (onda 70).
 *
 * O Jet entrou pelo PRD Upgrade 3 §5, que pede uma ficha PRÓPRIA de PWC. O
 * §1 do mesmo PRD é explícito sobre por quê: *"A interface se adapta ao tipo
 * de embarcação. Jet Ski não recebe uma interface de lancha apenas
 * reduzida."* Sem valor no enum, não havia como uma tela perguntar "isto é
 * um Jet?" — e é essa pergunta que `ehJet` (patio.ts) responde.
 */
export const TIPOS_EMBARCACAO = [
  "lancha",
  "veleiro",
  "iate",
  "bote",
  "jet",
] as const satisfies readonly TipoEmbarcacao[]

/** Rótulos do canvas, palavra por palavra. "Jet Ski" e não "PWC": é como o
 *  dono e o pátio chamam, e o app fala a língua de quem usa. */
export const ROTULO_TIPO_EMBARCACAO: Record<TipoEmbarcacao, string> = {
  lancha: "Lancha",
  veleiro: "Veleiro",
  iate: "Iate",
  bote: "Bote",
  jet: "Jet Ski",
}

/** Valida o que veio de formulário — §27.2, a regra nos dois lados: o
 *  banco recusa valor fora do enum, e o servidor confere ANTES pra falha
 *  de forma nunca virar erro de banco na tela. Valor estranho não derruba
 *  o cadastro: o campo é opcional, então ele simplesmente não é gravado. */
export function ehTipoEmbarcacao(v: unknown): v is TipoEmbarcacao {
  return typeof v === "string" && (TIPOS_EMBARCACAO as readonly string[]).includes(v)
}
