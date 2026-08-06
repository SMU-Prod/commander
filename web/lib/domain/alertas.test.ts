import { describe, expect, it } from "vitest"
import { cicloRef, janelaDoAlerta, textoDoAlerta } from "./alertas"

const r = (p: Partial<{ status: "ok" | "atencao" | "vencido"; horasRestantes: number | null; diasRestantes: number | null }>) => ({
  status: "ok" as const, horasRestantes: null, diasRestantes: null, ...p,
})

describe("janelaDoAlerta", () => {
  it("horas vencidas mandam", () => {
    expect(janelaDoAlerta(r({ status: "vencido", horasRestantes: -3.4, diasRestantes: 200 }))).toBe("h_vencido")
  })
  it("data vencida", () => {
    expect(janelaDoAlerta(r({ status: "vencido", diasRestantes: -2 }))).toBe("vencido")
  })
  it("janelas de dias: 5, 15, 30", () => {
    expect(janelaDoAlerta(r({ status: "atencao", diasRestantes: 4 }))).toBe("d5")
    expect(janelaDoAlerta(r({ status: "atencao", diasRestantes: 12 }))).toBe("d15")
    expect(janelaDoAlerta(r({ status: "atencao", diasRestantes: 30 }))).toBe("d30")
  })
  it("margem de horas quando não há janela de dias", () => {
    expect(janelaDoAlerta(r({ status: "atencao", horasRestantes: 37, diasRestantes: null }))).toBe("h_margem")
    expect(janelaDoAlerta(r({ status: "atencao", horasRestantes: 37, diasRestantes: 200 }))).toBe("h_margem")
  })
  it("ok não alerta", () => {
    expect(janelaDoAlerta(r({ status: "ok", horasRestantes: 400, diasRestantes: 200 }))).toBeNull()
  })
})

describe("cicloRef", () => {
  it("combina os marcos do ciclo", () => {
    expect(cicloRef({ data_fixa: "2026-08-17", ultimo_ciclo_data: null, ultimo_ciclo_horas: null })).toBe("2026-08-17||")
    expect(cicloRef({ data_fixa: null, ultimo_ciclo_data: "2026-07-19", ultimo_ciclo_horas: 1490 })).toBe("|2026-07-19|1490")
  })
})

describe("textoDoAlerta", () => {
  it("vencido por horas", () => {
    const t = textoDoAlerta("Revisão geral", "Motor BB", "h_vencido", r({ horasRestantes: -3.4 }))
    expect(t.titulo).toBe("🔴 Revisão geral — Motor BB")
    expect(t.corpo).toBe("Vencido há 3 h de uso.")
  })
  it("janela de dias", () => {
    const t = textoDoAlerta("Seguro da embarcação", null, "d15", r({ diasRestantes: 12 }))
    expect(t.titulo).toBe("🟡 Seguro da embarcação")
    expect(t.corpo).toBe("Vence em 12 dias.")
  })
  it("margem de horas", () => {
    const t = textoDoAlerta("Troca de óleo e filtros", "Motor BE", "h_margem", r({ horasRestantes: 37 }))
    expect(t.corpo).toBe("Faltam 37 h de uso.")
  })
  it("vencido por data", () => {
    const t = textoDoAlerta("TIE", null, "vencido", r({ diasRestantes: -8 }))
    expect(t.corpo).toBe("Vencido há 8 dias.")
  })
})
