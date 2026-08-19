import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * O TETO DE TENTATIVAS DAS PORTAS DE IDENTIDADE, provado (onda 86, P2-10/P2-12).
 *
 * Este teste existe por dois motivos que não se checam lendo o código:
 *
 * 1. O teto só vale se ele CORTAR ANTES DA REDE. Não basta redirecionar com a
 *    mensagem certa — se o `signInWithPassword` ainda sai, o freio é decorativo
 *    e o atacante segue palpitando à vontade. Por isso quase toda asserção
 *    aqui é sobre a chamada NÃO ter acontecido.
 * 2. A resposta do teto não pode virar um detector de contas. A regra do
 *    cabeçalho de `auth.ts` diz que nenhuma resposta revela se um e-mail tem
 *    conta aqui, e o teto é o candidato natural a furar isso. O teste do meio
 *    compara, byte a byte, a URL de um e-mail que existe com a de um que não
 *    existe.
 *
 * O `redirect` do Next LANÇA (é assim que ele interrompe a action no meio), e o
 * dublê abaixo imita esse comportamento carregando a URL junto — é o que
 * permite afirmar sobre o destino em vez de sobre o efeito colateral.
 */

const ErroDeRedirect = vi.hoisted(() => {
  return class ErroDeRedirect extends Error {
    url: string
    constructor(url: string) {
      super(`NEXT_REDIRECT ${url}`)
      this.url = url
    }
  }
})

/** IP que o `x-forwarded-for` do dublê vai devolver — mutável para provar que
 *  cada IP tem seu próprio balde. */
const pedido = vi.hoisted(() => ({ ip: "203.0.113.10" }))

const auth = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  resend: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new ErroDeRedirect(url)
  },
}))

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": pedido.ip }),
}))

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({ auth }),
}))

import { _resetarLimitesParaTeste } from "@/lib/seguranca/limitador"
import { cadastrar, entrar, pedirNovaSenha, reenviarConfirmacao } from "./auth"

const LIMITE_ENTRAR = 10
const LIMITE_CADASTRAR = 5
const LIMITE_LINK_EMAIL = 3

beforeEach(() => {
  // O balde é memória de módulo e sobreviveria de um teste para o outro — sem
  // isto, o segundo teste começaria já com o teto meio gasto pelo primeiro.
  _resetarLimitesParaTeste()
  vi.clearAllMocks()
  pedido.ip = "203.0.113.10"
  auth.signInWithPassword.mockResolvedValue({ error: null })
  auth.signUp.mockResolvedValue({ data: { session: null, user: {} }, error: null })
  auth.resend.mockResolvedValue({ error: null })
  auth.resetPasswordForEmail.mockResolvedValue({ error: null })
})

function formulario(campos: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [chave, valor] of Object.entries(campos)) fd.set(chave, valor)
  return fd
}

/** Roda a action e devolve a URL do redirect. Falha alto se a action terminar
 *  sem redirecionar — em `auth.ts` todo caminho termina em `redirect`. */
async function urlDoRedirect(acao: () => Promise<unknown>): Promise<string> {
  try {
    await acao()
  } catch (erro) {
    if (erro instanceof ErroDeRedirect) return erro.url
    throw erro
  }
  throw new Error("a action terminou sem redirect, e todo caminho dela deveria redirecionar")
}

describe("entrar — teto de tentativas por IP", () => {
  it("deixa passar até o teto e, na tentativa seguinte, corta ANTES de falar com o Supabase", async () => {
    for (let i = 0; i < LIMITE_ENTRAR; i++) {
      await urlDoRedirect(() => entrar(formulario({ email: "dono@barco.com", senha: "senha-certa-1", volta: "/hoje" })))
    }
    expect(auth.signInWithPassword).toHaveBeenCalledTimes(LIMITE_ENTRAR)

    const url = await urlDoRedirect(() =>
      entrar(formulario({ email: "dono@barco.com", senha: "senha-certa-1", volta: "/hoje" })),
    )
    expect(url).toContain("erro=muitas-tentativas")
    // A prova de que o freio é freio: nenhuma chamada nova saiu.
    expect(auth.signInWithPassword).toHaveBeenCalledTimes(LIMITE_ENTRAR)
  })

  it("conta TODA tentativa, inclusive as que dão certo — não só as que falham", async () => {
    // Todas as dez abaixo entram com sucesso (o dublê devolve `error: null`) e
    // ainda assim gastam o balde. Um teto que só conta erro não segura quem
    // acertou a senha e está martelando outra coisa.
    for (let i = 0; i < LIMITE_ENTRAR; i++) {
      const url = await urlDoRedirect(() =>
        entrar(formulario({ email: "dono@barco.com", senha: "senha-certa-1", volta: "/hoje" })),
      )
      expect(url).toBe("/hoje")
    }
    const url = await urlDoRedirect(() =>
      entrar(formulario({ email: "dono@barco.com", senha: "senha-certa-1", volta: "/hoje" })),
    )
    expect(url).toContain("erro=muitas-tentativas")
  })

  it("cada IP tem seu próprio balde — o vizinho estourado não tranca ninguém", async () => {
    for (let i = 0; i <= LIMITE_ENTRAR; i++) {
      await urlDoRedirect(() => entrar(formulario({ email: "a@barco.com", senha: "12345678", volta: "/hoje" })))
    }
    const chamadasDoPrimeiro = auth.signInWithPassword.mock.calls.length
    expect(chamadasDoPrimeiro).toBe(LIMITE_ENTRAR)

    pedido.ip = "198.51.100.77"
    const url = await urlDoRedirect(() =>
      entrar(formulario({ email: "b@barco.com", senha: "12345678", volta: "/hoje" })),
    )
    expect(url).toBe("/hoje")
    expect(auth.signInWithPassword).toHaveBeenCalledTimes(chamadasDoPrimeiro + 1)
  })

  it("a resposta do teto é IDÊNTICA para e-mail que existe e para e-mail que não existe", async () => {
    // Cenário A — o e-mail tem conta: o Supabase deixaria entrar.
    auth.signInWithPassword.mockResolvedValue({ error: null })
    for (let i = 0; i < LIMITE_ENTRAR; i++) {
      await urlDoRedirect(() => entrar(formulario({ email: "existe@barco.com", senha: "12345678", volta: "/hoje" })))
    }
    const urlDeQuemExiste = await urlDoRedirect(() =>
      entrar(formulario({ email: "existe@barco.com", senha: "12345678", volta: "/hoje" })),
    )

    // Cenário B — o e-mail não tem conta nenhuma: o Supabase recusaria.
    _resetarLimitesParaTeste()
    auth.signInWithPassword.mockResolvedValue({ error: { code: "invalid_credentials" } })
    for (let i = 0; i < LIMITE_ENTRAR; i++) {
      await urlDoRedirect(() =>
        entrar(formulario({ email: "nao-existe@lugar-nenhum.com", senha: "12345678", volta: "/hoje" })),
      )
    }
    const urlDeQuemNaoExiste = await urlDoRedirect(() =>
      entrar(formulario({ email: "nao-existe@lugar-nenhum.com", senha: "12345678", volta: "/hoje" })),
    )

    // Byte a byte: é o balde por IP que garante isto. Balde por e-mail faria as
    // duas URLs divergirem no tempo e entregaria quem é cliente nosso.
    expect(urlDeQuemExiste).toBe(urlDeQuemNaoExiste)
    expect(urlDeQuemExiste).toContain("erro=muitas-tentativas")
  })
})

describe("cadastrar — senha mínima no servidor (P2-12) e teto próprio", () => {
  it("senha de 7 caracteres nunca chega ao Supabase e volta com senha-curta", async () => {
    const url = await urlDoRedirect(() =>
      cadastrar(formulario({ email: "novo@barco.com", senha: "1234567", nome: "Zé", volta: "/hoje" })),
    )
    expect(url).toContain("erro=senha-curta")
    expect(url).toContain("modo=cadastro")
    // O `volta` sobrevive ao erro — quem estava indo para algum lugar continua
    // indo para lá depois de corrigir a senha.
    expect(url).toContain("volta=%2Fhoje")
    expect(auth.signUp).not.toHaveBeenCalled()
  })

  it("senha de 8 caracteres passa e o cadastro sai", async () => {
    const url = await urlDoRedirect(() =>
      cadastrar(formulario({ email: "novo@barco.com", senha: "12345678", nome: "Zé", volta: "/hoje" })),
    )
    expect(auth.signUp).toHaveBeenCalledTimes(1)
    expect(url).toContain("aviso=cadastro-recebido")
  })

  it("para no teto de cadastros por hora sem criar mais nenhuma conta", async () => {
    for (let i = 0; i < LIMITE_CADASTRAR; i++) {
      await urlDoRedirect(() =>
        cadastrar(formulario({ email: `barco${i}@marina.com`, senha: "12345678", nome: "Zé", volta: "" })),
      )
    }
    expect(auth.signUp).toHaveBeenCalledTimes(LIMITE_CADASTRAR)

    const url = await urlDoRedirect(() =>
      cadastrar(formulario({ email: "barco-demais@marina.com", senha: "12345678", nome: "Zé", volta: "" })),
    )
    expect(url).toContain("erro=muitas-tentativas")
    expect(url).toContain("modo=cadastro")
    expect(auth.signUp).toHaveBeenCalledTimes(LIMITE_CADASTRAR)
  })
})

describe("reenvio e recuperação — teto de e-mails disparados", () => {
  it("reenviarConfirmacao para no teto sem mandar mais e-mail", async () => {
    for (let i = 0; i < LIMITE_LINK_EMAIL; i++) {
      await urlDoRedirect(() => reenviarConfirmacao(formulario({ email: "dono@barco.com" })))
    }
    expect(auth.resend).toHaveBeenCalledTimes(LIMITE_LINK_EMAIL)

    const url = await urlDoRedirect(() => reenviarConfirmacao(formulario({ email: "dono@barco.com" })))
    expect(url).toContain("erro=muitas-tentativas")
    expect(auth.resend).toHaveBeenCalledTimes(LIMITE_LINK_EMAIL)
  })

  it("pedirNovaSenha para no teto sem mandar mais e-mail", async () => {
    for (let i = 0; i < LIMITE_LINK_EMAIL; i++) {
      await urlDoRedirect(() => pedirNovaSenha(formulario({ email: "dono@barco.com" })))
    }
    expect(auth.resetPasswordForEmail).toHaveBeenCalledTimes(LIMITE_LINK_EMAIL)

    const url = await urlDoRedirect(() => pedirNovaSenha(formulario({ email: "dono@barco.com" })))
    expect(url).toContain("erro=muitas-tentativas")
    expect(auth.resetPasswordForEmail).toHaveBeenCalledTimes(LIMITE_LINK_EMAIL)
  })

  it("os dois baldes são separados: estourar o reenvio não fecha a recuperação de senha", async () => {
    // Quem está preso num fluxo não pode ficar sem o outro — é justamente a
    // saída que a onda 83 abriu para quem não consegue confirmar a conta.
    for (let i = 0; i <= LIMITE_LINK_EMAIL; i++) {
      await urlDoRedirect(() => reenviarConfirmacao(formulario({ email: "dono@barco.com" })))
    }
    const url = await urlDoRedirect(() => pedirNovaSenha(formulario({ email: "dono@barco.com" })))
    expect(url).toContain("aviso=recuperacao-enviada")
    expect(auth.resetPasswordForEmail).toHaveBeenCalledTimes(1)
  })
})
