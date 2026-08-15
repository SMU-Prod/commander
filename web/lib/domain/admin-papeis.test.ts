import { describe, expect, it } from "vitest"
import {
  ehAdminNacional,
  ehAdminQualquer,
  ehCeo,
  ESCOPO_PAPEL,
  exigeRegioes,
  PAPEIS_ADMIN,
  papeisValidos,
  podeAcessar,
  podeGerenciarAdministradores,
  resumoPapeis,
  ROTULO_PAPEL,
  temPapelAdmin,
  type PapelAdmin,
} from "./admin-papeis"

describe("papéis administrativos (PRD §21)", () => {
  it("tem exatamente as quatro funções do PRD, com rótulo e escopo cada uma", () => {
    expect(PAPEIS_ADMIN).toEqual(["ceo", "suporte", "comercial", "vistoriador"])
    for (const p of PAPEIS_ADMIN) {
      expect(ROTULO_PAPEL[p]).toBeTruthy()
      expect(ESCOPO_PAPEL[p]).toBeTruthy()
    }
  })

  it("CEO implica todos os papéis — 'Acesso total' é a primeira linha do §21", () => {
    const ceo: PapelAdmin[] = ["ceo"]
    expect(temPapelAdmin(ceo, "suporte")).toBe(true)
    expect(temPapelAdmin(ceo, "comercial")).toBe(true)
    expect(temPapelAdmin(ceo, "vistoriador")).toBe(true)
  })

  it("um papel não vira outro: Suporte não é Comercial", () => {
    expect(temPapelAdmin(["suporte"], "comercial")).toBe(false)
    expect(temPapelAdmin(["comercial"], "suporte")).toBe(false)
    expect(temPapelAdmin(["vistoriador"], "suporte")).toBe(false)
  })

  it("acumula papéis sem inventar um papel novo", () => {
    const dois: PapelAdmin[] = ["suporte", "comercial"]
    expect(temPapelAdmin(dois, "suporte")).toBe(true)
    expect(temPapelAdmin(dois, "comercial")).toBe(true)
    expect(temPapelAdmin(dois, "vistoriador")).toBe(false)
    expect(resumoPapeis(dois)).toBe("Suporte e Comercial")
  })
})

describe("vistoriador não é admin nacional", () => {
  it("fica de fora de ehAdminNacional — é a linha que o §21 traça", () => {
    expect(ehAdminNacional(["vistoriador"])).toBe(false)
    expect(ehAdminNacional(["suporte"])).toBe(true)
    expect(ehAdminNacional(["comercial"])).toBe(true)
    expect(ehAdminNacional(["ceo"])).toBe(true)
  })

  it("mas entra no painel — a porta é 'trabalha aqui', não 'vê tudo'", () => {
    expect(ehAdminQualquer(["vistoriador"])).toBe(true)
    expect(ehAdminQualquer([])).toBe(false)
  })

  it("é o único papel que exige regiões declaradas", () => {
    expect(exigeRegioes("vistoriador")).toBe(true)
    expect(exigeRegioes("suporte")).toBe(false)
    expect(exigeRegioes("comercial")).toBe(false)
    expect(exigeRegioes("ceo")).toBe(false)
  })
})

describe("alcance de cada área", () => {
  it("Dashboard e gestão de administradores são só do CEO", () => {
    expect(podeAcessar(["ceo"], "dashboard")).toBe(true)
    expect(podeAcessar(["suporte"], "dashboard")).toBe(false)
    expect(podeAcessar(["comercial"], "dashboard")).toBe(false)
    expect(podeAcessar(["vistoriador"], "dashboard")).toBe(false)

    expect(podeGerenciarAdministradores(["ceo"])).toBe(true)
    expect(podeGerenciarAdministradores(["suporte", "comercial"])).toBe(false)
  })

  it("Suporte opera Gold mas não mexe em preço; Comercial é o contrário", () => {
    expect(podeAcessar(["suporte"], "gold")).toBe(true)
    expect(podeAcessar(["suporte"], "gold_precos")).toBe(false)
    expect(podeAcessar(["comercial"], "gold_precos")).toBe(true)
    expect(podeAcessar(["comercial"], "gold")).toBe(false)
  })

  it("vistoriador alcança Gold e os próprios logs, e nada de comercial", () => {
    expect(podeAcessar(["vistoriador"], "gold")).toBe(true)
    expect(podeAcessar(["vistoriador"], "logs")).toBe(true)
    expect(podeAcessar(["vistoriador"], "marketplace")).toBe(false)
    expect(podeAcessar(["vistoriador"], "taxonomia")).toBe(false)
    expect(podeAcessar(["vistoriador"], "parceiros")).toBe(false)
  })

  it("quem não tem papel nenhum não alcança nada", () => {
    expect(ehCeo([])).toBe(false)
    for (const area of ["dashboard", "administradores", "logs", "taxonomia", "gold", "gold_precos", "marketplace", "parceiros"] as const) {
      expect(podeAcessar([], area)).toBe(false)
    }
  })
})

describe("papéis vindos do banco", () => {
  it("descarta string desconhecida em vez de tratar como papel", () => {
    expect(papeisValidos(["suporte", "superadmin", "CEO", ""])).toEqual(["suporte"])
    expect(papeisValidos([])).toEqual([])
  })

  it("mantém a ordem canônica do PRD, não a ordem do banco", () => {
    expect(papeisValidos(["vistoriador", "ceo", "comercial"])).toEqual(["ceo", "comercial", "vistoriador"])
  })

  it("resumo lê como frase e não como lista de código", () => {
    expect(resumoPapeis([])).toBe("Sem papel administrativo")
    expect(resumoPapeis(["ceo"])).toBe("CEO / Super Admin")
    expect(resumoPapeis(["vistoriador", "suporte"])).toBe("Suporte e Gold / Vistoriador")
  })
})
