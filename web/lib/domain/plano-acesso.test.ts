import { describe, expect, it } from "vitest"
import {
  BENEFICIOS_PREMIUM, LIMITES_FREE, mensagemBloqueio, nivelPlano, recursoLiberado,
} from "./plano-acesso"

const HOJE = "2026-08-14"

describe("nivelPlano", () => {
  it("sem assinatura e sem concessao e Free", () => {
    expect(nivelPlano({ assinaturaAtiva: false, concessaoValidoAte: null }, HOJE)).toBe("free")
  })
  it("assinatura ativa e Premium", () => {
    expect(nivelPlano({ assinaturaAtiva: true, concessaoValidoAte: null }, HOJE)).toBe("premium")
  })
  it("carencia (inadimplente) ja conta como Premium — mesmo sinal que ja entra aqui como assinaturaAtiva", () => {
    // quem monta o SinalPlano (web/lib/consultas.ts) trata status "ativa"
    // OU "inadimplente" como assinaturaAtiva=true — o dominio so ve o booleano.
    expect(nivelPlano({ assinaturaAtiva: true, concessaoValidoAte: null }, HOJE)).toBe("premium")
  })
  it("concessao vigente (Gold) e Premium mesmo sem assinatura", () => {
    expect(nivelPlano({ assinaturaAtiva: false, concessaoValidoAte: "2026-12-31" }, HOJE)).toBe("premium")
  })
  it("concessao que vence HOJE ainda vale (>=)", () => {
    expect(nivelPlano({ assinaturaAtiva: false, concessaoValidoAte: HOJE }, HOJE)).toBe("premium")
  })
  it("concessao expirada e Free", () => {
    expect(nivelPlano({ assinaturaAtiva: false, concessaoValidoAte: "2026-01-01" }, HOJE)).toBe("free")
  })
  it("assinatura E concessao expirada juntas: assinatura decide sozinha", () => {
    expect(nivelPlano({ assinaturaAtiva: true, concessaoValidoAte: "2020-01-01" }, HOJE)).toBe("premium")
  })
})

describe("recursoLiberado", () => {
  it("Premium libera tudo, mesmo recurso tudo-ou-nada", () => {
    expect(recursoLiberado("diario_registros", "premium", 999)).toBe(true)
    expect(recursoLiberado("fotos", "premium", 999)).toBe(true)
    expect(recursoLiberado("compartilhar_saida", "premium")).toBe(true)
  })

  it("compartilhar_saida e tudo-ou-nada no Free: nunca libera, nao importa a contagem", () => {
    expect(recursoLiberado("compartilhar_saida", "free")).toBe(false)
  })

  it("diario_registros no Free respeita o teto exato de LIMITES_FREE", () => {
    expect(recursoLiberado("diario_registros", "free", 0)).toBe(true)
    expect(recursoLiberado("diario_registros", "free", LIMITES_FREE.diarioRegistros - 1)).toBe(true)
    expect(recursoLiberado("diario_registros", "free", LIMITES_FREE.diarioRegistros)).toBe(false)
    expect(recursoLiberado("diario_registros", "free", LIMITES_FREE.diarioRegistros + 5)).toBe(false)
  })

  it("fotos no Free respeita o teto exato de LIMITES_FREE", () => {
    expect(recursoLiberado("fotos", "free", LIMITES_FREE.fotos - 1)).toBe(true)
    expect(recursoLiberado("fotos", "free", LIMITES_FREE.fotos)).toBe(false)
  })

  it("usoAtual omitido conta como 0 (libera no Free)", () => {
    expect(recursoLiberado("diario_registros", "free")).toBe(true)
    expect(recursoLiberado("fotos", "free")).toBe(true)
  })
})

describe("mensagemBloqueio", () => {
  it("sempre devolve titulo e descricao nao vazios pra cada recurso", () => {
    for (const recurso of ["diario_registros", "fotos", "compartilhar_saida"] as const) {
      const msg = mensagemBloqueio(recurso)
      expect(msg.titulo.length).toBeGreaterThan(0)
      expect(msg.descricao.length).toBeGreaterThan(0)
    }
  })
  it("com usoAtual, a descricao menciona quanto ja foi usado", () => {
    expect(mensagemBloqueio("diario_registros", 20).descricao).toContain("20")
    expect(mensagemBloqueio("fotos", 8).descricao).toContain("8")
  })
  it("compartilhar_saida ignora usoAtual (tudo-ou-nada, nunca fala em numero)", () => {
    expect(mensagemBloqueio("compartilhar_saida", 3).descricao).not.toMatch(/\d/)
  })
})

describe("BENEFICIOS_PREMIUM", () => {
  it("tem pelo menos um beneficio por recurso controlado", () => {
    expect(BENEFICIOS_PREMIUM.length).toBeGreaterThanOrEqual(3)
  })
})
