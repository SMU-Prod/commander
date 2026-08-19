import { describe, expect, it } from "vitest"
import {
  ACOES_SOBRE_ENVIO,
  cotistaPodeGerarRelatorioPessoal,
  envioAlteraRegistroOficial,
  HEADLINE_COTISTA,
  linhaDeProcedencia,
  MENSAGEM_COTISTA,
  PALAVRAS_PROIBIDAS_COTISTA,
  precoCotistaEmTexto,
  RECURSOS_COTISTA_PAGO,
  RESSALVA_ACESSO_BASICO,
  ROTULO_ACAO_ENVIO,
  ROTULO_ESTADO_ENVIO,
} from "./cotista-plano"
import { cotistaPodeGerarRelatorioOficial } from "./cotistas"

describe("plano do cotista (§14)", () => {
  it("custa R$ 24,90/mês, saindo do catálogo", () => {
    expect(precoCotistaEmTexto()).toBe("R$ 24,90/mês")
  })

  it("os nove recursos do §14 têm nome e descrição", () => {
    expect(RECURSOS_COTISTA_PAGO).toHaveLength(9)
    for (const r of RECURSOS_COTISTA_PAGO) {
      expect(r.nome, r.chave).toBeTruthy()
      expect(r.descricao, r.chave).toBeTruthy()
    }
  })

  describe("as duas proibições de copy do §14", () => {
    it("a copy NÃO usa linguagem de prova jurídica nem de garantia", () => {
      // §14: "Não usar linguagem de 'prova jurídica' ou garantia contra
      // cobrança." O risco é concreto: quem ler "prova" assina achando que
      // comprou defesa contra a administradora, e o app não garante isso —
      // as fotos dele são registro pessoal, não perícia.
      const copy = [HEADLINE_COTISTA, MENSAGEM_COTISTA, RESSALVA_ACESSO_BASICO]
        .join(" ")
        .toLowerCase()
      for (const proibida of PALAVRAS_PROIBIDAS_COTISTA) {
        expect(copy, proibida).not.toContain(proibida)
      }
    })

    it("a ressalva diz que o acesso básico continua de graça", () => {
      // §14: "Deixar explícito que o acesso básico fornecido pela
      // administradora continua disponível sem assinatura."
      const r = RESSALVA_ACESSO_BASICO.toLowerCase()
      expect(r).toContain("sem assinar")
      expect(r).toContain("continua")
    })

    it("a headline é a do PRD, palavra por palavra", () => {
      expect(HEADLINE_COTISTA).toBe(
        "Você divide o Jet. Não precisa dividir a dúvida sobre quem fez o quê.",
      )
    })
  })
})

describe("Atualizações dos Cotistas (§15)", () => {
  it("as seis ações do ADM têm rótulo", () => {
    expect(ACOES_SOBRE_ENVIO).toHaveLength(6)
    for (const a of ACOES_SOBRE_ENVIO) expect(ROTULO_ACAO_ENVIO[a], a).toBeTruthy()
  })

  it("todo estado de envio tem rótulo", () => {
    for (const e of ["aguardando", "incorporado", "arquivado"] as const) {
      expect(ROTULO_ESTADO_ENVIO[e], e).toBeTruthy()
    }
  })

  it("NADA enviado pelo cotista altera o registro oficial sozinho", () => {
    // Sem isso, dez cotistas com opiniões diferentes sobre o horímetro
    // escreveriam por cima uns dos outros na ficha da unidade.
    expect(envioAlteraRegistroOficial()).toBe(false)
  })

  describe("procedência", () => {
    it("aguardando diz quem informou e que ainda não foi analisado", () => {
      expect(linhaDeProcedencia("Marina", "aguardando", null))
        .toBe("Informado por Marina · aguardando análise")
    })

    it("incorporado nomeia os DOIS: quem informou e quem aceitou", () => {
      // É o produto do hub — o valor não está no dado, está em saber de
      // quem veio e quem decidiu aceitar.
      expect(linhaDeProcedencia("Marina", "incorporado", "Ana"))
        .toBe("Informado por Marina · incorporado por Ana")
    })

    it("arquivado também guarda quem arquivou", () => {
      expect(linhaDeProcedencia("Marina", "arquivado", "Ana"))
        .toBe("Informado por Marina · arquivado por Ana")
    })

    it("sem nome do ADM, a frase não fica quebrada", () => {
      expect(linhaDeProcedencia("Marina", "incorporado", "  "))
        .toContain("incorporado por a administradora")
    })
  })
})

describe("relatórios — o oficial e o pessoal são coisas diferentes (§16)", () => {
  it("o cotista NUNCA gera o relatório oficial da unidade", () => {
    expect(cotistaPodeGerarRelatorioOficial()).toBe(false)
  })

  it("mas o pagante gera o PESSOAL — e dez fazendo isso é o esperado", () => {
    // O pessoal usa só o uso dele; não há duplicação a evitar.
    expect(cotistaPodeGerarRelatorioPessoal(true)).toBe(true)
    expect(cotistaPodeGerarRelatorioPessoal(false)).toBe(false)
  })
})
