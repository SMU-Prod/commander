import { describe, expect, it } from "vitest"
import { ehRotaPublica, temCookieDeSessao } from "./rotas-publicas"

describe("ehRotaPublica", () => {
  it("libera a vitrine e as páginas que se lê antes de criar conta", () => {
    expect(ehRotaPublica("/")).toBe(true)
    expect(ehRotaPublica("/parceiros")).toBe(true)
    expect(ehRotaPublica("/termos")).toBe(true)
    expect(ehRotaPublica("/privacidade")).toBe(true)
  })

  it("libera /login, e SÓ /login (achado P2-13: era prefixo)", () => {
    expect(ehRotaPublica("/login")).toBe(true)
    expect(ehRotaPublica("/loginfalso")).toBe(false)
    expect(ehRotaPublica("/login-admin")).toBe(false)
    expect(ehRotaPublica("/logins")).toBe(false)
  })

  it("mantém /auth/callback público — o link do e-mail PRECISA rodar deslogado (onda 83)", () => {
    expect(ehRotaPublica("/auth/callback")).toBe(true)
    // O prefixo vale pro ramo inteiro: rota nova em /auth/ já nasce aberta,
    // que é o comportamento pretendido — ali é uma árvore, não uma página.
    expect(ehRotaPublica("/auth/qualquer-rota-futura")).toBe(true)
  })

  it("não confunde página pública com vizinha de nome parecido", () => {
    expect(ehRotaPublica("/parceiro")).toBe(false)
    expect(ehRotaPublica("/parceiros-vip")).toBe(false)
    expect(ehRotaPublica("/termos-de-uso")).toBe(false)
  })

  it("mantém o app atrás do gate", () => {
    expect(ehRotaPublica("/hoje")).toBe(false)
    expect(ehRotaPublica("/convite/abc")).toBe(false)
  })
})

// ONDA 96 — o atalho que evita uma volta de rede por navegacao. Ele so pode
// responder "certamente NAO ha sessao"; dizer que HA continua sendo trabalho
// do servidor de autenticacao.
describe("temCookieDeSessao", () => {
  it("reconhece o cookie inteiro", () => {
    expect(temCookieDeSessao([{ name: "sb-khgjtxvmduizyooqaoox-auth-token" }])).toBe(true)
  })
  it("reconhece o cookie FATIADO — token grande vira .0/.1", () => {
    expect(temCookieDeSessao([
      { name: "sb-khgjtxvmduizyooqaoox-auth-token.0" },
      { name: "sb-khgjtxvmduizyooqaoox-auth-token.1" },
    ])).toBe(true)
  })
  it("sem cookie nenhum e sem cookie de sessao devolve falso", () => {
    expect(temCookieDeSessao([])).toBe(false)
    expect(temCookieDeSessao([{ name: "tema" }, { name: "embarcacao_ativa" }])).toBe(false)
  })
  it("cookie do Supabase que NAO e de sessao nao conta", () => {
    expect(temCookieDeSessao([{ name: "sb-khgjtxvmduizyooqaoox-provider-token" }])).toBe(false)
  })
})