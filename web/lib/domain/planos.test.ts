import { describe, expect, it } from "vitest"
import {
  economiaDaPromocao,
  ehCobravel,
  escolherPromocao,
  formatarPreco,
  freeEquivalente,
  PLANOS,
  PLANOS_APOSENTADOS,
  PLANOS_COBRAVEIS,
  planosDoPerfil,
  precoEmTexto,
  precoGoldComDesconto,
  precoVigenteCentavos,
  PROMOCOES,
  proximoUpgrade,
  validadeDaPromocao,
  type PlanoId,
} from "./planos"

const HOJE = "2026-08-15"

describe("catalogo do PRD FINAL §2/§28", () => {
  it("os precos congelados sao exatamente os do PRD", () => {
    expect(PLANOS.commander.valorCentavos).toBe(4990)
    expect(PLANOS.commander_pro.valorCentavos).toBe(6990)
    expect(PLANOS.captain_pro.valorCentavos).toBe(2490)
    expect(PLANOS.partner_prestador.valorCentavos).toBe(2490)
    expect(PLANOS.partner_loja.valorCentavos).toBe(2490)
  })

  it("os planos gratuitos custam zero, nao null", () => {
    for (const id of ["proprietario_free", "captain_free", "partner_marina", "partner_posto"] as const) {
      expect(PLANOS[id].valorCentavos).toBe(0)
    }
  })

  it("Restaurante e Pousada sao 'gratis inicialmente' — diferente de gratis", () => {
    expect(PLANOS.partner_restaurante.gratuitoInicialmente).toBe(true)
    expect(PLANOS.partner_pousada.gratuitoInicialmente).toBe(true)
    expect(PLANOS.partner_marina.gratuitoInicialmente).toBe(false)
    expect(precoEmTexto("partner_restaurante")).toBe("Grátis inicialmente")
    expect(precoEmTexto("partner_marina")).toBe("Grátis")
  })

  it("Enterprise nao tem preco e so aparece como 'em breve' (§2, §26)", () => {
    expect(PLANOS.commander_enterprise.valorCentavos).toBeNull()
    expect(PLANOS.commander_enterprise.disponibilidade).toBe("em_breve")
    expect(precoEmTexto("commander_enterprise")).toBe("A definir")
    expect(ehCobravel("commander_enterprise")).toBe(false)
    expect(PLANOS_COBRAVEIS).not.toContain("commander_enterprise")
  })

  it("capacidade: 1 embarcacao no Commander, 4 no Pro, 2 acessos nos dois (§28)", () => {
    expect(PLANOS.proprietario_free.limiteEmbarcacoes).toBe(1)
    expect(PLANOS.commander.limiteEmbarcacoes).toBe(1)
    expect(PLANOS.commander_pro.limiteEmbarcacoes).toBe(4)
    expect(PLANOS.commander.limiteAcessosPorEmbarcacao).toBe(2)
    expect(PLANOS.commander_pro.limiteAcessosPorEmbarcacao).toBe(2)
  })

  it("Free nao adiciona tripulacao e cria 2 Diarios (§2.3, §28)", () => {
    expect(PLANOS.proprietario_free.limiteAcessosPorEmbarcacao).toBe(0)
    expect(PLANOS.proprietario_free.limiteDiarios).toBe(2)
    expect(PLANOS.commander.limiteDiarios).toBeNull()
  })

  it("so plano pago e disponivel e cobravel", () => {
    expect([...PLANOS_COBRAVEIS].sort()).toEqual(
      ["captain_pro", "commander", "commander_pro", "partner_loja", "partner_prestador"].sort(),
    )
  })

  it("o plano fundador foi aposentado e nao voltou pro catalogo", () => {
    for (const antigo of PLANOS_APOSENTADOS) {
      expect(Object.keys(PLANOS)).not.toContain(antigo)
    }
  })

  it("todo plano cobravel tem ciclo — o gateway precisa dele", () => {
    for (const id of PLANOS_COBRAVEIS) expect(PLANOS[id].ciclo).not.toBeNull()
  })

  it("planosDoPerfil lista o gratuito antes do pago e o 'em breve' por ultimo", () => {
    const proprietario = planosDoPerfil("proprietario").map((p) => p.id)
    expect(proprietario).toEqual(["proprietario_free", "commander", "commander_pro", "commander_enterprise"])
  })
})

describe("proximoUpgrade e freeEquivalente", () => {
  it("a escada do proprietario e Free -> Commander -> Pro, e para ai", () => {
    expect(proximoUpgrade("proprietario_free")).toBe("commander")
    expect(proximoUpgrade("commander")).toBe("commander_pro")
    expect(proximoUpgrade("commander_pro")).toBeNull()
  })
  it("Captain sobe do Free pro Pro e para", () => {
    expect(proximoUpgrade("captain_free")).toBe("captain_pro")
    expect(proximoUpgrade("captain_pro")).toBeNull()
  })
  it("Enterprise nunca e oferecido como upgrade — §2 manda so exibir", () => {
    for (const id of Object.keys(PLANOS) as PlanoId[]) {
      expect(proximoUpgrade(id)).not.toBe("commander_enterprise")
    }
  })
  it("perder a assinatura cai no Free do MESMO perfil (§23)", () => {
    expect(freeEquivalente("commander_pro")).toBe("proprietario_free")
    expect(freeEquivalente("commander")).toBe("proprietario_free")
    expect(freeEquivalente("captain_pro")).toBe("captain_free")
  })
})

describe("promocoes §2.1 e §2.2", () => {
  it("migracao de concorrente: R$ 24,90 por 3 meses + 20% no Gold", () => {
    expect(PROMOCOES.migracao_concorrente.valorPromocionalCentavos).toBe(2490)
    expect(PROMOCOES.migracao_concorrente.duracaoMeses).toBe(3)
    expect(PROMOCOES.migracao_concorrente.descontoGoldPercentual).toBe(20)
    expect(PROMOCOES.migracao_concorrente.planoAlvo).toBe("commander")
  })

  it("entrada pelo Gold: 6 meses de Commander incluidos, sem cobranca", () => {
    expect(PROMOCOES.entrada_gold.valorPromocionalCentavos).toBe(0)
    expect(PROMOCOES.entrada_gold.duracaoMeses).toBe(6)
    expect(PROMOCOES.entrada_gold.planoAlvo).toBe("commander")
  })

  it("nao acumulam: com as duas candidatas sai UMA so, a que economiza mais", () => {
    expect(escolherPromocao(["migracao_concorrente", "entrada_gold"])).toBe("entrada_gold")
    expect(escolherPromocao(["entrada_gold", "migracao_concorrente"])).toBe("entrada_gold")
    expect(economiaDaPromocao("entrada_gold")).toBeGreaterThan(economiaDaPromocao("migracao_concorrente"))
  })

  it("sem candidata nenhuma, nenhuma promocao", () => {
    expect(escolherPromocao([])).toBeNull()
  })

  it("preco vigente usa a promocao enquanto ela vale e volta ao cheio depois", () => {
    const promo = { promocao: "migracao_concorrente" as const, validoAte: "2026-11-15" }
    expect(precoVigenteCentavos("commander", promo, HOJE)).toBe(2490)
    expect(precoVigenteCentavos("commander", promo, "2026-11-16")).toBe(4990)
    expect(precoVigenteCentavos("commander", null, HOJE)).toBe(4990)
  })

  it("promocao de outro plano nao vale pro plano assinado", () => {
    const promo = { promocao: "migracao_concorrente" as const, validoAte: "2026-11-15" }
    expect(precoVigenteCentavos("commander_pro", promo, HOJE)).toBe(6990)
  })

  it("desconto no Gold so existe enquanto a promocao de migracao vale", () => {
    const promo = { promocao: "migracao_concorrente" as const, validoAte: "2026-11-15" }
    expect(precoGoldComDesconto(249000, promo, HOJE)).toBe(199200)
    expect(precoGoldComDesconto(249000, promo, "2026-11-16")).toBe(249000)
    expect(precoGoldComDesconto(249000, null, HOJE)).toBe(249000)
  })

  it("entrada pelo Gold nao da desconto no proprio Gold (ja foi pago integral)", () => {
    const promo = { promocao: "entrada_gold" as const, validoAte: "2027-02-15" }
    expect(precoGoldComDesconto(249000, promo, HOJE)).toBe(249000)
  })

  it("validade soma meses de calendario e nunca estoura pra um mes seguinte", () => {
    expect(validadeDaPromocao("2026-08-15", "migracao_concorrente")).toBe("2026-11-15")
    expect(validadeDaPromocao("2026-08-15", "entrada_gold")).toBe("2027-02-15")
    // 30/11 + 3 meses cairia em 30/02, que nao existe: fica no ultimo dia
    expect(validadeDaPromocao("2026-11-30", "migracao_concorrente")).toBe("2027-02-28")
  })
})

describe("formatarPreco", () => {
  it("escreve em reais pt-BR com espaco normal", () => {
    expect(formatarPreco(4990)).toBe("R$ 49,90")
    expect(formatarPreco(6990)).toBe("R$ 69,90")
    expect(formatarPreco(2490)).toBe("R$ 24,90")
  })
  it("precoEmTexto junta valor e ciclo num lugar so", () => {
    expect(precoEmTexto("commander")).toBe("R$ 49,90/mês")
    expect(precoEmTexto("commander_pro")).toBe("R$ 69,90/mês")
  })
})
