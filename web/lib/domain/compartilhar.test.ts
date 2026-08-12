import { describe, expect, it } from "vitest"
import { textoCompartilharSaida } from "./compartilhar"

describe("textoCompartilharSaida", () => {
  it("distância + duração + origem + destino — a frase completa", () => {
    const texto = textoCompartilharSaida({
      distanciaNm: 13.2,
      duracaoH: 3.5,
      origem: "Marina da Glória",
      destino: "Abraão",
    })
    expect(texto).toBe("Saída de 13,2 MN em 3 h 30 min — Marina da Glória → Abraão, pelo Commander")
  })

  it("sem trilha (sem distância), só duração e destino", () => {
    const texto = textoCompartilharSaida({
      distanciaNm: null,
      duracaoH: 2,
      origem: null,
      destino: "Ilha de Búzios",
    })
    expect(texto).toBe("Saída de 2 h — rumo a Ilha de Búzios, pelo Commander")
  })

  it("só distância, sem duração nem destino", () => {
    const texto = textoCompartilharSaida({ distanciaNm: 8, duracaoH: null, origem: null, destino: null })
    expect(texto).toBe("Saída de 8 MN, pelo Commander")
  })

  it("nada registrado além da saída em si — nunca inventa dado", () => {
    const texto = textoCompartilharSaida({ distanciaNm: null, duracaoH: null, origem: null, destino: null })
    expect(texto).toBe("Saída registrada, pelo Commander")
  })

  it("distância zero não conta como distância (trilha sem movimento real)", () => {
    const texto = textoCompartilharSaida({ distanciaNm: 0, duracaoH: 1, origem: null, destino: null })
    expect(texto).toBe("Saída de 1 h, pelo Commander")
  })
})
