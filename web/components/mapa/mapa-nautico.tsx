"use client"
import { useEffect, useRef, useState } from "react"
import "mapbox-gl/dist/mapbox-gl.css"
import type { IControl, Map as MapaMapbox } from "mapbox-gl"
import { Icone } from "@/components/icone"
import { carregarCamadas, salvarCamadas, type ChaveCamada, type EstadoCamadas } from "@/lib/mapa/camadas"

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

// Baía da Ilha Grande — praça inicial do Commander.
const CENTRO_PADRAO: [number, number] = [-44.14, -23.09]

/** Metadados de `batimetria.json` (gerado por scripts/gerar-batimetria.mjs) —
 *  só os 4 campos que viram os cantos da imagem no mapa. */
interface BatimetriaMetadados {
  lngMin: number
  latMin: number
  lngMax: number
  latMax: number
}

/** Botão discreto (mesmo grupo visual dos outros controles do Mapbox — zoom,
 *  bússola, locate — em "top-right") que abre o painel de camadas. DOM puro
 *  (IControl do Mapbox), não React: é assim que todo controle do mapa é
 *  construído nessa tela. Ícone real mais próximo de "camadas" no conjunto
 *  de web/components/icone.tsx é "menu" (três linhas) — não existe um
 *  ícone de camadas dedicado, mesma situação do "mapa" no lugar de
 *  "bússola" logo abaixo. */
class ControleCamadas implements IControl {
  private container: HTMLDivElement | null = null
  constructor(private aoClicar: () => void) {}
  onAdd(): HTMLElement {
    const container = document.createElement("div")
    container.className = "mapboxgl-ctrl mapboxgl-ctrl-group"
    const botao = document.createElement("button")
    botao.type = "button"
    botao.setAttribute("aria-label", "Camadas do mapa")
    botao.innerHTML =
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#333" stroke-width="1.7" ' +
      'stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:auto"><path d="M4 6h16M4 12h16M4 18h16"/></svg>'
    botao.addEventListener("click", () => this.aoClicar())
    container.appendChild(botao)
    this.container = container
    return container
  }
  onRemove(): void {
    this.container?.remove()
    this.container = null
  }
}

/** Chave-switch — mesmo par de cores de estado ligado/desligado usado no
 *  resto do app (bg-accent = dourado da marca). */
function Interruptor({ ligado, aoAlternar, rotulo }: { ligado: boolean; aoAlternar: () => void; rotulo: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-label={rotulo}
      onClick={aoAlternar}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${ligado ? "bg-accent" : "bg-line"}`}
    >
      <span
        aria-hidden="true"
        className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform ${ligado ? "translate-x-5" : "translate-x-0"}`}
      />
    </button>
  )
}

/** Mapa náutico do Commander: Mapbox + sinalização do OpenSeaMap + batimetria
 *  aproximada + posição do aparelho no talo (alta precisão, rumo,
 *  acompanhamento). Sem token, degrada com aviso — nunca quebra a tela.
 *
 *  Três camadas opcionais, controláveis pelo painel do botão "camadas" (ver
 *  ControleCamadas acima): Balizamento (OpenSeaMap) e Parceiros ligados por
 *  padrão, Profundidade desligada por padrão. A escolha persiste em
 *  localStorage (web/lib/mapa/camadas.ts) — o navegante configura uma vez.
 *  "Parceiros" é desenhado por quem usa este componente (os pinos não
 *  pertencem ao MapaNautico), por isso o estado das 3 chaves sobe pra quem
 *  usa via `aoMudarCamadas`, disparado no mount e em toda mudança. */
export function MapaNautico({
  aoIniciar,
  aoMudarCamadas,
  className,
}: {
  aoIniciar?: (mapa: MapaMapbox) => void
  aoMudarCamadas?: (camadas: EstadoCamadas) => void
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapaRef = useRef<MapaMapbox | null>(null)
  const aoIniciarRef = useRef(aoIniciar)
  useEffect(() => {
    aoIniciarRef.current = aoIniciar
  }, [aoIniciar])

  const [camadas, setCamadas] = useState<EstadoCamadas>(() => carregarCamadas())
  const [painelAberto, setPainelAberto] = useState(false)

  const aoMudarCamadasRef = useRef(aoMudarCamadas)
  useEffect(() => {
    aoMudarCamadasRef.current = aoMudarCamadas
  }, [aoMudarCamadas])
  // Dispara no mount (estado inicial vindo do localStorage) e em toda troca —
  // é como quem usa este componente sabe se deve desenhar os pinos ou não.
  useEffect(() => {
    aoMudarCamadasRef.current?.(camadas)
  }, [camadas])

  function alternarCamada(chave: ChaveCamada) {
    setCamadas((atual) => {
      const proximo = { ...atual, [chave]: !atual[chave] }
      salvarCamadas(proximo)
      return proximo
    })
  }

  // Aplica a visibilidade das camadas que o PRÓPRIO MapaNautico desenha
  // (balizamento e batimetria — "parceiros" é desenhado por fora, ver
  // `aoMudarCamadas` acima) toda vez que o estado muda DEPOIS do mapa
  // pronto. O valor inicial de cada layout.visibility já nasce certo lá
  // embaixo, no "load" — este efeito só cobre as trocas via toggle.
  useEffect(() => {
    const mapa = mapaRef.current
    if (!mapa) return
    if (mapa.getLayer("openseamap")) {
      mapa.setLayoutProperty("openseamap", "visibility", camadas.balizamento ? "visible" : "none")
    }
    if (mapa.getLayer("batimetria")) {
      mapa.setLayoutProperty("batimetria", "visibility", camadas.profundidade ? "visible" : "none")
    }
  }, [camadas])

  useEffect(() => {
    if (!TOKEN || !containerRef.current) return
    let cancelado = false

    // .catch: falha de rede no chunk nao pode deixar um buraco mudo na tela
    import("mapbox-gl").catch(() => null).then((mod) => {
      if (!mod) return
      const mapboxgl = mod.default
      if (cancelado || !containerRef.current) return
      mapboxgl.accessToken = TOKEN
      const mapa = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/standard",
        center: CENTRO_PADRAO,
        zoom: 10,
        attributionControl: false,
        // Instrumento de bordo, nao mapa de carro: cores desbotadas (a
        // sinalizacao nautica do OpenSeaMap e quem pinta por cima), sem
        // placas de rodovia, sem transporte publico, sem POI de cidade.
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
      })
      mapa.addControl(
        new mapboxgl.AttributionControl({
          compact: true,
          // OpenSeaMap já se anuncia sozinho via `attribution` na própria
          // source (mais abaixo — é assim que o Mapbox monta a lista). A
          // batimetria usa uma source do tipo "image", que NÃO tem campo
          // `attribution` na especificação — por isso entra aqui, fixa.
          customAttribution: ["Batimetria: ETOPO 2022 (NOAA/NCEI)"],
        }),
      )
      mapa.addControl(new mapboxgl.ScaleControl({ unit: "nautical" }), "bottom-left")
      mapa.addControl(new mapboxgl.NavigationControl({ showCompass: true }), "top-right")
      mapa.addControl(
        new mapboxgl.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: true,
          showUserHeading: true,
          fitBoundsOptions: { maxZoom: 14 },
        }),
        "top-right",
      )
      mapa.addControl(new ControleCamadas(() => setPainelAberto((v) => !v)), "top-right")
      mapa.on("load", () => {
        if (cancelado) return

        // Batimetria (profundidade aproximada) — ABAIXO do balizamento e da
        // rota (ver beforeId: adiciona sempre logo antes de "openseamap" na
        // pilha, então fica por baixo dele; a rota é adicionada depois disso,
        // por fora, sem beforeId — entra por cima de tudo que já existe).
        // Sem o JSON (asset não gerado/404), a camada simplesmente não
        // existe — mesmo padrão "honesto" da máscara água/terra: ausência
        // não é erro, só significa "essa camada não está disponível".
        fetch("/mapa/batimetria.json")
          .then((r) => (r.ok ? (r.json() as Promise<BatimetriaMetadados>) : null))
          .then((meta) => {
            if (cancelado || !meta || mapa.getSource("batimetria")) return
            mapa.addSource("batimetria", {
              type: "image",
              url: "/mapa/batimetria.png",
              coordinates: [
                [meta.lngMin, meta.latMax],
                [meta.lngMax, meta.latMax],
                [meta.lngMax, meta.latMin],
                [meta.lngMin, meta.latMin],
              ],
            })
            mapa.addLayer(
              {
                id: "batimetria",
                type: "raster",
                source: "batimetria",
                layout: { visibility: camadas.profundidade ? "visible" : "none" },
                paint: { "raster-fade-duration": 0 },
              },
              mapa.getLayer("openseamap") ? "openseamap" : undefined,
            )
          })
          .catch(() => {})

        // Sinalização náutica (boias, faróis, marcas) — overlay CC-BY-SA.
        mapa.addSource("openseamap", {
          type: "raster",
          tiles: ["https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png"],
          tileSize: 256,
          attribution: "© OpenSeaMap",
        })
        mapa.addLayer({
          id: "openseamap",
          type: "raster",
          source: "openseamap",
          layout: { visibility: camadas.balizamento ? "visible" : "none" },
        })
        // se o container foi medido antes do CSS/layout assentar, o canvas
        // fica com tamanho errado (mapa "branco") — remedir resolve
        mapa.resize()
        aoIniciarRef.current?.(mapa)
      })
      mapaRef.current = mapa
    })

    return () => {
      cancelado = true
      mapaRef.current?.remove()
      mapaRef.current = null
    }
    // camadas.balizamento/profundidade só entram aqui como valor INICIAL do
    // layout (lido uma vez, no "load" — que só dispara uma vez na vida do
    // mapa); trocas depois disso são cobertas pelo efeito de cima. Colocar
    // `camadas` nas deps recriaria o mapa inteiro a cada toggle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!TOKEN) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-3 rounded-[14px] border border-line bg-[#0B1D2D] p-8 text-center ${className ?? ""}`}
      >
        {/* o plano pedia "bussola", que nao existe no conjunto de 28 — "mapa" e o mais proximo */}
        <Icone nome="mapa" className="size-8 text-[#D4AF37]" />
        <p className="corpo text-[#e9f1f8]">
          {process.env.NODE_ENV === "development"
            ? "O mapa precisa de configuração — adicione NEXT_PUBLIC_MAPBOX_TOKEN ao .env.local."
            : "Mapa indisponível no momento."}
        </p>
      </div>
    )
  }

  return (
    // Tela cheia: o mapa É a tela; quem emoldura é quem usa (via className).
    <div className={`relative ${className ?? ""}`}>
      {/* h-full em vez de absolute/inset: o CSS do mapbox forca
          .mapboxgl-map{position:relative}, que vence o .absolute na cascata e
          colapsava a altura para 0 (mapa branco) */}
      <div ref={containerRef} className="h-full w-full" />

      {painelAberto && (
        <div className="sombra-2 absolute right-3 top-44 z-30 w-72 rounded-[14px] border border-line bg-panel/95 p-4 backdrop-blur">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="titulo-card">Camadas do mapa</h2>
            <button
              type="button"
              onClick={() => setPainelAberto(false)}
              aria-label="Fechar painel de camadas"
              className="flex size-7 items-center justify-center text-dim"
            >
              <Icone nome="mais" className="size-4 rotate-45" />
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="corpo">Balizamento</p>
                <p className="apoio text-dim">Boias e faróis (OpenSeaMap)</p>
              </div>
              <Interruptor
                ligado={camadas.balizamento}
                aoAlternar={() => alternarCamada("balizamento")}
                rotulo="Balizamento"
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="corpo">Profundidade</p>
                <p className="apoio text-dim">Batimetria aproximada</p>
              </div>
              <Interruptor
                ligado={camadas.profundidade}
                aoAlternar={() => alternarCamada("profundidade")}
                rotulo="Profundidade"
              />
            </div>
            {camadas.profundidade && (
              <p className="apoio rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-warn">
                Profundidade aproximada (~450 m de resolução) — orientação geral, NÃO substitui a carta náutica
                oficial.
              </p>
            )}

            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="corpo">Parceiros</p>
                <p className="apoio text-dim">Pinos de marinas, postos e afins</p>
              </div>
              <Interruptor
                ligado={camadas.parceiros}
                aoAlternar={() => alternarCamada("parceiros")}
                rotulo="Parceiros"
              />
            </div>
          </div>
        </div>
      )}

      {/* o aviso legal "auxílio à navegação" vive no painel de trilha do
          /navegar — flutuando aqui ele cobria escala e atribuição */}
    </div>
  )
}
