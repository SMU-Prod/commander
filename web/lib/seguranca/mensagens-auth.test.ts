import { describe, expect, it } from "vitest"
import { CODIGOS_AVISO, CODIGOS_ERRO, mensagemAviso, mensagemErro } from "./mensagens-auth"

/**
 * O TESTE DO ACHADO P2-11 (auditoria de 19/08/2026).
 *
 * A tarja vermelha do `/login` é um pedaço de tela onde o produto fala com a
 * pessoa em voz de dono. Enquanto o texto dela vinha da URL, quem escrevia a
 * URL escrevia na nossa voz. Não é XSS — o React escapa —, é pior de explicar
 * pra quem lê: a frase sai no nosso domínio, com o cadeado, com a nossa fonte.
 *
 * O que estes testes seguram é uma coisa só: a URL propõe, o servidor dispõe.
 * Só sai da lista fechada; qualquer outra coisa vira a genérica.
 */

/** O payload exato que a auditoria montou pra provar o buraco. Ele é o teste:
 *  enquanto esta frase não sair da tela, o achado está fechado. */
const PHISHING = "Sua conta foi bloqueada, ligue para 0800-000-0000"

/** A genérica não é exportada de propósito (ninguém deve importar frase solta),
 *  então a lemos pelo comportamento — que é como a tela a vê. */
const GENERICA = mensagemErro("codigo-que-nunca-existiu")!

describe("mensagemErro / mensagemAviso — códigos conhecidos", () => {
  it("traduz os erros que as telas realmente mostram", () => {
    expect(mensagemErro(CODIGOS_ERRO.credenciais)).toBe("E-mail ou senha incorretos")
    expect(mensagemErro(CODIGOS_ERRO.senhaCurta)).toBe(
      "A senha precisa de pelo menos 8 caracteres.",
    )
    expect(mensagemErro(CODIGOS_ERRO.muitasTentativas)).toBe(
      "Muitas tentativas em pouco tempo. Espere alguns minutos e tente de novo.",
    )
    expect(mensagemErro(CODIGOS_ERRO.linkExpirado)).toBe(
      "Esse link expirou ou já foi usado. Peça um novo e-mail abaixo.",
    )
  })

  it("traduz os avisos do fluxo de e-mail", () => {
    expect(mensagemAviso(CODIGOS_AVISO.reenvioEnviado)).toBe(
      "Se houver uma conta com esse e-mail aguardando confirmação, o novo link já saiu. Confira também o spam.",
    )
    expect(mensagemAviso(CODIGOS_AVISO.recuperacaoEnviada)).toBe(
      "Se houver conta com esse e-mail, o link para criar uma nova senha já saiu. Confira também o spam.",
    )
  })

  it("não deixa nenhum código do catálogo sem frase própria", () => {
    // Um código emitido por `lib/acoes/auth.ts` e esquecido na tabela de
    // tradução não quebra nada em runtime — ele só cai calado na genérica, e a
    // pessoa perde a explicação real. Este teste é o que faz esse esquecimento
    // aparecer aqui, e não na tela de alguém.
    for (const codigo of Object.values(CODIGOS_ERRO)) {
      expect(mensagemErro(codigo), `erro sem frase: ${codigo}`).not.toBe(GENERICA)
    }
    for (const codigo of Object.values(CODIGOS_AVISO)) {
      expect(mensagemAviso(codigo), `aviso sem frase: ${codigo}`).not.toBe(GENERICA)
    }
  })
})

describe("o link forjado não fala pela boca do produto", () => {
  it("engole o payload da auditoria e devolve a genérica", () => {
    expect(mensagemErro(PHISHING)).toBe(GENERICA)
    expect(mensagemAviso(PHISHING)).toBe(GENERICA)
  })

  it("a frase que sobra não carrega telefone nem ordem nenhuma", () => {
    // O ponto do achado em uma linha: o atacante queria um telefone na tela.
    for (const saida of [mensagemErro(PHISHING)!, mensagemAviso(PHISHING)!]) {
      expect(saida).not.toContain("0800")
      expect(saida.toLowerCase()).not.toContain("ligue")
      expect(saida).not.toContain("bloqueada")
    }
  })

  it("qualquer código inventado cai na mesma frase vaga", () => {
    for (const lixo of ["admin", "Sua conta expirou", "<b>oi</b>", "credenciais ", "CREDENCIAIS"]) {
      expect(mensagemErro(lixo), `vazou por: ${lixo}`).toBe(GENERICA)
    }
  })
})

describe("sem código, sem tarja", () => {
  it("devolve null quando não há nada a dizer", () => {
    // `null` e não string vazia: é o que faz a tela NÃO renderizar a tarja.
    // Uma string vazia acenderia uma caixa vermelha muda em toda visita.
    expect(mensagemErro(undefined)).toBeNull()
    expect(mensagemErro(null)).toBeNull()
    expect(mensagemErro("")).toBeNull()
    expect(mensagemAviso(undefined)).toBeNull()
    expect(mensagemAviso(null)).toBeNull()
    expect(mensagemAviso("")).toBeNull()
  })
})

describe("nenhuma frase entrega quem tem conta no Commander", () => {
  const todasAsFrases = [
    ...Object.values(CODIGOS_ERRO).map((c) => mensagemErro(c)!),
    ...Object.values(CODIGOS_AVISO).map((c) => mensagemAviso(c)!),
    GENERICA,
  ]

  it("as respostas de reenvio e recuperação são condicionais", () => {
    // Elas respondem a um formulário de e-mail SÓ. Se a frase mudasse conforme
    // o e-mail ter ou não conta, o formulário viraria uma consulta pública de
    // cadastro: digita, lê a resposta, sabe. Por isso o "se houver" — a mesma
    // frase sai nos dois casos.
    expect(mensagemAviso(CODIGOS_AVISO.reenvioEnviado)).toContain("Se houver")
    expect(mensagemAviso(CODIGOS_AVISO.recuperacaoEnviada)).toContain("Se houver")
  })

  it("nenhuma frase afirma que a conta existe ou que não existe", () => {
    const delatoras = [
      /não existe/i,
      /nenhuma conta/i,
      /não encontrad/i,
      /não cadastrad/i,
      /conta existe/i,
      /já existe/i,
      /e-mail inexistente/i,
      /usuário não/i,
    ]
    for (const frase of todasAsFrases) {
      for (const delatora of delatoras) {
        expect(frase, `frase entrega o cadastro (${delatora}): "${frase}"`).not.toMatch(delatora)
      }
    }
  })
})

// ONDA 95 — o furo que o `?? GENERICA` deixava aberto. Sem `Object.hasOwn`,
// estas chaves devolvem objeto/funcao herdada de `Object.prototype`, o JSX
// tenta renderizar e o React derruba a tela de entrada por link forjado.
describe("chave herdada de Object.prototype nao escapa", () => {
  const HERDADAS = ["__proto__", "constructor", "toString", "valueOf", "hasOwnProperty"]
  it("erro: toda herdada cai na frase generica", () => {
    for (const chave of HERDADAS) {
      expect(typeof mensagemErro(chave)).toBe("string")
      expect(mensagemErro(chave)).toBe(mensagemErro("codigo-que-nao-existe"))
    }
  })
  it("aviso: toda herdada cai na frase generica", () => {
    for (const chave of HERDADAS) {
      expect(typeof mensagemAviso(chave)).toBe("string")
      expect(mensagemAviso(chave)).toBe(mensagemAviso("codigo-que-nao-existe"))
    }
  })
})