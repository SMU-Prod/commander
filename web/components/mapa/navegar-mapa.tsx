"use client"
import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import type { Map as MapaMapbox, Marker as MarcadorMapbox, MapMouseEvent, GeoJSONSource } from "mapbox-gl"
import { CardParceiro } from "@/components/mapa/card-parceiro"
import { MapaNautico } from "@/components/mapa/mapa-nautico"
import { Icone } from "@/components/icone"
import { salvarTrilha } from "@/lib/acoes/trilha"
import { haversineNm, resumoTrilha, MAX_PONTOS_TRILHA, type PontoTrilha, type ResumoTrilha } from "@/lib/domain/geo"
import { msParaNos, rumoGraus, etaMinutos, foraDoRaio } from "@/lib/domain/navegacao"
import type { CategoriaParceiro, Parceiro } from "@/lib/db/types"

const RESUMO_VAZIO: ResumoTrilha = { distanciaNm: 0, duracaoH: 0, tempoMovimentoH: 0, velMediaKt: 0, velMaxKt: 0 }

type Coord = { la: number; lo: number }
type Ancora = { la: number; lo: number; raioM: number }

const CHAVE_ANCORA = "ancora"
const RAIO_PADRAO_M = 40
const COR_DOURADO = "#D4AF37"
const COR_ALARME = "#FF5C5C"

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
// Mesmo esquema do MOB — cópia estática do <path> de "alerta" em icone.tsx.
const TRACADO_MOB = '<path d="M6 16V10a6 6 0 0 1 12 0v6l2 3H4l2-3zM10 19a2 2 0 0 0 4 0"/>'

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

/** Marcador do "homem ao mar" — vermelho pra contrastar com os pinos navy
 *  dos parceiros; mesmo padrão de innerHTML estático (nunca dado de
 *  usuário) usado acima. */
function criarElementoMob(): HTMLDivElement {
  const el = document.createElement("div")
  el.className = "flex size-9 items-center justify-center rounded-full bg-[#FF5C5C] ring-2 ring-white shadow-lg"
  el.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#0B1D2D" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${TRACADO_MOB}</svg>`
  return el
}

/** Polígono aproximado (~48 vértices) do círculo do alarme de âncora, via
 *  deslocamento simples em graus: 1° de latitude ≈ 111.32 km; a longitude é
 *  ajustada por cos(lat) pra não esticar o círculo fora do equador. Não é
 *  haversine inverso "de verdade" — é aproximação suficiente pra um raio de
 *  dezenas de metros, só para desenho no mapa (a matemática do alarme em si
 *  é `foraDoRaio`, que usa haversine de verdade). */
function pontosCirculo(centro: Coord, raioM: number): [number, number][] {
  const METROS_POR_GRAU_LAT = 111_320
  const passoLat = raioM / METROS_POR_GRAU_LAT
  const passoLo = raioM / (METROS_POR_GRAU_LAT * Math.cos((centro.la * Math.PI) / 180))
  const N = 48
  const pontos: [number, number][] = []
  for (let i = 0; i <= N; i++) {
    const ang = (i / N) * 2 * Math.PI
    pontos.push([centro.lo + passoLo * Math.sin(ang), centro.la + passoLat * Math.cos(ang)])
  }
  return pontos
}

// Sem tipos globais de GeoJSON disponíveis no projeto (o pacote `geojson` não
// é dependência); os literais abaixo batem estruturalmente com o que
// `mapboxgl.GeoJSONSource#setData` espera, sem precisar nomear o tipo.
function colecaoVazia() {
  return { type: "FeatureCollection" as const, features: [] as unknown[] }
}

/** Tela /navegar: mapa náutico com os pinos dos parceiros comerciais + toda a
 *  gravação de trilha que já existia aqui (watchPosition, painel, salvar no
 *  diário), MAIS a navegação ativa de bordo: SOG, rumo/distância/ETA até um
 *  destino, alarme de âncora e MOB.
 *
 *  Watcher único: antes desta task, o `watchPosition` só rodava enquanto a
 *  trilha estava "gravando" (só existia dentro de `iniciar()`). Como SOG,
 *  rumo e alarme de âncora precisam de posição o tempo todo — não só quando
 *  o usuário decide gravar uma trilha — o watcher virou permanente (roda do
 *  mount até o unmount da tela) e a trilha passou a só CONTROLAR SE grava
 *  pontos (via `gravandoRef`), sem mais abrir/fechar o watcher. Continua
 *  sendo UMA única chamada a `watchPosition` pra tela inteira.
 *
 *  Sem token Mapbox: SOG, rumo/distância/ETA e o alarme de âncora (incluindo
 *  vibração e notificação) continuam funcionando normalmente — são cálculo
 *  puro sobre `posAtual`, não dependem do mapa. Só o que é desenho (linha de
 *  rumo, círculo do alarme, marcador do MOB) não aparece, porque não existe
 *  `mapaPronto`; os efeitos que desenham isso já saem cedo quando o mapa não
 *  existe, então nada quebra. */
export function NavegarMapa({ parceiros }: { parceiros: Parceiro[] }) {
  const router = useRouter()

  // --- trilha (preservado do que já existia na página, ver comentário acima) -
  const [estado, setEstado] = useState<"pronto" | "gravando" | "parado" | "salvando">("pronto")
  const [msg, setMsg] = useState<string | null>(null)
  const [obs, setObs] = useState("")
  const [painel, setPainel] = useState({ velKt: 0, resumo: RESUMO_VAZIO, qtd: 0 })
  // nasce recolhido: o mapa é o protagonista da tela, não os cartões
  const [painelAberto, setPainelAberto] = useState(false)
  const [semGeolocalizacao, setSemGeolocalizacao] = useState(false)
  const pontosRef = useRef<PontoTrilha[]>([])
  const watchRef = useRef<number | null>(null)
  const wakeRef = useRef<{ release: () => Promise<void> } | null>(null)
  const gravandoRef = useRef(false)

  // --- posição sempre ativa: SOG (coords.speed) + posição atual p/ rumo/âncora
  const [sogKt, setSogKt] = useState<number | null>(null)
  const [posAtual, setPosAtual] = useState<Coord | null>(null)

  // --- alarme de âncora: declarado ANTES do watcher, que é quem o avalia ---
  // "garrando" nasce no watcher com filtro anti-jitter — matemática pura via
  // `foraDoRaio`, funciona com ou sem mapa.
  const [ancora, setAncora] = useState<Ancora | null>(null)
  const [raioM, setRaioM] = useState(RAIO_PADRAO_M)
  const [garrando, setGarrando] = useState(false)
  // MOB declarado aqui (antes dos efeitos que o limpam) — a lógica vive na seção MOB
  const [mob, setMob] = useState<Coord | null>(null)
  // cartão do raio só aparece quando a pessoa toca em "Fundeei" — antes disso
  // é um pill compacto, senão os cartões disputam o mapa entre si
  const [armandoAncora, setArmandoAncora] = useState(false)
  const ancoraRef = useRef<Ancora | null>(null)
  const foraSeguidasRef = useRef(0)
  useEffect(() => {
    ancoraRef.current = ancora
  }, [ancora])

  // Watcher único da tela inteira. Roda do mount ao unmount, independente de
  // estar gravando trilha — a gravação só decide se acumula pontos.
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- deteccao de suporte do navegador, so existe em runtime
      setSemGeolocalizacao(true)
      return
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const atual: Coord = { la: p.coords.latitude, lo: p.coords.longitude }
        setPosAtual(atual)
        setSogKt(msParaNos(p.coords.speed))

        // Alarme de âncora com filtro anti-jitter (achado da revisão): uma
        // única leitura ruim de GPS não pode acordar ninguém a bordo.
        // - leitura com precisão pior que 60 m não conta nem pra dentro nem pra fora;
        // - a incerteza do GPS (até 30 m) soma ao raio antes de comparar;
        // - só 3 leituras SEGUIDAS fora acendem o alarme; uma dentro zera.
        const a = ancoraRef.current
        if (!a) {
          foraSeguidasRef.current = 0
          setGarrando(false)
        } else {
          const precisao = p.coords.accuracy
          if (!(precisao > 60)) {
            const margem = Math.min(Number.isFinite(precisao) ? precisao : 15, 30)
            if (foraDoRaio(a, atual, a.raioM + margem)) foraSeguidasRef.current += 1
            else foraSeguidasRef.current = 0
            setGarrando(foraSeguidasRef.current >= 3)
          }
        }

        if (!gravandoRef.current) return
        const ponto = { t: Math.round(p.timestamp / 1000), la: atual.la, lo: atual.lo }
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
    watchRef.current = id
    return () => {
      navigator.geolocation.clearWatch(id)
      watchRef.current = null
    }
  }, [])

  // Rede de segurança: se a tela desmontar no meio de uma gravação (usuário
  // navegou sem clicar em "encerrar"), libera o wake lock mesmo assim.
  useEffect(() => {
    return () => {
      wakeRef.current?.release().catch(() => {})
    }
  }, [])

  async function iniciar() {
    if (gravandoRef.current) return
    if (semGeolocalizacao) {
      setMsg("Este navegador não fornece localização.")
      return
    }
    setMsg(null)
    pontosRef.current = []
    setPainel({ velKt: 0, resumo: RESUMO_VAZIO, qtd: 0 })
    gravandoRef.current = true
    try {
      // mantém a tela acesa durante a navegação (best-effort) — só enquanto
      // grava trilha de propósito; ter o mapa aberto sozinho não trava a tela
      const wl = await (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request("screen")
      if (wl) wakeRef.current = wl
    } catch {}
    setEstado("gravando")
  }

  async function pararGravacao() {
    gravandoRef.current = false
    await wakeRef.current?.release().catch(() => {})
    wakeRef.current = null
  }

  async function encerrarESalvar() {
    await pararGravacao()
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
  // Destino traçado pelo card do parceiro OU pelo modo "definir destino"
  // (toque no mapa). A linha de rumo e o painel de distância/ETA reagem a
  // este mesmo estado.
  const [destino, setDestino] = useState<{ la: number; lo: number; nome: string } | null>(null)
  const [modoDefinirDestino, setModoDefinirDestino] = useState(false)

  useEffect(() => {
    if (!mapaPronto) return
    let cancelado = false
    import("mapbox-gl").then(({ default: mapboxgl }) => {
      if (cancelado) return
      marcadoresRef.current.forEach((m) => m.remove())
      marcadoresRef.current = parceiros.map((p) => {
        const el = criarElementoMarcador(p)
        el.addEventListener("click", (e) => {
          // sem isso, o clique no pino também dispararia o "click" do mapa
          // (modo "definir destino" abriria o parceiro E marcaria destino)
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
  }, [mapaPronto, parceiros])

  // Modo "definir destino": próximo toque no mapa vira o destino.
  useEffect(() => {
    if (!mapaPronto) return
    mapaPronto.getCanvas().style.cursor = modoDefinirDestino ? "crosshair" : ""
    if (!modoDefinirDestino) return
    function aoClicarNoMapa(e: MapMouseEvent) {
      setDestino({ la: e.lngLat.lat, lo: e.lngLat.lng, nome: "Destino no mapa" })
      setMob(null) // novo destino descarta o MOB — senao o marcador fica orfao
      setModoDefinirDestino(false)
    }
    mapaPronto.on("click", aoClicarNoMapa)
    return () => {
      mapaPronto.off("click", aoClicarNoMapa)
    }
  }, [mapaPronto, modoDefinirDestino])

  // Fontes/camadas do mapa (linha de rumo + círculo do alarme) — criadas uma
  // vez quando o mapa fica pronto; atualizadas via setData nos efeitos abaixo.
  useEffect(() => {
    if (!mapaPronto) return
    if (!mapaPronto.getSource("rumo")) {
      mapaPronto.addSource("rumo", { type: "geojson", data: colecaoVazia() })
      mapaPronto.addLayer({
        id: "rumo-linha",
        type: "line",
        source: "rumo",
        paint: { "line-color": COR_DOURADO, "line-width": 3, "line-dasharray": [2, 2] },
      })
    }
    if (!mapaPronto.getSource("ancora-circulo")) {
      mapaPronto.addSource("ancora-circulo", { type: "geojson", data: colecaoVazia() })
      mapaPronto.addLayer({
        id: "ancora-circulo-preenchimento",
        type: "fill",
        source: "ancora-circulo",
        paint: { "fill-color": COR_ALARME, "fill-opacity": 0.12 },
      })
      mapaPronto.addLayer({
        id: "ancora-circulo-contorno",
        type: "line",
        source: "ancora-circulo",
        paint: { "line-color": COR_ALARME, "line-width": 2 },
      })
    }
  }, [mapaPronto])

  // Linha de rumo posição→destino, redesenhada a cada nova posição.
  useEffect(() => {
    if (!mapaPronto) return
    const source = mapaPronto.getSource("rumo") as GeoJSONSource | undefined
    if (!source) return
    source.setData(
      posAtual && destino
        ? {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                properties: {},
                geometry: { type: "LineString", coordinates: [[posAtual.lo, posAtual.la], [destino.lo, destino.la]] },
              },
            ],
          }
        : colecaoVazia(),
    )
  }, [mapaPronto, posAtual, destino])

  // Distância/rumo/ETA até o destino — cálculo puro, não depende do mapa.
  const nav = useMemo(() => {
    if (!destino || !posAtual) return null
    const distanciaNm = haversineNm(posAtual, destino)
    const rumo = rumoGraus(posAtual, destino)
    const eta = sogKt != null ? etaMinutos(distanciaNm, sogKt) : null
    return { distanciaNm, rumo, eta }
  }, [destino, posAtual, sogKt])

  // --- alarme de âncora (estado principal declarado antes do watcher) -----
  const garrandoAnteriorRef = useRef(false)

  // Rearma no mount se já havia âncora salva (sobrevive a reload/fechar app).
  useEffect(() => {
    try {
      const bruto = localStorage.getItem(CHAVE_ANCORA)
      if (!bruto) return
      const salvo = JSON.parse(bruto) as Partial<Ancora>
      if (typeof salvo.la === "number" && typeof salvo.lo === "number" && typeof salvo.raioM === "number") {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- rearme da ancora salva, so existe apos ler o localStorage
        setAncora({ la: salvo.la, lo: salvo.lo, raioM: salvo.raioM })
        setRaioM(salvo.raioM)
      }
    } catch {}
  }, [])

  // Círculo do alarme no mapa.
  useEffect(() => {
    if (!mapaPronto) return
    const source = mapaPronto.getSource("ancora-circulo") as GeoJSONSource | undefined
    if (!source) return
    source.setData(
      ancora
        ? {
            type: "FeatureCollection",
            features: [
              { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [pontosCirculo(ancora, ancora.raioM)] } },
            ],
          }
        : colecaoVazia(),
    )
  }, [mapaPronto, ancora])

  // Efeitos colaterais do alarme (vibração + notificação do sistema) — só
  // isso; `garrando` em si é decidido no watcher, com o filtro anti-jitter.
  useEffect(() => {
    if (!garrando) {
      garrandoAnteriorRef.current = false
      return
    }
    // vibra a cada nova posição fora do raio (o pedido explícito é
    // "repetido"), mas a notificação do sistema só na borda de subida —
    // senão empilharia uma notificação a cada poucos segundos de garrio.
    if ("vibrate" in navigator) navigator.vibrate([500, 200, 500])
    if (!garrandoAnteriorRef.current && ancora && "Notification" in window && Notification.permission === "granted") {
      new Notification("Commander — alarme de âncora", {
        body: `A embarcação saiu do raio de ${ancora.raioM} m — verifique o fundeio.`,
      })
    }
    garrandoAnteriorRef.current = true
  }, [garrando, ancora])

  function fundear() {
    if (!posAtual) return
    setArmandoAncora(false)
    const nova: Ancora = { la: posAtual.la, lo: posAtual.lo, raioM }
    setAncora(nova)
    try {
      localStorage.setItem(CHAVE_ANCORA, JSON.stringify(nova))
    } catch {}
    if ("Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission()
    }
  }

  function desarmarAncora() {
    // o contador de leituras zera no watcher quando a âncora some; aqui só
    // apaga o banner na hora e derruba a âncora
    setGarrando(false)
    setAncora(null)
    try {
      localStorage.removeItem(CHAVE_ANCORA)
    } catch {}
  }

  // --- MOB (estado declarado no topo, junto do alarme) ---------------------
  // Sem confirmação de propósito: em homem-ao-mar, qualquer diálogo "tem
  // certeza?" é fricção que atrasa marcar o ponto e traçar o rumo de volta —
  // o único toque precisa registrar IMEDIATAMENTE.
  function acionarMob() {
    if (!posAtual) return
    const ponto: Coord = { la: posAtual.la, lo: posAtual.lo }
    setMob(ponto)
    setDestino({ la: ponto.la, lo: ponto.lo, nome: "Homem ao mar" })
    if ("vibrate" in navigator) navigator.vibrate([300, 100, 300, 100, 300])
  }

  // Sem GPS os recursos de bordo nao podem falhar mudos (feedback do dono):
  // este pedido re-abre o prompt do navegador quando o estado e "perguntar",
  // e explica o caminho quando ja foi negado.
  const [dicaGps, setDicaGps] = useState<string | null>(null)
  function pedirPosicao() {
    if (!("geolocation" in navigator)) {
      setDicaGps("Este aparelho não expõe localização ao navegador.")
      return
    }
    setDicaGps("Pedindo sua posição…")
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPosAtual({ la: p.coords.latitude, lo: p.coords.longitude })
        setSogKt(msParaNos(p.coords.speed))
        setDicaGps(null)
      },
      () => setDicaGps("Localização negada — autorize no cadeado da barra de endereço e tente de novo."),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  // Marcador de DESTINO no mapa (pino dourado) — os apps grandes sempre
  // mostram o ponto escolhido, com ou sem GPS; a linha de rumo e os numeros
  // chegam quando a posicao existir.
  useEffect(() => {
    if (!mapaPronto || !destino) return
    let cancelado = false
    let marcador: MarcadorMapbox | null = null
    import("mapbox-gl").then(({ default: mapboxgl }) => {
      if (cancelado) return
      marcador = new mapboxgl.Marker({ color: "#D4AF37" }).setLngLat([destino.lo, destino.la]).addTo(mapaPronto)
    })
    return () => {
      cancelado = true
      marcador?.remove()
    }
  }, [mapaPronto, destino])

  // Marcador do MOB no mapa — some se `mob` for limpo, some no unmount.
  useEffect(() => {
    if (!mapaPronto || !mob) return
    let cancelado = false
    let marcador: MarcadorMapbox | null = null
    import("mapbox-gl").then(({ default: mapboxgl }) => {
      if (cancelado) return
      marcador = new mapboxgl.Marker({ element: criarElementoMob(), anchor: "center" }).setLngLat([mob.lo, mob.la]).addTo(mapaPronto)
    })
    return () => {
      cancelado = true
      marcador?.remove()
    }
  }, [mapaPronto, mob])

  const mostrador = "rounded-[10px] border border-line bg-meter px-3 py-2 font-mono-instr tabular-nums text-meter-texto"
  const etiqueta = "text-[11px] uppercase tracking-[.14em] text-meter-dim"

  return (
    // Tela cheia: escapa do px-4/pt-5/pb-24 do layout com margens negativas;
    // a altura desconta a bottom nav fixa (~4rem). O mapa é a tela; todo o
    // resto flutua por cima.
    <main className="relative -mx-4 -mt-5 -mb-24 h-[calc(100dvh-4rem)]">
      <h1 className="sr-only">Navegar</h1>
      <MapaNautico aoIniciar={setMapaPronto} className="h-full w-full" />

      {/* coluna do topo: alarme + trilha EMPILHADOS (nunca se sobrepõem);
          right-14 deixa livres os controles do mapa (zoom/bússola/locate) */}
      <div className="absolute left-3 right-14 top-3 z-20 flex flex-col gap-2">
        {garrando && (
          <div role="alert" className="sombra-2 animate-pulse rounded-[12px] border border-crit bg-crit px-4 py-3 text-center text-sm font-bold text-white">
            GARRANDO — verifique o fundeio
          </div>
        )}

        <div className="sombra-2 overflow-hidden rounded-[14px] border border-line bg-panel/95 backdrop-blur">
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
              {/* SOG sempre visível quando há posição — pílula mono tabular no
                  padrão visual do horímetro (rounded + bg-meter). Vem do
                  coords.speed do GPS (sogKt), não do cálculo de trilha
                  (painel.velKt, que é a velocidade média entre pontos
                  gravados e continua só existindo durante a gravação). */}
              {sogKt != null && (
                <span className="rounded-full border border-line bg-meter px-2.5 py-1 font-mono-instr text-xs tabular-nums text-meter-texto">
                  {sogKt.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kt
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
                Auxílio à navegação: não substitui as cartas náuticas oficiais.
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

      </div>

      {/* Cluster de ações de navegação — canto inferior direito, acima da
          escala/atribuição; sobe quando o painel de rumo ocupa a faixa. */}
      <div className={`absolute right-3 z-20 flex flex-col items-end gap-2 ${destino ? "bottom-32" : "bottom-12"}`}>
          {mapaPronto && (
            <button
              type="button"
              onClick={() => setModoDefinirDestino((v) => !v)}
              aria-pressed={modoDefinirDestino}
              className={`sombra-2 flex h-11 items-center gap-1.5 rounded-full border px-3 text-sm font-medium backdrop-blur ${
                modoDefinirDestino ? "border-accent bg-accent text-acao-texto" : "border-line bg-panel/95 text-dim"
              }`}
            >
              <Icone nome="mapa" className="size-4" />
              {modoDefinirDestino ? "Toque no mapa…" : "Definir destino"}
            </button>
          )}

          {!ancora && !armandoAncora && (
            <button
              type="button"
              onClick={() => setArmandoAncora(true)}
              className="sombra-2 flex h-11 items-center gap-1.5 rounded-full border border-line bg-panel/95 px-3 text-sm font-medium text-dim backdrop-blur"
            >
              <Icone nome="ancora" className="size-4" />
              Fundeei
            </button>
          )}
          {!ancora && armandoAncora && (
            <div className="sombra-2 w-56 rounded-[12px] border border-line bg-panel/95 p-3 backdrop-blur">
              <label htmlFor="raio-ancora" className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-[.14em] text-dim">
                Raio do alarme
                <span className="font-mono-instr tabular-nums text-dim">{raioM} m</span>
              </label>
              <input
                id="raio-ancora"
                type="range"
                min={20}
                max={100}
                step={5}
                value={raioM}
                onChange={(e) => setRaioM(Number(e.target.value))}
                className="w-full"
              />
              <p className="apoio mt-1.5 text-dim">Alarme funciona com o app aberto — não dispara com a tela bloqueada.</p>
              {posAtual ? (
                <button
                  type="button"
                  onClick={fundear}
                  className="mt-2 flex h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-accent text-sm font-semibold text-acao-texto"
                >
                  <Icone nome="ancora" className="size-4" />
                  Armar alarme
                </button>
              ) : (
                <>
                  <p className="apoio mt-2 text-warn">Sem posição GPS — a âncora é marcada onde o barco está.</p>
                  {dicaGps && <p className="apoio mt-1 text-dim">{dicaGps}</p>}
                  <button
                    type="button"
                    onClick={pedirPosicao}
                    className="mt-2 flex h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-accent text-sm font-semibold text-acao-texto"
                  >
                    Ativar localização
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setArmandoAncora(false)}
                className="mt-1 flex h-11 w-full items-center justify-center text-sm text-dim"
              >
                Cancelar
              </button>
            </div>
          )}
          {ancora && (
            <button
              type="button"
              onClick={desarmarAncora}
              className="sombra-2 flex h-11 items-center gap-1.5 rounded-full border border-line bg-panel/95 px-3 text-sm font-medium backdrop-blur"
            >
              <Icone nome="ancora" className="size-4 text-accent-forte" />
              Desarmar âncora
            </button>
          )}

          <button
            type="button"
            onClick={acionarMob}
            disabled={!posAtual}
            aria-label="Homem ao mar"
            className="sombra-2 flex h-11 items-center gap-1.5 rounded-full bg-crit px-4 text-sm font-bold text-white disabled:opacity-50"
          >
            <Icone nome="alerta" className="size-4" />
            MOB
          </button>
        </div>

        {destino && (
          <div className="sombra-2 absolute inset-x-3 bottom-3 z-20 rounded-[12px] border border-line bg-panel/95 px-3 py-2.5 backdrop-blur">
            <div className="flex items-center justify-between gap-2">
              <span className="corpo flex min-w-0 items-center gap-2">
                <Icone nome="mapa" className="size-4 shrink-0 text-accent-forte" />
                <span className="truncate">Rumo para {destino.nome}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  // limpar o rumo tambem recolhe o marcador de MOB — senao ele
                  // ficaria orfao no mapa sem nenhum caminho de UI pra remover
                  setDestino(null)
                  setMob(null)
                }}
                aria-label="Limpar destino"
                className="flex size-8 shrink-0 items-center justify-center text-dim"
              >
                <Icone nome="mais" className="size-4 rotate-45" />
              </button>
            </div>
            {!posAtual && (
              <div className="mt-2 border-t border-line pt-2">
                <p className="apoio text-dim">Destino marcado no mapa. Ative a localização para ver rumo, distância e ETA daqui até lá.</p>
                {dicaGps && <p className="apoio mt-1 text-dim">{dicaGps}</p>}
                <button
                  type="button"
                  onClick={pedirPosicao}
                  className="mt-2 flex h-11 w-full items-center justify-center rounded-lg border border-line text-sm font-medium"
                >
                  Ativar localização
                </button>
              </div>
            )}
            {nav && (
              <div className="mt-2 grid grid-cols-3 gap-2 border-t border-line pt-2">
                <div className="text-center">
                  <p className="text-[10px] uppercase tracking-[.14em] text-dim">Distância</p>
                  <p className="font-mono-instr text-sm tabular-nums">
                    {nav.distanciaNm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MN
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] uppercase tracking-[.14em] text-dim">Rumo</p>
                  <p className="font-mono-instr text-sm tabular-nums">{Math.round(nav.rumo)}°</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] uppercase tracking-[.14em] text-dim">ETA</p>
                  <p className="font-mono-instr text-sm tabular-nums">{nav.eta != null ? `${nav.eta} min` : "—"}</p>
                </div>
              </div>
            )}
          </div>
        )}

      {parceiroAberto && (
        <CardParceiro
          parceiro={parceiroAberto}
          aoFechar={() => setParceiroAberto(null)}
          aoTracarRumo={(p) => {
            setDestino({ la: p.lat, lo: p.lng, nome: p.nome })
            setMob(null) // novo destino descarta o MOB — senao o marcador fica orfao
            setParceiroAberto(null)
          }}
        />
      )}
    </main>
  )
}
