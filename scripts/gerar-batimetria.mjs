#!/usr/bin/env node
/**
 * Gera as camadas de batimetria (profundidade aproximada) do Commander, a
 * partir do ETOPO 2022 (NOAA/NCEI) servido via ERDDAP griddap.
 *
 * Fonte escolhida: ETOPO 2022 Global Relief Model (Ice Surface), NOAA/NCEI —
 * domínio público dos EUA ("may be used and redistributed for free"),
 * variável `z` em metros (negativo = abaixo do nível do mar). Servida em
 * oceanwatch.pifsc.noaa.gov/erddap/griddap — ETOPO foi escolhida por
 * devolver VALORES numéricos crus via griddap (formato ESRI ASCII Grid),
 * sem precisar de um cliente WCS/WMS pra extrair o grid — GEBCO (o outro
 * candidato avaliado) exigiria decodificar um raster já estilizado (WMS) ou
 * negociar WCS, mais frágil pra um script de poucas linhas.
 *   Dataset base: https://oceanwatch.pifsc.noaa.gov/erddap/griddap/
 *
 * NÃO usa nenhuma fonte da Marinha do Brasil / DHN / CHM: as cartas náuticas
 * oficiais têm uso comercial restrito (precisam de acordo com a EMGEPRON) e
 * o Commander é um app pago — ver a seção "Batimetria" em docs/OPERACAO.md.
 *
 * DUAS CAMADAS (branch onda-10-mapa-completo — antes só existia a fina, e
 * afastar o zoom deixava uma mancha retangular escura sobre a região de
 * operação com o resto do oceano/costa brasileira sem nada; ver
 * docs/OPERACAO.md):
 *
 *   1. "fina" — região de operação (Ilhabela/São Sebastião → Búzios), 15
 *      arc-sec (~450 m), a mesma bbox de scripts/gerar-mascara-agua.mjs.
 *      Gradiente raso→fundo (0 até ~120 m), porque é onde a lancha realmente
 *      navega perto da costa.
 *   2. "ampla" — costa brasileira inteira + oceano adjacente, resolução bem
 *      mais grossa (2 arc-min ≈ 3,7 km — dataset de 60 arc-sec do ERDDAP
 *      reamostrado com stride 2, em vez de baixar 15 arc-sec pra essa área
 *      enorme, o que geraria dezenas de milhões de pixels). Gradiente mais
 *      fundo (0 até ~6000 m), porque mar aberto é muito mais fundo que a
 *      Baía da Ilha Grande — a MESMA paleta de 6 âncoras da camada fina, só
 *      que remapeada pra essas profundidades.
 *
 *   O componente do mapa (web/components/mapa/mapa-nautico.tsx) desenha as
 *   duas com minzoom/maxzoom complementares: a ampla aparece de longe
 *   (zoom baixo) e some quando a fina — mais precisa — já cobre a tela.
 *
 * RENDERIZAÇÃO (branch onda-10-batimetria-bonita — reescrita completa desta
 * seção; o dado-fonte/bbox/resolução acima NÃO mudou, só como ele vira
 * pixel). O desenho anterior (5 faixas de cor sólida, alfa fixo, sem
 * esmaecimento de borda) lia como "adesivo colado" — o dono comparou com um
 * PNG mascarado. Três mudanças, todas dentro de `amostrarGradiente` e
 * `fatorEsmaecimentoBorda` abaixo:
 *   1. Gradiente contínuo: cor E alfa são interpolados linearmente entre
 *      "paradas" de profundidade (não mais um degrau duro por faixa) — ver
 *      `amostrarGradiente`. As âncoras de cor são as MESMAS 5 cores da
 *      paleta antiga (reaproveitadas como marcos do gradiente, não
 *      redesenhadas), mais uma 6ª âncora funda igual a `--fundo` (#0b1d2d)
 *      de web/app/globals.css — a cor de fundo do próprio produto.
 *   2. Alfa variável: raso é mais opaco (a informação que importa pra
 *      lancha), fundo é mais transparente (contexto, deixa o mapa-base/
 *      satélite aparecer por baixo) — em vez de um bloco opaco uniforme, a
 *      camada TINGE a água.
 *   3. Esmaecimento de borda (`fatorEsmaecimentoBorda`): o alfa cai pra 0
 *      suavemente (smoothstep) nos últimos pixels de cada lado do bbox —
 *      ataca direto o sintoma "aresta reta onde a imagem acaba" que fazia a
 *      camada parecer colada por cima do mapa em vez de fazer parte dele.
 * `raster-resampling: "linear"` (não `"nearest"`) é aplicado no consumidor
 * (mapa-nautico.tsx), não aqui — é a GPU que faz a interpolação bilinear
 * entre pixels ao dar zoom, e por isso NÃO supersample-amos o PNG antes de
 * escrever (ver decisão documentada no relatório da task, seção
 * "resolução").
 *
 * Algoritmo (por camada):
 *   1. Baixa (ou reusa cache local) o grid ESRI ASCII de elevação/profundidade
 *      pra bbox da camada (variável z, metros; negativo = água). A API do
 *      ERDDAP usa longitude em convenção 0–360, não -180..180 — o script
 *      converte antes de montar a URL.
 *   2. Classifica cada célula em terra (z ≥ 0 → totalmente transparente) ou
 *      amostra o gradiente contínuo de profundidade da camada (cor + alfa),
 *      multiplicando o alfa pelo fator de esmaecimento de borda.
 *   3. Escreve PNG RGBA (pngjs) + JSON de metadados no mesmo formato de
 *      mascara-agua.json (bbox + dimensões + fonte + geradoEm).
 *
 * Uso: node scripts/gerar-batimetria.mjs   (a partir da raiz do repo)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// pngjs só existe em web/node_modules — mesmo truque de resolução de
// scripts/gerar-mascara-agua.mjs (o script mora fora da árvore do ESM de web/).
const requireFromWeb = createRequire(path.join(ROOT, "web", "package.json"));
const { PNG } = requireFromWeb("pngjs");

const CACHE_DIR = path.join(ROOT, "scripts", ".cache");
const OUT_DIR = path.join(ROOT, "web", "public", "mapa");

const ALFA_TERRA = 0; // totalmente transparente — a máscara e o mapa base já cuidam de terra

// Esmaecimento de borda (ver `fatorEsmaecimentoBorda`): largura da faixa,
// em pixels, onde o alfa cai suavemente até 0 nos 4 lados do PNG. 6% do
// menor lado da imagem, com piso e teto — pequeno o bastante pra não comer
// uma fração grande da camada "fina" (338px de altura → ~20px de piso já é
// visível o suficiente), grande o bastante pra a "ampla" (1216px) não virar
// 1 px de esmaecimento imperceptível.
const FEATHER_FRACAO = 0.06;
const FEATHER_MIN_PX = 6;
const FEATHER_MAX_PX = 48;

// Quantização leve dos canais de saída (arredonda cada canal pro múltiplo
// mais próximo). Gradiente contínuo de verdade (1 cor por valor de ponto
// flutuante) faz cada pixel diferir do vizinho, o que é ÓTIMO pro olho mas
// PÉSSIMO pro compressor PNG (deflate perde os blocos de cor repetida que a
// versão de 5 faixas sólidas comprimia de graça — medido: sem quantização
// nenhuma, a camada "fina" foi de 18,5 KB pra 90 KB e a "ampla" de 58,6 KB
// pra 639 KB). Arredondar os canais reintroduz repetição local sem
// reintroduzir degrau visível: 12/255 (~5%) e 10/255 (~4%) estão bem abaixo
// do que o olho distingue numa cor semitransparente sobre mapa-base, ainda
// mais depois do blend com satélite/OpenSeaMap por cima. Testado
// visualmente (Read no PNG) em 3 níveis — 6/4, 12/10 e 18/16 — antes de
// escolher: 18/16 já mostrava um leve terraceamento no oceano profundo
// (long-range, baixo contraste) por um ganho marginal de ~5 KB sobre 12/10;
// 12/10 ficou limpo nos 3 zooms testados e é o valor abaixo.
const QUANT_PASSO_COR = 12;
const QUANT_PASSO_ALFA = 10;

// ---------------------------------------------------------------------------
// Configuração das 2 camadas
// ---------------------------------------------------------------------------

const CAMADAS = [
  {
    id: "fina",
    // MESMA região de scripts/gerar-mascara-agua.mjs — o circuito real dos
    // barcos atendidos pelo Commander (Ilhabela/São Sebastião → Búzios).
    regiao: { lngMin: -45.75, latMin: -24.05, lngMax: -41.75, latMax: -22.65 },
    datasetBase: "https://oceanwatch.pifsc.noaa.gov/erddap/griddap/ETOPO_2022_v1_15s",
    stride: 1,
    resolucaoAprox: "~450 m (15 arc-sec)",
    fonteDataset: "ETOPO 2022 15 Arc-Second Global Relief Model (Ice Surface), NOAA/NCEI",
    // Âncoras do gradiente contínuo (profundidade crescente), relevantes pra
    // lancha de 40-60 pés — MESMAS 5 cores da paleta navy do produto que a
    // versão anterior usava como faixas sólidas (ver web/app/globals.css:
    // --fundo #0b1d2d), agora como marcos interpolados por
    // `amostrarGradiente`, não mais degraus. 6ª âncora (120 m) = --fundo
    // exato, pra dar uma cauda funda mais longa/suave em vez de platô logo
    // aos 50 m. Alfa cai de raso (mais presente — é o que importa pra
    // navegação) pra fundo (mais discreto — contexto, deixa o mapa-base
    // aparecer).
    paradas: [
      // Mesma decisão da camada ampla: a rampa MORRE na quebra da
      // plataforma em vez de virar cinza-escuro no fundo. Água funda fica
      // com o azul do mapa base; o que a camada acrescenta é o raso, que é
      // justamente o que importa pra quem tem 1,5 m de calado.
      { profundidadeM: 0, cor: [127, 209, 236], alfa: 225 },
      { profundidadeM: 5, cor: [86, 178, 219], alfa: 200 },
      { profundidadeM: 10, cor: [59, 154, 199], alfa: 170 },
      { profundidadeM: 20, cor: [38, 120, 172], alfa: 135 },
      { profundidadeM: 50, cor: [27, 100, 148], alfa: 90 },
      { profundidadeM: 150, cor: [20, 76, 118], alfa: 0 },
    ],
    cachePath: path.join(CACHE_DIR, "batimetria.asc"),
    outPng: path.join(OUT_DIR, "batimetria.png"),
    outJson: path.join(OUT_DIR, "batimetria.json"),
    // % de "água colorida" plausível no grid final — guarda contra um
    // download vazio/corrompido virar PNG sem avisar nada (mesma ideia da
    // mascara-agua). Bbox é quase só mar costeiro: água domina o grid.
    waterMinPct: 15,
    waterMaxPct: 95,
  },
  {
    id: "ampla",
    // Costa brasileira inteira (Oiapoque → Chuí) + oceano adjacente — cobre
    // as ilhas oceânicas relevantes (Fernando de Noronha, Trindade) sem
    // esticar pro Pacífico ou fundo demais na Amazônia interior. Ajustado
    // pra sumir exatamente onde a camada "fina" (região de operação) cobre.
    regiao: { lngMin: -58, latMin: -34.5, lngMax: -20, latMax: 6 },
    // Dataset de 60 arc-sec (1 arc-min) do ERDDAP, reamostrado com stride 2
    // → efetivamente 2 arc-min (~3,7 km) de resolução na saída. Baixar os 15
    // arc-sec originais pra essa bbox inteira (38° x 40,5°) geraria dezenas
    // de milhões de pixels — pedido explícito pra NÃO fazer isso.
    datasetBase: "https://oceanwatch.pifsc.noaa.gov/erddap/griddap/ETOPO_2022_v1_60s",
    stride: 2,
    resolucaoAprox: "~3,7 km (2 arc-min — ETOPO 60 arc-sec com stride 2 no ERDDAP)",
    fonteDataset: "ETOPO 2022 60 Arc-Second Global Relief Model (Ice Surface), NOAA/NCEI",
    // Âncoras DIFERENTES da camada fina: mar aberto é muito mais fundo que a
    // Baía da Ilha Grande (profundidade média do Atlântico ~3.700 m), então
    // as âncoras rasas (0, 5, 10...) da camada fina ficariam todas
    // "achatadas" numa cor só. MESMA paleta (mesmas 6 cores, claro→escuro,
    // inclusive a 6ª âncora = --fundo), remapeada pra profundidades que
    // fazem sentido vistas de longe — cauda abissal (6000 m) bem discreta
    // (alfa 55), documentado também no aviso da tela — ver mapa-nautico.tsx.
    // Para lancha de 40-60 pés, só a PLATAFORMA importa: além da quebra
    // (~200 m) o barco não vai, e pintar o abissal transformava todo o
    // Atlântico num filme cinza — feio, e ainda revelava as listras de
    // trilha de navio do ETOPO. Agora a rampa morre na quebra: azul vivo
    // colado na costa, dissolvendo no mar aberto. O oceano profundo fica
    // com o azul do próprio mapa base, que é mais bonito que qualquer
    // cinza nosso por cima.
    paradas: [
      { profundidadeM: 0, cor: [127, 209, 236], alfa: 205 },
      { profundidadeM: 20, cor: [86, 178, 219], alfa: 180 },
      { profundidadeM: 50, cor: [59, 154, 199], alfa: 150 },
      { profundidadeM: 120, cor: [38, 120, 172], alfa: 105 },
      { profundidadeM: 200, cor: [27, 100, 148], alfa: 60 },
      { profundidadeM: 400, cor: [20, 76, 118], alfa: 0 },
    ],
    cachePath: path.join(CACHE_DIR, "batimetria-ampla.asc"),
    outPng: path.join(OUT_DIR, "batimetria-ampla.png"),
    outJson: path.join(OUT_DIR, "batimetria-ampla.json"),
    // Bbox cobre uma fatia grande do território brasileiro (não só litoral),
    // então a proporção de terra é bem maior que na camada fina — faixa
    // mais larga que a da camada fina, calibrada pela % real observada.
    waterMinPct: 25,
    waterMaxPct: 75,
    // ~1,4M células nesse ERDDAP mediram ~550 KB/min de vazão real (testado
    // com curl) — bem mais lento que os 6 min que bastam pra bbox pequena
    // da camada fina. 30 min de prazo, 1 tentativa só (a lentidão aqui é
    // vazão baixa e constante, não falha transitória — repetir não ajuda).
    timeoutMs: 30 * 60_000,
    tentativas: 1,
  },
];

const LICENCA =
  "Domínio público (dado do governo dos EUA); NOAA pede reconhecimento da fonte por transparência, " +
  "mas não há restrição de uso comercial.";

// ---------------------------------------------------------------------------
// 1. Download (ou cache) do grid ESRI ASCII
// ---------------------------------------------------------------------------

/** ERDDAP guarda longitude em convenção 0–360 (testado manualmente: uma
 *  longitude negativa direto na query devolve 404 — não há wrap automático). */
function paraLongitude360(lng) {
  return lng < 0 ? lng + 360 : lng;
}

/** Monta o segmento `[(min):stride:(max)]` de uma dimensão da query griddap.
 *  Sem stride (ou stride 1) omite o meio, igual à sintaxe original deste
 *  script antes da camada "ampla" existir. */
function segmentoGriddap(min, max, stride) {
  return stride && stride > 1 ? `(${min}):${stride}:(${max})` : `(${min}):(${max})`;
}

/** @returns {Promise<{ texto: string, deCache: boolean }>} */
async function baixarGradeBatimetria(camada) {
  const { regiao, datasetBase, stride, cachePath } = camada;
  // A camada "ampla" (~1,4M células) mediu ~550 KB/min de vazão real nesse
  // ERDDAP (testado manualmente com curl) — bem mais lento que o suficiente
  // pros 6 min/2 tentativas que bastavam pra camada "fina" (bbox pequena).
  // Timeout e nº de tentativas ficam configuráveis por camada por causa
  // disso: pra download grande e lento (não uma falha transitória — o dado
  // chega, só devagar), uma tentativa só com prazo generoso é melhor que
  // 2 tentativas curtas que nunca terminam.
  const timeoutMs = camada.timeoutMs ?? 360_000;
  const tentativasMax = camada.tentativas ?? 2;

  if (fs.existsSync(cachePath)) {
    console.log(`Cache encontrado em ${cachePath} — reusando (sem bater no ERDDAP).`);
    return { texto: fs.readFileSync(cachePath, "utf8"), deCache: true };
  }

  const url =
    `${datasetBase}.esriAscii?z%5B${segmentoGriddap(regiao.latMin, regiao.latMax, stride)}%5D` +
    `%5B${segmentoGriddap(paraLongitude360(regiao.lngMin), paraLongitude360(regiao.lngMax), stride)}%5D`;

  console.log(
    `Baixando batimetria (${camada.id}) do ERDDAP — pode levar até ${(timeoutMs / 60_000).toFixed(0)} min...`
  );
  console.log(url);

  let ultimoErro;
  for (let tentativa = 1; tentativa <= tentativasMax; tentativa++) {
    try {
      const inicio = Date.now();
      const res = await fetch(url, {
        headers: {
          "User-Agent": "GEST-NAV-Commander/1.0 (script gerar-batimetria.mjs; contato atendimento.smu@gmail.com)",
          Accept: "*/*",
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}: ${(await res.text()).slice(0, 300)}`);
      }
      const texto = await res.text();
      const segundos = ((Date.now() - inicio) / 1000).toFixed(1);
      console.log(`ERDDAP OK em ${segundos}s (${(texto.length / 1024).toFixed(0)} KB de texto).`);

      fs.mkdirSync(CACHE_DIR, { recursive: true });
      fs.writeFileSync(cachePath, texto);
      return { texto, deCache: false };
    } catch (err) {
      console.warn(`Tentativa ${tentativa} falhou: ${err.message}`);
      ultimoErro = err;
    }
  }
  throw new Error(`Download do ERDDAP falhou após ${tentativasMax} tentativa(s). Último erro: ${ultimoErro?.message}`);
}

// ---------------------------------------------------------------------------
// 2. Parser do formato ESRI ASCII Grid
// ---------------------------------------------------------------------------

const CHAVES_CABECALHO = new Set([
  "ncols",
  "nrows",
  "xllcenter",
  "xllcorner",
  "yllcenter",
  "yllcorner",
  "cellsize",
  "nodata_value",
]);

/** Formato ESRI ASCII Grid: 6 linhas de cabeçalho `chave valor`, seguidas do
 *  grid de números (nrows linhas, ncols valores cada, NORTE→SUL — confirmado
 *  manualmente contra o dataset: a primeira linha de dados bate com a
 *  latitude mais ao norte pedida). Mesma orientação que
 *  scripts/gerar-mascara-agua.mjs usa pra mascara-agua.png (row 0 = norte). */
function parseEsriAscii(texto) {
  const linhas = texto.split("\n");
  const cabecalho = {};
  let i = 0;
  for (; i < linhas.length; i++) {
    const linha = linhas[i].trim();
    if (!linha) continue;
    const partes = linha.split(/\s+/);
    const chave = partes[0]?.toLowerCase();
    if (partes.length === 2 && CHAVES_CABECALHO.has(chave)) {
      cabecalho[chave] = Number(partes[1]);
      continue;
    }
    break; // primeira linha que não é cabeçalho = início dos dados
  }

  const ncols = cabecalho.ncols;
  const nrows = cabecalho.nrows;
  if (!Number.isFinite(ncols) || !Number.isFinite(nrows)) {
    throw new Error("Cabeçalho ESRI ASCII inválido — ncols/nrows ausentes ou não numéricos.");
  }

  const valores = new Float32Array(ncols * nrows);
  let idx = 0;
  for (; i < linhas.length && idx < valores.length; i++) {
    const linha = linhas[i].trim();
    if (!linha) continue;
    for (const tok of linha.split(/\s+/)) {
      if (tok === "") continue;
      valores[idx++] = Number(tok);
    }
  }
  if (idx !== valores.length) {
    throw new Error(
      `Grid ESRI ASCII incompleto: esperava ${valores.length.toLocaleString("pt-BR")} valores (${ncols}x${nrows}), recebeu ${idx.toLocaleString("pt-BR")}.`
    );
  }

  return { ncols, nrows, valores, nodata: cabecalho.nodata_value };
}

// ---------------------------------------------------------------------------
// 3. Colorização — gradiente contínuo + alfa variável + esmaecimento de borda
// ---------------------------------------------------------------------------

function interpolarLinear(a, b, t) {
  return a + (b - a) * t;
}

/** Amostra o gradiente de `paradas` (array ordenado por `profundidadeM`
 *  crescente) numa profundidade qualquer, interpolando linearmente cor E
 *  alfa entre as 2 paradas vizinhas — é isso que troca os degraus duros por
 *  uma rampa suave, sem serrilhado de banda. Fora dos extremos, satura no
 *  valor da parada mais próxima (não extrapola: mais raso que a 1ª parada
 *  vira a cor/alfa dela; mais fundo que a última idem). */
function amostrarGradiente(profundidadeM, paradas) {
  const primeira = paradas[0];
  if (profundidadeM <= primeira.profundidadeM) return { cor: primeira.cor, alfa: primeira.alfa };
  const ultima = paradas[paradas.length - 1];
  if (profundidadeM >= ultima.profundidadeM) return { cor: ultima.cor, alfa: ultima.alfa };
  for (let i = 0; i < paradas.length - 1; i++) {
    const p0 = paradas[i];
    const p1 = paradas[i + 1];
    if (profundidadeM < p1.profundidadeM) {
      const t = (profundidadeM - p0.profundidadeM) / (p1.profundidadeM - p0.profundidadeM);
      return {
        cor: [
          interpolarLinear(p0.cor[0], p1.cor[0], t),
          interpolarLinear(p0.cor[1], p1.cor[1], t),
          interpolarLinear(p0.cor[2], p1.cor[2], t),
        ],
        alfa: interpolarLinear(p0.alfa, p1.alfa, t),
      };
    }
  }
  return { cor: ultima.cor, alfa: ultima.alfa }; // nunca deveria cair aqui (loop acima cobre tudo < última parada)
}

/** @returns {{ cor: [number, number, number], alfa: number } | null} null pra terra/sem-dado (transparente) */
function amostraParaElevacao(z, nodata, paradas) {
  if (!Number.isFinite(z) || z === nodata) return null;
  if (z >= 0) return null; // terra — a máscara e o mapa base já cuidam disso
  return amostrarGradiente(-z, paradas);
}

/** smoothstep clássico: ease-in/ease-out entre `low` e `high`, sem quina na
 *  derivada nas pontas (ao contrário de um lerp linear) — usado tanto pro
 *  esmaecimento de borda quanto poderia ser reusado em qualquer outra rampa
 *  que precise "começar e terminar devagar". */
function suavizarBorda(low, high, x) {
  const t = Math.min(1, Math.max(0, (x - low) / (high - low)));
  return t * t * (3 - 2 * t);
}

/** Fator [0,1] pra esmaecer a borda retangular do PNG: 1.0 no miolo, caindo
 *  suavemente pra 0.0 exatamente no último pixel de cada lado. É o remédio
 *  pro sintoma "PNG colado" — sem isso a imagem tem uma aresta reta onde a
 *  cor simplesmente para (visível toda vez que o usuário navega até a borda
 *  do bbox); multiplicando o alfa por este fator, a cor dissolve no mapa
 *  antes de chegar na borda, em vez de cortar. Mesma largura nos 4 lados —
 *  a distância até a borda mais próxima já lida bem com imagens não
 *  quadradas. */
function fatorEsmaecimentoBorda(col, row, ncols, nrows, larguraPx) {
  if (larguraPx <= 0) return 1;
  const distMinima = Math.min(col, ncols - 1 - col, row, nrows - 1 - row);
  return suavizarBorda(0, larguraPx, distMinima);
}

// ---------------------------------------------------------------------------
// Geração de uma camada
// ---------------------------------------------------------------------------

async function gerarCamada(camada) {
  console.log("");
  console.log(`=== Camada "${camada.id}" ===`);

  const { texto, deCache } = await baixarGradeBatimetria(camada);
  const { ncols, nrows, valores, nodata } = parseEsriAscii(texto);
  const totalCelulas = ncols * nrows;
  console.log(`Grid: ${ncols} x ${nrows} = ${totalCelulas.toLocaleString("pt-BR")} células.`);

  const larguraFeatherPx = Math.min(
    FEATHER_MAX_PX,
    Math.max(FEATHER_MIN_PX, Math.round(Math.min(ncols, nrows) * FEATHER_FRACAO))
  );
  console.log(
    `Esmaecimento de borda: ${larguraFeatherPx}px (${(FEATHER_FRACAO * 100).toFixed(0)}% do menor lado, piso ${FEATHER_MIN_PX}px, teto ${FEATHER_MAX_PX}px).`
  );

  // deflateStrategy 1 = Z_FILTERED (zlib), pensada exatamente pra dados de
  // imagem já passados pelo filtro por-linha do PNG (deltas pequenos perto
  // de zero) — o padrão do pngjs é 3 (Z_RLE, só repetição literal), pior
  // pra gradiente. Medido: ~30% menor só com essa troca, antes até da
  // quantização acima.
  const png = new PNG({ width: ncols, height: nrows, deflateStrategy: 1 });
  let celulasAgua = 0;
  for (let idx = 0; idx < valores.length; idx++) {
    const amostra = amostraParaElevacao(valores[idx], nodata, camada.paradas);
    const o = idx * 4;
    if (amostra) {
      const row = Math.floor(idx / ncols);
      const col = idx % ncols;
      const fatorBorda = fatorEsmaecimentoBorda(col, row, ncols, nrows, larguraFeatherPx);
      png.data[o] = Math.round(amostra.cor[0] / QUANT_PASSO_COR) * QUANT_PASSO_COR;
      png.data[o + 1] = Math.round(amostra.cor[1] / QUANT_PASSO_COR) * QUANT_PASSO_COR;
      png.data[o + 2] = Math.round(amostra.cor[2] / QUANT_PASSO_COR) * QUANT_PASSO_COR;
      png.data[o + 3] = Math.round((amostra.alfa * fatorBorda) / QUANT_PASSO_ALFA) * QUANT_PASSO_ALFA;
      celulasAgua++;
    } else {
      png.data[o] = 0;
      png.data[o + 1] = 0;
      png.data[o + 2] = 0;
      png.data[o + 3] = ALFA_TERRA;
    }
  }

  const pctAgua = (100 * celulasAgua) / totalCelulas;
  console.log(`Água colorida (profundidade): ${pctAgua.toFixed(2)}% do grid.`);

  if (pctAgua < camada.waterMinPct || pctAgua > camada.waterMaxPct) {
    throw new Error(
      `SANIDADE FALHOU (camada "${camada.id}"): ${pctAgua.toFixed(2)}% de água está fora da faixa plausível ` +
        `[${camada.waterMinPct}%, ${camada.waterMaxPct}%]. Provável causa: download truncado/corrompido, ou bbox ` +
        `errada. Não gerando PNG/JSON — investigar antes de rodar de novo.`
    );
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  await new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(camada.outPng);
    stream.on("finish", resolve);
    stream.on("error", reject);
    png.pack().pipe(stream);
  });

  const pngKb = fs.statSync(camada.outPng).size / 1024;

  const metadados = {
    lngMin: camada.regiao.lngMin,
    latMin: camada.regiao.latMin,
    lngMax: camada.regiao.lngMax,
    latMax: camada.regiao.latMax,
    largura: ncols,
    altura: nrows,
    renderizacao: "gradiente continuo (cor+alfa interpolados), esmaecimento de borda nos 4 lados",
    paradasM: camada.paradas.map((p) => `${p.profundidadeM}m`),
    featherPx: larguraFeatherPx,
    resolucaoAprox: camada.resolucaoAprox,
    geradoEm: new Date().toISOString(),
    fonte: `${camada.fonteDataset} — domínio público dos EUA`,
    licenca: LICENCA,
  };
  fs.writeFileSync(camada.outJson, JSON.stringify(metadados, null, 2));

  console.log(`Fonte: ${camada.fonteDataset}${deCache ? " (via cache local)" : ""}`);
  console.log(`Dimensões finais: ${ncols} x ${nrows} px`);
  console.log(`% de água colorida: ${pctAgua.toFixed(2)}%`);
  console.log(`Tamanho do PNG: ${pngKb.toFixed(1)} KB`);
  console.log(`PNG:  ${camada.outPng}`);
  console.log(`JSON: ${camada.outJson}`);

  return { id: camada.id, pngKb, ncols, nrows, pctAgua };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  const resumos = [];
  // Sequencial (não Promise.all) de propósito: são downloads grandes contra
  // o mesmo servidor ERDDAP, e os logs intercalados de 2 downloads em
  // paralelo ficam ilegíveis.
  for (const camada of CAMADAS) {
    resumos.push(await gerarCamada(camada));
  }

  console.log("");
  console.log("=== Resumo geral ===");
  for (const r of resumos) {
    console.log(`${r.id}: ${r.ncols}x${r.nrows}px, ${r.pngKb.toFixed(1)} KB, ${r.pctAgua.toFixed(1)}% água.`);
  }
}

main().catch((err) => {
  console.error("");
  console.error("ERRO:", err.message);
  process.exitCode = 1;
});
