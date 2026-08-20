"use client"
import { useEffect, useRef } from "react"
import type { GeoJSONSource, Map as MapaMapbox } from "mapbox-gl"
import type { CoresMapa } from "@/lib/mapa/cores-tema"
import {
  buscarSondagens,
  celulasParaGeoJSON,
  colecaoSondagensVazia,
  expressaoCorSondagem,
  type CelulaSondagemMapa,
} from "@/lib/mapa/sondagens"

/**
 * Camada "Sondagens da comunidade" (auditoria 360 de 20/08/2026,
 * recomendação nº 3) — o lado Mapbox do fechamento do loop coleta→mapa: um
 * círculo por célula de 15 m, colorido pela profundidade MEDIANA que outros
 * barcos mediram ali (agregado anônimo da migration 025, via
 * `/api/sondagens` — nunca a tabela bruta).
 *
 * MORA EM ARQUIVO PRÓPRIO de propósito: `navegar-mapa.tsx` já passa de
 * 135 KB e a mesma auditoria manda EXTRAIR módulos, não engordar — este hook
 * segue a divisão de `usar-pernas-viagem.ts`/`usar-cores-mapa.ts` (lógica
 * pura em `lib/mapa/sondagens.ts`, interface com o mapa aqui) e entra no
 * componente com uma linha só.
 *
 * O CICLO DO `setStyle()`: trocar Náutico ⇄ Satélite destrói toda camada
 * customizada. Quem avisa é o contador `versaoEstilo` de navegar-mapa (sobe
 * a cada "style.load") — ele entra nas dependências do efeito de criação
 * abaixo, que recria source+camada E re-hidrata o dado do cache local
 * (`celulasRef`), sem refazer a consulta ao servidor só porque o estilo
 * trocou.
 */

const SOURCE_SONDAGENS = "sondagens-comunidade"
const CAMADA_SONDAGENS = "sondagens-comunidade-circulos"

/** Espera depois do último `moveend` antes de consultar — `moveend` já
 *  dispara só no fim do gesto, mas uma sequência de ajustes curtos de
 *  pan/zoom (o jeito real de procurar um fundeadouro) dispararia uma
 *  consulta por ajuste sem isto. 400 ms segura a rajada e continua
 *  imperceptível pra quem parou o mapa de verdade. */
const DEBOUNCE_MOVEEND_MS = 400

/**
 * Liga a camada de sondagens ao mapa de /navegar.
 *
 * `visivel` vem do interruptor "Sondagens da comunidade" do painel de
 * camadas (lib/mapa/camadas.ts — nasce DESLIGADO). A camada é criada mesmo
 * desligada (barato: source vazia + camada `visibility: none`) pra ocupar o
 * lugar certo na pilha desde o início; a CONSULTA, não — buscar dado que
 * ninguém vai ver seria gastar rede do barco à toa, então o efeito de busca
 * só roda com o interruptor ligado.
 */
export function useCamadaSondagens(
  mapa: MapaMapbox | null,
  versaoEstilo: number,
  visivel: boolean,
  cores: CoresMapa,
): void {
  // Última resposta boa — é daqui que a camada se re-hidrata depois de um
  // `setStyle()` destruir a source, sem nova ida ao servidor.
  const celulasRef = useRef<CelulaSondagemMapa[]>([])

  // Criação + visibilidade + repintura (mesmo desenho do efeito de camadas de
  // navegar-mapa.tsx: criação idempotente guardada por getSource; troca de
  // tema só repinta o que já existe).
  useEffect(() => {
    if (!mapa) return
    if (!mapa.getSource(SOURCE_SONDAGENS)) {
      mapa.addSource(SOURCE_SONDAGENS, { type: "geojson", data: colecaoSondagensVazia() })
      // Na pilha, ABAIXO do balizamento (mesma posição da batimetria — os
      // dois contam a história do fundo; boia/farol e a rota continuam por
      // cima). Se o balizamento ainda não voltou do style.load, cai pra
      // baixo da linha de rumo (a primeira camada própria de navegar-mapa);
      // sem nenhuma das duas, entra no topo mesmo — as camadas de rota são
      // adicionadas depois e acabam por cima de qualquer forma.
      const antesDe = mapa.getLayer("openseamap") ? "openseamap" : mapa.getLayer("rumo-linha") ? "rumo-linha" : undefined
      mapa.addLayer(
        {
          id: CAMADA_SONDAGENS,
          type: "circle",
          source: SOURCE_SONDAGENS,
          layout: { visibility: visivel ? "visible" : "none" },
          paint: {
            // A MESMA rampa da batimetria (ver ANCORAS_RAMPA_SONDAGEM em
            // lib/mapa/sondagens.ts), resolvida por círculo pela mediana da
            // célula.
            "circle-color": expressaoCorSondagem(),
            // Opacidade constante (diferente do alfa decrescente da
            // batimetria): célula funda é medição real de alguém, não pode
            // dissolver — ver o comentário da rampa em lib/mapa/sondagens.ts.
            "circle-opacity": 0.85,
            // Tamanho por zoom: de longe um pontilhado discreto (a célula de
            // 15 m nem existe visualmente), de perto um círculo legível.
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 7, 2, 10, 3, 13, 5, 16, 9],
            // O par de contraste declarado da casa ("escuro sobre cor viva",
            // lib/mapa/cores-tema.ts): é o anel que mantém o círculo legível
            // tanto no náutico claro quanto sobre o satélite.
            "circle-stroke-color": cores.acaoTexto,
            "circle-stroke-width": 1,
            "circle-stroke-opacity": 0.6,
          },
        },
        antesDe,
      )
      // Re-hidrata o que o setStyle destruiu — o dado do viewport atual já
      // está no cache; refazer a consulta aqui duplicaria rede à toa.
      const source = mapa.getSource(SOURCE_SONDAGENS) as GeoJSONSource | undefined
      if (celulasRef.current.length > 0) source?.setData(celulasParaGeoJSON(celulasRef.current))
    }
    if (mapa.getLayer(CAMADA_SONDAGENS)) {
      mapa.setLayoutProperty(CAMADA_SONDAGENS, "visibility", visivel ? "visible" : "none")
      // Troca de tema em execução: só o anel lê token — a rampa é fixa por
      // desenho (é a cor do DADO, não do tema).
      mapa.setPaintProperty(CAMADA_SONDAGENS, "circle-stroke-color", cores.acaoTexto)
    }
  }, [mapa, versaoEstilo, visivel, cores])

  // Consulta por bbox do viewport — imediata ao ligar o interruptor, depois
  // a cada `moveend` (com debounce). Resposta fora de ordem é descartada por
  // contador de pedido (mesma ideia do `pedidoEmVooRef` da rota).
  useEffect(() => {
    if (!mapa || !visivel) return
    const m = mapa
    let cancelado = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let ultimoPedido = 0

    async function buscar() {
      const limites = m.getBounds()
      if (!limites) return
      const pedido = ++ultimoPedido
      const resposta = await buscarSondagens({
        lngMin: limites.getWest(),
        latMin: limites.getSouth(),
        lngMax: limites.getEast(),
        latMax: limites.getNorth(),
      })
      if (cancelado || pedido !== ultimoPedido) return
      celulasRef.current = resposta.celulas
      if (resposta.cortado) {
        // Log honesto, não silêncio: o mapa NESTE zoom está incompleto — quem
        // aproximar vê o resto. Console e não UI porque é limitação de
        // consulta, não erro de quem navega.
        console.warn(
          "[sondagens] área com mais células que o teto por consulta — mostrando as mais confirmadas; aproxime o zoom pra ver todas.",
        )
      }
      const source = m.getSource(SOURCE_SONDAGENS) as GeoJSONSource | undefined
      source?.setData(celulasParaGeoJSON(resposta.celulas))
    }

    function aoMover() {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => void buscar(), DEBOUNCE_MOVEEND_MS)
    }

    void buscar()
    m.on("moveend", aoMover)
    return () => {
      cancelado = true
      if (timer) clearTimeout(timer)
      m.off("moveend", aoMover)
    }
  }, [mapa, visivel])
}
