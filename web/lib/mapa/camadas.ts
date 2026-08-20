/** As camadas opcionais do mapa náutico (pedido do Pedro: "tem a opção de
 *  tirar infos") — cada uma controlável, com a escolha persistida por
 *  navegante em `localStorage` (configura uma vez, vale pra sempre).
 *  "sondagens" entrou na auditoria 360 de 20/08/2026 (recomendação nº 3):
 *  as profundidades medidas por outros barcos (agregado por célula, ver
 *  migration 025) finalmente voltam pra tela — ver
 *  components/mapa/camada-sondagens.ts. */
export type ChaveCamada = "balizamento" | "profundidade" | "parceiros" | "sondagens"

/** Estilo do mapa (onda 10, pedido do dono comparando com o Navionics):
 *  "nautico" é o `mapbox://styles/mapbox/standard` com tema faded de sempre;
 *  "satelite" é imagem de satélite com rótulos; "relevo3d" é o MESMO estilo
 *  satélite, com terreno (`setTerrain`) e câmera inclinada por cima — não é
 *  um 4º basemap, é satélite "com relevo ligado". Ver mapa-nautico.tsx. */
export type EstiloMapa = "nautico" | "satelite" | "relevo3d"
export const ESTILOS_MAPA: EstiloMapa[] = ["nautico", "satelite", "relevo3d"]

export type EstadoCamadas = Record<ChaveCamada, boolean> & { estilo: EstiloMapa }

const CHAVE_STORAGE = "commander:camadas-mapa"

/** Balizamento (OpenSeaMap) e Parceiros (pinos) ligados por padrão — é o que
 *  o app sempre mostrou. Profundidade nasce DESLIGADA de propósito: é uma
 *  camada aproximada (~450 m de resolução), ligar é escolha consciente do
 *  navegante, não um default silencioso. Sondagens da comunidade nasce
 *  DESLIGADA pelo mesmo motivo, com um agravante: é dado COLABORATIVO, sem
 *  verificação oficial nenhuma — ligar tem que ser decisão de quem entendeu
 *  o aviso do painel, nunca um default. Estilo nasce "nautico" — o
 *  instrumento de bordo de sempre, satélite/relevo são escolha explícita. */
export const CAMADAS_PADRAO: EstadoCamadas = {
  balizamento: true,
  profundidade: false,
  parceiros: true,
  sondagens: false,
  estilo: "nautico",
}

function ehBooleano(v: unknown): v is boolean {
  return typeof v === "boolean"
}

function ehEstiloValido(v: unknown): v is EstiloMapa {
  return typeof v === "string" && (ESTILOS_MAPA as string[]).includes(v)
}

/** Lê o estado salvo, mesclado com os padrões — uma chave ausente ou
 *  corrompida cai pro padrão SÓ dela, nunca derruba as outras. Sem
 *  `localStorage` (SSR, ou o módulo carregado fora do navegador) devolve os
 *  padrões direto, sem lançar. */
export function carregarCamadas(): EstadoCamadas {
  if (typeof localStorage === "undefined") return { ...CAMADAS_PADRAO }
  try {
    const bruto = localStorage.getItem(CHAVE_STORAGE)
    if (!bruto) return { ...CAMADAS_PADRAO }
    const salvo = JSON.parse(bruto) as Partial<Record<ChaveCamada, unknown>> & { estilo?: unknown }
    return {
      balizamento: ehBooleano(salvo.balizamento) ? salvo.balizamento : CAMADAS_PADRAO.balizamento,
      profundidade: ehBooleano(salvo.profundidade) ? salvo.profundidade : CAMADAS_PADRAO.profundidade,
      parceiros: ehBooleano(salvo.parceiros) ? salvo.parceiros : CAMADAS_PADRAO.parceiros,
      sondagens: ehBooleano(salvo.sondagens) ? salvo.sondagens : CAMADAS_PADRAO.sondagens,
      estilo: ehEstiloValido(salvo.estilo) ? salvo.estilo : CAMADAS_PADRAO.estilo,
    }
  } catch {
    // JSON corrompido (ou getItem falhando em modo privado/quota) — padrões
    // são uma resposta válida, não um erro que precise subir.
    return { ...CAMADAS_PADRAO }
  }
}

/** Persiste o estado completo das 4 chaves de uma vez (mesmo padrão de
 *  `fundear`/`desarmarAncora` em navegar-mapa.tsx: falha de storage é
 *  engolida — perder a persistência da preferência não pode quebrar o
 *  toggle em si, que já aconteceu na tela antes desta chamada). */
export function salvarCamadas(camadas: EstadoCamadas): void {
  if (typeof localStorage === "undefined") return
  try {
    localStorage.setItem(CHAVE_STORAGE, JSON.stringify(camadas))
  } catch {}
}
