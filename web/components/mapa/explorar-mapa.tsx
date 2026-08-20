"use client"
import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { Map as MapaMapbox, Marker as MarcadorMapbox } from "mapbox-gl"
import { CardParceiro } from "@/components/mapa/card-parceiro"
import { MapaNautico } from "@/components/mapa/mapa-nautico"
import { Icone } from "@/components/icone"
import { RedeNav } from "@/components/ui/rede-nav"
import type { EstadoCamadas } from "@/lib/mapa/camadas"
import { criarElementoMarcadorParceiro } from "@/lib/mapa/pino-parceiro"
import { filtrarParceiros, formatarMN, maisProximos } from "@/lib/domain/explorar"
import {
  FILTRO_TODOS, ICONE_TIPO_PARTNER, ROTULO_TIPO_PARTNER, TIPOS_PARTNER, type TipoPartner,
} from "@/lib/domain/partner"
import type { Parceiro } from "@/lib/db/types"

// Onda 51: a lista de categorias virou os TIPOS DE PARTNER do §13, com os
// rótulos vindos de `lib/domain/partner.ts` — mesma fonte da vitrine de
// cards, do card do mapa e do formulário do parceiro. Antes eram três listas
// escritas à mão que já discordavam entre si ("Posto" aqui, "Posto de
// combustível" no card).
const CATEGORIAS: { valor: TipoPartner | typeof FILTRO_TODOS; rotulo: string }[] = [
  { valor: FILTRO_TODOS, rotulo: "Todos" },
  ...TIPOS_PARTNER.map((t) => ({ valor: t, rotulo: ROTULO_TIPO_PARTNER[t] })),
]

/** Onda 39 (PRD upgrade2-master §52) — "descobrir onde ir e o que existe ao
 *  redor da navegação": mapa de parceiros (marina, posto, pousada,
 *  restaurante, loja náutica, outros) por categoria. Diferente de /navegar (instrumento de
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
export function ExplorarMapa({
  parceiros,
  amostraFree = false,
}: {
  parceiros: Parceiro[]
  /** Onda 47, §2.3 — a lista que chegou é a AMOSTRA do plano Free, já sem
   *  contato nem detalhe (o corte é feito no servidor, em
   *  `app/(app)/explorar/page.tsx`). Aqui a flag serve só pra dizer isso em
   *  voz alta: §24 proíbe limite silencioso, e um mapa com seis pinos sem
   *  explicação pareceria um app vazio, não um app com paywall. */
  amostraFree?: boolean
}) {
  const router = useRouter()

  useEffect(() => {
    document.body.classList.add("fundo-tela-mapa")
    return () => document.body.classList.remove("fundo-tela-mapa")
  }, [])

  const [mapaPronto, setMapaPronto] = useState<MapaMapbox | null>(null)
  // Centro atual da carta — é dele que a folha de "mais próximos" mede as
  // distâncias (canvas tela-3h). Atualiza no `moveend`, não a cada frame de
  // arrasto: a lista reordenando durante o gesto seria ruído, não instrumento.
  const [centro, setCentro] = useState<{ lat: number; lng: number } | null>(null)
  // Preferência de dispositivo compartilhada com /navegar (MapaNautico lê/
  // grava em localStorage) — desligar "Parceiros" aqui também desliga lá, o
  // que é o comportamento certo: é a MESMA camada, não uma cópia.
  const [mostrarParceiros, setMostrarParceiros] = useState(true)
  const [categoria, setCategoria] = useState<TipoPartner | typeof FILTRO_TODOS>(FILTRO_TODOS)
  // Onda 62 (canvas tela-3h) — a busca de verdade que o C2 deixou de fora e o
  // dono mandou fazer. CLIENT-SIDE sobre a lista que já está na memória: zero
  // consulta nova (a regra pura `filtrarParceiros` vive em lib/domain/explorar
  // e casa nome + rótulo do tipo, sem acento atrapalhar).
  const [termo, setTermo] = useState("")
  const [parceiroAberto, setParceiroAberto] = useState<Parceiro | null>(null)
  const marcadoresRef = useRef<MarcadorMapbox[]>([])

  // Busca e chip de categoria são o MESMO mecanismo de sempre: quem sai de
  // `filtrados` some dos pinos E da folha de baixo de uma vez — o efeito dos
  // marcadores e a lista dos próximos já dependiam desta lista, nada de
  // lógica nova de mapa.
  const filtrados = useMemo(
    () =>
      filtrarParceiros(
        categoria === FILTRO_TODOS ? parceiros : parceiros.filter((p) => p.categoria === categoria),
        termo,
      ),
    [parceiros, categoria, termo],
  )

  useEffect(() => {
    if (!mapaPronto) return
    const atualizar = () => {
      const c = mapaPronto.getCenter()
      setCentro({ lat: c.lat, lng: c.lng })
    }
    atualizar()
    mapaPronto.on("moveend", atualizar)
    return () => {
      mapaPronto.off("moveend", atualizar)
    }
  }, [mapaPronto])

  const proximos = useMemo(
    () => (centro ? maisProximos(filtrados, centro, 3) : []),
    [filtrados, centro],
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
        <div className="pointer-events-auto flex items-center gap-2">
          <RedeNav atual="explorar" variant="mapa" />
          {/* Onda 51 — o §10 põe os cards como experiência principal, então o
              mapa deixou de ser a porta de entrada do Explorar. A volta pra
              vitrine fica a um toque, do mesmo jeito que a ida pro mapa. */}
          <Link
            href="/explorar"
            className="sombra-2 flex h-11 shrink-0 items-center rounded-[var(--raio-pilula)] border border-mapa-instrumento-borda bg-mapa-instrumento px-3.5 text-sm font-medium text-meter-texto"
          >
            Vitrine
          </Link>
        </div>
        {/* Onda 62 (canvas tela-3h) — o campo de busca em pastilha, acima dos
            chips como na fatia: lupa, placeholder honesto e 44px de alvo. Não
            aparece na amostra Free de propósito: ali chegam só alguns
            parceiros sorteados e a folha de resultados nem existe — uma busca
            que quase sempre acha nada leria como app vazio, não como paywall
            (§24: limite dito em voz alta, nunca encenado). */}
        {!amostraFree && (
          <div className="pointer-events-auto sombra-2 flex h-11 items-center gap-2.5 rounded-[var(--raio-pilula)] border border-mapa-instrumento-borda bg-mapa-instrumento px-4">
            <Icone nome="buscar" className="size-[17px] shrink-0 text-meter-dim" />
            <input
              type="search"
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              placeholder="Buscar marina, posto, ponto…"
              aria-label="Buscar parceiro por nome ou tipo"
              className="h-full w-full min-w-0 bg-transparent text-sm text-meter-texto outline-none placeholder:text-meter-dim"
            />
          </div>
        )}
        {/* Onda 62 (canvas tela-3h) — o chip flutuante sobe pro alvo de 44px
            da régua do app (era h-9/36px, abaixo do que a varredura cobra). */}
        <div
          className="rolagem-lateral pointer-events-auto sombra-2 flex gap-1.5 overflow-x-auto rounded-[var(--raio-pilula)] border border-mapa-instrumento-borda bg-mapa-instrumento p-1"
          style={{ scrollbarWidth: "none" }}
        >
          {CATEGORIAS.map((c) => (
            <button
              key={c.valor}
              type="button"
              onClick={() => setCategoria(c.valor)}
              aria-pressed={categoria === c.valor}
              className={`h-11 shrink-0 whitespace-nowrap rounded-[var(--raio-pilula)] px-3.5 text-sm ${
                categoria === c.valor ? "bg-accent font-semibold text-acao-texto" : "font-medium text-meter-texto"
              }`}
            >
              {c.rotulo}
            </button>
          ))}
        </div>
      </div>

      {amostraFree && (
        <div className="pointer-events-auto absolute inset-x-3 bottom-24 z-10">
          <div className="sombra-2 rounded-[var(--raio-cartao)] border border-accent/30 bg-mapa-instrumento p-3 text-center">
            <p className="corpo font-medium text-meter-texto">Você está vendo uma amostra</p>
            <p className="apoio mt-1 text-meter-texto/70">
              No plano gratuito o Explorar mostra alguns parceiros só com nome e foto. Assine o Commander para
              ver perfil completo, contato e preços.
            </p>
            <Link
              href="/menu/assinatura"
              className="mt-2.5 inline-block rounded-[var(--raio-controle)] bg-accent px-4 py-2 text-sm font-semibold text-acao-texto"
            >
              Ver planos
            </Link>
          </div>
        </div>
      )}

      {/* Onda 62 (canvas tela-3h) — "metade carta, metade lista": a folha de
          baixo mostra os mais próximos do centro da carta, com a distância
          sempre em MN e sempre em mono. Some quando um parceiro está aberto
          (o CardParceiro ocupa o mesmo lugar) e na amostra Free (ali o aviso
          de amostra é a mensagem mais importante do rodapé). */}
      {!amostraFree && !parceiroAberto && centro && (
        <div className="sombra-2 absolute inset-x-0 bottom-0 z-10 rounded-t-[var(--raio-painel)] border-t border-mapa-instrumento-borda bg-mapa-instrumento px-4 pb-3 pt-3">
          <div aria-hidden="true" className="mx-auto mb-2.5 h-1 w-9 rounded-[var(--raio-pilula)] bg-mapa-instrumento-borda" />
          <div className="mb-1 flex items-baseline gap-2">
            <p className="rotulo flex-1 text-meter-dim">
              <span className="tabular-nums">{proximos.length}</span>
              {proximos.length === 1 ? " parceiro por perto" : " parceiros por perto"}
            </p>
            {proximos.length > 0 && <p className="apoio text-meter-dim">Mais próximos</p>}
          </div>
          {proximos.length === 0 ? (
            <p className="apoio py-2 text-meter-dim">
              {/* Vazio honesto por causa: busca sem resultado fala da busca;
                  sem busca, a mensagem por categoria continua a de sempre. */}
              {termo.trim() !== ""
                ? "Nada com esse nome por aqui."
                : categoria === FILTRO_TODOS
                  ? "Nenhum parceiro neste trecho da carta ainda."
                  : `Nenhum ${ROTULO_TIPO_PARTNER[categoria].toLowerCase()} neste trecho da carta.`}
            </p>
          ) : (
            proximos.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setParceiroAberto(p)}
                className="flex min-h-11 w-full items-center gap-3 border-b border-mapa-instrumento-borda py-2.5 text-left last:border-0"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-[var(--raio-controle)] border border-mapa-instrumento-borda bg-meter">
                  <Icone nome={ICONE_TIPO_PARTNER[p.categoria]} className="size-5 text-meter-dim" />
                </span>
                <span className="min-w-0 flex-1">
                  {/* !text-meter-texto (onda 80, achado tardio): `.titulo-card`
                      ganhou `color: var(--texto)` fixo (ver app/globals.css) —
                      sem o `!`, o override perde pra cor embutida na classe e
                      o nome do parceiro some no tema claro (navy sobre navy,
                      mesmo bug corrigido em navegar-mapa.tsx/sondagem-painel.tsx). */}
                  <span className="titulo-card block truncate !text-meter-texto">{p.nome}</span>
                  <span className="apoio block text-meter-dim">{ROTULO_TIPO_PARTNER[p.categoria]}</span>
                </span>
                <span className="shrink-0 tabular-nums text-sm font-semibold tabular-nums text-meter-texto">
                  {formatarMN(p.distanciaNm)}
                </span>
              </button>
            ))
          )}
        </div>
      )}

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
