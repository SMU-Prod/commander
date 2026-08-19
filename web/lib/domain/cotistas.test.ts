import { describe, expect, it } from "vitest"
import { PRESET_ENTERPRISE } from "./enterprise"
import { ABAS } from "./permissoes"
import {
  acimaDaCota,
  cotistaPodeGerarRelatorioOficial,
  estaSuspenso,
  faltaNoCadastro,
  MATRIZ_COTISTA_NO_BANCO,
  MENSAGEM_SUSPENSO,
  mensagemDeErroAoEntrar,
  mensagemDeRecusa,
  podeEntrarComLink,
  vagasDeCotista,
  type ErroAoEntrarComoCotista,
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

  // -------------------------------------------------------------------------
  // O resgate do link (onda 84, P1-6 da auditoria de 19/08/2026)
  // -------------------------------------------------------------------------

  describe("matriz com que o cotista nasce", () => {
    // ESTE É O TESTE QUE JUSTIFICA A DUPLICATA.
    //
    // A matriz é gravada por `aceitar_convite_cotista` (migration 077), em
    // SQL, porque `vinculos` não tem policy de INSERT e aceitar a matriz como
    // parâmetro deixaria qualquer um pedir `editar` em tudo. O SQL não
    // importa TypeScript, então a tabela existe duas vezes — e sem este teste
    // a divergência só apareceria quando um cotista real entrasse numa
    // unidade em que não enxerga nada.
    it("é exatamente o PRESET_ENTERPRISE.COTISTA — se falhar, a migration 077 ficou para trás", () => {
      expect(MATRIZ_COTISTA_NO_BANCO).toEqual(PRESET_ENTERPRISE.COTISTA)
    })

    it("cobre as 15 áreas, sem sobrar nem faltar", () => {
      // Área nova na matriz é área que o SQL da 077 não escreve — cairia no
      // `coalesce(..., false)` de `permissao()` e daria no mesmo, mas por
      // acidente. O teste força a decisão a ser tomada.
      expect(Object.keys(MATRIZ_COTISTA_NO_BANCO).sort()).toEqual([...ABAS].sort())
    })

    it("não dá `editar` em nada — §13: cotista não administra a frota", () => {
      for (const [aba, p] of Object.entries(MATRIZ_COTISTA_NO_BANCO)) {
        expect(p.editar, aba).toBe(false)
      }
    })

    it("não vê financeiro, carteira, contatos nem diário", () => {
      for (const aba of ["gastos", "carteira", "contatos", "diario"]) {
        expect(MATRIZ_COTISTA_NO_BANCO[aba].ver, aba).toBe(false)
      }
    })
  })

  describe("erro ao entrar com o link", () => {
    it("traduz os quatro códigos que a RPC levanta", () => {
      const codigos: ErroAoEntrarComoCotista[] = [
        "nao_autenticado", "convite_invalido", "ja_faz_parte", "sem_vaga_de_cota",
      ]
      for (const c of codigos) {
        const msg = mensagemDeErroAoEntrar(c)
        expect(msg, c).not.toContain("_")
        expect(msg.length, c).toBeGreaterThan(20)
      }
    })

    it("sem vaga manda pra administradora, e não culpa quem clicou", () => {
      const m = mensagemDeErroAoEntrar("sem_vaga_de_cota").toLowerCase()
      expect(m).toContain("administradora")
      expect(m).not.toContain("você")
    })

    it("erro desconhecido NÃO vira “convite inválido”", () => {
      // Acusar de link velho um convite que pode estar perfeitamente vivo é a
      // classe de mentira que esta tela existe para não cometer — a mesma que
      // a auditoria apontou em /patio (B7).
      const m = mensagemDeErroAoEntrar("timeout na rede").toLowerCase()
      expect(m).not.toContain("não vale mais")
      expect(m).not.toContain("inválido")
    })

    it("mensagem vazia, nula ou indefinida também cai no genérico", () => {
      const generico = mensagemDeErroAoEntrar("qualquer coisa")
      expect(mensagemDeErroAoEntrar("")).toBe(generico)
      expect(mensagemDeErroAoEntrar(null)).toBe(generico)
      expect(mensagemDeErroAoEntrar(undefined)).toBe(generico)
    })

    it("não confunde chave herdada de Object com código conhecido", () => {
      // `"toString" in MENSAGEM_POR_ERRO` seria true num objeto comum. Se a
      // implementação usasse `in` sem cuidado, o app mostraria `undefined`.
      expect(mensagemDeErroAoEntrar("toString")).toBe(mensagemDeErroAoEntrar("qualquer coisa"))
      expect(mensagemDeErroAoEntrar("constructor")).toBe(mensagemDeErroAoEntrar("qualquer coisa"))
    })
  })
})
