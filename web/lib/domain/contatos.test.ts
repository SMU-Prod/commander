import { describe, expect, it } from "vitest"
import { CONTATOS_EMERGENCIA, resumoDoContato, telefoneHref, whatsappHref } from "./contatos"

describe("CONTATOS_EMERGENCIA", () => {
  it("emergência primeiro: o 185 (Salvamar) abre a lista e é discável", () => {
    expect(CONTATOS_EMERGENCIA[0].valor).toBe("185")
    expect(CONTATOS_EMERGENCIA[0].telefone).toBe("185")
  })
  it("o canal VHF 16 é leitura, nunca link discável", () => {
    const vhf = CONTATOS_EMERGENCIA.find((c) => c.valor === "VHF 16")
    expect(vhf).toBeDefined()
    expect(vhf?.telefone).toBeUndefined()
  })
})

describe("telefoneHref", () => {
  it("celular com DDD ganha +55 — o link disca até em roaming", () => {
    expect(telefoneHref("21 99999-0000")).toBe("tel:+5521999990000")
    expect(telefoneHref("(24) 3365-1010")).toBe("tel:+552433651010")
  })
  it("número curto de serviço disca como está — +55 quebraria a chamada", () => {
    expect(telefoneHref("185")).toBe("tel:185")
  })
  it("vazio ou nulo não vira botão", () => {
    expect(telefoneHref(null)).toBeNull()
    expect(telefoneHref("  ")).toBeNull()
  })
  it("número que já tem código de país não ganha outro", () => {
    expect(telefoneHref("+55 21 99999-0000")).toBe("tel:+5521999990000")
  })
  it("0800 disca como está — DDD nunca começa com 0", () => {
    expect(telefoneHref("0800 721 1188")).toBe("tel:08007211188")
  })
})

describe("whatsappHref", () => {
  it("número de gente (DDD + número) abre conversa", () => {
    expect(whatsappHref("21 99999-0000")).toBe("https://wa.me/5521999990000")
  })
  it("número curto de serviço e 0800 não têm WhatsApp", () => {
    expect(whatsappHref("185")).toBeNull()
    expect(whatsappHref("0800 721 1188")).toBeNull()
    expect(whatsappHref(null)).toBeNull()
  })
})

describe("resumoDoContato", () => {
  it("empresa · especialidade · contagem real de serviços", () => {
    expect(resumoDoContato({ empresa: "Náutica Angra", especialidade: "Mecânica diesel" }, 3))
      .toBe("Náutica Angra · Mecânica diesel · 3 serviços neste barco")
  })
  it("singular quando é um serviço só", () => {
    expect(resumoDoContato({ empresa: null, especialidade: "Elétrica" }, 1))
      .toBe("Elétrica · 1 serviço neste barco")
  })
  it("sem empresa nem especialidade sobra só a contagem — nunca ' · ' solto", () => {
    expect(resumoDoContato({ empresa: null, especialidade: null }, 0))
      .toBe("0 serviços neste barco")
  })
})
