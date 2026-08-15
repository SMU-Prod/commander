import { describe, expect, it } from "vitest"
import {
  avaliarCiclo,
  dividirEmbarcacoesPorPlano,
  mensagemDowngrade,
  planoAposPerder,
  ROTULO_SITUACAO,
  TOLERANCIA_PADRAO_DIAS,
  type SinalCiclo,
} from "./assinatura-ciclo"

const HOJE = "2026-08-15"
const base: Omit<SinalCiclo, "status" | "problemaDesde"> = { toleranciaDias: 7, hoje: HOJE }

describe("§23 — pagamento aprovado libera na hora", () => {
  it("ativa: acesso liberado e nenhum aviso", () => {
    const r = avaliarCiclo({ ...base, status: "ativa", problemaDesde: null })
    expect(r.situacao).toBe("ativa")
    expect(r.acessoPago).toBe(true)
    expect(r.aviso).toBeNull()
  })

  it("pendente: ainda nao pagou, entao nao libera — mas explica", () => {
    const r = avaliarCiclo({ ...base, status: "pendente", problemaDesde: null })
    expect(r.situacao).toBe("aguardando_pagamento")
    expect(r.acessoPago).toBe(false)
    expect(r.aviso).toBeTruthy()
  })
})

describe("§23 — recusa, tolerancia e bloqueio", () => {
  it("recusado hoje: entra em tolerancia com o prazo inteiro", () => {
    const r = avaliarCiclo({ ...base, status: "problema_pagamento", problemaDesde: HOJE })
    expect(r.situacao).toBe("em_tolerancia")
    expect(r.diasRestantes).toBe(7)
    expect(r.acessoPago).toBe(true)
  })

  it("durante a tolerancia o acesso CONTINUA e o aviso diz quantos dias faltam", () => {
    const r = avaliarCiclo({ ...base, status: "problema_pagamento", problemaDesde: "2026-08-12" })
    expect(r.situacao).toBe("em_tolerancia")
    expect(r.diasRestantes).toBe(4)
    expect(r.acessoPago).toBe(true)
    expect(r.aviso).toContain("4 dias")
  })

  it("ultimo dia da tolerancia fala no singular e ainda libera", () => {
    const r = avaliarCiclo({ ...base, status: "problema_pagamento", problemaDesde: "2026-08-08" })
    expect(r.diasRestantes).toBe(0)
    expect(r.acessoPago).toBe(true)
    expect(r.aviso).toMatch(/último dia/i)
  })

  it("passou da tolerancia: bloqueia os recursos pagos — e diz que nada foi apagado", () => {
    const r = avaliarCiclo({ ...base, status: "problema_pagamento", problemaDesde: "2026-08-01" })
    expect(r.situacao).toBe("bloqueada")
    expect(r.acessoPago).toBe(false)
    expect(r.aviso).toMatch(/nada foi apagado/i)
  })

  it("a tolerancia e CONFIGURAVEL: mudar o parametro muda o dia do bloqueio", () => {
    const sinal = { status: "problema_pagamento" as const, problemaDesde: "2026-08-05", hoje: HOJE }
    expect(avaliarCiclo({ ...sinal, toleranciaDias: 3 }).situacao).toBe("bloqueada")
    expect(avaliarCiclo({ ...sinal, toleranciaDias: 30 }).situacao).toBe("em_tolerancia")
  })

  it("tolerancia zero bloqueia no dia seguinte, nunca no mesmo dia", () => {
    expect(
      avaliarCiclo({ status: "problema_pagamento", problemaDesde: HOJE, toleranciaDias: 0, hoje: HOJE }).situacao,
    ).toBe("em_tolerancia")
    expect(
      avaliarCiclo({ status: "problema_pagamento", problemaDesde: "2026-08-14", toleranciaDias: 0, hoje: HOJE })
        .situacao,
    ).toBe("bloqueada")
  })

  it("problema sem data conta como o primeiro dia — o erro e sempre a favor de quem paga", () => {
    const r = avaliarCiclo({ ...base, status: "problema_pagamento", problemaDesde: null })
    expect(r.situacao).toBe("em_tolerancia")
    expect(r.acessoPago).toBe(true)
  })

  it("data de problema no futuro (relogio torto) nao vira tolerancia negativa", () => {
    const r = avaliarCiclo({ ...base, status: "problema_pagamento", problemaDesde: "2026-09-01" })
    expect(r.situacao).toBe("em_tolerancia")
    expect(r.diasRestantes).toBe(7)
  })

  it("o padrao de tolerancia existe so como fallback e e um numero de dias razoavel", () => {
    expect(TOLERANCIA_PADRAO_DIAS).toBeGreaterThan(0)
    expect(TOLERANCIA_PADRAO_DIAS).toBeLessThanOrEqual(30)
  })
})

describe("§23 — cancelamento preserva dados", () => {
  it("cancelada bloqueia o pago mas promete os dados de volta", () => {
    const r = avaliarCiclo({ ...base, status: "cancelada", problemaDesde: null })
    expect(r.situacao).toBe("cancelada")
    expect(r.acessoPago).toBe(false)
    expect(r.aviso).toMatch(/continua guardado/i)
  })

  it("perder o plano cai no Free do mesmo perfil", () => {
    expect(planoAposPerder("commander_pro")).toBe("proprietario_free")
    expect(planoAposPerder("captain_pro")).toBe("captain_free")
  })

  it("toda situacao tem rotulo de cliente, nunca codigo cru", () => {
    for (const rotulo of Object.values(ROTULO_SITUACAO)) {
      expect(rotulo).not.toMatch(/_/)
      expect(rotulo.length).toBeGreaterThan(0)
    }
  })
})

describe("§23 — downgrade Pro -> Commander nao apaga embarcacao", () => {
  const quatro = ["a", "b", "c", "d"]

  it("dentro do limite ninguem e bloqueado", () => {
    const r = dividirEmbarcacoesPorPlano(quatro, "b", 4)
    expect(r.bloqueadas).toEqual([])
    expect(r.liberadas).toEqual(quatro)
    expect(r.precisaEscolher).toBe(false)
  })

  it("caindo pro Commander (1), a ativa escolhida fica e as outras sao BLOQUEADAS, nao apagadas", () => {
    const r = dividirEmbarcacoesPorPlano(quatro, "c", 1)
    expect(r.liberadas).toEqual(["c"])
    expect(r.bloqueadas.sort()).toEqual(["a", "b", "d"])
    expect(r.precisaEscolher).toBe(false)
    // a soma continua sendo TODAS as embarcacoes: nada some da conta
    expect([...r.liberadas, ...r.bloqueadas].sort()).toEqual(quatro)
  })

  it("sem embarcacao ativa escolhida, o app precisa pedir a escolha (§23)", () => {
    const r = dividirEmbarcacoesPorPlano(quatro, null, 1)
    expect(r.precisaEscolher).toBe(true)
    // mesmo assim ja sai uma divisao deterministica — nenhuma tela fica sem resposta
    expect(r.liberadas).toEqual(["a"])
  })

  it("ativa apontando pra barco que nao e mais dele: trata como se nao houvesse escolha", () => {
    const r = dividirEmbarcacoesPorPlano(quatro, "z", 1)
    expect(r.precisaEscolher).toBe(true)
    expect(r.liberadas).toEqual(["a"])
  })

  it("um barco so nunca bloqueia nada, mesmo no Free", () => {
    const r = dividirEmbarcacoesPorPlano(["a"], null, 1)
    expect(r.bloqueadas).toEqual([])
    expect(r.precisaEscolher).toBe(false)
  })

  it("a mensagem diz quantos ficaram pausados e que nada foi apagado", () => {
    const r = dividirEmbarcacoesPorPlano(quatro, "c", 1)
    const msg = mensagemDowngrade(r, 1)
    expect(msg).toMatch(/3 embarcações estão/)
    expect(msg).toMatch(/Nada foi apagado/i)
  })

  it("sem bloqueio nao ha mensagem — nada de aviso inutil", () => {
    expect(mensagemDowngrade(dividirEmbarcacoesPorPlano(quatro, "a", 4), 4)).toBeNull()
  })

  it("quando falta escolher, a mensagem pede a escolha", () => {
    const msg = mensagemDowngrade(dividirEmbarcacoesPorPlano(quatro, null, 1), 1)
    expect(msg).toMatch(/Escolha qual embarcação/i)
  })
})
