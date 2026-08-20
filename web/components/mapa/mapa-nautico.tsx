"use client"
import { useEffect, useRef, useState } from "react"
import "mapbox-gl/dist/mapbox-gl.css"
import type { IControl, Map as MapaMapbox } from "mapbox-gl"
import { Icone, type NomeIcone } from "@/components/icone"
import { ESTILOS_MAPA, carregarCamadas, salvarCamadas, type ChaveCamada, type EstadoCamadas, type EstiloMapa } from "@/lib/mapa/camadas"

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

// Baía da Ilha Grande — praça inicial do Commander.
const CENTRO_PADRAO: [number, number] = [-44.14, -23.09]

/** Config do estilo "nautico" (`standard`) — mesma de sempre: instrumento de
 *  bordo, não mapa de carro. Extraída pra constante porque é reaplicada toda
 *  vez que se volta pro estilo náutico vindo de satélite/relevo (setStyle). */
const CONFIG_NAUTICO = {
  basemap: {
    theme: "faded",
    lightPreset: "day",
    showRoadLabels: false,
    showTransitLabels: false,
    showPointOfInterestLabels: false,
    show3dObjects: false,
  },
} as const

/** URL do estilo-base do Mapbox por opção do painel (pedido do dono,
 *  comparando com o "Satellite Imagery" do Navionics). "relevo3d" reaproveita
 *  o MESMO estilo satélite — o relevo 3D é `setTerrain` + câmera inclinada
 *  por cima dele (ver `aplicarTerrenoEPitch` mais abaixo), não um 4º estilo;
 *  isso também evita um `setStyle()` (que destrói camadas customizadas, ver
 *  comentário grande abaixo) ao alternar só entre satélite e relevo. */
const ESTILO_URL: Record<EstiloMapa, string> = {
  nautico: "mapbox://styles/mapbox/standard",
  satelite: "mapbox://styles/mapbox/satellite-streets-v12",
  relevo3d: "mapbox://styles/mapbox/satellite-streets-v12",
}

const ROTULO_ESTILO: Record<EstiloMapa, string> = {
  nautico: "Náutico",
  satelite: "Satélite",
  relevo3d: "Relevo 3D",
}

// Nenhum dos 28 ícones de components/icone.tsx é "satélite" ou "montanha"
// dedicado (mesma situação de "bússola"/"camadas" documentada acima) —
// "imagem" (moldura de foto) é o mais próximo de "imagem de satélite", e
// "grafico" (barras ascendentes) é o mais próximo de "perfil de elevação".
const ICONE_ESTILO: Record<EstiloMapa, NomeIcone> = {
  nautico: "mapa",
  satelite: "imagem",
  relevo3d: "grafico",
}

/** Pitch (inclinação da câmera) por estilo — só o relevo 3D nasce inclinado;
 *  os outros dois voltam pra vista de cima ao serem escolhidos. */
const PITCH_ESTILO: Record<EstiloMapa, number> = {
  nautico: 0,
  satelite: 0,
  relevo3d: 60,
}

const SOURCE_TERRENO = "mapbox-dem"

/**
 * ONDA 89 (achado 4.2) — OS TRÊS CONTROLES MAIS TOCADOS DO APP ENTRAM NA
 * RÉGUA DE 44px.
 *
 * Zoom, bússola e localizar nasciam com os 32px default do `mapbox-gl.css`.
 * O `docs/DESIGN.md` §5 escreve 44px sem exceção, e a varredura de alvo de
 * toque mede isso em toda tela — menos aqui, porque o markup é do Mapbox e
 * não passa por classe nossa. 32 contra 44 é 27% abaixo da régua, e a tela
 * onde isso pesa é justamente a de mar aberto: barco balançando, sol na
 * tela, mão molhada.
 *
 * O que muda é SÓ A CAIXA. O ícone é `background-image` de um SVG sem
 * dimensão intrínseca — sem `background-size` ele esticaria junto com a
 * caixa e ficaria borrado. Travar em 32px mantém o desenho exatamente como
 * está e centraliza os 12px de folga, que é o caminho barato do achado.
 * ALTERNATIVA DESCARTADA: trocar os três por `BotaoCirculo` nosso — resolve
 * também, mas reimplementa zoom/bússola/geolocalização inteiros pra ganhar
 * 12px de caixa.
 *
 * MORA NO COMPONENTE, e não em `app/globals.css` junto do resto do skin dos
 * controles, porque é onde o mapa é montado — quem ler este arquivo vê a
 * régua valendo. `!important` só no par que o `mapbox-gl.css` importado
 * declara com a mesma especificidade; `background-size` não tem
 * concorrente, então entra limpo.
 */
const CSS_ALVO_TOQUE_MAPBOX = `
.mapboxgl-ctrl-group button { width: 44px !important; height: 44px !important; }
.mapboxgl-ctrl-group button .mapboxgl-ctrl-icon { background-size: 32px 32px; background-position: center; }
`

/** `SetStyleOptions` não é exportado pelo pacote `mapbox-gl` (é um tipo
 *  interno do .d.ts), e a versão instalada (v3.28) marca `localFontFamily`/
 *  `localIdeographFontFamily` como obrigatórios mesmo aceitando `undefined`
 *  — bug conhecido do pacote: o próprio exemplo oficial da Mapbox chama
 *  `setStyle(url, { config: {...} })` sem esses dois campos. Derivar o tipo
 *  via `Parameters<>` (em vez de tipar à mão ou usar `as`) mantém a chamada
 *  type-safe de verdade, sem escapar do compilador. */
type OpcoesSetStyle = NonNullable<Parameters<MapaMapbox["setStyle"]>[1]>

function opcoesParaEstilo(estilo: EstiloMapa): OpcoesSetStyle | undefined {
  if (estilo !== "nautico") return undefined
  return { config: CONFIG_NAUTICO, localFontFamily: undefined, localIdeographFontFamily: undefined }
}

/** Liga/desliga o terreno 3D (Mapbox GL JS v3.28 — `map.setTerrain` +
 *  source `raster-dem`, API estável desde a v2, confirmada na doc atual:
 *  https://docs.mapbox.com/mapbox-gl-js/example/add-terrain/). Só existe
 *  quando o estilo já está carregado (senão `addSource`/`setTerrain` não tem
 *  o que aplicar) — por isso só é chamada de dentro de "style.load" ou
 *  quando o estilo-base não mudou (satélite ⇄ relevo3d, mesma URL). */
function aplicarTerrenoEPitch(mapa: MapaMapbox, estilo: EstiloMapa): void {
  if (estilo === "relevo3d") {
    if (!mapa.getSource(SOURCE_TERRENO)) {
      mapa.addSource(SOURCE_TERRENO, {
        type: "raster-dem",
        url: "mapbox://mapbox.mapbox-terrain-dem-v1",
        tileSize: 512,
        maxzoom: 14,
      })
    }
    mapa.setTerrain({ source: SOURCE_TERRENO, exaggeration: 1.5 })
  } else {
    mapa.setTerrain(null)
  }
  mapa.setPitch(PITCH_ESTILO[estilo])
}

/** Some com rótulos/ícones de POI de terceiros (marinas, restaurantes,
 *  postos, hospedagem…) vindos do mapa-base do Mapbox — decisão de negócio
 *  do dono: só quem fecha parceria aparece no mapa (Pedido 3, onda 10). No
 *  estilo "nautico" (`standard`) isso já é feito declarativamente via
 *  `config.basemap.showPointOfInterestLabels: false` acima; mas os estilos
 *  clássicos (satélite/relevo3d, `satellite-streets-v12`) NÃO são
 *  fragmentos "Standard" — não entendem `config`, então precisam da mesma
 *  coisa feita camada a camada. `poi-label` é o único symbol layer desse
 *  estilo com `metadata["mapbox:featureComponent"] === "point-of-interest-labels"`
 *  (conferido inspecionando o style JSON real via Styles API) — cobre TODAS
 *  as categorias de POI (inclusive "marina"/"harbor"), não só uma. Rodar
 *  isso também no náutico é inofensivo (idempotente) e serve de rede de
 *  segurança caso a Mapbox troque a implementação do config no futuro. */
function ocultarPoisDeTerceiros(mapa: MapaMapbox): void {
  const estiloAtual = mapa.getStyle()
  if (!estiloAtual?.layers) return
  for (const camada of estiloAtual.layers) {
    if (camada.type !== "symbol") continue
    const metadados = (camada as { metadata?: Record<string, unknown> }).metadata
    const ehPoi =
      metadados?.["mapbox:featureComponent"] === "point-of-interest-labels" || camada.id.toLowerCase().includes("poi")
    if (ehPoi) mapa.setLayoutProperty(camada.id, "visibility", "none")
  }
}

/** Metadados de `batimetria.json`/`batimetria-ampla.json` (gerado por
 *  scripts/gerar-batimetria.mjs) — só os 4 campos que viram os cantos da
 *  imagem no mapa. */
interface BatimetriaMetadados {
  lngMin: number
  latMin: number
  lngMax: number
  latMax: number
}

/** Zoom onde a camada "ampla" (costa brasileira inteira, baixa resolução)
 *  cede lugar pra "fina" (região de operação, alta resolução). Escolhido
 *  porque é aproximadamente o zoom em que a bbox da camada fina (~4° de
 *  longitude) já preenche a largura de uma tela típica — abaixo disso, a
 *  fina sozinha deixaria o resto do mapa sem cor (o bug que esta camada
 *  ampla resolve); acima disso, ela é mais precisa e a ampla só serrilharia
 *  por cima. minzoom/maxzoom tornam as duas mutuamente exclusivas, sem
 *  dupla pintura. */
const ZOOM_TRANSICAO_BATIMETRIA = 8

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
    // Onda 24 (passe de arte, bloco 3) — o resto do grupo (.mapboxgl-ctrl-icon
    // dos controles NATIVOS do Mapbox) vira claro via filter:invert em
    // globals.css; este ícone é SVG inline nosso e não usa essa classe.
    //
    // Onda 89 (achado 4.1) — o traço era um literal claro escrito à mão. O
    // botão passa a carregar `text-meter-texto` e o SVG desenha em
    // `currentColor`: é DOM, não canvas, então a classe utilitária resolve o
    // token sozinha nos dois temas. `currentColor` e não uma classe direta
    // no <svg> de propósito — se a utilitária um dia sumir, o traço herda a
    // cor do texto em volta em vez de virar `none` e desaparecer.
    botao.className = "text-meter-texto"
    botao.innerHTML =
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" ' +
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

/**
 * ONDA 115 — A BÚSSOLA DE VERDADE, no lugar da setinha do Mapbox.
 * ===========================================================================
 * Pedido do dono: *"falta uma bússola bem discreta mas funcional no mapa"*.
 * O mapa TINHA bússola — a do `NavigationControl` — mas ela é um sprite de
 * 18px genérico que mais parece um ponteiro de relógio, e num app náutico a
 * bússola não é enfeite de canto: é o instrumento que diz para onde a carta
 * está virada.
 *
 * Esta é uma ROSA DOS VENTOS desenhada na linguagem de instrumento da casa:
 * anel com os quatro pontos cardeais, agulha norte em OURO (o dourado do
 * bloco `.bg-mapa-instrumento`, calibrado pro navy fixo — não o do tema),
 * contra-agulha discreta. FUNCIONAL nos dois sentidos:
 *   · a rosa INTEIRA gira com o rumo do mapa (`map.on("rotate")`), então o
 *     "N" aponta sempre para o norte verdadeiro da carta;
 *   · tocar nela endireita o mapa (`easeTo bearing 0, pitch 0`) — o mesmo
 *     gesto da bússola nativa, que ninguém descobria naquele sprite.
 *
 * DOM puro (IControl), como todo controle deste mapa. `bg-mapa-instrumento`
 * no botão é o que faz `var(--acao)` resolver para o ouro DE INSTRUMENTO em
 * qualquer tema — sem a classe, o tema claro pintaria a agulha com um dourado
 * escuro ilegível sobre navy (3,02:1, o defeito que aquele bloco existe para
 * impedir).
 */
class ControleBussola implements IControl {
  private container: HTMLDivElement | null = null
  private rosa: SVGSVGElement | null = null
  private mapa: MapaMapbox | null = null
  /**
   * ONDA 117 — A BÚSSOLA PASSA A GIRAR COM O CELULAR ("quero uma bússola que
   * funciona"). O rumo do aparelho vem do sensor de orientação:
   *   · iOS Safari expõe `webkitCompassHeading` (graus horários a partir do
   *     norte, pronto para usar) e EXIGE `requestPermission()` dentro de um
   *     gesto do usuário — por isso o pedido mora no clique, não no mount;
   *   · Android expõe `deviceorientationabsolute` com `alpha` anti-horário a
   *     partir do norte quando `absolute` é verdadeiro — o rumo é `360 − α`.
   *
   * COM SENSOR, A ROSA É UMA BÚSSOLA FÍSICA: gira com o aparelho e ignora o
   * rumo do MAPA — os dois juntos somariam dois referenciais numa agulha só e
   * ela deixaria de apontar pra qualquer coisa. Sem sensor (desktop, permissão
   * negada), ela volta a ser a rosa da carta: gira com o bearing do mapa, que
   * é o comportamento que já estava no ar. O clique endireita o mapa nos dois
   * modos.
   */
  private rumoAparelho: number | null = null
  private pediuPermissao = false
  private aoOrientar = (e: DeviceOrientationEvent) => {
    const ios = (e as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading
    if (typeof ios === "number" && Number.isFinite(ios)) this.rumoAparelho = ios
    else if (e.absolute && e.alpha != null) this.rumoAparelho = (360 - e.alpha) % 360
    else return
    this.aoGirar()
  }
  private aoGirar = () => {
    if (!this.mapa || !this.rosa) return
    const graus = this.rumoAparelho ?? this.mapa.getBearing()
    this.rosa.style.transform = `rotate(${-graus}deg)`
  }
  /** iOS 13+: o sensor só liga depois de `requestPermission()` num gesto. */
  private ligarSensor = () => {
    if (this.pediuPermissao) return
    this.pediuPermissao = true
    type ComPermissao = { requestPermission?: () => Promise<"granted" | "denied"> }
    const pedir = (DeviceOrientationEvent as unknown as ComPermissao).requestPermission
    if (typeof pedir === "function") {
      pedir.call(DeviceOrientationEvent)
        .then((r) => {
          if (r === "granted") window.addEventListener("deviceorientation", this.aoOrientar)
        })
        .catch(() => { /* negou: a rosa continua girando pela carta */ })
    } else {
      // Android/desktop: sem cerimônia — se o sensor não existir, o evento
      // simplesmente nunca dispara e o fallback pela carta continua valendo.
      window.addEventListener("deviceorientationabsolute" as "deviceorientation", this.aoOrientar)
    }
  }
  onAdd(mapa: MapaMapbox): HTMLElement {
    this.mapa = mapa
    // Onde não há cerimônia de permissão (Android), liga já no mount — a
    // bússola tem que funcionar ao girar o celular sem ninguém descobrir que
    // precisava tocar nela primeiro. No iOS o mount não pode pedir (não é
    // gesto), então lá o primeiro toque na rosa liga o sensor.
    type ComPermissao = { requestPermission?: () => Promise<"granted" | "denied"> }
    if (typeof window !== "undefined" && typeof (DeviceOrientationEvent as unknown as ComPermissao).requestPermission !== "function") {
      this.ligarSensor()
    }
    const container = document.createElement("div")
    container.className = "mapboxgl-ctrl mapboxgl-ctrl-group"
    const botao = document.createElement("button")
    botao.type = "button"
    botao.setAttribute("aria-label", "Bússola — toque para voltar ao norte")
    botao.className = "bg-mapa-instrumento text-meter-texto"
    botao.innerHTML =
      // A rosa: anel, ticks cardeais, agulha norte cheia (ouro) e sul vazada.
      // O "N" é texto de 6px — legível a 44px de botão, invisível de longe,
      // que é exatamente o "discreta mas funcional" do pedido.
      '<svg viewBox="0 0 24 24" width="26" height="26" style="display:block;margin:auto;transition:transform .15s ease-out">' +
      '<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-opacity=".45" stroke-width="1"/>' +
      '<g stroke="currentColor" stroke-opacity=".45" stroke-width="1">' +
      '<line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/>' +
      '<line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/></g>' +
      '<path d="M12 4.5 14 12 H10Z" fill="var(--acao)"/>' +
      '<path d="M12 19.5 10 12 H14Z" fill="currentColor" fill-opacity=".4"/>' +
      '<text x="12" y="8.6" text-anchor="middle" font-size="5" font-weight="700" fill="var(--acao)">N</text>' +
      "</svg>"
    this.rosa = botao.querySelector("svg")
    botao.addEventListener("click", () => {
      // O clique faz as duas coisas do mesmo gesto: liga o sensor onde a
      // permissão exige gesto (iOS), e endireita a carta — que é o que o
      // toque numa bússola de mapa sempre fez.
      this.ligarSensor()
      this.mapa?.easeTo({ bearing: 0, pitch: 0, duration: 300 })
    })
    mapa.on("rotate", this.aoGirar)
    this.aoGirar()
    container.appendChild(botao)
    this.container = container
    return container
  }
  onRemove(): void {
    this.mapa?.off("rotate", this.aoGirar)
    window.removeEventListener("deviceorientation", this.aoOrientar)
    window.removeEventListener("deviceorientationabsolute" as "deviceorientation", this.aoOrientar)
    this.container?.remove()
    this.container = null
    this.rosa = null
    this.mapa = null
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
      className={`relative h-6 w-11 shrink-0 rounded-[var(--raio-pilula)] transition-colors ${ligado ? "bg-accent" : "bg-line"}`}
    >
      {/* `sombra-1` e não `shadow`: a escala de elevação tem três degraus e
          nenhum deles é utilitária do Tailwind (docs/DESIGN.md §5). Este é o
          degrau "separa do fundo", e não `sombra-2`: o botão desliza DENTRO do
          próprio trilho, não paira sobre o conteúdo da tela — quem flutua aqui
          é o painel de camadas inteiro, que já leva `sombra-2`. Consequência
          assumida: `--sombra-1` é `none` no tema escuro, então no escuro o
          botão passa a se separar só pelo branco contra o trilho, que é a
          decisão do sistema (lá a separação é feita por contraste, não por
          sombra), não um esquecimento daqui. */}
      <span
        aria-hidden="true"
        className={`sombra-1 absolute top-0.5 left-0.5 size-5 rounded-[var(--raio-pilula)] bg-white transition-transform ${ligado ? "translate-x-5" : "translate-x-0"}`}
      />
    </button>
  )
}

/** Mapa náutico do Commander: Mapbox + sinalização do OpenSeaMap + batimetria
 *  aproximada + posição do aparelho no talo (alta precisão, rumo,
 *  acompanhamento). Sem token, degrada com aviso — nunca quebra a tela.
 *
 *  Quatro camadas opcionais, controláveis pelo painel do botão "camadas" (ver
 *  ControleCamadas acima): Balizamento (OpenSeaMap) e Parceiros ligados por
 *  padrão, Profundidade e Sondagens da comunidade desligadas por padrão. A
 *  escolha persiste em localStorage (web/lib/mapa/camadas.ts) — o navegante
 *  configura uma vez. "Parceiros" e "Sondagens" são desenhados por quem usa
 *  este componente (os pinos e os círculos de sondagem não pertencem ao
 *  MapaNautico — ver components/mapa/camada-sondagens.ts), por isso o estado
 *  das 4 chaves sobe pra quem usa via `aoMudarCamadas`, disparado no mount e
 *  em toda mudança. */
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
  // Falha ao subir o mapa (chunk que nao baixou, WebGL recusado, estilo
  // que nao veio) — regra da casa: NADA falha mudo. O buraco branco sem
  // explicacao ja custou uma sessao de debug no emulador (403 silencioso,
  // 09/08) e outra no iPhone (11/08). `tentativaMapa` re-dispara o efeito
  // de montagem no "Tentar de novo".
  const [falhaMapa, setFalhaMapa] = useState<string | null>(null)
  const [tentativaMapa, setTentativaMapa] = useState(0)
  // Onda 89 (achado 4.6) — vira true quando os controles nativos já estão no
  // DOM; ver o efeito que mede a altura deles logo abaixo.
  const [controlesMontados, setControlesMontados] = useState(false)
  const [alturaControlesPx, setAlturaControlesPx] = useState<number | null>(null)

  // `camadas` sempre atualizado, sem recriar closures — quem lê isso é
  // código assíncrono (listener de "style.load", que dispara bem depois do
  // render que o originou) e precisa do estado MAIS RECENTE das camadas
  // (ex.: usuário desligou balizamento e SÓ DEPOIS trocou de estilo — a
  // camada reconstruída tem que nascer desligada, não com o valor do mount).
  const camadasRef = useRef(camadas)
  useEffect(() => {
    camadasRef.current = camadas
  }, [camadas])

  // Estilo efetivamente carregado no mapa agora — não necessariamente igual
  // a `camadas.estilo` no meio de uma troca em voo. Usado pra decidir se uma
  // mudança de estilo precisa de `setStyle()` (URLs diferentes) ou só de
  // terreno/pitch (satélite ⇄ relevo3d, mesma URL — ver efeito abaixo).
  const estiloCarregadoRef = useRef<EstiloMapa>(camadas.estilo)

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

  function escolherEstilo(estilo: EstiloMapa) {
    setCamadas((atual) => {
      if (atual.estilo === estilo) return atual
      const proximo = { ...atual, estilo }
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
    if (mapa.getLayer("batimetria-ampla")) {
      mapa.setLayoutProperty("batimetria-ampla", "visibility", camadas.profundidade ? "visible" : "none")
    }
  }, [camadas])

  useEffect(() => {
    if (!TOKEN || !containerRef.current) return
    let cancelado = false

    // Falha no download do chunk NAO pode ser um buraco mudo: captura o
    // erro real e mostra na tela (ver `falhaMapa`).
    let erroImport: unknown = null
    import("mapbox-gl").catch((e: unknown) => {
      erroImport = e
      return null
    }).then((mod) => {
      if (!mod) {
        if (!cancelado) {
          setFalhaMapa(
            `O mapa não conseguiu carregar (${erroImport instanceof Error ? erroImport.message : "falha de rede"}). Verifique a conexão e tente de novo.`,
          )
        }
        return
      }
      const mapboxgl = mod.default
      if (cancelado || !containerRef.current) return
      // Contexto inseguro (shell nativo em dev carrega HTTP por IP): o
      // Chrome esconde DeviceOrientationEvent, e o GeolocateControl do
      // mapbox-gl referencia o global sem checar existencia —
      // ReferenceError real vivido no emulador (09/08/2026). Stub vazio:
      // o mapbox cai no ramo sem requestPermission e escuta um evento que
      // nunca dispara (sem bussola — que nesse contexto nao existiria de
      // qualquer forma; em producao HTTPS a API real esta la e o stub nao
      // e criado).
      if (typeof window.DeviceOrientationEvent === "undefined") {
        ;(window as unknown as { DeviceOrientationEvent: unknown }).DeviceOrientationEvent = function () {}
      }
      mapboxgl.accessToken = TOKEN
      const estiloInicial = camadasRef.current.estilo
      // try no construtor: e aqui que o WebGL e criado — navegador que o
      // recuse (GPU bloqueada, WebView sem aceleracao) lancaria sincrono e
      // viraria buraco branco mudo sem isto.
      let mapa: MapaMapbox
      try {
        mapa = new mapboxgl.Map({
        container: containerRef.current,
        style: ESTILO_URL[estiloInicial],
        center: CENTRO_PADRAO,
        zoom: 10,
        // Projecao PLANA sempre (feedback do dono, 11/08/2026): o globo
        // padrao do GL JS v3 nao combina com navegacao costeira e custa
        // renderizacao. Projecao de runtime vence a do estilo e sobrevive
        // ao setStyle das trocas Nautico/Satelite/Relevo.
        projection: "mercator",
        // Sem crossfade de tile: zoom responde na hora em vez de esperar
        // o fade de 300ms — a sensacao de fluidez que faltava, sobretudo
        // com as camadas raster (batimetria + OpenSeaMap) por cima.
        fadeDuration: 0,
        // já nasce inclinado se "relevo3d" veio do localStorage — evita um
        // salto de câmera visível logo após o primeiro paint.
        pitch: PITCH_ESTILO[estiloInicial],
        attributionControl: false,
        // Instrumento de bordo, nao mapa de carro: cores desbotadas (a
        // sinalizacao nautica do OpenSeaMap e quem pinta por cima), sem
        // placas de rodovia, sem transporte publico, sem POI de cidade.
        // Só se aplica ao estilo "standard" (nautico) — nos outros dois
        // (satellite-streets-v12, um estilo clássico) é ignorado pelo
        // Mapbox; a supressão de POI equivalente pra eles é
        // `ocultarPoisDeTerceiros`, chamada no listener de "style.load".
        config: estiloInicial === "nautico" ? CONFIG_NAUTICO : undefined,
        })
      } catch (e) {
        setFalhaMapa(
          `O mapa não conseguiu iniciar (${e instanceof Error ? e.message : "WebGL indisponível neste navegador"}). Tente de novo — se persistir, atualize o navegador.`,
        )
        return
      }
      setFalhaMapa(null)

      // O construtor pode dar certo e o ESTILO falhar depois (rede, token
      // com restricao de URL, CDN da Mapbox bloqueada) — erro assincrono
      // que nao passa pelo try acima e deixava tela branca muda (visto no
      // iPhone via proxy https, 11/08/2026). So falha ANTES do primeiro
      // estilo carregado vira aviso: depois disso, "error" e ruido normal
      // de tile individual e nao derruba o mapa.
      let estiloJaCarregou = false
      mapa.once("style.load", () => {
        estiloJaCarregou = true
      })
      mapa.on("error", (ev: { error?: { message?: string; status?: number } }) => {
        if (estiloJaCarregou || cancelado) return
        const detalhe = ev.error?.message ?? "falha desconhecida"
        const dica =
          ev.error?.status === 401 || ev.error?.status === 403
            ? " Provável restrição de URL no token do Mapbox — confira em account.mapbox.com se o token permite esta origem."
            : ""
        setFalhaMapa(`O mapa não conseguiu carregar o estilo (${detalhe}).${dica}`)
      })

      // Reconstrói TUDO que este componente desenha no estilo (batimetria +
      // OpenSeaMap) — chamada tanto no carregamento inicial quanto depois de
      // toda troca de estilo via "style.load" (ver listener logo abaixo).
      // `setStyle()` é a armadilha clássica do Mapbox: troca de estilo
      // DESTRÓI toda source/layer customizada. "Parceiros" não precisa disso
      // — os pinos são `mapboxgl.Marker` (elementos DOM posicionados por
      // cima do canvas), não fazem parte do estilo, sobrevivem sozinhos.
      function adicionarCamadasProprias() {
        // Batimetria (profundidade aproximada) — ABAIXO do balizamento e da
        // rota (ver beforeId: adiciona sempre logo antes de "openseamap" na
        // pilha, então fica por baixo dele; a rota é adicionada depois disso,
        // por fora, sem beforeId — entra por cima de tudo que já existe).
        // Sem o JSON (asset não gerado/404), a camada simplesmente não
        // existe — mesmo padrão "honesto" da máscara água/terra: ausência
        // não é erro, só significa "essa camada não está disponível".
        //
        // DUAS camadas (branch onda-10-mapa-completo): "fina" (região de operação, precisa) e
        // "ampla" (costa brasileira inteira, mais grossa — ver
        // scripts/gerar-batimetria.mjs). Sem isso, afastar o zoom deixava
        // uma mancha retangular escura só sobre a região de operação e o
        // resto do oceano sem nada. minzoom/maxzoom fazem uma sumir onde a
        // outra cobre (ZOOM_TRANSICAO_BATIMETRIA), sem dupla pintura.
        //
        // Os 2 fetches são independentes — podem resolver em qualquer
        // ordem. O beforeId de cada addLayer é calculado na hora (não fixo)
        // pra garantir a pilha "ampla abaixo de fina abaixo de openseamap"
        // não importa qual dos dois chega primeiro:
        //   - fina aponta sempre pra baixo de "openseamap";
        //   - ampla aponta pra baixo de "batimetria" (fina) SE ela já
        //     existir, senão cai pro mesmo alvo que a fina (openseamap) —
        //     e quando a fina chegar depois, o addLayer dela (também com
        //     beforeId "openseamap") a insere ACIMA da ampla automaticamente.
        fetch("/mapa/batimetria-ampla.json")
          .then((r) => (r.ok ? (r.json() as Promise<BatimetriaMetadados>) : null))
          .then((meta) => {
            if (cancelado || !meta || mapa.getSource("batimetria-ampla")) return
            mapa.addSource("batimetria-ampla", {
              type: "image",
              url: "/mapa/batimetria-ampla.png",
              coordinates: [
                [meta.lngMin, meta.latMax],
                [meta.lngMax, meta.latMax],
                [meta.lngMax, meta.latMin],
                [meta.lngMin, meta.latMin],
              ],
            })
            mapa.addLayer(
              {
                id: "batimetria-ampla",
                type: "raster",
                source: "batimetria-ampla",
                maxzoom: ZOOM_TRANSICAO_BATIMETRIA,
                layout: { visibility: camadasRef.current.profundidade ? "visible" : "none" },
                // "linear" já É o default do Mapbox GL (confirmado na style
                // spec) — deixado explícito aqui de propósito, porque é
                // exatamente a propriedade que o pedido do dono pedia pra
                // conferir: sem isso a textura reamostraria com "nearest"
                // (pixel quadrado, o outro sintoma clássico de "PNG colado")
                // sempre que o zoom passa da resolução nativa do PNG.
                paint: { "raster-fade-duration": 0, "raster-resampling": "linear" },
              },
              mapa.getLayer("batimetria")
                ? "batimetria"
                : mapa.getLayer("openseamap")
                  ? "openseamap"
                  : undefined,
            )
          })
          .catch(() => {})

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
                minzoom: ZOOM_TRANSICAO_BATIMETRIA,
                layout: { visibility: camadasRef.current.profundidade ? "visible" : "none" },
                // Ver comentário equivalente na camada "ampla" acima —
                // "linear" já é o default, explícito de propósito.
                paint: { "raster-fade-duration": 0, "raster-resampling": "linear" },
              },
              mapa.getLayer("openseamap") ? "openseamap" : undefined,
            )
          })
          .catch(() => {})

        // Sinalização náutica (boias, faróis, marcas) — overlay CC-BY-SA.
        if (!mapa.getSource("openseamap")) {
          mapa.addSource("openseamap", {
            type: "raster",
            tiles: ["https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "© OpenSeaMap",
          })
        }
        if (!mapa.getLayer("openseamap")) {
          mapa.addLayer({
            id: "openseamap",
            type: "raster",
            source: "openseamap",
            layout: { visibility: camadasRef.current.balizamento ? "visible" : "none" },
          })
        }
      }

      // Dispara em TODO carregamento de estilo — o inicial e cada
      // `setStyle()` subsequente (troca Náutico/Satélite/Relevo 3D, ver
      // efeito mais abaixo). É o remédio pra armadilha do `setStyle()`
      // descrita acima: sem isso, trocar de estilo e voltar deixaria o mapa
      // sem balizamento/batimetria pra sempre.
      mapa.on("style.load", () => {
        if (cancelado) return
        adicionarCamadasProprias()
        aplicarTerrenoEPitch(mapa, camadasRef.current.estilo)
        ocultarPoisDeTerceiros(mapa)
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
      // ONDA 115 — a bússola nativa sai (`showCompass: false`) e entra a rosa
      // dos ventos da casa, logo abaixo do zoom. Ver `ControleBussola`.
      mapa.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right")
      mapa.addControl(new ControleBussola(), "top-right")
      mapa.addControl(
        new mapboxgl.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: true,
          showUserHeading: true,
          // Onda 24 (passe de arte) — o ponto azul default vira o marcador
          // de embarcação da marca (proa dourada + halo navy, rotacionada
          // pelo rumo do GPS): desenhado por quem usa este componente (ver
          // criarElementoBarco em navegar-mapa.tsx). Aqui só desliga o
          // marcador NATIVO do Mapbox — o botão continua funcionando normal
          // (pedir permissão, centralizar o mapa na posição).
          showUserLocation: false,
          fitBoundsOptions: { maxZoom: 14 },
        }),
        "top-right",
      )
      mapa.addControl(new ControleCamadas(() => setPainelAberto((v) => !v)), "top-right")
      // A pilha de controles já existe no DOM a partir daqui (`addControl` é
      // síncrono) — é o sinal pro efeito que MEDE essa pilha, mais abaixo.
      if (!cancelado) setControlesMontados(true)
      // "load" só dispara uma vez na vida do mapa (estilo inicial + fontes
      // prontas) — o que ele faz agora é só resize/aoIniciar; reconstruir
      // camadas em toda troca de estilo é responsabilidade do listener
      // "style.load" registrado acima, que cobre esta primeira carga também.
      mapa.on("load", () => {
        if (cancelado) return
        // se o container foi medido antes do CSS/layout assentar, o canvas
        // fica com tamanho errado (mapa "branco") — remedir resolve
        mapa.resize()
        aoIniciarRef.current?.(mapa)
      })
      mapaRef.current = mapa
      // Gancho de depuração, só em dev — é o que permite inspecionar
      // `map.getStyle().layers`/`getTerrain()`/`getPitch()` no console do
      // navegador ao verificar a troca de estilo (pedido explícito da task).
      // Nunca existe em produção.
      if (process.env.NODE_ENV === "development") {
        ;(window as unknown as { __commanderMapa?: MapaMapbox }).__commanderMapa = mapa
      }
    })

    return () => {
      cancelado = true
      mapaRef.current?.remove()
      mapaRef.current = null
      setControlesMontados(false)
    }
    // `camadasRef.current` cobre o valor inicial de estilo/toggles (lido uma
    // vez, no mount, via ref — por isso o linter não pede pra entrar nas
    // deps); trocas depois disso são cobertas pelos efeitos de cima
    // (visibilidade) e de baixo (estilo). Colocar `camadas` nas deps
    // recriaria o mapa inteiro a cada toggle. `tentativaMapa` e o unico
    // gatilho legitimo de recriacao: o botao "Tentar de novo" da falha.
  }, [tentativaMapa])

  // Troca de estilo do mapa (Náutico/Satélite/Relevo 3D) depois que o mapa já
  // existe — a criação em si (estilo inicial vindo do localStorage) é feita
  // no efeito de cima. `setStyle()` só é chamado quando a URL do estilo-base
  // muda de verdade (nautico ⇄ satelite/relevo3d); entre satélite e relevo3d
  // é a MESMA URL (ver ESTILO_URL), então só terreno/pitch mudam, sem
  // recarregar o estilo inteiro nem disparar "style.load" à toa.
  useEffect(() => {
    const mapa = mapaRef.current
    if (!mapa) return
    const alvo = camadas.estilo
    if (estiloCarregadoRef.current === alvo) return
    const trocaEstiloBase = ESTILO_URL[estiloCarregadoRef.current] !== ESTILO_URL[alvo]
    estiloCarregadoRef.current = alvo
    if (trocaEstiloBase) {
      // O listener "style.load" registrado no mount (permanente) é quem
      // reconstrói batimetria/openseamap e reaplica terreno/pitch depois
      // desta chamada — aqui só dispara a troca.
      mapa.setStyle(ESTILO_URL[alvo], opcoesParaEstilo(alvo))
    } else {
      aplicarTerrenoEPitch(mapa, alvo)
    }
  }, [camadas.estilo])

  // ONDA 89 (achado 4.6) — O PAINEL DE CAMADAS DEIXA DE MORAR NUM NÚMERO.
  //
  // Ele estava em `top-44`: 176px cravados, escolhidos à mão pra passar por
  // baixo da pilha de controles nativos. Número cravado contra altura de
  // outro elemento quebra em silêncio quando esse elemento muda — e ele
  // acabou de mudar, nesta mesma onda: o achado 4.2 leva os botões do Mapbox
  // de 32 pra 44px e a pilha inteira cresce quase 60px. Com 176 fixos, o
  // painel passaria a nascer POR CIMA do botão que o abre.
  //
  // Medir a pilha resolve a classe do problema, não a instância: acrescentar
  // um controle, tirar um, mudar a régua de toque de novo — o painel
  // continua entrando logo abaixo, na mesma coluna de flutuantes que os
  // controles já formam. `ResizeObserver` e não uma medida única porque o
  // botão de localização muda de altura ao entrar em estado de erro.
  useEffect(() => {
    const raiz = containerRef.current
    if (!controlesMontados || !raiz) return
    const coluna = raiz.querySelector<HTMLElement>(".mapboxgl-ctrl-top-right")
    if (!coluna) return
    const medir = () => setAlturaControlesPx(coluna.getBoundingClientRect().height)
     
    medir()
    const observador = new ResizeObserver(medir)
    observador.observe(coluna)
    return () => observador.disconnect()
  }, [controlesMontados])

  if (!TOKEN) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-3 rounded-[var(--raio-cartao)] border border-line bg-meter p-8 text-center ${className ?? ""}`}
      >
        {/* o plano pedia "bussola", que nao existe no conjunto de 28 — "mapa" e o mais proximo */}
        <Icone nome="mapa" className="size-8 text-accent" />
        <p className="corpo text-meter-texto">
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
      {/* Régua de toque dos controles nativos — ver CSS_ALVO_TOQUE_MAPBOX.
          `precedence` é o que faz o React deduplicar a folha quando houver
          mais de um mapa vivo na mesma navegação. */}
      <style href="mapbox-alvo-toque" precedence="medium">
        {CSS_ALVO_TOQUE_MAPBOX}
      </style>

      {/* h-full em vez de absolute/inset: o CSS do mapbox forca
          .mapboxgl-map{position:relative}, que vence o .absolute na cascata e
          colapsava a altura para 0 (mapa branco) */}
      <div ref={containerRef} className="h-full w-full" />

      {falhaMapa && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-meter/95 p-8 text-center">
          <Icone nome="mapa" className="size-8 text-accent" />
          <p className="corpo max-w-xs text-meter-texto">{falhaMapa}</p>
          <button
            type="button"
            onClick={() => {
              setFalhaMapa(null)
              setTentativaMapa((t) => t + 1)
            }}
            className="min-h-11 rounded-[var(--raio-cartao)] bg-accent px-6 font-semibold text-acao-texto"
          >
            Tentar de novo
          </button>
        </div>
      )}

      {painelAberto && (
        // Onda 25 — sem `backdrop-blur` (era /95 + blur): Safari iOS pinta um
        // retângulo escuro sólido quando backdrop-filter fica em cima do
        // canvas WebGL do Mapbox ("véu escuro" visto no iPhone em produção,
        // 12/08). /97 sem blur fica quase idêntico e elimina o defeito — ver
        // o comentário completo em --mapa-instrumento, app/globals.css.
        // Onda 89 (achado 4.6) — `top-44` (176px cravados) deu lugar à altura
        // MEDIDA da pilha de controles nativos: o painel entra na coluna de
        // flutuantes do próprio mapa, logo abaixo do botão que o abriu, e
        // continua entrando ali se a pilha mudar de tamanho (foi o que
        // acabou de acontecer com a régua de 44px do achado 4.2). Enquanto a
        // medida não chegou, `top-3` é o mesmo lugar de onde a coluna começa
        // — nunca fica sem posição.
        <div
          style={{ top: alturaControlesPx ?? undefined }}
          // `mt-2` é o MESMO gap-2 (8px) que as colunas de flutuantes desta
          // tela já usam entre um cartão e o próximo — margem vale em
          // elemento posicionado, então ela soma ao `top` medido.
          className={`sombra-2 absolute right-3 z-30 mt-2 w-72 max-w-[calc(100%-1.5rem)] rounded-[var(--raio-cartao)] border border-line bg-panel/97 p-4 ${
            alturaControlesPx == null ? "top-3" : ""
          }`}
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="titulo-card">Camadas do mapa</h2>
            {/* Onda 89 (achado 4.2) — era `size-7` (28px), o menor alvo de
                toque da tela de mar aberto. Margem negativa pra crescer o
                alvo sem empurrar o cabeçalho do painel pra baixo. */}
            <button
              type="button"
              onClick={() => setPainelAberto(false)}
              aria-label="Fechar painel de camadas"
              className="-my-2 -mr-2 flex size-11 items-center justify-center text-dim"
            >
              <Icone nome="mais" className="size-4 rotate-45" />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <p className="rotulo mb-1.5 text-dim">Estilo do mapa</p>
              <div role="radiogroup" aria-label="Estilo do mapa" className="grid grid-cols-3 gap-1.5">
                {ESTILOS_MAPA.map((estilo) => {
                  const selecionado = camadas.estilo === estilo
                  return (
                    <button
                      key={estilo}
                      type="button"
                      role="radio"
                      aria-checked={selecionado}
                      onClick={() => escolherEstilo(estilo)}
                      className={`flex flex-col items-center gap-1 rounded-[var(--raio-controle)] border px-2 py-2.5 text-center ${
                        selecionado ? "border-accent bg-accent/10 text-accent-forte" : "border-line text-dim"
                      }`}
                    >
                      <Icone nome={ICONE_ESTILO[estilo]} className="size-4" />
                      <span className="apoio">{ROTULO_ESTILO[estilo]}</span>
                    </button>
                  )
                })}
              </div>
              {camadas.estilo === "relevo3d" && (
                <p className="apoio mt-1.5 text-dim">Terreno com elevação — igual à imagem de satélite, só inclinado.</p>
              )}
            </div>

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
              <p className="apoio rounded-[var(--raio-controle)] border border-warn/40 bg-warn/10 px-3 py-2 text-warn">
                Profundidade aproximada — ~450 m de resolução perto da região de operação, ~3,7 km no resto da costa
                brasileira e mar adjacente. Orientação geral, NÃO substitui a carta náutica oficial.
              </p>
            )}

            {/* Sondagens da comunidade (auditoria 360 de 20/08, recomendação
                nº 3) — quarta camada do painel. Como "parceiros", quem
                desenha é quem usa o MapaNautico (hoje só /navegar, via
                components/mapa/camada-sondagens.ts); aqui mora só o
                interruptor + o aviso honesto, no mesmo desenho do aviso da
                batimetria logo acima. */}
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="corpo">Sondagens da comunidade</p>
                <p className="apoio text-dim">Profundidade medida por outros barcos</p>
              </div>
              <Interruptor
                ligado={camadas.sondagens}
                aoAlternar={() => alternarCamada("sondagens")}
                rotulo="Sondagens da comunidade"
              />
            </div>
            {camadas.sondagens && (
              <p className="apoio rounded-[var(--raio-controle)] border border-warn/40 bg-warn/10 px-3 py-2 text-warn">
                Dado colaborativo, sem verificação oficial — mediana do que outros navegantes mediram em células de
                ~15 m. Onde não há ponto, ninguém mediu ainda. Orientação geral, NÃO substitui a carta náutica oficial.
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

      {/* o aviso legal (o Commander NÃO é auxílio à navegação — é estimativa) vive no painel de trilha do
          /navegar — flutuando aqui ele cobria escala e atribuição */}
    </div>
  )
}
