import { describe, expect, it } from "vitest"
import {
  agruparSemelhantes,
  CATEGORIAS_NOTIFICACAO,
  contadorSino,
  contarPorCategoria,
  filtrarPorCategoria,
  filtrarPorPermissao,
  iconeDoAviso,
  nivelDaOcorrencia,
  nivelDoCompromisso,
  nivelDoStatusItem,
  nivelDoVencimentoFinanceiro,
  NIVEIS_NOTIFICACAO,
  NIVEL_AVISO_MARKETPLACE,
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
    acao: "Resolver",
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

  // ONDA 58 — a trava do spec de arquitetura §3.3: "a contagem passa a ser de
  // pendências que pedem ação — que é o que um número vermelho sobre um ícone
  // promete". Antes do spec, um "3" no sino podia ser três informativas; quem
  // abre e não acha nada pra fazer aprende a ignorar o número — e aí ele não
  // avisa mais nada quando importa. É a diferença entre número que se confia
  // e número que se ignora. Mesmo critério de PUSH_POR_NIVEL: o que interrompe
  // é o que conta.
  it("1 crítica + 1 importante + 3 informativas = 2 (spec §3.3)", () => {
    expect(
      contadorSino([
        n({ id: "c", nivel: "critica" }),
        n({ id: "m", nivel: "importante" }),
        n({ id: "i1", nivel: "informativa" }),
        n({ id: "i2", nivel: "informativa" }),
        n({ id: "i3", nivel: "informativa" }),
      ]),
    ).toBe(2)
  })
})

// --- onda 53: as três categorias que ganharam fonte ------------------------

describe("nivelDoCompromisso (Agenda)", () => {
  it("hoje e amanhã pedem ação; mais longe é só aviso", () => {
    expect(nivelDoCompromisso(0)).toBe("importante")
    expect(nivelDoCompromisso(1)).toBe("importante")
    expect(nivelDoCompromisso(2)).toBe("informativa")
    expect(nivelDoCompromisso(7)).toBe("informativa")
  })
  it("compromisso NUNCA é crítica — crítica no Commander é sobre o barco", () => {
    for (const dias of [-5, 0, 1, 2, 30]) {
      expect(nivelDoCompromisso(dias)).not.toBe("critica")
    }
  })
})

describe("nivelDoVencimentoFinanceiro", () => {
  it("vencido e vencendo hoje pedem ação; a vencer é aviso", () => {
    expect(nivelDoVencimentoFinanceiro(-10)).toBe("importante")
    expect(nivelDoVencimentoFinanceiro(0)).toBe("importante")
    expect(nivelDoVencimentoFinanceiro(1)).toBe("informativa")
    expect(nivelDoVencimentoFinanceiro(7)).toBe("informativa")
  })
  it("dinheiro NUNCA é crítica — o app não sabe se a conta foi paga por fora", () => {
    for (const dias of [-90, -1, 0, 3]) {
      expect(nivelDoVencimentoFinanceiro(dias)).not.toBe("critica")
    }
  })
})

describe("NIVEL_AVISO_MARKETPLACE", () => {
  it("o que tem alguém esperando do outro lado é importante", () => {
    expect(NIVEL_AVISO_MARKETPLACE.proposta_recebida).toBe("importante")
    expect(NIVEL_AVISO_MARKETPLACE.proposta_aceita).toBe("importante")
    expect(NIVEL_AVISO_MARKETPLACE.negocio_aguardando).toBe("importante")
  })
  it("recusa não pede nada de ninguém — informativa", () => {
    expect(NIVEL_AVISO_MARKETPLACE.proposta_recusada).toBe("informativa")
  })
  it("nenhum aviso comercial é crítica", () => {
    for (const nivel of Object.values(NIVEL_AVISO_MARKETPLACE)) {
      expect(nivel).not.toBe("critica")
    }
  })
})

describe("vazio de categoria depois que os módulos existem (onda 53)", () => {
  it("nenhum texto ainda diz que o módulo não está no ar", () => {
    for (const c of CATEGORIAS_NOTIFICACAO) {
      const texto = VAZIO_CATEGORIA_NOTIFICACAO[c].toLowerCase()
      expect(texto).not.toContain("ainda não está no ar")
      expect(texto).not.toContain("quando estiver")
    }
  })
})

// --- onda 59: a ação nomeada dentro do aviso -------------------------------

describe("acao — o verbo da tela de destino (spec §3.2)", () => {
  // "Todo construtor devolve acao não vazia" é trabalho do COMPILADOR:
  // `acao: string` obrigatório e sem default quebra o tsc em cada construtor
  // de `lib/consultas.ts` até cada um nomear o seu verbo. O que sobra pro
  // runtime é garantir que o verbo atravessa a mecânica sem se perder.
  it("agrupar mantém a ação da representante — o cartão promete o verbo da mais urgente", () => {
    const ordenadas = ordenarNotificacoes([
      n({ id: "leve", grupo: "g", nivel: "importante", acao: "Ver ocorrência" }),
      n({ id: "grave", grupo: "g", nivel: "critica", acao: "Registrar manutenção" }),
    ])
    const [linha] = agruparSemelhantes(ordenadas)
    expect(linha.id).toBe("grave")
    expect(linha.acao).toBe("Registrar manutenção")
  })

  it("ordenar e filtrar não derrubam o campo — refactor que reconstruir o objeto cai aqui", () => {
    const lista = [n({ id: "a", categoria: "financeiro", acao: "Ver lançamento" })]
    expect(ordenarNotificacoes(lista)[0].acao).toBe("Ver lançamento")
    expect(filtrarPorCategoria(lista, "financeiro")[0].acao).toBe("Ver lançamento")
    expect(filtrarPorPermissao(lista, null)[0].acao).toBe("Ver lançamento")
  })
})

describe("agrupamento das categorias novas", () => {
  it("cinco propostas recebidas no mesmo pedido viram uma linha com +4", () => {
    const grupo = "marketplace:recebida:d1"
    const agrupadas = agruparSemelhantes(
      ordenarNotificacoes(
        Array.from({ length: 5 }, (_, i) =>
          n({ id: `p${i}`, categoria: "marketplace", nivel: "importante", grupo, quando: `2026-08-0${i + 1}` }),
        ),
      ),
    )
    expect(agrupadas).toHaveLength(1)
    expect(agrupadas[0].quantidade).toBe(5)
    // A linha mostrada é a mais recente do grupo, porque ordena antes.
    expect(agrupadas[0].id).toBe("p4")
  })
})

// --- onda 62: o ícone do cartão (canvas tela-1e) ---------------------------

describe("iconeDoAviso", () => {
  it("categoria manda primeiro: agenda, financeiro e marketplace têm desenho próprio", () => {
    expect(iconeDoAviso({ categoria: "agenda", aba: null })).toBe("calendario")
    expect(iconeDoAviso({ categoria: "financeiro", aba: "gastos" })).toBe("cifrao")
    expect(iconeDoAviso({ categoria: "marketplace", aba: null })).toBe("marketplace")
  })
  it("dentro da embarcação, o ícone é o do hub de origem", () => {
    expect(iconeDoAviso({ categoria: "embarcacao", aba: "documentos" })).toBe("documento")
    expect(iconeDoAviso({ categoria: "embarcacao", aba: "seguranca" })).toBe("seguranca")
    expect(iconeDoAviso({ categoria: "embarcacao", aba: "motores" })).toBe("motor")
    expect(iconeDoAviso({ categoria: "embarcacao", aba: "eletrica" })).toBe("ferramenta")
    expect(iconeDoAviso({ categoria: "embarcacao", aba: "hidraulica" })).toBe("ferramenta")
    expect(iconeDoAviso({ categoria: "embarcacao", aba: "equipamentos" })).toBe("ferramenta")
  })
  it("sem hub conhecido, cai no sino genérico — nunca inventa origem", () => {
    expect(iconeDoAviso({ categoria: "embarcacao", aba: null })).toBe("alerta")
    expect(iconeDoAviso({ categoria: "embarcacao", aba: "diario" })).toBe("alerta")
  })
})

describe("toda notificação nasce com ação nomeada (spec arquitetura §3.2)", () => {
  // O tipo obriga o campo a EXISTIR, mas `acao: ""` compilaria — e um aviso
  // com ação vazia é exatamente o "link mudo" que a onda 59 matou. Como os
  // construtores moram em lib/consultas.ts atrás do supabase, a checagem é
  // estática, no espírito do tokens.test.ts: lê o arquivo e cobra que todo
  // literal de `acao:` tem verbo de verdade.
  it("nenhum construtor em lib/consultas.ts escreve acao vazia", async () => {
    const { readFileSync } = await import("node:fs")
    const { join } = await import("node:path")
    const fonte = readFileSync(join(process.cwd(), "lib/consultas.ts"), "utf-8")
    const literais = [...fonte.matchAll(/\bacao: (?:[^,\n]*\? )?"([^"]*)"(?: : "([^"]*)")?/g)]
    // Sentinela anti-vazio: se a extração quebrar com refactor, falha alto
    // em vez de passar sem medir nada.
    expect(literais.length).toBeGreaterThanOrEqual(8)
    for (const m of literais) {
      expect(m[1], `acao vazia perto de: ${m[0]}`).not.toBe("")
      if (m[2] != null) expect(m[2], `acao vazia perto de: ${m[0]}`).not.toBe("")
    }
  })
})
