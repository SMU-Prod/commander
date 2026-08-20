"use client"
import { useEffect, useMemo, useRef, useState } from "react"
import { celulaGeografica } from "@/lib/domain/geo"
import {
  calcularEscalaMare,
  LINK_TABUA_MARE_CHM,
  pathNivelMar,
  pontoCardeal,
  projetarPonto,
  type EventoMare,
} from "@/lib/domain/mar"
import { boletimDoMar, horaSp, type BoletimMar } from "@/lib/mar"

// Política de cache (onda 20) — o painel vive dentro de /navegar, cuja tela
// já atualiza `posAtual` a cada tick do GPS (poucos segundos, ver
// navegar-mapa.tsx); bater na Open-Meteo nesse ritmo custaria caro e não
// muda nada (vento/onda/maré não mudam segundo a segundo). Duas regras juntas:
// 1) CÉLULA GEOGRÁFICA — duas posições dentro da mesma célula de
//    `TAMANHO_CELULA_GRAUS`° reaproveitam o último boletim buscado, em vez de
//    disparar fetch de novo. ~0,05° ≈ 5,5 km na direção N-S (menos em
//    longitude, quanto mais perto do equador) — grosseiro o bastante pra não
//    reagir ao jitter do GPS dentro da mesma marina/baía, fino o bastante pra
//    atualizar ao trocar de região de fato (ex.: saindo de Angra pra Ilha
//    Grande). Reaproveita a mesma ideia de célula da grade de água
//    (docs/OPERACAO.md), só que em graus, não metros — a escala aqui é a da
//    variação típica de vento/onda costeiros, bem maior que a de um canal
//    navegável.
// 2) VALIDADE — mesmo com o barco parado na mesma célula, o boletim vence
//    depois de `VALIDADE_CACHE_MIN` minutos (a mesma janela de
//    `revalidate: 3600` de `boletimDoMar` seria conservadora demais pro
//    painel ao vivo; 30 min cobre a granularidade horária real da API sem
//    reconsultar toda hora).
const TAMANHO_CELULA_GRAUS = 0.05
const VALIDADE_CACHE_MIN = 30

type EstadoTempo =
  | { tipo: "carregando" }
  | { tipo: "pronto"; boletim: BoletimMar }
  | { tipo: "indisponivel" }

interface CacheBoletim {
  celula: string
  buscadoEm: number
  boletim: BoletimMar
}

/** Busca + cache do boletim, isolado num hook pra manter o componente visual
 *  abaixo só de apresentação. Nunca mostra um boletim vencido como se fosse
 *  atual: se o cache expirou e a busca nova falha, o estado vira
 *  "indisponivel" (a tela avisa e oferece tentar de novo) em vez de continuar
 *  mostrando o número antigo — regra de honestidade da onda 20 (ver
 *  CONTRIBUTING.md, "sem dado, a tela diz e oferece tentar de novo"). */
function useBoletimTempo(posicao: { la: number; lo: number } | null) {
  const [estado, setEstado] = useState<EstadoTempo>({ tipo: "carregando" })
  const [tentativa, setTentativa] = useState(0)
  const cacheRef = useRef<CacheBoletim | null>(null)

  // Recalcula a CÉLULA a cada posição nova, mas só entra como dependência do
  // efeito de busca quando o VALOR da célula muda — GPS anda dentro da mesma
  // célula o tempo todo sem re-executar o efeito (string primitiva, mesma
  // comparação que já protege o resto da tela, ex. LIMIAR_RECALCULO_M em
  // navegar-mapa.tsx, só que por igualdade em vez de distância).
  const celulaAtual = useMemo(
    () => (posicao ? celulaGeografica(posicao.la, posicao.lo, TAMANHO_CELULA_GRAUS) : null),
    [posicao],
  )

  useEffect(() => {
    if (!posicao || !celulaAtual) return
    const cache = cacheRef.current
    const cacheValido = cache && cache.celula === celulaAtual && Date.now() - cache.buscadoEm < VALIDADE_CACHE_MIN * 60_000
    if (cacheValido) {
      setEstado((atual) => (atual.tipo === "pronto" && atual.boletim === cache.boletim ? atual : { tipo: "pronto", boletim: cache.boletim }))
      return
    }
    let cancelado = false
    // Mantém o último boletim válido na tela enquanto busca de novo (troca de
    // célula, ou cache vencido) — só cai pra "carregando" quando não há nada
    // pra mostrar ainda.
    setEstado((atual) => (atual.tipo === "pronto" ? atual : { tipo: "carregando" }))
    boletimDoMar(posicao.la, posicao.lo).then((b) => {
      if (cancelado) return
      if (b) {
        cacheRef.current = { celula: celulaAtual, buscadoEm: Date.now(), boletim: b }
        setEstado({ tipo: "pronto", boletim: b })
      } else {
        cacheRef.current = null
        setEstado({ tipo: "indisponivel" })
      }
    })
    return () => {
      cancelado = true
    }
  }, [posicao, celulaAtual, tentativa])

  // Rede de segurança pro caso "parado no mesmo lugar por mais de 30 min": sem
  // isso, célula que não muda nunca reavalia a validade sozinha (o efeito
  // acima só reage a `celulaAtual`/`tentativa`). Checa 1×/min — não precisa
  // ser mais frequente que a própria janela de validade.
  useEffect(() => {
    const intervalo = setInterval(() => {
      const cache = cacheRef.current
      if (cache && Date.now() - cache.buscadoEm >= VALIDADE_CACHE_MIN * 60_000) {
        setTentativa((t) => t + 1)
      }
    }, 60_000)
    return () => clearInterval(intervalo)
  }, [])

  return { estado, tentarDeNovo: () => setTentativa((t) => t + 1) }
}

const ROTULO_MARE: Record<EventoMare["tipo"], string> = { preamar: "Preamar", "baixa-mar": "Baixa-mar" }

/** Seta do vento — aponta pra ONDE O VENTO EMPURRA, não de onde ele vem.
 *  As duas convenções coexistem de propósito, e é assim que todo app náutico
 *  sério faz (Windy, PredictWind, Navionics): o TEXTO ao lado diz a origem
 *  ("NE" = vento de nordeste, convenção meteorológica que o marinheiro fala),
 *  e a SETA mostra o efeito — pra onde ele te leva. Por isso os 180° de
 *  correção sobre o valor cru da API (que é a direção de ORIGEM). O traçado
 *  sem rotação aponta pro Norte (topo). */
function SetaVento({ graus }: { graus: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      style={{ transform: `rotate(${(graus + 180) % 360}deg)` }}
      aria-hidden="true"
    >
      <path d="M12 3 19 19 12 15 5 19Z" fill="currentColor" />
    </svg>
  )
}

const LARGURA_GRAFICO = 240
const ALTURA_GRAFICO = 56
const MARGEM_Y_GRAFICO = 7

/** Gráfico de maré: SVG próprio, sem lib nenhuma — a matemática de escala
 *  (min/max, projeção hora→x e nível→y) vive em web/lib/domain/mar.ts,
 *  testada; este componente só desenha em cima dela. Marca "agora" (linha
 *  vertical) e a próxima virada (ponto + rótulo), sempre com a ressalva de
 *  que é ESTIMATIVA por modelo, nunca a tábua oficial. */
function GraficoMare({ serie, proxima }: { serie: BoletimMar["serieNivelMar"]; proxima: EventoMare | null }) {
  const escala = calcularEscalaMare(serie, LARGURA_GRAFICO, ALTURA_GRAFICO, MARGEM_Y_GRAFICO)
  if (!escala) {
    return <p className="apoio mt-3 text-meter-dim">Sem dado de maré agora.</p>
  }
  const path = pathNivelMar(serie, escala)
  const hAgora = horaSp()
  const pontoAgora = serie.find((p) => p.hora === hAgora)
  const xAgora = (hAgora / 23) * LARGURA_GRAFICO
  const pontoProxima = proxima ? projetarPonto(proxima.hora, proxima.nivelM, escala) : null

  return (
    <div className="mt-3">
      <svg viewBox={`0 0 ${LARGURA_GRAFICO} ${ALTURA_GRAFICO}`} className="w-full text-accent" aria-hidden="true">
        <path d={path} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
        {/* "agora" — linha vertical discreta + ponto sobre a curva, quando a
            hora atual está coberta pela série (deveria sempre estar, é o
            mesmo dia). */}
        <line x1={xAgora} y1={0} x2={xAgora} y2={ALTURA_GRAFICO} stroke="currentColor" strokeOpacity={0.35} strokeWidth={1} strokeDasharray="2,2" />
        {pontoAgora && (
          <circle cx={xAgora} cy={projetarPonto(hAgora, pontoAgora.nivelM, escala).y} r={2.5} fill="currentColor" />
        )}
        {pontoProxima && (
          <circle cx={pontoProxima.x} cy={pontoProxima.y} r={2.5} fill="none" stroke="currentColor" strokeWidth={1.4} />
        )}
      </svg>
      <p className="apoio mt-1.5 text-meter-dim">
        {proxima ? (
          <>
            {ROTULO_MARE[proxima.tipo]} estimada às {String(proxima.hora).padStart(2, "0")}h
          </>
        ) : (
          "Sem mais viradas de maré estimadas pra hoje."
        )}
        {" · curva estimada por modelo, não é a tábua oficial · "}
        <a href={LINK_TABUA_MARE_CHM} target="_blank" rel="noopener noreferrer" className="text-accent underline">
          tábua oficial do CHM
        </a>
      </p>
    </div>
  )
}

/** Painel "Tempo" de /navegar (onda 20) — vento, onda, água e a curva de
 *  maré estimada do dia, pra POSIÇÃO ATUAL do barco (ou o centro do mapa
 *  sem GPS — resolvido pelo chamador, ver `posicao` em navegar-mapa.tsx).
 *
 *  Onda 80 (consolidação dos painéis flutuantes): este componente PAROU de
 *  desenhar a própria casca de cartão/pílula e o próprio botão de
 *  recolher/expandir — quem chama (`navegar-mapa.tsx`) é dono do cartão
 *  único e das abas agora, e só esconde este conteúdo via CSS quando a aba
 *  "Tempo" não está ativa (mesmo raciocínio de nunca desmontar aplicado à
 *  SondagemPainel, ver o comentário grande lá — aqui o motivo é mais fraco,
 *  não há conexão em segundo plano, mas o padrão fica consistente entre as
 *  três abas). */
export function TempoPainel({ posicao }: { posicao: { la: number; lo: number } | null }) {
  const { estado, tentarDeNovo } = useBoletimTempo(posicao)

  const mostrador = "rounded-[var(--raio-cartao)] border border-mapa-instrumento-borda bg-meter px-3 py-2 font-mono-instr tabular-nums"
  // Onda 80 — rótulo em CAIXA DE FRASE (`.rotulo-dado`, ver app/globals.css),
  // não mais uppercase rastreado: mesma troca que o resto da tela fez (ver
  // navegar-mapa.tsx, comentário do Mostrador).
  const etiqueta = "rotulo-dado !text-meter-dim"

  return (
    <div>
      {!posicao && (
        <p className="apoio text-meter-dim">Sem posição ainda — aguardando GPS ou o mapa carregar.</p>
      )}

      {posicao && estado.tipo === "carregando" && (
        <p className="apoio text-meter-dim">Carregando o tempo…</p>
      )}

      {posicao && estado.tipo === "indisponivel" && (
        <div className="flex items-center justify-between gap-3">
          <p className="apoio text-meter-dim">Tempo indisponível agora — a Open-Meteo não respondeu.</p>
          <button
            onClick={tentarDeNovo}
            className="flex min-h-11 shrink-0 items-center rounded-[var(--raio-controle)] border border-mapa-instrumento-borda px-3 text-xs font-semibold text-meter-texto"
          >
            Tentar de novo
          </button>
        </div>
      )}

      {posicao && estado.tipo === "pronto" && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <div className={mostrador}>
              <p className={etiqueta}>Vento</p>
              <p className="flex items-baseline gap-1 text-xl text-accent">
                {estado.boletim.ventoKt != null ? Math.round(estado.boletim.ventoKt) : "—"}
                <span className="text-sm text-meter-dim">kt</span>
                {/* "de NE" e nao so "NE": o marinheiro fala a ORIGEM do
                    vento, e o "de" tira qualquer duvida de leitura ao lado
                    de uma seta que aponta pro lado contrario (ver
                    SetaVento). */}
                {estado.boletim.ventoGraus != null && (
                  <span className="ml-auto flex items-center gap-1 text-xs text-meter-dim">
                    <SetaVento graus={estado.boletim.ventoGraus} />
                    de {pontoCardeal(estado.boletim.ventoGraus)}
                  </span>
                )}
              </p>
              {estado.boletim.rajadaKt != null && (
                <p className="mt-0.5 text-xs text-meter-dim">rajada {Math.round(estado.boletim.rajadaKt)} kt</p>
              )}
            </div>
            <div className={mostrador}>
              <p className={etiqueta}>Onda</p>
              <p className="text-xl text-accent">
                {estado.boletim.ondaM != null ? estado.boletim.ondaM.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "—"}
                <span className="text-sm text-meter-dim"> m</span>
              </p>
              {estado.boletim.periodoS != null && (
                <p className="mt-0.5 text-xs text-meter-dim">período {Math.round(estado.boletim.periodoS)} s</p>
              )}
            </div>
            <div className={mostrador}>
              <p className={etiqueta}>Água</p>
              <p className="text-xl text-accent">
                {estado.boletim.aguaC != null ? Math.round(estado.boletim.aguaC) : "—"}
                <span className="text-sm text-meter-dim"> °C</span>
              </p>
            </div>
          </div>

          {/* `--raio-pilula` no lugar do `rounded` cru (4px do Tailwind, que
              não é degrau de escala nenhuma): a peça é o SELO do boletim — o
              próprio dado se chama `selo` —, e selo desenha 999 (docs/DESIGN.md
              §5). Não é `--raio-controle`: nada aqui se toca, é leitura. */}
          <div className={`rotulo mt-2 inline-flex rounded-[var(--raio-pilula)] px-2 py-0.5 ${
            estado.boletim.selo.nivel === "ok" ? "border border-ok/40 text-ok"
            : estado.boletim.selo.nivel === "atencao" ? "border border-warn/40 text-warn"
            : "border border-crit/40 text-crit"
          }`}>
            {estado.boletim.selo.rotulo}
          </div>
          {/* Mesma correção da Início (onda 84): o selo nomeia o nível, o
              motivo nomeia a causa. Aqui pesa ainda mais — este painel abre
              sobre a carta, na hora de decidir se sai. */}
          {estado.boletim.selo.motivo && (
            <p className={`mt-1 text-xs ${estado.boletim.selo.nivel === "crit" ? "text-crit" : "text-warn"}`}>
              Por causa de {estado.boletim.selo.motivo}.
            </p>
          )}

          <GraficoMare serie={estado.boletim.serieNivelMar} proxima={estado.boletim.proximaMareEstimada} />
        </>
      )}
    </div>
  )
}
