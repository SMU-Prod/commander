import { describe, expect, it } from "vitest"
import {
  buscarModelos,
  faixaDeAno,
  identidadeDoMotor,
  nomeCompletoDoModelo,
  partNumberVigente,
  planoSugerido,
  ROTULO_SISTEMA,
  SISTEMAS_MOTOR,
  type ModeloCatalogo,
} from "./catalogo-motor"

const modelo = (over: Partial<ModeloCatalogo> = {}): ModeloCatalogo => ({
  id: "m1",
  nome: "D6-440",
  potenciaHp: 440,
  anoInicio: 2015,
  anoFim: null,
  familia: "D6",
  fabricante: "Volvo Penta",
  ...over,
})

describe("catálogo de motor", () => {
  describe("vocabulário", () => {
    it("todo sistema tem rótulo", () => {
      for (const s of SISTEMAS_MOTOR) {
        expect(ROTULO_SISTEMA[s], s).toBeTruthy()
      }
    })
  })

  describe("nomeCompletoDoModelo", () => {
    it("não repete a família quando o modelo já começa por ela", () => {
      // "Volvo Penta D6 D6-440" seria o resultado de concatenar às cegas.
      expect(nomeCompletoDoModelo(modelo())).toBe("Volvo Penta D6-440")
    })

    it("inclui a família quando ela não está no nome do modelo", () => {
      expect(nomeCompletoDoModelo(modelo({ familia: "Verado", nome: "400", fabricante: "Mercury" })))
        .toBe("Mercury Verado 400")
    })

    it("a comparação com a família ignora separador e caixa", () => {
      // Família "D6", modelo "d6 440": normalizado, o modelo começa pela
      // família — a família não pode aparecer duas vezes só porque o dono
      // digitou com espaço e minúscula.
      expect(nomeCompletoDoModelo(modelo({ nome: "d6 440" }))).toBe("Volvo Penta d6 440")
    })
  })

  describe("identidadeDoMotor", () => {
    it("o catálogo ganha do texto livre", () => {
      expect(identidadeDoMotor({ marca: "volvo", modelo: "d6" }, modelo()))
        .toBe("Volvo Penta D6-440")
    })

    it("sem catálogo, vale o que o dono escreveu", () => {
      expect(identidadeDoMotor({ marca: "Yanmar", modelo: "6LY3" }, null)).toBe("Yanmar 6LY3")
    })

    it("só marca, sem modelo, ainda é identidade", () => {
      expect(identidadeDoMotor({ marca: "Yanmar", modelo: null }, null)).toBe("Yanmar")
    })

    it("sem catálogo e sem texto, devolve null — a ficha diz — e não inventa", () => {
      expect(identidadeDoMotor({ marca: null, modelo: null }, null)).toBeNull()
      expect(identidadeDoMotor({ marca: "   ", modelo: "" }, null)).toBeNull()
    })
  })

  describe("faixaDeAno", () => {
    it("as duas pontas viram intervalo", () => {
      expect(faixaDeAno({ anoInicio: 2015, anoFim: 2021 })).toBe("2015–2021")
    })

    it("pontas iguais viram um ano só, não '2015–2015'", () => {
      expect(faixaDeAno({ anoInicio: 2015, anoFim: 2015 })).toBe("2015")
    })

    it("motor em linha não tem ano final", () => {
      expect(faixaDeAno({ anoInicio: 2015, anoFim: null })).toBe("desde 2015")
    })

    it("motor antigo pode não ter ano inicial conhecido", () => {
      expect(faixaDeAno({ anoInicio: null, anoFim: 2010 })).toBe("até 2010")
    })

    it("sem nenhuma ponta, null — não finge faixa", () => {
      expect(faixaDeAno({ anoInicio: null, anoFim: null })).toBeNull()
    })
  })

  describe("partNumberVigente", () => {
    it("o do dono ganha do catálogo — ele pode usar equivalente de fornecedor", () => {
      expect(partNumberVigente("WIX-51334", "3838852")).toBe("WIX-51334")
    })

    it("sem o do dono, vale o OEM do catálogo", () => {
      expect(partNumberVigente(null, "3838852")).toBe("3838852")
    })

    it("string em branco no item não vence o catálogo", () => {
      expect(partNumberVigente("   ", "3838852")).toBe("3838852")
    })

    it("sem nenhum dos dois, null", () => {
      expect(partNumberVigente(null, null)).toBeNull()
    })
  })

  describe("planoSugerido", () => {
    it("devolve os dois intervalos quando existem", () => {
      expect(planoSugerido({ intervaloHoras: 250, intervaloMeses: 12 }))
        .toEqual({ intervaloHoras: 250, intervaloMeses: 12 })
    })

    it("um intervalo só ainda é plano", () => {
      expect(planoSugerido({ intervaloHoras: 500, intervaloMeses: null }))
        .toEqual({ intervaloHoras: 500, intervaloMeses: null })
    })

    it("peça que só se troca quando quebra não ganha plano inventado", () => {
      expect(planoSugerido({ intervaloHoras: null, intervaloMeses: null })).toBeNull()
    })
  })

  describe("buscarModelos", () => {
    const catalogo: ModeloCatalogo[] = [
      modelo({ id: "d6-440", nome: "D6-440" }),
      modelo({ id: "d6-400", nome: "D6-400", potenciaHp: 400 }),
      modelo({ id: "d4-320", nome: "D4-320", familia: "D4", potenciaHp: 320 }),
      modelo({ id: "verado-400", nome: "Verado 400", familia: "Verado", fabricante: "Mercury" }),
      modelo({ id: "f300", nome: "F300", familia: "F", fabricante: "Yamaha" }),
    ]

    it("acha o mesmo motor escrito de três jeitos", () => {
      // O problema que o §16 do PRD descreve, em miniatura: a mesma pessoa
      // digita diferente em dias diferentes.
      for (const termo of ["D6-440", "d6 440", "d6440"]) {
        expect(buscarModelos(termo, catalogo).map((m) => m.id), termo).toContain("d6-440")
      }
    })

    it("prefixo vem antes de casamento no meio", () => {
      const ids = buscarModelos("d6", catalogo).map((m) => m.id)
      expect(ids.slice(0, 2).sort()).toEqual(["d6-400", "d6-440"])
    })

    it("acha por termo que atravessa fabricante e modelo", () => {
      // "volvo d6" não casa com nenhum campo isolado — só com o nome completo.
      expect(buscarModelos("volvo d6", catalogo).map((m) => m.id)).toContain("d6-440")
    })

    it("busca por fabricante traz os modelos dele", () => {
      expect(buscarModelos("yamaha", catalogo).map((m) => m.id)).toEqual(["f300"])
    })

    it("termo vazio ou só separador não devolve o catálogo inteiro", () => {
      expect(buscarModelos("", catalogo)).toEqual([])
      expect(buscarModelos("  - ", catalogo)).toEqual([])
    })

    it("nada que case devolve lista vazia, não uma sugestão qualquer", () => {
      expect(buscarModelos("caterpillar", catalogo)).toEqual([])
    })

    it("respeita o limite", () => {
      expect(buscarModelos("d", catalogo, 2)).toHaveLength(2)
    })

    it("empate desempata por nome, então a ordem é estável", () => {
      const uma = buscarModelos("d6-4", catalogo).map((m) => m.id)
      const outra = buscarModelos("d6-4", [...catalogo].reverse()).map((m) => m.id)
      expect(uma).toEqual(outra)
    })
  })
})
