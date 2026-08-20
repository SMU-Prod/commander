"use client"
import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { Map as MapaMapbox, Marker as MarcadorMapbox, MapMouseEvent, GeoJSONSource, MapEventOf } from "mapbox-gl"
import { AvisoNavegar } from "@/components/mapa/aviso-navegar"
import { useCamadaSondagens } from "@/components/mapa/camada-sondagens"
import { CardParceiro } from "@/components/mapa/card-parceiro"
import { MapaNautico } from "@/components/mapa/mapa-nautico"
import { SondagemPainel } from "@/components/mapa/sondagem-painel"
import { TempoPainel } from "@/components/mapa/tempo-painel"
import { useCoresMapa } from "@/components/mapa/usar-cores-mapa"
import { Icone } from "@/components/icone"
import { Medidor } from "@/components/ui/medidor"
import { ProgressoRota } from "@/components/ui/progresso-rota"
import { Selo } from "@/components/ui/selo"
import { formatarEta } from "@/lib/mapa/eta"
import { salvarTrilha } from "@/lib/acoes/trilha"
import { haversineNm, resumoTrilha, MAX_PONTOS_TRILHA, type PontoTrilha, type ResumoTrilha } from "@/lib/domain/geo"
import { msParaNos, rumoGraus, etaMinutos, foraDoRaio } from "@/lib/domain/navegacao"
import {
  amortecerRumo,
  chegouAoDestino,
  emMovimento,
  progressoNaRota,
  zoomPorVelocidade,
} from "@/lib/domain/modo-navegando"
import type { EstadoCamadas } from "@/lib/mapa/camadas"
import { criarElementoMarcadorParceiro } from "@/lib/mapa/pino-parceiro"
import type { Parceiro } from "@/lib/db/types"
import type { PedidoRota, Precisao, RespostaRota } from "@/components/mapa/rota.worker"
import type { MotivoFalhaRota } from "@/lib/domain/rota"
import {
  lerAvisoNavegarVisto,
  lerConsentimentoCorredor,
  marcarAvisoNavegarVisto,
} from "@/lib/preferencias-navegacao"

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
      /** Onda 27: coordenadas ja suavizadas (Chaikin) e verificadas contra a
       *  agua, prontas pra desenhar — calculadas no worker, que e quem tem a
       *  grade carregada (ver rota.worker.ts). NUNCA suavizar `pernas` de
       *  novo aqui: sem a grade, essa suavizacao local nao teria como saber
       *  se o corte de uma quina fechada perto da costa cai em terra (caso
       *  real de producao, 13/08/2026). */
      linhaSuave: Coord[]
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

// Onda 90 (achado 4.5) — entrada do modo "só navegação" por MOVIMENTO. A
// justificativa de cada um dos dois números está no efeito que os usa
// (procure por `inicioDaMarchaRef`); resumo: 4 kt é acima do que um barco
// parado produz e abaixo de qualquer manobra real, e 30 s é mais longo que
// qualquer rajada de ruído de SOG do GPS.
const LIMIAR_SO_NAVEGACAO_KT = 4
const MS_MARCHA_SUSTENTADA = 30_000

const CHAVE_ANCORA = "ancora"
const RAIO_PADRAO_M = 40

// ONDA 89 (achado 4.1) — AS CORES DESTA TELA SAÍRAM DO HEXADECIMAL.
//
// Aqui viviam três literais (o dourado da marca, o vermelho de alarme e o
// navy do casing) e eles produziam o defeito mais visível da auditoria: a
// linha da rota era dourada e a pílula de SOG encostada nela era limão,
// porque a pílula lê o token e a linha não. Duas marcas, na mesma tela.
//
// Agora tudo que pinta CAMADA lê `useCoresMapa()` (ver
// lib/mapa/cores-tema.ts pro porquê de o canvas WebGL precisar da leitura
// explícita) e tudo que pinta DOM usa classe utilitária, que resolve o token
// sozinha. Nenhum dos dois caminhos pode divergir do `app/globals.css`.

// Onda 26 (modo navegando) — parâmetros da câmera perseguidora. Constantes
// de módulo (não dependem de props/estado): `FATOR_AMORTECIMENTO_RUMO` mais
// alto responde mais rápido a uma virada real, mais baixo filtra mais
// jitter do GPS (0.3 = ~3-4 leituras pra "alcançar" uma virada de 90°, bom
// equilíbrio testado contra o jitter típico de heading em barco real);
// `PITCH_NAVEGANDO` fica dentro dos 45-60° pedidos, mais perto do piso —
// inclinação o bastante pra dar a perspectiva de "estrada", sem comer tanto
// a área plana onde os números do painel e os ícones do mapa (boias,
// parceiros) precisam continuar legíveis; `FRACAO_PADDING_TOPO` desloca o
// centro visual pra baixo (ver o efeito de câmera, mais abaixo, pelo
// porquê de ser `padding.top` e não `bottom`) — 55% do container deixa a
// embarcação por volta de 77% da altura da tela, dentro do terço inferior
// pedido; `DURACAO_EASETO_MS` cobre o intervalo típico entre ticks do
// watchPosition sem empilhar animação nova em cima de uma ainda em voo.
const FATOR_AMORTECIMENTO_RUMO = 0.3
const PITCH_NAVEGANDO = 55
const FRACAO_PADDING_TOPO = 0.55
const DURACAO_EASETO_MS = 1200
// Onda 23 — casing da rota: traco escuro translucido por baixo do nucleo
// da marca, mesmo padrao dos apps de navegacao serios (legivel sobre o
// nautico "faded" claro E sobre o satelite, que varia muito de cor). O navy
// dele agora e o token `--meter` lido pelo helper — ver o bloco acima.

// Ícones/cores do pino do parceiro (onda 10, Pedido 2) — extraídos pra
// web/lib/mapa/pino-parceiro.ts na onda 39 (ExplorarMapa passou a
// precisar do mesmo desenho de pino). `criarElementoMarcadorParceiro`
// importado no topo do arquivo é quem monta o marcador agora.
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
  halo.className = "marcador-barco-halo absolute -inset-2.5 rounded-[var(--raio-pilula)] bg-meter/60"
  el.appendChild(halo)

  // proa: visível com rumo conhecido, rotacionada via transform inline.
  // Onda 89 — `bg-accent` no lugar do dourado cravado: era ESTE marcador que
  // aparecia dourado ao lado do botão "Voltar ao barco" limão. `currentColor`
  // no preenchimento do traçado, com o par de contraste da ação na classe do
  // container — se a utilitária faltar, o traço herda cor em vez de sumir.
  //
  // `sombra-2` e não `shadow`: os CINCO marcadores deste arquivo (proa, ponto,
  // MOB, origem e destino da rota) escreviam a elevação em utilitária do
  // Tailwind — `shadow` em três, `shadow-lg` em dois —, dois degraus que a
  // escala do app não tem. A escala é `sombra-1` (separa do fundo), `sombra-2`
  // (isto FLUTUA) e o plano, que é a ausência das duas (docs/DESIGN.md §5). E
  // "pastilha sobre o mapa" é o exemplo literal que a doc dá de `sombra-2`:
  // pino de marcador não está encostado na página, ele paira sobre a carta.
  // Os dois degraus crus também divergiam do resto DESTE arquivo, que já pinta
  // cada flutuante seu com `sombra-2` — instrumento, pílula de rumo, botoeira.
  const proa = document.createElement("div")
  proa.dataset.papel = "proa"
  proa.className =
    "sombra-2 relative flex size-7 items-center justify-center rounded-[var(--raio-pilula)] bg-accent text-acao-texto ring-2 ring-white"
  proa.innerHTML = `<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">${TRACADO_PROA_BARCO}</svg>`
  el.appendChild(proa)

  // ponto: visível sem rumo (parado, ou o navegador não expõe o dado) —
  // mesma cor da marca, sem seta nenhuma pra não inventar uma direção.
  const ponto = document.createElement("div")
  ponto.dataset.papel = "ponto"
  ponto.className = "sombra-2 relative hidden size-4 rounded-[var(--raio-pilula)] bg-accent ring-2 ring-white"
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

/** Marcador do "homem ao mar" — vermelho pra contrastar com os pinos navy
 *  dos parceiros; mesmo padrão de innerHTML estático (nunca dado de
 *  usuário) usado acima. */
function criarElementoMob(): HTMLDivElement {
  const el = document.createElement("div")
  el.className = "sombra-2 flex size-9 items-center justify-center rounded-[var(--raio-pilula)] bg-crit text-acao-texto ring-2 ring-white"
  el.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${TRACADO_MOB}</svg>`
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
  el.className = "sombra-2 size-3.5 rounded-[var(--raio-pilula)] bg-accent ring-2 ring-white"
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
    halo.className = "absolute -inset-2 rounded-[var(--raio-pilula)] border-2 border-dashed border-accent"
    wrapper.appendChild(halo)
  }
  const corpo = document.createElement("div")
  corpo.className =
    "sombra-2 relative flex size-9 items-center justify-center rounded-[var(--raio-pilula)] bg-accent text-acao-texto ring-2 ring-white"
  corpo.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${TRACADO_DESTINO_ROTA}</svg>`
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
 *  pequeno em caixa de frase (`.rotulo-dado`, onda 80 — era uppercase
 *  rastreado até aqui, ver app/globals.css pro porquê da troca); valor
 *  grande, tabular-nums — onda 23,
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
 *  Cores: `text-accent` (não `text-accent-forte`) pro valor.
 *
 *  ONDA 95 (achado 5.8) — ESTA LINHA DIZIA O CONTRÁRIO DO QUE O TOKEN FAZ.
 *  O texto anterior afirmava que `--acao` "é o único dourado da marca que NÃO
 *  troca entre os dois temas". Troca: `globals.css` declara um dourado no
 *  claro e um limão no escuro, e quem lê a linha antiga acredita que pode
 *  cravar o valor dela em qualquer lugar — que é exatamente a deriva que a
 *  catraca de cor literal existe pra impedir. Comentário errado é pior que
 *  comentário nenhum: ele autoriza.
 *  O MOTIVO REAL da escolha é outro, e continua valendo: todo mostrador vive
 *  sobre fundo navy FIXO (bg-meter, ou o cartão de instrumento da onda 24),
 *  nunca sobre --superficie. `--acao-forte` é calibrado pro par oposto — no
 *  tema claro ele é um dourado escuro, feito pra ler sobre branco, e sobre o
 *  navy fixo ele praticamente some. `--acao` é o valor que lê sobre navy nos
 *  DOIS temas, cada um com o seu tom. Rótulo/unidade usam `text-meter-dim` pelo
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
      <div className="rounded-[var(--raio-cartao)] border border-mapa-instrumento-borda bg-meter px-3 py-2 tabular-nums tabular-nums">
        <p className="rotulo-dado !text-meter-dim">{rotulo}</p>
        <p className="text-2xl text-accent">
          {valor} {unidade && <span className="text-sm text-meter-dim">{unidade}</span>}
        </p>
      </div>
    )
  }
  return (
    <div className="text-center">
      <p className="rotulo-dado !text-meter-dim">{rotulo}</p>
      <p className={`tabular-nums tabular-nums text-accent ${tamanho === "lg" ? "text-lg" : "text-sm"}`}>
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
 *  de qualquer forma (checa de novo lá, e a RLS protege a escrita).
 *
 *  `destinoInicial` (onda 26, modo navegando): ponte entre "planejar
 *  viagem" e "navegar" — o botão "Iniciar navegação" em VerViagemMapa
 *  (web/components/mapa/ver-viagem-mapa.tsx) manda pra cá com o destino
 *  FINAL da viagem já planejada (`?destino_la=&destino_lo=&destino_nome=`,
 *  lido no servidor em navegar/page.tsx). Vira só o `destino` inicial desta
 *  tela — dali em diante é o MESMO fluxo de sempre (rota pela água, modo
 *  navegando por movimento, tudo). Multi-parada de verdade (virar pra
 *  próxima parada sozinho ao chegar em cada uma) fica pra uma onda futura;
 *  o trecho até a última parada já é, na prática, uma rota com várias
 *  pernas/viradas reais (o A* nunca traça reta). */
export function NavegarMapa({
  parceiros,
  caladoM,
  podePlanejarViagem,
  destinoInicial,
}: {
  parceiros: Parceiro[]
  caladoM: number | null
  podePlanejarViagem: boolean
  destinoInicial?: { la: number; lo: number; nome: string } | null
}) {
  const router = useRouter()

  // Onda 89 (achado 4.1) — os tokens de cor que as camadas do Mapbox
  // consomem, reagindo à troca de tema (ver lib/mapa/cores-tema.ts).
  const cores = useCoresMapa()

  // Onda 25 (bug de produção, iPhone tema escuro, 12/08) — véu escuro atrás
  // dos cartões flutuantes. Suspeito A: o body pinta --fundo (navy escuro)
  // por baixo do mapa; nesta tela específica isso deve ficar transparente
  // (ver regra completa em app/globals.css, "fundo-tela-mapa"). Toggle por
  // classe (não CSS Module/inline) porque o alvo é o <body>, fora da árvore
  // React deste componente — remove no unmount pra não vazar pras outras
  // telas do app, que continuam precisando do fundo normal.
  useEffect(() => {
    document.body.classList.add("fundo-tela-mapa")
    return () => document.body.classList.remove("fundo-tela-mapa")
  }, [])

  // --- trilha (preservado do que já existia na página, ver comentário acima) -
  const [estado, setEstado] = useState<"pronto" | "gravando" | "parado" | "salvando">("pronto")
  const [msg, setMsg] = useState<string | null>(null)
  const [obs, setObs] = useState("")
  // Consentimento de corredores (onda 17) — onda 80: parou de ser
  // DECIDIDO aqui (checkbox em cima do mapa) e virou preferência de
  // `/menu/ajustes` (ver o comentário grande sobre consentimento, mais
  // abaixo, e `lib/preferencias-navegacao.ts`). Esta tela só LÊ o valor já
  // salvo, uma vez no mount — mesmo padrão do rearme da âncora, abaixo —
  // pra usar no `salvarTrilha` quando a saída termina.
  const [contribuirCorredor, setContribuirCorredor] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- so existe localStorage no cliente, le uma vez apos montar
    setContribuirCorredor(lerConsentimentoCorredor())
  }, [])
  const [painel, setPainel] = useState({ velKt: 0, resumo: RESUMO_VAZIO, qtd: 0 })
  // nasce recolhido: o mapa é o protagonista da tela, não os cartões
  const [painelAberto, setPainelAberto] = useState(false)
  // Onda 80 (consolidação Trilha+Sondagem+Tempo num painel só) — qual aba
  // esta visível dentro do cartão expandido. Nao controla MONTAGEM (as tres
  // abas ficam sempre montadas, ver JSX mais abaixo e o comentario grande
  // sobre nunca desmontar a SondagemPainel): só CSS.
  const [abaAtiva, setAbaAtiva] = useState<"trilha" | "sondagem" | "tempo">("trilha")
  // Resumo que SondagemPainel devolve pro pai (coletando + guardadas) — so
  // pra pintar a pilula recolhida e o indicador da aba, ver SondagemPainel.
  const [resumoSondagem, setResumoSondagem] = useState({ coletando: false, guardadas: 0 })
  // Aviso "não é auxílio à navegação" (onda 80) — ver aviso-navegar.tsx.
  // Abre sozinho na primeira visita deste aparelho a /navegar; dali em
  // diante só reabre pelo botão "?" do cartão. `useEffect` (não useState
  // direto) porque só existe localStorage no cliente, depois do mount.
  const [avisoAberto, setAvisoAberto] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- le localStorage uma vez apos montar, decide se mostra o aviso de primeira visita
    if (!lerAvisoNavegarVisto()) setAvisoAberto(true)
  }, [])
  function fecharAvisoNavegar() {
    setAvisoAberto(false)
    marcarAvisoNavegarVisto()
  }
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
  // Onda 26 (modo navegando): precisão da leitura (coords.accuracy, metros)
  // — alimenta só o aviso honesto de "GPS impreciso agora" no painel de
  // navegação ativa (ver seção "modo navegando" mais abaixo). O alarme de
  // âncora já lê `p.coords.accuracy` direto no watcher pro filtro
  // anti-jitter; isto aqui é a MESMA leitura, só que também guardada em
  // estado pra tela renderizar.
  const [precisaoM, setPrecisaoM] = useState<number | null>(null)

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
        setPrecisaoM(p.coords.accuracy)
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

  // ONDA 90 (achado 4.5) — O MODO LIMPO ENTRA POR MOVIMENTO, NÃO POR DESTINO.
  //
  // Até aqui a tela só se limpava sozinha se houvesse um destino marcado
  // (`modoNavegando`, mais abaixo). Só que sair da marina SEM destino é o
  // caso mais comum que existe — dar uma volta, ir pescar, atravessar pra
  // ilha de sempre — e nele o barco podia estar a 18 nós com a tela ainda
  // cheia de cartão. Waze e Navionics reagem a MOVIMENTO; a condição hostil
  // (sol, balanço, mão molhada) é o barco em marcha, com ou sem rota.
  //
  // OS DOIS NÚMEROS, e por que estes:
  //
  // 4 kt — o limiar de "isto é marcha, não balanço". `emMovimento` (domínio)
  // usa 2 kt pra entrar no modo navegando, mas LÁ a pessoa já declarou
  // intenção marcando um destino; aqui o app está adivinhando sozinho, e
  // errar custa a tela sumindo na cara de quem não pediu nada. 2 kt é
  // alcançável por um barco fundeado garrando em corrente, por um veleiro
  // sendo rebocado na doca, e por um pico de ruído de SOG do GPS. 4 kt não
  // é: está acima do que qualquer coisa parada produz e abaixo de qualquer
  // velocidade de manobra real (um deslocamento em marcha lenta na área de
  // marina já fica em 5-6 kt).
  //
  // 30 s — o tempo SUSTENTADO acima do limiar. GPS parado oscila, e o que
  // ele produz é pico curto, não platô: um único tick ruim não pode limpar
  // a tela. Trinta segundos é mais longo que qualquer rajada de ruído
  // plausível (o watcher entrega um ponto a cada poucos segundos, então são
  // ~6 a 10 leituras seguidas concordando) e curto o bastante pra a tela já
  // estar limpa antes de o barco sair do canal da marina.
  //
  // A SAÍDA não espelha a entrada — mesma regra do `modoNavegando`: parar
  // (esperar numa poita, boiar pescando) não devolve os cartões sozinho. Só
  // o toque da pessoa devolve, e esse toque VENCE o automático até o barco
  // parar de novo (`saidaManualSoNavegacaoRef`). Os dois números são
  // constantes de módulo (`LIMIAR_SO_NAVEGACAO_KT`/`MS_MARCHA_SUSTENTADA`,
  // no topo do arquivo) — não dependem de prop nem de estado.

  // Instante em que a velocidade cruzou o limiar e não caiu mais desde
  // então; `null` = não está em marcha agora.
  const inicioDaMarchaRef = useRef<number | null>(null)
  // "Já estou em marcha sustentada" — lido pelo efeito de transição do modo
  // navegando (mais abaixo) pra não devolver os cartões a um barco que
  // continua a 18 nós só porque o destino foi cancelado.
  const marchaSustentadaRef = useRef(false)
  // O toque da pessoa manda: sair à mão trava a reentrada automática até o
  // barco parar. Mesmo papel do `saidaManualRef` do modo navegando.
  const saidaManualSoNavegacaoRef = useRef(false)

  useEffect(() => {
    if (sogKt == null || sogKt < LIMIAR_SO_NAVEGACAO_KT) {
      inicioDaMarchaRef.current = null
      marchaSustentadaRef.current = false
      // Parar zera a recusa: a próxima marcha é uma decisão nova, não a
      // mesma que a pessoa já recusou.
      saidaManualSoNavegacaoRef.current = false
      return
    }
    const agora = Date.now()
    inicioDaMarchaRef.current ??= agora
    if (agora - inicioDaMarchaRef.current < MS_MARCHA_SUSTENTADA) return
    marchaSustentadaRef.current = true
    if (saidaManualSoNavegacaoRef.current) return
     
    setModoSoNavegacao(true)
    // `posAtual` entra junto de propósito: se o GPS repetir a MESMA
    // velocidade em dois ticks, `sogKt` não muda de identidade e o efeito
    // não roda — e o relógio dos 30 s nunca seria conferido de novo.
  }, [sogKt, posAtual])

  // Toque na seta de recolher/expandir. Sair no meio da marcha é decisão da
  // pessoa e vence a entrada automática; entrar à mão não trava nada.
  function alternarSoNavegacao() {
    saidaManualSoNavegacaoRef.current = modoSoNavegacao
    setModoSoNavegacao(!modoSoNavegacao)
  }

  // --- mapa + parceiros ------------------------------------------------------
  const [mapaPronto, setMapaPronto] = useState<MapaMapbox | null>(null)
  // Painel "Camadas do mapa" (dentro do MapaNautico) controla balizamento e
  // profundidade sozinho — "parceiros" ele não desenha, então o estado sobe
  // até aqui via `aoMudarCamadas`. Nasce ligado (mesmo padrão de sempre) e só
  // muda quando o painel dispara a primeira leitura do localStorage no mount.
  const [mostrarParceiros, setMostrarParceiros] = useState(true)
  // "Sondagens da comunidade" (auditoria 360 de 20/08, recomendação nº 3) —
  // também desenhada por fora do MapaNautico, mas em módulo próprio
  // (components/mapa/camada-sondagens.ts, o hook entra mais abaixo). Nasce
  // DESLIGADA (ver CAMADAS_PADRAO); o valor real chega no mount pelo mesmo
  // `aoMudarCamadas`.
  const [mostrarSondagens, setMostrarSondagens] = useState(false)
  const marcadoresRef = useRef<MarcadorMapbox[]>([])
  const [parceiroAberto, setParceiroAberto] = useState<Parceiro | null>(null)
  // Destino traçado pelo card do parceiro, pelo modo "definir destino"
  // (toque no mapa) OU já trazido de uma viagem planejada (`destinoInicial`,
  // onda 26 — ver comentário grande acima do componente). A linha de rumo e
  // o painel de distância/ETA reagem a este mesmo estado.
  const [destino, setDestino] = useState<{ la: number; lo: number; nome: string } | null>(destinoInicial ?? null)
  const [modoDefinirDestino, setModoDefinirDestino] = useState(false)

  // Posição pro painel de Tempo (onda 20, TempoPainel): GPS (`posAtual`)
  // quando existe; senão o CENTRO DO MAPA — a tela nunca fica sem nenhum
  // tempo pra mostrar só por falta de sinal de GPS. `centroMapa` só atualiza
  // em "moveend" (fim do gesto de pan/zoom), não a cada frame do arraste —
  // a política de cache por célula do próprio painel já evita fetch
  // repetido, isto aqui é a primeira barreira, mais barata: nem chega a
  // AVALIAR célula nova a cada pixel de pan.
  const [centroMapa, setCentroMapa] = useState<Coord | null>(null)
  useEffect(() => {
    if (!mapaPronto) return
    const mapa = mapaPronto
    function atualizarCentro() {
      const c = mapa.getCenter()
      setCentroMapa({ la: c.lat, lo: c.lng })
    }
    atualizarCentro()
    mapa.on("moveend", atualizarCentro)
    return () => {
      mapa.off("moveend", atualizarCentro)
    }
  }, [mapaPronto])
  const posParaTempo = posAtual ?? centroMapa

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
            linhaSuave: e.data.linhaSuave,
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
        const el = criarElementoMarcadorParceiro(p)
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

  /** Trocar de estilo (Náutico ⇄ Satélite ⇄ Relevo 3D) faz `setStyle()`, e o
   *  Mapbox DESTRÓI toda camada/source customizada nessa troca. O MapaNautico
   *  reconstrói as dele (batimetria, OpenSeaMap) no "style.load", mas as
   *  DESTA tela (rumo, rota, âncora) morriam junto e não voltavam: a rota
   *  simplesmente sumia no satélite — bug visto em produção, 13/08/2026.
   *  Este contador sobe a cada "style.load" e entra nas dependências dos
   *  efeitos de criação e de desenho abaixo, que então refazem tudo. */
  const [versaoEstilo, setVersaoEstilo] = useState(0)
  useEffect(() => {
    if (!mapaPronto) return
    const aoTrocarEstilo = () => setVersaoEstilo((v) => v + 1)
    mapaPronto.on("style.load", aoTrocarEstilo)
    return () => {
      mapaPronto.off("style.load", aoTrocarEstilo)
    }
  }, [mapaPronto])

  // Fontes/camadas do mapa (linha de rumo + círculo do alarme) — criadas uma
  // vez quando o mapa fica pronto; atualizadas via setData nos efeitos abaixo.
  //
  // Onda 89 (achado 4.1) — `cores` entra nas dependências e a repintura vem
  // no fim do efeito: a criação é idempotente (guardada por `getSource`),
  // então numa troca de tema o efeito atravessa os guardiões sem fazer nada
  // e só repinta o que já existe. É isso que faz o canvas acompanhar o
  // alternador claro/escuro, que o DOM acompanha de graça.
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
        paint: { "line-color": cores.acao, "line-width": 1.5, "line-dasharray": [2, 2], "line-opacity": 0.55 },
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
        paint: { "line-color": cores.meter, "line-width": 6.5, "line-opacity": 0.55 },
      })
      mapaPronto.addLayer({
        id: "rota-linha",
        type: "line",
        source: "rota",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": cores.acao, "line-width": 3 },
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
          "circle-color": cores.acao,
          "circle-stroke-width": 1.5,
          "circle-stroke-color": cores.acaoTexto,
        },
      })
    }
    if (!mapaPronto.getSource("ancora-circulo")) {
      mapaPronto.addSource("ancora-circulo", { type: "geojson", data: colecaoVazia() })
      mapaPronto.addLayer({
        id: "ancora-circulo-preenchimento",
        type: "fill",
        source: "ancora-circulo",
        paint: { "fill-color": cores.crit, "fill-opacity": 0.12 },
      })
      mapaPronto.addLayer({
        id: "ancora-circulo-contorno",
        type: "line",
        source: "ancora-circulo",
        paint: { "line-color": cores.crit, "line-width": 2 },
      })
    }

    // Repintura — ver o comentário no topo deste efeito.
    // A propriedade é uma união literal (e não `string`) porque é assim que
    // o `setPaintProperty` do mapbox-gl é tipado — escrever `string` aqui
    // desligaria a checagem que garante que "line-color" não virou
    // "linecolor" num dedo torto.
    type PropriedadeDeCor = "line-color" | "circle-color" | "circle-stroke-color" | "fill-color"
    const pintar = (camada: string, propriedade: PropriedadeDeCor, valor: string) => {
      if (mapaPronto.getLayer(camada)) mapaPronto.setPaintProperty(camada, propriedade, valor)
    }
    pintar("rumo-linha", "line-color", cores.acao)
    pintar("rota-linha-casing", "line-color", cores.meter)
    pintar("rota-linha", "line-color", cores.acao)
    pintar("rota-pontos-circulos", "circle-color", cores.acao)
    pintar("rota-pontos-circulos", "circle-stroke-color", cores.acaoTexto)
    pintar("ancora-circulo-preenchimento", "fill-color", cores.crit)
    pintar("ancora-circulo-contorno", "line-color", cores.crit)
  }, [mapaPronto, versaoEstilo, cores])

  // Sondagens da comunidade — todo o desenho/consulta mora em
  // components/mapa/camada-sondagens.ts (este arquivo já passa de 135 KB; a
  // auditoria de 20/08 manda extrair módulo, não engordar). Chamado DEPOIS do
  // efeito de criação acima de propósito: assim a camada entra na pilha com
  // "rumo-linha"/rota já existentes e fica por baixo delas.
  useCamadaSondagens(mapaPronto, versaoEstilo, mostrarSondagens, cores)

  // Linha de rumo posição→destino, redesenhada a cada nova posição.
  useEffect(() => {
    if (!mapaPronto) return
    const source = mapaPronto.getSource("rumo") as GeoJSONSource | undefined
    if (!source) return
    // Some quando existe rota pela água desenhada: a linha reta atravessa
    // terra (foi ela que o dono viu cortando o continente entre Búzios e
    // Maricá, 13/08/2026) e num app náutico isso confunde mais do que
    // informa — o rumo direto continua nos NÚMEROS do painel, que é onde
    // ele é útil. Sem rota (fora da área, sem caminho), a linha volta: aí
    // ela é a única orientação que existe, e a tela já diz que é rumo
    // direto, não rota.
    const temRotaDesenhada = estadoRotaAtual.tipo === "rota"
    source.setData(
      posAtual && destino && !temRotaDesenhada
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
  }, [mapaPronto, posAtual, destino, estadoRotaAtual, versaoEstilo])

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

    const { pernas, linhaSuave } = estadoRotaAtual
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
    //
    // Onda 27 — `linhaSuave` (nao `suavizarChaikin(pernas)` local) vem PRONTA
    // do worker, ja verificada contra a agua: suavizar aqui, sem a grade,
    // podia desenhar um atalho por cima de terra numa curva fechada perto da
    // costa mesmo com `pernas` inteiramente na agua (caso real de producao,
    // 13/08/2026) — ver rota.worker.ts § calcularLinhaSuave.
    const coordenadasSuaves: [number, number][] = linhaSuave.map((p) => [p.lo, p.la])
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
  }, [mapaPronto, estadoRotaAtual, versaoEstilo])

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

  // ---------------------------------------------------------------------------
  // Modo navegando (onda 26) — a câmera passa a perseguir a embarcação (proa
  // pra cima, zoom que respira com a velocidade) e o mapa vira um painel de
  // bordo com próxima virada/distância restante/ETA — o "carro no Waze"
  // pedido pelo dono. Matemática pura em web/lib/domain/modo-navegando.ts
  // (limiares de entrada/chegada, zoom por velocidade, amortecimento de
  // rumo, projeção da posição na rota); aqui só a COLA — quando entra/sai,
  // como move a câmera de verdade.
  // ---------------------------------------------------------------------------

  // Estado "bruto" do toggle — a saída por destino cancelado (task 1) é
  // DERIVADA a partir dele + `destino`, não outro setState num efeito (ver
  // `modoNavegando` logo abaixo): sem destino, não existe modo navegando,
  // ponto, no MESMO render em que o destino sumiu, sem esperar um efeito.
  const [modoNavegandoBruto, setModoNavegandoBruto] = useState(false)
  const modoNavegando = modoNavegandoBruto && destino != null
  // Pausa a perseguição quando o usuário mexe no mapa por conta própria
  // (arrastar/zoom/girar/inclinar) — padrão de todo app de navegação: o
  // toque do usuário sempre vence a câmera automática, e o botão "Voltar ao
  // barco" (ver JSX) retoma.
  const [perseguicaoPausada, setPerseguicaoPausada] = useState(false)

  // Progresso na rota atual — pela água quando existe (`estadoRotaAtual`,
  // já calculada pelo Worker acima), senão o fallback de rumo direto
  // `[posAtual, destino]` (uma perna só). `progressoNaRota` trata os dois
  // casos igual (ver comentário no domínio) — alimenta o painel de
  // navegação ativa E a checagem de chegada (saída automática, abaixo).
  const progressoRotaAtual = useMemo(() => {
    if (!posAtual || !destino) return null
    const pernasRota = estadoRotaAtual.tipo === "rota" ? estadoRotaAtual.pernas : [posAtual, destino]
    return progressoNaRota(pernasRota, posAtual)
  }, [posAtual, destino, estadoRotaAtual])

  const etaNavegandoMin = useMemo(() => {
    if (!progressoRotaAtual || sogKt == null) return null
    return etaMinutos(progressoRotaAtual.distanciaRestanteNm, sogKt)
  }, [progressoRotaAtual, sogKt])

  // ONDA 90 (achado 4.4) — A DISTÂNCIA TOTAL DA TRAVESSIA, CONGELADA NA
  // ENTRADA.
  //
  // O `ProgressoRota` precisa de um TOTAL pra ter denominador, e não dá pra
  // usar `estadoRotaAtual.distanciaNm`: o A* recalcula a rota A PARTIR DA
  // POSIÇÃO ATUAL a cada 200 m andados, então esse número é a distância que
  // FALTA, não a da travessia — dividir um pelo outro daria 0% pra sempre.
  //
  // O denominador honesto é "o quanto faltava quando esta navegação
  // começou". Ele é lido uma vez, na entrada do modo, e zera quando o modo
  // sai ou quando o destino muda (destino novo é travessia nova). Se a rota
  // crescer no meio do caminho — desvio, recálculo por calado — a barra
  // trava em 100% em vez de estourar o trilho (`percentualPreso`, no
  // componente).
  const [totalTravessiaNm, setTotalTravessiaNm] = useState<number | null>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- zera na transicao de modo/destino; o valor congelado nao e derivavel do render
    setTotalTravessiaNm(null)
  }, [modoNavegando, destino])
  useEffect(() => {
    if (!modoNavegando || totalTravessiaNm != null || !progressoRotaAtual) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- congela a primeira leitura valida de GPS apos entrar no modo
    setTotalTravessiaNm(progressoRotaAtual.distanciaRestanteNm)
  }, [modoNavegando, totalTravessiaNm, progressoRotaAtual])

  /** Percentual já percorrido da travessia. `null` enquanto o total ainda
   *  não foi congelado (uma renderização, no máximo) — e `null` NÃO vira
   *  zero desenhado: o painel simplesmente não mostra a barra ainda, em vez
   *  de afirmar "0% percorrido" sobre um dado que não existe. */
  const percentualTravessia = useMemo(() => {
    if (totalTravessiaNm == null || totalTravessiaNm <= 0 || !progressoRotaAtual) return null
    return ((totalTravessiaNm - progressoRotaAtual.distanciaRestanteNm) / totalTravessiaNm) * 100
  }, [totalTravessiaNm, progressoRotaAtual])

  // O listener de gesto do usuário (registrado uma vez por instância do
  // mapa, deps `[mapaPronto]`, ver efeito mais abaixo) precisa ver o valor
  // MAIS RECENTE de `modoNavegando` sem recriar o listener a cada
  // entrada/saída do modo — mesmo padrão de `ancoraRef`/`camadasRef` já
  // usado no resto do arquivo pra esse exato problema (closure presa numa
  // dependência estável).
  const modoNavegandoRef = useRef(modoNavegando)
  useEffect(() => {
    modoNavegandoRef.current = modoNavegando
  }, [modoNavegando])

  // "Saída manual" — quando o usuário toca em sair do modo navegando, ele
  // NÃO pode reentrar sozinho no próximo tick do GPS só porque destino e
  // velocidade continuam batendo a condição de entrada (senão o botão de
  // sair não sairia de verdade — "o usuário manda, sempre"). Zera quando o
  // destino muda ou é cancelado: aí é uma decisão nova, não a mesma que o
  // usuário recusou.
  const saidaManualRef = useRef(false)
  useEffect(() => {
    saidaManualRef.current = false
  }, [destino])

  // Entrada automática: há destino E a embarcação está em movimento de
  // verdade (`emMovimento` — limiar em nós, atracado balançando não
  // ativa). A SAÍDA não espelha isto (ver `emMovimento` no domínio): uma
  // vez dentro, parar de andar (farol vermelho, espera numa poita) não
  // expulsa ninguém — só chegada, toque manual ou destino cancelado saem
  // (o cancelamento é derivado, ver `modoNavegando` acima — não precisa de
  // efeito próprio). Depende de condições externas (velocidade do GPS) e
  // decide uma transição de estado com histórico (`saidaManualRef`) — não
  // dá pra virar valor derivado puro, é sync de verdade com o mundo real.
  useEffect(() => {
    if (modoNavegando || saidaManualRef.current) return
    if (!destino || !emMovimento(sogKt)) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- transicao stateful disparada por leitura de GPS, nao ha valor pra derivar
    setModoNavegandoBruto(true)
  }, [modoNavegando, destino, sogKt])

  // Saída automática por chegada — raio definido em RAIO_CHEGADA_DESTINO_M
  // (lib/domain/modo-navegando.ts). Chegar não é "saída manual": se a
  // pessoa marcar um destino novo no mesmo lugar (ex.: reabasteceu e vai de
  // novo), o modo pode entrar sozinho outra vez. Mesmo motivo do efeito
  // acima pro disable: transição stateful por leitura de GPS.
  useEffect(() => {
    if (!modoNavegando || !progressoRotaAtual) return
    if (chegouAoDestino(progressoRotaAtual.distanciaRestanteNm)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- transicao stateful disparada por leitura de GPS (chegada), nao ha valor pra derivar
      setModoNavegandoBruto(false)
      saidaManualRef.current = false
    }
  }, [modoNavegando, progressoRotaAtual])

  // Entrar no modo navegando (automático ou pelo botão) recolhe os cartões
  // flutuantes igual ao modo "só navegação" da onda 23 — "a tela mostra o
  // essencial em tamanho de ponte" é literalmente essa tela, e o painel
  // novo (ver JSX) substitui o cartão de rota que se recolhe junto. Sair
  // devolve os cartões. Acoplamento de um sentido só: a pessoa ainda pode
  // reabrir os cartões manualmente enquanto navega (o botão de baixo
  // continua obedecendo o toque dela) — só a TRANSIÇÃO do modo navegando
  // decide o estado inicial de "só navegação", nunca briga com um toque
  // manual depois; por isso não dá pra virar `modoSoNavegacao` derivado
  // (ele PRECISA continuar divergindo livremente depois do toque).
  //
  // Onda 90 (achado 4.5) — a SAÍDA deste modo deixou de forçar `false`: se o
  // destino for cancelado com o barco ainda a 18 nós, devolver os cartões
  // seria desfazer, por um segundo, exatamente o que a entrada por movimento
  // acabou de decidir (e o efeito de marcha os recolheria de novo no tick
  // seguinte, piscando). Quem manda no estado de saída é a marcha.
  useEffect(() => {
     
    setModoSoNavegacao(
      modoNavegando || (marchaSustentadaRef.current && !saidaManualSoNavegacaoRef.current),
    )
  }, [modoNavegando])

  // Entrar sempre retoma a perseguição — nunca nasce já pausado, mesmo
  // depois de uma saída pausada anterior. Mesmo motivo do efeito acima:
  // `perseguicaoPausada` precisa continuar divergindo livre depois (o
  // gesto do usuário liga; só a ENTRADA no modo desliga), não é derivável.
  useEffect(() => {
    if (modoNavegando) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reseta um estado INDEPENDENTE na transicao; precisa continuar divergindo livre depois (nao e derivavel)
      setPerseguicaoPausada(false)
    }
  }, [modoNavegando])

  // Botão explícito de entrar/sair (onda 26, "o usuário manda, sempre") —
  // só aparece com destino definido (ver JSX): navegar sem destino não tem
  // pra onde apontar a câmera nem o que mostrar no painel. Com destino,
  // funciona a qualquer momento, movimento ou não.
  function alternarModoNavegando() {
    if (modoNavegando) {
      saidaManualRef.current = true
      setModoNavegandoBruto(false)
    } else {
      saidaManualRef.current = false
      setModoNavegandoBruto(true)
    }
  }

  // Gesto do usuário no mapa (arrastar/zoom/girar/inclinar) pausa a
  // perseguição — igual a qualquer app de navegação sério.
  // `e.originalEvent` só existe em interações de VERDADE (mouse/toque/roda
  // do usuário); os nossos próprios `map.easeTo` programáticos (ver efeito
  // de câmera abaixo) NÃO o têm — é a forma padrão do Mapbox GL de
  // distinguir as duas coisas, sem precisar de uma flag "sou eu mexendo"
  // manual e frágil.
  useEffect(() => {
    if (!mapaPronto) return
    // Um handler por evento (não um só compartilhado): os TIPOS do Mapbox GL
    // JS pra "zoomstart"/"pitchstart" declaram `void` como possibilidade
    // (podem disparar sem objeto de evento — ex.: `easeTo` interno sem
    // gesto associado), o que colapsa `originalEvent` pra fora do tipo
    // inferido; "dragstart"/"rotatestart" não têm esse colapso. Em
    // RUNTIME o Mapbox sempre manda `originalEvent` quando é gesto de
    // verdade, nos quatro eventos — daí o cast pontual só onde o tipo não
    // acompanha. `marcarGestoSeReal` concentra a lógica; cada wrapper só
    // extrai o `originalEvent` da forma que seu evento permite.
    function marcarGestoSeReal(ehGestoReal: boolean) {
      if (!ehGestoReal || !modoNavegandoRef.current) return
      setPerseguicaoPausada(true)
    }
    const aoArrastar = (e: MapEventOf<"dragstart">) => marcarGestoSeReal(!!e.originalEvent)
    const aoZoom = (e: MapEventOf<"zoomstart">) =>
      marcarGestoSeReal(!!(e as unknown as { originalEvent?: unknown }).originalEvent)
    const aoRotacionar = (e: MapEventOf<"rotatestart">) => marcarGestoSeReal(!!e.originalEvent)
    const aoInclinar = (e: MapEventOf<"pitchstart">) =>
      marcarGestoSeReal(!!(e as unknown as { originalEvent?: unknown }).originalEvent)
    mapaPronto.on("dragstart", aoArrastar)
    mapaPronto.on("zoomstart", aoZoom)
    mapaPronto.on("rotatestart", aoRotacionar)
    mapaPronto.on("pitchstart", aoInclinar)
    return () => {
      mapaPronto.off("dragstart", aoArrastar)
      mapaPronto.off("zoomstart", aoZoom)
      mapaPronto.off("rotatestart", aoRotacionar)
      mapaPronto.off("pitchstart", aoInclinar)
    }
  }, [mapaPronto])

  // `prefers-reduced-motion`: por padrão só cobre CSS (ver "fundo-tela-mapa"
  // e as `transition-duration` deste arquivo, zeradas globalmente em
  // app/globals.css); a câmera do Mapbox é animação de JS
  // (`map.easeTo({ duration })`), então precisa ser checada aqui também.
  // `matchMedia` com listener (não só o valor no mount) — o SO pode mudar a
  // preferência com a tela já aberta.
  const reduzMovimentoRef = useRef(false)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    reduzMovimentoRef.current = mq.matches
    function aoMudarPreferencia(e: MediaQueryListEvent) {
      reduzMovimentoRef.current = e.matches
    }
    mq.addEventListener("change", aoMudarPreferencia)
    return () => mq.removeEventListener("change", aoMudarPreferencia)
  }, [])

  // Bateria (onda 26): com a aba/app em segundo plano o mapa não é visto
  // por ninguém — anima-lo só gasta GPU e bateria à toa. O watcher de GPS
  // continua rodando (o navegador já lida com o throttle dele sozinho); só
  // a ANIMAÇÃO DA CÂMERA para. Ao voltar pro primeiro plano, a visão retoma
  // no próximo tick do GPS (poucos segundos) — ver docs/OPERACAO.md.
  const abaVisivelRef = useRef(true)
  useEffect(() => {
    function aoMudarVisibilidade() {
      abaVisivelRef.current = document.visibilityState === "visible"
    }
    document.addEventListener("visibilitychange", aoMudarVisibilidade)
    return () => document.removeEventListener("visibilitychange", aoMudarVisibilidade)
  }, [])

  // A câmera perseguidora — o coração do modo navegando. `easeTo` com
  // `bearing` = rumo suavizado (proa pra cima), `padding.top` desloca o
  // CENTRO VISUAL pra baixo (a embarcação fica no terço inferior da tela —
  // é `padding`, não `center`, que muda: o Mapbox centraliza `center`
  // dentro da área que SOBRA depois do padding; reservar espaço no TOPO
  // empurra essa área — e o ponto centralizado nela — pra baixo na tela;
  // testado visualmente com `FRACAO_PADDING_TOPO` = 55% do container, que
  // deixa a embarcação por volta de 77% da altura da tela) e zoom que
  // respira com a velocidade (`zoomPorVelocidade`). Roda a cada tick do GPS
  // (posAtual muda) ou do rumo (headingGraus muda) — a suavização do rumo
  // em si (`amortecerRumo`, wrap 359°→0° tratado no domínio) acontece aqui
  // dentro, guardada em `rumoSuavizadoRef` entre chamadas.
  const rumoSuavizadoRef = useRef<number | null>(null)
  useEffect(() => {
    if (!modoNavegando || !mapaPronto || !posAtual) return
    if (perseguicaoPausada) return
    if (!abaVisivelRef.current) return

    // sem rumo novo (parado, ou o navegador não expõe o dado): mantém o
    // último valor suavizado — nunca gira a câmera pra uma direção
    // inventada (mesma honestidade do marcador do próprio barco, ver
    // `atualizarRumoBarco` no topo do arquivo).
    if (headingGraus != null) {
      rumoSuavizadoRef.current =
        rumoSuavizadoRef.current == null
          ? headingGraus
          : amortecerRumo(rumoSuavizadoRef.current, headingGraus, FATOR_AMORTECIMENTO_RUMO)
    }

    const alturaMapa = mapaPronto.getContainer().clientHeight
    mapaPronto.easeTo({
      center: [posAtual.lo, posAtual.la],
      zoom: zoomPorVelocidade(sogKt),
      bearing: rumoSuavizadoRef.current ?? 0,
      pitch: PITCH_NAVEGANDO,
      padding: { top: alturaMapa * FRACAO_PADDING_TOPO, bottom: 0, left: 0, right: 0 },
      duration: reduzMovimentoRef.current ? 0 : DURACAO_EASETO_MS,
      essential: true,
    })
  }, [modoNavegando, mapaPronto, posAtual, headingGraus, sogKt, perseguicaoPausada])

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
  }, [mapaPronto, ancora, versaoEstilo])

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

  // Onda 80 — honestidade dos mostradores da aba Trilha: `resumoTrilha`
  // devolve zero pra QUALQUER lista com menos de 2 pontos (0 pontos = nunca
  // começou; 1 ponto = começou mas ainda não dá pra medir nada), então o
  // número sozinho não distingue "de verdade zero" de "não sei ainda" — o
  // mesmo problema que web/lib/domain/patio.ts resolve devolvendo `null` em
  // vez de zero. `painel.qtd` (contagem real de pontos gravados) é quem
  // desfaz a ambiguidade aqui: Distância/Tempo são honestos com 1 ponto (a
  // trilha começou, zero decorrido é verdade); Velocidade/Máxima precisam
  // de 2 pontos pra existir ANY leitura de velocidade.
  const trilhaTemPontos = painel.qtd >= 1
  const trilhaTemVelocidade = painel.qtd >= 2

  return (
    // Tela cheia: escapa do px-4/pt-5/pb-24 do layout com margens negativas;
    // a altura desconta a bottom nav fixa (~4rem). O mapa é a tela; todo o
    // resto flutua por cima.
    <main className="relative -mx-4 -mt-5 -mb-24 h-dvh">
      <h1 className="sr-only">Navegar</h1>
      <MapaNautico
        aoIniciar={setMapaPronto}
        aoMudarCamadas={(c: EstadoCamadas) => {
          setMostrarParceiros(c.parceiros)
          setMostrarSondagens(c.sondagens)
        }}
        className="h-full w-full"
      />

      {/* Painel único de instrumentos (onda 80) — TRILHA + SONDAGEM + TEMPO,
          que até aqui eram três cartões EMPILHADOS cobrindo o terço
          superior do mapa (o "muita letra e informação em cima do mapa"
          que o dono apontou contra a referência Haulix), viraram UM cartão
          com abas internas. Como agrupar era decisão livre da task — abas
          (não seções recolhíveis empilhadas) porque é o que a própria
          referência usa (Overview/Cargo/Trips…) e porque three accordions
          abertos ao mesmo tempo é exatamente a poluição que está sendo
          corrigida aqui.
          right-14 deixa livres os controles do mapa (zoom/bússola/locate). */}
      <div className="absolute left-3 right-14 top-3 z-20 flex flex-col gap-2">
        {/* Alarme de âncora: segurança > estética — aparece em QUALQUER modo,
            inclusive "só navegação" (onda 23). Por isso fica FORA do
            wrapper colapsável logo abaixo, não dentro dele. */}
        {garrando && (
          <div role="alert" className="sombra-2 animate-pulse rounded-[var(--raio-cartao)] border border-crit bg-crit px-4 py-3 text-center text-sm font-bold text-white">
            GARRANDO — verifique o fundeio
          </div>
        )}

        {/* Recolhe no modo "só navegação" (onda 23). CSS (max-h/opacidade),
            nunca unmount — a aba Sondagem pode ter uma conexão NMEA ativa
            em segundo plano (fila persistente, onda 14); desmontar
            derrubaria essa conexão só porque a pessoa escondeu o cartão.
            `aria-hidden` tira do assistivo quando recolhido;
            `classeColapsavel` já cuida do pointer-events. */}
        <div aria-hidden={modoSoNavegacao} className={classeColapsavel("cima")}>
        {/* Onda 24 (passe de arte, bloco 2) — identidade de "instrumento de
            ponte": navy translúcido fixo (--mapa-instrumento, não segue o
            tema claro/escuro do app — ver comentário em globals.css),
            recolhido vira pílula fina, expandido vira instrumento. Texto
            interno usa meter-texto/meter-dim (não texto/dim, que seguem o
            TEMA e leriam mal aqui).
            Onda 25 — SEM `backdrop-blur` de propósito (bug real, não
            esquecimento): todos os flutuantes desta tela trocaram blur por
            fundo mais opaco (ver o "porquê" completo no comentário de
            --mapa-instrumento em globals.css — resumo: Safari iOS pinta um
            retângulo escuro sólido quando backdrop-filter fica sobre o
            canvas WebGL do Mapbox).
            Onda 80 — `sm:max-w-[380px]`: os cartões antigos esticavam a
            largura inteira da coluna (bom no celular, onde a coluna já é
            estreita); um painel único com medidor+abas ficaria um retângulo
            esparramado num monitor de 1440. A referência usa um cartão de
            largura fixa flutuando sobre o mapa em QUALQUER tela — é isso
            que este teto imita. `w-full` mantém o celular idêntico a antes
            (a coluna já mede menos que 380px lá). */}
        <div className="sombra-2 w-full overflow-hidden rounded-[var(--raio-cartao)] border border-mapa-instrumento-borda bg-mapa-instrumento text-meter-texto sm:max-w-[380px]">
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => setPainelAberto((v) => !v)}
              aria-expanded={painelAberto}
              className="flex min-w-0 flex-1 items-center justify-between gap-2 px-4 py-3"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className={`size-2 shrink-0 rounded-[var(--raio-pilula)] ${
                    estado === "gravando" || resumoSondagem.coletando ? "animate-pulse bg-crit" : "bg-meter-dim"
                  }`}
                />
                {/* Onda 80 — sem uppercase forçado (era `.rotulo`
                    improvisado com tracking): `titulo-card` sozinho já é
                    caixa de frase, a mesma troca que os mostradores abaixo
                    fizeram pra `.rotulo-dado`. */}
                <span className="titulo-card truncate !text-meter-texto">
                  {estado === "gravando"
                    ? "Gravando trilha"
                    : estado === "parado"
                      ? "Trilha pronta pra salvar"
                      : estado === "salvando"
                        ? "Salvando…"
                        : resumoSondagem.coletando
                          ? "Sondando"
                          : "Instrumentos"}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {/* SOG sempre visível quando há posição — pílula mono tabular no
                    padrão visual do horímetro (rounded + bg-meter). Vem do
                    coords.speed do GPS (sogKt), não do cálculo de trilha
                    (painel.velKt, que é a velocidade média entre pontos
                    gravados e continua só existindo durante a gravação). */}
                {sogKt != null && (
                  <span className="rounded-[var(--raio-pilula)] border border-mapa-instrumento-borda bg-meter px-2.5 py-1 tabular-nums text-xs tabular-nums text-accent">
                    {sogKt.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kt
                  </span>
                )}
                <Icone
                  nome="chevron"
                  className={`size-4 text-meter-dim transition-transform ${painelAberto ? "-rotate-90" : "rotate-90"}`}
                />
              </span>
            </button>
            {/* Onda 80 — "?" reabre o aviso "não é auxílio à navegação" a
                qualquer momento (ver aviso-navegar.tsx: o texto saiu de
                dentro do painel, onde reaparecia toda sessão, e passou a
                viver aqui + no cartão de primeira visita). Fora do botão de
                recolher/expandir de propósito — botão dentro de botão não é
                válido, e um toque não pode disparar os dois gestos juntos. */}
            <button
              type="button"
              onClick={() => setAvisoAberto(true)}
              aria-label="Sobre o Commander no mar"
              className="flex size-11 shrink-0 items-center justify-center text-meter-dim"
            >
              <span
                aria-hidden="true"
                className="flex size-5 items-center justify-center rounded-[var(--raio-pilula)] border border-mapa-instrumento-borda text-xs font-bold"
              >
                ?
              </span>
            </button>
          </div>

          {painelAberto && (
            // Onda 80 — teto de METADE da altura do mapa (a mesma conta de
            // `h-[calc(100dvh-4rem)]` do <main>, ver acima), com rolagem
            // própria: antes, expandido, os três cartões juntos cobriam o
            // mapa INTEIRO. Agora o corpo (medidor + abas + conteúdo) nunca
            // passa de metade — o mapa continua visível atrás mesmo com o
            // painel aberto.
            <div className="max-h-[50dvh] overflow-y-auto border-t border-mapa-instrumento-borda px-4 pb-4 pt-3">
              {/* Instrumento §2 item 1 da spec Haulix — o medidor de arco no
                  lugar de texto solto pra SOG, o dado mais lido desta tela.
                  Vive numa caixinha que SEGUE O TEMA (bg-panel), não no navy
                  fixo do resto do cartão: o Medidor pinta ponteiro/escala em
                  var(--texto)/var(--linha) (components/ui/medidor.tsx), e no
                  tema claro `--texto` é o MESMO valor de navy fixo usado em
                  --mapa-instrumento (ver app/globals.css). Sobre o navy fixo
                  direto, o ponteiro simplesmente desapareceria; aninhado num
                  cartão que segue o tema, o contraste sempre bate (claro:
                  texto escuro sobre cartão branco; escuro: texto claro sobre
                  cartão escuro).
                  max=40 nós — teto generoso de lancha/iate a planar; zonas
                  default do componente (metade/três-quartos/resto). */}
              <div className="rounded-[var(--raio-cartao)] border border-line bg-panel px-2 pb-1 pt-2">
                <p className="rotulo-dado text-center text-dim">Velocidade</p>
                {/* ONDA 89 (achado 4.3) — A ESCALA DO MEDIDOR SAI DE 9,5px.
                    O `viewBox` do Medidor é 200×160 e os números da escala
                    são desenhados em 9,5 unidades. Com a caixa travada em
                    200px o fator de escala era 1,0 — ou seja, 9,5px de
                    verdade na tela, contra o piso de 11px que o
                    app/globals.css declara ("nada abaixo de 11px"). Ilegível
                    sob sol, que é a única condição em que esta tela é usada.
                    240px dá fator 1,2 e leva a escala pra 11,4px sem tocar
                    no componente (o teto interno dele é 260px, e o cartão
                    flutuante tem 380px de largura no desktop — sobra). */}
                <Medidor valor={sogKt} max={40} unidade="kt" rotulo="Velocidade" className="max-w-[240px]" />
              </div>

              {/* Abas — o que eram três cartões empilhados. As TRÊS ficam
                  SEMPRE montadas logo abaixo (nunca `{aba === x && <Y/>}`) —
                  só a visibilidade muda por CSS, mesmo motivo do wrapper
                  colapsável do modo "só navegação": a aba Sondagem pode ter
                  uma conexão NMEA em segundo plano que desmontar derrubaria. */}
              <div
                role="tablist"
                aria-label="Instrumentos"
                className="mt-3 grid grid-cols-3 gap-1 rounded-[var(--raio-cartao)] border border-mapa-instrumento-borda bg-black/15 p-1"
              >
                {(
                  [
                    ["trilha", "Trilha"],
                    ["sondagem", resumoSondagem.guardadas > 0 ? `Sondagem (${resumoSondagem.guardadas})` : "Sondagem"],
                    ["tempo", "Tempo"],
                  ] as const
                ).map(([valor, rotulo]) => (
                  <button
                    key={valor}
                    type="button"
                    role="tab"
                    aria-selected={abaAtiva === valor}
                    onClick={() => setAbaAtiva(valor)}
                    className={`flex min-h-9 items-center justify-center rounded-[var(--raio-controle)] px-1 text-xs font-semibold ${
                      abaAtiva === valor ? "bg-accent text-acao-texto" : "text-meter-dim"
                    }`}
                  >
                    {rotulo}
                  </button>
                ))}
              </div>

              {/* Trilha — mesmo conteúdo de sempre, com dois cortes: saiu o
                  parágrafo "mantenha o app aberto / não é auxílio à
                  navegação" (virou aviso-navegar.tsx, lido uma vez, não
                  toda sessão) e saiu o consentimento de corredores (virou
                  preferência deliberada de /menu/ajustes — consentimento
                  não é coisa pra tocar com o barco andando; ver
                  lib/preferencias-navegacao.ts e o mesmo raciocínio
                  aplicado ao consentimento de sondagem em
                  sondagem-painel.tsx). Honestidade dos mostradores (regra
                  nova desta onda, mesmo espírito de web/lib/domain/patio.ts):
                  `trilhaTemPontos`/`trilhaTemVelocidade` fazem "—" aparecer
                  em vez de "0" enquanto não há leitura de verdade pra
                  sustentar o número — ver as duas constantes acima do
                  `return`. */}
              <div className={abaAtiva === "trilha" ? "mt-3" : "hidden"}>
                {msg && <p className="rounded-[var(--raio-controle)] border border-warn/40 bg-warn/10 px-3 py-2 text-sm">{msg}</p>}
                {estado === "parado" && (
                  <p className={`rounded-[var(--raio-controle)] border border-mapa-instrumento-borda bg-black/15 px-3 py-2 text-sm text-meter-dim ${msg ? "mt-2" : ""}`}>
                    GPS parado — a trilha está pronta para salvar.
                  </p>
                )}

                <div className={`grid grid-cols-2 gap-2 ${msg || estado === "parado" ? "mt-3" : ""}`}>
                  <Mostrador
                    variante="cartao"
                    rotulo="Velocidade"
                    valor={trilhaTemVelocidade ? painel.velKt.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "—"}
                    unidade={trilhaTemVelocidade ? "kt" : undefined}
                  />
                  <Mostrador
                    variante="cartao"
                    rotulo="Distância"
                    valor={trilhaTemPontos ? painel.resumo.distanciaNm.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "—"}
                    unidade={trilhaTemPontos ? "nm" : undefined}
                  />
                  <Mostrador
                    variante="cartao"
                    rotulo="Tempo"
                    valor={trilhaTemPontos ? (painel.resumo.duracaoH * 60).toLocaleString("pt-BR", { maximumFractionDigits: 0 }) : "—"}
                    unidade={trilhaTemPontos ? "min" : undefined}
                  />
                  <Mostrador
                    variante="cartao"
                    rotulo="Máxima"
                    valor={trilhaTemVelocidade ? painel.resumo.velMaxKt.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "—"}
                    unidade={trilhaTemVelocidade ? "kt" : undefined}
                  />
                </div>

                {estado === "pronto" && (
                  <button onClick={iniciar} className="mt-3 w-full rounded-[var(--raio-controle)] bg-accent py-3.5 text-base font-semibold text-acao-texto">
                    Iniciar gravação
                  </button>
                )}
                {estado !== "pronto" && (
                  <>
                    <div className="mt-3">
                      <label htmlFor="obs" className="mb-1.5 block rotulo-dado !text-meter-dim">
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
                        className="w-full rounded-[var(--raio-controle)] border border-line bg-campo px-3 py-3 text-base text-texto"
                      />
                    </div>
                    <button
                      onClick={encerrarESalvar}
                      disabled={estado === "salvando"}
                      className="mt-3 w-full rounded-[var(--raio-controle)] bg-crit py-3.5 text-base font-semibold text-white disabled:opacity-60"
                    >
                      {estado === "salvando" ? "Salvando…" : estado === "parado" ? "Tentar salvar de novo" : "Encerrar e salvar no diário"}
                    </button>
                    <p className="mt-2 text-center tabular-nums text-xs tabular-nums text-meter-dim">
                      {painel.qtd} pontos gravados
                      {painel.qtd >= MAX_PONTOS_TRILHA ? " · limite atingido — a trilha será salva até aqui" : ""}
                    </p>
                  </>
                )}
              </div>

              {/* Sondagem — NUNCA `{abaAtiva === "sondagem" && <SondagemPainel/>}`:
                  isso desmontaria o componente (e a conexão NMEA em segundo
                  plano dentro dele) toda vez que a pessoa trocasse de aba.
                  `hidden` some do layout sem desmontar. */}
              <div className={abaAtiva === "sondagem" ? "mt-3" : "hidden"}>
                <SondagemPainel aoMudarResumo={setResumoSondagem} />
              </div>

              {/* Tempo — mesmo raciocínio da aba acima. */}
              <div className={abaAtiva === "tempo" ? "mt-3" : "hidden"}>
                <TempoPainel posicao={posParaTempo} />
              </div>
            </div>
          )}
        </div>
        </div>
      </div>

      {/* Onda 23 — barra compacta de navegação: SOG sempre que houver GPS, +
          rumo/ETA quando houver destino, numa única linha discreta. É o que
          sobra no modo "só navegação" além do mapa e do botão de voltar —
          mas fica MONTADA nos dois modos (só a opacidade/posição mudam) pra
          a transição de entrada/saída ser de verdade uma animação, não um
          corte seco. Mesmos números do cartão de destino mais abaixo
          (`navExibido`) — nunca dois valores diferentes pro mesmo dado. */}
      {sogKt != null && !modoNavegando && (
        // Onda 24 — mesma casca "instrumento de ponte" dos 3 cartões
        // (Trilha/Sondagem/painel de rota): esta barra é o MESMO tipo de
        // leitura compacta, só muda o agrupamento (ver comentário do
        // Mostrador acima) — ficaria destoante como único sobrevivente do
        // visual antigo (bg-panel/95 claro), e o texto dourado do Mostrador
        // não teria contraste garantido sobre --superficie no tema claro.
        // Onda 26 — some de vez (não só opacidade/translate) quando o modo
        // navegando está ativo: o painel novo abaixo (`progressoRotaAtual`)
        // ocupa o mesmo papel com números mais completos (próxima
        // virada/restante), mostrar os dois juntos duplicaria a leitura.
        <div
          aria-hidden={!modoSoNavegacao}
          className={`sombra-2 pointer-events-none absolute left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-[var(--raio-pilula)] border border-mapa-instrumento-borda bg-mapa-instrumento px-4 py-2 transition-all duration-200 ${
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

      {/* Onda 26 — painel de navegação ativa + "Voltar ao barco": os dois
          empilhados num único wrapper posicionado uma vez (flex-col, gap)
          em vez de dois absolutos com offsets calculados à mão — assim
          nenhum dos dois precisa saber a altura do outro pra não se
          sobrepor. `pointer-events-none` no wrapper + `auto` em cada filho,
          mesmo padrão do resto da tela (ex.: a coluna do alarme+trilha lá
          em cima). */}
      {modoNavegando && (
        <div
          className={`pointer-events-none absolute left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-2 transition-all duration-200 ${
            garrando ? "top-16" : "top-3"
          }`}
        >
          {progressoRotaAtual && destino && (
            // ONDA 90 (achado 4.4) — O PAINEL VIRA INSTRUMENTO DE PROGRESSO.
            //
            // Eram quatro `Mostrador` numa grade 2×2 (próxima virada,
            // restante, ETA, velocidade): quatro números soltos que dizem
            // QUANTO falta e nunca ONDE se está. O `ProgressoRota` — item 6
            // do spec haulix-exato, marcado P0, escrito e testado desde a
            // onda 79 com ZERO consumidores — junta origem, destino, trilho
            // e proporção numa peça só, e absorve dois dos quatro
            // mostradores (restante e ETA) no caminho.
            //
            // Isso também desarma o risco aritmético que a auditoria
            // levantou: numa célula de ~112px, "282,1 MN" em text-2xl mono
            // não cabe. Restante saiu da grade (agora é o número de 13px do
            // ProgressoRota) e a grade caiu pra dois campos, com mais que o
            // dobro de folga cada.
            //
            // `w-72` e não `w-64`: a linha "origem → destino" precisa de
            // largura pra truncar tarde, e 288px continua caindo folgado num
            // celular de 390.
            <div className="sombra-2 pointer-events-auto w-72 max-w-[calc(100vw-1.5rem)] rounded-[var(--raio-cartao)] border border-mapa-instrumento-borda bg-mapa-instrumento px-3 py-2.5 text-meter-texto">
              {/* Onda 62 (canvas tela-1c) — a anatomia do cabeçalho do
                  painel: o estado como pílula verde à direita, cor E
                  palavra, mesmo Selo do resto do app (o override de --ok em
                  .bg-mapa-instrumento já garante o verde vivo sobre navy).
                  Onda 90 — o destino saiu daqui pra dentro do ProgressoRota
                  (escrever o mesmo nome duas vezes num cartão de 288px é
                  gastar a largura que a linha da rota precisa), e a vaga da
                  esquerda ficou pra honestidade de GPS, que antes custava
                  uma linha só dela.
                  Honestidade de GPS (task 4): mesmo limiar de 60 m já usado
                  no filtro anti-jitter do alarme de âncora — acima disso a
                  leitura já não conta lá, e aqui não pode fingir que a
                  posição na tela é exata. */}
              <div className="flex items-center gap-2">
                <span className="apoio min-w-0 flex-1 truncate text-warn">
                  {precisaoM != null && precisaoM > 60 ? `GPS impreciso (~${Math.round(precisaoM)} m)` : ""}
                </span>
                <Selo estado="ok">Navegando</Selo>
              </div>

              {/* "Aqui" e não o nome de uma origem: a travessia começa na
                  posição do barco NESTE instante, que não tem nome nenhum —
                  inventar um ("Marina", "Partida") seria afirmar um lugar
                  que o app não sabe. O total é o congelado na entrada do
                  modo (ver `totalTravessiaNm`); sem ele a peça inteira não
                  aparece, em vez de desenhar uma barra em zero. */}
              {percentualTravessia != null && totalTravessiaNm != null && (
                <ProgressoRota
                  className="mt-2"
                  origem="Aqui"
                  destino={destino.nome}
                  percentual={percentualTravessia}
                  distanciaTotal={totalTravessiaNm}
                  restante={progressoRotaAtual.distanciaRestanteNm}
                  eta={formatarEta(etaNavegandoMin)}
                  unidade="MN"
                />
              )}

              <div className="mt-2 grid grid-cols-2 gap-2">
                <Mostrador
                  variante="cartao"
                  rotulo={progressoRotaAtual.ultimoSegmento ? "Chegando em" : "Próxima virada"}
                  valor={progressoRotaAtual.proximaViradaNm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                  unidade="MN"
                />
                <Mostrador
                  variante="cartao"
                  rotulo="Velocidade"
                  valor={sogKt != null ? sogKt.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "—"}
                  unidade={sogKt != null ? "kt" : undefined}
                />
              </div>
              {/* Canvas tela-1c — o rodapé mono do painel: diz que a trilha
                  está gravando SÓ quando está (nunca inventa), e repete o
                  aviso de sempre — isto não é auxílio à navegação. */}
              <p className="mt-2.5 text-center tabular-nums text-xs text-meter-dim">
                {estado === "gravando" ? "Trilha gravando · não é auxílio à navegação" : "Não é auxílio à navegação"}
              </p>
            </div>
          )}
          {perseguicaoPausada && (
            <button
              type="button"
              onClick={() => setPerseguicaoPausada(false)}
              className="sombra-2 pointer-events-auto flex h-11 items-center gap-1.5 rounded-[var(--raio-pilula)] border border-accent bg-accent px-4 text-sm font-semibold text-acao-texto"
            >
              <Icone nome="embarcacao" className="size-4" />
              Voltar ao barco
            </button>
          )}
        </div>
      )}

      {/* Faixa de baixo em COLUNA: botões em cima, painel do destino embaixo.
          Antes eram dois blocos absolutos com bottom fixo, e o painel cobria o
          MOB e o cartão do alarme (o dono viu: "aciono o alarme e não acontece
          nada"). Em fluxo, nada se sobrepõe, com ou sem destino. */}
      <div className="pointer-events-none absolute inset-x-3 bottom-12 z-20 flex flex-col items-end gap-2">
        {/* Definir destino / Planejar viagem / Fundeei: recolhem no modo "só
            navegação" (onda 23) — mesmo wrapper CSS-only do topo.
            Onda 24 (passe de arte, bloco 6) — hierarquia: dourado é SÓ pra
            ação primária em curso (aqui, "Definir destino" ativo — as
            outras primárias da tela, "Iniciar gravação"/"Armar alarme",
            já eram douradas antes); toda ação secundária vira "navy-
            fantasma" — mesma superfície translúcida dos cartões de
            instrumento (bloco 2), só em formato de pílula. Vermelho fica
            reservado só pro MOB (ver abaixo). */}
        <div aria-hidden={modoSoNavegacao} className={`${classeColapsavel("baixo")} items-end`}>
          {mapaPronto && (
            <button
              type="button"
              onClick={() => setModoDefinirDestino((v) => !v)}
              aria-pressed={modoDefinirDestino}
              // ONDA 81 — OS ATALHOS PERDEM O RÓTULO E VIRAM BOTÃO-CÍRCULO.
              //
              // Duas queixas do dono, na mesma pilha. A primeira: cada pílula
              // tinha a largura do próprio texto e a coluna era alinhada à
              // direita, então a borda ESQUERDA virava uma escada de três
              // degraus ("Definir destino" longa, "Fundeei" curta). A
              // segunda, e a que manda: "pra que ter um textão desse no
              // mapa?".
              //
              // Ele está certo — a referência não tem UM rótulo de ação sobre
              // a carta: os controles do mapa lá são uma coluna de
              // botões-círculo iguais, encostados na borda. Texto sobre mapa
              // compete com o dado que o mapa existe pra mostrar, que é a
              // mesma razão pela qual a prosa saiu dos painéis nesta onda.
              //
              // Círculo de 44px resolve as duas de uma vez: some a escada
              // (todos do mesmo tamanho) e some o texto. O nome vira
              // `aria-label` + `title` — quem usa leitor de tela continua
              // ouvindo, e quem passa o mouse continua lendo.
              //
              // EXCEÇÃO deliberada: quando o modo de definir destino está
              // ATIVO, o rótulo volta ("Toque no mapa…"). Aí o texto não é
              // enfeite, é a única coisa que explica por que o próximo toque
              // no mapa vai fazer algo diferente do normal.
              aria-label="Definir destino"
              title="Definir destino"
              className={`sombra-2 flex h-11 items-center justify-center gap-2 rounded-[var(--raio-pilula)] border text-sm font-medium ${
                modoDefinirDestino
                  ? "border-accent bg-accent px-4 text-acao-texto"
                  : "w-11 border-mapa-instrumento-borda bg-mapa-instrumento text-meter-texto"
              }`}
            >
              <Icone nome="mapa" className="size-5 shrink-0" />
              {modoDefinirDestino && "Toque no mapa…"}
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
              aria-label="Planejar viagem"
              title="Planejar viagem"
              className="sombra-2 flex size-11 items-center justify-center rounded-[var(--raio-pilula)] border border-mapa-instrumento-borda bg-mapa-instrumento text-meter-texto"
            >
              <Icone nome="estrela" className="size-5 shrink-0" />
            </button>
          )}

          {!ancora && !armandoAncora && (
            <button
              type="button"
              onClick={() => setArmandoAncora(true)}
              aria-label="Fundeei — armar alarme de âncora"
              title="Fundeei — armar alarme de âncora"
              className="sombra-2 flex size-11 items-center justify-center rounded-[var(--raio-pilula)] border border-mapa-instrumento-borda bg-mapa-instrumento text-meter-texto"
            >
              <Icone nome="ancora" className="size-5 shrink-0" />
            </button>
          )}
          {!ancora && armandoAncora && (
            <div className="sombra-2 w-56 rounded-[var(--raio-cartao)] border border-line bg-panel/97 p-3">
              <label htmlFor="raio-ancora" className="rotulo mb-1 flex items-center justify-between text-dim">
                Raio do alarme
                <span className="tabular-nums tabular-nums text-dim">{raioM} m</span>
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
                  className="mt-2 flex h-11 w-full items-center justify-center gap-1.5 rounded-[var(--raio-controle)] bg-accent text-sm font-semibold text-acao-texto"
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
                    className="mt-2 flex h-11 w-full items-center justify-center gap-1.5 rounded-[var(--raio-controle)] bg-accent text-sm font-semibold text-acao-texto"
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
              className="sombra-2 flex h-11 items-center gap-1.5 rounded-[var(--raio-pilula)] border border-mapa-instrumento-borda bg-mapa-instrumento px-3 text-sm font-medium text-meter-texto"
            >
              {/* text-accent (não accent-forte, que troca de tom por tema e
                  perderia contraste aqui) sinaliza "âncora armada" mesmo
                  dentro do chrome secundário navy-fantasma. */}
              <Icone nome="ancora" className="size-4 text-accent" />
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
          {/* Onda 26 — botão explícito de entrar/sair do modo navegando:
              "o usuário manda, sempre" (task). Só aparece com destino
              definido — sem destino não há pra onde apontar a câmera nem o
              que mostrar no painel novo. Mesmo padrão de encolher pro
              ícone sozinho em "só navegação" que o MOB logo abaixo já usa. */}
          {destino && (
            <button
              type="button"
              onClick={alternarModoNavegando}
              aria-pressed={modoNavegando}
              aria-label={modoNavegando ? "Sair do modo navegando" : "Modo navegando"}
              className={`sombra-2 flex h-11 items-center justify-center gap-1.5 rounded-[var(--raio-pilula)] border transition-all duration-200 ${
                modoNavegando
                  ? "border-accent bg-accent text-acao-texto"
                  : "border-mapa-instrumento-borda bg-mapa-instrumento text-meter-texto"
              } ${modoSoNavegacao ? "w-11 px-0" : "px-4 text-sm font-medium"}`}
            >
              <Icone nome="embarcacao" className="size-4 shrink-0" />
              {!modoSoNavegacao && (modoNavegando ? "Navegando" : "Modo navegando")}
            </button>
          )}

          <button
            type="button"
            onClick={alternarSoNavegacao}
            aria-pressed={modoSoNavegacao}
            aria-label={modoSoNavegacao ? "Sair do modo só navegação" : "Modo só navegação"}
            className="sombra-2 flex size-11 items-center justify-center rounded-[var(--raio-pilula)] border border-mapa-instrumento-borda bg-mapa-instrumento text-meter-texto"
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
            // ONDA 81 — o estado desabilitado do MOB era `opacity-50` sobre o
            // vermelho, e o resultado é um rosa lavado: o controle mais
            // crítico do app lia como defeito de renderização, não como
            // indisponível. O dono apontou exatamente esta pílula.
            //
            // Sem GPS ele REALMENTE não pode agir (marcar homem ao mar exige
            // uma posição), então esconder o estado seria pior. O que muda é
            // como ele confessa: em vez de desbotar o vermelho, ele troca
            // preenchimento por CONTORNO e diz o motivo no `title`/`aria`.
            // Contorno lê como "armado e esperando", desbotado lê como
            // "quebrado".
            aria-label={posAtual ? "Homem ao mar" : "Homem ao mar — indisponível sem posição GPS"}
            title={posAtual ? undefined : "Sem posição GPS — o MOB marca onde o barco está"}
            className={`sombra-2 flex h-11 items-center justify-center gap-1.5 rounded-[var(--raio-pilula)] font-bold transition-all duration-200 ${
              posAtual
                ? "bg-crit text-white"
                : "border-2 border-crit/70 bg-mapa-instrumento text-crit"
            } ${modoSoNavegacao ? "w-11 px-0" : "px-4 text-sm"}`}
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
          <div className="sombra-2 pointer-events-auto w-full rounded-[var(--raio-cartao)] border border-mapa-instrumento-borda bg-mapa-instrumento px-3 py-2.5 text-meter-texto">
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
                  className="mt-2 flex h-11 w-full items-center justify-center rounded-[var(--raio-controle)] border border-mapa-instrumento-borda text-sm font-medium"
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
                <span className="size-1.5 shrink-0 animate-pulse rounded-[var(--raio-pilula)] bg-accent" aria-hidden="true" />
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
                Rota pela água — contorna a costa. É estimativa, não auxílio à navegação:
                confira na carta náutica oficial antes de seguir.
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

      {/* Onda 80 — aviso "não é auxílio à navegação": abre sozinho na
          primeira visita deste aparelho (ver o efeito de `avisoAberto` lá em
          cima) e reabre pelo botão "?" do cartão de instrumentos. Ver
          aviso-navegar.tsx pro porquê de ter saído de dentro do painel de
          Trilha, onde reaparecia toda sessão. */}
      <AvisoNavegar aberto={avisoAberto} aoFechar={fecharAvisoNavegar} />
    </main>
  )
}
