import { describe, expect, it } from "vitest"
import {
  COMPONENTES_JET,
  componentesJetSemPlano,
  consumoCombustivelPp,
  duracaoHoras,
  ehJet,
  estaAberto,
  estadoDaHomeDePatio,
  horasDeUso,
  linhaDaComparacao,
  linhaDaDecisao,
  movimentoNasceAprovado,
  podeDecidirMovimentoPatio,
  ROTULO_APROVACAO,
  retornoViraAvaria,
  situacaoDaAprovacao,
  textoDuracao,
  type Movimento,
} from "./patio"
import { PAPEIS, MODOS_APROVACAO } from "./enterprise"

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

  // AUDITORIA 19/08, B7 — o achado inteiro cabe no terceiro caso deste bloco.
  describe("o que a home de campo mostra", () => {
    it("com saída aberta, é hora do check-in", () => {
      expect(estadoDaHomeDePatio({ falhou: false, aberto: { retornoEm: null } }))
        .toBe("check_in")
    })

    it("sem saída aberta, é hora do check-out", () => {
      expect(estadoDaHomeDePatio({ falhou: false, aberto: null })).toBe("check_out")
    })

    it("leitura que falhou NÃO é 'está no pátio'", () => {
      // O defeito: `aberto: null` significava as duas coisas, e a tela
      // oferecia CHECK-OUT de uma unidade que podia estar na água.
      expect(estadoDaHomeDePatio({ falhou: true, aberto: null })).toBe("indisponivel")
    })

    it("a falha ganha da suposição mesmo quando veio um movimento junto", () => {
      // Se a leitura falhou, o que veio junto não é confiável — nem pra dizer
      // "está fora". Não saber é o estado, ponto.
      expect(estadoDaHomeDePatio({ falhou: true, aberto: { retornoEm: null } }))
        .toBe("indisponivel")
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

  // AUDITORIA 19/08, A6 — as três colunas de aprovação que o banco coletava e
  // nenhuma linha do app escrevia ou lia.
  describe("conferência do movimento (§3)", () => {
    describe("as quatro situações", () => {
      it("entrou direto NÃO é 'conferido' — ninguém olhou", () => {
        // O caso mais importante do bloco. `aprovado: true` sem carimbo é o
        // padrão do banco (`default true`), e vestir isso de conferência
        // inventaria um ato de gente que não aconteceu.
        expect(situacaoDaAprovacao({ aprovado: true, aprovadoPor: null, aprovadoEm: null }))
          .toBe("direta")
        expect(ROTULO_APROVACAO.direta).toBeNull()
      })

      it("conferido tem autor e hora", () => {
        expect(situacaoDaAprovacao({
          aprovado: true, aprovadoPor: "u-1", aprovadoEm: "2026-08-19T14:32:00Z",
        })).toBe("conferida")
      })

      it("sem aprovação e sem decisão é pendente, não recusado", () => {
        expect(situacaoDaAprovacao({ aprovado: false, aprovadoPor: null, aprovadoEm: null }))
          .toBe("pendente")
      })

      it("recusado é decisão registrada, não ausência dela", () => {
        expect(situacaoDaAprovacao({
          aprovado: false, aprovadoPor: "u-1", aprovadoEm: "2026-08-19T14:32:00Z",
        })).toBe("recusada")
      })

      it("nome apagado não devolve o movimento pra fila", () => {
        // `aprovado_por` é `on delete set null`: funcionário desligado apaga o
        // nome, não o fato de que a conferência aconteceu.
        expect(situacaoDaAprovacao({
          aprovado: false, aprovadoPor: null, aprovadoEm: "2026-08-19T14:32:00Z",
        })).toBe("recusada")
      })
    })

    describe("quem nasce esperando o ADM", () => {
      it("o Commander individual não está sob régua nenhuma", () => {
        // PROP e CMDT não têm preset Enterprise. Sem esta porta, o dono de um
        // barco só passaria a aprovar os próprios check-outs.
        for (const papel of ["PROP", "CMDT"] as const) {
          for (const modo of MODOS_APROVACAO) {
            expect(movimentoNasceAprovado({ papel, modo, acao: "check_out" }), `${papel}/${modo}`)
              .toBe(true)
          }
        }
      })

      it("'tudo exige aprovação' segura o check-out e o check-in", () => {
        expect(movimentoNasceAprovado({ papel: "OPERACOES", modo: "tudo", acao: "check_out" }))
          .toBe(false)
        expect(movimentoNasceAprovado({ papel: "OPERACOES", modo: "tudo", acao: "check_in" }))
          .toBe(false)
      })

      it("'somente críticos' deixa o pátio passar — o §6 pede poucos passos", () => {
        expect(movimentoNasceAprovado({ papel: "OPERACOES", modo: "somente_criticos", acao: "check_out" }))
          .toBe(true)
        expect(movimentoNasceAprovado({ papel: "OPERACOES", modo: "somente_criticos", acao: "check_in" }))
          .toBe(true)
      })

      it("sem aprovação entra direto", () => {
        expect(movimentoNasceAprovado({ papel: "OPERACOES", modo: "sem_aprovacao", acao: "check_out" }))
          .toBe(true)
      })
    })

    describe("quem confere", () => {
      it("é a administradora, e nunca quem registra", () => {
        // O ponto inteiro da régua: Operações registra, o ADM confere. Deixar
        // Operações aprovar o próprio check-out faria "tudo exige aprovação"
        // não significar nada.
        expect(podeDecidirMovimentoPatio("OPERACOES")).toBe(false)
        expect(podeDecidirMovimentoPatio("MECANICA")).toBe(false)
        expect(podeDecidirMovimentoPatio("COTISTA")).toBe(false)
        expect(podeDecidirMovimentoPatio("ADM")).toBe(true)
        expect(podeDecidirMovimentoPatio("ADM_GERAL")).toBe(true)
        expect(podeDecidirMovimentoPatio("PROP")).toBe(true)
      })

      it("todo papel do app tem resposta — nenhum cai no vazio", () => {
        for (const papel of PAPEIS) {
          expect(typeof podeDecidirMovimentoPatio(papel), papel).toBe("boolean")
        }
      })
    })

    describe("a frase da decisão", () => {
      it("com nome e hora, é a mesma gramática da auditoria (§22)", () => {
        const l = linhaDaDecisao("Ana Souza", "conferida", "2026-08-19T17:32:00Z")
        expect(l).toContain("Ana Souza aprovou")
        expect(l).toContain("19/08/2026")
      })

      it("recusa diz recusa", () => {
        expect(linhaDaDecisao("Ana Souza", "recusada", "2026-08-19T17:32:00Z"))
          .toContain("recusou")
      })

      it("sem nome, não inventa gente", () => {
        const l = linhaDaDecisao(null, "conferida", "2026-08-19T17:32:00Z")
        expect(l).toContain("Conferido")
        expect(l).toContain("19/08/2026")
      })

      it("sem hora, não inventa data", () => {
        expect(linhaDaDecisao("Ana Souza", "conferida", null)).toBe("Ana Souza aprovou")
        expect(linhaDaDecisao(null, "recusada", null)).toBe("Recusado")
      })

      it("quem não teve decisão não ganha frase", () => {
        expect(linhaDaDecisao("Ana Souza", "direta", "2026-08-19T17:32:00Z")).toBeNull()
        expect(linhaDaDecisao(null, "pendente", null)).toBeNull()
      })
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

    describe("o que ainda não está no plano (A13)", () => {
      it("unidade sem nenhum item monitorado deve os quatro", () => {
        expect(componentesJetSemPlano([])).toEqual([
          "impeller", "wear-ring", "intake-grate", "jet-pump",
        ])
      })

      it("acha o item mesmo escrito com caixa, hífen e sobra de texto", () => {
        // É assim que a pessoa cadastra de verdade.
        expect(componentesJetSemPlano([
          "Troca do IMPELLER",
          "wear-ring da turbina",
          "Intake Grate",
          "Revisão do jet pump (600 h)",
        ])).toEqual([])
      })

      it("item de outra natureza não conta como plano de propulsão", () => {
        expect(componentesJetSemPlano(["Óleo do motor", "Vela de ignição"]))
          .toHaveLength(4)
      })

      it("cobre parcial: sobra o que faltou, na ordem do §5", () => {
        expect(componentesJetSemPlano(["Impeller", "Jet pump"]))
          .toEqual(["wear-ring", "intake-grate"])
      })
    })
  })
})
