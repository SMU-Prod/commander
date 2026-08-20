import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

/**
 * O GUARDIÃO DA ESCALA TIPOGRÁFICA.
 * ===========================================================================
 * ORIGEM: o dono, em 20/08/2026 — *"REVISE TODAS FONTES DO APP ACHO QUE TEMOS
 * FONTES ERRADAS ANTIGAS"*. Ele estava certo, e a medida foi feita antes de
 * qualquer conserto: **19 tamanhos distintos** rodavam no app —
 * 10, 11, 11.5, 12, 13, 14, 15, 16, 17, 18, 20, 24, 26, 28, 30, 32, 34, 36 e
 * 48 — contra os SEIS degraus que o §4 do Guia de Design declara.
 *
 * Nenhum deles foi decidido: cada um entrou numa onda diferente, resolvendo um
 * caso, e ninguém tinha como ver a soma. `11.5px` existia em um arquivo só.
 *
 * ---------------------------------------------------------------------------
 * A ESCALA, E DE ONDE ELA SAI
 * ---------------------------------------------------------------------------
 * §4 do guia, literal:
 *   mobile   12 rótulo · 14 corpo · 16 componente · 20 subtítulo · 24 título ·
 *            28–32 métrica
 *   desktop  12 · 14 · 16 · 22 subtítulo · 30–32 título · 32–40 métrica
 *
 * A união dos dois, que é o que um app responsivo com os MESMOS componentes
 * pode usar, dá a lista abaixo. Nada fora dela passa.
 *
 * ---------------------------------------------------------------------------
 * POR QUE UM TETO POR ARQUIVO, E NÃO UMA PROIBIÇÃO SECA
 * ---------------------------------------------------------------------------
 * Mesma mecânica do teto de cor literal (`tokens.test.ts`) e pelo mesmo
 * motivo: proibir de vez reprovaria o app inteiro no primeiro dia e o teste
 * seria desligado na primeira pressa. O teto SÓ DESCE — as exceções de hoje
 * ficam onde estão, com o porquê escrito, e a conta não pode crescer.
 *
 * COMO MEXER NESTE MAPA: baixando um número (você tirou uma exceção) ou
 * apagando uma linha (o arquivo zerou). Subir um número ou acrescentar uma
 * linha é inventar um degrau — se for mesmo inevitável, escreva o porquê no
 * commit, porque a linha vai ficar aqui até alguém apagá-la.
 */
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")

/** Os degraus do §4, em px. */
const ESCALA = new Set([12, 14, 16, 20, 22, 24, 28, 30, 32, 36, 40])

/** A tabela do Tailwind, para traduzir `text-sm` no número que ele vale. */
const TAILWIND: Record<string, number> = {
  xs: 12, sm: 14, base: 16, lg: 18, xl: 20,
  "2xl": 24, "3xl": 30, "4xl": 36, "5xl": 48, "6xl": 60, "7xl": 72,
}

/**
 * As exceções que sobrevivem, com o motivo. Nenhuma é "achei melhor assim".
 */
const TETO_POR_ARQUIVO: Record<string, number> = {
  // `text-lg` (18px) — o wordmark é dimensionado por QUEM CHAMA (o comentário
  // do próprio arquivo explica: `text-lg` no painel do parceiro, `text-base`
  // nas telas de convite, `text-sm` no login), com o símbolo ao lado medindo
  // 1.6em do mesmo corpo. Congelar num degrau quebraria o par palavra+símbolo.
  "components/logo.tsx": 1,
  // `text-lg` num círculo de 56px: o número de pendências do escudo. 20px
  // estoura o círculo e 16 deixa o escudo com um ponto no meio. É o único
  // lugar do app onde o tamanho é ditado pelo continente, não pela escala.
  "components/card-embarcacao.tsx": 1,
  // `text-lg` no cartão flutuante sobre o mapa. O instrumento tem escala
  // própria desde a onda 24 (chão navy fixo, cores próprias); a tipografia
  // dele segue a mesma lógica e está fora da escala de PÁGINA de propósito.
  "components/mapa/navegar-mapa.tsx": 1,
}

function arquivosTsx(dir: string, achados: string[] = []): string[] {
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    if (entrada.name === "node_modules" || entrada.name.startsWith(".")) continue
    const completo = path.join(dir, entrada.name)
    if (entrada.isDirectory()) arquivosTsx(completo, achados)
    else if (entrada.name.endsWith(".tsx")) achados.push(completo)
  }
  return achados
}

/** Os tamanhos fora da escala citados num arquivo, já em px. */
function foraDaEscala(fonte: string): number[] {
  const fora: number[] = []
  for (const m of fonte.matchAll(/\btext-\[(\d+(?:\.\d+)?)px\]/g)) {
    const px = Number(m[1])
    if (!ESCALA.has(px)) fora.push(px)
  }
  for (const m of fonte.matchAll(/\btext-(xs|sm|base|lg|xl|[2-7]xl)\b/g)) {
    const px = TAILWIND[m[1]]
    if (px !== undefined && !ESCALA.has(px)) fora.push(px)
  }
  return fora
}

describe("tipografia", () => {
  const arquivos = arquivosTsx(path.join(RAIZ, "app"))
    .concat(arquivosTsx(path.join(RAIZ, "components")))

  it("nenhum arquivo cita mais tamanho fora da escala do que já citava", () => {
    const cresceram: string[] = []
    for (const completo of arquivos) {
      const rel = path.relative(RAIZ, completo).replace(/\\/g, "/")
      const quantos = foraDaEscala(readFileSync(completo, "utf-8")).length
      const teto = TETO_POR_ARQUIVO[rel] ?? 0
      if (quantos > teto) {
        const lista = [...new Set(foraDaEscala(readFileSync(completo, "utf-8")))].sort((a, b) => a - b)
        cresceram.push(`  ${rel}: ${teto} → ${quantos} (${lista.join("px, ")}px)`)
      }
    }
    expect(
      cresceram,
      "Tamanho de fonte fora da escala do §4 do Guia de Design.\n" +
        `Os degraus são: ${[...ESCALA].sort((a, b) => a - b).join(", ")}px.\n` +
        cresceram.join("\n") +
        "\nUse o degrau mais próximo. Se o caso for mesmo especial, " +
        "acrescente a linha em TETO_POR_ARQUIVO com o motivo — e espere ser cobrado por ele.",
    ).toEqual([])
  })

  it("o mapa de exceções não guarda arquivo que já foi consertado", () => {
    // Sem isto, uma exceção paga continua no mapa dizendo "aqui pode" para
    // quem for editar o arquivo depois — que é como um teto vira permissão.
    for (const [rel, teto] of Object.entries(TETO_POR_ARQUIVO)) {
      const quantos = foraDaEscala(readFileSync(path.join(RAIZ, rel), "utf-8")).length
      expect(
        quantos,
        `${rel} está com teto ${teto} e cita ${quantos}. Baixe o teto — ele só desce.`,
      ).toBe(teto)
    }
  })

  it("o app carrega DUAS famílias, e as duas são declaradas", () => {
    // §16: "uma única família tipográfica em toda a aplicação". A casa tem
    // duas, e a segunda é desvio declarado em `docs/DESIGN-SYSTEM.md` §15.2:
    // Inter para tudo, IBM Plex Mono para o numeral de instrumento. Este teste
    // impede a TERCEIRA — que é como a escala de tamanho chegou a 19 degraus.
    const layout = readFileSync(path.join(RAIZ, "app/layout.tsx"), "utf-8")
    const familias = [...layout.matchAll(/import \{([^}]+)\} from "next\/font\/google"/g)]
      .flatMap((m) => m[1].split(",").map((s) => s.trim()))
      .filter(Boolean)
    expect(familias.sort()).toEqual(["IBM_Plex_Mono", "Inter"])
  })

  it("o CSS não declara família fora das duas", () => {
    const css = readFileSync(path.join(RAIZ, "app/globals.css"), "utf-8")
    const declaradas = [...css.matchAll(/font-family:\s*([^;]+);/g)].map((m) => m[1].trim())
    for (const d of declaradas) {
      expect(
        d.startsWith("var(--font-sans-app)") || d.startsWith("var(--pilha-mono-instr)"),
        `font-family fora das duas pilhas declaradas: "${d}"`,
      ).toBe(true)
    }
  })
})
