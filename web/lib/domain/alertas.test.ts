import { describe, expect, it } from "vitest"
import { alertaDeMar, cicloRef, janelaDoAlerta, lembreteMotorParado, textoDoAlerta } from "./alertas"

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

describe("alertaDeMar", () => {
  it("mar pesado avisa, com onda e vento no corpo", () => {
    const a = alertaDeMar({ ondaM: 2.5, ventoKt: 25, selo: { nivel: "crit", rotulo: "Mar pesado" } }, "2026-08-08")
    expect(a).not.toBeNull()
    expect(a!.corpo).toBe("Mar ruim na sua marina hoje — onda 2,5 m e vento 25 kt.")
    expect(a!.janela).toBe("mar_ruim")
    expect(a!.cicloRef).toBe("2026-08-08") // ciclo = o dia, dedupe garante 1x/dia
  })
  it("ok ou atencao nao avisa — so mar pesado justifica interromper o dono", () => {
    expect(alertaDeMar({ ondaM: 0.5, ventoKt: 10, selo: { nivel: "ok", rotulo: "Bom pra sair" } }, "2026-08-08")).toBeNull()
    expect(alertaDeMar({ ondaM: 1.5, ventoKt: 12, selo: { nivel: "atencao", rotulo: "Atenção no mar" } }, "2026-08-08")).toBeNull()
  })
  it("com so um dado disponivel, o corpo fala so do que tem", () => {
    const soOnda = alertaDeMar({ ondaM: 2.1, ventoKt: null, selo: { nivel: "crit", rotulo: "Mar pesado" } }, "2026-08-08")
    expect(soOnda!.corpo).toBe("Mar ruim na sua marina hoje — onda 2,1 m.")
    const soVento = alertaDeMar({ ondaM: null, ventoKt: 30, selo: { nivel: "crit", rotulo: "Mar pesado" } }, "2026-08-08")
    expect(soVento!.corpo).toBe("Mar ruim na sua marina hoje — vento 30 kt.")
  })
})

describe("lembreteMotorParado", () => {
  it("mais de 30 dias sem leitura sugere aquecer o motor", () => {
    const a = lembreteMotorParado("2026-07-01", "2026-08-08")
    expect(a).not.toBeNull()
    expect(a!.janela).toBe("motor_parado")
    expect(a!.corpo).toContain("38 dias")
    expect(a!.cicloRef).toBe("2026-07-01") // reancora quando uma leitura nova chegar
  })
  it("dentro dos 30 dias nao incomoda", () => {
    expect(lembreteMotorParado("2026-07-20", "2026-08-08")).toBeNull() // 19 dias
    expect(lembreteMotorParado("2026-07-09", "2026-08-08")).toBeNull() // 30 dias exatos, na margem
  })
  it("sem nenhuma leitura registrada, nao inventa uma data de partida", () => {
    expect(lembreteMotorParado(null, "2026-08-08")).toBeNull()
  })
  it("aceita timestamptz na leitura (so a data importa)", () => {
    const a = lembreteMotorParado("2026-07-01T14:32:00+00:00", "2026-08-08")
    expect(a).not.toBeNull()
    expect(a!.corpo).toContain("38 dias")
  })
})
