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
  notificacaoDeDemandaCompativel,
  notificacaoDeMotorParado,
  ordenarNotificacoes,
  pedeAcao,
  PEDE_ACAO_POR_NIVEL,
  PUSH_POR_NIVEL,
  VAZIO_CATEGORIA_NOTIFICACAO,
  type Notificacao,
} from "./notificacoes"
import { lembreteMotorParado } from "./alertas"
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
  // e número que se ignora.
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

  it("caixa vazia e caixa só de informativas dão o mesmo zero — o badge some", () => {
    expect(contadorSino([])).toBe(0)
    expect(contadorSino([n({ id: "i1", nivel: "informativa" }), n({ id: "i2", nivel: "informativa" })])).toBe(0)
  })

  // ONDA 101 — o sino conta FATOS, a tela desenha LINHAS, e isso é decisão.
  // `agruparSemelhantes` é apresentação: cinco pedidos compatíveis viram um
  // cartão com "+4 semelhantes". Se o sino contasse linhas agrupadas, ele diria
  // "1" para cinco coisas esperando. A aritmética fecha à vista (1 linha + "+4"
  // = 5) e é a mesma do chip "Todas" e da aba Pendentes, que também contam cru.
  it("conta o fato, não o cartão: cinco semelhantes são 5 no sino e 1 linha na tela", () => {
    const cinco = ["a", "b", "c", "d", "e"].map((id) =>
      n({ id, nivel: "importante", grupo: "mesmo-grupo" }),
    )
    expect(contadorSino(cinco)).toBe(5)
    expect(agruparSemelhantes(cinco)).toHaveLength(1)
  })
})

describe("PEDE_ACAO_POR_NIVEL — a régua do número vermelho (spec §3.3)", () => {
  it("crítica e importante pedem ação; informativa não", () => {
    expect(PEDE_ACAO_POR_NIVEL.critica).toBe(true)
    expect(PEDE_ACAO_POR_NIVEL.importante).toBe(true)
    expect(PEDE_ACAO_POR_NIVEL.informativa).toBe(false)
  })

  it("todo nível tem resposta — nível novo sem régua não passa despercebido", () => {
    for (const nivel of NIVEIS_NOTIFICACAO) {
      expect(typeof PEDE_ACAO_POR_NIVEL[nivel]).toBe("boolean")
    }
  })

  it("`pedeAcao` é a régua que `contadorSino` usa — não duas contas parecidas", () => {
    const lista = NIVEIS_NOTIFICACAO.map((nivel) => n({ id: nivel, nivel }))
    expect(contadorSino(lista)).toBe(lista.filter(pedeAcao).length)
  })

  // A trava que dá sentido à separação: as duas constantes são IGUAIS hoje, e
  // isso é conferido de propósito. Elas respondem a perguntas diferentes —
  // "vale acordar alguém no celular?" e "isto está esperando por mim?" — e
  // `PUSH_POR_NIVEL` já não descreve o app (diz `true` para toda importante,
  // mas Agenda e Financeiro nunca viram push). Quando alguém corrigir aquela
  // constante, este teste falha e obriga a decisão a ser escrita, em vez de o
  // sino perder metade da caixa como efeito colateral de outra correção.
  it("hoje coincide com PUSH_POR_NIVEL — e o dia em que divergir tem de ser escolha", () => {
    for (const nivel of NIVEIS_NOTIFICACAO) {
      expect(
        PEDE_ACAO_POR_NIVEL[nivel],
        `Se o push de "${nivel}" mudou, decida explicitamente o que o SINO faz — ` +
          "as duas réguas são separadas desde a onda 101 justamente para isto.",
      ).toBe(PUSH_POR_NIVEL[nivel])
    }
  })
})

// --- onda 101: motor parado, a fonte que o push tinha e a caixa não --------

describe("notificacaoDeMotorParado", () => {
  const motor = { id: "eq1", nome: "Motor BE", ultimaLeitura: "2026-07-01" }

  it("motor sem leitura há mais de 30 dias vira pendência", () => {
    const aviso = notificacaoDeMotorParado(motor, "2026-08-08")
    expect(aviso).not.toBeNull()
    expect(aviso!.titulo).toBe("Motor BE sem leitura de horas")
  })

  it("dentro dos 30 dias não há aviso — a régua é a MESMA do push", () => {
    // `lembreteMotorParado` é quem decide, aqui e no cron. Se este teste e o de
    // `alertas.test.ts` discordarem, é porque alguém escreveu uma segunda régua.
    expect(notificacaoDeMotorParado({ ...motor, ultimaLeitura: "2026-07-20" }, "2026-08-08")).toBeNull()
    expect(lembreteMotorParado("2026-07-20", "2026-08-08")).toBeNull()
  })

  it("motor que nunca teve leitura não vira aviso — sem carimbo não se inventa quantos dias faz", () => {
    expect(notificacaoDeMotorParado({ ...motor, ultimaLeitura: null }, "2026-08-08")).toBeNull()
  })

  it("é importante: conta no sino e interrompe o celular, que é o que o cron já faz", () => {
    const aviso = notificacaoDeMotorParado(motor, "2026-08-08")!
    expect(aviso.nivel).toBe("importante")
    expect(contadorSino([aviso])).toBe(1)
    expect(PUSH_POR_NIVEL[aviso.nivel]).toBe(true)
  })

  it("nunca é crítica — crítica no Commander é fato consumado do barco", () => {
    // Um ano parado continua sendo recomendação preventiva, não fato consumado.
    expect(notificacaoDeMotorParado({ ...motor, ultimaLeitura: "2025-08-08" }, "2026-08-08")!.nivel)
      .not.toBe("critica")
  })

  it("pertence à área Motores — tripulante sem acesso a Motores não recebe", () => {
    const aviso = notificacaoDeMotorParado(motor, "2026-08-08")!
    expect(aviso.aba).toBe("motores")
    const semMotores = normalizarPermissoes({ diario: { ver: true } })
    expect(filtrarPorPermissao([aviso], semMotores)).toHaveLength(0)
  })

  it("leva pra ficha do equipamento, com verbo que vale pra quem só pode ver", () => {
    const aviso = notificacaoDeMotorParado(motor, "2026-08-08")!
    expect(aviso.href).toBe("/barco/equipamento/eq1")
    expect(aviso.acao).toBe("Ver motor")
  })

  it("o detalhe é o MESMO corpo que vai no push — os dois canais dizem a frase igual", () => {
    const aviso = notificacaoDeMotorParado(motor, "2026-08-08")!
    expect(aviso.detalhe).toBe(lembreteMotorParado("2026-07-01", "2026-08-08")!.corpo)
  })

  it("dois motores parados viram UMA linha com contador (§5.2)", () => {
    const avisos = [
      notificacaoDeMotorParado(motor, "2026-08-08")!,
      notificacaoDeMotorParado({ id: "eq2", nome: "Motor BB", ultimaLeitura: "2026-07-01" }, "2026-08-08")!,
    ]
    expect(agruparSemelhantes(avisos)).toHaveLength(1)
    expect(agruparSemelhantes(avisos)[0].quantidade).toBe(2)
    // Mas o sino conta os dois motores: são dois fatos esperando.
    expect(contadorSino(avisos)).toBe(2)
  })

  it("é estado atual (sem data), então vem antes de histórico do mesmo nível", () => {
    const aviso = notificacaoDeMotorParado(motor, "2026-08-08")!
    expect(aviso.quando).toBeNull()
    const datado = n({ id: "x", nivel: "importante", quando: "2026-08-01T00:00:00Z" })
    expect(ordenarNotificacoes([datado, aviso])[0].id).toBe(aviso.id)
  })

  it("o ícone é o do motor, derivado de categoria+aba como todo aviso", () => {
    expect(iconeDoAviso(notificacaoDeMotorParado(motor, "2026-08-08")!)).toBe("motor")
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
  it("pedido novo compatível é importante — ele PEDE ação de quem atende", () => {
    expect(NIVEL_AVISO_MARKETPLACE.demanda_compativel).toBe("importante")
  })
  it("e por ser importante, interrompe o celular e conta no sino", () => {
    // As três coisas são a mesma decisão neste módulo: `PUSH_POR_NIVEL` e
    // `contadorSino` leem o mesmo nível. Se alguém rebaixar o aviso pra
    // informativa, o push some junto — e o push é o motivo desta onda existir.
    const aviso = notificacaoDeDemandaCompativel({
      id: "d1", tipo: "profissional", titulo: "Serviço de Elétrica em Angra", criadoEm: null,
    })
    expect(PUSH_POR_NIVEL[aviso.nivel]).toBe(true)
    expect(contadorSino([aviso])).toBe(1)
  })
})

describe("notificacaoDeDemandaCompativel — o construtor que os dois canais usam (onda 99)", () => {
  const base = { id: "d1", titulo: "Serviço de Elétrica em Angra", criadoEm: "2026-08-19T12:00:00Z" }

  it("leva pro pedido, não pra lista — o Partner não tem barco nem Central de barco", () => {
    expect(notificacaoDeDemandaCompativel({ ...base, tipo: "profissional" }).href).toBe("/marketplace/d1")
  })

  it("o verbo é o do botão da tela de destino, por tipo (§11.5)", () => {
    expect(notificacaoDeDemandaCompativel({ ...base, tipo: "profissional" }).acao).toBe("Enviar proposta")
    expect(notificacaoDeDemandaCompativel({ ...base, tipo: "tripulacao" }).acao).toBe("Enviar candidatura")
  })

  it("nasce sem aba: é o que faz o aviso chegar a quem não tem permissão de hub nenhum", () => {
    const aviso = notificacaoDeDemandaCompativel({ ...base, tipo: "produto" })
    expect(aviso.aba).toBeNull()
    // "Nenhuma permissão" é o que o disparo usa pra quem não tem vínculo com
    // barco algum (Partner, Captain). O aviso tem de passar mesmo assim.
    expect(filtrarPorPermissao([aviso], normalizarPermissoes(null))).toHaveLength(1)
  })

  it("cinco pedidos viram UMA linha com contador — o anti-spam do §5.2", () => {
    const avisos = ["a", "b", "c", "d", "e"].map((id) =>
      notificacaoDeDemandaCompativel({ ...base, id, tipo: "profissional" }),
    )
    const agrupados = agruparSemelhantes(avisos)
    expect(agrupados).toHaveLength(1)
    expect(agrupados[0].quantidade).toBe(5)
  })

  it("o detalhe é o título gerado pelo Commander, nunca o texto livre de quem publicou", () => {
    expect(notificacaoDeDemandaCompativel({ ...base, tipo: "profissional" }).detalhe).toBe(base.titulo)
  })

  it("cai na categoria Marketplace, que é o filtro que a tela oferece", () => {
    expect(notificacaoDeDemandaCompativel({ ...base, tipo: "caminhao" }).categoria).toBe("marketplace")
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

// --- onda 101: o sino diz o mesmo número em todo lugar ---------------------

/**
 * A PROVA DE QUE AS QUATRO SUPERFÍCIES CONCORDAM.
 *
 * O número aparece em quatro lugares — barra de baixo, trilho do desktop,
 * faixa de topo e o sino da Início — e é calculado em dois
 * (`app/(app)/layout.tsx` e `app/(app)/hoje/page.tsx`). Quatro superfícies e
 * duas contas é exatamente a forma que a divergência tem quando nasce: foi
 * assim que o trilho nasceu SEM número na onda 57, e assim que o layout zerou
 * o sino de quem não tem barco até a onda 99.
 *
 * Testar isso com render não pega o defeito que importa — o defeito não é o
 * componente desenhar errado, é alguém somar por conta própria em algum
 * arquivo novo. Então a catraca é estática, no espírito de `lib/ui/tokens.test.ts`:
 * lê os arquivos e cobra a FORMA de calcular. Enquanto todo número vier de
 * `contadorSino` sobre `carregarNotificacoes`, os quatro concordam por
 * construção — e não por coincidência conferida à mão.
 */
describe("a contagem do sino é uma só, nos quatro lugares que a mostram (spec §3.3)", () => {
  async function ler(relativo: string): Promise<string> {
    const { readFileSync } = await import("node:fs")
    const { join } = await import("node:path")
    return readFileSync(join(process.cwd(), relativo), "utf-8")
  }

  /**
   * O CÓDIGO SEM OS COMENTÁRIOS, e a distinção é o teste inteiro.
   *
   * Este projeto documenta a régua no lugar onde ela é consumida: a
   * `BottomNav` explica em prosa que o contador "já vem filtrado por permissão
   * — ver `carregarNotificacoes`". Uma busca por texto cru lê essa frase como
   * se a barra estivesse chamando a consulta, e a catraca reprovaria
   * exatamente o comentário que existe pra manter a regra viva — ensinando a
   * apagar documentação pra fazer teste passar, que é o pior incentivo que um
   * teste pode criar. O que se mede aqui é CHAMADA, não menção.
   */
  function semComentarios(fonte: string): string {
    return fonte.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ")
  }

  /** Quem CALCULA o número. Os dois têm de derivá-lo da mesma dupla. */
  const ORIGENS = ["app/(app)/layout.tsx", "app/(app)/hoje/page.tsx"]

  /** Quem MOSTRA o número. Nenhum deles pode calcular nada. */
  const SUPERFICIES = [
    "components/bottom-nav.tsx",
    "components/trilho-lateral.tsx",
    "components/faixa-topo.tsx",
    "components/sino-notificacoes.tsx",
    "components/ui/contador-avisos.tsx",
  ]

  it("as duas origens calculam com `contadorSino` sobre `carregarNotificacoes`", async () => {
    for (const arquivo of ORIGENS) {
      const codigo = semComentarios(await ler(arquivo))
      expect(codigo, `${arquivo} deixou de chamar contadorSino`).toContain("contadorSino")
      expect(codigo, `${arquivo} deixou de chamar carregarNotificacoes`).toContain("carregarNotificacoes")
    }
  })

  it("nenhuma superfície de exibição conta por conta própria — o número entra por prop", async () => {
    for (const arquivo of SUPERFICIES) {
      const codigo = semComentarios(await ler(arquivo))
      // Se qualquer um destes for CHAMADO aqui, existe uma segunda conta no
      // app — e duas contas é a definição de dois números diferentes.
      for (const proibido of ["contadorSino", "PEDE_ACAO_POR_NIVEL", "PUSH_POR_NIVEL", "pedeAcao", "carregarNotificacoes"]) {
        expect(
          codigo.includes(proibido),
          `${arquivo} calcula a contagem por conta própria (${proibido}). ` +
            "O número tem de chegar por prop, vindo do layout ou da Início.",
        ).toBe(false)
      }
    }
  })

  it("as superfícies não conhecem o domínio de avisos — nem para 'só dar uma olhada'", async () => {
    // Import é código, nunca comentário: é a prova mais limpa de que a
    // superfície é burra por construção. Uma que importe a régua já pode
    // recalcular amanhã sem ninguém notar.
    for (const arquivo of SUPERFICIES) {
      const codigo = semComentarios(await ler(arquivo))
      expect(
        /from\s+["']@\/lib\/(domain\/notificacoes|consultas)["']/.test(codigo),
        `${arquivo} importa a régua de avisos — ele só pode receber o número pronto.`,
      ).toBe(false)
    }
  })

  it("ninguém compara nível à mão pra contar — a régua é PEDE_ACAO_POR_NIVEL", async () => {
    // Sentinela de escopo: se um arquivo passar a somar avisos por conta
    // própria, ele aparece aqui antes de virar o segundo número do app.
    for (const arquivo of [...ORIGENS, ...SUPERFICIES, "lib/consultas.ts"]) {
      const codigo = semComentarios(await ler(arquivo))
      expect(
        /nivel\s*===\s*["'](critica|importante)["']/.test(codigo),
        `${arquivo} compara nível à mão — a régua do que pede ação mora no domínio.`,
      ).toBe(false)
    }
  })

  it("o badge some no zero nos dois desenhos — 0 nunca vira círculo vazio", async () => {
    // `null` nunca vira zero desenhado (regra da casa, `lib/domain/patio.ts`).
    // Os dois componentes que desenham o número têm de recusar o não-positivo.
    expect(await ler("components/ui/contador-avisos.tsx")).toContain("avisos <= 0")
    expect(await ler("components/sino-notificacoes.tsx")).toContain("contador > 0")
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
