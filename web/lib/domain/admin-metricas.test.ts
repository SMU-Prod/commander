import { describe, expect, it } from "vitest"
import {
  churnMensal,
  daLeitura,
  formatarPercentual,
  grupoVazio,
  montarDashboard,
  percentual,
  type FontesDashboard,
  type Leitura,
} from "./admin-metricas"

const semFonte = <T,>(detalhe?: string): Leitura<T> => ({ ok: false, motivo: "sem_fonte", detalhe })
const comErro = <T,>(): Leitura<T> => ({ ok: false, motivo: "erro" })

const TUDO_AUSENTE: FontesDashboard = {
  pessoas: semFonte(),
  assinaturas: semFonte(),
  gold: semFonte(),
  parceiros: semFonte(),
  comercial: semFonte(),
  planos: semFonte(),
  publicidade: semFonte(),
}

const FONTES_CHEIAS: FontesDashboard = {
  pessoas: { ok: true, dados: { usuarios: 2, usuarios_30d: 2, embarcacoes: 2, embarcacoes_ativas_90d: 1 } },
  assinaturas: {
    ok: true,
    dados: { total: 10, ativas: 8, pendentes: 1, problema_pagamento: 1, canceladas: 2, novas_30d: 3, canceladas_30d: 2, mrr_centavos: 49900 },
  },
  gold: { ok: true, dados: { solicitados: 4, pagos: 3, agendados: 2, selos_ativos: 1, selos_expirados: 0 } },
  parceiros: { ok: true, dados: { total: 5, visiveis: 4, cortesia: 3 } },
  comercial: {
    ok: true,
    dados: {
      demandasPublicadas: 12,
      propostasEnviadas: 20,
      negociosConfirmados: 4,
      volumeInformadoCentavos: 400000,
      ticketMedioCentavos: 200000,
      negociosComValor: 2,
    },
  },
  planos: { ok: true, dados: { porStatus: [{ rotulo: "Commander ativo", total: 6 }] } },
  publicidade: { ok: true, dados: { ativos: 2, impressoes: 500, cliques: 30 } },
}

describe("zero e 'não existe' são coisas diferentes", () => {
  it("fonte inexistente nunca vira 0 — vira ausência com explicação", () => {
    const grupos = montarDashboard(TUDO_AUSENTE)
    const todas = grupos.flatMap((g) => g.metricas)
    expect(todas.length).toBeGreaterThan(0)
    for (const m of todas) {
      expect(m.valor).toBeNull()
      expect(m.estado).toBe("sem_fonte")
      expect(m.detalhe).toBeTruthy()
    }
    expect(todas.some((m) => m.valor === "0")).toBe(false)
  })

  /**
   * Onda 52: a publicidade do §20 ganhou tabela (migration 053), então a
   * fonte deixou de ser ausente. O que este teste protege MUDOU de assunto,
   * e a mudança é a notícia: antes o requisito era "não diga 0, a fonte nem
   * existe"; agora é "0 é uma medição legítima — o produto existe e ninguém
   * viu anúncio ainda — mas falha de leitura continua não virando 0".
   */
  it("publicidade agora tem fonte: zero medido aparece como 0", () => {
    const grupos = montarDashboard({
      ...TUDO_AUSENTE,
      publicidade: { ok: true, dados: { ativos: 0, impressoes: 0, cliques: 0 } },
    })
    const publicidade = grupos.find((g) => g.titulo === "Publicidade")!
    expect(grupoVazio(publicidade)).toBe(false)
    expect(publicidade.metricas.map((m) => m.valor)).toEqual(["0", "0", "0"])
  })

  it("publicidade que falha na leitura não vira 0", () => {
    const grupos = montarDashboard({ ...TUDO_AUSENTE, publicidade: comErro() })
    const publicidade = grupos.find((g) => g.titulo === "Publicidade")!
    expect(grupoVazio(publicidade)).toBe(true)
    for (const m of publicidade.metricas) {
      expect(m.valor).toBeNull()
      expect(m.estado).toBe("erro")
    }
  })

  it("planos por status admite que os sete planos ainda não estão modelados", () => {
    const planos = montarDashboard(TUDO_AUSENTE).find((g) => g.titulo === "Planos por status")!
    expect(planos.metricas[0].valor).toBeNull()
    expect(planos.metricas[0].detalhe).toContain("ainda não estão modelados")
  })

  it("distingue 'fonte não existe' de 'fonte quebrou'", () => {
    const grupos = montarDashboard({ ...TUDO_AUSENTE, assinaturas: comErro() })
    const receita = grupos.find((g) => g.titulo === "Receita e assinantes")!
    expect(receita.metricas.every((m) => m.estado === "erro")).toBe(true)
    expect(receita.metricas[0].detalhe).toContain("Não foi possível ler")
  })
})

describe("com fonte, os números aparecem", () => {
  it("formata MRR em reais e conta assinantes", () => {
    const receita = montarDashboard(FONTES_CHEIAS).find((g) => g.titulo === "Receita e assinantes")!
    expect(receita.metricas[0].valor).toBe(formatarReaisEsperado(49900))
    expect(receita.metricas[1].valor).toBe("8")
    expect(grupoVazio(receita)).toBe(false)
  })

  it("cancelamentos vêm com o churn calculado ao lado", () => {
    const receita = montarDashboard(FONTES_CHEIAS).find((g) => g.titulo === "Receita e assinantes")!
    const cancelamentos = receita.metricas.find((m) => m.rotulo === "Cancelamentos (30 dias)")!
    expect(cancelamentos.valor).toBe("2")
    expect(cancelamentos.apoio).toBe("churn 20%")
  })

  it("planos por status vira uma métrica por status quando a fonte existir", () => {
    const planos = montarDashboard(FONTES_CHEIAS).find((g) => g.titulo === "Planos por status")!
    expect(planos.metricas).toHaveLength(1)
    expect(planos.metricas[0].rotulo).toBe("Commander ativo")
    expect(planos.metricas[0].valor).toBe("6")
  })
})

describe("ticket médio sem amostra", () => {
  it("some quando nenhum negócio informou valor — não vira R$ 0,00", () => {
    const grupos = montarDashboard({
      ...FONTES_CHEIAS,
      comercial: {
        ok: true,
        dados: {
          demandasPublicadas: 3,
          propostasEnviadas: 5,
          negociosConfirmados: 2,
          volumeInformadoCentavos: 0,
          ticketMedioCentavos: null,
          negociosComValor: 0,
        },
      },
    })
    const ticket = grupos.find((g) => g.titulo === "Marketplace")!.metricas.find((m) => m.rotulo === "Ticket médio")!
    expect(ticket.valor).toBeNull()
    expect(ticket.estado).toBe("sem_fonte")
    expect(ticket.detalhe).toContain("valor informado")
  })
})

describe("percentual", () => {
  it("sem denominador não há percentual — null, não 0%", () => {
    expect(percentual(0, 0)).toBeNull()
    expect(churnMensal(0, 0)).toBeNull()
    expect(formatarPercentual(null)).toBeNull()
  })

  it("arredonda com uma casa e vírgula decimal brasileira", () => {
    expect(percentual(1, 3)).toBe(33.3)
    expect(formatarPercentual(33.3)).toBe("33,3%")
    expect(formatarPercentual(20)).toBe("20%")
  })

  it("churn conta a base que existia: ativas de hoje + as que saíram", () => {
    expect(churnMensal(9, 1)).toBe(10)
    expect(churnMensal(8, 2)).toBe(20)
  })
})

describe("daLeitura", () => {
  it("usa o detalhe da própria leitura quando ela traz um, e o padrão quando não", () => {
    const especifico = daLeitura("X", { ok: false, motivo: "sem_fonte", detalhe: "motivo específico" }, () => ({ valor: "1" }), "padrão")
    expect(especifico.detalhe).toBe("motivo específico")
    const padrao = daLeitura("X", { ok: false, motivo: "sem_fonte" }, () => ({ valor: "1" }), "padrão")
    expect(padrao.detalhe).toBe("padrão")
  })
})

function formatarReaisEsperado(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}
