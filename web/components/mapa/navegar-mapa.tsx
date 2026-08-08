"use client"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import type { Map as MapaMapbox, Marker as MarcadorMapbox } from "mapbox-gl"
import { CardParceiro } from "@/components/mapa/card-parceiro"
import { MapaNautico } from "@/components/mapa/mapa-nautico"
import { Icone } from "@/components/icone"
import { salvarTrilha } from "@/lib/acoes/trilha"
import { haversineNm, resumoTrilha, MAX_PONTOS_TRILHA, type PontoTrilha, type ResumoTrilha } from "@/lib/domain/geo"
import type { CategoriaParceiro, Parceiro } from "@/lib/db/types"

const RESUMO_VAZIO: ResumoTrilha = { distanciaNm: 0, duracaoH: 0, tempoMovimentoH: 0, velMediaKt: 0, velMaxKt: 0 }

// Traçados dos ícones por categoria — cópia estática dos mesmos <path> de
// components/icone.tsx (marina→ancora, posto→oleo, pousada→inicio,
// restaurante→estrela). Os marcadores do Mapbox são DOM puro, não React, e
// esse markup é 100% nosso (nunca dado de parceiro) — por isso pode ir via
// innerHTML.
const TRACADO_ICONE: Record<CategoriaParceiro, string> = {
  marina: '<circle cx="12" cy="5" r="2"/><path d="M12 7v13M5 13a7 7 0 0 0 14 0M8 10H5m14 0h-3"/>',
  posto: '<path d="M12 3s6 6.5 6 10.5A6 6 0 0 1 6 13.5C6 9.5 12 3 12 3z"/>',
  pousada: '<path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1v-8z"/>',
  restaurante: '<path d="m12 4 2.4 5 5.6.8-4 3.9 1 5.5-5-2.7-5 2.7 1-5.5-4-3.9L9.6 9z"/>',
}

/** Elemento DOM do pino de um parceiro — plano "destaque" ganha anel dourado
 *  e sobe de camada; "tem_poita" ganha um ponto dourado no canto. */
function criarElementoMarcador(p: Parceiro): HTMLDivElement {
  const destaque = p.plano === "destaque"
  const el = document.createElement("div")
  el.style.cursor = "pointer"
  el.style.zIndex = destaque ? "10" : "1"

  const corpo = document.createElement("div")
  corpo.className = destaque
    ? "relative flex size-9 items-center justify-center rounded-full bg-[#0B1D2D] ring-2 ring-[#D4AF37]"
    : "relative flex size-9 items-center justify-center rounded-full bg-[#0B1D2D] ring-1 ring-white/15"
  corpo.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#D4AF37" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${TRACADO_ICONE[p.categoria]}</svg>`
  el.appendChild(corpo)

  if (p.tem_poita) {
    const ponto = document.createElement("span")
    ponto.className = "absolute -right-0.5 -top-0.5 block size-2.5 rounded-full bg-[#D4AF37] ring-2 ring-[#0B1D2D]"
    corpo.appendChild(ponto)
  }
  return el
}

/** Tela /navegar: mapa náutico com os pinos dos parceiros comerciais + toda a
 *  gravação de trilha que já existia aqui (watchPosition, painel, salvar no
 *  diário) — agora num cartão flutuante recolhível sobre o mapa. Sem token
 *  Mapbox o mapa vira um aviso, mas a trilha continua funcionando normalmente. */
export function NavegarMapa({ parceiros }: { parceiros: Parceiro[] }) {
  const router = useRouter()

  // --- trilha (idêntico ao que já existia na página) -----------------------
  const [estado, setEstado] = useState<"pronto" | "gravando" | "parado" | "salvando">("pronto")
  const [msg, setMsg] = useState<string | null>(null)
  const [obs, setObs] = useState("")
  const [painel, setPainel] = useState({ velKt: 0, resumo: RESUMO_VAZIO, qtd: 0 })
  const [painelAberto, setPainelAberto] = useState(true)
  const pontosRef = useRef<PontoTrilha[]>([])
  const watchRef = useRef<number | null>(null)
  const wakeRef = useRef<{ release: () => Promise<void> } | null>(null)

  useEffect(() => {
    return () => {
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current)
      wakeRef.current?.release().catch(() => {})
    }
  }, [])

  async function iniciar() {
    if (watchRef.current != null) return
    if (!("geolocation" in navigator)) {
      setMsg("Este navegador não fornece localização.")
      return
    }
    setMsg(null)
    pontosRef.current = []
    setPainel({ velKt: 0, resumo: RESUMO_VAZIO, qtd: 0 })
    watchRef.current = navigator.geolocation.watchPosition(
      (p) => {
        const ponto = { t: Math.round(p.timestamp / 1000), la: p.coords.latitude, lo: p.coords.longitude }
        const lista = pontosRef.current
        if (lista.length >= MAX_PONTOS_TRILHA) return
        const ultimo = lista[lista.length - 1]
        if (!ultimo || haversineNm(ultimo, ponto) * 1852 >= 15 || ponto.t - ultimo.t >= 30) {
          lista.push(ponto)
          const pen = lista[lista.length - 2]
          const velKt = pen && ponto.t > pen.t ? haversineNm(pen, ponto) / ((ponto.t - pen.t) / 3600) : 0
          setPainel({ velKt, resumo: resumoTrilha(lista), qtd: lista.length })
        }
      },
      () => setMsg("Sem sinal de GPS — confira a permissão de localização."),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    )
    try {
      // mantém a tela acesa durante a navegação (best-effort)
      const wl = await (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request("screen")
      if (wl) wakeRef.current = wl
    } catch {}
    setEstado("gravando")
  }

  async function pararGps() {
    if (watchRef.current != null) {
      navigator.geolocation.clearWatch(watchRef.current)
      watchRef.current = null
    }
    await wakeRef.current?.release().catch(() => {})
    wakeRef.current = null
  }

  async function encerrarESalvar() {
    await pararGps()
    setEstado("salvando")
    const r = await salvarTrilha(pontosRef.current, obs)
    if (r.ok) {
      router.push("/diario")
      return
    }
    setMsg(r.erro)
    setEstado(pontosRef.current.length >= 2 ? "parado" : "pronto")
  }

  // --- mapa + parceiros ------------------------------------------------------
  const [mapaPronto, setMapaPronto] = useState<MapaMapbox | null>(null)
  const marcadoresRef = useRef<MarcadorMapbox[]>([])
  const [parceiroAberto, setParceiroAberto] = useState<Parceiro | null>(null)
  // Destino traçado pelo card do parceiro — a Task 6 conecta rumo/distância/ETA
  // em cima deste mesmo estado (long-press no mapa vem também nela).
  const [destino, setDestino] = useState<{ la: number; lo: number; nome: string } | null>(null)

  useEffect(() => {
    if (!mapaPronto) return
    let cancelado = false
    import("mapbox-gl").then(({ default: mapboxgl }) => {
      if (cancelado) return
      marcadoresRef.current.forEach((m) => m.remove())
      marcadoresRef.current = parceiros.map((p) => {
        const el = criarElementoMarcador(p)
        el.addEventListener("click", () => setParceiroAberto(p))
        return new mapboxgl.Marker({ element: el, anchor: "center" }).setLngLat([p.lng, p.lat]).addTo(mapaPronto)
      })
    })
    return () => {
      cancelado = true
      marcadoresRef.current.forEach((m) => m.remove())
      marcadoresRef.current = []
    }
  }, [mapaPronto, parceiros])

  const mostrador = "rounded-[10px] border border-line bg-meter px-3 py-2 font-mono-instr tabular-nums text-meter-texto"
  const etiqueta = "text-[11px] uppercase tracking-[.14em] text-meter-dim"

  return (
    <main>
      <h1 className="titulo-pagina">Navegar</h1>

      <div className="relative mt-3 h-[65dvh] min-h-[420px]">
        <MapaNautico aoIniciar={setMapaPronto} className="h-full w-full" />

        <div className="sombra-2 absolute inset-x-3 top-3 z-20 overflow-hidden rounded-[14px] border border-line bg-panel/95 backdrop-blur">
          <button
            type="button"
            onClick={() => setPainelAberto((v) => !v)}
            aria-expanded={painelAberto}
            className="flex w-full items-center justify-between px-4 py-3"
          >
            <span className="flex items-center gap-2">
              <span className={`size-2 rounded-full ${estado === "gravando" ? "animate-pulse bg-crit" : "bg-dim"}`} />
              <span className="titulo-card">
                {estado === "gravando"
                  ? "Gravando trilha"
                  : estado === "parado"
                    ? "Trilha pronta pra salvar"
                    : estado === "salvando"
                      ? "Salvando…"
                      : "Trilha"}
              </span>
            </span>
            <span className="flex items-center gap-2">
              {estado !== "pronto" && (
                <span className="font-mono-instr text-xs tabular-nums text-dim">
                  {painel.velKt.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kt
                </span>
              )}
              <Icone
                nome="chevron"
                className={`size-4 text-dim transition-transform ${painelAberto ? "-rotate-90" : "rotate-90"}`}
              />
            </span>
          </button>

          {painelAberto && (
            <div className="border-t border-line px-4 pb-4 pt-3">
              <p className="apoio text-dim">
                Mantenha o app aberto durante o passeio — a trilha vira um evento no Diário de Bordo.
              </p>
              {msg && <p className="mt-3 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-sm">{msg}</p>}
              {estado === "parado" && (
                <p className="mt-3 rounded-lg border border-line bg-panel px-3 py-2 text-sm text-dim">
                  GPS parado — a trilha está pronta para salvar.
                </p>
              )}

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className={mostrador}>
                  <p className={etiqueta}>Velocidade</p>
                  <p className="text-2xl">
                    {painel.velKt.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} <span className="text-sm text-meter-dim">kt</span>
                  </p>
                </div>
                <div className={mostrador}>
                  <p className={etiqueta}>Distância</p>
                  <p className="text-2xl">
                    {painel.resumo.distanciaNm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} <span className="text-sm text-meter-dim">nm</span>
                  </p>
                </div>
                <div className={mostrador}>
                  <p className={etiqueta}>Tempo</p>
                  <p className="text-2xl">
                    {(painel.resumo.duracaoH * 60).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} <span className="text-sm text-meter-dim">min</span>
                  </p>
                </div>
                <div className={mostrador}>
                  <p className={etiqueta}>Máxima</p>
                  <p className="text-2xl">
                    {painel.resumo.velMaxKt.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} <span className="text-sm text-meter-dim">kt</span>
                  </p>
                </div>
              </div>

              {estado === "pronto" && (
                <button onClick={iniciar} className="mt-4 w-full rounded-xl bg-accent py-3.5 text-base font-semibold text-acao-texto">
                  Iniciar gravação
                </button>
              )}
              {estado !== "pronto" && (
                <>
                  <div className="mt-4">
                    <label htmlFor="obs" className="mb-1.5 block font-mono-instr text-[11px] uppercase tracking-[.14em] text-dim">
                      Observação — opcional
                    </label>
                    <input
                      id="obs"
                      value={obs}
                      onChange={(e) => setObs(e.target.value)}
                      placeholder="Ex.: volta às Cagarras"
                      className="w-full rounded-[10px] border border-line bg-campo px-3 py-3 text-base"
                    />
                  </div>
                  <button
                    onClick={encerrarESalvar}
                    disabled={estado === "salvando"}
                    className="mt-3 w-full rounded-xl bg-crit py-3.5 text-base font-semibold text-white disabled:opacity-60"
                  >
                    {estado === "salvando" ? "Salvando…" : estado === "parado" ? "Tentar salvar de novo" : "Encerrar e salvar no diário"}
                  </button>
                  <p className="mt-2 text-center font-mono-instr text-[11px] tabular-nums text-dim">
                    {painel.qtd} pontos gravados
                    {painel.qtd >= MAX_PONTOS_TRILHA ? " · limite atingido — a trilha será salva até aqui" : ""}
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        {destino && (
          <div className="sombra-2 absolute inset-x-3 bottom-3 z-20 flex items-center justify-between gap-2 rounded-[12px] border border-line bg-panel/95 px-3 py-2 backdrop-blur">
            <span className="corpo flex min-w-0 items-center gap-2">
              <Icone nome="mapa" className="size-4 shrink-0 text-accent-forte" />
              <span className="truncate">Rumo para {destino.nome}</span>
            </span>
            <button
              type="button"
              onClick={() => setDestino(null)}
              aria-label="Limpar destino"
              className="flex size-8 shrink-0 items-center justify-center text-dim"
            >
              <Icone nome="mais" className="size-4 rotate-45" />
            </button>
          </div>
        )}
      </div>

      {parceiroAberto && (
        <CardParceiro
          parceiro={parceiroAberto}
          aoFechar={() => setParceiroAberto(null)}
          aoTracarRumo={(p) => {
            setDestino({ la: p.lat, lo: p.lng, nome: p.nome })
            setParceiroAberto(null)
          }}
        />
      )}
    </main>
  )
}
