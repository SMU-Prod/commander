import { describe, expect, it } from "vitest"
import {
  ehCobravel,
  ehPlanoEnterprise,
  viewersIncluidos,
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

  // Onda 69 — o Enterprise deixou de ser um plano reservado sem preço e virou
  // as cinco faixas do §2 do PRD Upgrade 3. O que NÃO mudou: continua
  // "em breve", porque o §2 chama os valores de "faixas comerciais
  // preliminares, revisáveis após medir infraestrutura e suporte em
  // clientes-piloto". Preço no catálogo pra tela conversar com o cliente;
  // venda travada até o dono destravar.
  it("as cinco faixas Enterprise têm preço, mas nenhuma é vendável ainda (§2)", () => {
    const faixas = [
      ["commander_enterprise_5", 5, 19990],
      ["commander_enterprise_10", 10, 29990],
      ["commander_enterprise_20", 20, 54990],
      ["commander_enterprise_30", 30, 79990],
      ["commander_enterprise_40", 40, 99990],
    ] as const
    for (const [id, unidades, centavos] of faixas) {
      expect(PLANOS[id].valorCentavos, id).toBe(centavos)
      expect(PLANOS[id].limiteEmbarcacoes, id).toBe(unidades)
      expect(PLANOS[id].disponibilidade, id).toBe("em_breve")
      expect(ehCobravel(id), id).toBe(false)
      expect(PLANOS_COBRAVEIS, id).not.toContain(id)
      expect(ehPlanoEnterprise(id), id).toBe(true)
    }
  })

  it("viewers incluídos saem da capacidade, e só o Enterprise tem (§2)", () => {
    expect(viewersIncluidos("commander_enterprise_5")).toBe(50)
    expect(viewersIncluidos("commander_enterprise_40")).toBe(400)
    expect(viewersIncluidos("commander_pro")).toBeNull()
  })

  it("o upgrade nunca leva ninguém pro Enterprise sozinho", () => {
    // §2 manda exibir Enterprise como reservado, não vender. `proximoUpgrade`
    // é o que a tela usa pra oferecer o próximo degrau.
    expect(proximoUpgrade("commander_pro")).toBeNull()
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
    // Os vendáveis primeiro, em ordem de preço; as cinco faixas Enterprise
    // ("em breve") depois, também em ordem de preço. A regra que este teste
    // guarda não é a lista literal — é que nenhum "em breve" se infiltre no
    // meio dos vendáveis, porque a tela de planos lista nesta ordem.
    expect(proprietario.slice(0, 3)).toEqual(["proprietario_free", "commander", "commander_pro"])
    expect(proprietario.slice(3)).toEqual([
      "commander_enterprise_5", "commander_enterprise_10", "commander_enterprise_20",
      "commander_enterprise_30", "commander_enterprise_40",
    ])
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

  /* AUDITORIA 19/08, A20 — saíram daqui os casos de `escolherPromocao`,
     `economiaDaPromocao` e `validadeDaPromocao`, junto com as três funções.
     Elas descreviam o momento de CONCEDER uma promoção, e o app não concede:
     `assinatura_promocoes` tem RLS ligada e uma única policy, de SELECT — não
     há INSERT possível para nenhum código autenticado. Teste verde numa
     função inalcançável é a pior das provas: ele afirma que a regra está
     valendo em algum lugar. Ver o comentário em `planos.ts` para a regra e
     para o que precisa existir antes de elas voltarem. */

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

  it("arredonda o desconto pra baixo — nunca cobra mais que o anunciado", () => {
    // A20: agora este número vira COBRANÇA de verdade em
    // `lib/acoes/gold.ts`, e não mais só um `expect`. 199,9 centavos de
    // desconto viram 199, não 200.
    const promo = { promocao: "migracao_concorrente" as const, validoAte: "2026-11-15" }
    expect(precoGoldComDesconto(999, promo, HOJE)).toBe(799)
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
