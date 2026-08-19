import { describe, expect, it } from "vitest"
import {
  CATEGORIAS_ESTOQUE,
  consolidarConsumo,
  consumoPorHora,
  divergenciaDoTanque,
  estadoDoItem,
  formatarLitros,
  precisaRepor,
  precoPorLitroCentavos,
  retirarDoEstoque,
  ROTULO_CATEGORIA_ESTOQUE,
  ROTULO_ESTADO_ESTOQUE,
  saldoTeorico,
  totalCentavosPorLitro,
  validarSaidaDoTanque,
} from "./estoque-combustivel"

describe("estoque (§10)", () => {
  it("toda categoria tem rótulo", () => {
    for (const c of CATEGORIAS_ESTOQUE) expect(ROTULO_CATEGORIA_ESTOQUE[c], c).toBeTruthy()
  })

  it("todo estado tem rótulo", () => {
    for (const e of ["zerado", "abaixo_do_minimo", "ok"] as const) {
      expect(ROTULO_ESTADO_ESTOQUE[e], e).toBeTruthy()
    }
  })

  it("acabou é diferente de está acabando", () => {
    // Quem zerou não está "baixo", está parado — e o ADM age diferente.
    expect(estadoDoItem(0, 5)).toBe("zerado")
    expect(estadoDoItem(5, 5)).toBe("abaixo_do_minimo")
    expect(estadoDoItem(6, 5)).toBe("ok")
  })

  it("sem mínimo definido, só existe zerado ou ok", () => {
    // Inventar mínimo faria o app alertar sobre o que ninguém pediu pra
    // acompanhar.
    expect(estadoDoItem(1, null)).toBe("ok")
    expect(estadoDoItem(0, null)).toBe("zerado")
  })

  it("quantidade negativa conta como zerada, não como um estado novo", () => {
    expect(estadoDoItem(-2, 5)).toBe("zerado")
  })

  it("o aviso do §10 junta acabou e acabando", () => {
    expect(precisaRepor("zerado")).toBe(true)
    expect(precisaRepor("abaixo_do_minimo")).toBe(true)
    expect(precisaRepor("ok")).toBe(false)
  })

  describe("retirada", () => {
    it("baixa a quantidade", () => {
      expect(retirarDoEstoque(10, 3)).toEqual({ ok: true, nova: 7 })
    })

    it("pode zerar", () => {
      expect(retirarDoEstoque(3, 3)).toEqual({ ok: true, nova: 0 })
    })

    it("NÃO deixa saldo negativo — e a frase manda ajustar com motivo", () => {
      // Saldo negativo é a maneira de o app parar de saber quanto existe.
      const r = retirarDoEstoque(3, 5)
      expect(r.ok).toBe(false)
      if (!r.ok) {
        expect(r.erro).toContain("Só há 3")
        expect(r.erro).toContain("motivo")
      }
    })

    it("retirada zero ou negativa não passa", () => {
      expect(retirarDoEstoque(10, 0).ok).toBe(false)
      expect(retirarDoEstoque(10, -1).ok).toBe(false)
    })
  })
})

describe("combustível (§11)", () => {
  it("o balanço é saldo inicial + entradas − saídas", () => {
    expect(saldoTeorico(1000, 500, 300)).toBe(1200)
  })

  describe("divergência do tanque", () => {
    it("medição batendo não exige motivo", () => {
      const d = divergenciaDoTanque(1200, 1200)
      expect(d.exigeMotivo).toBe(false)
      expect(d.frase).toContain("bate")
    })

    it("combustível que some é um problema, e a frase diz isso", () => {
      const d = divergenciaDoTanque(1200, 1150)
      expect(d.diferenca).toBe(-50)
      expect(d.exigeMotivo).toBe(true)
      expect(d.frase).toContain("Faltam")
      expect(d.frase).toContain("50 L")
    })

    it("combustível que sobra TAMBÉM exige motivo — §22 fala em divergência", () => {
      const d = divergenciaDoTanque(1200, 1260)
      expect(d.diferenca).toBe(60)
      expect(d.exigeMotivo).toBe(true)
      expect(d.frase).toContain("Sobram")
    })

    it("as duas frases são diferentes — o ADM age diferente em cada caso", () => {
      expect(divergenciaDoTanque(1000, 900).frase)
        .not.toBe(divergenciaDoTanque(1000, 1100).frase)
    })
  })

  describe("saída do tanque", () => {
    it("com destino de unidade, passa", () => {
      expect(validarSaidaDoTanque(200, "uuid-do-jet", null)).toBeNull()
    })

    it("com destino livre, passa", () => {
      expect(validarSaidaDoTanque(200, null, "Caminhão da marina")).toBeNull()
    })

    it("SEM destino não passa — é o que faz o tanque valer alguma coisa", () => {
      // Litro que sai sem destino some do sistema, e o consumo por unidade
      // (o relatório que o §11 pede) fica sem base.
      expect(validarSaidaDoTanque(200, null, null)).toContain("para onde foi")
      expect(validarSaidaDoTanque(200, null, "   ")).toContain("para onde foi")
    })

    it("litro zero não é saída", () => {
      expect(validarSaidaDoTanque(0, "uuid", null)).toContain("litros")
    })
  })

  describe("dinheiro e consumo", () => {
    it("preço por litro sai do total", () => {
      // R$ 486,00 em 90 L = R$ 5,40/L
      expect(precoPorLitroCentavos(48600, 90)).toBe(540)
    })

    it("total sai do preço por litro", () => {
      expect(totalCentavosPorLitro(540, 90)).toBe(48600)
    })

    it("sem litro não há preço por litro a calcular", () => {
      expect(precoPorLitroCentavos(48600, 0)).toBeNull()
    })

    it("consumo por hora", () => {
      expect(consumoPorHora(90, 4.5)).toBe(20)
    })

    it("sem hora rodada, não existe consumo — nunca 'infinito'", () => {
      expect(consumoPorHora(90, 0)).toBeNull()
    })

    it("litro é sempre inteiro na tela", () => {
      expect(formatarLitros(1249.6)).toBe("1.250 L")
    })
  })

  // AUDITORIA 19/08, A5 e A10 — `abastecimentos` era write-only e
  // `consumoPorHora` não tinha consumidor. Este é o relatório que junta as
  // duas pontas: "qual unidade bebe mais".
  describe("consumo por unidade (§11)", () => {
    const frota = [{ id: "a", nome: "Jet 1" }, { id: "b", nome: "Jet 2" }, { id: "c", nome: "Lancha" }]

    it("ordena por L/h, do que mais bebe pro que menos", () => {
      const r = consolidarConsumo(
        frota,
        [{ embarcacaoId: "a", litros: 90 }, { embarcacaoId: "b", litros: 60 }],
        [{ embarcacaoId: "a", horas: 4.5 }, { embarcacaoId: "b", horas: 6 }],
      )
      expect(r.map((u) => u.nome)).toEqual(["Jet 1", "Jet 2"])
      expect(r[0].litrosPorHora).toBe(20)
      expect(r[1].litrosPorHora).toBe(10)
    })

    it("unidade sem abastecimento pelo tanque NÃO aparece com zero", () => {
      // Ausência aqui quer dizer "não abasteceu pela base" — pode ter enchido
      // no posto. "0 L" afirmaria que ela não consumiu nada.
      const r = consolidarConsumo(frota, [{ embarcacaoId: "a", litros: 90 }], [])
      expect(r.map((u) => u.embarcacaoId)).toEqual(["a"])
    })

    it("sem horímetro anotado, mostra os litros e confessa o resto", () => {
      const r = consolidarConsumo(frota, [{ embarcacaoId: "a", litros: 90 }], [])
      expect(r[0].litros).toBe(90)
      expect(r[0].horas).toBeNull()
      expect(r[0].litrosPorHora).toBeNull()
      expect(r[0].frase).toContain("sem horímetro")
      expect(r[0].frase).toContain("90 L")
    })

    it("quem não tem L/h vai pro fim, nunca no meio da ordem", () => {
      // "Não dá pra comparar" não é "bebe pouco". Misturar os dois faria a
      // lista mentir pela ordenação.
      const r = consolidarConsumo(
        frota,
        [{ embarcacaoId: "a", litros: 10 }, { embarcacaoId: "b", litros: 500 }],
        [{ embarcacaoId: "a", horas: 5 }],
      )
      expect(r.map((u) => u.nome)).toEqual(["Jet 1", "Jet 2"])
      expect(r[1].litrosPorHora).toBeNull()
    })

    it("soma os abastecimentos e as horas do período", () => {
      const r = consolidarConsumo(
        frota,
        [{ embarcacaoId: "a", litros: 40 }, { embarcacaoId: "a", litros: 50 }],
        [{ embarcacaoId: "a", horas: 2 }, { embarcacaoId: "a", horas: 2.5 }],
      )
      expect(r[0].litros).toBe(90)
      expect(r[0].horas).toBe(4.5)
      expect(r[0].litrosPorHora).toBe(20)
    })

    it("hora negativa gravada no banco não vira base de cálculo", () => {
      const r = consolidarConsumo(
        frota,
        [{ embarcacaoId: "a", litros: 90 }],
        [{ embarcacaoId: "a", horas: -3 }],
      )
      expect(r[0].litrosPorHora).toBeNull()
    })
  })
})
