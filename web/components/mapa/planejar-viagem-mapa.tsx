"use client"
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { Map as MapaMapbox, MapMouseEvent, GeoJSONSource } from "mapbox-gl"
import { MapaNautico } from "@/components/mapa/mapa-nautico"
import { Icone } from "@/components/icone"
import { avisoCaladoViagem, usePernasViagem, usouCorredoresViagem } from "@/components/mapa/usar-pernas-viagem"
import { useCoresMapa } from "@/components/mapa/usar-cores-mapa"
import { criarCamadasViagem, pintarCamadasViagem } from "@/lib/mapa/camadas-viagem"
import { criarViagem } from "@/lib/acoes/viagem"
import {
  montarViagem,
  velocidadeCruzeiroHistorica,
  velocidadeCruzeiroInformada,
  type EventoComTrilha,
  type Parada,
} from "@/lib/domain/viagem"
import { hojeISO } from "@/lib/domain/datas"
import { parseDecimalPtBr } from "@/lib/domain/numeros"
import { campo, rot } from "@/lib/ui/form"

// ONDA 89 (achado 4.1) — as cores das camadas eram dois literais aqui e
// outros dois iguais em VerViagemMapa. Desenho e cor foram os dois pra
// lib/mapa/camadas-viagem.ts: passar a ler token exigiria manter DUAS
// repinturas de tema em sincronia, e é assim que uma delas fica pra trás.

// `campo`/`rot` vêm de `lib/ui/form` — este arquivo mantinha uma cópia local
// das mesmas duas strings, então um ajuste no estilo de campo do app não
// chegava aqui. O alias preserva o nome `rotulo` já usado no JSX abaixo.
const rotulo = rot

/**
 * Planejar viagem (onda 19, Pilar Strava do Mar): escolher paradas TOCANDO
 * no mapa (mesmo mecanismo do modo "Definir destino" de navegar-mapa.tsx —
 * crosshair + `mapa.on("click")` — só que aqui cada toque ACRESCENTA uma
 * parada em vez de substituir um destino único), nomear cada uma, escolher
 * o nome da viagem, a data prevista e a velocidade de cruzeiro (histórico
 * das saídas com trilha se houver, senão informada na hora — nunca
 * inventada, ver web/lib/domain/viagem.ts), e salvar.
 *
 * Cada perna é traçada PELA ÁGUA pelo mesmo motor A* de sempre (o Worker
 * `rota.worker.ts`, via `usarPernasViagem`) — nunca uma linha reta
 * decorativa. Perna sem caminho (calado, fora da área) aparece honesta na
 * lista, com uma linha tracejada vermelha no mapa em vez de sumir.
 */
export function PlanejarViagemMapa({
  caladoM,
  eventosComTrilha,
}: {
  caladoM: number | null
  eventosComTrilha: EventoComTrilha[]
}) {
  const router = useRouter()
  const [mapaPronto, setMapaPronto] = useState<MapaMapbox | null>(null)
  const [paradas, setParadas] = useState<Parada[]>([])
  const [modoAdicionar, setModoAdicionar] = useState(true)
  const [nomeViagem, setNomeViagem] = useState("")
  const [dataPrevista, setDataPrevista] = useState("")
  const [velocidadeTexto, setVelocidadeTexto] = useState("")
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Cores das camadas por token do documento (onda 89, achado 4.1).
  const cores = useCoresMapa()

  const pernasEstado = usePernasViagem(paradas, caladoM)

  const velocidadeHistorica = useMemo(() => velocidadeCruzeiroHistorica(eventosComTrilha), [eventosComTrilha])
  const velInformadaKt = parseDecimalPtBr(velocidadeTexto)
  const velocidade =
    velocidadeHistorica ?? (velInformadaKt != null && velInformadaKt > 0 ? velocidadeCruzeiroInformada(velInformadaKt) : null)

  const viagem = useMemo(
    () => montarViagem(paradas, pernasEstado.map((p) => p.pontos), velocidade),
    [paradas, pernasEstado, velocidade],
  )
  const algumaCalculando = pernasEstado.some((p) => p.carregando)
  const avisoCalado = useMemo(() => avisoCaladoViagem(pernasEstado, caladoM), [pernasEstado, caladoM])
  const usouCorredores = useMemo(() => usouCorredoresViagem(pernasEstado), [pernasEstado])

  function renomearParada(indice: number, nome: string) {
    setParadas((atual) => atual.map((p, i) => (i === indice ? { ...p, nome } : p)))
  }
  function removerParada(indice: number) {
    setParadas((atual) => atual.filter((_, i) => i !== indice))
  }

  // Toque no mapa acrescenta parada — mesmo mecanismo do modo "Definir
  // destino" de navegar-mapa.tsx (cursor crosshair + `mapa.on("click")`),
  // só que fica LIGADO entre toques (permite marcar várias paradas em
  // sequência) em vez de desligar depois do primeiro.
  useEffect(() => {
    if (!mapaPronto) return
    mapaPronto.getCanvas().style.cursor = modoAdicionar ? "crosshair" : ""
    if (!modoAdicionar) return
    function aoClicarNoMapa(e: MapMouseEvent) {
      setParadas((atual) => [...atual, { nome: `Parada ${atual.length + 1}`, la: e.lngLat.lat, lo: e.lngLat.lng }])
    }
    mapaPronto.on("click", aoClicarNoMapa)
    return () => {
      mapaPronto.off("click", aoClicarNoMapa)
    }
  }, [mapaPronto, modoAdicionar])

  // Fontes/camadas do mapa — criadas uma vez, atualizadas via setData abaixo.
  // `cores` entra nas dependências porque a criação é idempotente (guardada
  // por `getSource`): numa troca de tema o efeito só chega na repintura.
  useEffect(() => {
    if (!mapaPronto) return
    criarCamadasViagem(mapaPronto, cores)
    pintarCamadasViagem(mapaPronto, cores)
  }, [mapaPronto, cores])

  // Redesenha paradas (pontos numerados) a cada mudança da lista.
  useEffect(() => {
    if (!mapaPronto) return
    const source = mapaPronto.getSource("viagem-paradas") as GeoJSONSource | undefined
    if (!source) return
    source.setData({
      type: "FeatureCollection",
      features: paradas.map((p, i) => ({
        type: "Feature" as const,
        properties: { rotulo: String(i + 1) },
        geometry: { type: "Point" as const, coordinates: [p.lo, p.la] },
      })),
    })
  }, [mapaPronto, paradas])

  // Redesenha as pernas — linha dourada pela água pra quem tem caminho,
  // tracejado vermelho (reta entre as duas paradas, só pra indicar QUAL
  // perna falhou) pra quem não tem.
  useEffect(() => {
    if (!mapaPronto) return
    const sourceOk = mapaPronto.getSource("viagem-pernas-ok") as GeoJSONSource | undefined
    const sourceFalha = mapaPronto.getSource("viagem-pernas-sem-caminho") as GeoJSONSource | undefined
    if (!sourceOk || !sourceFalha) return
    const featuresOk: unknown[] = []
    const featuresFalha: unknown[] = []
    viagem.pernas.forEach((perna, i) => {
      const estado = pernasEstado[i]
      if (perna.pontos) {
        featuresOk.push({
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: perna.pontos.map((p) => [p.lo, p.la]) },
        })
      } else if (estado && !estado.carregando) {
        featuresFalha.push({
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [
              [perna.de.lo, perna.de.la],
              [perna.para.lo, perna.para.la],
            ],
          },
        })
      }
    })
    sourceOk.setData({ type: "FeatureCollection", features: featuresOk })
    sourceFalha.setData({ type: "FeatureCollection", features: featuresFalha })
  }, [mapaPronto, viagem, pernasEstado])

  async function salvar() {
    setErro(null)
    if (nomeViagem.trim() === "") return setErro("Dê um nome pra viagem.")
    if (dataPrevista === "") return setErro("Escolha a data prevista de saída.")
    if (paradas.length < 2) return setErro("Marque pelo menos a origem e o destino no mapa.")
    if (paradas.some((p) => p.nome.trim() === "")) return setErro("Dê um nome pra cada parada.")
    setSalvando(true)
    const r = await criarViagem(nomeViagem, dataPrevista, paradas)
    setSalvando(false)
    if (!r.ok) return setErro(r.erro)
    router.push(`/navegar/viagem/${r.id}`)
  }

  return (
    // O `-mt-5` NÃO é espaçamento escolhido no olho, e por isso não virou
    // `-mt-6` na varredura do achado 5.11: ele é a NEGAÇÃO exata do `pt-5` de
    // `components/moldura-app.tsx`, a mesma técnica de tela cheia de
    // `NavegarMapa`. Os dois números andam juntos ou o mapa sobe/desce 4px
    // sobre a barra de cima — mexer aqui sozinho quebra o encaixe.
    <main className="relative -mx-4 -mt-5 -mb-24 h-[calc(100dvh-4rem)]">
      <h1 className="sr-only">Planejar viagem</h1>
      <MapaNautico aoIniciar={setMapaPronto} className="h-full w-full" />

      <div className="absolute left-3 right-14 top-3 z-20">
        <button
          type="button"
          onClick={() => setModoAdicionar((v) => !v)}
          aria-pressed={modoAdicionar}
          className={`sombra-2 flex h-11 w-full items-center justify-center gap-1.5 rounded-[var(--raio-pilula)] border px-4 text-sm font-medium backdrop-blur ${
            modoAdicionar ? "border-accent bg-accent text-acao-texto" : "border-line bg-panel/95 text-dim"
          }`}
        >
          <Icone nome="mapa" className="size-4" />
          {modoAdicionar ? "Toque no mapa para marcar uma parada" : "Adicionar parada"}
        </button>
      </div>

      <div className="sombra-2 absolute inset-x-0 bottom-0 z-20 max-h-[62dvh] overflow-y-auto rounded-t-[18px] border-t border-line bg-panel/95 p-4 backdrop-blur">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="titulo-card">Nova viagem</h2>
          {/* ESTE É O ÚNICO CAMINHO DE VOLTA DESTA TELA — o mapa ocupa a
              tela inteira, não há `CabecalhoDetalhe` e a barra de baixo fica
              coberta pela folha. Estava com `size-9` (36px), abaixo dos 44px
              que o resto do app respeita: a saída existia mas escapava do
              dedo. Rótulo visível junto do ícone porque um "×" sozinho num
              canto não se lê como "sair daqui". */}
          <button
            type="button"
            onClick={() => router.push("/navegar")}
            aria-label="Cancelar e voltar para Navegar"
            className="-mr-2 flex h-11 items-center gap-1 rounded-[var(--raio-controle)] px-2 text-dim"
          >
            <Icone nome="mais" className="size-4 rotate-45" />
            <span className="rotulo">Cancelar</span>
          </button>
        </div>

        {paradas.length === 0 ? (
          <p className="apoio text-dim">Toque no mapa pra marcar a origem, as paradas e o destino, em ordem.</p>
        ) : (
          <div className="space-y-2">
            {paradas.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-[var(--raio-pilula)] bg-accent/15 font-mono-instr text-xs font-semibold text-accent-forte">
                  {i + 1}
                </span>
                <input
                  value={p.nome}
                  onChange={(e) => renomearParada(i, e.target.value)}
                  className={`${campo} py-2`}
                  aria-label={`Nome da parada ${i + 1}`}
                />
                <button
                  type="button"
                  onClick={() => removerParada(i)}
                  aria-label={`Remover parada ${i + 1}`}
                  className="flex size-9 shrink-0 items-center justify-center text-dim"
                >
                  <Icone nome="mais" className="size-4 rotate-45" />
                </button>
              </div>
            ))}
          </div>
        )}

        {viagem.pernas.length > 0 && (
          <div className="mt-3 space-y-1.5 border-t border-line pt-3">
            {viagem.pernas.map((perna, i) => {
              const estado = pernasEstado[i]
              return (
                <p key={i} className="apoio flex items-center justify-between gap-2 text-dim">
                  <span className="truncate">{perna.de.nome} → {perna.para.nome}</span>
                  {estado?.carregando ? (
                    <span className="shrink-0">calculando…</span>
                  ) : perna.distanciaNm != null ? (
                    <span className="shrink-0 font-mono-instr tabular-nums">
                      {perna.distanciaNm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MN
                      {perna.etaMin != null && ` · ${Math.round(perna.etaMin)} min`}
                    </span>
                  ) : (
                    <span className="shrink-0 text-warn">
                      {estado?.foraDaArea ? "fora da área mapeada" : "sem caminho pela água"}
                    </span>
                  )}
                </p>
              )
            })}
            <p className="apoio flex items-center justify-between gap-2 pt-1 font-medium">
              <span>Total{!viagem.completa && " (parcial — falta trecho acima)"}</span>
              <span className="font-mono-instr tabular-nums">
                {viagem.distanciaTotalNm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MN
                {viagem.etaTotalMin != null && ` · ${Math.round(viagem.etaTotalMin / 60)} h ${Math.round(viagem.etaTotalMin % 60)} min`}
              </span>
            </p>
            {/* Mesmos disclaimers do /navegar — a rota planejada herda a honestidade
                de sempre, não inventa um texto novo (ver usar-pernas-viagem.ts). */}
            {avisoCalado && (
              <p className={`apoio pt-1 ${avisoCalado.tom === "aviso" ? "text-warn" : "text-dim"}`}>
                {avisoCalado.texto}
                {avisoCalado.linkCadastrar && (
                  <>
                    {" "}
                    <Link href="/barco/editar" className="underline">Cadastrar calado</Link>
                  </>
                )}
              </p>
            )}
            {usouCorredores && (
              <p className="apoio pt-1 text-dim">
                Considera passagens reais de outros barcos nesta área — não é garantia de profundidade.
              </p>
            )}
          </div>
        )}

        <div className="mt-3 space-y-3 border-t border-line pt-3">
          <div>
            <label className={rotulo} htmlFor="nome-viagem">Nome da viagem</label>
            <input
              id="nome-viagem"
              value={nomeViagem}
              onChange={(e) => setNomeViagem(e.target.value)}
              placeholder="Ex.: Fim de semana em Ilha Grande"
              className={campo}
            />
          </div>
          <div>
            <label className={rotulo} htmlFor="data-viagem">Data prevista de saída</label>
            <input
              id="data-viagem"
              type="date"
              min={hojeISO()}
              value={dataPrevista}
              onChange={(e) => setDataPrevista(e.target.value)}
              className={campo}
            />
          </div>

          {velocidadeHistorica ? (
            <p className="apoio text-dim">ETA calculado {velocidadeHistorica.texto}.</p>
          ) : (
            <div>
              <label className={rotulo} htmlFor="velocidade-viagem">Velocidade de cruzeiro (kt) — opcional</label>
              <input
                id="velocidade-viagem"
                inputMode="decimal"
                value={velocidadeTexto}
                onChange={(e) => setVelocidadeTexto(e.target.value)}
                placeholder="Ex.: 18"
                className={`${campo} font-mono-instr tabular-nums`}
              />
              <p className="apoio mt-1 text-dim">
                Sem saída com trilha registrada ainda — informe pra ver o ETA por perna. Não é salvo, só estima esta viagem.
              </p>
            </div>
          )}

          {erro && <p className="rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2 corpo">{erro}</p>}

          <button
            type="button"
            onClick={salvar}
            disabled={salvando || algumaCalculando || paradas.length < 2}
            className="flex h-11 w-full items-center justify-center gap-1.5 rounded-[var(--raio-controle)] bg-accent text-sm font-semibold text-acao-texto disabled:opacity-50"
          >
            {salvando ? "Salvando…" : "Salvar viagem"}
          </button>
        </div>
      </div>
    </main>
  )
}
