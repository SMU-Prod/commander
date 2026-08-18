import { haversineNm } from "@/lib/domain/geo"
import { ROTULO_TIPO_PARTNER, type TipoPartner } from "@/lib/domain/partner"

/**
 * EXPLORAR — a folha de "mais próximos" do mapa (canvas tela-3h, onda 62).
 *
 * O canvas é "metade carta, metade lista": embaixo do mapa vive uma folha com
 * os parceiros mais próximos e a distância "sempre em MN, sempre em mono".
 * A conta mora aqui, pura e testável — a tela só pergunta "quais são os N
 * mais próximos deste centro?" e desenha a resposta.
 *
 * Reusa `haversineNm` de geo.ts (a MESMA milha náutica da trilha e da rota) —
 * uma segunda fórmula de distância seria uma segunda verdade.
 */

export interface PontoGeografico {
  lat: number
  lng: number
}

/** "0,4 MN", "11,8 MN" — vírgula de pt-BR, uma casa decimal (mais que isso é
 *  falsa precisão numa distância de haversine), e a unidade que o canvas
 *  fixou: MN, milha náutica em português. Acima de 100 a casa decimal deixa
 *  de informar e vira ruído — sai. */
export function formatarMN(nm: number): string {
  if (!Number.isFinite(nm) || nm < 0) return "— MN"
  if (nm >= 100) return `${Math.round(nm)} MN`
  return `${nm.toFixed(1).replace(".", ",")} MN`
}

/**
 * Os `n` pontos mais próximos do centro, cada um com a distância já
 * calculada. Não muta a lista de entrada; empate de distância preserva a
 * ordem original (sort estável) — determinístico entre renderizações.
 */
export function maisProximos<T extends PontoGeografico>(
  pontos: readonly T[],
  centro: PontoGeografico,
  n: number,
): (T & { distanciaNm: number })[] {
  return pontos
    .map((p) => ({
      ...p,
      distanciaNm: haversineNm({ la: centro.lat, lo: centro.lng }, { la: p.lat, lo: p.lng }),
    }))
    .sort((a, b) => a.distanciaNm - b.distanciaNm)
    .slice(0, Math.max(0, n))
}

// ===========================================================================
// A busca do Explorar (canvas tela-3h, onda 62 — aprovada pelo dono)
// ===========================================================================

/** O que a busca enxerga de um parceiro. Nome e categoria — e SÓ isso, de
 *  propósito: `Parceiro` não tem campo de cidade/bairro (a "Angra dos Reis"
 *  do canvas é maquete), e `regiao_id` é um id de taxonomia que a tela do
 *  mapa nem carrega. Buscar em campo que não existe seria fingir alcance. */
export interface ParceiroBuscavel {
  nome: string
  categoria: TipoPartner
}

/** minúsculas e sem acento, dos DOIS lados da comparação — "Verolme" acha
 *  "verolme", "nautica" acha "Náutica" e vice-versa. */
function normalizarBusca(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
}

/**
 * Filtro CLIENT-SIDE sobre a lista que a tela já tem na memória — zero
 * consulta nova: o dado inteiro já desceu pro mapa, procurar nele no banco
 * seria pagar de novo pelo que já chegou.
 *
 * Casa contra o nome e contra o RÓTULO do tipo (`ROTULO_TIPO_PARTNER`, a
 * mesma fonte única dos chips) — quem digita "posto" merece achar o Posto
 * Náutico mesmo sem saber que por dentro a categoria chama `posto`. Termo
 * com mais de uma palavra exige todas, em qualquer ordem ("verolme marina"
 * acha a Marina Verolme). Termo vazio devolve a lista inteira: busca limpa
 * não é filtro.
 */
export function filtrarParceiros<T extends ParceiroBuscavel>(lista: readonly T[], termo: string): T[] {
  const palavras = normalizarBusca(termo).split(/\s+/).filter((p) => p !== "")
  if (palavras.length === 0) return [...lista]
  return lista.filter((p) => {
    const alvo = normalizarBusca(`${p.nome} ${ROTULO_TIPO_PARTNER[p.categoria]}`)
    return palavras.every((palavra) => alvo.includes(palavra))
  })
}
