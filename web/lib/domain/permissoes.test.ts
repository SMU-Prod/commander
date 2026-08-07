import { describe, expect, it } from "vitest"
import { ABAS, PRESETS, normalizarPermissoes, podeEditar, podeVer } from "./permissoes"

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
    expect(PRESETS.operacional.contatos).toEqual({ ver: false, editar: false })
    expect(PRESETS.operacional.gastos).toEqual({ ver: false, editar: false })
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
