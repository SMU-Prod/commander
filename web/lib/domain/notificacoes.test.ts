import { describe, expect, it } from "vitest"
import {
  agruparSemelhantes,
  CATEGORIAS_NOTIFICACAO,
  contadorSino,
  contarPorCategoria,
  filtrarPorCategoria,
  filtrarPorPermissao,
  nivelDaOcorrencia,
  nivelDoStatusItem,
  NIVEIS_NOTIFICACAO,
  ordenarNotificacoes,
  PUSH_POR_NIVEL,
  VAZIO_CATEGORIA_NOTIFICACAO,
  type Notificacao,
} from "./notificacoes"
import { normalizarPermissoes } from "./permissoes"

function n(parcial: Partial<Notificacao> & { id: string }): Notificacao {
  return {
    titulo: `Aviso ${parcial.id}`,
    detalhe: "",
    categoria: "embarcacao",
    nivel: "importante",
    aba: null,
    href: "/barco",
    quando: null,
    grupo: parcial.id,
    ...parcial,
  }
}

describe("categorias e níveis do PRD §5.2", () => {
  it("as quatro categorias existem mesmo sem o módulo por trás", () => {
    expect(CATEGORIAS_NOTIFICACAO).toEqual(["embarcacao", "agenda", "marketplace", "financeiro"])
  })
  it("toda categoria tem um estado vazio escrito — filtro vazio nunca some da tela", () => {
    for (const c of CATEGORIAS_NOTIFICACAO) {
      expect(VAZIO_CATEGORIA_NOTIFICACAO[c].length).toBeGreaterThan(0)
    }
  })
  it("os três níveis são os do PRD", () => {
    expect(NIVEIS_NOTIFICACAO).toEqual(["critica", "importante", "informativa"])
  })
  it("crítica e importante mandam push; informativa é só in-app", () => {
    expect(PUSH_POR_NIVEL.critica).toBe(true)
    expect(PUSH_POR_NIVEL.importante).toBe(true)
    expect(PUSH_POR_NIVEL.informativa).toBe(false)
  })
})

describe("nivelDoStatusItem", () => {
  it("vencido é crítico, na margem é importante, em dia é informativo", () => {
    expect(nivelDoStatusItem("vencido")).toBe("critica")
    expect(nivelDoStatusItem("atencao")).toBe("importante")
    expect(nivelDoStatusItem("ok")).toBe("informativa")
  })
})

describe("nivelDaOcorrencia", () => {
  it("aberta com gravidade alta é crítica", () => {
    expect(nivelDaOcorrencia("aberta", "alta")).toBe("critica")
  })
  it("aberta sem gravidade registrada não vira crítica — dado ausente nunca vira mais alarme", () => {
    expect(nivelDaOcorrencia("aberta", null)).toBe("importante")
  })
  it("em acompanhamento nunca é crítica — alguém já está cuidando", () => {
    expect(nivelDaOcorrencia("em_acompanhamento", "alta")).toBe("importante")
  })
  it("resolvida e anulada não interrompem ninguém", () => {
    expect(nivelDaOcorrencia("resolvida", "alta")).toBe("informativa")
    expect(nivelDaOcorrencia("anulada", "alta")).toBe("informativa")
  })
})

describe("filtrarPorPermissao — 'notificações sempre respeitam permissões'", () => {
  // Tripulante que vê Motores mas NÃO vê Documentos.
  const tripulante = normalizarPermissoes({ motores: { ver: true }, diario: { ver: true } })

  it("um tripulante sem acesso a Documentos não recebe aviso de documento vencendo", () => {
    const lista = [n({ id: "doc", aba: "documentos" }), n({ id: "motor", aba: "motores" })]
    expect(filtrarPorPermissao(lista, tripulante).map((x) => x.id)).toEqual(["motor"])
  })

  it("aviso sem hub (conta, assinatura, mar) chega a todo mundo com vínculo", () => {
    expect(filtrarPorPermissao([n({ id: "geral", aba: null })], tripulante)).toHaveLength(1)
  })

  it("PROP (permissoes null) recebe tudo", () => {
    const lista = [n({ id: "doc", aba: "documentos" }), n({ id: "seg", aba: "seguranca" })]
    expect(filtrarPorPermissao(lista, null)).toHaveLength(2)
  })

  it("permissão de VER basta — não exige editar", () => {
    const soVe = normalizarPermissoes({ documentos: { ver: true, editar: false } })
    expect(filtrarPorPermissao([n({ id: "doc", aba: "documentos" })], soVe)).toHaveLength(1)
  })
})

describe("filtrarPorCategoria", () => {
  const lista = [n({ id: "a", categoria: "embarcacao" }), n({ id: "b", categoria: "financeiro" })]
  it("'todas' devolve tudo", () => {
    expect(filtrarPorCategoria(lista, "todas")).toHaveLength(2)
  })
  it("categoria sem nenhuma notificação devolve lista vazia (e a tela mostra o vazio honesto)", () => {
    expect(filtrarPorCategoria(lista, "agenda")).toEqual([])
  })
  it("filtra pela categoria pedida", () => {
    expect(filtrarPorCategoria(lista, "financeiro").map((x) => x.id)).toEqual(["b"])
  })
})

describe("ordenarNotificacoes", () => {
  it("crítica antes de importante antes de informativa", () => {
    const lista = [n({ id: "i", nivel: "informativa" }), n({ id: "c", nivel: "critica" }), n({ id: "m", nivel: "importante" })]
    expect(ordenarNotificacoes(lista).map((x) => x.id)).toEqual(["c", "m", "i"])
  })
  it("dentro do mesmo nível, o mais recente primeiro", () => {
    const lista = [
      n({ id: "velho", quando: "2026-01-01T00:00:00Z" }),
      n({ id: "novo", quando: "2026-08-01T00:00:00Z" }),
    ]
    expect(ordenarNotificacoes(lista).map((x) => x.id)).toEqual(["novo", "velho"])
  })
  it("estado atual do barco (sem data) vem antes do histórico do mesmo nível", () => {
    const lista = [n({ id: "datado", quando: "2026-08-01T00:00:00Z" }), n({ id: "agora", quando: null })]
    expect(ordenarNotificacoes(lista).map((x) => x.id)).toEqual(["agora", "datado"])
  })
})

describe("agruparSemelhantes — evitar spam (PRD §5.2)", () => {
  it("dobra semelhantes numa linha com contador", () => {
    const lista = [
      n({ id: "d1", grupo: "documento:vencido" }),
      n({ id: "d2", grupo: "documento:vencido" }),
      n({ id: "d3", grupo: "documento:vencido" }),
    ]
    const agrupadas = agruparSemelhantes(lista)
    expect(agrupadas).toHaveLength(1)
    expect(agrupadas[0].quantidade).toBe(3)
  })

  it("mantém a primeira da lista como representante — ordene antes pra sobrar a mais urgente", () => {
    const ordenadas = ordenarNotificacoes([
      n({ id: "leve", grupo: "g", nivel: "importante" }),
      n({ id: "grave", grupo: "g", nivel: "critica" }),
    ])
    const [linha] = agruparSemelhantes(ordenadas)
    expect(linha.id).toBe("grave")
    expect(linha.quantidade).toBe(2)
  })

  it("grupos diferentes não se misturam", () => {
    const agrupadas = agruparSemelhantes([n({ id: "a", grupo: "x" }), n({ id: "b", grupo: "y" })])
    expect(agrupadas).toHaveLength(2)
    expect(agrupadas.every((a) => a.quantidade === 1)).toBe(true)
  })

  it("lista vazia continua vazia", () => {
    expect(agruparSemelhantes([])).toEqual([])
  })
})

describe("contarPorCategoria", () => {
  it("traz as quatro chaves sempre, mesmo zeradas", () => {
    const contagem = contarPorCategoria([n({ id: "a", categoria: "embarcacao" })])
    expect(contagem).toEqual({ embarcacao: 1, agenda: 0, marketplace: 0, financeiro: 0 })
  })
})

describe("contadorSino", () => {
  it("conta críticas e importantes", () => {
    expect(contadorSino([n({ id: "c", nivel: "critica" }), n({ id: "m", nivel: "importante" })])).toBe(2)
  })
  it("informativa não entra no badge — badge que nunca zera perde o sentido", () => {
    expect(contadorSino([n({ id: "i", nivel: "informativa" })])).toBe(0)
  })
})
