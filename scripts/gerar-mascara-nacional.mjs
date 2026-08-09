#!/usr/bin/env node
/**
 * Gera a máscara água/terra NACIONAL (grossa) — costa brasileira inteira,
 * pra estender a rota marítima pra fora do circuito Ilhabela↔Búzios que
 * `scripts/gerar-mascara-agua.mjs` cobre em 100 m/célula.
 *
 * Por que NÃO é a mesma técnica da máscara fina (linha de costa OSM via
 * Overpass, flood fill, rasterização): a costa brasileira inteira nessa
 * fonte geraria uma query pesada demais pro Overpass, e o dado fino de
 * OSM não faz diferença nessa escala — em 1-4 km/célula, o traçado exato
 * de cada reentrância de praia se perde de qualquer jeito.
 *
 * Em vez disso, DERIVA de elevação: `scripts/gerar-batimetria.mjs` já baixa
 * o ETOPO 2022 (NOAA/NCEI, via ERDDAP) pra cobrir a costa brasileira +
 * oceano adjacente na camada "ampla" (bbox `lngMin -58, latMin -34.5,
 * lngMax -20, latMax 6`, dataset `ETOPO_2022_v1_60s` com stride 2) — e
 * mantém esse download em cache local (`scripts/.cache/batimetria-ampla.asc`,
 * ~1,39 M células, já baixado na onda 10). Elevação (`z`) é o mesmo dado que
 * decide profundidade: `z >= 0` é terra, `z < 0` é água. Este script
 * REAPROVEITA literalmente esse pipeline — importa `baixarGradeBatimetria` +
 * `parseEsriAscii` de gerar-batimetria.mjs e aponta pro MESMO cachePath — não
 * baixa nada de novo, só reclassifica o grid que já existe em disco.
 *
 * Resolução resultante: ~3,7 km/célula (a mesma da camada "ampla" de
 * batimetria) — mais grossa que os "~1 km" inicialmente cogitados, decisão
 * documentada em docs/OPERACAO.md § Máscara nacional: baixar uma grade mais
 * fina (ex.: stride 1 no dataset de 60 arc-sec, ~1,85 km) exigiria um NOVO
 * download de ~4× o volume já cacheado — não há motivo pra pagar esse custo
 * (tempo de download) quando o resultado já cabe com folga no orçamento de
 * PNG (~800 KB) e de memória do A* pro trecho recortado (ver
 * `recortarGrade` em web/lib/domain/rota.ts).
 *
 * Algoritmo:
 *   1. Reusa (ou baixa, se o cache não existir) o grid ESRI ASCII de
 *      elevação via `baixarGradeBatimetria` (mesma função de
 *      gerar-batimetria.mjs).
 *   2. Classifica cada célula: `z < 0` (e não-nodata) → água; senão → terra.
 *      Sem flood fill/poda de bolsões aqui: ao contrário da máscara fina
 *      (que rasteriza uma LINHA de costa vetorial e pode deixar vazamentos/
 *      bolsões artificiais do próprio algoritmo de fill), cada célula desta
 *      máscara é classificada de forma independente a partir do valor de
 *      elevação — não há passo de preenchimento que possa "vazar".
 *   3. Dilata a terra em MARGEM_CELULAS_TERRA células (8-conectado, mesmo
 *      algoritmo do passo 5 de gerar-mascara-agua.mjs) — MESMA contagem de
 *      células da máscara fina (2), o que já dá uma margem física
 *      proporcionalmente maior aqui (célula maior ⇒ margem maior), coerente
 *      com o aviso da tela ("grade mais grossa, margem maior").
 *   4. Checagem de sanidade (% de água dentro de uma faixa plausível).
 *   5. Escreve o PNG (grayscale 8 bits: 255 = água, 0 = terra, MESMO formato
 *      de mascara-agua.png) + o JSON de metadados (mesmo formato de
 *      mascara-agua.json, pra `web/lib/mapa/mascara.ts` decodificar com o
 *      mesmo código).
 *
 * Uso: node scripts/gerar-mascara-nacional.mjs   (a partir da raiz do repo)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { baixarGradeBatimetria, parseEsriAscii } from "./gerar-batimetria.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const requireFromWeb = createRequire(path.join(ROOT, "web", "package.json"));
const { PNG } = requireFromWeb("pngjs");

const CACHE_DIR = path.join(ROOT, "scripts", ".cache");
const OUT_DIR = path.join(ROOT, "web", "public", "mapa");
const OUT_PNG = path.join(OUT_DIR, "mascara-nacional.png");
const OUT_JSON = path.join(OUT_DIR, "mascara-nacional.json");

// MESMA bbox + dataset + stride da camada "ampla" em scripts/gerar-batimetria.mjs
// — e MESMO cachePath: se o cache já existe (baixado na onda 10 pra batimetria),
// este script reusa sem bater no ERDDAP de novo.
const CAMADA = {
  regiao: { lngMin: -58, latMin: -34.5, lngMax: -20, latMax: 6 },
  datasetBase: "https://oceanwatch.pifsc.noaa.gov/erddap/griddap/ETOPO_2022_v1_60s",
  stride: 2,
  cachePath: path.join(CACHE_DIR, "batimetria-ampla.asc"),
  timeoutMs: 30 * 60_000,
  tentativas: 1,
};

// MESMA contagem de células de dilatação que a máscara fina (MARGEM_CELULAS_TERRA
// em gerar-mascara-agua.mjs) — proporcional à resolução nova porque a célula é
// ~37× maior (3,7 km vs 100 m): 2 células aqui equivalem a ~7,4 km de margem
// física, contra 200 m na fina. Documentado no aviso da tela (rota.worker.ts /
// navegar-mapa.tsx): rota pela grade nacional tem margem de segurança maior.
const MARGEM_CELULAS_TERRA = 2;

const WATER_MIN_PCT = 25;
const WATER_MAX_PCT = 75;

function dilatarTerra(isAgua, largura, altura, passadas) {
  let atual = isAgua;
  for (let passada = 0; passada < passadas; passada++) {
    const origem = atual;
    const destino = new Uint8Array(origem);
    for (let r = 0; r < altura; r++) {
      for (let c = 0; c < largura; c++) {
        const idx = r * largura + c;
        if (origem[idx] !== 1) continue;
        let tocaTerra = false;
        for (let dr = -1; dr <= 1 && !tocaTerra; dr++) {
          const nr = r + dr;
          if (nr < 0 || nr >= altura) continue;
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nc = c + dc;
            if (nc < 0 || nc >= largura) continue;
            if (origem[nr * largura + nc] === 0) {
              tocaTerra = true;
              break;
            }
          }
        }
        if (tocaTerra) destino[idx] = 0;
      }
    }
    atual = destino;
  }
  return atual;
}

async function main() {
  const { texto, deCache } = await baixarGradeBatimetria(CAMADA);
  const { ncols, nrows, valores, nodata } = parseEsriAscii(texto);
  const totalCelulas = ncols * nrows;
  console.log(`Grid de elevação: ${ncols} x ${nrows} = ${totalCelulas.toLocaleString("pt-BR")} células.`);
  console.log(`Fonte do grid: ${deCache ? "cache local (sem novo download)" : "ERDDAP (baixado agora)"}.`);

  // --- classificação: z < 0 (e não-nodata) = água; senão = terra ---
  let isAgua = new Uint8Array(totalCelulas);
  for (let i = 0; i < valores.length; i++) {
    const z = valores[i];
    isAgua[i] = Number.isFinite(z) && z !== nodata && z < 0 ? 1 : 0;
  }
  const aguaPreDilatacao = isAgua.reduce((acc, v) => acc + v, 0);
  console.log(
    `Água (pré-dilatação, direto da elevação): ${((100 * aguaPreDilatacao) / totalCelulas).toFixed(2)}%.`
  );

  // --- dilatação de segurança da costa (mesmo algoritmo de gerar-mascara-agua.mjs) ---
  isAgua = dilatarTerra(isAgua, ncols, nrows, MARGEM_CELULAS_TERRA);

  let celulasAgua = 0;
  for (let i = 0; i < isAgua.length; i++) celulasAgua += isAgua[i];
  const pctAgua = (100 * celulasAgua) / isAgua.length;
  console.log(`Água navegável (pós-dilatação de ${MARGEM_CELULAS_TERRA} células): ${pctAgua.toFixed(2)}%.`);

  if (pctAgua < WATER_MIN_PCT || pctAgua > WATER_MAX_PCT) {
    throw new Error(
      `SANIDADE FALHOU: ${pctAgua.toFixed(2)}% de água está fora da faixa plausível [${WATER_MIN_PCT}%, ${WATER_MAX_PCT}%]. ` +
        `Provável causa: cache corrompido/truncado, ou bbox errada. Não gerando PNG/JSON — investigar antes de rodar de novo.`
    );
  }

  // --- resolução aproximada em metros, só pra metadados (raio de snap etc.) ---
  // cellsize é uniforme em GRAUS (mesmo delta em lat e lng) — a conversão pra
  // metros varia com a latitude (longitude "encolhe" perto dos polos); usa a
  // latitude média da região só pra um número único e razoável.
  const cellsizeGraus = (CAMADA.regiao.lngMax - CAMADA.regiao.lngMin) / ncols;
  const latMedia = (CAMADA.regiao.latMin + CAMADA.regiao.latMax) / 2;
  const metrosPorGrauLat = 110540;
  const metrosPorGrauLng = 111320 * Math.cos((latMedia * Math.PI) / 180);
  const metrosPorCelula = Math.round(((cellsizeGraus * metrosPorGrauLat + cellsizeGraus * metrosPorGrauLng) / 2));

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const png = new PNG({ width: ncols, height: nrows, colorType: 0, bitDepth: 8 });
  for (let i = 0; i < isAgua.length; i++) {
    const v = isAgua[i] ? 255 : 0;
    const o = i * 4;
    png.data[o] = v;
    png.data[o + 1] = v;
    png.data[o + 2] = v;
    png.data[o + 3] = 255;
  }

  await new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(OUT_PNG);
    stream.on("finish", resolve);
    stream.on("error", reject);
    png.pack().pipe(stream);
  });

  const pngKb = fs.statSync(OUT_PNG).size / 1024;

  const metadados = {
    lngMin: CAMADA.regiao.lngMin,
    latMin: CAMADA.regiao.latMin,
    lngMax: CAMADA.regiao.lngMax,
    latMax: CAMADA.regiao.latMax,
    largura: ncols,
    altura: nrows,
    metrosPorCelula,
    margemCelulas: MARGEM_CELULAS_TERRA,
    geradoEm: new Date().toISOString(),
    fonte:
      "ETOPO 2022 60 Arc-Second Global Relief Model (Ice Surface), NOAA/NCEI, via ERDDAP — domínio público dos EUA. " +
      "Água/terra derivadas de elevação (z<0 = água), não de linha de costa vetorial.",
  };
  fs.writeFileSync(OUT_JSON, JSON.stringify(metadados, null, 2));

  console.log("");
  console.log("=== Resumo ===");
  console.log(`Dimensões finais: ${ncols} x ${nrows} px`);
  console.log(`Resolução aproximada: ~${metrosPorCelula} m/célula`);
  console.log(`% de água navegável: ${pctAgua.toFixed(2)}%`);
  console.log(`Tamanho do PNG: ${pngKb.toFixed(1)} KB`);
  console.log(`PNG:  ${OUT_PNG}`);
  console.log(`JSON: ${OUT_JSON}`);
  if (pngKb > 800) {
    console.warn(
      `AVISO: PNG passou de ~800 KB (${pngKb.toFixed(1)} KB) — considere engrossar a resolução (stride maior).`
    );
  }
}

main().catch((err) => {
  console.error("");
  console.error("ERRO:", err.message);
  process.exitCode = 1;
});
