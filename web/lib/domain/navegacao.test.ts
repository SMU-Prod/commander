import { describe, expect, it } from "vitest"
import { etaMinutos, foraDoRaio, msParaNos, rumoGraus, tempoDesde } from "./navegacao"

describe("navegacao", () => {
  it("converte m/s do GPS para nos", () => {
    expect(msParaNos(10)).toBeCloseTo(19.44, 1)
    expect(msParaNos(0)).toBe(0)
    expect(msParaNos(null)).toBeNull()
  })
  it("rumo verdadeiro entre dois pontos (0=N, 90=E, 180=S, 270=W)", () => {
    expect(rumoGraus({ la: 0, lo: 0 }, { la: 1, lo: 0 })).toBeCloseTo(0, 0)
    expect(rumoGraus({ la: 0, lo: 0 }, { la: 0, lo: 1 })).toBeCloseTo(90, 0)
    expect(rumoGraus({ la: 0, lo: 0 }, { la: -1, lo: 0 })).toBeCloseTo(180, 0)
    expect(rumoGraus({ la: 0, lo: 0 }, { la: 0, lo: -1 })).toBeCloseTo(270, 0)
  })
  it("eta em minutos na velocidade atual; sem eta quase parado", () => {
    expect(etaMinutos(10, 20)).toBe(30)
    expect(etaMinutos(3.5, 7)).toBe(30)
    expect(etaMinutos(10, 0.4)).toBeNull()
    expect(etaMinutos(0, 10)).toBe(0)
  })
  it("alarme de ancora dispara fora do raio", () => {
    const ancora = { la: -23.0, lo: -44.3 }
    expect(foraDoRaio(ancora, ancora, 30)).toBe(false)
    // ~111m ao norte (0.001 grau de latitude)
    expect(foraDoRaio(ancora, { la: -22.999, lo: -44.3 }, 50)).toBe(true)
    expect(foraDoRaio(ancora, { la: -22.999, lo: -44.3 }, 200)).toBe(false)
  })
  it("tempoDesde legivel em pt-BR", () => {
    expect(tempoDesde("2026-08-07T10:00:00Z", "2026-08-07T10:30:00Z")).toBe("há 30 min")
    expect(tempoDesde("2026-08-07T07:00:00Z", "2026-08-07T10:00:00Z")).toBe("há 3 h")
    expect(tempoDesde("2026-08-04T10:00:00Z", "2026-08-07T10:00:00Z")).toBe("há 3 dias")
    expect(tempoDesde("2026-08-07T09:59:40Z", "2026-08-07T10:00:00Z")).toBe("agora há pouco")
  })
})
