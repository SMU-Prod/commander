import { describe, expect, it } from "vitest"
import { destinoSeguro } from "./destino"

describe("destinoSeguro", () => {
  it("preserva paths legítimos", () => {
    expect(destinoSeguro("/convite/ABC", "/hoje")).toBe("/convite/ABC")
    expect(destinoSeguro("/convite/ABC?x=1", "/hoje")).toBe("/convite/ABC?x=1")
    expect(destinoSeguro("/hoje", "/onboarding")).toBe("/hoje")
  })
  it("rejeita destinos absolutos e vazios", () => {
    expect(destinoSeguro("http://evil.com", "/hoje")).toBe("/hoje")
    expect(destinoSeguro("", "/hoje")).toBe("/hoje")
    expect(destinoSeguro(null, "/hoje")).toBe("/hoje")
  })
  it("rejeita network-path direto e via backslash", () => {
    expect(destinoSeguro("//evil.com", "/hoje")).toBe("/hoje")
    expect(destinoSeguro("/\\evil.com", "/hoje")).toBe("/hoje")
  })
  it("rejeita caracteres de controle que o parser descarta", () => {
    expect(destinoSeguro("/\t/evil.com", "/hoje")).toBe("/hoje")
    expect(destinoSeguro("/\n/evil.com", "/hoje")).toBe("/hoje")
    expect(destinoSeguro("/\r/evil.com", "/hoje")).toBe("/hoje")
  })
  it("rejeita dot-segments que produzem pathname scheme-relative", () => {
    expect(destinoSeguro("/..//evil.com", "/hoje")).toBe("/hoje")
    expect(destinoSeguro("/%2e%2e//evil.com", "/hoje")).toBe("/hoje")
    expect(destinoSeguro("/a/..//evil.com", "/hoje")).toBe("/hoje")
  })
})
