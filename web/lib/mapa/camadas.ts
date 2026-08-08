/** As 3 camadas opcionais do mapa náutico (pedido do Pedro: "tem a opção de
 *  tirar infos") — cada uma controlável, com a escolha persistida por
 *  navegante em `localStorage` (configura uma vez, vale pra sempre). */
export type ChaveCamada = "balizamento" | "profundidade" | "parceiros"
export type EstadoCamadas = Record<ChaveCamada, boolean>

const CHAVE_STORAGE = "commander:camadas-mapa"

/** Balizamento (OpenSeaMap) e Parceiros (pinos) ligados por padrão — é o que
 *  o app sempre mostrou. Profundidade nasce DESLIGADA de propósito: é uma
 *  camada aproximada (~450 m de resolução), ligar é escolha consciente do
 *  navegante, não um default silencioso. */
export const CAMADAS_PADRAO: EstadoCamadas = {
  balizamento: true,
  profundidade: false,
  parceiros: true,
}

function ehBooleano(v: unknown): v is boolean {
  return typeof v === "boolean"
}

/** Lê o estado salvo, mesclado com os padrões — uma chave ausente ou
 *  corrompida cai pro padrão SÓ dela, nunca derruba as outras duas. Sem
 *  `localStorage` (SSR, ou o módulo carregado fora do navegador) devolve os
 *  padrões direto, sem lançar. */
export function carregarCamadas(): EstadoCamadas {
  if (typeof localStorage === "undefined") return { ...CAMADAS_PADRAO }
  try {
    const bruto = localStorage.getItem(CHAVE_STORAGE)
    if (!bruto) return { ...CAMADAS_PADRAO }
    const salvo = JSON.parse(bruto) as Partial<Record<ChaveCamada, unknown>>
    return {
      balizamento: ehBooleano(salvo.balizamento) ? salvo.balizamento : CAMADAS_PADRAO.balizamento,
      profundidade: ehBooleano(salvo.profundidade) ? salvo.profundidade : CAMADAS_PADRAO.profundidade,
      parceiros: ehBooleano(salvo.parceiros) ? salvo.parceiros : CAMADAS_PADRAO.parceiros,
    }
  } catch {
    // JSON corrompido (ou getItem falhando em modo privado/quota) — padrões
    // são uma resposta válida, não um erro que precise subir.
    return { ...CAMADAS_PADRAO }
  }
}

/** Persiste o estado completo das 3 chaves de uma vez (mesmo padrão de
 *  `fundear`/`desarmarAncora` em navegar-mapa.tsx: falha de storage é
 *  engolida — perder a persistência da preferência não pode quebrar o
 *  toggle em si, que já aconteceu na tela antes desta chamada). */
export function salvarCamadas(camadas: EstadoCamadas): void {
  if (typeof localStorage === "undefined") return
  try {
    localStorage.setItem(CHAVE_STORAGE, JSON.stringify(camadas))
  } catch {}
}
