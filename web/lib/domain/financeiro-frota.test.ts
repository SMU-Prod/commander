import { describe, expect, it } from "vitest"
import {
  avisoDeDuplicidade,
  consolidarFrota,
  fraseSemProcedencia,
  inicioDoPeriodo,
  linhaDaUnidade,
  MESES_DO_PERIODO,
  ORIGENS_CUSTO,
  origensQuePesaram,
  PERIODOS_FROTA,
  ROTULO_ORIGEM,
  ROTULO_PERIODO,
  valorAlancar,
  type CustoLancado,
} from "./financeiro-frota"

const frota = [
  { id: "jet-1", nome: "Jet 01" },
  { id: "jet-2", nome: "Jet 02" },
  { id: "jet-3", nome: "Jet 03" },
]

const l = (embarcacaoId: string, origem: CustoLancado["origem"], reais: number): CustoLancado =>
  ({ embarcacaoId, origem, valorCentavos: reais * 100 })

describe("financeiro da frota (§12)", () => {
  describe("escopo fechado", () => {
    it("só existem origens de CUSTO — nenhuma de receita", () => {
      // §12: "não incluir cobrança de cotistas, venda de cotas, receitas
      // comerciais, repasses ou contabilidade societária". Este teste guarda
      // a ausência: o dia em que alguém adicionar "mensalidade" aqui, ele
      // quebra e obriga a discussão.
      const proibidas = ["cobranca", "mensalidade", "cota", "receita", "repasse", "faturamento"]
      for (const p of proibidas) {
        expect(ORIGENS_CUSTO as readonly string[], p).not.toContain(p)
      }
    })

    it("toda origem e todo período têm rótulo", () => {
      for (const o of ORIGENS_CUSTO) expect(ROTULO_ORIGEM[o], o).toBeTruthy()
      for (const p of PERIODOS_FROTA) expect(ROTULO_PERIODO[p], p).toBeTruthy()
    })

    it("os três períodos do §12, e só eles", () => {
      expect(PERIODOS_FROTA).toEqual(["mes", "semestre", "ano"])
      expect(MESES_DO_PERIODO).toEqual({ mes: 1, semestre: 6, ano: 12 })
    })
  })

  describe("período", () => {
    it("volta em meses de calendário, não em 30 dias", () => {
      expect(inicioDoPeriodo("mes", "2026-08-18")).toBe("2026-07-18")
      expect(inicioDoPeriodo("semestre", "2026-08-18")).toBe("2026-02-18")
      expect(inicioDoPeriodo("ano", "2026-08-18")).toBe("2025-08-18")
    })

    it("dia 31 num mês curto não vira o mês seguinte", () => {
      // 31/03 menos 1 mês é 28/02, nunca 03/03.
      expect(inicioDoPeriodo("mes", "2026-03-31")).toBe("2026-02-28")
    })

    it("atravessa a virada do ano", () => {
      expect(inicioDoPeriodo("semestre", "2026-02-10")).toBe("2025-08-10")
    })
  })

  describe("consolidação", () => {
    it("soma por unidade e por origem", () => {
      const r = consolidarFrota(frota, [
        l("jet-1", "combustivel", 500),
        l("jet-1", "mecanica", 1500),
        l("jet-2", "combustivel", 300),
      ])
      expect(r.totalCentavos).toBe(230000)
      expect(r.porOrigem.combustivel).toBe(80000)
      expect(r.porOrigem.mecanica).toBe(150000)
      expect(r.unidades.find((u) => u.embarcacaoId === "jet-1")!.totalCentavos).toBe(200000)
    })

    it("ordena por maior custo — §12", () => {
      const r = consolidarFrota(frota, [
        l("jet-2", "combustivel", 900),
        l("jet-1", "combustivel", 100),
        l("jet-3", "combustivel", 500),
      ])
      expect(r.unidades.map((u) => u.embarcacaoId)).toEqual(["jet-2", "jet-3", "jet-1"])
    })

    it("unidade SEM custo aparece com zero, não some da lista", () => {
      // Sumir faria o ADM olhar 1 unidade numa frota de 3 e não saber se as
      // outras não gastaram ou se o app perdeu. Custo zero é informação —
      // pode ser unidade parada.
      const r = consolidarFrota(frota, [l("jet-1", "combustivel", 100)])
      expect(r.unidades).toHaveLength(3)
      expect(r.unidades.at(-1)!.totalCentavos).toBe(0)
    })

    it("empate desempata por nome — a ordem não pisca entre renders", () => {
      const r = consolidarFrota(frota, [])
      expect(r.unidades.map((u) => u.nome)).toEqual(["Jet 01", "Jet 02", "Jet 03"])
    })

    it("percentual da frota fecha o quadro", () => {
      const r = consolidarFrota(frota, [
        l("jet-1", "combustivel", 750),
        l("jet-2", "combustivel", 250),
      ])
      expect(r.unidades[0].percentualDaFrota).toBe(75)
      expect(r.unidades[1].percentualDaFrota).toBe(25)
    })

    it("frota sem custo nenhum não divide por zero", () => {
      const r = consolidarFrota(frota, [])
      expect(r.totalCentavos).toBe(0)
      expect(r.unidades.every((u) => u.percentualDaFrota === 0)).toBe(true)
    })

    it("lançamento de unidade fora da lista é ignorado", () => {
      const r = consolidarFrota(frota, [l("outra-base", "combustivel", 999)])
      expect(r.totalCentavos).toBe(0)
    })

    it("origens que pesaram vêm da maior pra menor, sem os zeros", () => {
      const r = consolidarFrota(frota, [
        l("jet-1", "mecanica", 1000),
        l("jet-1", "combustivel", 300),
      ])
      expect(origensQuePesaram(r.porOrigem)).toEqual(["mecanica", "combustivel"])
    })
  })

  // AUDITORIA 19/08, B1 — O GRUPO QUE GUARDA A CORREÇÃO MAIS CARA DA RODADA.
  //
  // A tela lia `l.origem ?? "manual"` sobre uma coluna que nenhum insert
  // preenchia: TODO custo virava "Lançamento manual" e o gráfico "Em quê"
  // tinha uma barra só, 100%, em qualquer conta e para sempre. Não era um
  // `null` virando zero desenhado — era um `null` virando um FATO desenhado,
  // que é a versão pior da mesma doença. Estes testes existem para que a
  // conveniência de "ah, joga em manual" não volte por descuido.
  describe("origem ausente ≠ origem manual", () => {
    const semOrigem = (id: string, reais: number): CustoLancado =>
      ({ embarcacaoId: id, origem: null, valorCentavos: reais * 100 })

    it("custo sem origem NÃO entra em `manual`", () => {
      const r = consolidarFrota(frota, [semOrigem("jet-1", 1000)])
      expect(r.porOrigem.manual).toBe(0)
      expect(r.semProcedenciaCentavos).toBe(100000)
    })

    it("mas continua no total — o dinheiro saiu, e isso a tela sabe", () => {
      const r = consolidarFrota(frota, [semOrigem("jet-1", 1000), l("jet-1", "mecanica", 500)])
      expect(r.totalCentavos).toBe(150000)
      expect(r.unidades[0].totalCentavos).toBe(150000)
    })

    it("`manual` explícito continua sendo uma origem de verdade", () => {
      // É a última linha da tabela do §12 ("exceções e despesas não
      // cobertas"). O que mudou foi só quem NÃO é manual.
      const r = consolidarFrota(frota, [l("jet-1", "manual", 300)])
      expect(r.porOrigem.manual).toBe(30000)
      expect(r.semProcedenciaCentavos).toBe(0)
    })

    it("frota inteira sem procedência não desenha barra nenhuma", () => {
      // O caso que estava no ar: sem isto, `origensQuePesaram` devolvia
      // ["manual"] e o gráfico saía com a barra única de 100%.
      const r = consolidarFrota(frota, [semOrigem("jet-1", 800), semOrigem("jet-2", 200)])
      expect(origensQuePesaram(r.porOrigem)).toEqual([])
    })

    describe("a frase que confessa", () => {
      it("cala quando tudo tem procedência", () => {
        expect(fraseSemProcedencia(100000, 0)).toBeNull()
      })

      it("diz o valor e a fatia quando falta", () => {
        const f = fraseSemProcedencia(100000, 62000)
        expect(f).toContain("620,00")
        expect(f).toContain("62%")
      })

      it("frota sem custo nenhum não divide por zero", () => {
        expect(fraseSemProcedencia(0, 0)).toBeNull()
      })
    })

    describe("a linha de cada unidade", () => {
      it("zero é informação, não ausência", () => {
        const r = consolidarFrota(frota, [])
        expect(linhaDaUnidade(r.unidades[0])).toBe("Nenhum custo no período")
      })

      it("sem origem nenhuma, não inventa origem", () => {
        const r = consolidarFrota(frota, [semOrigem("jet-1", 500)])
        const u = r.unidades.find((x) => x.embarcacaoId === "jet-1")!
        expect(linhaDaUnidade(u)).toBe("100% do custo da frota · procedência não registrada")
        expect(linhaDaUnidade(u)).not.toContain("manual")
        expect(linhaDaUnidade(u)).not.toContain("Manual")
      })

      it("com origem, lista as duas que mais pesaram", () => {
        const r = consolidarFrota(frota, [
          l("jet-1", "mecanica", 1000), l("jet-1", "combustivel", 500), l("jet-1", "estoque", 100),
        ])
        const linha = linhaDaUnidade(r.unidades[0])
        expect(linha).toContain("Mecânica, Combustível")
        expect(linha).not.toContain("Estoque")
      })

      it("misturado, diz as origens E quanto ficou sem explicação", () => {
        const r = consolidarFrota(frota, [l("jet-1", "mecanica", 700), semOrigem("jet-1", 300)])
        const linha = linhaDaUnidade(r.unidades[0])
        expect(linha).toContain("Mecânica")
        expect(linha).toContain("300,00")
        expect(linha).toContain("sem procedência")
      })
    })
  })

  describe("duplicidade de peças (§12)", () => {
    it("sem peça lançada, não pergunta nada", () => {
      // Perguntar sempre viraria ruído — e ruído faz o ADM clicar sem ler.
      expect(avisoDeDuplicidade(0)).toBeNull()
      expect(avisoDeDuplicidade(-10)).toBeNull()
    })

    it("com peça lançada, pergunta e diz o valor", () => {
      const a = avisoDeDuplicidade(80000)
      expect(a?.perguntar).toBe(true)
      expect(a?.pergunta).toContain("800,00")
      expect(a?.opcoes).toHaveLength(2)
    })

    it("a primeira opção é a que evita contar duas vezes", () => {
      // A nota da oficina costuma vir com peça e mão de obra juntas.
      expect(avisoDeDuplicidade(80000)!.opcoes[0]).toContain("já inclui")
    })

    describe("quanto lançar de fato", () => {
      it("valor que NÃO inclui peças entra inteiro", () => {
        expect(valorAlancar(200000, 80000, false)).toBe(200000)
      })

      it("valor que JÁ inclui peças entra só como mão de obra", () => {
        // R$ 2.000 de nota com R$ 800 de peça já lançada = R$ 1.200 novos.
        // Sem isso, a unidade apareceria com R$ 2.800 tendo gasto R$ 2.000.
        expect(valorAlancar(200000, 80000, true)).toBe(120000)
      })

      it("serviço menor que as peças lança ZERO, nunca crédito", () => {
        // Valor negativo aqui mascararia o custo de outra unidade na
        // consolidação — e o Financeiro operacional não tem entrada (§12).
        expect(valorAlancar(50000, 80000, true)).toBe(0)
      })

      it("valor negativo informado não vira custo negativo", () => {
        expect(valorAlancar(-100, 0, false)).toBe(0)
      })
    })
  })
})
