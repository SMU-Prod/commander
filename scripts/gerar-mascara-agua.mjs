#!/usr/bin/env node
/**
 * Gera a máscara água/terra da costa do Rio de Janeiro a partir da linha de
 * costa do OpenStreetMap (natural=coastline), via Overpass API.
 *
 * Algoritmo:
 *   1. Busca a linha de costa no Overpass (com margem de 0.35° e cache local).
 *   2. Cria um grid métrico (80 m/célula) cobrindo a região COM a margem.
 *   3. Rasteriza cada segmento da costa como parede (Bresenham).
 *   4. Flood fill (BFS 4-conectado, fila em Int32Array) a partir de um ponto
 *      de oceano aberto — o que o fill alcançar é água navegável.
 *   5. Dilata a terra em 2 células (8-conectado, 2 passadas com buffers
 *      separados) — margem de segurança da costa.
 *   6. Poda bolsões de água desconectados do oceano aberto: um segundo BFS,
 *      agora com a MESMA regra de movimento do A* (8-conectado, sem cortar
 *      quina — ver acharCaminhoEmCelulas em web/lib/domain/rota.ts), a partir
 *      da mesma semente. A dilatação do passo 5 pode isolar pixels de água
 *      residuais (reentrâncias de marina, ruído de rasterização) que o fill
 *      4-conectado do passo 4 via como conectados mas que o A* nunca alcança
 *      — sem essa poda, snapParaAgua pode grudar a origem/destino numa poça
 *      de 1 célula sem saída, e a rota falha com "sem rota" mesmo perto da
 *      costa. Qualquer célula de água fora do alcance dessa varredura vira
 *      terra.
 *   7. Recorta a margem, deixando só a região pedida.
 *   8. Escreve o PNG (grayscale 8 bits: 255 = água, 0 = terra) + o JSON de
 *      metadados.
 *
 * Uso: node scripts/gerar-mascara-agua.mjs   (a partir da raiz do repo)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// pngjs só existe em web/node_modules (devDependency de build, não entra no
// bundle). O script mora em scripts/ na raiz, fora da árvore de resolução
// padrão do ESM — resolve explicitamente a partir de web/.
const requireFromWeb = createRequire(path.join(ROOT, "web", "package.json"));
const { PNG } = requireFromWeb("pngjs");

// ---------------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------------

// Região pedida: Ilhabela/São Sebastião → Ubatuba → Paraty → Angra/Ilha Grande →
// Rio → Cabo Frio/Búzios — o circuito real dos barcos atendidos pelo Commander.
const REGIAO = {
  lngMin: -45.75,
  latMin: -24.05,
  lngMax: -41.75,
  latMax: -22.65,
};

// 100 m/célula: com a região expandida (~6,3M células), 80 m/célula estoura o
// orçamento de 80 MB de alocação do A* (~100 MB mesmo após a otimização de
// memória de rota.ts); 100 m fecha com folga (~70 MB). Ver a conta completa em
// docs/OPERACAO.md. Efeito colateral: a margem de segurança da costa
// (MARGEM_CELULAS_TERRA células) também cresce de 160 m para 200 m.
const METROS_POR_CELULA = 100;
const MARGEM_GRAUS = 0.35; // margem em volta da região, fecha vazamentos do fill nas bordas
const MARGEM_CELULAS_TERRA = 2; // dilatação de segurança da costa
const SEMENTE = { lat: -23.4, lng: -43.5 }; // oceano aberto ao sul do Rio

const CACHE_DIR = path.join(ROOT, "scripts", ".cache");
const CACHE_PATH = path.join(CACHE_DIR, "coastline.json");
const CACHE_META_PATH = path.join(CACHE_DIR, "coastline.meta.json");

const OUT_DIR = path.join(ROOT, "web", "public", "mapa");
const OUT_PNG = path.join(OUT_DIR, "mascara-agua.png");
const OUT_JSON = path.join(OUT_DIR, "mascara-agua.json");

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const WATER_MIN_PCT = 20;
const WATER_MAX_PCT = 95;

// Estados do grid de trabalho.
const LIVRE = 0;
const PAREDE = 1;
const AGUA = 2;

// ---------------------------------------------------------------------------
// 1. Busca da linha de costa (Overpass, com cache)
// ---------------------------------------------------------------------------

/** @returns {Promise<{ json: any, endpoint: string, deCache: boolean }>} */
async function buscarLinhaDeCosta(bboxMargem) {
  if (fs.existsSync(CACHE_PATH)) {
    const json = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
    let endpoint = "desconhecido (cache sem metadados)";
    if (fs.existsSync(CACHE_META_PATH)) {
      try {
        endpoint = JSON.parse(fs.readFileSync(CACHE_META_PATH, "utf8")).endpoint ?? endpoint;
      } catch {
        // ignora meta corrompido, segue com o valor default
      }
    }
    console.log(`Cache encontrado em ${CACHE_PATH} — reusando (sem bater no Overpass).`);
    return { json, endpoint, deCache: true };
  }

  const query =
    `[out:json][timeout:180];\n` +
    `way["natural"="coastline"](${bboxMargem.latMin},${bboxMargem.lngMin},${bboxMargem.latMax},${bboxMargem.lngMax});\n` +
    `out geom;`;

  let ultimoErro;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      console.log(`Consultando Overpass em ${endpoint} (pode levar até 180s)...`);
      const inicio = Date.now();
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "GEST-NAV-Commander/1.0 (script gerar-mascara-agua.mjs; contato atendimento.smu@gmail.com)",
          Accept: "*/*",
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(190_000),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}: ${(await res.text()).slice(0, 300)}`);
      }
      const json = await res.json();
      const ways = (json.elements ?? []).filter((el) => el.type === "way");
      if (ways.length === 0) {
        throw new Error("resposta do Overpass sem nenhum way de coastline");
      }
      const segundos = ((Date.now() - inicio) / 1000).toFixed(1);
      console.log(`Overpass OK via ${endpoint} em ${segundos}s: ${ways.length} ways de coastline.`);

      fs.mkdirSync(CACHE_DIR, { recursive: true });
      fs.writeFileSync(CACHE_PATH, JSON.stringify(json));
      fs.writeFileSync(
        CACHE_META_PATH,
        JSON.stringify({ endpoint, fetchedAt: new Date().toISOString(), ways: ways.length }, null, 2)
      );

      return { json, endpoint, deCache: false };
    } catch (err) {
      console.warn(`Falhou em ${endpoint}: ${err.message}`);
      ultimoErro = err;
    }
  }
  throw new Error(`Todos os endpoints do Overpass falharam. Último erro: ${ultimoErro?.message}`);
}

// ---------------------------------------------------------------------------
// 2. Grid métrico
// ---------------------------------------------------------------------------

function criarConversores(bbox, metrosPorCelula) {
  const latMedia = (bbox.latMin + bbox.latMax) / 2;
  const metrosPorGrauLng = 111320 * Math.cos((latMedia * Math.PI) / 180);
  const metrosPorGrauLat = 110540;

  const largura = Math.round(((bbox.lngMax - bbox.lngMin) * metrosPorGrauLng) / metrosPorCelula);
  const altura = Math.round(((bbox.latMax - bbox.latMin) * metrosPorGrauLat) / metrosPorCelula);

  const colFromLng = (lng) => Math.round(((lng - bbox.lngMin) * metrosPorGrauLng) / metrosPorCelula);
  // row 0 = topo do grid = norte (latMax); row cresce indo pro sul.
  const rowFromLat = (lat) => Math.round(((bbox.latMax - lat) * metrosPorGrauLat) / metrosPorCelula);

  return { largura, altura, colFromLng, rowFromLat, metrosPorGrauLng, metrosPorGrauLat, latMedia };
}

// ---------------------------------------------------------------------------
// 3. Rasterização (Bresenham)
// ---------------------------------------------------------------------------

function bresenham(c0, r0, c1, r1, marcar) {
  let c = c0;
  let r = r0;
  const dc = Math.abs(c1 - c0);
  const sc = c0 < c1 ? 1 : -1;
  const dr = -Math.abs(r1 - r0);
  const sr = r0 < r1 ? 1 : -1;
  let err = dc + dr;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    marcar(c, r);
    if (c === c1 && r === r1) break;
    const e2 = 2 * err;
    if (e2 >= dr) {
      err += dr;
      c += sc;
    }
    if (e2 <= dc) {
      err += dc;
      r += sr;
    }
  }
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  const bboxMargem = {
    lngMin: REGIAO.lngMin - MARGEM_GRAUS,
    latMin: REGIAO.latMin - MARGEM_GRAUS,
    lngMax: REGIAO.lngMax + MARGEM_GRAUS,
    latMax: REGIAO.latMax + MARGEM_GRAUS,
  };

  const { json: overpassJson, endpoint: endpointUsado, deCache } = await buscarLinhaDeCosta(bboxMargem);

  const conv = criarConversores(bboxMargem, METROS_POR_CELULA);
  const { largura: larguraM, altura: alturaM, colFromLng, rowFromLat } = conv;
  const totalCelulasM = larguraM * alturaM;

  console.log(
    `Grid (com margem de ${MARGEM_GRAUS}°): ${larguraM} x ${alturaM} = ${totalCelulasM.toLocaleString("pt-BR")} células.`
  );

  const grid = new Uint8Array(totalCelulasM); // LIVRE por padrão

  const clampCol = (c) => Math.min(larguraM - 1, Math.max(0, c));
  const clampRow = (r) => Math.min(alturaM - 1, Math.max(0, r));

  // --- 3. Rasteriza a costa como parede ---
  let waysRasterizados = 0;
  let pontosRasterizados = 0;
  for (const el of overpassJson.elements ?? []) {
    if (el.type !== "way" || !Array.isArray(el.geometry)) continue;
    let prev = null;
    for (const pt of el.geometry) {
      if (!pt || typeof pt.lat !== "number" || typeof pt.lon !== "number") {
        prev = null; // ponto faltando (nó não resolvido) — quebra a linha aqui
        continue;
      }
      const c = clampCol(colFromLng(pt.lon));
      const r = clampRow(rowFromLat(pt.lat));
      if (prev) {
        bresenham(prev.c, prev.r, c, r, (cc, rr) => {
          grid[rr * larguraM + cc] = PAREDE;
        });
      } else {
        grid[r * larguraM + c] = PAREDE;
      }
      prev = { c, r };
      pontosRasterizados++;
    }
    waysRasterizados++;
  }
  console.log(`Rasterizados ${waysRasterizados} ways / ${pontosRasterizados} pontos de costa.`);

  // --- 4. Flood fill (BFS 4-conectado — casa com a parede 8-conectada do Bresenham, sem vazamento diagonal) ---
  const seedCol = clampCol(colFromLng(SEMENTE.lng));
  const seedRow = clampRow(rowFromLat(SEMENTE.lat));
  const seedIdx = seedRow * larguraM + seedCol;

  if (grid[seedIdx] === PAREDE) {
    throw new Error(
      `Semente do flood fill (lat ${SEMENTE.lat}, lng ${SEMENTE.lng} → col ${seedCol}, row ${seedRow}) caiu em cima de uma PAREDE de costa. Aborting sem gerar arquivos.`
    );
  }

  const fila = new Int32Array(totalCelulasM);
  let cabeca = 0;
  let cauda = 0;
  fila[cauda++] = seedIdx;
  grid[seedIdx] = AGUA;

  const DC = [1, -1, 0, 0];
  const DR = [0, 0, 1, -1];

  while (cabeca < cauda) {
    const idx = fila[cabeca++];
    const r = (idx / larguraM) | 0;
    const c = idx % larguraM;
    for (let k = 0; k < 4; k++) {
      const nc = c + DC[k];
      const nr = r + DR[k];
      if (nc < 0 || nc >= larguraM || nr < 0 || nr >= alturaM) continue;
      const nidx = nr * larguraM + nc;
      if (grid[nidx] === LIVRE) {
        grid[nidx] = AGUA;
        fila[cauda++] = nidx;
      }
    }
  }

  const celulasAguaMargem = cauda; // número de células marcadas como água pelo fill
  const pctAguaMargem = (100 * celulasAguaMargem) / totalCelulasM;
  console.log(
    `Flood fill: ${celulasAguaMargem.toLocaleString("pt-BR")} células de água (${pctAguaMargem.toFixed(1)}% do grid com margem).`
  );

  // --- 5. Dilata a terra em MARGEM_CELULAS_TERRA células (8-conectado, buffers separados) ---
  // isAgua[i] = 1 -> água navegável; 0 -> terra (parede ou nunca alcançada pelo fill).
  let isAgua = new Uint8Array(totalCelulasM);
  for (let i = 0; i < totalCelulasM; i++) isAgua[i] = grid[i] === AGUA ? 1 : 0;

  for (let passada = 0; passada < MARGEM_CELULAS_TERRA; passada++) {
    const origem = isAgua;
    const destino = new Uint8Array(origem); // cópia — nunca dilata in-place
    for (let r = 0; r < alturaM; r++) {
      for (let c = 0; c < larguraM; c++) {
        const idx = r * larguraM + c;
        if (origem[idx] !== 1) continue; // já é terra, não precisa checar
        let tocaTerra = false;
        for (let dr = -1; dr <= 1 && !tocaTerra; dr++) {
          const nr = r + dr;
          if (nr < 0 || nr >= alturaM) continue;
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nc = c + dc;
            if (nc < 0 || nc >= larguraM) continue;
            if (origem[nr * larguraM + nc] === 0) {
              tocaTerra = true;
              break;
            }
          }
        }
        if (tocaTerra) destino[idx] = 0;
      }
    }
    isAgua = destino;
  }

  // --- 6. Poda bolsões de água desconectados do oceano aberto pela regra de movimento do A* ---
  // BFS 8-conectado SEM cortar quina (passo diagonal só é válido se as duas células
  // ortogonais adjacentes também forem água) — a mesma regra de acharCaminhoEmCelulas
  // em web/lib/domain/rota.ts. A dilatação do passo 5 é feita numa varredura raster
  // (linha a linha) e não garante que o resultado continue navegável por essa regra
  // mais estrita: reentrâncias estreitas de marina/porto podem virar pixels de água
  // isolados (só ligados ao resto por uma diagonal cujas duas ortogonais viraram
  // terra). Sem essa poda, esses pixels ainda contam como "água" no PNG e
  // snapParaAgua pode grudar neles — a rota falha silenciosamente com "sem rota"
  // mesmo entre dois pontos claramente navegáveis.
  const DC8 = [1, -1, 0, 0, 1, 1, -1, -1];
  const DR8 = [0, 0, 1, -1, 1, -1, 1, -1];
  const alcancavel = new Uint8Array(totalCelulasM);
  {
    const fila2 = new Int32Array(totalCelulasM);
    let cabeca2 = 0;
    let cauda2 = 0;
    fila2[cauda2++] = seedIdx;
    alcancavel[seedIdx] = 1;
    while (cabeca2 < cauda2) {
      const idx = fila2[cabeca2++];
      const r = (idx / larguraM) | 0;
      const c = idx % larguraM;
      for (let k = 0; k < 8; k++) {
        const dc = DC8[k];
        const dr = DR8[k];
        const nc = c + dc;
        const nr = r + dr;
        if (nc < 0 || nc >= larguraM || nr < 0 || nr >= alturaM) continue;
        const nidx = nr * larguraM + nc;
        if (alcancavel[nidx] || isAgua[nidx] !== 1) continue;
        if (dc !== 0 && dr !== 0) {
          // sem cortar quina: as duas ortogonais adjacentes também precisam ser água
          if (isAgua[r * larguraM + nc] !== 1 || isAgua[nr * larguraM + c] !== 1) continue;
        }
        alcancavel[nidx] = 1;
        fila2[cauda2++] = nidx;
      }
    }
  }
  let celulasPodadas = 0;
  for (let i = 0; i < totalCelulasM; i++) {
    if (isAgua[i] === 1 && alcancavel[i] === 0) {
      isAgua[i] = 0;
      celulasPodadas++;
    }
  }
  if (celulasPodadas > 0) {
    console.log(
      `Poda de conectividade (regra do A*): ${celulasPodadas.toLocaleString("pt-BR")} células de água desconectadas do oceano aberto viraram terra.`
    );
  }

  // --- 7. Recorta a margem, deixando só a região pedida ---
  const colMin = clampCol(colFromLng(REGIAO.lngMin));
  const colMax = clampCol(colFromLng(REGIAO.lngMax));
  const rowMin = clampRow(rowFromLat(REGIAO.latMax)); // topo = norte
  const rowMax = clampRow(rowFromLat(REGIAO.latMin)); // base = sul

  const largura = colMax - colMin;
  const altura = rowMax - rowMin;
  if (largura <= 0 || altura <= 0) {
    throw new Error(`Recorte inválido: largura=${largura}, altura=${altura}.`);
  }

  const final = new Uint8Array(largura * altura);
  for (let r = 0; r < altura; r++) {
    const rOrig = r + rowMin;
    for (let c = 0; c < largura; c++) {
      final[r * largura + c] = isAgua[rOrig * larguraM + (c + colMin)];
    }
  }

  let celulasAgua = 0;
  for (let i = 0; i < final.length; i++) celulasAgua += final[i];
  const pctAgua = (100 * celulasAgua) / final.length;

  console.log(`Grid final (recortado): ${largura} x ${altura} = ${final.length.toLocaleString("pt-BR")} células.`);
  console.log(`Água navegável (pós-dilatação): ${pctAgua.toFixed(2)}%.`);

  if (pctAgua < WATER_MIN_PCT || pctAgua > WATER_MAX_PCT) {
    throw new Error(
      `SANIDADE FALHOU: ${pctAgua.toFixed(2)}% de água está fora da faixa plausível [${WATER_MIN_PCT}%, ${WATER_MAX_PCT}%]. ` +
        `Provável causa: semente do fill em terra/parede, margem insuficiente, ou dado do Overpass incompleto. ` +
        `Não gerando PNG/JSON — investigar antes de rodar de novo.`
    );
  }

  // --- 7. Escreve PNG + JSON ---
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const png = new PNG({ width: largura, height: altura, colorType: 0, bitDepth: 8 });
  for (let i = 0; i < final.length; i++) {
    const v = final[i] ? 255 : 0;
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
    lngMin: REGIAO.lngMin,
    latMin: REGIAO.latMin,
    lngMax: REGIAO.lngMax,
    latMax: REGIAO.latMax,
    largura,
    altura,
    metrosPorCelula: METROS_POR_CELULA,
    margemCelulas: MARGEM_CELULAS_TERRA,
    geradoEm: new Date().toISOString(),
    fonte: "OpenStreetMap contributors (natural=coastline), via Overpass API — ODbL, atribuição obrigatória",
  };
  fs.writeFileSync(OUT_JSON, JSON.stringify(metadados, null, 2));

  console.log("");
  console.log("=== Resumo ===");
  console.log(`Endpoint Overpass usado: ${endpointUsado}${deCache ? " (via cache local)" : ""}`);
  console.log(`Dimensões finais: ${largura} x ${altura} px`);
  console.log(`% de água navegável: ${pctAgua.toFixed(2)}%`);
  console.log(`Tamanho do PNG: ${pngKb.toFixed(1)} KB`);
  console.log(`PNG:  ${OUT_PNG}`);
  console.log(`JSON: ${OUT_JSON}`);
}

main().catch((err) => {
  console.error("");
  console.error("ERRO:", err.message);
  process.exitCode = 1;
});
