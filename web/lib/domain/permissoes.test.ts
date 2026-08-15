import { describe, expect, it } from "vitest"
import { ABAS, PRESETS, ROTULO_ABA, normalizarPermissoes, podeEditar, podeVer } from "./permissoes"

describe("presets", () => {
  it("completo libera tudo", () => {
    for (const aba of ABAS) {
      expect(PRESETS.completo[aba]).toEqual({ ver: true, editar: true })
    }
  })
  it("operacional espelha a espec", () => {
    expect(PRESETS.operacional.motores).toEqual({ ver: true, editar: true })
    expect(PRESETS.operacional.eletrica).toEqual({ ver: true, editar: true })
    expect(PRESETS.operacional.diario).toEqual({ ver: true, editar: true })
    expect(PRESETS.operacional.embarcacao).toEqual({ ver: true, editar: false })
    expect(PRESETS.operacional.casco).toEqual({ ver: true, editar: false })
    expect(PRESETS.operacional.documentos).toEqual({ ver: false, editar: false })
    expect(PRESETS.operacional.fotos).toEqual({ ver: true, editar: true })
    expect(PRESETS.operacional.contatos).toEqual({ ver: false, editar: false })
    expect(PRESETS.operacional.gastos).toEqual({ ver: false, editar: false })
  })
  it("operacional cobre as 4 areas novas da onda 32 (hidraulica/seguranca/equipamentos/historico)", () => {
    expect(PRESETS.operacional.hidraulica).toEqual({ ver: true, editar: true })
    expect(PRESETS.operacional.seguranca).toEqual({ ver: true, editar: false })
    expect(PRESETS.operacional.equipamentos).toEqual({ ver: true, editar: true })
    expect(PRESETS.operacional.historico).toEqual({ ver: true, editar: false })
  })
  it("operacional NAO liga Carteira — quem libera e o proprietario, um a um (PRD §9.4)", () => {
    expect(PRESETS.operacional.carteira).toEqual({ ver: false, editar: false })
  })
  it("operacional espelha Diario na Agenda (onda 46) — quem opera o barco marca a saida", () => {
    expect(PRESETS.operacional.agenda).toEqual({ ver: true, editar: true })
    expect(PRESETS.operacional.agenda).toEqual(PRESETS.operacional.diario)
  })
})

describe("matriz de 15 areas (onda 32 + carteira na onda 42 + agenda na onda 46)", () => {
  it("tem exatamente as 15 areas do PRD, nem mais nem menos", () => {
    expect(ABAS).toHaveLength(15)
    expect([...ABAS].sort()).toEqual([
      "agenda", "carteira", "casco", "contatos", "diario", "documentos", "eletrica", "embarcacao",
      "equipamentos", "fotos", "gastos", "hidraulica", "historico", "motores", "seguranca",
    ])
  })
  it('a Agenda tem area propria — "Gerenciar eventos da embarcacao" (PRD §8) e o `editar` dela', () => {
    expect(ROTULO_ABA.agenda).toBe("Agenda")
    // Ate a onda 45 a Agenda pegava carona em `diario`; agora sao duas areas
    // independentes na matriz (a herança de acesso de quem ja existia e feita
    // uma unica vez, pela migration 047, nao pelo normalizador).
    expect(normalizarPermissoes({ diario: { ver: true, editar: true } }).agenda)
      .toEqual({ ver: false, editar: false })
  })
  it("o Financeiro do PRD e a area `gastos` de sempre — rotulo novo, chave antiga", () => {
    // Trocar a chave quebraria o acesso de todo vinculo ja gravado no banco.
    expect(ROTULO_ABA.gastos).toBe("Financeiro")
    expect(ROTULO_ABA.carteira).toBe("Carteira da Tripulação")
  })
  it("vinculo sem a chave `carteira` (todos os de hoje) nao ganha Carteira de graca", () => {
    expect(normalizarPermissoes({ gastos: { ver: true, editar: true } }).carteira)
      .toEqual({ ver: false, editar: false })
  })
  it("vinculo CMDT antigo (sem as 4 chaves novas) nao ganha acesso indevido — vira tudo falso nas areas novas", () => {
    // Simula um vinculo salvo ANTES da onda 32: so as 9 chaves de entao.
    const permissoesAntigas = {
      embarcacao: { ver: true, editar: false },
      motores: { ver: true, editar: true },
      eletrica: { ver: true, editar: true },
      casco: { ver: true, editar: true },
      documentos: { ver: true, editar: true },
      fotos: { ver: true, editar: true },
      contatos: { ver: true, editar: true },
      gastos: { ver: true, editar: true },
      diario: { ver: true, editar: true },
    }
    const p = normalizarPermissoes(permissoesAntigas)
    // areas de sempre: acesso preservado, identico ao que ja era
    expect(p.motores).toEqual({ ver: true, editar: true })
    expect(p.eletrica).toEqual({ ver: true, editar: true })
    expect(p.casco).toEqual({ ver: true, editar: true })
    // areas novas: sem chave no jsonb antigo -> nada (nunca acesso de graca)
    expect(p.hidraulica).toEqual({ ver: false, editar: false })
    expect(p.seguranca).toEqual({ ver: false, editar: false })
    expect(p.equipamentos).toEqual({ ver: false, editar: false })
    expect(p.historico).toEqual({ ver: false, editar: false })
  })
})

describe("normalizarPermissoes", () => {
  it("preenche abas faltantes com nada", () => {
    const p = normalizarPermissoes({ motores: { ver: true } })
    expect(p.motores).toEqual({ ver: true, editar: false })
    expect(p.documentos).toEqual({ ver: false, editar: false })
  })
  it("editar implica ver", () => {
    const p = normalizarPermissoes({ casco: { editar: true } })
    expect(p.casco).toEqual({ ver: true, editar: true })
  })
  it("lixo vira tudo falso", () => {
    const p = normalizarPermissoes("qualquer coisa")
    for (const aba of ABAS) {
      expect(p[aba]).toEqual({ ver: false, editar: false })
    }
  })
})

describe("podeVer/podeEditar", () => {
  it("null (PROP) libera tudo", () => {
    expect(podeVer(null, "gastos")).toBe(true)
    expect(podeEditar(null, "documentos")).toBe(true)
  })
  it("matriz manda para CMDT", () => {
    expect(podeVer(PRESETS.operacional, "documentos")).toBe(false)
    expect(podeEditar(PRESETS.operacional, "motores")).toBe(true)
    expect(podeEditar(PRESETS.operacional, "casco")).toBe(false)
  })
})
