"use client"
import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import type { Map as MapaMapbox, Marker as MarcadorMapbox } from "mapbox-gl"
import { CardParceiro } from "@/components/mapa/card-parceiro"
import { MapaNautico } from "@/components/mapa/mapa-nautico"
import { RedeNav } from "@/components/ui/rede-nav"
import type { EstadoCamadas } from "@/lib/mapa/camadas"
import { criarElementoMarcadorParceiro } from "@/lib/mapa/pino-parceiro"
import type { CategoriaParceiro, Parceiro } from "@/lib/db/types"

const CATEGORIAS: { valor: CategoriaParceiro | "todos"; rotulo: string }[] = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "marina", rotulo: "Marina" },
  { valor: "posto", rotulo: "Posto" },
  { valor: "pousada", rotulo: "Pousada" },
  { valor: "restaurante", rotulo: "Restaurante" },
]

/** Onda 39 (PRD upgrade2-master §52) — "descobrir onde ir e o que existe ao
 *  redor da navegação": mapa de parceiros (marina, posto, pousada,
 *  restaurante) por categoria. Diferente de /navegar (instrumento de
 *  navegação — trilha, rota pela água, alarme de âncora, MOB): Explorar é
 *  SÓ descoberta, sem nada disso.
 *
 *  Reaproveita o que /navegar já usava pra parceiros em vez de duplicar:
 *  MapaNautico (mapa-base), CardParceiro (bottom sheet) e o desenho do pino
 *  (criarElementoMarcadorParceiro, extraído de navegar-mapa.tsx pra
 *  web/lib/mapa/pino-parceiro.ts nesta mesma onda). A regra de negócio não
 *  muda: só parceiro com `visivel = true` (fechou com a Commander) aparece —
 *  nunca POI de terceiro; a query em explorar/page.tsx é a MESMA de
 *  navegar/page.tsx (`.eq("visivel", true)`). "Traçar rumo" no card manda
 *  pra /navegar com o destino pronto — a mesma ponte que VerViagemMapa já
 *  usa (`?destino_la=&destino_lo=&destino_nome=`), sem inventar uma nova. */
export function ExplorarMapa({ parceiros }: { parceiros: Parceiro[] }) {
  const router = useRouter()

  useEffect(() => {
    document.body.classList.add("fundo-tela-mapa")
    return () => document.body.classList.remove("fundo-tela-mapa")
  }, [])

  const [mapaPronto, setMapaPronto] = useState<MapaMapbox | null>(null)
  // Preferência de dispositivo compartilhada com /navegar (MapaNautico lê/
  // grava em localStorage) — desligar "Parceiros" aqui também desliga lá, o
  // que é o comportamento certo: é a MESMA camada, não uma cópia.
  const [mostrarParceiros, setMostrarParceiros] = useState(true)
  const [categoria, setCategoria] = useState<CategoriaParceiro | "todos">("todos")
  const [parceiroAberto, setParceiroAberto] = useState<Parceiro | null>(null)
  const marcadoresRef = useRef<MarcadorMapbox[]>([])

  const filtrados = useMemo(
    () => (categoria === "todos" ? parceiros : parceiros.filter((p) => p.categoria === categoria)),
    [parceiros, categoria],
  )

  useEffect(() => {
    if (!mapaPronto || !mostrarParceiros) return
    let cancelado = false
    import("mapbox-gl").then(({ default: mapboxgl }) => {
      if (cancelado) return
      marcadoresRef.current.forEach((m) => m.remove())
      marcadoresRef.current = filtrados.map((p) => {
        const el = criarElementoMarcadorParceiro(p)
        el.addEventListener("click", (e) => {
          e.stopPropagation()
          setParceiroAberto(p)
        })
        return new mapboxgl.Marker({ element: el, anchor: "center" }).setLngLat([p.lng, p.lat]).addTo(mapaPronto)
      })
    })
    return () => {
      cancelado = true
      marcadoresRef.current.forEach((m) => m.remove())
      marcadoresRef.current = []
    }
  }, [mapaPronto, mostrarParceiros, filtrados])

  return (
    // Mesma técnica de tela cheia de NavegarMapa: escapa do px-4/pt-5/pb-24
    // do layout do grupo (app) com margens negativas.
    <main className="relative -mx-4 -mt-5 -mb-24 h-[calc(100dvh-4rem)]">
      <h1 className="sr-only">Explorar</h1>
      <MapaNautico
        aoIniciar={setMapaPronto}
        aoMudarCamadas={(c: EstadoCamadas) => setMostrarParceiros(c.parceiros)}
        className="h-full w-full"
      />

      {/* right-14 (não inset-x-3): deixa livre a coluna de controles nativos
          do Mapbox (zoom/bússola/locate/camadas) que MapaNautico posiciona
          em "top-right" — mesmo espaço reservado que NavegarMapa já usa pro
          seu próprio overlay do topo. */}
      <div className="pointer-events-none absolute left-3 right-14 top-3 z-20 flex flex-col gap-2">
        <div className="pointer-events-auto">
          <RedeNav atual="explorar" variant="mapa" />
        </div>
        <div
          className="pointer-events-auto sombra-2 flex gap-1.5 overflow-x-auto rounded-full border border-mapa-instrumento-borda bg-mapa-instrumento p-1.5"
          style={{ scrollbarWidth: "none" }}
        >
          {CATEGORIAS.map((c) => (
            <button
              key={c.valor}
              type="button"
              onClick={() => setCategoria(c.valor)}
              aria-pressed={categoria === c.valor}
              className={`h-9 shrink-0 whitespace-nowrap rounded-full px-3 text-sm font-medium ${
                categoria === c.valor ? "bg-accent text-acao-texto" : "text-meter-texto"
              }`}
            >
              {c.rotulo}
            </button>
          ))}
        </div>
      </div>

      {parceiroAberto && (
        <CardParceiro
          parceiro={parceiroAberto}
          aoFechar={() => setParceiroAberto(null)}
          aoTracarRumo={(p) => {
            setParceiroAberto(null)
            router.push(`/navegar?destino_la=${p.lat}&destino_lo=${p.lng}&destino_nome=${encodeURIComponent(p.nome)}`)
          }}
        />
      )}
    </main>
  )
}
