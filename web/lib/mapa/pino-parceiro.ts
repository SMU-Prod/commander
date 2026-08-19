import type { NomeIcone } from "@/components/icone"
import type { CategoriaParceiro, Parceiro } from "@/lib/db/types"

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
  // Onda 41 (PRD §52/§60): as duas categorias que faltavam pra fechar a
  // lista do Explorar. Loja náutica herda "ferramenta" (é onde se compra
  // peça) e "outros" fica com o pino genérico de embarcação.
  loja_nautica: "ferramenta",
  outros: "embarcacao",
  // Onda 51 (PRD §13.1): o tipo Prestador de Serviço. Mesma "ferramenta" da
  // Loja — os dois são o negócio de serviço/peça, e a paleta é curada
  // (ICONES_PARCEIRO acima), não infinita. O mesmo mapa está no `case` de
  // `parceiro_icone_cor_padrao()` na migration 052.
  prestador: "ferramenta",
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

/** Traçados dos ícones do PAINEL DO PARCEIRO — cópia estática dos mesmos
 *  <path> de components/icone.tsx (onda 10, Pedido 2: cada parceiro escolhe
 *  o próprio ícone/cor). Extraído de web/components/mapa/navegar-mapa.tsx
 *  (onda 39) pra ser reaproveitado também por ExplorarMapa — os marcadores
 *  do Mapbox são DOM puro via innerHTML, não React, então isto NÃO pode ir
 *  por <Icone>. Fonte única agora: qualquer tela que desenhe pino de
 *  parceiro usa `criarElementoMarcadorParceiro` abaixo, nunca copia o mapa
 *  de novo. */
const TRACADO_ICONE_PARCEIRO: Record<NomeIconeParceiro, string> = {
  ancora: '<circle cx="12" cy="5" r="2"/><path d="M12 7v13M5 13a7 7 0 0 0 14 0M8 10H5m14 0h-3"/>',
  oleo: '<path d="M12 3s6 6.5 6 10.5A6 6 0 0 1 6 13.5C6 9.5 12 3 12 3z"/>',
  inicio: '<path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1v-8z"/>',
  estrela: '<path d="m12 4 2.4 5 5.6.8-4 3.9 1 5.5-5-2.7-5 2.7 1-5.5-4-3.9L9.6 9z"/>',
  embarcacao: '<path d="M3 15h18l-3 5H6l-3-5zM6 15V9h12v6M12 9V4"/>',
  ferramenta: '<path d="M15 3a5 5 0 0 0-4.6 7L3 17.4 6.6 21l7.4-7.4A5 5 0 1 0 15 3z"/>',
  escudo: '<path d="M12 3l7 3v6c0 4-3 7.5-7 9-4-1.5-7-5-7-9V6z"/>',
  pessoas: '<circle cx="9" cy="8" r="3"/><path d="M3 19c0-3 2.7-5 6-5s6 2 6 5"/><circle cx="17" cy="9" r="2.4"/><path d="M15.6 15c2.5.3 4.4 2.2 4.4 4.6"/>',
}

/** Elemento DOM do pino de um parceiro no mapa — fundo/ícone são a cor/ícone
 *  que o PRÓPRIO parceiro escolheu, nunca mais fixos por categoria. Ícone
 *  sempre branco (contraste com qualquer cor da paleta curada) + anel branco
 *  opaco; plano "destaque" troca o anel pro dourado da marca e sobe de
 *  camada; "tem_poita" ganha um ponto dourado no canto. Usado por
 *  NavegarMapa (trilha/rota/instrumentos) e por ExplorarMapa (só descoberta,
 *  onda 39) — mesmo desenho de pino nas duas telas, sem duplicar. */
export function criarElementoMarcadorParceiro(p: Parceiro): HTMLDivElement {
  const destaque = p.plano === "destaque"
  const el = document.createElement("div")
  el.style.cursor = "pointer"
  el.style.zIndex = destaque ? "10" : "1"

  // Onda 89 (achado 4.1) — o anel de "destaque" e o ponto de poita são
  // MARCA, e marca sai de token: aqui o elemento é DOM (não canvas WebGL),
  // então a classe utilitária resolve sozinha nos dois temas, sem precisar
  // do leitor de `lib/mapa/cores-tema.ts`.
  const corpo = document.createElement("div")
  corpo.className = destaque
    ? "relative flex size-9 items-center justify-center rounded-full ring-2 ring-accent"
    : "relative flex size-9 items-center justify-center rounded-full ring-2 ring-white"
  corpo.style.backgroundColor = p.cor
  const tracado = TRACADO_ICONE_PARCEIRO[p.icone] ?? TRACADO_ICONE_PARCEIRO[ICONE_FALLBACK]
  corpo.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${tracado}</svg>`
  el.appendChild(corpo)

  if (p.tem_poita) {
    const ponto = document.createElement("span")
    ponto.className = "absolute -right-0.5 -top-0.5 block size-2.5 rounded-full bg-accent ring-2 ring-meter"
    corpo.appendChild(ponto)
  }
  return el
}
