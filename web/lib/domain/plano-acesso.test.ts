import { describe, expect, it } from "vitest"
import {
  amostraExplorarFree,
  avisoAcervoAcimaDoTeto,
  BENEFICIOS_PAGOS,
  comoNivel,
  ehPago,
  LIMITES_FREE,
  limiteAcessosTripulacao,
  limiteEmbarcacoes,
  mensagemBloqueio,
  nivelPlano,
  O_QUE_O_FREE_FAZ,
  recursoLiberado,
  vagasTripulacao,
  type NivelPlano,
  type RecursoControlado,
} from "./plano-acesso"

const HOJE = "2026-08-15"
const TODOS_OS_RECURSOS: RecursoControlado[] = [
  "diario_registros",
  "fotos",
  "compartilhar_saida",
  "marketplace_publicar",
  "agenda_criar",
  "financeiro_lancar",
  "financeiro_consolidado",
  "tripulacao_adicionar",
  "explorar_perfil_completo",
]

/** A única exceção da regra "pago libera tudo" (onda 53, §9.3): a visão
 *  consolidada do Financeiro é do Commander PRO. Fica nomeada aqui pra que os
 *  testes gerais possam excluí-la de propósito, e não por descuido. */
const SO_DO_PRO: RecursoControlado[] = ["financeiro_consolidado"]

describe("nivelPlano", () => {
  it("sem assinatura e sem concessao e o Free do proprietario", () => {
    expect(nivelPlano({ planoAssinatura: null, concessao: null }, HOJE)).toBe("proprietario_free")
  })
  it("assinatura Commander poe no degrau Commander", () => {
    expect(nivelPlano({ planoAssinatura: "commander", concessao: null }, HOJE)).toBe("commander")
  })
  it("assinatura Pro poe no degrau Pro", () => {
    expect(nivelPlano({ planoAssinatura: "commander_pro", concessao: null }, HOJE)).toBe("commander_pro")
  })
  it("concessao vigente (Gold, §2.2) vale igual a assinatura paga", () => {
    expect(
      nivelPlano({ planoAssinatura: null, concessao: { plano: "commander", validoAte: "2027-02-15" } }, HOJE),
    ).toBe("commander")
  })
  it("concessao que vence HOJE ainda vale (>=)", () => {
    expect(nivelPlano({ planoAssinatura: null, concessao: { plano: "commander", validoAte: HOJE } }, HOJE)).toBe(
      "commander",
    )
  })
  it("concessao expirada volta pro Free", () => {
    expect(
      nivelPlano({ planoAssinatura: null, concessao: { plano: "commander", validoAte: "2026-01-01" } }, HOJE),
    ).toBe("proprietario_free")
  })
  it("assinatura e concessao juntas: vale a maior, o cliente nunca sai perdendo", () => {
    expect(
      nivelPlano(
        { planoAssinatura: "commander", concessao: { plano: "commander_pro", validoAte: "2027-01-01" } },
        HOJE,
      ),
    ).toBe("commander_pro")
  })
  it("Captain Pro NAO libera gestao de embarcacao (§12)", () => {
    expect(comoNivel("captain_pro")).toBeNull()
    expect(nivelPlano({ planoAssinatura: "captain_pro", concessao: null }, HOJE)).toBe("proprietario_free")
  })
  it("plano de Partner tambem nao vira degrau de proprietario", () => {
    expect(comoNivel("partner_prestador")).toBeNull()
    expect(comoNivel("partner_marina")).toBeNull()
  })
  it("ehPago separa Free dos dois pagos", () => {
    expect(ehPago("proprietario_free")).toBe(false)
    expect(ehPago("commander")).toBe(true)
    expect(ehPago("commander_pro")).toBe(true)
  })
})

describe("recursoLiberado", () => {
  it("Commander e Pro liberam tudo (fora o que e so do Pro), sem contagem", () => {
    for (const nivel of ["commander", "commander_pro"] as NivelPlano[]) {
      for (const recurso of TODOS_OS_RECURSOS.filter((r) => !SO_DO_PRO.includes(r))) {
        expect(recursoLiberado(recurso, nivel, 999)).toBe(true)
      }
    }
  })

  it("§9.3: a visao consolidada e do Commander PRO — nem o Commander comum tem", () => {
    expect(recursoLiberado("financeiro_consolidado", "commander_pro")).toBe(true)
    expect(recursoLiberado("financeiro_consolidado", "commander")).toBe(false)
    expect(recursoLiberado("financeiro_consolidado", "proprietario_free")).toBe(false)
    // Nao e contagem: usoAtual nao muda nada nem pra cima nem pra baixo.
    expect(recursoLiberado("financeiro_consolidado", "commander", 0)).toBe(false)
    expect(recursoLiberado("financeiro_consolidado", "commander_pro", 999)).toBe(true)
  })

  it("§2.3: no Free, publicar, criar na Agenda/Financeiro, tripulacao e perfil do Explorar sao bloqueados", () => {
    for (const recurso of [
      "marketplace_publicar",
      "agenda_criar",
      "financeiro_lancar",
      "tripulacao_adicionar",
      "explorar_perfil_completo",
      "compartilhar_saida",
    ] as RecursoControlado[]) {
      expect(recursoLiberado(recurso, "proprietario_free", 0)).toBe(false)
    }
  })

  it("§28: o Free cria exatamente 2 Diarios — nem 1 nem 20", () => {
    expect(LIMITES_FREE.diarioRegistros).toBe(2)
    expect(recursoLiberado("diario_registros", "proprietario_free", 0)).toBe(true)
    expect(recursoLiberado("diario_registros", "proprietario_free", 1)).toBe(true)
    expect(recursoLiberado("diario_registros", "proprietario_free", 2)).toBe(false)
  })

  it("fotos no Free respeitam o teto exato", () => {
    expect(recursoLiberado("fotos", "proprietario_free", LIMITES_FREE.fotos - 1)).toBe(true)
    expect(recursoLiberado("fotos", "proprietario_free", LIMITES_FREE.fotos)).toBe(false)
  })

  it("usoAtual omitido conta como 0", () => {
    expect(recursoLiberado("diario_registros", "proprietario_free")).toBe(true)
    expect(recursoLiberado("fotos", "proprietario_free")).toBe(true)
  })
})

describe("§23 — o que ja existe e preservado, nunca apagado", () => {
  it("quem ja tem 9 Diarios no Free continua com 9: o limite so barra CRIAR o proximo", () => {
    const jaTem = 9
    // o portao diz "nao pode criar mais"...
    expect(recursoLiberado("diario_registros", "proprietario_free", jaTem)).toBe(false)
    // ...e o aviso explica que nada some.
    const aviso = avisoAcervoAcimaDoTeto("diario_registros", "proprietario_free", jaTem)
    expect(aviso).toContain("9")
    expect(aviso).toMatch(/continua disponível/i)
    // e a mensagem do cadeado tambem diz isso, pra pessoa nao surtar
    expect(mensagemBloqueio("diario_registros", jaTem).descricao).toMatch(/nada é apagado/i)
  })

  it("sem passar do teto nao existe aviso — nada de alarme falso", () => {
    expect(avisoAcervoAcimaDoTeto("diario_registros", "proprietario_free", 2)).toBeNull()
    expect(avisoAcervoAcimaDoTeto("fotos", "proprietario_free", LIMITES_FREE.fotos)).toBeNull()
  })

  it("quem paga nunca ve aviso de teto", () => {
    expect(avisoAcervoAcimaDoTeto("diario_registros", "commander", 500)).toBeNull()
    expect(avisoAcervoAcimaDoTeto("fotos", "commander_pro", 500)).toBeNull()
  })

  it("acima do teto de fotos o aviso fala de fotos, nao de Diario", () => {
    const aviso = avisoAcervoAcimaDoTeto("fotos", "proprietario_free", LIMITES_FREE.fotos + 3)
    expect(aviso).toContain("fotos")
    expect(aviso).not.toContain("Diários")
  })
})

describe("mensagemBloqueio", () => {
  it("todo recurso tem titulo e descricao nao vazios", () => {
    for (const recurso of TODOS_OS_RECURSOS) {
      const msg = mensagemBloqueio(recurso)
      expect(msg.titulo.length).toBeGreaterThan(0)
      expect(msg.descricao.length).toBeGreaterThan(0)
    }
  })
  it("com usoAtual, a descricao menciona quanto ja foi usado", () => {
    expect(mensagemBloqueio("diario_registros", 7).descricao).toContain("7")
    expect(mensagemBloqueio("fotos", 8).descricao).toContain("8")
  })
  it("recurso tudo-ou-nada ignora usoAtual e nao fala em numero de registro", () => {
    expect(mensagemBloqueio("compartilhar_saida", 3).descricao).not.toMatch(/\d/)
  })
  it("§2.3: o bloqueio de publicar avisa que o que foi preenchido nao se perde", () => {
    expect(mensagemBloqueio("marketplace_publicar").descricao).toMatch(/não se perde/i)
  })
})

describe("capacidade por plano (§2, §19, §28)", () => {
  it("embarcacoes: 1 no Free e no Commander, 4 no Pro", () => {
    expect(limiteEmbarcacoes("proprietario_free")).toBe(1)
    expect(limiteEmbarcacoes("commander")).toBe(1)
    expect(limiteEmbarcacoes("commander_pro")).toBe(4)
  })

  it("acessos de tripulacao: 0 no Free, 2 nos dois pagos", () => {
    expect(limiteAcessosTripulacao("proprietario_free")).toBe(0)
    expect(limiteAcessosTripulacao("commander")).toBe(2)
    expect(limiteAcessosTripulacao("commander_pro")).toBe(2)
  })

  it("§19: convite pendente OCUPA vaga", () => {
    // 1 comandante + 1 convite pendente = as 2 vagas do Commander
    const cheio = vagasTripulacao("commander", 1, 1)
    expect(cheio.ocupadas).toBe(2)
    expect(cheio.restantes).toBe(0)
    expect(cheio.cabeMais).toBe(false)
  })

  it("com uma vaga livre ainda cabe mais um", () => {
    const meio = vagasTripulacao("commander", 1, 0)
    expect(meio.restantes).toBe(1)
    expect(meio.cabeMais).toBe(true)
  })

  it("Free nao tem vaga nenhuma — nem a primeira", () => {
    const free = vagasTripulacao("proprietario_free", 0, 0)
    expect(free.total).toBe(0)
    expect(free.cabeMais).toBe(false)
  })

  it("restantes nunca fica negativo mesmo com o banco fora da regua", () => {
    expect(vagasTripulacao("commander", 3, 2).restantes).toBe(0)
  })
})

describe("amostraExplorarFree (§2.3)", () => {
  const partners = Array.from({ length: 30 }, (_, i) => ({ id: `p${i}` }))

  it("mostra 'alguns' parceiros, nunca a lista inteira", () => {
    expect(amostraExplorarFree(partners, "2026-08-15:usuario").length).toBe(LIMITES_FREE.partnersNoExplorar)
  })

  it("a mesma semente devolve sempre a mesma amostra — nao pisca entre renders", () => {
    const a = amostraExplorarFree(partners, "semente-x").map((p) => p.id)
    const b = amostraExplorarFree(partners, "semente-x").map((p) => p.id)
    expect(a).toEqual(b)
  })

  it("sementes diferentes trocam a amostra (o 'aleatorio' do PRD)", () => {
    const a = amostraExplorarFree(partners, "2026-08-15").map((p) => p.id)
    const b = amostraExplorarFree(partners, "2026-08-16").map((p) => p.id)
    expect(a).not.toEqual(b)
  })

  it("com menos parceiros que o teto, devolve todos sem quebrar", () => {
    expect(amostraExplorarFree([{ id: "a" }, { id: "b" }], "s").length).toBe(2)
    expect(amostraExplorarFree([], "s")).toEqual([])
  })
})

describe("copia da tela", () => {
  it("a lista de beneficios cobre os recursos pagos e nao fica vazia", () => {
    expect(BENEFICIOS_PAGOS.length).toBeGreaterThanOrEqual(6)
    expect(O_QUE_O_FREE_FAZ.length).toBeGreaterThanOrEqual(4)
  })
  it("o que o Free faz cita os 2 Diarios, batendo com o limite real", () => {
    expect(O_QUE_O_FREE_FAZ.join(" ")).toContain(String(LIMITES_FREE.diarioRegistros))
  })
})
