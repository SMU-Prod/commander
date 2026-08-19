"use client"
import { useEffect, useRef, useState } from "react"
import "mapbox-gl/dist/mapbox-gl.css"
import type { Map as MapaMapbox } from "mapbox-gl"
import { Icone } from "@/components/icone"
import { useCoresMapa } from "@/components/mapa/usar-cores-mapa"
import type { PontoTrilha } from "@/lib/domain/geo"

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

// ONDA 89 (achado 4.1) — as três cores desta tela eram literais, e o
// comentário que estava aqui dizia que a da trilha era "a mesma em claro e
// escuro". Deixou de ser verdade na onda 79, quando a marca do tema escuro
// virou limão. Agora saem de `useCoresMapa`, que lê os tokens do documento
// — ver lib/mapa/cores-tema.ts pro porquê de o canvas do Mapbox precisar
// disso em vez de var().

/** Expressão de cor das pontas: verde na partida, vermelho na chegada. Numa
 *  função porque a MESMA expressão é usada na criação da camada e na
 *  repintura por troca de tema — duas cópias derivariam. O retorno é anotado
 *  como TUPLA (não array) porque é assim que o `mapbox-gl` declara
 *  `ExpressionSpecification`, e a inferência de um array literal não casa. */
function corDaPonta(inicio: string, fim: string): [string, ...unknown[]] {
  return ["match", ["get", "ponta"], "inicio", inicio, fim]
}

/**
 * Preview pequeno e não-interativo do percurso de uma saída (onda 18 — a
 * saída como atividade). Mesmo padrão de token/degradação do MapaNautico
 * (web/components/mapa/mapa-nautico.tsx): sem NEXT_PUBLIC_MAPBOX_TOKEN,
 * degrada com aviso — nunca quebra a tela nem fica em branco mudo. Aqui não
 * tem painel de camadas nem controles de navegação: a trilha é o único dado,
 * `interactive: false` porque este cartão só ilustra, não navega.
 */
export function TrilhaMapa({ pontos, className }: { pontos: PontoTrilha[]; className?: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapaRef = useRef<MapaMapbox | null>(null)

  // As cores entram no mapa por DOIS caminhos, e os dois são necessários: um
  // ref pra pintura inicial (dentro do "load", que roda bem depois do render
  // que o originou) e o valor direto no efeito de repintura mais abaixo
  // (troca de tema com a tela já aberta). Pôr `cores` nas dependências do
  // efeito de criação recriaria o mapa inteiro a cada troca de tema.
  const cores = useCoresMapa()
  const coresRef = useRef(cores)
  useEffect(() => {
    coresRef.current = cores
  }, [cores])
  // Sobe quando as camadas existem de verdade — é o gatilho da repintura,
  // que antes disso não teria o que pintar.
  const [camadasProntas, setCamadasProntas] = useState(0)

  useEffect(() => {
    if (!TOKEN || !containerRef.current || pontos.length < 2) return
    let cancelado = false

    // .catch: falha de rede no chunk não pode deixar um buraco mudo na tela
    // (mesmo cuidado do MapaNautico).
    import("mapbox-gl").catch(() => null).then((mod) => {
      if (!mod || cancelado || !containerRef.current) return
      const mapboxgl = mod.default
      // Mesmo stub do MapaNautico: contexto inseguro (shell nativo em dev
      // carregando HTTP por IP) esconde DeviceOrientationEvent e o
      // GeolocateControl do mapbox-gl referencia o global sem checar —
      // aqui nem usamos GeolocateControl, mas o import do pacote já toca
      // nesse caminho internamente.
      if (typeof window.DeviceOrientationEvent === "undefined") {
        ;(window as unknown as { DeviceOrientationEvent: unknown }).DeviceOrientationEvent = function () {}
      }
      mapboxgl.accessToken = TOKEN

      const coordenadas: [number, number][] = pontos.map((p) => [p.lo, p.la])
      const bounds = coordenadas.reduce(
        (b, c) => b.extend(c),
        new mapboxgl.LngLatBounds(coordenadas[0], coordenadas[0]),
      )

      const mapa = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/standard",
        // Mesmo config "instrumento de bordo" do estilo náutico do
        // MapaNautico — cores desbotadas, sem rótulo de rodovia/POI.
        config: {
          basemap: {
            theme: "faded",
            lightPreset: "day",
            showRoadLabels: false,
            showTransitLabels: false,
            showPointOfInterestLabels: false,
            show3dObjects: false,
          },
        },
        bounds,
        fitBoundsOptions: { padding: 28, duration: 0 },
        interactive: false,
        attributionControl: false,
      })
      mapaRef.current = mapa

      mapa.on("load", () => {
        if (cancelado) return
        mapa.addSource("trilha", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: coordenadas },
          },
        })
        mapa.addLayer({
          id: "trilha-linha",
          type: "line",
          source: "trilha",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": coresRef.current.acao, "line-width": 3 },
        })
        // Pontas início/fim — mesma convenção de cor do TrilhaSvg (verde
        // partida, vermelho chegada) que este componente substitui.
        //
        // A feature carrega só QUAL ponta ela é; a cor fica no `paint`, numa
        // expressão. Antes a cor vinha embutida na própria feature
        // (`properties.cor`), e nesse desenho trocar de tema exigiria
        // reescrever o GeoJSON inteiro — com a cor no paint, basta um
        // `setPaintProperty` (ver efeito de repintura abaixo).
        mapa.addSource("trilha-pontas", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [
              { type: "Feature", properties: { ponta: "inicio" }, geometry: { type: "Point", coordinates: coordenadas[0] } },
              {
                type: "Feature",
                properties: { ponta: "fim" },
                geometry: { type: "Point", coordinates: coordenadas[coordenadas.length - 1] },
              },
            ],
          },
        })
        mapa.addLayer({
          id: "trilha-pontas",
          type: "circle",
          source: "trilha-pontas",
          paint: {
            "circle-radius": 5,
            "circle-color": corDaPonta(coresRef.current.ok, coresRef.current.crit),
            "circle-stroke-width": 1.5,
            "circle-stroke-color": coresRef.current.acaoTexto,
          },
        })
        mapa.resize()
        setCamadasProntas((v) => v + 1)
      })
      mapa.addControl(new mapboxgl.AttributionControl({ compact: true }))
    })

    return () => {
      cancelado = true
      mapaRef.current?.remove()
      mapaRef.current = null
    }
    // `pontos` muda só quando a saída exibida muda (a página é server
    // component, `pontos` vem de props estáveis por render) — recriar o mapa
    // inteiro nesse caso é o comportamento certo.
  }, [pontos])

  // Repintura por troca de tema (onda 89) — o DOM se repinta sozinho quando
  // `--acao` muda; o canvas WebGL do Mapbox não vê a variável e ficaria com a
  // cor do tema anterior até alguém recarregar a página.
  useEffect(() => {
    const mapa = mapaRef.current
    if (!mapa || camadasProntas === 0) return
    if (mapa.getLayer("trilha-linha")) mapa.setPaintProperty("trilha-linha", "line-color", cores.acao)
    if (mapa.getLayer("trilha-pontas")) {
      mapa.setPaintProperty("trilha-pontas", "circle-color", corDaPonta(cores.ok, cores.crit))
      mapa.setPaintProperty("trilha-pontas", "circle-stroke-color", cores.acaoTexto)
    }
  }, [camadasProntas, cores])

  if (pontos.length < 2) return null

  if (!TOKEN) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 rounded-[var(--raio-cartao)] border border-line bg-meter p-6 text-center ${className ?? ""}`}
      >
        <Icone nome="mapa" className="size-7 text-accent" />
        <p className="apoio text-meter-texto">
          {process.env.NODE_ENV === "development"
            ? "O mapa precisa de configuração — adicione NEXT_PUBLIC_MAPBOX_TOKEN ao .env.local."
            : "Mapa indisponível no momento."}
        </p>
      </div>
    )
  }

  return <div ref={containerRef} className={`overflow-hidden rounded-[var(--raio-cartao)] border border-line ${className ?? ""}`} />
}
