import type { NomeIcone } from "@/components/icone"

/** Onda 15 ("motor vivo") — sistemas do equipamento (Arrefecimento,
 *  Injeção, Elétrica do motor, Transmissão...), cada um podendo apontar
 *  pra página certa do manual do fabricante no acervo. Ver
 *  `web/app/(app)/barco/equipamento/[id]/page.tsx` e
 *  `web/lib/acoes/sistemas.ts`. */

export interface SistemaOrdenavel {
  ordem: number
  nome: string
}

/** Ordena os sistemas de um equipamento pela posição gravada; nome como
 *  desempate (dois sistemas na mesma posição não devem trocar de lugar à
 *  toa entre renderizações). */
export function ordenarSistemas<T extends SistemaOrdenavel>(sistemas: T[]): T[] {
  return [...sistemas].sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR"))
}

/** Posição do próximo sistema cadastrado — vai pro fim da lista existente.
 *  Só precisa da `ordem` (ao contrário de `ordenarSistemas`, não desempata
 *  por nome), por isso pede menos campos que `SistemaOrdenavel`. */
export function proximaOrdemSistema(sistemas: { ordem: number }[]): number {
  return sistemas.reduce((max, s) => Math.max(max, s.ordem), -1) + 1
}

/** Ícone de `components/icone.tsx` que melhor representa o nome do sistema.
 *  O nome é texto livre — pedido do Pedro é que o dono cadastre o sistema
 *  do jeito que ele conhece ("Arrefecimento", "Injeção Diesel"...), então a
 *  escolha do ícone é por palavra-chave, nunca por um enum fechado. Sem
 *  palavra-chave reconhecida, cai no ícone genérico do próprio motor —
 *  nunca um placeholder sem sentido. */
export function iconeDoSistema(nome: string): NomeIcone {
  const n = nome.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()
  if (/eletric|alternador|bateria/.test(n)) return "raio"
  if (/arrefec|refriger|inje[cç]|combust|oleo|lubrific/.test(n)) return "oleo"
  if (/transmiss|cambio|redutor|eixo/.test(n)) return "ferramenta"
  return "motor"
}

/** URL assinada do manual apontando pra página certa via fragmento
 *  `#page=N` — funciona no visor de PDF nativo do navegador (Chrome,
 *  Safari, Edge). Sem página informada, devolve a URL como veio. Caveat
 *  honesto do shell nativo (Capacitor/WebView Android não renderiza PDF,
 *  então o fragmento pode se perder no visor externo) mora em
 *  `web/components/dica-leitor-nativo.tsx`, não aqui — esta função só
 *  monta a URL, não sabe onde ela vai abrir. */
export function urlManualNaPagina(urlAssinado: string, pagina: number | null): string {
  return pagina != null && pagina > 0 ? `${urlAssinado}#page=${pagina}` : urlAssinado
}
