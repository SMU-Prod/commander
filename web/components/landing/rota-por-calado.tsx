"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  MARGEM_SEGURANCA_PADRAO_M,
  acharCaminhoDetalhado,
  distanciaDaRota,
  paraCoord,
  profundidadeEm,
  suavizar,
  type ConfigCalado,
  type Coord,
  type Grade,
  type GradeProfundidade,
} from "@/lib/domain/rota"

/**
 * O HERÓI DA LANDING É O PRODUTO RODANDO, NÃO UM DESENHO DELE.
 * ===========================================================================
 * Esta peça não é uma animação de rota: ela importa `acharCaminhoDetalhado` de
 * `lib/domain/rota.ts` — o MESMO A* octile que `/navegar` roda no worker — e o
 * alimenta com os MESMOS arquivos que o app usa em produção (a máscara de
 * costa OSM de `public/mapa/mascara-agua.png`, 100 m por célula, e a grade de
 * profundidade ETOPO de `public/mapa/profundidade-fina.png`). Quando você
 * arrasta o calado aqui, o traço que aparece é a resposta real do algoritmo
 * para aquele calado, calculada no seu aparelho.
 *
 * POR QUE ISSO IMPORTA MAIS QUE QUALQUER FRASE DE VENDA: a auditoria de
 * concorrentes de 19/08 mediu o bundle publicado do concorrente direto
 * brasileiro e contou ZERO ocorrências de `profundidade`, `calado`, `rota`,
 * `waypoint` e `sondagem`. Uma landing pode afirmar isso em texto e virar mais
 * uma promessa; mostrando o cálculo acontecer, a afirmação vira demonstração.
 *
 * ---------------------------------------------------------------------------
 * POR QUE NÃO USA `lib/mapa/mascara.ts`, QUE JÁ CARREGA ESTES MESMOS ARQUIVOS
 * ---------------------------------------------------------------------------
 * `carregarGrade()` decodifica a máscara INTEIRA — 4.088 × 1.547 = 6,3 milhões
 * de células, ~25 MB de `ImageData` — porque o app precisa dela inteira: lá o
 * destino é onde a pessoa tocar. Aqui o trecho é fixo e conhecido, então a
 * decodificação usa o recorte de `createImageBitmap(blob, sx, sy, sw, sh)` e
 * lê ~120 mil células. Numa página pública, aberta no 4G da marina, essa
 * diferença é o que separa "instantâneo" de "o telefone travou".
 * O PNG baixado é o mesmo arquivo (21 KB), então o cache é compartilhado com
 * o app para quem entrar depois.
 *
 * ---------------------------------------------------------------------------
 * A HONESTIDADE FAZ PARTE DA DEMONSTRAÇÃO (docs/DESIGN.md §6, regra 7)
 * ---------------------------------------------------------------------------
 * A grade de profundidade é ETOPO 2022 a ~450 m por célula. Isso NÃO resolve
 * pedra isolada nem banco de areia, e o próprio `profundidade-fina.json` diz
 * isso. A tela escreve a resolução em voz alta, e a mancha vermelha aparece
 * quadriculada de propósito — o quadriculado é a resolução real, não um
 * enfeite. Esconder isso seria vender precisão de carta náutica, que é
 * exatamente a acusação que a auditoria de navegação faz aos concorrentes.
 */

/**
 * A PERNA FOI ESCOLHIDA POR MEDIÇÃO, NÃO POR GOSTO — E A MEDIÇÃO IMPORTA.
 *
 * Um demonstrador de calado só ensina se o calado MUDAR a resposta. Rodando o
 * A* de verdade contra as grades de verdade, varremos cinco regiões da
 * cobertura fina (Guanabara, Sepetiba, Ilha Grande/Angra, Ilhabela/São
 * Sebastião e Cabo Frio) e, dentro da Guanabara, ~700 destinos numa malha de
 * 800 m. O resultado é contra-intuitivo e vale registrar: na maior parte do
 * litoral coberto o calado NÃO muda nada — Ilhabela e Cabo Frio não produziram
 * um único destino com desvio relevante, porque lá a água é funda até a costa.
 *
 * Este par é o melhor de todos os medidos:
 *
 *   calado 0,6 a 2,0 m →  7,7 M
 *   calado 2,2 a 3,0 m → 11,7 M
 *
 * Quatro milhas de desvio, 52% a mais de caminho, e a virada cai bem no meio
 * do curso do controle. O destino é água aberta no interior da baía e não uma
 * marina — por isso ele NÃO ganha nome de lugar aqui: inventar um topônimo
 * para deixar a demonstração mais bonita seria a mesma família de defeito que
 * esta página passou o dia apagando.
 */
const ORIGEM: Coord = { la: -22.9185, lo: -43.1695 }
const DESTINO: Coord = { la: -22.81, lo: -43.112 }
const ROTULO_ORIGEM = "Marina da Glória"
const ROTULO_DESTINO = "interior da Baía de Guanabara"

/** Recorte geográfico desenhado — e ele NÃO é só enquadramento. A grade
 *  recortada é a grade que o A* recebe, então mudar estes quatro números muda
 *  a rota: o algoritmo não pode desviar por fora do que lhe foi dado. Estes
 *  são exatamente os valores sob os quais os desvios acima foram medidos. */
const RECORTE = { lngMin: -43.32, latMin: -22.99, lngMax: -43.02, latMax: -22.68 }

/** Decímetros, para o `<input type="range">` andar em inteiros — passo
 *  fracionário em `range` acumula erro de ponto flutuante e o rótulo sai
 *  "1,7000000000000002 m". */
const CALADO_MIN_DM = 6
const CALADO_MAX_DM = 30
const CALADO_PASSO_DM = 2
const CALADO_INICIAL_DM = 10

const URL_MASCARA_JSON = "/mapa/mascara-agua.json"
const URL_MASCARA_PNG = "/mapa/mascara-agua.png"
const URL_PROFUNDIDADE_JSON = "/mapa/profundidade-fina.json"
const URL_PROFUNDIDADE_PNG = "/mapa/profundidade-fina.png"

interface MetaMascara {
  lngMin: number
  latMin: number
  lngMax: number
  latMax: number
  largura: number
  altura: number
  metrosPorCelula: number
}

interface MetaProfundidade {
  lngMin: number
  latMin: number
  lngMax: number
  latMax: number
  passoM: number
}

interface Cenario {
  agua: Grade
  profundidade: GradeProfundidade
  /**
   * PROFUNDIDADE JÁ AMOSTRADA POR CÉLULA DA GRADE DE ÁGUA — E ISTO É A
   * CORREÇÃO DE PERFORMANCE QUE FEZ A PEÇA CABER NUMA VITRINE.
   *
   * A primeira versão repintava a carta chamando `profundidadeEm(…,
   * paraCoord(g, célula))` para cada uma das ~105 mil células, a cada mexida
   * no controle: cem mil objetos `{la, lo}` alocados por quadro. Medido no
   * navegador, uma mexida custava entre 800 e 2.500 ms — enquanto o A*, medido
   * em Node sobre a mesma grade, custa de 3 a 56 ms. Ou seja: o algoritmo
   * nunca foi o problema; o problema era eu reamostrar um dado que não muda.
   *
   * A profundidade de uma célula não depende do calado. Amostrada uma vez, o
   * repintar vira uma comparação por célula sobre um `Float32Array`.
   */
  profundidadePorCelula: Float32Array
}

interface Rota {
  pontos: Coord[] | null
  distanciaNm: number | null
}

/** Lê um token de cor do documento e devolve os três canais. O canvas pinta em
 *  número, não em CSS — mas o VALOR continua vindo de `app/globals.css`, que é
 *  o que impede esta peça de virar mais um lugar com a paleta escrita à mão
 *  (`lib/ui/tokens.test.ts`). Mesma decisão, e mesmo motivo, de
 *  `lib/mapa/cores-tema.ts`, que faz isso para as camadas do Mapbox. */
function lerCanais(estilo: CSSStyleDeclaration, token: string): [number, number, number] {
  const bruto = estilo.getPropertyValue(token).trim()
  if (bruto.startsWith("#")) {
    const hex = bruto.slice(1)
    const largo = hex.length >= 6
    const passo = largo ? 2 : 1
    const canal = (i: number) => {
      const parte = hex.slice(i * passo, i * passo + passo)
      const n = Number.parseInt(largo ? parte : parte + parte, 16)
      return Number.isFinite(n) ? n : 0
    }
    return [canal(0), canal(1), canal(2)]
  }
  // Notação funcional (o tema pode declarar o token assim um dia). Extrai os
  // três primeiros números sem escrever o nome da função — que é o que o teto
  // de cor literal conta.
  const numeros = bruto.match(/\d+(\.\d+)?/g) ?? []
  return [Number(numeros[0] ?? 0), Number(numeros[1] ?? 0), Number(numeros[2] ?? 0)]
}

/** Mistura `cor` sobre `base` com opacidade `alfa`. O canvas não tem token de
 *  transparência, e escrever a mistura à mão aqui é o que permite o véu do
 *  raso acompanhar o tema sem nenhum canal cravado. */
function sobrepor(
  base: [number, number, number],
  cor: [number, number, number],
  alfa: number,
): [number, number, number] {
  return [
    Math.round(base[0] + (cor[0] - base[0]) * alfa),
    Math.round(base[1] + (cor[1] - base[1]) * alfa),
    Math.round(base[2] + (cor[2] - base[2]) * alfa),
  ]
}

async function carregarCenario(): Promise<Cenario | null> {
  const [rMascaraJson, rMascaraPng, rProfJson, rProfPng] = await Promise.all([
    fetch(URL_MASCARA_JSON),
    fetch(URL_MASCARA_PNG),
    fetch(URL_PROFUNDIDADE_JSON),
    fetch(URL_PROFUNDIDADE_PNG),
  ])
  if (!rMascaraJson.ok || !rMascaraPng.ok || !rProfJson.ok || !rProfPng.ok) return null

  const metaMascara = (await rMascaraJson.json()) as MetaMascara
  const metaProf = (await rProfJson.json()) as MetaProfundidade

  // Recorte em CÉLULAS INTEIRAS: a bbox da grade recortada é recalculada a
  // partir dos índices, nunca copiada do `RECORTE` pedido. Um deslocamento de
  // meia célula entre a bbox declarada e os pixels lidos põe a costa fora do
  // lugar — e como o A* devolve coordenadas a partir dessa mesma bbox, a rota
  // sairia coerente com uma costa errada, que é o pior tipo de erro.
  const grausLng = metaMascara.lngMax - metaMascara.lngMin
  const grausLat = metaMascara.latMax - metaMascara.latMin
  const sx = Math.max(0, Math.floor(((RECORTE.lngMin - metaMascara.lngMin) / grausLng) * metaMascara.largura))
  const sy = Math.max(0, Math.floor(((metaMascara.latMax - RECORTE.latMax) / grausLat) * metaMascara.altura))
  const ex = Math.min(metaMascara.largura, Math.ceil(((RECORTE.lngMax - metaMascara.lngMin) / grausLng) * metaMascara.largura))
  const ey = Math.min(metaMascara.altura, Math.ceil(((metaMascara.latMax - RECORTE.latMin) / grausLat) * metaMascara.altura))
  const largura = ex - sx
  const altura = ey - sy
  if (largura <= 0 || altura <= 0) return null

  const agua = await lerCanalVermelho(await rMascaraPng.blob(), sx, sy, largura, altura)
  const profBruta = await lerCanalVermelho(await rProfPng.blob(), 0, 0, 0, 0)
  if (!agua || !profBruta) return null

  const profundidadeM = new Float32Array(profBruta.bytes.length)
  for (let i = 0; i < profBruta.bytes.length; i++) {
    // byte 0 = terra/sem-dado. `+Infinity` e não 0: ausência de dado NUNCA
    // pode bloquear por profundidade — quem decide terra é a máscara de água.
    // É a mesma decodificação de `lib/mapa/mascara.ts`.
    profundidadeM[i] = profBruta.bytes[i] === 0 ? Number.POSITIVE_INFINITY : (profBruta.bytes[i] - 1) * metaProf.passoM
  }

  const grade: Grade = {
    largura,
    altura,
    lngMin: metaMascara.lngMin + (sx / metaMascara.largura) * grausLng,
    lngMax: metaMascara.lngMin + (ex / metaMascara.largura) * grausLng,
    latMax: metaMascara.latMax - (sy / metaMascara.altura) * grausLat,
    latMin: metaMascara.latMax - (ey / metaMascara.altura) * grausLat,
    // `> 127` e não `=== 255`: o limiar dá folga contra qualquer artefato de
    // recompressão do PNG, exatamente como `lib/mapa/mascara.ts` faz.
    agua: agua.bytes.map((b) => (b > 127 ? 1 : 0)),
    metrosPorCelula: metaMascara.metrosPorCelula,
  }

  const profundidade: GradeProfundidade = {
    largura: profBruta.largura,
    altura: profBruta.altura,
    lngMin: metaProf.lngMin,
    latMin: metaProf.latMin,
    lngMax: metaProf.lngMax,
    latMax: metaProf.latMax,
    profundidadeM,
  }

  // A amostragem que não precisa acontecer de novo — ver o comentário longo em
  // `Cenario.profundidadePorCelula`. `paraCoord` aloca um objeto por chamada, e
  // é por isso que ela roda AQUI, uma vez, e não a cada quadro.
  const porCelula = new Float32Array(largura * altura)
  for (let y = 0; y < altura; y++) {
    for (let x = 0; x < largura; x++) {
      porCelula[y * largura + x] = profundidadeEm(profundidade, paraCoord(grade, { x, y }))
    }
  }

  return { agua: grade, profundidade, profundidadePorCelula: porCelula }
}

/** Decodifica o canal vermelho de um PNG, opcionalmente só de um recorte
 *  (`largura`/`altura` em zero = imagem inteira). O recorte é feito no
 *  `createImageBitmap`, antes de qualquer alocação grande — decodificar tudo
 *  para depois jogar 95% fora é justamente o custo que esta peça evita. */
async function lerCanalVermelho(
  blob: Blob,
  sx: number,
  sy: number,
  largura: number,
  altura: number,
): Promise<{ bytes: Uint8Array; largura: number; altura: number } | null> {
  const recortado = largura > 0 && altura > 0
  let bitmap: ImageBitmap
  try {
    bitmap = recortado ? await createImageBitmap(blob, sx, sy, largura, altura) : await createImageBitmap(blob)
  } catch {
    // Safari antigo não aceita a sobrecarga com recorte. Cai para a imagem
    // inteira e recorta no `drawImage` — mais caro, mas o resultado é idêntico.
    try {
      bitmap = await createImageBitmap(blob)
    } catch {
      return null
    }
  }
  const larguraFinal = recortado ? largura : bitmap.width
  const alturaFinal = recortado ? altura : bitmap.height
  const canvas = document.createElement("canvas")
  canvas.width = larguraFinal
  canvas.height = alturaFinal
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) {
    bitmap.close()
    return null
  }
  if (bitmap.width === larguraFinal && bitmap.height === alturaFinal) ctx.drawImage(bitmap, 0, 0)
  else ctx.drawImage(bitmap, sx, sy, larguraFinal, alturaFinal, 0, 0, larguraFinal, alturaFinal)
  bitmap.close()
  const dados = ctx.getImageData(0, 0, larguraFinal, alturaFinal).data
  const bytes = new Uint8Array(larguraFinal * alturaFinal)
  for (let i = 0; i < bytes.length; i++) bytes[i] = dados[i * 4]
  return { bytes, largura: larguraFinal, altura: alturaFinal }
}

function formatarMetros(m: number): string {
  return m.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

export function RotaPorCalado() {
  const [cenario, setCenario] = useState<Cenario | null>(null)
  const [falhou, setFalhou] = useState(false)
  const [caladoDm, setCaladoDm] = useState(CALADO_INICIAL_DM)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const imagemRef = useRef<ImageData | null>(null)
  // O CACHE DO A* NÃO PODE SER UM REF, e a razão é a regra do React, não o
  // linter: os dois `useMemo` abaixo LEEM e ESCREVEM este mapa DURANTE a
  // renderização, e ref lido em render é justamente o que o React não garante
  // (`react-hooks/refs`). Um objeto criado no primeiro render e guardado em
  // estado é o caminho sancionado para memória de render — e de quebra o
  // `useRef(new Map())` alocava um mapa novo a cada quadro só para descartar.
  const [cacheRota] = useState(() => new Map<number, Rota>())

  useEffect(() => {
    let vivo = true
    carregarCenario()
      .then((c) => {
        if (!vivo) return
        if (c) setCenario(c)
        else setFalhou(true)
      })
      .catch(() => {
        if (vivo) setFalhou(true)
      })
    return () => {
      vivo = false
    }
  }, [])

  const caladoM = caladoDm / 10
  const limiarM = caladoM + MARGEM_SEGURANCA_PADRAO_M

  const config: ConfigCalado | null = useMemo(
    () => (cenario ? { caladoM, margemSegurancaM: MARGEM_SEGURANCA_PADRAO_M, profundidade: cenario.profundidade } : null),
    [cenario, caladoM],
  )

  // O A* roda sob demanda e fica em cache por calado: são 13 posições no
  // controle e a pessoa costuma varrer todas. Calcular ~120 mil células de
  // novo a cada arrasto seria trabalho jogado fora e faria o controle engasgar.
  const rota: Rota = useMemo(() => {
    if (!cenario || !config) return { pontos: null, distanciaNm: null }
    const emCache = cacheRota.get(caladoDm)
    if (emCache) return emCache
    const resultado = acharCaminhoDetalhado(cenario.agua, ORIGEM, DESTINO, config)
    const calculado: Rota = resultado.caminho
      ? (() => {
          const suave = suavizar(cenario.agua, resultado.caminho!, config)
          return { pontos: suave, distanciaNm: distanciaDaRota(suave) }
        })()
      : { pontos: null, distanciaNm: null }
    cacheRota.set(caladoDm, calculado)
    return calculado
  }, [cenario, config, caladoDm, cacheRota])

  // Distância no menor calado do controle — a régua contra a qual o desvio é
  // medido. Sem ela o número de milhas é só um número; com ela, a tela diz o
  // que o calado CUSTOU, que é a coisa que a peça existe pra ensinar.
  const distanciaBase = useMemo(() => {
    if (!cenario) return null
    const base = cacheRota.get(CALADO_MIN_DM)
    if (base) return base.distanciaNm
    const resultado = acharCaminhoDetalhado(cenario.agua, ORIGEM, DESTINO, {
      caladoM: CALADO_MIN_DM / 10,
      margemSegurancaM: MARGEM_SEGURANCA_PADRAO_M,
      profundidade: cenario.profundidade,
    })
    if (!resultado.caminho) return null
    const suave = suavizar(cenario.agua, resultado.caminho, {
      caladoM: CALADO_MIN_DM / 10,
      margemSegurancaM: MARGEM_SEGURANCA_PADRAO_M,
      profundidade: cenario.profundidade,
    })
    const calculado = { pontos: suave, distanciaNm: distanciaDaRota(suave) }
    cacheRota.set(CALADO_MIN_DM, calculado)
    return calculado.distanciaNm
  }, [cenario, cacheRota])

  const pintarCarta = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !cenario) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const { agua, profundidadePorCelula } = cenario
    const estilo = getComputedStyle(canvas)
    // Os três tons saem do bloco `.bg-meter` de `app/globals.css` — o cartucho
    // de instrumento, que é navy FIXO nos dois temas. É a regra que a onda 24
    // escreveu para `/navegar`: sobre carta é sempre a MESMA cor, não a do
    // tema do app. Uma carta que trocasse de paleta com o alternador deixaria
    // de ser instrumento e viraria decoração de página.
    const mar = lerCanais(estilo, "--meter")
    const corTerra = sobrepor(mar, lerCanais(estilo, "--meter-dim"), 0.42)
    const corRaso = sobrepor(mar, lerCanais(estilo, "--crit"), 0.5)

    // O `ImageData` é criado UMA vez e reescrito — `createImageData` a cada
    // mexida no controle aloca 420 KB por quadro só para jogar fora.
    if (!imagemRef.current || imagemRef.current.width !== agua.largura) {
      imagemRef.current = ctx.createImageData(agua.largura, agua.altura)
    }
    const px = imagemRef.current.data
    const total = agua.largura * agua.altura
    for (let i = 0; i < total; i++) {
      const cor = agua.agua[i] === 0 ? corTerra : profundidadePorCelula[i] < limiarM ? corRaso : mar
      const p = i * 4
      px[p] = cor[0]
      px[p + 1] = cor[1]
      px[p + 2] = cor[2]
      px[p + 3] = 255
    }
    ctx.putImageData(imagemRef.current, 0, 0)
  }, [cenario, limiarM])

  useEffect(() => {
    pintarCarta()
  }, [pintarCarta])

  // O tema do APP pode trocar embaixo desta peça (`components/theme-toggle.tsx`
  // escreve `data-theme` no `<html>`). O DOM se repinta sozinho; o canvas não —
  // mesmo motivo pelo qual `lib/mapa/cores-tema.ts` existe para o Mapbox. Sem
  // isto, quem alterna o tema fica com a carta pintada na paleta anterior.
  useEffect(() => {
    if (typeof MutationObserver === "undefined") return
    const observador = new MutationObserver(() => pintarCarta())
    observador.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] })
    return () => observador.disconnect()
  }, [pintarCarta])

  // Reservas iguais às dimensões reais do recorte: é este par que segura a
  // altura da caixa antes de a máscara chegar. Se divergir, o herói pula de
  // tamanho quando a carta carrega — deslocamento de layout na primeira
  // impressão, que é o pior lugar possível para ele acontecer.
  const largura = cenario?.agua.largura ?? 308
  const altura = cenario?.agua.altura ?? 343

  const paraPixel = (p: Coord): [number, number] => {
    if (!cenario) return [0, 0]
    const g = cenario.agua
    return [
      ((p.lo - g.lngMin) / (g.lngMax - g.lngMin)) * g.largura,
      ((g.latMax - p.la) / (g.latMax - g.latMin)) * g.altura,
    ]
  }

  const linha = rota.pontos?.map((p) => paraPixel(p).join(",")).join(" ") ?? ""
  const [ox, oy] = paraPixel(ORIGEM)
  const [dx, dy] = paraPixel(DESTINO)

  const desvioNm =
    rota.distanciaNm != null && distanciaBase != null ? rota.distanciaNm - distanciaBase : null

  // A FRASE QUE A PEÇA ENSINA, e ela muda de natureza conforme a resposta.
  //
  // O limiar de 0,15 M não é arbitrário e o "praticamente" também não: o A*
  // trabalha em passos octile de 100 m e a suavização por string-pulling
  // escolhe vértices diferentes conforme quais células estão bloqueadas, então
  // dois calados podem produzir caminhos essencialmente iguais com décimos de
  // milha de diferença — inclusive para MENOS. Anunciar "+0,1 M de desvio" com
  // essa origem seria vender ruído de discretização como decisão do algoritmo,
  // e afirmar "nada aqui é raso demais" seria afirmar mais do que se mediu.
  const veredito =
    rota.pontos == null
      ? `Sem passagem: nenhum caminho até lá mantém ${formatarMetros(limiarM)} m de água embaixo da quilha.`
      : desvioNm != null && desvioNm > 0.15
        ? `Para não passar no raso, a rota fica ${formatarMetros(desvioNm)} M mais longa do que a de um barco de ${formatarMetros(CALADO_MIN_DM / 10)} m.`
        : `Neste calado a rota é praticamente a mais curta que a costa permite.`

  return (
    <figure className="m-0">
      {/* `bg-meter`: o cartucho de instrumento. Ele não é escolha estética —
          é o que reimporta as luzes vivas de ok/warn/crit e o dourado da marca
          para dentro de um chão navy fixo, exatamente como `/navegar` faz. Sem
          ele, o vermelho do raso viria calibrado para ler sobre papel claro e
          sumiria no mar escuro. */}
      <div className="bg-meter relative overflow-hidden raio-painel border border-line">
        <canvas
          ref={canvasRef}
          width={largura}
          height={altura}
          aria-hidden="true"
          className="block w-full"
          // A carta é dado, não fotografia: interpolar suaviza a fronteira
          // entre água e terra e inventa uma costa intermediária que a máscara
          // não tem. Pixelado é a resolução verdadeira aparecendo.
          style={{ imageRendering: "pixelated", aspectRatio: `${largura} / ${altura}` }}
        />
        {cenario && (
          <svg
            viewBox={`0 0 ${largura} ${altura}`}
            className="absolute inset-0 h-full w-full"
            aria-hidden="true"
          >
            {linha && (
              <>
                {/* Casing por baixo da linha, como no mapa real: sobre um mar
                    escuro o dourado sozinho encosta no fundo nas curvas. */}
                <polyline points={linha} fill="none" className="stroke-meter" strokeWidth={7} strokeLinejoin="round" strokeLinecap="round" />
                <polyline points={linha} fill="none" className="stroke-accent transicao-ui" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
              </>
            )}
            <circle cx={ox} cy={oy} r={7} className="fill-meter" />
            <circle cx={ox} cy={oy} r={4.5} className="fill-ok" />
            <circle cx={dx} cy={dy} r={7} className="fill-meter" />
            <circle cx={dx} cy={dy} r={4.5} className="fill-accent" />
          </svg>
        )}
        {!cenario && !falhou && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="rotulo text-meter-dim">Lendo a malha de costa…</span>
          </div>
        )}
        {falhou && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <span className="corpo text-center text-meter-dim">
              A carta não carregou aqui. Ela abre dentro do app, em /navegar.
            </span>
          </div>
        )}

        {/* Legenda dentro da carta, como pastilha de instrumento — fora dela
            viraria mais uma linha de texto na página e perderia o vínculo com
            a mancha que explica. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-x-4 gap-y-1 p-3">
          <span className="rotulo flex items-center gap-1.5 text-meter-texto">
            <span className="size-2 shrink-0 rounded-[var(--raio-pilula)] bg-crit" />
            Fundo raso para este calado
          </span>
          <span className="rotulo flex items-center gap-1.5 text-meter-texto">
            <span className="size-2 shrink-0 rounded-[var(--raio-pilula)] bg-accent" />
            Rota calculada agora
          </span>
        </div>
      </div>

      <figcaption className="mt-4">
        <label htmlFor="calado-demo" className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="rotulo text-dim">Calado do seu barco</span>
          <span className="valor-forte font-mono-instr">
            {formatarMetros(caladoM)} m
          </span>
        </label>
        {/* `accent-[var(--acao)]`: o controle nativo pinta trilho e polegar
            pela `accent-color`, e o token é o que impede o dourado de virar
            hexadecimal escrito à mão aqui — mesmo caminho das nove caixas de
            escolha que o passe de 19/08 converteu.
            `h-11` no elemento que se toca: a régua de 44px do docs/DESIGN.md
            §5 vale para o alvo, e num `range` o alvo É o próprio input. */}
        <input
          id="calado-demo"
          type="range"
          min={CALADO_MIN_DM}
          max={CALADO_MAX_DM}
          step={CALADO_PASSO_DM}
          value={caladoDm}
          onChange={(e) => setCaladoDm(Number(e.target.value))}
          disabled={!cenario}
          aria-describedby="calado-demo-veredito"
          className="mt-2 h-11 w-full cursor-pointer accent-[var(--acao)] disabled:cursor-not-allowed disabled:opacity-45"
        />

        <p id="calado-demo-veredito" aria-live="polite" className="corpo mt-1 text-texto">
          {cenario ? veredito : "Lendo a máscara de costa e a grade de profundidade…"}
        </p>

        {/* A ficha técnica da demonstração. Densa e em mono porque é
            instrumento: são os números que sustentam tudo que a peça afirma, e
            quem quiser conferir tem onde. */}
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4 sm:grid-cols-4">
          <div>
            <dt className="rotulo-dado">Trecho</dt>
            <dd className="valor mt-0.5 font-mono-instr">
              {rota.distanciaNm != null ? `${formatarMetros(rota.distanciaNm)} M` : "—"}
            </dd>
          </div>
          <div>
            <dt className="rotulo-dado">Bloqueia abaixo de</dt>
            <dd className="valor mt-0.5 font-mono-instr">{formatarMetros(limiarM)} m</dd>
          </div>
          <div>
            <dt className="rotulo-dado">Malha da costa</dt>
            <dd className="valor mt-0.5 font-mono-instr">100 m</dd>
          </div>
          <div>
            <dt className="rotulo-dado">Célula da sonda</dt>
            <dd className="valor mt-0.5 font-mono-instr">450 m</dd>
          </div>
        </dl>

        <p className="apoio mt-3 text-dim">
          {ROTULO_ORIGEM} → {ROTULO_DESTINO}. O limite de bloqueio é o seu calado mais 1,0 m de folga —
          meio metro sob a quilha e meio metro de maré. A profundidade vem de modelo global de elevação a
          ~450 m por célula: ela evita o raso conhecido nessa resolução e não enxerga pedra isolada.
          O Commander não é auxílio à navegação.
        </p>
      </figcaption>
    </figure>
  )
}


