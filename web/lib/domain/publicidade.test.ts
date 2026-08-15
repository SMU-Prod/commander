import { describe, expect, it } from "vitest"
import { calcularReputacao } from "./avaliacoes"
import {
  campanhaVigente,
  descreverPeriodo,
  DESCRICAO_PRODUTO,
  destaquesDoExplorar,
  formatarPrecoPublicidade,
  formatarTaxa,
  MAX_PATROCINADORES_DASHBOARD,
  ordenarComDestaque,
  periodoValido,
  permitePublicidade,
  podeTransicionar,
  PRODUTOS_PUBLICIDADE,
  produtoValido,
  ROTULO_PATROCINADO,
  ROTULO_PRODUTO,
  ROTULO_STATUS_CAMPANHA,
  segmentacaoAtende,
  selecionarPatrocinios,
  STATUS_CAMPANHA,
  statusValido,
  taxaDeClique,
  type CampanhaParaExibicao,
} from "./publicidade"

const HOJE = "2026-08-15"

function campanha(over: Partial<CampanhaParaExibicao> = {}): CampanhaParaExibicao {
  return {
    id: "c1",
    parceiro_id: "p1",
    produto: "patrocinio_dashboard",
    status: "ativa",
    inicio: "2026-08-01",
    fim: null,
    regiao_id: null,
    categoria_id: null,
    prioridade: 0,
    ...over,
  }
}

describe("produtos de publicidade (PRD §20)", () => {
  it("tem exatamente os três produtos do §20, cada um com rótulo e descrição", () => {
    expect(PRODUTOS_PUBLICIDADE).toEqual([
      "destaque_explorar",
      "destaque_superior",
      "patrocinio_dashboard",
    ])
    for (const p of PRODUTOS_PUBLICIDADE) {
      expect(ROTULO_PRODUTO[p]).toBeTruthy()
      expect(DESCRICAO_PRODUTO[p]).toBeTruthy()
    }
  })

  it("recusa produto que o PRD não lista", () => {
    expect(produtoValido("destaque_explorar")).toBe(true)
    expect(produtoValido("banner_topo")).toBe(false)
  })
})

describe("estados da campanha", () => {
  it("tem rótulo pra cada status", () => {
    for (const s of STATUS_CAMPANHA) expect(ROTULO_STATUS_CAMPANHA[s]).toBeTruthy()
    expect(statusValido("ativa")).toBe(true)
    expect(statusValido("no_ar")).toBe(false)
  })

  it("encerrada é terminal — voltar ao ar exige campanha nova", () => {
    expect(podeTransicionar("rascunho", "ativa")).toBe(true)
    expect(podeTransicionar("ativa", "pausada")).toBe(true)
    expect(podeTransicionar("pausada", "ativa")).toBe(true)
    expect(podeTransicionar("ativa", "encerrada")).toBe(true)
    expect(podeTransicionar("encerrada", "ativa")).toBe(false)
    expect(podeTransicionar("encerrada", "pausada")).toBe(false)
  })

  it("não pula de rascunho direto pra pausada", () => {
    expect(podeTransicionar("rascunho", "pausada")).toBe(false)
  })
})

describe("vigência", () => {
  it("só está no ar quem está ativa e dentro do período", () => {
    expect(campanhaVigente(campanha(), HOJE)).toBe(true)
    expect(campanhaVigente(campanha({ status: "pausada" }), HOJE)).toBe(false)
    expect(campanhaVigente(campanha({ status: "rascunho" }), HOJE)).toBe(false)
    expect(campanhaVigente(campanha({ status: "encerrada" }), HOJE)).toBe(false)
  })

  it("campanha que ainda não começou não aparece", () => {
    expect(campanhaVigente(campanha({ inicio: "2026-09-01" }), HOJE)).toBe(false)
  })

  it("campanha vencida ontem não aparece; a que vence hoje ainda aparece", () => {
    expect(campanhaVigente(campanha({ fim: "2026-08-14" }), HOJE)).toBe(false)
    expect(campanhaVigente(campanha({ fim: "2026-08-15" }), HOJE)).toBe(true)
  })

  it("sem data de fim continua no ar", () => {
    expect(campanhaVigente(campanha({ fim: null }), HOJE)).toBe(true)
  })
})

describe("segmentação (§20: região; categoria quando aplicável)", () => {
  it("campanha sem região alcança todo mundo, inclusive quem não tem região", () => {
    const c = campanha({ regiao_id: null })
    expect(segmentacaoAtende(c, { regiaoId: "angra" })).toBe(true)
    expect(segmentacaoAtende(c, { regiaoId: null })).toBe(true)
  })

  it("campanha com região só alcança aquela região", () => {
    const c = campanha({ regiao_id: "angra" })
    expect(segmentacaoAtende(c, { regiaoId: "angra" })).toBe(true)
    expect(segmentacaoAtende(c, { regiaoId: "salvador" })).toBe(false)
  })

  it("região desconhecida NÃO recebe anúncio segmentado — na dúvida, não mostra", () => {
    // O contrário faria o Partner pagar por alcance que não comprou: um
    // anúncio de Angra numa tela que pode estar em Salvador.
    expect(segmentacaoAtende(campanha({ regiao_id: "angra" }), { regiaoId: null })).toBe(false)
  })

  it("categoria segue a mesma regra da região", () => {
    const c = campanha({ categoria_id: "motores" })
    expect(segmentacaoAtende(c, { regiaoId: null, categoriaId: "motores" })).toBe(true)
    expect(segmentacaoAtende(c, { regiaoId: null, categoriaId: "velas" })).toBe(false)
    expect(segmentacaoAtende(c, { regiaoId: null })).toBe(false)
  })
})

describe("carrossel do Dashboard (§3.4)", () => {
  it("nunca devolve mais que 5 patrocinadores", () => {
    const oito = Array.from({ length: 8 }, (_, i) =>
      campanha({ id: `c${i}`, parceiro_id: `p${i}`, prioridade: i }),
    )
    const escolhidos = selecionarPatrocinios(oito, { regiaoId: null }, HOJE)
    expect(escolhidos).toHaveLength(MAX_PATROCINADORES_DASHBOARD)
    expect(MAX_PATROCINADORES_DASHBOARD).toBe(5)
  })

  it("ordena por prioridade e desempata pelo id — determinístico, não sorteado", () => {
    const cs = [
      campanha({ id: "b", prioridade: 1 }),
      campanha({ id: "a", prioridade: 1 }),
      campanha({ id: "c", prioridade: 9 }),
    ]
    expect(selecionarPatrocinios(cs, { regiaoId: null }, HOJE).map((c) => c.id)).toEqual(["c", "a", "b"])
    // Duas chamadas seguidas dão a mesma resposta: sem isso, nenhum relatório
    // de impressão seria interpretável.
    expect(selecionarPatrocinios(cs, { regiaoId: null }, HOJE).map((c) => c.id)).toEqual(["c", "a", "b"])
  })

  it("não mistura os outros produtos no carrossel do Dashboard", () => {
    const cs = [
      campanha({ id: "dash", produto: "patrocinio_dashboard" }),
      campanha({ id: "exp", produto: "destaque_explorar" }),
      campanha({ id: "sup", produto: "destaque_superior" }),
    ]
    expect(selecionarPatrocinios(cs, { regiaoId: null }, HOJE).map((c) => c.id)).toEqual(["dash"])
  })

  it("filtra por vigência e por segmentação antes de cortar em 5", () => {
    const cs = [
      campanha({ id: "ok", regiao_id: "angra" }),
      campanha({ id: "outra_regiao", regiao_id: "salvador" }),
      campanha({ id: "pausada", status: "pausada" }),
      campanha({ id: "vencida", fim: "2026-01-01" }),
    ]
    expect(selecionarPatrocinios(cs, { regiaoId: "angra" }, HOJE).map((c) => c.id)).toEqual(["ok"])
  })

  it("o rótulo obrigatório do §20 é a palavra literal do PRD", () => {
    expect(ROTULO_PATROCINADO).toBe("Patrocinado")
  })
})

describe("onde publicidade não entra", () => {
  it("nunca em tela de segurança, ocorrência, saúde, alerta ou navegação", () => {
    expect(permitePublicidade("/barco/seguranca")).toBe(false)
    expect(permitePublicidade("/barco/ocorrencias")).toBe(false)
    expect(permitePublicidade("/barco/ocorrencias/abc")).toBe(false)
    expect(permitePublicidade("/barco/saude")).toBe(false)
    expect(permitePublicidade("/alertas")).toBe(false)
    expect(permitePublicidade("/navegando")).toBe(false)
  })

  it("entra no Dashboard e no Explorar", () => {
    expect(permitePublicidade("/barco")).toBe(true)
    expect(permitePublicidade("/explorar")).toBe(true)
  })
})

describe("destaque no Explorar", () => {
  it("destaque superior vem antes do destaque comum", () => {
    const cs = [
      campanha({ id: "a", parceiro_id: "pa", produto: "destaque_explorar", prioridade: 99 }),
      campanha({ id: "b", parceiro_id: "pb", produto: "destaque_superior", prioridade: 0 }),
    ]
    expect(destaquesDoExplorar(cs, { regiaoId: null }, HOJE)).toEqual(["pb", "pa"])
  })

  it("Partner com dois produtos aparece uma vez só, na melhor posição", () => {
    const cs = [
      campanha({ id: "a", parceiro_id: "p1", produto: "destaque_explorar" }),
      campanha({ id: "b", parceiro_id: "p1", produto: "destaque_superior" }),
      campanha({ id: "c", parceiro_id: "p2", produto: "destaque_explorar" }),
    ]
    expect(destaquesDoExplorar(cs, { regiaoId: null }, HOJE)).toEqual(["p1", "p2"])
  })

  it("ignora patrocínio de Dashboard — é outro lugar", () => {
    const cs = [campanha({ id: "a", parceiro_id: "p1", produto: "patrocinio_dashboard" })]
    expect(destaquesDoExplorar(cs, { regiaoId: null }, HOJE)).toEqual([])
  })

  it("sobe quem comprou e preserva a ordem original do resto", () => {
    const lista = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }]
    const r = ordenarComDestaque(lista, (i) => i.id, ["c", "a"])
    expect(r.map((i) => i.id)).toEqual(["c", "a", "b", "d"])
  })

  it("destaque de quem não está na lista não inventa item nenhum", () => {
    const lista = [{ id: "a" }, { id: "b" }]
    expect(ordenarComDestaque(lista, (i) => i.id, ["z"]).map((i) => i.id)).toEqual(["a", "b"])
  })

  it("sem destaque nenhum, a lista não muda", () => {
    const lista = [{ id: "a" }, { id: "b" }, { id: "c" }]
    expect(ordenarComDestaque(lista, (i) => i.id, []).map((i) => i.id)).toEqual(["a", "b", "c"])
  })
})

describe("§20 — publicidade nunca interfere na nota/reputação do Partner", () => {
  /**
   * A garantia real é ESTRUTURAL: `calcularReputacao` recebe apenas
   * `{ nota, visibilidade }`, e nenhuma função de `publicidade.ts` recebe
   * nota. Este bloco existe pra que, se alguém um dia tentar cruzar as duas
   * coisas, tenha que apagar um teste com o nome do requisito escrito nele —
   * o que é bem mais difícil de fazer sem perceber do que acrescentar um
   * campo numa interface.
   */
  const avaliacoes = [
    { nota: 5, visibilidade: "publica" as const },
    { nota: 4, visibilidade: "publica" as const },
    { nota: 1, visibilidade: "oculta_violacao" as const },
  ]

  it("um Partner com campanha ativa tem exatamente a mesma reputação de antes", () => {
    const antes = calcularReputacao(avaliacoes)
    // A campanha entra em cena…
    const noAr = selecionarPatrocinios([campanha({ parceiro_id: "p1" })], { regiaoId: null }, HOJE)
    expect(noAr).toHaveLength(1)
    // …e a reputação continua sendo função só das avaliações.
    expect(calcularReputacao(avaliacoes)).toEqual(antes)
    expect(antes.media).toBe(4.5)
  })

  it("nota não compra posição: a seleção de anúncio não conhece reputação", () => {
    // Duas campanhas idênticas de Partners com reputações opostas produzem a
    // mesma ordem — a única coisa que ordena é o que foi vendido.
    const cs = [
      campanha({ id: "a", parceiro_id: "otimo", prioridade: 1 }),
      campanha({ id: "b", parceiro_id: "ruim", prioridade: 5 }),
    ]
    expect(selecionarPatrocinios(cs, { regiaoId: null }, HOJE).map((c) => c.parceiro_id)).toEqual([
      "ruim",
      "otimo",
    ])
  })
})

describe("preço e desempenho", () => {
  it("sem preço definido é 'Sob consulta', nunca R$ 0,00", () => {
    expect(formatarPrecoPublicidade(null)).toBe("Sob consulta")
    expect(formatarPrecoPublicidade(19900)).toBe("R$ 199,00/mês")
  })

  it("taxa de clique sem impressão é ausência de amostra, não 0%", () => {
    expect(taxaDeClique(0, 0)).toBeNull()
    expect(formatarTaxa(taxaDeClique(0, 0))).toBe("—")
    expect(taxaDeClique(200, 10)).toBe(5)
    expect(formatarTaxa(taxaDeClique(200, 10))).toBe("5%")
    expect(formatarTaxa(taxaDeClique(300, 10))).toBe("3,3%")
  })

  it("período com fim antes do início é recusado", () => {
    expect(periodoValido("2026-08-01", "2026-08-31")).toBe(true)
    expect(periodoValido("2026-08-01", null)).toBe(true)
    expect(periodoValido("2026-08-01", "")).toBe(true)
    expect(periodoValido("2026-08-31", "2026-08-01")).toBe(false)
    expect(periodoValido("", "2026-08-01")).toBe(false)
  })

  it("descreve o período em português", () => {
    expect(descreverPeriodo("2026-08-01", null)).toBe("Desde 01/08/2026")
    expect(descreverPeriodo("2026-08-01", "2026-08-31")).toBe("01/08/2026 a 31/08/2026")
  })
})
