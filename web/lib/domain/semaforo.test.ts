import { describe, expect, it } from "vitest"
import { calcularSemaforo, textoRestante } from "./semaforo"

const HOJE = "2026-08-05"

describe("por horas", () => {
  // Exemplo da espec: motor BB a 1.503 h, revisão a cada 500 h, última a 1.000 h
  it("vencido quando passou do limite", () => {
    const r = calcularSemaforo(
      { intervaloHoras: 500, intervaloMeses: null, dataFixa: null, ultimoCicloData: null, ultimoCicloHoras: 1000 },
      1503.4,
      HOJE,
    )
    expect(r.status).toBe("vencido")
    expect(r.horasRestantes).toBeCloseTo(-3.4)
  })

  // Exemplo da espec: óleo BE, 250 h de intervalo, faltam 37 h (margem = 15% de 250 = 37,5)
  it("atenção dentro da margem de 15% do intervalo", () => {
    const r = calcularSemaforo(
      { intervaloHoras: 250, intervaloMeses: null, dataFixa: null, ultimoCicloData: null, ultimoCicloHoras: 1276 },
      1489,
      HOJE,
    )
    expect(r.status).toBe("atencao")
    expect(r.horasRestantes).toBe(37)
  })

  it("ok quando a folga é maior que a margem", () => {
    const r = calcularSemaforo(
      { intervaloHoras: 500, intervaloMeses: null, dataFixa: null, ultimoCicloData: null, ultimoCicloHoras: 1000 },
      1100,
      HOJE,
    )
    expect(r.status).toBe("ok")
    expect(r.horasRestantes).toBe(400)
  })

  it("sem leitura de horas atuais, não avalia por horas", () => {
    const r = calcularSemaforo(
      { intervaloHoras: 500, intervaloMeses: null, dataFixa: null, ultimoCicloData: null, ultimoCicloHoras: 1000 },
      null,
      HOJE,
    )
    expect(r.status).toBe("ok")
    expect(r.horasRestantes).toBeNull()
  })
})

describe("por data", () => {
  it("atenção a 30 dias ou menos do vencimento (data fixa)", () => {
    const r = calcularSemaforo(
      { intervaloHoras: null, intervaloMeses: null, dataFixa: "2026-08-17", ultimoCicloData: null, ultimoCicloHoras: null },
      null,
      HOJE,
    )
    expect(r.status).toBe("atencao")
    expect(r.diasRestantes).toBe(12)
  })

  it("vencido no dia seguinte ao vencimento", () => {
    const r = calcularSemaforo(
      { intervaloHoras: null, intervaloMeses: null, dataFixa: "2026-08-04", ultimoCicloData: null, ultimoCicloHoras: null },
      null,
      HOJE,
    )
    expect(r.status).toBe("vencido")
    expect(r.diasRestantes).toBe(-1)
  })

  it("intervalo em meses conta a partir do último ciclo", () => {
    // antifouling: aplicado 2025-06-10, a cada 18 meses → vence 2026-12-10
    const r = calcularSemaforo(
      { intervaloHoras: null, intervaloMeses: 18, dataFixa: null, ultimoCicloData: "2025-06-10", ultimoCicloHoras: null },
      null,
      HOJE,
    )
    expect(r.status).toBe("ok")
    expect(r.diasRestantes).toBe(127)
  })

  it("soma de meses respeita fim de mês", () => {
    // 31/jan + 1 mês → 28/fev (não 2-3/mar)
    const r = calcularSemaforo(
      { intervaloHoras: null, intervaloMeses: 1, dataFixa: null, ultimoCicloData: "2026-01-31", ultimoCicloHoras: null },
      null,
      "2026-02-28",
    )
    expect(r.diasRestantes).toBe(0)
    expect(r.status).toBe("atencao")
  })
})

describe("combinado — o que vencer primeiro manda", () => {
  it("pior status vence: horas ok + data vencida = vencido", () => {
    const r = calcularSemaforo(
      { intervaloHoras: 250, intervaloMeses: 12, dataFixa: null, ultimoCicloData: "2025-06-01", ultimoCicloHoras: 1400 },
      1450,
      HOJE,
    )
    expect(r.status).toBe("vencido") // 12 meses de 2025-06-01 = 2026-06-01, já passou
  })
})

describe("textoRestante", () => {
  it("data vencida com horas ok mostra o vencimento", () => {
    expect(textoRestante({ status: "vencido", horasRestantes: 150, diasRestantes: -36 })).toBe("vencido há 36 dias")
  })
  it("horas vencidas com data ok mostra o vencimento", () => {
    expect(textoRestante({ status: "vencido", horasRestantes: -50, diasRestantes: 298 })).toBe("vencido há 50 h")
  })
  it("combinado em dia mostra os dois prazos", () => {
    expect(textoRestante({ status: "ok", horasRestantes: 213, diasRestantes: 298 })).toBe("em 213 h ou 298 dias")
  })
  it("só data", () => {
    expect(textoRestante({ status: "atencao", horasRestantes: null, diasRestantes: 12 })).toBe("em 12 dias")
  })
  it("só horas", () => {
    expect(textoRestante({ status: "atencao", horasRestantes: 37, diasRestantes: null })).toBe("em 37 h")
  })
})
