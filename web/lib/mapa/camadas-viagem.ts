import type { Map as MapaMapbox } from "mapbox-gl"
import type { CoresMapa } from "@/lib/mapa/cores-tema"

/**
 * ONDA 89 (achado 4.1) — as quatro camadas da VIAGEM (pernas com caminho,
 * pernas sem caminho, círculos das paradas, números das paradas), num lugar
 * só.
 *
 * `PlanejarViagemMapa` e `VerViagemMapa` desenhavam exatamente as mesmas
 * quatro camadas, com os mesmos ids e o mesmo `paint`, em dois blocos
 * copiados — as únicas diferenças entre eles eram a CAIXA do hexadecimal do
 * navy. Como a cor agora vem de token e precisa ser REPINTADA na troca de
 * tema (canvas WebGL não lê var(); ver lib/mapa/cores-tema.ts), manter as
 * duas cópias significaria manter duas repinturas — e é assim que uma delas
 * fica pra trás.
 *
 * `criar` é idempotente (checa a source antes) e `pintar` é seguro em
 * qualquer momento (checa a camada antes): dá pra chamar as duas no mesmo
 * efeito, na ordem, sem saber em que estado o mapa está.
 */

const FONTE_PERNAS_OK = "viagem-pernas-ok"
const FONTE_PERNAS_SEM_CAMINHO = "viagem-pernas-sem-caminho"
const FONTE_PARADAS = "viagem-paradas"

export const CAMADA_PERNAS_OK = "viagem-pernas-ok-linha"
export const CAMADA_PERNAS_SEM_CAMINHO = "viagem-pernas-sem-caminho-linha"
export const CAMADA_PARADAS_CIRCULOS = "viagem-paradas-circulos"
export const CAMADA_PARADAS_NUMEROS = "viagem-paradas-numeros"

function colecaoVazia() {
  return { type: "FeatureCollection" as const, features: [] as unknown[] }
}

/** Cria as quatro camadas se ainda não existirem. Chamar de novo não faz
 *  nada — é o mesmo guardião por `getSource` que os dois componentes já
 *  usavam. */
export function criarCamadasViagem(mapa: MapaMapbox, cores: CoresMapa): void {
  if (!mapa.getSource(FONTE_PERNAS_OK)) {
    mapa.addSource(FONTE_PERNAS_OK, { type: "geojson", data: colecaoVazia() })
    mapa.addLayer({
      id: CAMADA_PERNAS_OK,
      type: "line",
      source: FONTE_PERNAS_OK,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": cores.acao, "line-width": 3 },
    })
  }
  if (!mapa.getSource(FONTE_PERNAS_SEM_CAMINHO)) {
    mapa.addSource(FONTE_PERNAS_SEM_CAMINHO, { type: "geojson", data: colecaoVazia() })
    mapa.addLayer({
      id: CAMADA_PERNAS_SEM_CAMINHO,
      type: "line",
      source: FONTE_PERNAS_SEM_CAMINHO,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": cores.crit, "line-width": 2.5, "line-dasharray": [1.5, 1.5] },
    })
  }
  if (!mapa.getSource(FONTE_PARADAS)) {
    mapa.addSource(FONTE_PARADAS, { type: "geojson", data: colecaoVazia() })
    mapa.addLayer({
      id: CAMADA_PARADAS_CIRCULOS,
      type: "circle",
      source: FONTE_PARADAS,
      paint: {
        "circle-radius": 9,
        "circle-color": cores.acao,
        "circle-stroke-width": 2,
        "circle-stroke-color": cores.acaoTexto,
      },
    })
    mapa.addLayer({
      id: CAMADA_PARADAS_NUMEROS,
      type: "symbol",
      source: FONTE_PARADAS,
      layout: {
        "text-field": ["get", "rotulo"],
        "text-size": 11,
        "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"],
      },
      // O número fica DENTRO do círculo da marca — por isso o par de
      // contraste da ação, e não o texto do tema (que no escuro é quase
      // branco e sumiria sobre o limão).
      paint: { "text-color": cores.acaoTexto },
    })
  }
}

/** Repinta as quatro camadas com os tokens atuais. É o que faz a troca de
 *  tema chegar no canvas — o DOM se repinta sozinho, o WebGL não. */
export function pintarCamadasViagem(mapa: MapaMapbox, cores: CoresMapa): void {
  if (mapa.getLayer(CAMADA_PERNAS_OK)) {
    mapa.setPaintProperty(CAMADA_PERNAS_OK, "line-color", cores.acao)
  }
  if (mapa.getLayer(CAMADA_PERNAS_SEM_CAMINHO)) {
    mapa.setPaintProperty(CAMADA_PERNAS_SEM_CAMINHO, "line-color", cores.crit)
  }
  if (mapa.getLayer(CAMADA_PARADAS_CIRCULOS)) {
    mapa.setPaintProperty(CAMADA_PARADAS_CIRCULOS, "circle-color", cores.acao)
    mapa.setPaintProperty(CAMADA_PARADAS_CIRCULOS, "circle-stroke-color", cores.acaoTexto)
  }
  if (mapa.getLayer(CAMADA_PARADAS_NUMEROS)) {
    mapa.setPaintProperty(CAMADA_PARADAS_NUMEROS, "text-color", cores.acaoTexto)
  }
}
