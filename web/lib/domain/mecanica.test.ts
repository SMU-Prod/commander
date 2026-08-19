import { describe, expect, it } from "vitest"
import {
  apurarVotacao,
  DIAS_OFICINA_DEMORADO,
  ESTADOS_SERVICO,
  linhaDaApuracao,
  orcamentoVencido,
  podeAbrirVotacao,
  ROTULO_ESTADO_SERVICO,
  ROTULO_SITUACAO_VOTACAO,
  servicoAberto,
  situacaoDaVotacao,
  tempoNaOficina,
  tomDoServico,
  type Voto,
} from "./mecanica"

describe("mecânica", () => {
  describe("andamento do serviço (§7)", () => {
    it("todo estado tem rótulo", () => {
      for (const e of ESTADOS_SERVICO) expect(ROTULO_ESTADO_SERVICO[e], e).toBeTruthy()
    })

    it("aguardando peça é PARADO, não neutro", () => {
      // É o estado em que o barco fica parado por causa de terceiro — o que
      // o ADM precisa enxergar numa lista de vinte unidades.
      expect(tomDoServico("aguardando_peca")).toBe("parado")
      expect(tomDoServico("em_conserto")).toBe("andando")
      expect(tomDoServico("em_diagnostico")).toBe("andando")
      expect(tomDoServico("concluido")).toBe("fechado")
    })

    it("aberto é tudo que não foi concluído", () => {
      expect(servicoAberto("em_diagnostico")).toBe(true)
      expect(servicoAberto("aguardando_peca")).toBe(true)
      expect(servicoAberto("concluido")).toBe(false)
    })
  })

  describe("tempo na oficina (A15)", () => {
    const hoje = "2026-08-19"

    it("sem data de entrada não escreve nada — nunca 'há 0 dias'", () => {
      // Serviço sem entrada anotada não entrou "há zero dias": ninguém digitou
      // a data. Mesma régua de `patio.ts` — ausência não vira zero desenhado.
      expect(tempoNaOficina(null, hoje, true)).toBeNull()
      expect(tempoNaOficina("", hoje, true)).toBeNull()
    })

    it("com o serviço aberto, a frase é o INTERVALO e não a data", () => {
      expect(tempoNaOficina("2026-08-19", hoje, true)?.frase).toBe("entrou hoje na oficina")
      expect(tempoNaOficina("2026-08-18", hoje, true)?.frase).toBe("na oficina há 1 dia")
      expect(tempoNaOficina("2026-08-07", hoje, true)?.frase).toBe("na oficina há 12 dias")
    })

    it("depois de dois meses a contagem vira meses", () => {
      // "há 187 dias" é um número que ninguém converte de cabeça.
      expect(tempoNaOficina("2026-02-13", hoje, true)?.frase).toBe("na oficina há 6 meses")
    })

    it("passar do teto marca a frase como demorada", () => {
      const vespera = tempoNaOficina("2026-07-21", hoje, true) // 29 dias
      const noTeto = tempoNaOficina("2026-07-20", hoje, true) // 30 dias
      expect(DIAS_OFICINA_DEMORADO).toBe(30)
      expect(vespera?.demorado).toBe(false)
      expect(noTeto?.demorado).toBe(true)
    })

    it("serviço concluído volta a mostrar a data — ele não está mais lá", () => {
      // "na oficina há 40 dias" num serviço fechado seria mentira com cara de
      // alarme.
      const r = tempoNaOficina("2026-07-10", hoje, false)
      expect(r?.frase).toBe("entrou em 10/07/2026")
      expect(r?.demorado).toBe(false)
    })

    it("data no futuro não vira intervalo negativo", () => {
      // Um dedo errado no seletor de data produziria "há −180 dias", que faz a
      // pessoa desconfiar da tela inteira.
      const r = tempoNaOficina("2027-02-14", hoje, true)
      expect(r?.frase).toBe("entrada marcada para 14/02/2027")
      expect(r?.demorado).toBe(false)
    })
  })

  describe("apuração da votação (§9)", () => {
    const votos = (a: number, n: number): Voto[] => [
      ...Array<Voto>(a).fill("aprovar"),
      ...Array<Voto>(n).fill("nao_aprovar"),
    ]

    it("10 de 10 aprovados é 'Aprovado por todos'", () => {
      const a = apurarVotacao(10, votos(10, 0))
      expect(a.aprovadoPorTodos).toBe(true)
      expect(a.rotulo).toBe("10/10")
      expect(situacaoDaVotacao(a)).toBe("aprovada_por_todos")
    })

    it("quem não votou NÃO some da conta", () => {
      // Sem isso, 2 votos a favor de 10 cotistas leriam como unanimidade.
      const a = apurarVotacao(10, votos(2, 0))
      expect(a.aprovadoPorTodos).toBe(false)
      expect(a.faltamVotar).toBe(8)
      expect(a.rotulo).toBe("2/10")
      expect(situacaoDaVotacao(a)).toBe("em_votacao")
    })

    it("um voto contra muda a situação, mas não reprova", () => {
      const a = apurarVotacao(10, votos(9, 1))
      expect(a.temRecusa).toBe(true)
      expect(situacaoDaVotacao(a)).toBe("com_recusa")
    })

    it("NÃO EXISTE situação 'reprovada' — o app não define quórum (§9)", () => {
      // "Commander não executa pagamento e não determina juridicamente o
      // quórum da empresa." Declarar reprovação seria decidir por um
      // contrato de sociedade que o app não conhece.
      const rotulos = Object.values(ROTULO_SITUACAO_VOTACAO).join(" ").toLowerCase()
      expect(rotulos).not.toContain("reprovad")
      expect(rotulos).not.toContain("rejeitad")
      expect(rotulos).not.toContain("negad")
    })

    it("sem cotista nenhum, não há unanimidade a declarar", () => {
      const a = apurarVotacao(0, [])
      expect(a.aprovadoPorTodos).toBe(false)
      expect(linhaDaApuracao(a)).toContain("Nenhum cotista")
    })

    it("a frase da recusa diz de quem é a decisão", () => {
      const frase = linhaDaApuracao(apurarVotacao(10, votos(6, 1)))
      expect(frase).toContain("decisão da administradora")
      expect(frase).toContain("não define quórum")
    })

    it("na unanimidade a frase não sobra explicação de quórum", () => {
      const frase = linhaDaApuracao(apurarVotacao(3, votos(3, 0)))
      expect(frase).toBe("Todos os 3 cotistas aprovaram.")
    })

    it("total negativo ou quebrado não vira votação fantasma", () => {
      expect(apurarVotacao(-5, []).rotulo).toBe("0/0")
      expect(apurarVotacao(10.7, votos(1, 0)).rotulo).toBe("1/10")
    })
  })

  describe("validade do orçamento (§9)", () => {
    const hoje = "2026-08-18"

    it("sem validade, não vence", () => {
      expect(orcamentoVencido(null, hoje)).toBe(false)
    })

    it("vence no dia seguinte ao prazo, não no dia dele", () => {
      expect(orcamentoVencido("2026-08-18", hoje)).toBe(false)
      expect(orcamentoVencido("2026-08-17", hoje)).toBe(true)
    })

    it("orçamento válido pode ir a votação", () => {
      expect(podeAbrirVotacao("2026-08-30", hoje, false)).toEqual({ pode: true, motivo: null })
    })

    it("orçamento vencido não vai a votação, e a frase diz por quê", () => {
      const r = podeAbrirVotacao("2026-08-01", hoje, false)
      expect(r.pode).toBe(false)
      expect(r.motivo).toContain("venceu")
    })

    it("não abre duas votações pro mesmo orçamento", () => {
      const r = podeAbrirVotacao("2026-08-30", hoje, true)
      expect(r.pode).toBe(false)
      expect(r.motivo).toContain("já foi para votação")
    })
  })
})
