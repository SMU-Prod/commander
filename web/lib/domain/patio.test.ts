import { describe, expect, it } from "vitest"
import {
  COMPONENTES_JET,
  consumoCombustivelPp,
  duracaoHoras,
  ehJet,
  estaAberto,
  horasDeUso,
  linhaDaComparacao,
  retornoViraAvaria,
  textoDuracao,
  type Movimento,
} from "./patio"

const mov = (over: Partial<Movimento> = {}): Movimento => ({
  saidaEm: "2026-08-18T11:00:00Z",
  saidaHoras: 517,
  saidaCombustivelPct: 100,
  retornoEm: "2026-08-18T14:20:00Z",
  retornoHoras: 518.5,
  retornoCombustivelPct: 60,
  ...over,
})

describe("pátio", () => {
  describe("saída aberta", () => {
    it("sem retorno, está fora", () => {
      expect(estaAberto({ retornoEm: null })).toBe(true)
    })
    it("com retorno, fechou", () => {
      expect(estaAberto({ retornoEm: "2026-08-18T14:20:00Z" })).toBe(false)
    })
  })

  describe("duração", () => {
    it("conta o tempo entre saída e retorno", () => {
      expect(duracaoHoras(mov())).toBeCloseTo(3.333, 2)
    })

    it("saída em curso não tem duração — e isso não é zero", () => {
      // "0 h" diria que o Jet voltou na hora. Não voltou: ainda está fora.
      expect(duracaoHoras(mov({ retornoEm: null }))).toBeNull()
    })

    it("retorno antes da saída é dado corrompido, não duração negativa", () => {
      expect(duracaoHoras({ saidaEm: "2026-08-18T14:00:00Z", retornoEm: "2026-08-18T11:00:00Z" })).toBeNull()
    })
  })

  describe("horas de uso", () => {
    it("é a diferença de horímetro, não o relógio de parede", () => {
      // 3h20 fora, 1,5 h de motor. Quem puxa manutenção é o horímetro.
      expect(horasDeUso(mov())).toBe(1.5)
      expect(duracaoHoras(mov())).toBeGreaterThan(3)
    })

    it("falta uma leitura, não há uso a afirmar", () => {
      expect(horasDeUso(mov({ saidaHoras: null }))).toBeNull()
      expect(horasDeUso(mov({ retornoHoras: null }))).toBeNull()
    })

    it("horímetro não anda pra trás", () => {
      expect(horasDeUso({ saidaHoras: 520, retornoHoras: 517 })).toBeNull()
    })

    it("uso zero é uso zero — ligou e desligou", () => {
      expect(horasDeUso({ saidaHoras: 517, retornoHoras: 517 })).toBe(0)
    })
  })

  describe("combustível", () => {
    it("positivo é consumo", () => {
      expect(consumoCombustivelPp(mov())).toBe(40)
    })

    it("negativo é abastecimento durante o uso, não erro", () => {
      // Voltou com mais do que saiu: alguém abasteceu. Zerar isso esconderia
      // um abastecimento não registrado, que é o que o §11 quer enxergar.
      expect(consumoCombustivelPp({ saidaCombustivelPct: 40, retornoCombustivelPct: 90 })).toBe(-50)
    })

    it("sem uma das anotações, não há consumo a afirmar", () => {
      expect(consumoCombustivelPp(mov({ retornoCombustivelPct: null }))).toBeNull()
    })
  })

  describe("texto da duração", () => {
    it("fala em hora e minuto, nunca em decimal", () => {
      expect(textoDuracao(3.333)).toBe("3 h 20 min")
    })
    it("menos de uma hora é só minuto", () => {
      expect(textoDuracao(0.75)).toBe("45 min")
    })
    it("hora cheia não ganha '0 min'", () => {
      expect(textoDuracao(2)).toBe("2 h")
    })
    it("sem duração, sem texto", () => {
      expect(textoDuracao(null)).toBeNull()
    })
  })

  describe("linha da comparação", () => {
    it("diz as três coisas quando as três existem", () => {
      const l = linhaDaComparacao(mov())
      expect(l).toContain("3 h 20 min fora")
      expect(l).toContain("1,5 h de uso")
      expect(l).toContain("−40 pp de combustível")
    })

    it("com abastecimento no meio, a frase diz isso em palavra", () => {
      const l = linhaDaComparacao(mov({ saidaCombustivelPct: 40, retornoCombustivelPct: 90 }))
      expect(l).toContain("abasteceu 50 pp durante o uso")
    })

    it("combustível igual é dito, não omitido", () => {
      const l = linhaDaComparacao(mov({ retornoCombustivelPct: 100 }))
      expect(l).toContain("combustível igual")
    })

    it("saída em curso mostra o que já dá pra dizer, sem inventar o resto", () => {
      const l = linhaDaComparacao(mov({ retornoEm: null, retornoHoras: null, retornoCombustivelPct: null }))
      expect(l).toBeNull()
    })

    it("sem nada anotado além do horário, devolve null — tela não desenha linha vazia", () => {
      const l = linhaDaComparacao({
        saidaEm: "2026-08-18T11:00:00Z", saidaHoras: null, saidaCombustivelPct: null,
        retornoEm: null, retornoHoras: null, retornoCombustivelPct: null,
      })
      expect(l).toBeNull()
    })
  })

  describe("retorno vira avaria (§6)", () => {
    it("sem problema marcado, nada é aberto", () => {
      expect(retornoViraAvaria(false, "gastou bastante combustível")).toBeNull()
    })

    it("problema marcado abre com a descrição virando título", () => {
      const a = retornoViraAvaria(true, "Barulho na turbina acima de 4.000 rpm")
      expect(a?.titulo).toBe("Barulho na turbina acima de 4.000 rpm")
      expect(a?.descricao).toBe("Barulho na turbina acima de 4.000 rpm")
    })

    it("descrição longa vira título curto, sem perder o texto inteiro", () => {
      const longa = "Sentimos uma vibração forte no casco durante toda a saída, principalmente ao passar de 4.000 rpm, e o cheiro de queimado apareceu no fim"
      const a = retornoViraAvaria(true, longa)
      expect(a!.titulo.length).toBeLessThanOrEqual(70)
      expect(a?.descricao).toBe(longa)
    })

    it("problema sem descrição ainda abre, com título honesto", () => {
      const a = retornoViraAvaria(true, "   ")
      expect(a?.titulo).toBe("Problema constatado no retorno")
      expect(a?.descricao).toBeNull()
    })

    it("primeira frase vira o título quando há várias", () => {
      const a = retornoViraAvaria(true, "Impeller batendo. Verificar wear ring também.")
      expect(a?.titulo).toBe("Impeller batendo")
    })
  })

  describe("Jet (§5)", () => {
    it("só 'jet' é Jet", () => {
      expect(ehJet("jet")).toBe(true)
      expect(ehJet("lancha")).toBe(false)
      expect(ehJet(null)).toBe(false)
    })

    it("os quatro componentes da propulsão jet estão nomeados", () => {
      const slugs = COMPONENTES_JET.map((c) => c.slug)
      expect(slugs).toEqual(["impeller", "wear-ring", "intake-grate", "jet-pump"])
      for (const c of COMPONENTES_JET) expect(c.ajuda, c.slug).toBeTruthy()
    })
  })
})
