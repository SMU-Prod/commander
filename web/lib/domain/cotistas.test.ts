import { describe, expect, it } from "vitest"
import {
  acimaDaCota,
  cotistaPodeGerarRelatorioOficial,
  estaSuspenso,
  faltaNoCadastro,
  MENSAGEM_SUSPENSO,
  mensagemDeRecusa,
  podeEntrarComLink,
  vagasDeCotista,
  type RecusaDeEntrada,
} from "./cotistas"

describe("cotistas", () => {
  describe("vagas (§13)", () => {
    it("conta no formato do PRD: 7/10", () => {
      const v = vagasDeCotista(10, 7)
      expect(v.rotulo).toBe("7/10")
      expect(v.restantes).toBe(3)
      expect(v.cabeMais).toBe(true)
    })

    it("lotado não cabe mais ninguém", () => {
      const v = vagasDeCotista(10, 10)
      expect(v.cabeMais).toBe(false)
      expect(v.restantes).toBe(0)
    })

    it("unidade vazia tem tudo livre", () => {
      expect(vagasDeCotista(10, 0).rotulo).toBe("0/10")
      expect(vagasDeCotista(10, 0).cabeMais).toBe(true)
    })

    it("cota reduzida com gente dentro não expulsa ninguém", () => {
      // ADM baixa de 10 pra 5 com 8 cotistas já dentro. Ninguém novo entra,
      // mas os 8 continuam — mesma régua do §23: bloqueia, nunca apaga.
      const v = vagasDeCotista(5, 8)
      expect(v.cabeMais).toBe(false)
      expect(v.restantes).toBe(0)
      expect(acimaDaCota(v)).toBe(true)
      expect(v.ocupadas).toBe(8)
    })

    it("dentro da cota não acusa excedente", () => {
      expect(acimaDaCota(vagasDeCotista(10, 10))).toBe(false)
    })

    it("número quebrado ou negativo não vira vaga fantasma", () => {
      expect(vagasDeCotista(-3, -1).rotulo).toBe("0/0")
      expect(vagasDeCotista(10.9, 2.7).rotulo).toBe("2/10")
    })
  })

  describe("entrada por link (§13)", () => {
    const cheio = vagasDeCotista(10, 10)
    const comVaga = vagasDeCotista(10, 3)

    it("com vaga e link ativo, entra", () => {
      expect(podeEntrarComLink(true, comVaga, false)).toBeNull()
    })

    it("link desativado recusa mesmo com vaga sobrando", () => {
      expect(podeEntrarComLink(false, comVaga, false)).toBe("link_desativado")
    })

    it("lotado recusa mesmo com link ativo", () => {
      expect(podeEntrarComLink(true, cheio, false)).toBe("sem_vaga")
    })

    it("quem já é cotista não ocupa uma segunda vaga", () => {
      // E a resposta é essa ANTES das outras: mandar "sem vaga" pra quem já
      // tem acesso seria mentira, e ele só precisa ser levado pra unidade.
      expect(podeEntrarComLink(true, cheio, true)).toBe("ja_e_cotista")
      expect(podeEntrarComLink(false, comVaga, true)).toBe("ja_e_cotista")
    })

    it("toda recusa tem frase, e nenhuma culpa quem chegou", () => {
      const motivos: RecusaDeEntrada[] = ["link_desativado", "sem_vaga", "ja_e_cotista"]
      for (const m of motivos) {
        const frase = mensagemDeRecusa(m)
        expect(frase, m).toBeTruthy()
        expect(frase.toLowerCase(), m).not.toContain("erro")
      }
      expect(mensagemDeRecusa("sem_vaga")).toContain("administradora")
      expect(mensagemDeRecusa("link_desativado")).toContain("administradora")
    })
  })

  describe("cadastro (§13)", () => {
    const ok = { nome: "João Lima", email: "joao@exemplo.com", telefone: "21999990000" }

    it("os três campos completos passam", () => {
      expect(faltaNoCadastro(ok)).toBeNull()
    })

    it("cada campo que falta tem sua própria frase", () => {
      expect(faltaNoCadastro({ ...ok, nome: "  " })).toContain("nome")
      expect(faltaNoCadastro({ ...ok, email: null })).toContain("e-mail")
      expect(faltaNoCadastro({ ...ok, telefone: "" })).toContain("telefone")
    })
  })

  describe("suspensão por inadimplência (§13)", () => {
    it("sem data, não está suspenso", () => {
      expect(estaSuspenso({ suspensoEm: null })).toBe(false)
    })

    it("com data, está", () => {
      expect(estaSuspenso({ suspensoEm: "2026-08-18T12:00:00Z" })).toBe(true)
    })

    it("a mensagem não fala em dívida, valor nem prazo", () => {
      // §13: "Cobrança acontece FORA do Commander". O app não sabe se a
      // pessoa deve — afirmar isso na tela de um cliente da administradora
      // seria o Commander declarando um fato financeiro que ele não conhece.
      const m = MENSAGEM_SUSPENSO.toLowerCase()
      for (const proibida of ["dívida", "divida", "inadimpl", "pagamento", "valor", "r$", "fatura", "atraso"]) {
        expect(m, proibida).not.toContain(proibida)
      }
      expect(m).toContain("administradora")
      expect(m).toContain("suspenso")
    })
  })

  describe("relatório oficial (§16)", () => {
    it("cotista nunca gera o relatório oficial — ele lê o que o ADM publicou", () => {
      // Sem isso, dez cotistas abrindo a mesma unidade gerariam dez PDFs
      // idênticos. O §16 chama isso de "geração individual repetida".
      expect(cotistaPodeGerarRelatorioOficial()).toBe(false)
    })
  })
})
