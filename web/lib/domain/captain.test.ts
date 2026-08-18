import { describe, expect, it } from "vitest"
import {
  carreiraLiberada,
  mensagemCarreiraBloqueada,
  microKpisDoPerfil,
  motivoForaDaVitrine,
  O_QUE_O_CAPTAIN_FREE_FAZ,
  O_QUE_O_CAPTAIN_PRO_LIBERA,
  perfilNaVitrine,
  planoDeCarreira,
  PLANO_QUE_ATIVA_PERFIL,
  RECURSOS_CARREIRA,
  trilhaDaConta,
} from "./captain"
import { comoNivel, nivelPlano, recursoLiberado } from "./plano-acesso"
import { PLANOS, type PlanoId } from "./planos"

const HOJE = "2026-08-15"

describe("§12 — a fronteira entre embarcação e carreira", () => {
  it("Captain Pro NAO vira degrau de embarcacao ('nunca concede acesso adicional por si so')", () => {
    expect(comoNivel("captain_pro")).toBeNull()
    expect(nivelPlano({ planoAssinatura: "captain_pro", concessao: null }, HOJE)).toBe("proprietario_free")
  })

  it("assinar Captain Pro nao libera NENHUM recurso de gestao da embarcacao", () => {
    // O degrau da embarcação de quem só paga Captain Pro continua sendo Free —
    // então tudo o que o §2.3 tranca no Free segue trancado.
    const nivel = nivelPlano({ planoAssinatura: "captain_pro", concessao: null }, HOJE)
    for (const recurso of [
      "marketplace_publicar",
      "agenda_criar",
      "financeiro_lancar",
      "tripulacao_adicionar",
      "compartilhar_saida",
    ] as const) {
      expect(recursoLiberado(recurso, nivel)).toBe(false)
    }
  })

  it("Commander/Commander Pro do barco NAO paga a carreira do comandante", () => {
    // O contrário da regra acima, e igualmente importante: quem paga a gestão
    // do próprio barco não ganha a camada profissional de graça.
    expect(carreiraLiberada("disponibilidade", "commander")).toBe(false)
    expect(carreiraLiberada("disponibilidade", "commander_pro")).toBe(false)
    expect(carreiraLiberada("perfil_ativo", "proprietario_free")).toBe(false)
  })
})

describe("§12/§13.1 — qual plano ativa qual perfil", () => {
  it("comandante depende de Captain Pro e prestador de Partner Prestador", () => {
    expect(PLANO_QUE_ATIVA_PERFIL.comandante).toBe("captain_pro")
    expect(PLANO_QUE_ATIVA_PERFIL.prestador).toBe("partner_prestador")
  })

  it("os dois planos valem R$ 24,90 no catalogo (§2 e §13.1)", () => {
    expect(PLANOS.captain_pro.valorCentavos).toBe(2490)
    expect(PLANOS.partner_prestador.valorCentavos).toBe(2490)
  })

  it("um plano nao libera a vitrine do outro tipo", () => {
    expect(carreiraLiberada("perfil_ativo", "captain_pro", "comandante")).toBe(true)
    expect(carreiraLiberada("perfil_ativo", "captain_pro", "prestador")).toBe(false)
    expect(carreiraLiberada("perfil_ativo", "partner_prestador", "prestador")).toBe(true)
    expect(carreiraLiberada("perfil_ativo", "partner_prestador", "comandante")).toBe(false)
  })

  it("todo recurso da camada profissional segue o mesmo plano (§12 lista um pacote)", () => {
    for (const r of RECURSOS_CARREIRA) {
      expect(carreiraLiberada(r, "captain_pro")).toBe(true)
      expect(carreiraLiberada(r, "captain_free")).toBe(false)
    }
  })
})

describe("perfilNaVitrine — espelho da RLS da migration 051", () => {
  it("precisa das DUAS coisas: vontade (visivel) e condicao (plano)", () => {
    expect(perfilNaVitrine({ tipo: "comandante", visivel: true, plano: "captain_pro" })).toBe(true)
    expect(perfilNaVitrine({ tipo: "comandante", visivel: false, plano: "captain_pro" })).toBe(false)
    expect(perfilNaVitrine({ tipo: "comandante", visivel: true, plano: "captain_free" })).toBe(false)
  })

  it("diz QUAL das duas esta faltando", () => {
    const semPlano = motivoForaDaVitrine({ tipo: "comandante", visivel: true, plano: "captain_free" })
    expect(semPlano?.titulo).toContain("Captain Pro")
    // A frase precisa tranquilizar sobre o barco: é o medo real de quem lê.
    expect(semPlano?.descricao).toContain("embarcações que você já opera")

    const oculto = motivoForaDaVitrine({ tipo: "comandante", visivel: false, plano: "captain_pro" })
    expect(oculto?.titulo).toContain("oculto")

    expect(motivoForaDaVitrine({ tipo: "comandante", visivel: true, plano: "captain_pro" })).toBeNull()
  })

  it("o motivo do prestador cita o plano dele, nao o do comandante", () => {
    const m = motivoForaDaVitrine({ tipo: "prestador", visivel: true, plano: "proprietario_free" })
    expect(m?.titulo).toContain(PLANOS.partner_prestador.rotulo)
  })
})

describe("mensagemCarreiraBloqueada", () => {
  it("todo recurso tem titulo e descricao, e nenhum promete acesso a embarcacao", () => {
    for (const r of RECURSOS_CARREIRA) {
      const m = mensagemCarreiraBloqueada(r)
      expect(m.titulo.length).toBeGreaterThan(10)
      expect(m.descricao.length).toBeGreaterThan(30)
      expect(m.titulo).toContain(PLANOS.captain_pro.rotulo)
    }
  })
})

describe("trilhaDaConta (§3)", () => {
  const base = {
    plano: "proprietario_free" as PlanoId,
    ehProprietario: false,
    ehTripulacao: false,
    tipoPerfilProfissional: null,
  }

  it("assinatura de carreira manda em tudo", () => {
    expect(trilhaDaConta({ ...base, plano: "captain_pro", ehProprietario: true })).toBe("captain")
    expect(trilhaDaConta({ ...base, plano: "partner_prestador", ehProprietario: true })).toBe("partner")
  })

  it("sem assinatura de carreira, dono de barco e proprietario", () => {
    expect(trilhaDaConta({ ...base, plano: "commander", ehProprietario: true })).toBe("proprietario")
    expect(trilhaDaConta({ ...base, ehProprietario: true, ehTripulacao: true })).toBe("proprietario")
  })

  it("convidado a operar barco de outro e Captain, mesmo sem assinar nada (§12)", () => {
    expect(trilhaDaConta({ ...base, ehTripulacao: true })).toBe("captain")
    expect(trilhaDaConta({ ...base, tipoPerfilProfissional: "comandante" })).toBe("captain")
  })

  it("perfil de prestador sem barco e sem plano cai na trilha Partner", () => {
    expect(trilhaDaConta({ ...base, tipoPerfilProfissional: "prestador" })).toBe("partner")
  })

  it("conta nova, sem nada, comeca na trilha do proprietario (onboarding)", () => {
    expect(trilhaDaConta(base)).toBe("proprietario")
  })
})

describe("planoDeCarreira", () => {
  it("comandante sem assinatura e Captain FREE, nao 'Proprietario Free' (§12)", () => {
    expect(planoDeCarreira("proprietario_free", "captain")).toBe("captain_free")
    expect(PLANOS[planoDeCarreira("proprietario_free", "captain")].rotulo).toBe("Captain Free")
  })

  it("quem paga Captain Pro continua Captain Pro", () => {
    expect(planoDeCarreira("captain_pro", "captain")).toBe("captain_pro")
  })

  it("nao mexe no plano de quem nao esta na trilha Captain", () => {
    expect(planoDeCarreira("commander", "proprietario")).toBe("commander")
    expect(planoDeCarreira("partner_prestador", "partner")).toBe("partner_prestador")
  })
})

describe("as duas listas de copia", () => {
  it("o Pro entrega os 7 itens do §12 e o Free nao promete nenhum deles", () => {
    expect(O_QUE_O_CAPTAIN_PRO_LIBERA).toHaveLength(7)
    for (const linha of O_QUE_O_CAPTAIN_FREE_FAZ) {
      expect(O_QUE_O_CAPTAIN_PRO_LIBERA).not.toContain(linha)
    }
  })

  it("a lista do Free comeca pela frase que o §12 protege: operar o barco", () => {
    expect(O_QUE_O_CAPTAIN_FREE_FAZ[0]).toContain("permissões que o proprietário deu")
  })
})

// ---------------------------------------------------------------------------
// Onda 62 (canvas tela-3l) — micro-KPIs do cartão de pessoa
// ---------------------------------------------------------------------------
describe("microKpisDoPerfil — só número declarado vira chip", () => {
  it("experiência e porte declarados viram os dois chips, nesta ordem", () => {
    expect(microKpisDoPerfil({ experiencia_anos: 12, porte_max_pes: 60 })).toEqual([
      { rotulo: "Experiência", valor: "12 anos" },
      { rotulo: "Porte", valor: "até 60 pés" },
    ])
  })

  it("singular de 1 ano — chip não fala errado", () => {
    expect(microKpisDoPerfil({ experiencia_anos: 1, porte_max_pes: null })).toEqual([
      { rotulo: "Experiência", valor: "1 ano" },
    ])
  })

  it("nada declarado, nada de chip — ausência em vez de zero inventado", () => {
    expect(microKpisDoPerfil({ experiencia_anos: null, porte_max_pes: null })).toEqual([])
  })
})
