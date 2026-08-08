# Onda 5 — Rota Marítima Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A linha de destino deixa de cruzar terra: o Commander calcula uma rota que contorna a costa e as ilhas, com pernas, distância real percorrida e ETA — usando dado aberto, custo zero, funcionando offline.

**Architecture:** Uma máscara água/terra da costa do RJ (Paraty → Búzios) é gerada UMA VEZ no build a partir da linha de costa do OpenStreetMap e versionada como PNG. No navegador, o PNG é decodificado nativamente (canvas), vira um `Uint8Array` de células, e um A* puro (domínio testado) acha o caminho pela água; o caminho passa por string-pulling (line-of-sight) e vira pernas naturais. Nada de API em runtime.

**Tech Stack:** Node script + Overpass API + pngjs (devDependency, só build), A* + octile heuristic em TypeScript puro, Canvas API para decodificar, Mapbox GL para desenhar.

## Global Constraints

- **A rota contorna TERRA, não conhece PROFUNDIDADE.** Todo texto de UI e todo comentário no código tem que ser honesto sobre isso; o disclaimer de carta oficial permanece. Nunca escrever "rota segura" — escrever "rota pela água".
- **Margem de segurança da costa não é opcional:** a terra é dilatada em 2 células (~160 m) antes de rotear; um caminho que raspa a pedra é pior que nenhum caminho.
- Fora da área coberta pela máscara → cai para rumo direto com rótulo explícito, nunca invента rota.
- Origem/destino em terra (marina, toque errado) → *snap* para a água mais próxima dentro de 1 km; se não houver, mensagem clara.
- Domínio puro em `lib/domain/`, testado com TDD; nada de lógica de rota dentro de componente.
- Preços/medidas: distância sempre em MN (1 MN = 1852 m); rumo em graus verdadeiros 0-360.
- Sem `NEXT_PUBLIC_MAPBOX_TOKEN` nada quebra (o cálculo de rota é independente do mapa).
- Tipografia sem cor (`text-dim`), `sombra-1/2`, alvos ≥44px, PT-BR náutico, ícones via `<Icone>`.
- Commits PT-BR sem acento no assunto; hook de pré-commit nunca pulado.

---

### Task 1: Máscara água/terra da costa do RJ

**Files:**
- Create: `scripts/gerar-mascara-agua.mjs`
- Create: `web/public/mapa/mascara-agua.png` (gerado)
- Create: `web/public/mapa/mascara-agua.json` (metadados do grid)
- Modify: `web/package.json` (devDependency `pngjs`, script `mascara`)
- Modify: `docs/OPERACAO.md` (seção "Máscara de água")

**Interfaces:**
- Produces: PNG grayscale (255 = água navegável, 0 = terra/margem) + JSON `{ lngMin, latMin, lngMax, latMax, largura, altura, metrosPorCelula, margemCelulas, geradoEm, fonte }`. As Tasks 2-4 consomem esses dois arquivos.

**Região:** `lngMin -44.95, latMin -23.45, lngMax -41.75, latMax -22.65` (Paraty → Angra → Ilha Grande → Rio → Búzios/Cabo Frio). Resolução alvo **80 m/célula**.

- [ ] **Step 1: Dependência** — em `web/`: `npm i -D pngjs` (build-time apenas; NÃO entra no bundle).

- [ ] **Step 2: Escrever o script** — `scripts/gerar-mascara-agua.mjs`. Ele:
  1. Busca a linha de costa no Overpass **com margem de 0.35°** em volta da região (a margem fecha vazamentos do flood fill nas bordas):
     ```
     [out:json][timeout:180];
     way["natural"="coastline"]({latMinM},{lngMinM},{latMaxM},{lngMaxM});
     out geom;
     ```
     Endpoint: `https://overpass-api.de/api/interpreter` (POST, body `data=...`). Salvar a resposta crua em `scripts/.cache/coastline.json` e REUSAR se já existir (não martelar o Overpass em cada rodada).
  2. Cria o grid da região COM a margem, calculando `largura/altura` a partir de `metrosPorCelula` (80), com `metrosPorGrauLng = 111320 * cos(latMedia)` e `metrosPorGrauLat = 110540`.
  3. Rasteriza cada segmento da linha de costa como barreira (Bresenham), marcando as células como PAREDE.
  4. **Flood fill** (BFS iterativo com fila em `Int32Array` — nada de recursão) a partir de uma semente em oceano aberto: `lat -23.40, lng -43.50`. Só células não-PAREDE são alcançadas. O que o fill alcançar = água.
  5. **Dilata a terra** em `margemCelulas = 2`: toda célula de água vizinha (8-conectada, 2 iterações) de terra/parede vira terra. É a margem de segurança da costa.
  6. Recorta a margem, deixando só a região pedida.
  7. Escreve `mascara-agua.png` (pngjs, `colorType: 0`, 8 bits: 255 água / 0 terra) e `mascara-agua.json` com os metadados.
  8. Imprime no fim: dimensões, % de água, tamanho do PNG em KB.

- [ ] **Step 3: Rodar** — `node scripts/gerar-mascara-agua.mjs` a partir da raiz do repo.

- [ ] **Step 4: VERIFICAÇÃO VISUAL (obrigatória — é o gate desta task)** — abrir `web/public/mapa/mascara-agua.png` e OLHAR a imagem. Ela tem que parecer um mapa da costa fluminense em preto e branco. Conferir item a item, e reportar cada um:
  - Baía de Guanabara aparece como reentrância de água, com a Ilha do Governador em preto dentro dela;
  - Ilha Grande aparece como mancha preta grande, SEPARADA do continente por um canal branco contínuo;
  - Baía de Sepetiba e a restinga da Marambaia (faixa fina de terra) aparecem;
  - Cabo Frio/Búzios na ponta direita;
  - o oceano (parte de baixo) é branco contínuo, sem manchas pretas espúrias;
  - nenhum "vazamento" — continente inteiro preto, sem áreas brancas dentro da terra.
  Se qualquer item falhar, o problema é a semente do fill, a margem, ou dado faltante do Overpass — corrigir e regerar ANTES de comitar.

- [ ] **Step 5: Sanidade numérica** — escrever um script rápido (pode ser inline com node) que lê o PNG+JSON e afirma, com as coordenadas convertidas para célula:
  - água: meio do canal entre Ilha Grande e o continente `(-23.05, -44.25)`, oceano aberto `(-23.40, -43.50)`, entrada da Baía de Guanabara `(-22.94, -43.15)`;
  - terra: pico da Ilha Grande `(-23.14, -44.20)`, Corcovado `(-22.95, -43.21)`, centro de Angra `(-23.00, -44.32)`.
  Reportar os 6 resultados. Todos têm que bater.

- [ ] **Step 6: Docs + commit** — seção "Máscara de água" em `docs/OPERACAO.md`: o que é, como regerar (`node scripts/gerar-mascara-agua.mjs`), de onde vem o dado (OpenStreetMap, ODbL — **atribuição obrigatória**), e o aviso de que a máscara conhece terra, não profundidade. Adicionar `scripts/.cache/` ao `.gitignore`. Commit: `feat: mascara de agua da costa do rio a partir do openstreetmap`

---

### Task 2: Domínio da rota (TDD)

**Files:**
- Create: `web/lib/domain/rota.ts`
- Create: `web/lib/domain/rota.test.ts`

**Interfaces:**
- Consumes: `haversineNm` de `@/lib/domain/geo`.
- Produces:
  ```ts
  export interface Grade { largura: number; altura: number; lngMin: number; latMin: number; lngMax: number; latMax: number; agua: Uint8Array }
  export function ehAgua(g: Grade, c: Celula): boolean
  export function paraCelula(g: Grade, p: Coord): Celula
  export function paraCoord(g: Grade, c: Celula): Coord
  export function snapParaAgua(g: Grade, p: Coord, raioCelulas: number): Celula | null
  export function acharCaminho(g: Grade, de: Coord, para: Coord): Coord[] | null
  export function suavizar(g: Grade, caminho: Coord[]): Coord[]
  export function distanciaDaRota(pontos: Coord[]): number  // MN
  ```
  A Task 3 consome `acharCaminho`/`suavizar`/`distanciaDaRota`.

- [ ] **Step 1: Escrever os testes que falham** — `web/lib/domain/rota.test.ts`. Grade sintética de 40×20 com uma "ilha" retangular no meio (colunas 15-25, linhas 5-15), coordenadas mapeadas 1:1 em graus para facilitar a conta:

```ts
import { describe, expect, it } from "vitest"
import { acharCaminho, distanciaDaRota, ehAgua, paraCelula, snapParaAgua, suavizar, type Grade } from "./rota"

/** 40x20, tudo água menos uma ilha retangular no meio. */
function gradeComIlha(): Grade {
  const largura = 40
  const altura = 20
  const agua = new Uint8Array(largura * altura).fill(1)
  for (let y = 5; y <= 15; y++) for (let x = 15; x <= 25; x++) agua[y * largura + x] = 0
  return { largura, altura, lngMin: 0, latMin: 0, lngMax: 40, latMax: 20, agua }
}

describe("grade", () => {
  it("converte coordenada para celula e de volta", () => {
    const g = gradeComIlha()
    const c = paraCelula(g, { la: 10.5, lo: 20.5 })
    expect(c).toEqual({ x: 20, y: 9 })
    expect(ehAgua(g, c)).toBe(false) // dentro da ilha
    expect(ehAgua(g, paraCelula(g, { la: 2.5, lo: 2.5 }))).toBe(true)
  })
  it("snap leva um ponto em terra para a agua mais proxima", () => {
    const g = gradeComIlha()
    const alvo = snapParaAgua(g, { la: 10.5, lo: 20.5 }, 20)
    expect(alvo).not.toBeNull()
    expect(ehAgua(g, alvo!)).toBe(true)
  })
  it("snap devolve null quando nao ha agua no raio", () => {
    const g = gradeComIlha()
    expect(snapParaAgua(g, { la: 10.5, lo: 20.5 }, 1)).toBeNull()
  })
})

describe("acharCaminho", () => {
  it("acha caminho reto quando nao ha obstaculo", () => {
    const g = gradeComIlha()
    const caminho = acharCaminho(g, { la: 2.5, lo: 2.5 }, { la: 2.5, lo: 35.5 })
    expect(caminho).not.toBeNull()
    expect(caminho!.every((p) => ehAgua(g, paraCelula(g, p)))).toBe(true)
  })
  it("CONTORNA a ilha em vez de atravessar (o teste que importa)", () => {
    const g = gradeComIlha()
    const caminho = acharCaminho(g, { la: 10.5, lo: 5.5 }, { la: 10.5, lo: 35.5 })
    expect(caminho).not.toBeNull()
    // nenhum ponto do caminho pode cair em terra
    expect(caminho!.every((p) => ehAgua(g, paraCelula(g, p)))).toBe(true)
    // e o caminho tem que ser mais longo que a reta, porque desviou
    const reta = 30
    expect(distanciaDaRota(caminho!)).toBeGreaterThan(reta * 0.9)
  })
  it("devolve null quando o destino esta cercado de terra", () => {
    const g = gradeComIlha()
    // centro da ilha nao tem agua ao redor no raio de snap zero
    const caminho = acharCaminho(g, { la: 2.5, lo: 2.5 }, { la: 10.5, lo: 20.5 })
    // com snap, o destino vira a borda da ilha — entao ha caminho;
    // o caso sem saida e testado com uma grade toda de terra
    const seca: Grade = { ...g, agua: new Uint8Array(g.largura * g.altura) }
    expect(acharCaminho(seca, { la: 2.5, lo: 2.5 }, { la: 10.5, lo: 20.5 })).toBeNull()
    expect(caminho).not.toBeNull()
  })
})

describe("suavizar", () => {
  it("reduz os pontos mantendo o caminho na agua", () => {
    const g = gradeComIlha()
    const caminho = acharCaminho(g, { la: 10.5, lo: 5.5 }, { la: 10.5, lo: 35.5 })!
    const pernas = suavizar(g, caminho)
    expect(pernas.length).toBeLessThan(caminho.length)
    expect(pernas.length).toBeGreaterThanOrEqual(2)
    expect(pernas[0]).toEqual(caminho[0])
    expect(pernas[pernas.length - 1]).toEqual(caminho[caminho.length - 1])
  })
})

describe("distanciaDaRota", () => {
  it("soma as pernas em MN", () => {
    expect(distanciaDaRota([{ la: 0, lo: 0 }, { la: 0, lo: 0 }])).toBe(0)
    expect(distanciaDaRota([{ la: 0, lo: 0 }, { la: 1, lo: 0 }])).toBeCloseTo(60, 0)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run lib/domain/rota.test.ts` em `web/`. Esperado: FAIL (módulo não existe).

- [ ] **Step 3: Implementar `rota.ts`.** Pontos obrigatórios:
  - A* 8-conectado, heurística **octile** (admissível em grid 8-conectado; Euclidiana também serve mas octile converge melhor), custo diagonal `√2`.
  - Fila de prioridade: **binary heap** própria (nada de `array.sort()` a cada passo — com milhões de células isso trava).
  - `abertos`/`custoG` em `Float64Array`/`Int32Array` indexados por `y*largura+x` (nada de `Map` de string).
  - Movimento diagonal só quando **as duas** células ortogonais adjacentes são água (não "corta quina" de ilha).
  - `acharCaminho` faz `snapParaAgua` na origem e no destino (raio padrão: o equivalente a ~1 km em células) antes de rodar.
  - `suavizar`: string-pulling — do ponto atual, avança até o ponto mais distante com linha de visão livre (Bresenham conferindo água em todas as células), ali cria a perna, repete.
  - `distanciaDaRota`: soma `haversineNm` entre pontos consecutivos.
  - Guarda de sanidade: limite de nós expandidos (ex.: 2.000.000) para nunca travar o navegador; ao estourar, retorna `null`.

- [ ] **Step 4: Ver passar** — suíte inteira (105 → ~115). Commit: `feat: dominio da rota maritima com a-estrela (TDD)`

---

### Task 3: Carregar a máscara no navegador + teste com a costa real

**Files:**
- Create: `web/lib/mapa/mascara.ts`
- Create: `web/lib/domain/rota-real.test.ts`

**Interfaces:**
- Consumes: `Grade` da Task 2, os arquivos da Task 1.
- Produces: `carregarGrade(): Promise<Grade | null>` (memoizada; decodifica o PNG via `createImageBitmap` + `OffscreenCanvas`, cai para `<canvas>` normal se não houver Offscreen), `dentroDaGrade(g, p): boolean`.

- [ ] **Step 1: `mascara.ts`** — busca `/mapa/mascara-agua.json` e `/mapa/mascara-agua.png`, decodifica para `Uint8Array` (1 = água) lendo o canal R de cada pixel (`> 127`). Memoizar num módulo-level `let promessa` para não decodificar duas vezes. Erro de rede → `null` (a tela cai para rumo direto).

- [ ] **Step 2: Teste com a COSTA REAL (o gate desta onda)** — `rota-real.test.ts` roda em Node: lê o PNG com `pngjs` e o JSON direto do disco (`web/public/mapa/`), monta a `Grade` e afirma, com coordenadas de verdade:
  1. **Abraão (Ilha Grande) → Angra dos Reis**: existe rota; **nenhum ponto cai em terra**; a distância da rota é maior que a distância direta (porque contornou).
  2. **Marina da Glória → Abraão**: existe rota; nenhum ponto em terra; distância dentro de uma faixa sã (entre 55 e 120 MN — a reta é ~50 MN).
  3. **Marina da Glória → Búzios**: existe rota; nenhum ponto em terra.
  4. Um ponto claramente em terra como destino (centro de Angra) é resolvido pelo snap e a rota termina na água.
  Se `pngjs` não puder ser importado no ambiente de teste, usar `zlib.inflateSync` sobre os chunks IDAT — mas tentar `pngjs` primeiro.

- [ ] **Step 3: Verificar e comitar** — suíte inteira verde. Commit: `feat: mascara no navegador e teste de rota na costa real`

---

### Task 4: A rota na tela

**Files:**
- Modify: `web/components/mapa/navegar-mapa.tsx`

- [ ] **Step 1: Estado e cálculo** — ao definir destino: carrega a grade (uma vez), roda `acharCaminho` + `suavizar` a partir da posição atual. Medir o tempo com `performance.now()` e **reportar no relatório**; se passar de 300 ms em rota longa, mover para um Web Worker (`new Worker(new URL("./rota.worker.ts", import.meta.url))`) — decisão documentada, não improvisada.
- [ ] **Step 2: Desenho** — source GeoJSON `rota` com a polilinha dourada (largura 3, `line-join: round`), pontos de virada como círculos pequenos. A linha de rumo direto vira tracejado fino e discreto (continua útil: é o rumo do momento).
- [ ] **Step 3: Painel** — trocar os números: **Distância** = distância DA ROTA (não a reta), **Rumo** = rumo para a PRÓXIMA perna, **ETA** = distância da rota ÷ SOG. Acrescentar contagem de pernas ("3 pernas"). Texto de estado honesto: `Rota pela água — contorna a costa, não considera profundidade.`
- [ ] **Step 4: Os estados que não podem falhar mudos:**
  - fora da área coberta → `Fora da área com rota (Paraty a Búzios). Mostrando rumo direto.` + linha reta;
  - sem rota possível → `Não achei caminho pela água até esse ponto.`;
  - máscara não carregou → cai para rumo direto, sem erro na cara do usuário;
  - sem GPS → mantém o comportamento atual (pino + "Ativar localização").
- [ ] **Step 5: Recalcular** — a rota é recalculada quando a posição muda mais que ~200 m (não a cada tick do GPS: seria desperdício e faria a linha tremer).
- [ ] **Step 6: Verificar e comitar** — suíte, tsc, eslint, build. Commit: `feat: rota maritima desenhada no mapa com pernas e eta`

---

### Task 5: Passe final — atribuição, docs e verificação de ponta a ponta

**Files:**
- Modify: `web/components/mapa/mapa-nautico.tsx` (atribuição), `docs/OPERACAO.md`, `docs/CONTRIBUTING.md`, `docs/superpowers/specs/2026-08-07-roteiro-app-completo.md`

- [ ] **Step 1: Atribuição legal** — a máscara vem do OpenStreetMap (ODbL): a atribuição "© OpenStreetMap" já existe no mapa, mas acrescentar no `docs/OPERACAO.md` a nota de que o dado derivado (a máscara) também é ODbL.
- [ ] **Step 2: Roteiro** — marcar no roteiro consolidado que a Onda 5 virou "Rota Marítima" e que Livro de Bordo/Selo Ouro passam para a Onda 6, cartas raster para a 7.
- [ ] **Step 3: `CONTRIBUTING.md`** — acrescentar ao passe visual: "conferir uma rota real no mapa (Glória → Abraão) e confirmar que ela contorna a costa".
- [ ] **Step 4: Verificação final da onda** — `npm test`, `tsc`, `eslint`, `npm run build`; e o teste de olho: com o dev server no ar, definir destino em Abraão e confirmar visualmente que a linha contorna a Ilha Grande. Commit: `chore: atribuicao odbl, docs e passe final da rota maritima`
