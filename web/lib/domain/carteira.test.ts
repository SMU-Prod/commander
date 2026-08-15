import { describe, expect, it } from "vitest"
import {
  AVISO_NAO_MOVIMENTA,
  leituraDoSaldo,
  saldoCarteira,
  sinalDoMovimento,
  statusInicialMovimento,
  validarMovimento,
  type MovimentoParaSaldo,
} from "./carteira"

function m(p: Partial<MovimentoParaSaldo> & { tipo: MovimentoParaSaldo["tipo"]; valorCentavos: number }): MovimentoParaSaldo {
  return { status: "aprovado", ...p }
}

describe("aviso obrigatório do PRD §9.4", () => {
  it("diz, com todas as letras, que o app não movimenta dinheiro", () => {
    expect(AVISO_NAO_MOVIMENTA).toContain("não guarda")
    expect(AVISO_NAO_MOVIMENTA).toContain("não transfere")
    expect(AVISO_NAO_MOVIMENTA).toContain("não movimenta dinheiro")
  })
})

describe("saldo", () => {
  it("repasse soma; gasto e devolução tiram", () => {
    expect(sinalDoMovimento("repasse")).toBe(1)
    expect(sinalDoMovimento("gasto")).toBe(-1)
    expect(sinalDoMovimento("devolucao")).toBe(-1)
  })
  it("saldo é repassado − gasto − devolvido", () => {
    const s = saldoCarteira([
      m({ tipo: "repasse", valorCentavos: 1000_00 }),
      m({ tipo: "gasto", valorCentavos: 300_00 }),
      m({ tipo: "devolucao", valorCentavos: 200_00 }),
    ])
    expect(s).toMatchObject({
      repassadoCentavos: 1000_00, gastoCentavos: 300_00,
      devolvidoCentavos: 200_00, saldoCentavos: 500_00,
    })
  })
  it("pendente não move saldo, mas aparece separado", () => {
    const s = saldoCarteira([
      m({ tipo: "repasse", valorCentavos: 500_00 }),
      m({ tipo: "gasto", valorCentavos: 120_00, status: "pendente" }),
    ])
    expect(s.saldoCentavos).toBe(500_00)
    expect(s.aguardandoCentavos).toBe(120_00)
    expect(s.aguardandoQtd).toBe(1)
  })
  it("recusado não conta em lugar nenhum", () => {
    const s = saldoCarteira([
      m({ tipo: "repasse", valorCentavos: 500_00 }),
      m({ tipo: "gasto", valorCentavos: 400_00, status: "recusado" }),
    ])
    expect(s.saldoCentavos).toBe(500_00)
    expect(s.gastoCentavos).toBe(0)
    expect(s.aguardandoCentavos).toBe(0)
  })
  it("saldo negativo é o barco devendo ao tripulante, e a tela diz isso", () => {
    const s = saldoCarteira([
      m({ tipo: "repasse", valorCentavos: 100_00 }),
      m({ tipo: "gasto", valorCentavos: 250_00 }),
    ])
    expect(s.saldoCentavos).toBe(-150_00)
    expect(leituraDoSaldo(s.saldoCentavos)).toEqual({ rotulo: "O barco deve ao tripulante", critico: true })
    expect(leituraDoSaldo(0).critico).toBe(false)
    expect(leituraDoSaldo(10_00).rotulo).toContain("responsabilidade do tripulante")
  })
})

describe("status inicial — quem decide é o modo da carteira, não o cliente", () => {
  it("Registro Direto: gasto do tripulante já nasce confirmado", () => {
    expect(statusInicialMovimento({ tipo: "gasto", modo: "direto", ehProprietario: false })).toBe("aprovado")
  })
  it("Aprovação do Proprietário: gasto do tripulante espera o OK", () => {
    expect(statusInicialMovimento({ tipo: "gasto", modo: "aprovacao", ehProprietario: false })).toBe("pendente")
  })
  it("devolução do tripulante sempre espera confirmação, mesmo no modo direto", () => {
    expect(statusInicialMovimento({ tipo: "devolucao", modo: "direto", ehProprietario: false })).toBe("pendente")
  })
  it("proprietário não espera aprovação de si mesmo", () => {
    expect(statusInicialMovimento({ tipo: "gasto", modo: "aprovacao", ehProprietario: true })).toBe("aprovado")
    expect(statusInicialMovimento({ tipo: "repasse", modo: "aprovacao", ehProprietario: true })).toBe("aprovado")
  })
})

describe("validação de movimento", () => {
  const bom = {
    tipo: "gasto" as const, valorCentavos: 300_00, descricao: "Diesel",
    categoria: "combustivel", temComprovante: true, exigeComprovante: true, saldoCentavos: 1000_00,
  }
  it("aceita gasto completo", () => {
    expect(validarMovimento(bom)).toEqual({ ok: true })
  })
  it("cobra comprovante quando a carteira exige", () => {
    const r = validarMovimento({ ...bom, temComprovante: false })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erro).toContain("comprovante")
  })
  it("não cobra comprovante quando a carteira não exige", () => {
    expect(validarMovimento({ ...bom, temComprovante: false, exigeComprovante: false })).toEqual({ ok: true })
  })
  it("gasto sem categoria não passa — é por ela que entra no Financeiro", () => {
    expect(validarMovimento({ ...bom, categoria: null }).ok).toBe(false)
  })
  it("gasto ACIMA do saldo é permitido (o tripulante completou do bolso dele)", () => {
    expect(validarMovimento({ ...bom, valorCentavos: 5000_00 })).toEqual({ ok: true })
  })
  it("devolução acima do saldo não é permitida", () => {
    const r = validarMovimento({
      ...bom, tipo: "devolucao", categoria: null, exigeComprovante: false,
      temComprovante: false, valorCentavos: 2000_00,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erro).toContain("maior que o saldo")
  })
  it("valor zero e descrição vazia não passam", () => {
    expect(validarMovimento({ ...bom, valorCentavos: 0 }).ok).toBe(false)
    expect(validarMovimento({ ...bom, descricao: "   " }).ok).toBe(false)
  })
})
