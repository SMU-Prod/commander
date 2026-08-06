import { describe, expect, it } from "vitest"
import { avaliarMar } from "./mar"

describe("avaliarMar", () => {
  it("mar calmo e vento fraco liberam", () => {
    expect(avaliarMar(0.8, 12)).toEqual({ nivel: "ok", rotulo: "Bom pra sair" })
  })
  it("onda ou vento medianos pedem atenção", () => {
    expect(avaliarMar(1.5, 12).nivel).toBe("atencao")
    expect(avaliarMar(0.8, 20).nivel).toBe("atencao")
    expect(avaliarMar(1.5, 20).rotulo).toBe("Atenção no mar")
  })
  it("mar pesado bloqueia", () => {
    expect(avaliarMar(2.2, 12)).toEqual({ nivel: "crit", rotulo: "Mar pesado" })
    expect(avaliarMar(1.0, 28).nivel).toBe("crit")
  })
  it("sem nenhum dado, informa", () => {
    expect(avaliarMar(null, null)).toEqual({ nivel: "atencao", rotulo: "Sem dados do mar" })
  })
  it("dado parcial avalia com o que tem", () => {
    expect(avaliarMar(0.5, null).nivel).toBe("ok")
    expect(avaliarMar(null, 30).nivel).toBe("crit")
  })
})
