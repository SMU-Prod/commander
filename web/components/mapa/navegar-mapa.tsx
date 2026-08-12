"use client"
import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { Map as MapaMapbox, Marker as MarcadorMapbox, MapMouseEvent, GeoJSONSource } from "mapbox-gl"
import { CardParceiro } from "@/components/mapa/card-parceiro"
import { MapaNautico } from "@/components/mapa/mapa-nautico"
import { SondagemPainel } from "@/components/mapa/sondagem-painel"
import { Icone } from "@/components/icone"
import { salvarTrilha } from "@/lib/acoes/trilha"
import { haversineNm, resumoTrilha, MAX_PONTOS_TRILHA, type PontoTrilha, type ResumoTrilha } from "@/lib/domain/geo"
import { msParaNos, rumoGraus, etaMinutos, foraDoRaio } from "@/lib/domain/navegacao"
import type { EstadoCamadas } from "@/lib/mapa/camadas"
import { ICONE_FALLBACK, type NomeIconeParceiro } from "@/lib/mapa/pino-parceiro"
import type { Parceiro } from "@/lib/db/types"
import type { PedidoRota, Precisao, RespostaRota } from "@/components/mapa/rota.worker"
import type { MotivoFalhaRota } from "@/lib/domain/rota"
import { suavizarChaikin } from "@/lib/mapa/suavizar-linha"

const RESUMO_VAZIO: ResumoTrilha = { distanciaNm: 0, duracaoH: 0, tempoMovimentoH: 0, velMediaKt: 0, velMaxKt: 0 }

type Coord = { la: number; lo: number }
type Ancora = { la: number; lo: number; raioM: number }

/** Estado da rota pela agua calculada no Worker (web/components/mapa/rota.worker.ts).
 *  "calculando" e transitorio (existe so entre o postMessage e a resposta); os
 *  outros tres sao os estados finais honestos pedidos na task: uma rota de
 *  verdade, ou uma das duas razoes pelas quais ela nao existe. "ausente" cobre
 *  tanto "sem destino/posicao ainda" quanto "mascara nao carregou" — em ambos
 *  os casos a tela cai pro rumo direto sem alarde nenhum; "ausente" so existe
 *  como valor DERIVADO (ver `estadoRotaAtual`), nunca guardado em estado. */
type EstadoRotaResultado =
  | { tipo: "calculando"; paraDestino: Coord }
  | {
      tipo: "rota"
      paraDestino: Coord
      pernas: Coord[]
      distanciaNm: number
      /** Onda 22: ganhou `"mista"` — rota costurada (trecho costeiro na
       *  fina, resto na nacional grosseira), ver rota.worker.ts. */
      precisao: Precisao
      /** Calado EFETIVAMENTE aplicado pelo worker — onda 12. `null` quando
       *  nao foi aplicado (sem calado cadastrado, OU grade de profundidade
       *  indisponivel no momento). Comparar com a prop `caladoM` (o que o
       *  barco TEM cadastrado) e o que decide qual aviso mostrar. */
      caladoM: number | null
      /** true = esta rota especifica passa por passagens reais de outros
       *  barcos (onda 17). Habilita um aviso DISCRETO — nunca "validada" ou
       *  "segura", passagem historica nao garante profundidade. */
      usouCorredores: boolean
      /** Onda 22: true = o destino so foi alcancado com o snap generoso da
       *  grade nacional — a rota termina "na altura do" destino, nao nele
       *  (ver rota.worker.ts). A tela nao pode fingir precisao que nao tem. */
      destinoAproximado: boolean
    }
  | { tipo: "fora-da-area"; paraDestino: Coord }
  | {
      tipo: "sem-caminho"
      paraDestino: Coord
      /** Onda 22: origem longe da agua / destino longe da agua / achou os
       *  dois mas nao ha rota entre eles — cada motivo tem seu proprio texto
       *  honesto (ver render mais abaixo). */
      motivo: MotivoFalhaRota
      /** true = existe rota sem considerar calado, so nao com o calado
       *  pedido — troca a mensagem generica por uma que explica o motivo. */
      semCaminhoPorCalado: boolean
    }
type EstadoRota = EstadoRotaResultado | { tipo: "ausente" }

// Recalcular a cada tick do GPS faria a linha da rota tremer (o A* nao devolve
// exatamente o mesmo caminho pra posicoes vizinhas) e desperdicaria CPU no
// Worker por nada — so vale recalcular quando o barco realmente andou.
const LIMIAR_RECALCULO_M = 200

const CHAVE_ANCORA = "ancora"
// Consentimento de corredores (onda 17) — localStorage, NAO coluna no banco:
// e uma preferencia de DISPOSITIVO/navegador (mesmo raciocinio do
// CHAVE_URL_SIGNALK em sondagem-painel.tsx), nao da conta — a pessoa pode
// usar o mesmo login em varios aparelhos e decidir diferente em cada um
// (ex.: barco emprestado). Nao precisa sobreviver a reinstalacao nem
// sincronizar entre dispositivos, e ler antes de CADA salvamento (nao so
// uma vez por sessao) e barato o bastante pra nao justificar ida ao banco.
const CHAVE_CONSENTIMENTO_CORREDOR = "commander:consentimento-corredor"
const RAIO_PADRAO_M = 40
const COR_DOURADO = "#D4AF37"
const COR_ALARME = "#FF5C5C"
// Onda 23 — casing da rota: traco escuro translucido por baixo do nucleo
// dourado, mesmo padrao dos apps de navegacao serios (legivel sobre o
// nautico "faded" claro E sobre o satelite, que varia muito de cor). Mesmo
// navy de sempre (--fundo/--meter no tema escuro) — camadas do Mapbox
// pintam no canvas WebGL, nao no DOM, entao nao enxergam var(--cor); por
// isso o literal, igual ao resto dos hex fixos deste arquivo (COR_ALARME
// acima, os anveis dos marcadores abaixo).
const COR_CASING = "#0B1D2D"

// Traçados dos ícones do PAINEL DO PARCEIRO (não mais por categoria — onda
// 10, Pedido 2: cada parceiro escolhe o próprio ícone, ver migration 024 e
// web/lib/mapa/pino-parceiro.ts) — cópia estática dos mesmos <path> de
// components/icone.tsx. Os marcadores do Mapbox são DOM puro, não React, e
// esse markup é 100% nosso (nunca dado de parceiro) — por isso pode ir via
// innerHTML.
const TRACADO_ICONE_PARCEIRO: Record<NomeIconeParceiro, string> = {
  ancora: '<circle cx="12" cy="5" r="2"/><path d="M12 7v13M5 13a7 7 0 0 0 14 0M8 10H5m14 0h-3"/>',
  oleo: '<path d="M12 3s6 6.5 6 10.5A6 6 0 0 1 6 13.5C6 9.5 12 3 12 3z"/>',
  inicio: '<path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1v-8z"/>',
  estrela: '<path d="m12 4 2.4 5 5.6.8-4 3.9 1 5.5-5-2.7-5 2.7 1-5.5-4-3.9L9.6 9z"/>',
  embarcacao: '<path d="M3 15h18l-3 5H6l-3-5zM6 15V9h12v6M12 9V4"/>',
  ferramenta: '<path d="M15 3a5 5 0 0 0-4.6 7L3 17.4 6.6 21l7.4-7.4A5 5 0 1 0 15 3z"/>',
  escudo: '<path d="M12 3l7 3v6c0 4-3 7.5-7 9-4-1.5-7-5-7-9V6z"/>',
  pessoas: '<circle cx="9" cy="8" r="3"/><path d="M3 19c0-3 2.7-5 6-5s6 2 6 5"/><circle cx="17" cy="9" r="2.4"/><path d="M15.6 15c2.5.3 4.4 2.2 4.4 4.6"/>',
}
// Mesmo esquema do MOB — cópia estática do <path> de "alerta" em icone.tsx.
const TRACADO_MOB = '<path d="M6 16V10a6 6 0 0 1 12 0v6l2 3H4l2-3zM10 19a2 2 0 0 0 4 0"/>'

// Onda 24 (passe de arte) — proa do marcador do PRÓPRIO barco: kite simples
// (bico fino em cima, base mais larga embaixo), a mesma leitura de seta de
// navegação dos apps sérios. Cópia estática pelo mesmo motivo do resto deste
// arquivo — marcador do Mapbox é DOM puro via innerHTML, não React.
const TRACADO_PROA_BARCO = '<path d="M12 3 19 19 12 15 5 19Z"/>'

/** Marcador do PRÓPRIO barco — Onda 24: substitui o ponto azul default do
 *  GeolocateControl (desligado via `showUserLocation: false` em
 *  MapaNautico — ver comentário lá) por um marcador da marca. Com rumo do
 *  GPS conhecido (`coords.heading`, curso sobre o fundo — só existe com o
 *  barco em movimento e o navegador expondo o dado) mostra uma proa dourada
 *  rotacionada; sem rumo, cai pro ponto neutro (círculo sem seta nenhuma) —
 *  nunca finge uma direção que não existe, mesmo espírito honesto do resto
 *  da tela (ver `destinoAproximado`). O halo navy por trás é sempre visível,
 *  com ou sem rumo — o pulso sutil dele é onda 24 também (ver
 *  `.marcador-barco-halo` em app/globals.css). Elemento criado uma ÚNICA vez
 *  (ver efeitos de montagem/atualização mais abaixo) — `atualizarRumoBarco`
 *  só alterna estilo inline a cada tick do watcher, nunca recria o DOM. */
function criarElementoBarco(): HTMLDivElement {
  const el = document.createElement("div")
  el.setAttribute("aria-hidden", "true")
  el.className = "relative flex size-8 items-center justify-center"

  const halo = document.createElement("span")
  halo.className = "marcador-barco-halo absolute -inset-2.5 rounded-full bg-[#0B1D2D]/60"
  el.appendChild(halo)

  // proa: visível com rumo conhecido, rotacionada via transform inline
  const proa = document.createElement("div")
  proa.dataset.papel = "proa"
  proa.className = "relative flex size-7 items-center justify-center rounded-full bg-[#D4AF37] ring-2 ring-white shadow"
  proa.innerHTML = `<svg viewBox="0 0 24 24" width="15" height="15" fill="#0B1D2D">${TRACADO_PROA_BARCO}</svg>`
  el.appendChild(proa)

  // ponto: visível sem rumo (parado, ou o navegador não expõe o dado) —
  // mesma cor da marca, sem seta nenhuma pra não inventar uma direção.
  const ponto = document.createElement("div")
  ponto.dataset.papel = "ponto"
  ponto.className = "relative hidden size-4 rounded-full bg-[#D4AF37] ring-2 ring-white shadow"
  el.appendChild(ponto)

  return el
}

/** Alterna entre proa (rotacionada) e ponto neutro no elemento acima, sem
 *  recriar DOM nenhum — chamado a cada novo ponto do watcher. */
function atualizarRumoBarco(el: HTMLDivElement, rumo: number | null) {
  const proa = el.querySelector<HTMLElement>('[data-papel="proa"]')
  const ponto = el.querySelector<HTMLElement>('[data-papel="ponto"]')
  if (!proa || !ponto) return
  if (rumo != null) {
    proa.style.display = ""
    proa.style.transform = `rotate(${rumo}deg)`
    ponto.style.display = "none"
  } else {
    proa.style.display = "none"
    ponto.style.display = ""
  }
}

/** Elemento DOM do pino de um parceiro — fundo e ícone são a cor/ícone que o
 *  PRÓPRIO parceiro escolheu (onda 10, Pedido 2), nunca mais fixos por
 *  categoria. Ícone sempre branco (contraste com qualquer cor da paleta
 *  curada) + anel branco opaco (destaca de água/satélite por trás) — plano
 *  "destaque" troca o anel pro dourado da marca e sobe de camada;
 *  "tem_poita" ganha um ponto dourado no canto. */
function criarElementoMarcador(p: Parceiro): HTMLDivElement {
  const destaque = p.plano === "destaque"
  const el = document.createElement("div")
  el.style.cursor = "pointer"
  el.style.zIndex = destaque ? "10" : "1"

  const corpo = document.createElement("div")
  corpo.className = destaque
    ? "relative flex size-9 items-center justify-center rounded-full ring-2 ring-[#D4AF37]"
    : "relative flex size-9 items-center justify-center rounded-full ring-2 ring-white"
  corpo.style.backgroundColor = p.cor
  const tracado = TRACADO_ICONE_PARCEIRO[p.icone] ?? TRACADO_ICONE_PARCEIRO[ICONE_FALLBACK]
  corpo.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${tracado}</svg>`
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

// Onda 23 — marcadores de ponta da rota: antes o destino usava o pino padrao
// do Mapbox (teardrop generico, sem nada da marca) e a origem nao tinha
// marcador nenhum (so o ponto azul nativo de posicao do GeolocateControl).
// Mesmo path de "estrela" em components/icone.tsx — copia estatica pelo
// mesmo motivo do resto deste arquivo: marcador do Mapbox e DOM puro via
// innerHTML, nao React.
const TRACADO_DESTINO_ROTA = '<path d="m12 4 2.4 5 5.6.8-4 3.9 1 5.5-5-2.7-5 2.7 1-5.5-4-3.9L9.6 9z"/>'

/** Marcador de ORIGEM da rota pela agua — o ponto onde o A* de fato comecou
 *  (apos o snap, ver `snapParaAgua` em lib/domain/rota.ts), nao o ponto de
 *  GPS bruto (o proprio GeolocateControl nativo do Mapbox ja mostra "onde eu
 *  estou" com o ponto azul de sempre). Deliberadamente pequeno e discreto —
 *  a origem nao compete com o pino do destino, so ancora visualmente onde a
 *  linha comeca. */
function criarElementoOrigemRota(): HTMLDivElement {
  const el = document.createElement("div")
  el.className = "size-3.5 rounded-full ring-2 ring-white shadow"
  el.style.backgroundColor = COR_DOURADO
  return el
}

/** Marcador de DESTINO da rota — substitui o pino padrao do Mapbox por um
 *  distintivo redondo no mesmo idioma visual dos outros marcadores da tela
 *  (parceiros, MOB): fundo solido + icone branco + anel branco de contraste.
 *  `aproximado` (onda 22, `destinoAproximado`): quando o snap generoso da
 *  grade nacional foi o UNICO jeito de achar agua perto do ponto tocado, a
 *  rota termina "na altura do" destino, nao nele — o halo tracejado avisa
 *  isso NO MAPA (a tela ja avisa em texto, isto e o eco visual, honesto:
 *  nunca finge precisao que a grade de ~3,6 km/celula nao tem). */
function criarElementoDestinoRota(aproximado: boolean): HTMLDivElement {
  const wrapper = document.createElement("div")
  wrapper.className = "relative flex items-center justify-center"
  if (aproximado) {
    const halo = document.createElement("span")
    halo.setAttribute("aria-hidden", "true")
    halo.className = "absolute -inset-2 rounded-full border-2 border-dashed"
    halo.style.borderColor = COR_DOURADO
    wrapper.appendChild(halo)
  }
  const corpo = document.createElement("div")
  corpo.className = "relative flex size-9 items-center justify-center rounded-full ring-2 ring-white shadow-lg"
  corpo.style.backgroundColor = COR_DOURADO
  corpo.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#0B1D2D" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${TRACADO_DESTINO_ROTA}</svg>`
  wrapper.appendChild(corpo)
  return wrapper
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

/** Um mostrador (rótulo + valor) no padrão "ponte de comando": rótulo
 *  pequeno, uppercase, espaçado; valor grande, tabular-nums — onda 23,
 *  valores dourados desde a onda 24 (passe de arte, "números-destaque
 *  dourados" do mockup do sócio). Antes cada lugar tinha seu próprio estilo
 *  improvisado (o chip de SOG no cabeçalho da trilha, o grid de
 *  distância/rumo/ETA do cartão de destino, a grade de
 *  velocidade/distância/tempo/máxima da trilha); agora os mostradores "de
 *  instrumento" usam o MESMO componente — variante "cartao" (pílula com
 *  borda/fundo escuro, tipo horímetro) pra grades destacadas, ou "linha" (só
 *  o texto) pra contextos mais apertados como o cartão de destino e a barra
 *  do modo "só navegação". Isso é o que garante a consistência entre o modo
 *  normal e o "só navegação" pedida na task — os dois leem os MESMOS números
 *  com a MESMA hierarquia visual, só o agrupamento ao redor muda.
 *
 *  Cores: `text-accent` (não `text-accent-forte`) pro valor — é o único
 *  dourado da marca que NÃO troca entre os dois temas (ver --acao em
 *  globals.css), e todo mostrador vive sobre fundo navy fixo (bg-meter ou o
 *  cartão instrumento da onda 24), não sobre --superficie; `accent-forte` é
 *  calibrado pro par oposto. Rótulo/unidade usam `text-meter-dim` pelo
 *  mesmo motivo (nunca `text-dim`, que segue o TEMA do app — leria mal aqui
 *  dentro). `tamanho="lg"` é o destaque do painel de rota (onda 24, bloco 4:
 *  "valor grande dourado"); o padrão "sm" segue compacto pra caber na barra
 *  do modo só-navegação. Nenhuma cor nova fora de tokens. */
function Mostrador({
  rotulo,
  valor,
  unidade,
  variante = "linha",
  tamanho = "sm",
}: {
  rotulo: string
  valor: string
  unidade?: string
  variante?: "cartao" | "linha"
  tamanho?: "sm" | "lg"
}) {
  if (variante === "cartao") {
    return (
      <div className="rounded-[10px] border border-mapa-instrumento-borda bg-meter px-3 py-2 font-mono-instr tabular-nums">
        <p className="text-[11px] uppercase tracking-[.14em] text-meter-dim">{rotulo}</p>
        <p className="text-2xl text-accent">
          {valor} {unidade && <span className="text-sm text-meter-dim">{unidade}</span>}
        </p>
      </div>
    )
  }
  return (
    <div className="text-center">
      <p className="text-[11px] uppercase tracking-[.16em] text-meter-dim">{rotulo}</p>
      <p className={`font-mono-instr tabular-nums text-accent ${tamanho === "lg" ? "text-lg" : "text-sm"}`}>
        {valor}
        {unidade && <span className="text-xs text-meter-dim"> {unidade}</span>}
      </p>
    </div>
  )
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
 *  existe, então nada quebra.
 *
 *  `caladoM` (onda 12): calado cadastrado da embarcação ativa (metros), vindo
 *  do servidor (`embarcacoes.calado_m`). `null` = barco sem calado cadastrado
 *  — a tela avisa e oferece o link pra cadastrar, nunca inventa um valor
 *  padrão em silêncio.
 *
 *  `podePlanejarViagem` (onda 19): mostra ou não o botão "Planejar viagem" —
 *  mesma checagem (`podeEditar(permissoes, "diario")`) que já vale pra
 *  registrar no diário, calculada no servidor (`navegar/page.tsx`). Só
 *  esconde o ATALHO; a rota `/navegar/viagem/nova` teria a mesma proteção
 *  de qualquer forma (checa de novo lá, e a RLS protege a escrita). */
export function NavegarMapa({
  parceiros,
  caladoM,
  podePlanejarViagem,
}: {
  parceiros: Parceiro[]
  caladoM: number | null
  podePlanejarViagem: boolean
}) {
  const router = useRouter()

  // --- trilha (preservado do que já existia na página, ver comentário acima) -
  const [estado, setEstado] = useState<"pronto" | "gravando" | "parado" | "salvando">("pronto")
  const [msg, setMsg] = useState<string | null>(null)
  const [obs, setObs] = useState("")
  // Consentimento de corredores (onda 17) — lembrado no dispositivo (ver
  // CHAVE_CONSENTIMENTO_CORREDOR). Nasce `false` (opt-IN, nunca opt-out) e só
  // é sobrescrito depois de ler o localStorage no mount — mesmo padrão do
  // rearme da âncora, abaixo.
  const [contribuirCorredor, setContribuirCorredor] = useState(false)
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- so existe localStorage no cliente, le uma vez apos montar
      setContribuirCorredor(localStorage.getItem(CHAVE_CONSENTIMENTO_CORREDOR) === "1")
    } catch {}
  }, [])
  function alternarConsentimentoCorredor(valor: boolean) {
    setContribuirCorredor(valor)
    try {
      localStorage.setItem(CHAVE_CONSENTIMENTO_CORREDOR, valor ? "1" : "0")
    } catch {}
  }
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
  // Onda 24: rumo do GPS (curso sobre o fundo, coords.heading) — alimenta só
  // o marcador do próprio barco (ver criarElementoBarco). Setado no MESMO
  // watcher de sempre, não abre nenhuma escuta nova.
  const [headingGraus, setHeadingGraus] = useState<number | null>(null)

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
        // Onda 24 — rumo pelo GPS pro marcador do próprio barco: NaN (barco
        // parado, conforme a spec do coords.heading) ou null (sem suporte)
        // colapsam os dois pra "sem rumo conhecido" (círculo neutro, nunca
        // seta fingindo uma direção).
        setHeadingGraus(typeof p.coords.heading === "number" && !Number.isNaN(p.coords.heading) ? p.coords.heading : null)

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
    const r = await salvarTrilha(pontosRef.current, obs, contribuirCorredor)
    if (r.ok) {
      router.push(r.redirecionarPara)
      return
    }
    setMsg(r.erro)
    setEstado(pontosRef.current.length >= 2 ? "parado" : "pronto")
  }

  // Modo "só navegação" (onda 23, pedido do Pedro: "um botão pra tirar tudo
  // da tela e ficar só a navegação"). Recolhe TODOS os cartões/pílulas
  // flutuantes (Trilha, Sondagem, Definir destino, Planejar viagem, Fundeei,
  // painel de rota) — ver os wrappers `classeColapsavel` mais abaixo. Estado
  // POR SESSÃO de propósito (useState puro, sem localStorage): não é uma
  // preferência duradoura como o estilo do mapa, é um jeito temporário de
  // olhar a tela agora — reabrir o app volta pro normal. Duas exceções que
  // NUNCA recolhem, cada uma com seu comentário no JSX onde aparece: o
  // alarme de âncora (segurança > estética) e o botão de MOB (vira só-ícone,
  // mas nunca some).
  const [modoSoNavegacao, setModoSoNavegacao] = useState(false)

  // --- mapa + parceiros ------------------------------------------------------
  const [mapaPronto, setMapaPronto] = useState<MapaMapbox | null>(null)
  // Painel "Camadas do mapa" (dentro do MapaNautico) controla balizamento e
  // profundidade sozinho — "parceiros" ele não desenha, então o estado sobe
  // até aqui via `aoMudarCamadas`. Nasce ligado (mesmo padrão de sempre) e só
  // muda quando o painel dispara a primeira leitura do localStorage no mount.
  const [mostrarParceiros, setMostrarParceiros] = useState(true)
  const marcadoresRef = useRef<MarcadorMapbox[]>([])
  const [parceiroAberto, setParceiroAberto] = useState<Parceiro | null>(null)
  // Destino traçado pelo card do parceiro OU pelo modo "definir destino"
  // (toque no mapa). A linha de rumo e o painel de distância/ETA reagem a
  // este mesmo estado.
  const [destino, setDestino] = useState<{ la: number; lo: number; nome: string } | null>(null)
  const [modoDefinirDestino, setModoDefinirDestino] = useState(false)

  // --- rota pela agua (Task 4, Onda 5) --------------------------------------
  // Calculo (A* + suavizacao) roda num Web Worker: medido no navegador real, a
  // rota mais longa da area coberta (Gloria -> Buzios) leva ~340ms no thread
  // principal — passa dos ~300ms combinados no plano, entao trava toques/scroll
  // do mapa se rodar ali. O Worker tem seu proprio carregarGrade() (mascara
  // decodificada uma vez, memoizada dentro dele) e faz o teste `dentroDaGrade`
  // na origem E no destino antes de tentar o A*.
  //
  // `estadoRota` guarda so os resultados do Worker, cada um marcado com o
  // objeto `destino` (por referencia) a que pertence — nunca um "ausente"
  // setado a forca dentro do efeito (isso e derivado logo abaixo, em
  // `estadoRotaAtual`). Duas razoes pra essa separacao: 1) setState so pra
  // "resetar" estado derivavel dentro de um efeito e exatamente o antipadrao
  // que o eslint-plugin-react-hooks marca (set-state-in-effect); 2) sem a
  // marca de destino, ao trocar de destino a tela mostraria por um frame a
  // rota do destino ANTERIOR (o efeito que dispara o novo calculo so roda
  // depois do primeiro paint) — com a marca, esse frame cai automaticamente
  // pra "ausente" (numeros da reta) em vez de mentir sobre o destino novo.
  const [estadoRota, setEstadoRota] = useState<EstadoRotaResultado | null>(null)
  const workerRef = useRef<Worker | null>(null)
  const proximoPedidoIdRef = useRef(0)
  // pedido em voo: id do ultimo postMessage + o destino ao qual ele pertence —
  // o listener de mensagem fica preso ao closure do efeito de montagem
  // (deps `[]`), entao precisa de um ref pra "ver" o destino atual sem
  // recriar o worker a cada troca de destino.
  const pedidoEmVooRef = useRef<{ id: number; destino: Coord } | null>(null)
  // ultima posicao/destino que efetivamente disparou um calculo — e quem decide
  // se um novo tick de GPS passou do limiar de 200 m (haversineNm) pra valer a
  // pena recalcular, ou se e so jitter normal do GPS.
  const ultimoCalculoRef = useRef<{ pos: Coord; destino: Coord } | null>(null)

  useEffect(() => {
    const worker = new Worker(new URL("./rota.worker.ts", import.meta.url), { type: "module" })
    workerRef.current = worker
    worker.addEventListener("message", (e: MessageEvent<RespostaRota>) => {
      const pedido = pedidoEmVooRef.current
      if (!pedido || e.data.id !== pedido.id) return // resposta de um pedido ja superado
      const paraDestino = pedido.destino
      switch (e.data.tipo) {
        case "rota":
          setEstadoRota({
            tipo: "rota",
            paraDestino,
            pernas: e.data.pernas,
            distanciaNm: e.data.distanciaNm,
            precisao: e.data.precisao,
            caladoM: e.data.caladoM,
            usouCorredores: e.data.usouCorredores,
            destinoAproximado: e.data.destinoAproximado,
          })
          break
        case "fora-da-area":
          setEstadoRota({ tipo: "fora-da-area", paraDestino })
          break
        case "sem-caminho":
          setEstadoRota({ tipo: "sem-caminho", paraDestino, motivo: e.data.motivo, semCaminhoPorCalado: e.data.semCaminhoPorCalado })
          break
        case "sem-mascara":
          // mascara nao carregou (rede, etc.) — nao e culpa do usuario, cai
          // pro rumo direto em silencio, sem nenhum texto de erro na tela.
          setEstadoRota(null)
          break
      }
    })
    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [])

  // Dispara o calculo quando ha destino+posicao e (destino mudou OU a posicao
  // andou mais que o limiar) — nunca a cada tick puro do GPS. Nao mexe em
  // `estadoRota` quando falta destino/posicao: a derivacao logo abaixo
  // (`estadoRotaAtual`) ja trata esse caso como "ausente".
  useEffect(() => {
    if (!destino || !posAtual) {
      ultimoCalculoRef.current = null
      return
    }
    const worker = workerRef.current
    if (!worker) return // efeito de criacao do worker ainda nao rodou

    const ultimo = ultimoCalculoRef.current
    const destinoMudou = !ultimo || ultimo.destino !== destino
    const posMudouBastante = !ultimo || haversineNm(ultimo.pos, posAtual) * 1852 > LIMIAR_RECALCULO_M
    if (!destinoMudou && !posMudouBastante) return

    const id = ++proximoPedidoIdRef.current
    pedidoEmVooRef.current = { id, destino }
    ultimoCalculoRef.current = { pos: posAtual, destino }
    setEstadoRota({ tipo: "calculando", paraDestino: destino })
    worker.postMessage({ id, de: posAtual, para: destino, caladoM } satisfies PedidoRota)
  }, [destino, posAtual, caladoM])

  // Estado de rota valido pro destino/posicao ATUAIS — colapsa pra "ausente"
  // se falta destino/posicao, ou se o resultado guardado pertence a um
  // destino que ja foi trocado. E aqui, nao no efeito acima, que "ausente"
  // nasce — puramente derivado, sem setState extra.
  const estadoRotaAtual = useMemo((): EstadoRota => {
    if (!destino || !posAtual) return { tipo: "ausente" }
    if (!estadoRota || estadoRota.paraDestino !== destino) return { tipo: "ausente" }
    return estadoRota
  }, [destino, posAtual, estadoRota])

  // Toggle "Parceiros" desligado limpa o mapa: sai cedo sem criar marcador
  // nenhum. A troca pra desligado já limpa sozinha, via cleanup do efeito
  // anterior (que roda antes deste corpo, e é quem zera marcadoresRef).
  useEffect(() => {
    if (!mapaPronto || !mostrarParceiros) return
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
  }, [mapaPronto, parceiros, mostrarParceiros])

  // Marcador do PRÓPRIO barco (onda 24, ver criarElementoBarco) — criado uma
  // única vez quando o mapa fica pronto (o elemento é estável); o efeito
  // seguinte só move/rotaciona a cada novo ponto do watcher, nunca recria —
  // recriar a cada tick (poucos segundos) reiniciaria o pulso do halo e
  // poderia piscar.
  const barcoElRef = useRef<HTMLDivElement | null>(null)
  const barcoMarcadorRef = useRef<MarcadorMapbox | null>(null)
  useEffect(() => {
    if (!mapaPronto) return
    let cancelado = false
    let marcadorCriado: MarcadorMapbox | null = null
    import("mapbox-gl").then(({ default: mapboxgl }) => {
      if (cancelado) return
      const el = criarElementoBarco()
      barcoElRef.current = el
      marcadorCriado = new mapboxgl.Marker({ element: el, anchor: "center" })
      barcoMarcadorRef.current = marcadorCriado
    })
    return () => {
      cancelado = true
      marcadorCriado?.remove()
      barcoElRef.current = null
      barcoMarcadorRef.current = null
    }
  }, [mapaPronto])

  // Posição/rotação do marcador do barco — atualizado a cada tick do watcher
  // (posAtual/headingGraus). Só entra no mapa quando há posição; some se o
  // GPS for perdido no meio do caminho (raro, mas mantém a tela honesta).
  useEffect(() => {
    const marcador = barcoMarcadorRef.current
    const el = barcoElRef.current
    if (!marcador || !el) return
    if (!posAtual) {
      marcador.remove()
      return
    }
    atualizarRumoBarco(el, headingGraus)
    marcador.setLngLat([posAtual.lo, posAtual.la])
    if (mapaPronto) marcador.addTo(mapaPronto)
  }, [posAtual, headingGraus, mapaPronto])

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
      // Rumo direto vira tracejado fino e discreto quando ha rota pela agua
      // desenhada por cima (mais abaixo): continua util (e o rumo do momento),
      // mas para de ser o numero/linha principal da tela.
      mapaPronto.addLayer({
        id: "rumo-linha",
        type: "line",
        source: "rumo",
        layout: { "line-cap": "round" },
        paint: { "line-color": COR_DOURADO, "line-width": 1.5, "line-dasharray": [2, 2], "line-opacity": 0.55 },
      })
    }
    if (!mapaPronto.getSource("rota")) {
      mapaPronto.addSource("rota", { type: "geojson", data: colecaoVazia() })
      // Rota pela agua — onda 23, casing: DUAS camadas na MESMA source,
      // padrao dos apps de navegacao serios. A de baixo (adicionada
      // primeiro — Mapbox empilha por ordem de addLayer) e um traco escuro
      // translucido mais largo, so pra dar contraste; a de cima e o nucleo
      // dourado da marca, mais fino. Isso deixa a rota legivel tanto sobre o
      // estilo nautico (claro, "faded") quanto sobre o satelite (que varia
      // muito de cor pixel a pixel). Joins/caps arredondados nas duas — sem
      // quinas na virada de perna.
      mapaPronto.addLayer({
        id: "rota-linha-casing",
        type: "line",
        source: "rota",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": COR_CASING, "line-width": 6.5, "line-opacity": 0.55 },
      })
      mapaPronto.addLayer({
        id: "rota-linha",
        type: "line",
        source: "rota",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": COR_DOURADO, "line-width": 3 },
      })
    }
    if (!mapaPronto.getSource("rota-pontos")) {
      mapaPronto.addSource("rota-pontos", { type: "geojson", data: colecaoVazia() })
      // Pontos de virada (todo ponto da rota suavizada exceto origem e destino).
      mapaPronto.addLayer({
        id: "rota-pontos-circulos",
        type: "circle",
        source: "rota-pontos",
        paint: {
          "circle-radius": 4,
          "circle-color": COR_DOURADO,
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#0B1D2D",
        },
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

  // Rota pela agua (linha + pontos de virada), redesenhada a cada resposta do
  // Worker; some (volta pra colecao vazia) em qualquer estado que nao seja uma
  // rota resolvida — inclusive "calculando", pra nao deixar a rota antiga (de
  // um destino anterior) grudada na tela enquanto a nova ainda calcula.
  useEffect(() => {
    if (!mapaPronto) return
    const sourceLinha = mapaPronto.getSource("rota") as GeoJSONSource | undefined
    const sourcePontos = mapaPronto.getSource("rota-pontos") as GeoJSONSource | undefined
    if (!sourceLinha || !sourcePontos) return

    if (estadoRotaAtual.tipo !== "rota") {
      sourceLinha.setData(colecaoVazia())
      sourcePontos.setData(colecaoVazia())
      return
    }

    const { pernas } = estadoRotaAtual
    // Onda 23 — suavizacao APENAS VISUAL (web/lib/mapa/suavizar-linha.ts,
    // Chaikin corner-cutting): o corredor navegavel continua sendo
    // EXATAMENTE o que o A* + `suavizar` (string-pulling, lib/domain/rota.ts,
    // intocado) devolveram — nenhuma celula muda, nenhum teste de dominio
    // muda. So a curva DESENHADA fica sem as quinas duras da grade nacional
    // (~3,6 km/celula), que era o "engessada" do feedback do dono. Os
    // PONTOS DE VIRADA logo abaixo usam `pernas` CRU (nao suavizado) de
    // proposito — sao waypoints reais, referencia de navegacao, nao
    // decoracao: suavizar o desenho da linha e uma coisa, mentir sobre onde
    // a rota vira e outra.
    const coordenadasSuaves = suavizarChaikin(pernas.map((p): [number, number] => [p.lo, p.la]))
    sourceLinha.setData({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: coordenadasSuaves },
        },
      ],
    })
    // pontos de virada = todo waypoint entre a origem (snapada) e o destino (snapado)
    const viradas = pernas.slice(1, -1)
    sourcePontos.setData({
      type: "FeatureCollection",
      features: viradas.map((p) => ({ type: "Feature" as const, properties: {}, geometry: { type: "Point" as const, coordinates: [p.lo, p.la] } })),
    })
  }, [mapaPronto, estadoRotaAtual])

  // Distância/rumo/ETA até o destino em linha reta — cálculo puro, não depende
  // do mapa. Continua existindo mesmo quando ha rota: e a base do painel
  // enquanto "calculando" e o fallback nos estados sem rota.
  const nav = useMemo(() => {
    if (!destino || !posAtual) return null
    const distanciaNm = haversineNm(posAtual, destino)
    const rumo = rumoGraus(posAtual, destino)
    const eta = sogKt != null ? etaMinutos(distanciaNm, sogKt) : null
    return { distanciaNm, rumo, eta }
  }, [destino, posAtual, sogKt])

  // Numeros efetivamente exibidos no painel: quando ha rota pela agua, ela
  // substitui a reta como numero principal — distancia da ROTA, rumo pra
  // PROXIMA perna (nao pro destino final) e ETA pela distancia da rota. Nos
  // demais estados (calculando/fora-da-area/sem-caminho/ausente), mostra os
  // numeros da reta mesmo — e o que a linha tracejada na tela representa.
  const navExibido = useMemo(() => {
    if (!nav) return null
    if (estadoRotaAtual.tipo === "rota" && posAtual) {
      const { pernas, distanciaNm } = estadoRotaAtual
      const proximoPonto = pernas[1] ?? pernas[pernas.length - 1]
      return {
        distanciaNm,
        rumo: rumoGraus(posAtual, proximoPonto),
        eta: sogKt != null ? etaMinutos(distanciaNm, sogKt) : null,
        pernasQtd: pernas.length - 1,
      }
    }
    return { distanciaNm: nav.distanciaNm, rumo: nav.rumo, eta: nav.eta, pernasQtd: null as number | null }
  }, [nav, estadoRotaAtual, posAtual, sogKt])

  // Aviso de calado (onda 12) — so existe quando ha uma ROTA resolvida (nos
  // demais estados a mensagem propria ja cobre o motivo, inclusive
  // "sem-caminho" que ja usa `semCaminhoPorCalado` pra explicar por que).
  // Compara o calado APLICADO pelo worker (estadoRotaAtual.caladoM) com o
  // calado CADASTRADO do barco (prop `caladoM`) pra distinguir os 3 casos
  // honestos pedidos na task: respeita X m / sem calado cadastrado (com link
  // pra cadastrar) / calado cadastrado mas não pude aplicar agora. NUNCA
  // inventa um calado padrão em silêncio.
  const avisoCalado = useMemo(() => {
    if (estadoRotaAtual.tipo !== "rota") return null
    if (estadoRotaAtual.caladoM != null) {
      return {
        tom: "info" as const,
        texto: `Rota respeita o calado de ${estadoRotaAtual.caladoM.toLocaleString("pt-BR")} m — evita águas rasas CONHECIDAS na resolução do mapa; não garante a profundidade real no local exato.`,
        linkCadastrar: false,
      }
    }
    if (caladoM == null) {
      return {
        tom: "aviso" as const,
        texto: "Calado não cadastrado — a rota não leva em conta a profundidade.",
        linkCadastrar: true,
      }
    }
    return {
      tom: "aviso" as const,
      texto: "Não consegui carregar o dado de profundidade agora — a rota não leva em conta o calado desta vez.",
      linkCadastrar: false,
    }
  }, [estadoRotaAtual, caladoM])

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

  // Marcador de DESTINO no mapa — os apps grandes sempre mostram o ponto
  // escolhido, com ou sem GPS; a linha de rumo e os numeros chegam quando a
  // posicao existir. Onda 23: trocou o pino padrao do Mapbox por
  // `criarElementoDestinoRota` (marcador proprio da marca, ver comentario
  // acima da funcao) — o halo tracejado so aparece quando `destinoAproximado`
  // (onda 22) e verdadeiro, entao o efeito precisa reagir a `estadoRotaAtual`
  // tambem, nao so a `destino` (senao o halo nunca apareceria depois que a
  // rota resolvesse DEPOIS do marcador ja existir).
  const destinoAproximadoAtual = estadoRotaAtual.tipo === "rota" && estadoRotaAtual.destinoAproximado
  useEffect(() => {
    if (!mapaPronto || !destino) return
    let cancelado = false
    let marcador: MarcadorMapbox | null = null
    import("mapbox-gl").then(({ default: mapboxgl }) => {
      if (cancelado) return
      marcador = new mapboxgl.Marker({ element: criarElementoDestinoRota(destinoAproximadoAtual), anchor: "center" })
        .setLngLat([destino.lo, destino.la])
        .addTo(mapaPronto)
    })
    return () => {
      cancelado = true
      marcador?.remove()
    }
  }, [mapaPronto, destino, destinoAproximadoAtual])

  // Marcador de ORIGEM da rota pela agua — onda 23, ver
  // `criarElementoOrigemRota`. So existe quando ha uma rota RESOLVIDA (o
  // ponto onde o A* realmente comecou, apos o snap) — nos demais estados
  // (calculando/sem-caminho/ausente) nao ha "origem de rota" nenhuma pra
  // marcar, so a posicao do GPS (que o ponto azul nativo ja mostra).
  const origemRota = estadoRotaAtual.tipo === "rota" ? estadoRotaAtual.pernas[0] : null
  useEffect(() => {
    if (!mapaPronto || !origemRota) return
    let cancelado = false
    let marcador: MarcadorMapbox | null = null
    import("mapbox-gl").then(({ default: mapboxgl }) => {
      if (cancelado) return
      marcador = new mapboxgl.Marker({ element: criarElementoOrigemRota(), anchor: "center" })
        .setLngLat([origemRota.lo, origemRota.la])
        .addTo(mapaPronto)
    })
    return () => {
      cancelado = true
      marcador?.remove()
    }
  }, [mapaPronto, origemRota])

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

  // Onda 23 — classes do wrapper colapsavel do modo "so navegacao": max-h +
  // opacidade + leve deslize, nunca `hidden`/unmount (mantem qualquer
  // conexao/efeito vivo dentro do que esta sendo recolhido — ver comentario
  // grande no JSX abaixo). A transicao de duracao respeita
  // prefers-reduced-motion pela regra global em app/globals.css (zera TODAS
  // as duration/transition-duration quando o usuario pediu menos movimento),
  // entao nao precisa repetir a logica aqui.
  function classeColapsavel(direcaoSaida: "cima" | "baixo"): string {
    const translate = direcaoSaida === "cima" ? "-translate-y-1" : "translate-y-1"
    // Onda 24 (passe de arte, bloco 5): 300ms → 200ms — "tremor zero" pedia
    // uma transição mais seca, ainda suave o bastante pra não ser um corte.
    return `flex flex-col gap-2 overflow-hidden transition-all duration-200 ${
      modoSoNavegacao ? `pointer-events-none max-h-0 ${translate} opacity-0` : "pointer-events-auto max-h-[999px] translate-y-0 opacity-100"
    }`
  }

  return (
    // Tela cheia: escapa do px-4/pt-5/pb-24 do layout com margens negativas;
    // a altura desconta a bottom nav fixa (~4rem). O mapa é a tela; todo o
    // resto flutua por cima.
    <main className="relative -mx-4 -mt-5 -mb-24 h-[calc(100dvh-4rem)]">
      <h1 className="sr-only">Navegar</h1>
      <MapaNautico
        aoIniciar={setMapaPronto}
        aoMudarCamadas={(c: EstadoCamadas) => setMostrarParceiros(c.parceiros)}
        className="h-full w-full"
      />

      {/* coluna do topo: alarme + trilha EMPILHADOS (nunca se sobrepõem);
          right-14 deixa livres os controles do mapa (zoom/bússola/locate) */}
      <div className="absolute left-3 right-14 top-3 z-20 flex flex-col gap-2">
        {/* Alarme de âncora: segurança > estética — aparece em QUALQUER modo,
            inclusive "só navegação" (onda 23). Por isso fica FORA do
            wrapper colapsável logo abaixo, não dentro dele. */}
        {garrando && (
          <div role="alert" className="sombra-2 animate-pulse rounded-[12px] border border-crit bg-crit px-4 py-3 text-center text-sm font-bold text-white">
            GARRANDO — verifique o fundeio
          </div>
        )}

        {/* Trilha + Sondagem: recolhem no modo "só navegação" (onda 23).
            CSS (max-h/opacidade), nunca unmount — a SondagemPainel pode ter
            uma conexão NMEA ativa em segundo plano (fila persistente, onda
            14); desmontar o componente derrubaria essa conexão só porque a
            pessoa escondeu o cartão. `aria-hidden` tira do assistivo quando
            recolhido; `classeColapsavel` já cuida do pointer-events. */}
        <div aria-hidden={modoSoNavegacao} className={classeColapsavel("cima")}>
        {/* Onda 24 (passe de arte, bloco 2) — identidade de "instrumento de
            ponte": navy translúcido fixo (--mapa-instrumento, não segue o
            tema claro/escuro do app — ver comentário em globals.css),
            recolhido vira pílula fina, expandido vira instrumento. Texto
            interno usa meter-texto/meter-dim (não texto/dim, que seguem o
            TEMA e leriam mal aqui). */}
        <div className="sombra-2 overflow-hidden rounded-[14px] border border-mapa-instrumento-borda bg-mapa-instrumento text-meter-texto backdrop-blur">
          <button
            type="button"
            onClick={() => setPainelAberto((v) => !v)}
            aria-expanded={painelAberto}
            className="flex w-full items-center justify-between px-4 py-3"
          >
            <span className="flex items-center gap-2">
              <span className={`size-2 rounded-full ${estado === "gravando" ? "animate-pulse bg-crit" : "bg-meter-dim"}`} />
              <span className="titulo-card uppercase tracking-[.04em]">
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
                <span className="rounded-full border border-mapa-instrumento-borda bg-meter px-2.5 py-1 font-mono-instr text-xs tabular-nums text-accent">
                  {sogKt.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kt
                </span>
              )}
              <Icone
                nome="chevron"
                className={`size-4 text-meter-dim transition-transform ${painelAberto ? "-rotate-90" : "rotate-90"}`}
              />
            </span>
          </button>

          {painelAberto && (
            <div className="border-t border-mapa-instrumento-borda px-4 pb-4 pt-3">
              <p className="apoio text-meter-dim">
                Mantenha o app aberto durante o passeio — a trilha vira um evento no Diário de Bordo.
                Auxílio à navegação: não substitui as cartas náuticas oficiais.
              </p>
              {msg && <p className="mt-3 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-sm">{msg}</p>}
              {estado === "parado" && (
                <p className="mt-3 rounded-lg border border-mapa-instrumento-borda bg-black/15 px-3 py-2 text-sm text-meter-dim">
                  GPS parado — a trilha está pronta para salvar.
                </p>
              )}

              <div className="mt-4 grid grid-cols-2 gap-2">
                <Mostrador
                  variante="cartao"
                  rotulo="Velocidade"
                  valor={painel.velKt.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                  unidade="kt"
                />
                <Mostrador
                  variante="cartao"
                  rotulo="Distância"
                  valor={painel.resumo.distanciaNm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                  unidade="nm"
                />
                <Mostrador
                  variante="cartao"
                  rotulo="Tempo"
                  valor={(painel.resumo.duracaoH * 60).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                  unidade="min"
                />
                <Mostrador
                  variante="cartao"
                  rotulo="Máxima"
                  valor={painel.resumo.velMaxKt.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                  unidade="kt"
                />
              </div>

              {/* Consentimento de corredores (onda 17) — opt-IN explicito,
                  lembrado no aparelho (CHAVE_CONSENTIMENTO_CORREDOR). Fica
                  visível em qualquer estado do painel (não só "pronto"):
                  o dono pode mudar de ideia a qualquer momento antes de
                  salvar, e o texto continua valendo enquanto a trilha
                  grava. */}
              <label className="mt-4 flex min-h-11 cursor-pointer items-start gap-2.5 text-sm text-meter-dim">
                <input
                  type="checkbox"
                  checked={contribuirCorredor}
                  onChange={(e) => alternarConsentimentoCorredor(e.target.checked)}
                  className="mt-0.5 size-5 shrink-0"
                />
                Contribuir com o mapa de corredores — ao salvar, esta trilha vira passagens anônimas, agregadas por
                área, nunca sua rota individual. Ajuda outros barcos a encontrar caminho.
              </label>

              {estado === "pronto" && (
                <button onClick={iniciar} className="mt-4 w-full rounded-xl bg-accent py-3.5 text-base font-semibold text-acao-texto">
                  Iniciar gravação
                </button>
              )}
              {estado !== "pronto" && (
                <>
                  <div className="mt-4">
                    <label htmlFor="obs" className="mb-1.5 block font-mono-instr text-[11px] uppercase tracking-[.14em] text-meter-dim">
                      Observação — opcional
                    </label>
                    <input
                      id="obs"
                      value={obs}
                      onChange={(e) => setObs(e.target.value)}
                      placeholder="Ex.: volta às Cagarras"
                      // texto explícito (não herda o meter-texto do cartão):
                      // bg-campo continua seguindo o TEMA (branco no claro),
                      // então a cor do texto também precisa seguir o tema
                      className="w-full rounded-[10px] border border-line bg-campo px-3 py-3 text-base text-texto"
                    />
                  </div>
                  <button
                    onClick={encerrarESalvar}
                    disabled={estado === "salvando"}
                    className="mt-3 w-full rounded-xl bg-crit py-3.5 text-base font-semibold text-white disabled:opacity-60"
                  >
                    {estado === "salvando" ? "Salvando…" : estado === "parado" ? "Tentar salvar de novo" : "Encerrar e salvar no diário"}
                  </button>
                  <p className="mt-2 text-center font-mono-instr text-[11px] tabular-nums text-meter-dim">
                    {painel.qtd} pontos gravados
                    {painel.qtd >= MAX_PONTOS_TRILHA ? " · limite atingido — a trilha será salva até aqui" : ""}
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        <SondagemPainel />
        </div>
      </div>

      {/* Onda 23 — barra compacta de navegação: SOG sempre que houver GPS, +
          rumo/ETA quando houver destino, numa única linha discreta. É o que
          sobra no modo "só navegação" além do mapa e do botão de voltar —
          mas fica MONTADA nos dois modos (só a opacidade/posição mudam) pra
          a transição de entrada/saída ser de verdade uma animação, não um
          corte seco. Mesmos números do cartão de destino mais abaixo
          (`navExibido`) — nunca dois valores diferentes pro mesmo dado. */}
      {sogKt != null && (
        // Onda 24 — mesma casca "instrumento de ponte" dos 3 cartões
        // (Trilha/Sondagem/painel de rota): esta barra é o MESMO tipo de
        // leitura compacta, só muda o agrupamento (ver comentário do
        // Mostrador acima) — ficaria destoante como único sobrevivente do
        // visual antigo (bg-panel/95 claro), e o texto dourado do Mostrador
        // não teria contraste garantido sobre --superficie no tema claro.
        <div
          aria-hidden={!modoSoNavegacao}
          className={`sombra-2 pointer-events-none absolute left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full border border-mapa-instrumento-borda bg-mapa-instrumento px-4 py-2 backdrop-blur transition-all duration-200 ${
            garrando ? "top-16" : "top-3"
          } ${modoSoNavegacao ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"}`}
        >
          <Mostrador rotulo="SOG" valor={sogKt.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} unidade="kt" />
          {destino && navExibido && (
            <>
              <span aria-hidden="true" className="h-6 w-px bg-mapa-instrumento-borda" />
              <Mostrador rotulo="Rumo" valor={`${Math.round(navExibido.rumo)}°`} />
              <span aria-hidden="true" className="h-6 w-px bg-mapa-instrumento-borda" />
              <Mostrador rotulo="ETA" valor={navExibido.eta != null ? String(navExibido.eta) : "—"} unidade={navExibido.eta != null ? "min" : undefined} />
            </>
          )}
        </div>
      )}

      {/* Faixa de baixo em COLUNA: botões em cima, painel do destino embaixo.
          Antes eram dois blocos absolutos com bottom fixo, e o painel cobria o
          MOB e o cartão do alarme (o dono viu: "aciono o alarme e não acontece
          nada"). Em fluxo, nada se sobrepõe, com ou sem destino. */}
      <div className="pointer-events-none absolute inset-x-3 bottom-12 z-20 flex flex-col items-end gap-2">
        {/* Definir destino / Planejar viagem / Fundeei: recolhem no modo "só
            navegação" (onda 23) — mesmo wrapper CSS-only do topo. */}
        <div aria-hidden={modoSoNavegacao} className={`${classeColapsavel("baixo")} items-end`}>
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

          {/* Onda 19 (Pilar Strava do Mar) — entrada pra planejar viagem com
              paradas. Fica ao lado de "Definir destino" (mesma família de
              atalho: os dois levam a marcar pontos no mapa), mas abre a
              tela dedicada em vez de reusar o destino único — ver
              PlanejarViagemMapa. */}
          {mapaPronto && podePlanejarViagem && (
            <button
              type="button"
              onClick={() => router.push("/navegar/viagem/nova")}
              className="sombra-2 flex h-11 items-center gap-1.5 rounded-full border border-line bg-panel/95 px-3 text-sm font-medium text-dim backdrop-blur"
            >
              <Icone nome="estrela" className="size-4" />
              Planejar viagem
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

        </div>

        {/* Onda 23 — sempre visíveis, nos DOIS modos (não entram no wrapper
            colapsável acima): o botão de MOB é segurança pura — homem ao mar
            não pode ficar atrás de um toque extra pra "sair do modo
            limpo" primeiro; no modo só-navegação ele encolhe pro ícone
            sozinho (ainda 44px, ainda no mesmo canto), nunca some. O botão
            de entrar/sair do modo é o que permite VOLTAR pro normal — se ele
            também sumisse no modo que ele mesmo liga, não teria como
            desligar. */}
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={() => setModoSoNavegacao((v) => !v)}
            aria-pressed={modoSoNavegacao}
            aria-label={modoSoNavegacao ? "Sair do modo só navegação" : "Modo só navegação"}
            className="sombra-2 flex size-11 items-center justify-center rounded-full border border-line bg-panel/95 text-dim backdrop-blur"
          >
            <span aria-hidden="true" className="flex items-center">
              <Icone nome="chevron" className={`size-4 ${modoSoNavegacao ? "rotate-180" : ""}`} />
              <Icone nome="chevron" className={`-ml-2 size-4 ${modoSoNavegacao ? "" : "rotate-180"}`} />
            </span>
          </button>

          <button
            type="button"
            onClick={acionarMob}
            disabled={!posAtual}
            aria-label="Homem ao mar"
            className={`sombra-2 flex h-11 items-center justify-center gap-1.5 rounded-full bg-crit font-bold text-white transition-all duration-200 disabled:opacity-50 ${
              modoSoNavegacao ? "w-11 px-0" : "px-4 text-sm"
            }`}
          >
            <Icone nome="alerta" className="size-4 shrink-0" />
            {!modoSoNavegacao && "MOB"}
          </button>
        </div>

        <div aria-hidden={modoSoNavegacao} className={`${classeColapsavel("baixo")} w-full items-end`}>
        {destino && (
          // Onda 24 (passe de arte, blocos 2+4) — painel de rota como
          // instrumento de ponte: mesma casca navy translúcida dos outros
          // dois cartões (raio 14, ver comentário do Mostrador acima).
          // text-meter-texto/meter-dim no lugar de texto/dim (que seguem o
          // TEMA do app, não o fundo fixo daqui); text-warn continua
          // text-warn — o cartão herda o override de --warn/--crit "seguro
          // pra navy" via .bg-mapa-instrumento em globals.css.
          <div className="sombra-2 pointer-events-auto w-full rounded-[14px] border border-mapa-instrumento-borda bg-mapa-instrumento px-3 py-2.5 text-meter-texto backdrop-blur">
            <div className="flex items-center justify-between gap-2">
              <span className="corpo flex min-w-0 items-center gap-2">
                <Icone nome="mapa" className="size-4 shrink-0 text-accent" />
                <span className="truncate">
                  {estadoRotaAtual.tipo === "rota" ? `Rota pela água para ${destino.nome}` : `Rumo direto para ${destino.nome}`}
                </span>
              </span>
              <button
                type="button"
                onClick={() => {
                  // limpar o destino tambem recolhe o marcador de MOB (senao ele
                  // ficaria orfao no mapa) e a rota — com destino=null,
                  // `estadoRotaAtual` colapsa pra "ausente" (derivado, sem
                  // setState extra) e esvazia as sources "rota"/"rota-pontos"
                  setDestino(null)
                  setMob(null)
                }}
                aria-label="Limpar destino"
                className="flex size-8 shrink-0 items-center justify-center text-meter-dim"
              >
                <Icone nome="mais" className="size-4 rotate-45" />
              </button>
            </div>
            {!posAtual && (
              <div className="mt-2 border-t border-mapa-instrumento-borda pt-2">
                <p className="apoio text-meter-dim">Destino marcado no mapa. Ative a localização para ver rumo, distância e ETA daqui até lá.</p>
                {dicaGps && <p className="apoio mt-1 text-meter-dim">{dicaGps}</p>}
                <button
                  type="button"
                  onClick={pedirPosicao}
                  className="mt-2 flex h-11 w-full items-center justify-center rounded-lg border border-mapa-instrumento-borda text-sm font-medium"
                >
                  Ativar localização
                </button>
              </div>
            )}

            {/* Estados honestos da rota — nenhum deles falha mudo: ou mostra a
                rota, ou explica por que so ha o rumo direto. So aparecem com
                posicao conhecida (sem GPS ja tem o aviso acima). */}
            {posAtual && estadoRotaAtual.tipo === "calculando" && (
              <p className="apoio mt-2 flex items-center gap-1.5 border-t border-mapa-instrumento-borda pt-2 text-meter-dim">
                <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-accent" aria-hidden="true" />
                Calculando rota pela água…
              </p>
            )}
            {posAtual && estadoRotaAtual.tipo === "fora-da-area" && (
              <p className="apoio mt-2 border-t border-mapa-instrumento-borda pt-2 text-meter-dim">
                Fora da costa brasileira mapeada. Mostrando rumo direto.
              </p>
            )}
            {posAtual && estadoRotaAtual.tipo === "sem-caminho" && (
              <p className="apoio mt-2 border-t border-mapa-instrumento-borda pt-2 text-warn">
                {estadoRotaAtual.semCaminhoPorCalado
                  ? `Não achei caminho com o calado do seu barco${caladoM != null ? ` (${caladoM.toLocaleString("pt-BR")} m)` : ""} — existe rota sem essa restrição.`
                  : estadoRotaAtual.motivo === "origem-longe-da-agua"
                    ? "Você está longe da água — a rota pela água nasce no mar."
                    : estadoRotaAtual.motivo === "destino-longe-da-agua"
                      ? "Esse ponto está longe da água — toque mais perto do mar."
                      : "Não achei caminho pela água até esse ponto."}
              </p>
            )}
            {posAtual && estadoRotaAtual.tipo === "rota" && estadoRotaAtual.precisao === "fina" && (
              <p className="apoio mt-2 border-t border-mapa-instrumento-borda pt-2 text-meter-dim">
                Rota pela água — contorna a costa. Auxílio à navegação, não substitui a carta náutica.
              </p>
            )}
            {posAtual && estadoRotaAtual.tipo === "rota" && estadoRotaAtual.precisao === "nacional" && (
              <p className="apoio mt-2 border-t border-mapa-instrumento-borda pt-2 text-warn">
                Rota pela água (cobertura nacional) — grade mais grossa, margem de segurança maior. Boa pra
                travessia longa; não use pra aproximação de porto.
              </p>
            )}
            {/* Onda 22 — rota costurada: trecho costeiro (perto da origem OU
                do destino, o que estiver na área histórica) usa a grade fina
                de sempre; o resto do trajeto usa a nacional, mais grossa.
                Mesmo tom de aviso da nacional pura — a parte grosseira é a
                mesma restrição. */}
            {posAtual && estadoRotaAtual.tipo === "rota" && estadoRotaAtual.precisao === "mista" && (
              <p className="apoio mt-2 border-t border-mapa-instrumento-borda pt-2 text-warn">
                Rota pela água — trecho costeiro com o detalhe de sempre, restante por cobertura nacional (grade
                mais grossa). Boa pra travessia longa; não use pra aproximação de porto.
              </p>
            )}
            {/* Onda 22 — destino aproximado: o snap generoso da nacional achou
                água longe o bastante do ponto tocado pra a rota NÃO terminar
                nele de verdade — nunca fingir que chega no píer exato. */}
            {posAtual && estadoRotaAtual.tipo === "rota" && estadoRotaAtual.destinoAproximado && (
              <p className="apoio mt-2 border-t border-mapa-instrumento-borda pt-2 text-warn">
                A rota chega até a altura do destino — o trecho final de aproximação até o ponto exato é por sua
                conta.
              </p>
            )}
            {posAtual && estadoRotaAtual.tipo === "rota" && avisoCalado && (
              <p className={`apoio mt-2 ${estadoRotaAtual.precisao !== "fina" ? "" : "border-t border-mapa-instrumento-borda pt-2"} ${avisoCalado.tom === "aviso" ? "text-warn" : "text-meter-dim"}`}>
                {avisoCalado.texto}
                {avisoCalado.linkCadastrar && (
                  <>
                    {" "}
                    <Link href="/barco/editar" className="underline">
                      Cadastrar calado
                    </Link>
                  </>
                )}
              </p>
            )}
            {/* Honestidade sobre corredores (onda 17) — discreto, NUNCA
                "validada"/"segura": passagem historica de outro barco (as
                vezes menor, mais raso) nao garante profundidade pro seu. */}
            {posAtual && estadoRotaAtual.tipo === "rota" && estadoRotaAtual.usouCorredores && (
              <p className="apoio mt-2 border-t border-mapa-instrumento-borda pt-2 text-meter-dim">
                Considera passagens reais de outros barcos nesta área — não é garantia de profundidade, a carta
                náutica continua sendo a referência.
              </p>
            )}
            {posAtual && estadoRotaAtual.tipo === "ausente" && nav && (
              <p className="apoio mt-2 border-t border-mapa-instrumento-borda pt-2 text-warn">
                Linha reta até o ponto — pode cruzar terra. Confira a carta antes de seguir.
              </p>
            )}

            {navExibido && (
              <div className="mt-2 grid grid-cols-3 gap-2">
                <Mostrador tamanho="lg" rotulo="Distância" valor={navExibido.distanciaNm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} unidade="MN" />
                <Mostrador tamanho="lg" rotulo="Rumo" valor={`${Math.round(navExibido.rumo)}°`} />
                <Mostrador tamanho="lg" rotulo="ETA" valor={navExibido.eta != null ? String(navExibido.eta) : "—"} unidade={navExibido.eta != null ? "min" : undefined} />
              </div>
            )}
            {navExibido?.pernasQtd != null && navExibido.pernasQtd > 0 && (
              <p className="apoio mt-1 text-center text-meter-dim">
                {navExibido.pernasQtd} {navExibido.pernasQtd === 1 ? "perna" : "pernas"}
              </p>
            )}
          </div>
        )}
        </div>

      </div>

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
