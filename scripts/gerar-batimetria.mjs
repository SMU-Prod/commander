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
 *      Faixas rasas (0-5 até >50 m), porque é onde a lancha realmente
 *      navega perto da costa. INALTERADA da versão anterior deste script.
 *   2. "ampla" — costa brasileira inteira + oceano adjacente, resolução bem
 *      mais grossa (2 arc-min ≈ 3,7 km — dataset de 60 arc-sec do ERDDAP
 *      reamostrado com stride 2, em vez de baixar 15 arc-sec pra essa área
 *      enorme, o que geraria dezenas de milhões de pixels). Faixas mais
 *      profundas (0-50 até >3000 m), porque mar aberto é muito mais fundo
 *      que a Baía da Ilha Grande — a mesma paleta de 5 cores da camada fina,
 *      só que remapeada pra essas profundidades.
 *
 *   O componente do mapa (web/components/mapa/mapa-nautico.tsx) desenha as
 *   duas com minzoom/maxzoom complementares: a ampla aparece de longe
 *   (zoom baixo) e some quando a fina — mais precisa — já cobre a tela.
 *
 * Algoritmo (por camada):
 *   1. Baixa (ou reusa cache local) o grid ESRI ASCII de elevação/profundidade
 *      pra bbox da camada (variável z, metros; negativo = água). A API do
 *      ERDDAP usa longitude em convenção 0–360, não -180..180 — o script
 *      converte antes de montar a URL.
 *   2. Classifica cada célula em terra (z ≥ 0 → totalmente transparente) ou
 *      numa das 5 faixas de profundidade da camada, cada uma com uma cor
 *      sólida da paleta navy do produto (escuro = fundo, claro = raso).
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

// Translúcido o bastante pra basemap/OpenSeaMap por baixo continuarem
// legíveis por cima da cor de profundidade — mesmo valor nas duas camadas,
// é sobre legibilidade do mapa base, não sobre a fonte do dado.
const ALFA_AGUA = 210;
const ALFA_TERRA = 0; // totalmente transparente — a máscara e o mapa base já cuidam de terra

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
    // Faixas de profundidade relevantes pra lancha de 40-60 pés — da mais
    // rasa pra mais funda (a ORDEM importa: é a primeira faixa cuja `ateM`
    // cobre a profundidade que vence). Cores da paleta navy do produto (ver
    // web/app/globals.css: --fundo #0b1d2d), escuro = fundo, claro = raso.
    faixas: [
      { rotulo: "0-5m", ateM: 5, cor: [127, 209, 236] },
      { rotulo: "5-10m", ateM: 10, cor: [59, 154, 199] },
      { rotulo: "10-20m", ateM: 20, cor: [27, 100, 148] },
      { rotulo: "20-50m", ateM: 50, cor: [15, 58, 92] },
      { rotulo: ">50m", ateM: Infinity, cor: [7, 21, 33] },
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
    // Faixas DIFERENTES da camada fina: mar aberto é muito mais fundo que a
    // Baía da Ilha Grande (profundidade média do Atlântico ~3.700 m), então
    // as faixas rasas (0-5, 5-10...) da camada fina ficariam todas
    // "achatadas" numa cor só. Mesma paleta (mesmas 5 cores, claro→escuro),
    // remapeada pra profundidades que fazem sentido vistas de longe.
    // Documentado também no aviso da tela — ver mapa-nautico.tsx.
    faixas: [
      { rotulo: "0-50m", ateM: 50, cor: [127, 209, 236] },
      { rotulo: "50-200m", ateM: 200, cor: [59, 154, 199] },
      { rotulo: "200-1000m", ateM: 1000, cor: [27, 100, 148] },
      { rotulo: "1000-3000m", ateM: 3000, cor: [15, 58, 92] },
      { rotulo: ">3000m", ateM: Infinity, cor: [7, 21, 33] },
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
// 3. Colorização
// ---------------------------------------------------------------------------

/** @returns {[number, number, number] | null} cor RGB, ou null pra terra/sem-dado (transparente) */
function corParaElevacao(z, nodata, faixas) {
  if (!Number.isFinite(z) || z === nodata) return null;
  if (z >= 0) return null; // terra — a máscara e o mapa base já cuidam disso
  const profundidadeM = -z;
  for (const faixa of faixas) {
    if (profundidadeM <= faixa.ateM) return faixa.cor;
  }
  return faixas[faixas.length - 1].cor; // nunca deveria cair aqui (última faixa é Infinity)
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

  const png = new PNG({ width: ncols, height: nrows });
  let celulasAgua = 0;
  for (let idx = 0; idx < valores.length; idx++) {
    const cor = corParaElevacao(valores[idx], nodata, camada.faixas);
    const o = idx * 4;
    if (cor) {
      png.data[o] = cor[0];
      png.data[o + 1] = cor[1];
      png.data[o + 2] = cor[2];
      png.data[o + 3] = ALFA_AGUA;
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
    faixasM: camada.faixas.map((f) => f.rotulo),
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
