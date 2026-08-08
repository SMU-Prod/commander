#!/usr/bin/env node
/**
 * Gera a camada de batimetria (profundidade aproximada) do Commander, para a
 * MESMA bbox da máscara água/terra (ver scripts/gerar-mascara-agua.mjs),
 * a partir do ETOPO 2022 (NOAA/NCEI) servido via ERDDAP griddap.
 *
 * Fonte escolhida: ETOPO 2022 15 Arc-Second Global Relief Model (Ice
 * Surface), NOAA/NCEI — domínio público dos EUA ("may be used and
 * redistributed for free"), variável `z` em metros (negativo = abaixo do
 * nível do mar). Servida em oceanwatch.pifsc.noaa.gov/erddap/griddap —
 * mesma resolução (15 arc-sec, ~450 m) do GEBCO Grid, o outro candidato
 * avaliado; ETOPO foi escolhida por devolver VALORES numéricos crus via
 * griddap (formato ESRI ASCII Grid), sem precisar de um cliente WCS/WMS
 * para extrair o grid — GEBCO exigiria decodificar um raster já estilizado
 * (WMS) ou negociar WCS, mais frágil pra um script de poucas linhas.
 *   Dataset: https://oceanwatch.pifsc.noaa.gov/erddap/griddap/ETOPO_2022_v1_15s.html
 *
 * NÃO usa nenhuma fonte da Marinha do Brasil / DHN / CHM: as cartas náuticas
 * oficiais têm uso comercial restrito (precisam de acordo com a EMGEPRON) e
 * o Commander é um app pago — ver a seção "Batimetria" em docs/OPERACAO.md.
 *
 * Algoritmo:
 *   1. Baixa (ou reusa cache local) o grid ESRI ASCII de elevação/profundidade
 *      pra bbox da região (variável z, metros; negativo = água). A API do
 *      ERDDAP usa longitude em convenção 0–360, não -180..180 — o script
 *      converte antes de montar a URL.
 *   2. Classifica cada célula em terra (z ≥ 0 → totalmente transparente) ou
 *      numa das 5 faixas de profundidade (0-5, 5-10, 10-20, 20-50, >50 m),
 *      cada uma com uma cor sólida da paleta navy do produto (escuro = fundo,
 *      claro = raso).
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

// ---------------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------------

// MESMA região de scripts/gerar-mascara-agua.mjs — o circuito real dos barcos
// atendidos pelo Commander (Ilhabela/São Sebastião → Búzios).
const REGIAO = {
  lngMin: -45.75,
  latMin: -24.05,
  lngMax: -41.75,
  latMax: -22.65,
};

const DATASET_BASE = "https://oceanwatch.pifsc.noaa.gov/erddap/griddap/ETOPO_2022_v1_15s";
const FONTE =
  "ETOPO 2022 15 Arc-Second Global Relief Model (Ice Surface), NOAA/NCEI — domínio público dos EUA";
const LICENCA =
  "Domínio público (dado do governo dos EUA); NOAA pede reconhecimento da fonte por transparência, " +
  "mas não há restrição de uso comercial.";

const CACHE_DIR = path.join(ROOT, "scripts", ".cache");
const CACHE_PATH = path.join(CACHE_DIR, "batimetria.asc");

const OUT_DIR = path.join(ROOT, "web", "public", "mapa");
const OUT_PNG = path.join(OUT_DIR, "batimetria.png");
const OUT_JSON = path.join(OUT_DIR, "batimetria.json");

// Faixas de profundidade relevantes pra lancha de 40-60 pés — da mais rasa
// pra mais funda (a ORDEM importa: é a primeira faixa cuja `ateM` cobre a
// profundidade que vence). Cores da paleta navy do produto (ver
// web/app/globals.css: --fundo #0b1d2d), escuro = fundo, claro = raso.
const FAIXAS = [
  { rotulo: "0-5m", ateM: 5, cor: [127, 209, 236] },
  { rotulo: "5-10m", ateM: 10, cor: [59, 154, 199] },
  { rotulo: "10-20m", ateM: 20, cor: [27, 100, 148] },
  { rotulo: "20-50m", ateM: 50, cor: [15, 58, 92] },
  { rotulo: ">50m", ateM: Infinity, cor: [7, 21, 33] },
];
// Translúcido o bastante pra basemap/OpenSeaMap por baixo continuarem
// legíveis por cima da cor de profundidade.
const ALFA_AGUA = 210;
const ALFA_TERRA = 0; // totalmente transparente — a máscara e o mapa base já cuidam de terra

// % de "água colorida" plausível no grid final — guarda contra um download
// vazio/corrompido virar PNG sem avisar nada (mesma ideia da mascara-agua).
const WATER_MIN_PCT = 15;
const WATER_MAX_PCT = 95;

// ---------------------------------------------------------------------------
// 1. Download (ou cache) do grid ESRI ASCII
// ---------------------------------------------------------------------------

/** ERDDAP guarda longitude em convenção 0–360 (testado manualmente: uma
 *  longitude negativa direto na query devolve 404 — não há wrap automático). */
function paraLongitude360(lng) {
  return lng < 0 ? lng + 360 : lng;
}

/** @returns {Promise<{ texto: string, deCache: boolean }>} */
async function baixarGradeBatimetria(regiao) {
  if (fs.existsSync(CACHE_PATH)) {
    console.log(`Cache encontrado em ${CACHE_PATH} — reusando (sem bater no ERDDAP).`);
    return { texto: fs.readFileSync(CACHE_PATH, "utf8"), deCache: true };
  }

  const url =
    `${DATASET_BASE}.esriAscii?z%5B(${regiao.latMin}):(${regiao.latMax})%5D` +
    `%5B(${paraLongitude360(regiao.lngMin)}):(${paraLongitude360(regiao.lngMax)})%5D`;

  console.log(`Baixando batimetria do ERDDAP (grid grande — pode levar alguns minutos)...`);
  console.log(url);

  let ultimoErro;
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    try {
      const inicio = Date.now();
      const res = await fetch(url, {
        headers: {
          "User-Agent": "GEST-NAV-Commander/1.0 (script gerar-batimetria.mjs; contato atendimento.smu@gmail.com)",
          Accept: "*/*",
        },
        signal: AbortSignal.timeout(360_000),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}: ${(await res.text()).slice(0, 300)}`);
      }
      const texto = await res.text();
      const segundos = ((Date.now() - inicio) / 1000).toFixed(1);
      console.log(`ERDDAP OK em ${segundos}s (${(texto.length / 1024).toFixed(0)} KB de texto).`);

      fs.mkdirSync(CACHE_DIR, { recursive: true });
      fs.writeFileSync(CACHE_PATH, texto);
      return { texto, deCache: false };
    } catch (err) {
      console.warn(`Tentativa ${tentativa} falhou: ${err.message}`);
      ultimoErro = err;
    }
  }
  throw new Error(`Download do ERDDAP falhou após 2 tentativas. Último erro: ${ultimoErro?.message}`);
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
function corParaElevacao(z, nodata) {
  if (!Number.isFinite(z) || z === nodata) return null;
  if (z >= 0) return null; // terra — a máscara e o mapa base já cuidam disso
  const profundidadeM = -z;
  for (const faixa of FAIXAS) {
    if (profundidadeM <= faixa.ateM) return faixa.cor;
  }
  return FAIXAS[FAIXAS.length - 1].cor; // nunca deveria cair aqui (última faixa é Infinity)
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  const { texto, deCache } = await baixarGradeBatimetria(REGIAO);
  const { ncols, nrows, valores, nodata } = parseEsriAscii(texto);
  const totalCelulas = ncols * nrows;
  console.log(`Grid: ${ncols} x ${nrows} = ${totalCelulas.toLocaleString("pt-BR")} células.`);

  const png = new PNG({ width: ncols, height: nrows });
  let celulasAgua = 0;
  for (let idx = 0; idx < valores.length; idx++) {
    const cor = corParaElevacao(valores[idx], nodata);
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

  if (pctAgua < WATER_MIN_PCT || pctAgua > WATER_MAX_PCT) {
    throw new Error(
      `SANIDADE FALHOU: ${pctAgua.toFixed(2)}% de água está fora da faixa plausível [${WATER_MIN_PCT}%, ${WATER_MAX_PCT}%]. ` +
        `Provável causa: download truncado/corrompido, ou bbox errada. Não gerando PNG/JSON — investigar antes de rodar de novo.`
    );
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  await new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(OUT_PNG);
    stream.on("finish", resolve);
    stream.on("error", reject);
    png.pack().pipe(stream);
  });

  const pngKb = fs.statSync(OUT_PNG).size / 1024;

  const metadados = {
    lngMin: REGIAO.lngMin,
    latMin: REGIAO.latMin,
    lngMax: REGIAO.lngMax,
    latMax: REGIAO.latMax,
    largura: ncols,
    altura: nrows,
    faixasM: FAIXAS.map((f) => f.rotulo),
    resolucaoAprox: "~450 m (15 arc-sec)",
    geradoEm: new Date().toISOString(),
    fonte: FONTE,
    licenca: LICENCA,
  };
  fs.writeFileSync(OUT_JSON, JSON.stringify(metadados, null, 2));

  console.log("");
  console.log("=== Resumo ===");
  console.log(`Fonte: ${FONTE}${deCache ? " (via cache local)" : ""}`);
  console.log(`Dimensões finais: ${ncols} x ${nrows} px`);
  console.log(`% de água colorida: ${pctAgua.toFixed(2)}%`);
  console.log(`Tamanho do PNG: ${pngKb.toFixed(1)} KB`);
  console.log(`PNG:  ${OUT_PNG}`);
  console.log(`JSON: ${OUT_JSON}`);
}

main().catch((err) => {
  console.error("");
  console.error("ERRO:", err.message);
  process.exitCode = 1;
});
