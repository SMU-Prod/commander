import { describe, expect, it } from "vitest"
import {
  ACOES_SOBRE_ENVIO,
  linhaDeProcedencia,
  RESSALVA_ACESSO_BASICO,
  ROTULO_ACAO_ENVIO,
  ROTULO_ESTADO_ENVIO,
} from "./cotista-plano"
import { cotistaPodeGerarRelatorioOficial } from "./cotistas"

/*
 * AUDITORIA 19/08, A8 — os testes do bloco de venda saíram com o bloco.
 *
 * Havia aqui um `describe("plano do cotista (§14)")` medindo preço, nove
 * recursos, headline palavra por palavra e a lista de palavras proibidas: um
 * conjunto sólido de testes sobre código que nenhuma tela chamava e que o app
 * não sabe cobrar (não existe `cotista_individual` em `PLANOS_COBRAVEIS`).
 * Teste verde sobre função órfã é a pior das duas coisas — dá confiança de
 * que a funcionalidade existe. Ver o cabeçalho de `cotista-plano.ts`.
 */

describe("plano do cotista (§14)", () => {
  it("a ressalva diz que o acesso básico continua de graça", () => {
    // §14: "Deixar explícito que o acesso básico fornecido pela
    // administradora continua disponível sem assinatura." É a única frase do
    // §14 que chega à tela (rodapé de /atualizacoes), e por isso a única que
    // continua guardada aqui.
    const r = RESSALVA_ACESSO_BASICO.toLowerCase()
    expect(r).toContain("sem assinar")
    expect(r).toContain("continua")
  })

  it("a ressalva não promete plano nenhum", () => {
    // Ela terminava em "Este plano é o seu registro pessoal de uso" — falando
    // de um plano que a tela não oferece.
    expect(RESSALVA_ACESSO_BASICO.toLowerCase()).not.toContain("plano")
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

  /* O teste "NADA enviado pelo cotista altera o registro oficial sozinho"
     saiu com `envioAlteraRegistroOficial` (B9): ele media uma função cujo tipo
     de retorno era o literal `false` — asseverava a si mesmo. A regra é
     mantida por `enviarAoAdm` escrever só em `envios_cotista` e por
     `decidirEnvio` ser a única porta que toca no registro oficial. */

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

describe("relatórios (§16)", () => {
  it("o cotista NUNCA gera o relatório oficial da unidade", () => {
    expect(cotistaPodeGerarRelatorioOficial()).toBe(false)
  })
  // O relatório PESSOAL do cotista pagante saiu junto com o plano pago (A8):
  // sem plano não há pagante, e `cotistaPodeGerarRelatorioPessoal` era a
  // identidade com nome de regra.
})
