import type { NomeIcone } from "@/components/icone"
import type { CategoriaParceiro } from "@/lib/db/types"

/** Ícone e cor do pino do parceiro (onda 10, Pedido 2 — "o parceiro escolhe
 *  o ícone e a cor do próprio pino"). Fonte única da verdade do lado do app
 *  — a migration `supabase/migrations/024_parceiro_icone_cor.sql` espelha os
 *  mesmos valores num CHECK constraint (Postgres não importa TS: qualquer
 *  mudança aqui precisa da mudança equivalente lá, os dois lados citam um ao
 *  outro no comentário). */

export type NomeIconeParceiro = "ancora" | "oleo" | "inicio" | "estrela" | "embarcacao" | "ferramenta" | "escudo" | "pessoas"
// Garantia em tempo de compilação de que todo NomeIconeParceiro é mesmo um
// ícone real de components/icone.tsx — se um dia renomearem/removerem um
// desses lá, esta linha para de compilar em vez de deixar o pino quebrado
// silenciosamente em runtime.
type _TodosExistemEmIcone = NomeIconeParceiro extends NomeIcone ? true : never
const _assert: _TodosExistemEmIcone = true
void _assert

export interface OpcaoIconeParceiro {
  valor: NomeIconeParceiro
  rotulo: string
}

/** Subconjunto dos 28 ícones de components/icone.tsx que faz sentido pra UM
 *  ESTABELECIMENTO no mapa — fora ícones de ação/navegação da UI do app
 *  (chevron, voltar, mais, menu, relogio…) e os puramente decorativos sem
 *  leitura óbvia num pino pequeno (raio, bateria, cifrao…). Cobre os 4 usos
 *  de sempre (marina/posto/pousada/restaurante, ver ICONE_PADRAO_POR_CATEGORIA)
 *  mais opções pra quem quer fugir do óbvio (embarcação, serviço, segurança,
 *  recepção). */
export const ICONES_PARCEIRO: OpcaoIconeParceiro[] = [
  { valor: "ancora", rotulo: "Âncora" },
  { valor: "oleo", rotulo: "Combustível" },
  { valor: "inicio", rotulo: "Pousada" },
  { valor: "estrela", rotulo: "Restaurante" },
  { valor: "embarcacao", rotulo: "Embarcação" },
  { valor: "ferramenta", rotulo: "Serviços" },
  { valor: "escudo", rotulo: "Segurança" },
  { valor: "pessoas", rotulo: "Recepção" },
]

const ICONES_VALIDOS = new Set<string>(ICONES_PARCEIRO.map((i) => i.valor))

export function ehIconeParceiroValido(v: unknown): v is NomeIconeParceiro {
  return typeof v === "string" && ICONES_VALIDOS.has(v)
}

/** Ícone que cada categoria já usava ANTES desta task (era fixo, derivado só
 *  da categoria — TRACADO_ICONE em navegar-mapa.tsx). Vira o default de
 *  quem ainda não escolheu nada, tanto no formulário (novo cadastro) quanto
 *  no backfill da migration (parceiros existentes não mudam de ícone). */
export const ICONE_PADRAO_POR_CATEGORIA: Record<CategoriaParceiro, NomeIconeParceiro> = {
  marina: "ancora",
  posto: "oleo",
  pousada: "inicio",
  restaurante: "estrela",
}

export interface OpcaoCorParceiro {
  valor: string
  rotulo: string
}

/** Paleta CURADA — não é um color picker livre. Uma paleta aberta destruiria
 *  a identidade navy/dourado da marca e alguns tons somem de vista sobre
 *  água/imagem de satélite. Cada cor foi escolhida por:
 *
 *  1) contraste — escura/saturada o bastante pra manter o ícone branco (ver
 *     `web/components/mapa/navegar-mapa.tsx`) e o anel branco de destaque
 *     legíveis por cima, em qualquer estilo de mapa (náutico, satélite);
 *  2) não repetir as cores semânticas do design system — ok (verde
 *     #2fd07a/#15803d), warn (âmbar #ffb020/#b45309), crit (vermelho
 *     #ff5c5c/#d2373c, também a cor do alarme de âncora e do MOB) — um pino
 *     de parceiro nunca pode parecer um status do próprio app;
 *  3) as duas primeiras SÃO a marca — Navy e Dourado —, então quem não mexe
 *     em nada continua com o visual de sempre (Navy é o valor padrão). */
export const CORES_PARCEIRO: OpcaoCorParceiro[] = [
  { valor: "#0b1d2d", rotulo: "Navy" },
  { valor: "#d4af37", rotulo: "Dourado" },
  { valor: "#7a1f3d", rotulo: "Bordô" },
  { valor: "#0f5c4a", rotulo: "Verde-petróleo" },
  { valor: "#4b3f72", rotulo: "Roxo-ardósia" },
  { valor: "#8a4b2c", rotulo: "Terracota" },
]

const CORES_VALIDAS = new Set<string>(CORES_PARCEIRO.map((c) => c.valor))

export function ehCorParceiroValida(v: unknown): v is string {
  return typeof v === "string" && CORES_VALIDAS.has(v)
}

export const COR_PADRAO = CORES_PARCEIRO[0].valor // "#0b1d2d" — Navy, o visual de sempre

/** Ícone de fallback pra registro que por algum motivo (corrida de dados,
 *  cliente antigo em cache) chegue com um `icone` fora da paleta — nunca
 *  deixa o pino sem desenhar. */
export const ICONE_FALLBACK: NomeIconeParceiro = "ancora"
