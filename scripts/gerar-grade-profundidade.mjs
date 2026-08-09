#!/usr/bin/env node
/**
 * Gera a GRADE DE PROFUNDIDADE (não a camada visual de batimetria — ver
 * scripts/gerar-batimetria.mjs) usada pelo A* pra rotear respeitando o
 * calado do barco (onda 12 — "rota por calado" / Auto Guidance do Navionics).
 *
 * Diferença pro PNG visual: `gerar-batimetria.mjs` produz um PNG RGBA
 * pensado pra OLHO HUMANO (gradiente contínuo de cor+alfa, quantizado pra
 * comprimir bem, com esmaecimento de borda) — não dá pra recuperar a
 * profundidade exata de volta a partir dele. Este script produz um PNG
 * GRAYSCALE onde cada pixel é um valor NUMÉRICO decodificável: o roteador
 * (web/lib/domain/rota.ts) lê esse valor pra decidir se uma célula é rasa
 * demais pro calado do barco.
 *
 * CODIFICAÇÃO (documentada aqui e espelhada no decoder em
 * web/lib/mapa/mascara.ts):
 *   - byte 0            = terra ou sem dado (z >= 0, ou nodata do ERDDAP)
 *   - byte 1..255       = piso (lower bound) da profundidade, em "buckets"
 *                          de `passoM` metros: profundidadeM = (byte - 1) * passoM
 *   - byte 255 satura    = "pelo menos 254 * passoM metros" (fundo o
 *                          suficiente pra qualquer calado de lancha; não
 *                          precisamos distinguir 300 m de 3000 m pra decidir
 *                          se o barco passa)
 *
 * Por que PISO (não arredondamento pro mais próximo nem teto): profundidade
 * real dentro de um bucket é desconhecida — arredondar pra baixo é a escolha
 * conservadora (mesma filosofia do resto do produto: nunca inventar dado
 * otimista). Um bucket [1.00m, 1.25m) decodifica como 1.00m, nunca 1.25m —
 * o pior caso dentro do bucket, não o melhor.
 *
 * DUAS COBERTURAS, MESMA BBOX/DATASET/CACHE de gerar-batimetria.mjs — reusa
 * literalmente `baixarGradeBatimetria`+`parseEsriAscii` (exportadas de lá) e
 * aponta pros MESMOS cachePaths já baixados nas ondas 6/10/11
 * (scripts/.cache/batimetria.asc, scripts/.cache/batimetria-ampla.asc) —
 * ZERO download novo:
 *
 *   - "fina": região de operação (Ilhabela/São Sebastião → Búzios), ETOPO 15
 *     arc-sec (~450 m/célula). `passoM = 0.25` — resolução de 25 cm no
 *     bucket, relevante pra distinguir calados típicos de lancha (1-3 m)
 *     com folga. Cobre profundidades codificadas até 63,5 m antes de saturar
 *     (mais que suficiente: nenhum calado de lancha bloqueia acima disso).
 *   - "nacional": costa brasileira inteira, ETOPO 60 arc-sec stride 2
 *     (~3,6 km/célula). `passoM = 4` — célula já é 8000x maior em área que a
 *     fina, granularidade de profundidade fina não faz sentido aqui (o erro
 *     de amostragem espacial domina). Cobre até 1016 m antes de saturar.
 *
 * HONESTIDADE (documentada de novo aqui, ecoando o pedido da task): mesmo
 * com a codificação sendo conservadora (piso do bucket, nunca otimista),
 * ETOPO tem ~450 m (fina) / ~3,6 km (nacional) de resolução ESPACIAL — uma
 * pedra isolada, um banco de areia ou um recife menor que a célula NÃO
 * aparece no dado: a elevação da célula é uma MÉDIA da área, então um baixio
 * pontual pode estar escondido dentro de uma célula que a média classifica
 * como "funda o bastante". A grade evita áreas rasas CONHECIDAS na
 * resolução do dado — não garante profundidade. O texto da tela (ver
 * web/components/mapa/navegar-mapa.tsx) tem que deixar isso explícito.
 *
 * Uso: node scripts/gerar-grade-profundidade.mjs   (a partir da raiz do repo)
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

const LICENCA =
  "Domínio público (dado do governo dos EUA); NOAA pede reconhecimento da fonte por transparência, " +
  "mas não há restrição de uso comercial.";

// ---------------------------------------------------------------------------
// Configuração das 2 coberturas — MESMAS regiões/datasets/cachePaths de
// gerar-batimetria.mjs (camadas "fina" e "ampla") e gerar-mascara-nacional.mjs.
// ---------------------------------------------------------------------------

const COBERTURAS = [
  {
    id: "fina",
    regiao: { lngMin: -45.75, latMin: -24.05, lngMax: -41.75, latMax: -22.65 },
    datasetBase: "https://oceanwatch.pifsc.noaa.gov/erddap/griddap/ETOPO_2022_v1_15s",
    stride: 1,
    fonteDataset: "ETOPO 2022 15 Arc-Second Global Relief Model (Ice Surface), NOAA/NCEI",
    resolucaoAprox: "~450 m (15 arc-sec)",
    cachePath: path.join(CACHE_DIR, "batimetria.asc"),
    outPng: path.join(OUT_DIR, "profundidade-fina.png"),
    outJson: path.join(OUT_DIR, "profundidade-fina.json"),
    passoM: 0.25,
    // % de agua plausivel no grid (mesma faixa da camada "fina" de gerar-batimetria.mjs,
    // que usa o mesmo cache/bbox) — guarda contra download/cache truncado.
    waterMinPct: 15,
    waterMaxPct: 95,
  },
  {
    id: "nacional",
    regiao: { lngMin: -58, latMin: -34.5, lngMax: -20, latMax: 6 },
    datasetBase: "https://oceanwatch.pifsc.noaa.gov/erddap/griddap/ETOPO_2022_v1_60s",
    stride: 2,
    fonteDataset: "ETOPO 2022 60 Arc-Second Global Relief Model (Ice Surface), NOAA/NCEI",
    resolucaoAprox: "~3,6 km (2 arc-min — ETOPO 60 arc-sec com stride 2 no ERDDAP)",
    cachePath: path.join(CACHE_DIR, "batimetria-ampla.asc"),
    outPng: path.join(OUT_DIR, "profundidade-nacional.png"),
    outJson: path.join(OUT_DIR, "profundidade-nacional.json"),
    passoM: 4,
    waterMinPct: 25,
    waterMaxPct: 75,
    timeoutMs: 30 * 60_000,
    tentativas: 1,
  },
];

/** byte 0 = terra/sem-dado; 1..255 = piso do bucket de profundidade
 *  (profundidadeM = (byte-1)*passoM). Satura em 255 pra qualquer profundidade
 *  >= 254*passoM — não precisamos distinguir "fundo" de "muito fundo" pra
 *  decidir se um calado passa. */
export function metrosParaByte(profundidadeM, passoM) {
  const bucket = Math.floor(profundidadeM / passoM) + 1;
  return Math.min(255, Math.max(1, bucket));
}

/** Inversa de `metrosParaByte` — piso conservador do bucket. byte 0 (terra)
 *  não é chamada aqui; quem consome decide separadamente o que fazer com
 *  byte 0 (ver web/lib/mapa/mascara.ts). */
export function byteParaMetros(byte, passoM) {
  return (byte - 1) * passoM;
}

async function gerarCobertura(cobertura) {
  console.log("");
  console.log(`=== Grade de profundidade "${cobertura.id}" ===`);

  const { texto, deCache } = await baixarGradeBatimetria(cobertura);
  const { ncols, nrows, valores, nodata } = parseEsriAscii(texto);
  const totalCelulas = ncols * nrows;
  console.log(`Grid: ${ncols} x ${nrows} = ${totalCelulas.toLocaleString("pt-BR")} células.`);

  const png = new PNG({ width: ncols, height: nrows, colorType: 0, bitDepth: 8, deflateStrategy: 1 });
  let celulasAgua = 0;
  let profundidadeMaximaVista = 0;
  for (let idx = 0; idx < valores.length; idx++) {
    const z = valores[idx];
    const ehTerraOuSemDado = !Number.isFinite(z) || z === nodata || z >= 0;
    const o = idx * 4;
    let v;
    if (ehTerraOuSemDado) {
      v = 0;
    } else {
      const profundidadeM = -z;
      if (profundidadeM > profundidadeMaximaVista) profundidadeMaximaVista = profundidadeM;
      v = metrosParaByte(profundidadeM, cobertura.passoM);
      celulasAgua++;
    }
    png.data[o] = v;
    png.data[o + 1] = v;
    png.data[o + 2] = v;
    png.data[o + 3] = 255;
  }

  const pctAgua = (100 * celulasAgua) / totalCelulas;
  console.log(`Água (com dado de profundidade): ${pctAgua.toFixed(2)}% do grid.`);
  console.log(`Profundidade máxima observada na região: ${profundidadeMaximaVista.toFixed(0)} m.`);

  if (pctAgua < cobertura.waterMinPct || pctAgua > cobertura.waterMaxPct) {
    throw new Error(
      `SANIDADE FALHOU (cobertura "${cobertura.id}"): ${pctAgua.toFixed(2)}% de água está fora da faixa plausível ` +
        `[${cobertura.waterMinPct}%, ${cobertura.waterMaxPct}%]. Provável causa: cache truncado/corrompido, ou bbox ` +
        `errada. Não gerando PNG/JSON — investigar antes de rodar de novo.`
    );
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  await new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(cobertura.outPng);
    stream.on("finish", resolve);
    stream.on("error", reject);
    png.pack().pipe(stream);
  });

  const pngKb = fs.statSync(cobertura.outPng).size / 1024;

  const metadados = {
    lngMin: cobertura.regiao.lngMin,
    latMin: cobertura.regiao.latMin,
    lngMax: cobertura.regiao.lngMax,
    latMax: cobertura.regiao.latMax,
    largura: ncols,
    altura: nrows,
    passoM: cobertura.passoM,
    profundidadeMaximaCodificadaM: 254 * cobertura.passoM,
    codificacao:
      "byte 0 = terra/sem-dado; byte 1..255 = piso do bucket de profundidade, profundidadeM = (byte-1)*passoM; " +
      "byte 255 satura em profundidadeM >= 254*passoM (fundo o bastante pra qualquer calado). Decodificação " +
      "conservadora: sempre o PISO do bucket, nunca o teto.",
    resolucaoAprox: cobertura.resolucaoAprox,
    geradoEm: new Date().toISOString(),
    fonte: `${cobertura.fonteDataset} — domínio público dos EUA`,
    licenca: LICENCA,
    aviso:
      "Grade derivada de elevação global (ETOPO 2022), NÃO de carta náutica oficial. Resolução espacial " +
      "(~450 m fina / ~3,6 km nacional) não resolve pedra isolada, banco de areia ou recife menores que a " +
      "célula — evita áreas rasas CONHECIDAS nessa resolução, não garante profundidade real no local exato.",
  };
  fs.writeFileSync(cobertura.outJson, JSON.stringify(metadados, null, 2));

  console.log(`Fonte: ${cobertura.fonteDataset}${deCache ? " (via cache local)" : ""}`);
  console.log(`Dimensões finais: ${ncols} x ${nrows} px`);
  console.log(`passoM: ${cobertura.passoM} m/bucket — codifica até ${(254 * cobertura.passoM).toFixed(1)} m antes de saturar`);
  console.log(`Tamanho do PNG: ${pngKb.toFixed(1)} KB`);
  console.log(`PNG:  ${cobertura.outPng}`);
  console.log(`JSON: ${cobertura.outJson}`);

  return { id: cobertura.id, pngKb, ncols, nrows, pctAgua };
}

async function main() {
  const resumos = [];
  for (const cobertura of COBERTURAS) {
    resumos.push(await gerarCobertura(cobertura));
  }

  console.log("");
  console.log("=== Resumo geral ===");
  for (const r of resumos) {
    console.log(`${r.id}: ${r.ncols}x${r.nrows}px, ${r.pngKb.toFixed(1)} KB, ${r.pctAgua.toFixed(1)}% água com dado.`);
  }
}

const ehExecucaoDireta = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (ehExecucaoDireta) {
  main().catch((err) => {
    console.error("");
    console.error("ERRO:", err.message);
    process.exitCode = 1;
  });
}
