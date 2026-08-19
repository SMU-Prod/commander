import { describe, expect, it } from "vitest"
import { diaCivilSP } from "./datas"
import {
  agruparPorDia,
  contarNaoLidas,
  corpoValido,
  idDoOutro,
  LIMITE_CORPO_MENSAGEM,
  marcaDeLeitura,
  motivoCorpoInvalido,
  ordenarConversas,
  papelNaConversa,
  podeApagar,
  podeConversar,
  previaDaConversa,
  rotuloNaoLidas,
  TEXTO_MENSAGEM_APAGADA,
  ultimaMensagem,
  type Mensagem,
} from "./mensagens"

const DONO = "dono-1"
const PARCEIRO = "parceiro-1"
const ESTRANHO = "estranho-1"

const conversa = { id: "c-1", dono_id: DONO, parceiro_id: PARCEIRO }

function msg(over: Partial<Mensagem> & { criado_em: string; autor_id: string }): Mensagem {
  return {
    id: over.id ?? `m-${over.criado_em}-${over.autor_id}`,
    conversa_id: "c-1",
    corpo: over.corpo ?? "texto",
    apagada_em: over.apagada_em ?? null,
    ...over,
  }
}

// ---------------------------------------------------------------------------
// O corpo — a única coisa que a pessoa digita
// ---------------------------------------------------------------------------
describe("corpoValido", () => {
  it("devolve o texto sem os espaços das pontas", () => {
    expect(corpoValido("  consigo na terça  ")).toBe("consigo na terça")
  })

  it("recusa o vazio e o que é só espaço — mensagem em branco ocupa linha na thread do outro", () => {
    expect(corpoValido("")).toBeNull()
    expect(corpoValido("   \n  \t ")).toBeNull()
    expect(corpoValido(null)).toBeNull()
    expect(corpoValido(undefined)).toBeNull()
  })

  it("preserva quebra de linha simples e dupla — três medidas em três linhas são três linhas", () => {
    expect(corpoValido("6,40/L\n1500 L\nentrego sábado")).toBe("6,40/L\n1500 L\nentrego sábado")
    expect(corpoValido("primeiro\n\nsegundo")).toBe("primeiro\n\nsegundo")
  })

  it("colapsa a sequência de enters que empurraria a conversa pra fora da tela", () => {
    expect(corpoValido("oi\n\n\n\n\n\ntchau")).toBe("oi\n\ntchau")
  })

  it("normaliza CRLF — o teclado do Windows não pode gerar uma mensagem diferente", () => {
    expect(corpoValido("linha 1\r\nlinha 2")).toBe("linha 1\nlinha 2")
  })

  it("recusa o que passa do teto em vez de cortar — truncar entregaria uma frase que ninguém escreveu", () => {
    expect(corpoValido("a".repeat(LIMITE_CORPO_MENSAGEM))).toHaveLength(LIMITE_CORPO_MENSAGEM)
    expect(corpoValido("a".repeat(LIMITE_CORPO_MENSAGEM + 1))).toBeNull()
  })
})

describe("motivoCorpoInvalido", () => {
  it("distingue 'não escreveu nada' de 'escreveu demais' — o segundo tem conserto óbvio", () => {
    expect(motivoCorpoInvalido("")).toContain("Escreva a mensagem")
    expect(motivoCorpoInvalido("a".repeat(LIMITE_CORPO_MENSAGEM + 1))).toContain("passou de")
  })
})

// ---------------------------------------------------------------------------
// Quem é quem
// ---------------------------------------------------------------------------
describe("papelNaConversa / idDoOutro", () => {
  it("reconhece os dois lados", () => {
    expect(papelNaConversa(conversa, DONO)).toBe("dono")
    expect(papelNaConversa(conversa, PARCEIRO)).toBe("parceiro")
  })

  it("devolve null pra quem não é parte — a trava é a RLS, isto é o texto da tela", () => {
    expect(papelNaConversa(conversa, ESTRANHO)).toBeNull()
    expect(idDoOutro(conversa, ESTRANHO)).toBeNull()
  })

  it("o outro é sempre o outro", () => {
    expect(idDoOutro(conversa, DONO)).toBe(PARCEIRO)
    expect(idDoOutro(conversa, PARCEIRO)).toBe(DONO)
  })
})

// ---------------------------------------------------------------------------
// Não lida é estado de QUEM LÊ — o teste que prova que as contagens divergem
// ---------------------------------------------------------------------------
describe("contarNaoLidas", () => {
  const thread = [
    msg({ autor_id: DONO, criado_em: "2026-08-19T10:00:00+00:00" }),
    msg({ autor_id: PARCEIRO, criado_em: "2026-08-19T11:00:00+00:00" }),
    msg({ autor_id: PARCEIRO, criado_em: "2026-08-19T12:00:00+00:00" }),
  ]

  it("as duas pessoas da MESMA conversa têm números diferentes", () => {
    // O dono leu até as 10:30 → as duas do parceiro estão por ler.
    expect(contarNaoLidas({ mensagens: thread, usuarioId: DONO, lidoAte: "2026-08-19T10:30:00+00:00" })).toBe(2)
    // O parceiro leu até as 11:30 → a única do dono já foi lida antes disso.
    expect(contarNaoLidas({ mensagens: thread, usuarioId: PARCEIRO, lidoAte: "2026-08-19T11:30:00+00:00" })).toBe(0)
  })

  it("as minhas nunca contam — badge que sobe quando eu escrevo ensina a ignorar o badge", () => {
    expect(contarNaoLidas({ mensagens: thread, usuarioId: PARCEIRO, lidoAte: null })).toBe(1)
  })

  it("sem marca nenhuma, tudo do outro conta: nunca abri, não li nada", () => {
    expect(contarNaoLidas({ mensagens: thread, usuarioId: DONO, lidoAte: null })).toBe(2)
  })

  it("a marca exatamente no carimbo da mensagem já a considera lida", () => {
    expect(contarNaoLidas({ mensagens: thread, usuarioId: DONO, lidoAte: "2026-08-19T12:00:00+00:00" })).toBe(0)
  })

  it("mensagem apagada continua contando — a linha existe na thread e o outro precisa saber", () => {
    const comApagada = [
      msg({ autor_id: PARCEIRO, criado_em: "2026-08-19T13:00:00+00:00", corpo: "", apagada_em: "2026-08-19T13:05:00+00:00" }),
    ]
    expect(contarNaoLidas({ mensagens: comApagada, usuarioId: DONO, lidoAte: null })).toBe(1)
  })

  it("carimbo ilegível não conta — avisar a menos é melhor que um badge fantasma que nunca zera", () => {
    const quebrada = [msg({ autor_id: PARCEIRO, criado_em: "nao-e-data" })]
    expect(contarNaoLidas({ mensagens: quebrada, usuarioId: DONO, lidoAte: "2026-08-19T10:00:00+00:00" })).toBe(0)
  })

  it("conversa sem mensagem nenhuma é zero, não erro", () => {
    expect(contarNaoLidas({ mensagens: [], usuarioId: DONO, lidoAte: null })).toBe(0)
  })
})

describe("rotuloNaoLidas — null nunca vira zero desenhado", () => {
  it("zero não desenha nada", () => {
    expect(rotuloNaoLidas(0)).toBeNull()
    expect(rotuloNaoLidas(-3)).toBeNull()
    expect(rotuloNaoLidas(Number.NaN)).toBeNull()
  })

  it("conta até 99 e depois para de fingir precisão", () => {
    expect(rotuloNaoLidas(1)).toBe("1")
    expect(rotuloNaoLidas(99)).toBe("99")
    expect(rotuloNaoLidas(100)).toBe("99+")
  })
})

describe("marcaDeLeitura", () => {
  it("marca pela última mensagem RECEBIDA, não pelo relógio — senão a que chega no mesmo segundo some sem ser vista", () => {
    const thread = [
      msg({ autor_id: DONO, criado_em: "2026-08-19T10:00:00+00:00" }),
      msg({ autor_id: PARCEIRO, criado_em: "2026-08-19T12:00:00+00:00" }),
    ]
    expect(marcaDeLeitura(thread)).toBe("2026-08-19T12:00:00+00:00")
  })

  it("conversa vazia não produz marca", () => {
    expect(marcaDeLeitura([])).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// A linha da caixa de entrada
// ---------------------------------------------------------------------------
describe("previaDaConversa", () => {
  it("marca a própria mensagem com 'Você:' — é o que responde 'a bola está comigo?' sem abrir", () => {
    const minha = msg({ autor_id: DONO, criado_em: "2026-08-19T10:00:00+00:00", corpo: "fecho por 1.800" })
    expect(previaDaConversa(minha, DONO)).toBe("Você: fecho por 1.800")
    expect(previaDaConversa(minha, PARCEIRO)).toBe("fecho por 1.800")
  })

  it("achata a quebra de linha — a prévia é uma linha só", () => {
    const varias = msg({ autor_id: PARCEIRO, criado_em: "2026-08-19T10:00:00+00:00", corpo: "6,40/L\n1500 L" })
    expect(previaDaConversa(varias, DONO)).toBe("6,40/L 1500 L")
  })

  it("apagada mostra a marca, não o vazio", () => {
    const apagada = msg({
      autor_id: PARCEIRO, criado_em: "2026-08-19T10:00:00+00:00", corpo: "", apagada_em: "2026-08-19T10:05:00+00:00",
    })
    expect(previaDaConversa(apagada, DONO)).toBe(TEXTO_MENSAGEM_APAGADA)
  })

  it("conversa sem mensagem devolve null — quem chama escreve a frase do vazio", () => {
    expect(previaDaConversa(null, DONO)).toBeNull()
  })
})

describe("ultimaMensagem", () => {
  it("acha a mais recente mesmo com a lista fora de ordem", () => {
    const fora = [
      msg({ id: "b", autor_id: DONO, criado_em: "2026-08-19T12:00:00+00:00" }),
      msg({ id: "a", autor_id: PARCEIRO, criado_em: "2026-08-19T09:00:00+00:00" }),
    ]
    expect(ultimaMensagem(fora)?.id).toBe("b")
  })

  it("lista vazia devolve null", () => {
    expect(ultimaMensagem([])).toBeNull()
  })
})

describe("ordenarConversas", () => {
  it("a que mexeu por último vem primeiro", () => {
    const lista = [
      { id: "velha", ultima_mensagem_em: "2026-08-10T10:00:00+00:00" },
      { id: "nova", ultima_mensagem_em: "2026-08-19T10:00:00+00:00" },
    ]
    expect(ordenarConversas(lista).map((c) => c.id)).toEqual(["nova", "velha"])
  })

  it("empate desempata por id — ordem total pro React não remontar linha à toa", () => {
    const mesmoInstante = [
      { id: "b", ultima_mensagem_em: "2026-08-19T10:00:00+00:00" },
      { id: "a", ultima_mensagem_em: "2026-08-19T10:00:00+00:00" },
    ]
    expect(ordenarConversas(mesmoInstante).map((c) => c.id)).toEqual(["a", "b"])
  })

  it("não mexe na lista que recebeu", () => {
    const lista = [
      { id: "velha", ultima_mensagem_em: "2026-08-10T10:00:00+00:00" },
      { id: "nova", ultima_mensagem_em: "2026-08-19T10:00:00+00:00" },
    ]
    ordenarConversas(lista)
    expect(lista[0].id).toBe("velha")
  })
})

// ---------------------------------------------------------------------------
// A thread
// ---------------------------------------------------------------------------
describe("agruparPorDia", () => {
  it("quebra por dia civil e preserva a ordem de dentro", () => {
    const thread = [
      msg({ id: "1", autor_id: DONO, criado_em: "2026-08-18T13:00:00+00:00" }),
      msg({ id: "2", autor_id: PARCEIRO, criado_em: "2026-08-18T14:00:00+00:00" }),
      msg({ id: "3", autor_id: DONO, criado_em: "2026-08-19T09:00:00+00:00" }),
    ]
    const dias = agruparPorDia(thread, diaCivilSP)
    expect(dias.map((d) => d.dia)).toEqual(["2026-08-18", "2026-08-19"])
    expect(dias[0].mensagens.map((m) => m.id)).toEqual(["1", "2"])
    expect(dias[1].mensagens.map((m) => m.id)).toEqual(["3"])
  })

  it("usa o fuso da marina, não o UTC — 23h de SP é o mesmo dia, não o seguinte", () => {
    // 2026-08-19T02:00:00Z = 23:00 de 18/08 em America/Sao_Paulo.
    const thread = [
      msg({ id: "noite", autor_id: DONO, criado_em: "2026-08-19T02:00:00+00:00" }),
    ]
    expect(agruparPorDia(thread, diaCivilSP)[0].dia).toBe("2026-08-18")
  })

  it("thread vazia não inventa um dia", () => {
    expect(agruparPorDia([], diaCivilSP)).toEqual([])
  })
})

describe("podeApagar", () => {
  it("só a própria, e só uma vez", () => {
    const minha = msg({ autor_id: DONO, criado_em: "2026-08-19T10:00:00+00:00" })
    expect(podeApagar(minha, DONO)).toBe(true)
    expect(podeApagar(minha, PARCEIRO)).toBe(false)
  })

  it("apagada não apaga de novo", () => {
    const apagada = msg({
      autor_id: DONO, criado_em: "2026-08-19T10:00:00+00:00", corpo: "", apagada_em: "2026-08-19T10:05:00+00:00",
    })
    expect(podeApagar(apagada, DONO)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// A porta, na ficha do pedido
// ---------------------------------------------------------------------------
describe("podeConversar", () => {
  const base = { donoId: DONO, parceiroId: PARCEIRO, statusProposta: "enviada" }

  it("abre pros dois lados — combinar é o passo ANTES de aceitar", () => {
    expect(podeConversar({ ...base, usuarioId: DONO })).toBe(true)
    expect(podeConversar({ ...base, usuarioId: PARCEIRO })).toBe(true)
  })

  it("não abre pra terceiro", () => {
    expect(podeConversar({ ...base, usuarioId: ESTRANHO })).toBe(false)
  })

  it("proposta retirada fecha a porta — quem retirou desistiu do negócio", () => {
    expect(podeConversar({ ...base, usuarioId: DONO, statusProposta: "retirada" })).toBe(false)
  })

  it("continua aberta depois de recusada e de aceita — o registro do combinado não some com o desfecho", () => {
    expect(podeConversar({ ...base, usuarioId: DONO, statusProposta: "recusada" })).toBe(true)
    expect(podeConversar({ ...base, usuarioId: PARCEIRO, statusProposta: "aceita" })).toBe(true)
  })
})
