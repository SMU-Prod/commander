import { describe, expect, it } from "vitest"
import {
  buscarModelos,
  ehSegmentoMotor,
  faixaDeAno,
  filtrarPorSegmento,
  identidadeDoMotor,
  nomeCompletoDoModelo,
  planoSugerido,
  podeFiltrarPorSegmento,
  ROTULO_SEGMENTO,
  ROTULO_SISTEMA,
  SEGMENTOS_MOTOR,
  segmentosPresentes,
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
  segmento: "diesel_interno",
  ...over,
})

describe("catálogo de motor", () => {
  describe("vocabulário", () => {
    it("todo sistema tem rótulo", () => {
      for (const s of SISTEMAS_MOTOR) {
        expect(ROTULO_SISTEMA[s], s).toBeTruthy()
      }
    })

    it("todo segmento tem rótulo", () => {
      for (const s of SEGMENTOS_MOTOR) {
        expect(ROTULO_SEGMENTO[s], s).toBeTruthy()
      }
    })

    it("os três segmentos são os que o banco tem — conferido em 19/08/2026", () => {
      // Guarda de regressão do §20: `motor_fabricantes.segmento` é `not null`
      // e os valores distintos no banco remoto eram exatamente estes três (12
      // fabricantes, 12 com segmento, 0 nulos). Se alguém cadastrar um quarto
      // por SQL sem passar por aqui, `ehSegmentoMotor` o converte em `null` e
      // `podeFiltrarPorSegmento` desliga o filtro — mas este teste é o lembrete
      // de que o vocabulário e a coluna têm de andar juntos.
      expect([...SEGMENTOS_MOTOR].sort())
        .toEqual(["centro_rabeta", "diesel_interno", "popa"])
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

  describe("segmento (§20)", () => {
    const popa = modelo({ id: "f300", nome: "F300", fabricante: "Yamaha", segmento: "popa" })
    const diesel = modelo({ id: "d6-440", segmento: "diesel_interno" })

    describe("ehSegmentoMotor", () => {
      it("aceita os três do vocabulário", () => {
        for (const s of SEGMENTOS_MOTOR) expect(ehSegmentoMotor(s), s).toBe(true)
      })

      it("recusa o que não é do vocabulário, inclusive nulo e vazio", () => {
        for (const v of ["jet", "POPA", "", null, undefined]) {
          expect(ehSegmentoMotor(v), String(v)).toBe(false)
        }
      })
    })

    describe("segmentosPresentes", () => {
      it("devolve na ordem do §20, não na de chegada", () => {
        // `SEGMENTOS_MOTOR` é popa → centro_rabeta → diesel_interno.
        expect(segmentosPresentes([diesel, popa])).toEqual(["popa", "diesel_interno"])
      })

      it("não repete e ignora o desconhecido", () => {
        expect(segmentosPresentes([popa, popa, modelo({ id: "x", segmento: null })]))
          .toEqual(["popa"])
      })

      it("catálogo vazio não tem segmento nenhum", () => {
        expect(segmentosPresentes([])).toEqual([])
      })
    })

    describe("podeFiltrarPorSegmento", () => {
      it("liga com dois segmentos presentes e nenhum desconhecido", () => {
        expect(podeFiltrarPorSegmento([popa, diesel])).toBe(true)
      })

      it("UM ÚNICO segmento desconhecido desliga o filtro inteiro", () => {
        // A régua que importa: o modelo sem segmento não caberia em chip
        // nenhum e sumiria da lista ao primeiro toque. Com o filtro
        // desligado ele continua achável pela busca.
        expect(podeFiltrarPorSegmento([popa, diesel, modelo({ id: "x", segmento: null })]))
          .toBe(false)
      })

      it("um segmento só não vira filtro — controle que não faz nada", () => {
        expect(podeFiltrarPorSegmento([popa, modelo({ id: "f250", segmento: "popa" })]))
          .toBe(false)
      })

      it("catálogo vazio não oferece filtro", () => {
        expect(podeFiltrarPorSegmento([])).toBe(false)
      })
    })

    describe("filtrarPorSegmento", () => {
      it("recorta pelo segmento pedido", () => {
        expect(filtrarPorSegmento([popa, diesel], "popa").map((m) => m.id)).toEqual(["f300"])
      })

      it("null é Todos — o catálogo inteiro", () => {
        expect(filtrarPorSegmento([popa, diesel], null)).toHaveLength(2)
      })

      it("modelo de segmento desconhecido não entra em recorte nenhum", () => {
        const orfao = modelo({ id: "x", segmento: null })
        for (const s of SEGMENTOS_MOTOR) {
          expect(filtrarPorSegmento([orfao], s), s).toEqual([])
        }
        expect(filtrarPorSegmento([orfao], null)).toHaveLength(1)
      })

      it("não devolve o mesmo array que recebeu", () => {
        // A tela guarda o resultado em `useMemo` e o passa adiante; devolver
        // a referência de `modelos` convidaria a mutação a atravessar.
        const entrada = [popa, diesel]
        expect(filtrarPorSegmento(entrada, null)).not.toBe(entrada)
      })
    })

    it("o recorte vem ANTES da busca, e é isso que salva o corte em 8", () => {
      // O defeito que a ordem evita: `buscarModelos` corta em 8. Buscar
      // primeiro e filtrar depois devolveria menos de 8 (às vezes zero) sem
      // que nada tivesse acabado.
      const catalogo = [
        ...Array.from({ length: 8 }, (_, i) =>
          modelo({ id: `popa-${i}`, nome: `Verado ${i}00`, familia: "Verado", segmento: "popa" })),
        modelo({ id: "d6-440", nome: "Verado D6-440", segmento: "diesel_interno" }),
      ]
      // Filtrando antes: o único diesel aparece.
      expect(buscarModelos("verado", filtrarPorSegmento(catalogo, "diesel_interno")).map((m) => m.id))
        .toEqual(["d6-440"])
      // Buscando antes: os 8 de popa ocupam o corte e o diesel some.
      expect(filtrarPorSegmento(buscarModelos("verado", catalogo), "diesel_interno")).toEqual([])
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
