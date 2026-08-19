import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * `atribuirAfazer` PROVADA — AUDITORIA 19/08, A16.
 *
 * Esta é a única action do Enterprise cujo acerto NÃO se confere lendo o
 * código, e são três razões distintas:
 *
 * 1. O SILÊNCIO DA RLS. A policy de UPDATE de `afazeres` (migration 069) tem
 *    `with check (dono_id = uid or responsavel_id = uid)` avaliado sobre a
 *    linha NOVA — quem está com a tarefa sem tê-la criado e a passa adiante
 *    deixa de casar com o predicado no instante em que grava. O Postgres
 *    recusa, o PostgREST devolve ZERO LINHA e `error` vem `null`. Um teste que
 *    só olhasse `error` daria verde para uma tela que mente "passei".
 * 2. O `null` QUE NÃO PODE VIRAR OUTRA COISA. "Ninguém" é resposta legítima do
 *    §20, e o teste abaixo lê o objeto que foi para o `.update()` — não a
 *    frase de sucesso — porque é lá que um `?? algumaCoisa` mal colocado
 *    inventaria um responsável.
 * 3. A RECUSA TEM QUE VIR ANTES DA ESCRITA. A policy de UPDATE, ao contrário
 *    da de INSERT, NÃO confere o vínculo do novo responsável: quem segura essa
 *    porta é `recusaDoResponsavel`, do lado do app. Se ela passar a ser
 *    chamada depois do `update` (ou deixar de ser chamada), nada quebra na
 *    tela — só volta a brecha 1 da migration 069, de carimbar tarefa na lista
 *    de um estranho. Por isso as asserções desses casos são sobre o `.update()`
 *    NÃO ter acontecido, no mesmo espírito de `auth.test.ts`.
 *
 * O dublê imita o encadeamento do PostgREST (`.select().eq().maybeSingle()`,
 * `.update().eq().select()`) com uma fila de respostas POR TABELA: a ordem em
 * que a action consulta é parte do que se está afirmando.
 */

/** O formato de toda resposta do PostgREST — `data` e `error`, nunca um só. */
type Resposta = { data: unknown; error: unknown }

/** O encadeamento é `thenable`: `await consulta.eq(...)` resolve na resposta,
 *  igual ao builder de verdade. */
interface Encadeada {
  select: () => Encadeada
  eq: () => Encadeada
  is: () => Encadeada
  order: () => Encadeada
  limit: () => Encadeada
  update: (valores: unknown) => Encadeada
  insert: (valores: unknown) => Encadeada
  maybeSingle: () => Promise<Resposta>
  single: () => Promise<Resposta>
  then: (ok: (r: Resposta) => unknown, falha?: (e: unknown) => unknown) => Promise<unknown>
}

const duble = vi.hoisted(() => {
  /** O `redirect` do Next LANÇA para interromper a action no meio — o dublê
   *  imita isso carregando a URL junto, que é o que permite afirmar sobre o
   *  destino em vez de sobre efeito colateral. */
  class ErroDeRedirect extends Error {
    url: string
    constructor(url: string) {
      super(`NEXT_REDIRECT ${url}`)
      this.url = url
    }
  }
  return {
    ErroDeRedirect,
    /** Respostas a devolver, por tabela, consumidas na ordem das chamadas. */
    fila: {} as Record<string, { data: unknown; error: unknown }[]>,
    /** Tudo que passou por um `.update()` — a prova do `null`. */
    updates: [] as unknown[],
    /** Tabelas que receberam `.insert()`, na ordem — é assim que se afirma que
     *  uma escrita NÃO aconteceu depois de outra ter sido recusada. */
    inserts: [] as { tabela: string; valores: unknown }[],
  }
})

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new duble.ErroDeRedirect(url)
  },
}))

vi.mock("next/cache", () => ({ revalidatePath: () => undefined }))

vi.mock("@/lib/consultas", () => ({
  carregarPainel: async () => ({
    embarcacao: { id: "emb-1", nome: "Jet 1" },
    embarcacoes: [],
    papel: "PROP",
  }),
  hojeISO: () => "2026-08-19",
}))

vi.mock("@/lib/supabase/server", () => {
  const consulta = (tabela: string, resposta: Resposta): Encadeada => {
    const chain: Encadeada = {
      select: () => chain,
      eq: () => chain,
      is: () => chain,
      order: () => chain,
      limit: () => chain,
      update: (valores) => {
        duble.updates.push(valores)
        return chain
      },
      insert: (valores) => {
        duble.inserts.push({ tabela, valores })
        return chain
      },
      maybeSingle: async () => resposta,
      single: async () => resposta,
      then: (ok, falha) => Promise.resolve(resposta).then(ok, falha),
    }
    return chain
  }
  return {
    supabaseServer: async () => ({
      auth: { getUser: async () => ({ data: { user: { id: "u-dono" } } }) },
      from: (tabela: string) =>
        consulta(tabela, duble.fila[tabela]?.shift() ?? { data: null, error: null }),
    }),
  }
})

import {
  abrirServico, atribuirAfazer, criarItemEstoque, enviarAoAdm, movimentarEstoque, votar,
} from "./enterprise"

function formulario(campos: Record<string, string>): FormData {
  const f = new FormData()
  for (const [chave, valor] of Object.entries(campos)) f.set(chave, valor)
  return f
}

/** A URL do redirect, já decodificada — as frases viajam em `encodeURIComponent`. */
async function destino(promessa: Promise<unknown>): Promise<string> {
  try {
    await promessa
  } catch (e) {
    if (e instanceof duble.ErroDeRedirect) return decodeURIComponent(e.url)
    throw e
  }
  throw new Error("a action não redirecionou — ela sempre termina em redirect")
}

/** A tarefa como ela volta do banco na primeira consulta da action. */
function tarefa(campos: { embarcacaoId?: string | null; responsavelId?: string | null }): Resposta {
  return {
    data: {
      dono_id: "u-dono",
      embarcacao_id: campos.embarcacaoId === undefined ? "emb-1" : campos.embarcacaoId,
      responsavel_id: campos.responsavelId ?? null,
    },
    error: null,
  }
}

describe("atribuirAfazer (A16)", () => {
  beforeEach(() => {
    duble.fila = {}
    duble.updates = []
    duble.inserts = []
  })

  it("'Ninguém' grava null — a action não inventa um responsável", () => {
    duble.fila.afazeres = [tarefa({ responsavelId: "u-marcos" }), { data: [{ id: "t-1" }], error: null }]

    return destino(atribuirAfazer(formulario({ afazer_id: "t-1", responsavel_id: "" })))
      .then((url) => {
        // O que importa é o objeto que foi pro banco, não a frase da tela.
        expect(duble.updates).toEqual([{ responsavel_id: null }])
        expect(url).toContain("sem responsável")
      })
  })

  it("passa a tarefa para quem tem vínculo ativo", async () => {
    duble.fila.afazeres = [tarefa({}), { data: [{ id: "t-1" }], error: null }]
    duble.fila.vinculos = [{ data: [{ usuario_id: "u-marcos" }], error: null }]

    const url = await destino(atribuirAfazer(formulario({ afazer_id: "t-1", responsavel_id: "u-marcos" })))
    expect(duble.updates).toEqual([{ responsavel_id: "u-marcos" }])
    expect(url).toContain("ok=")
  })

  it("recusa quem não tem vínculo ativo ANTES de escrever", async () => {
    // Sem esta trava volta a brecha 1 da migration 069: a policy de UPDATE não
    // confere o vínculo do novo responsável, então bastaria um uuid qualquer
    // para injetar tarefa na lista de um estranho.
    duble.fila.afazeres = [tarefa({})]
    duble.fila.vinculos = [{ data: [{ usuario_id: "u-marcos" }], error: null }]

    const url = await destino(atribuirAfazer(formulario({ afazer_id: "t-1", responsavel_id: "u-estranho" })))
    expect(duble.updates).toEqual([])
    expect(url).toContain("erro=")
    expect(url).toContain("acesso ativo")
  })

  it("tarefa da base recusa com o motivo do domínio, sem tentar a escrita", async () => {
    // `embarcacao_id` nulo faz o EXISTS da policy comparar com NULL e nunca
    // casar — a recusa sai daqui com explicação, não do banco sem nenhuma.
    duble.fila.afazeres = [tarefa({ embarcacaoId: null })]

    const url = await destino(atribuirAfazer(formulario({ afazer_id: "t-1", responsavel_id: "u-marcos" })))
    expect(duble.updates).toEqual([])
    expect(url).toContain("Tarefa da base")
  })

  it("escrita barrada pela RLS não vira 'passei' na tela", async () => {
    // O caso que só este teste pega: zero linha com `error` nulo.
    duble.fila.afazeres = [tarefa({}), { data: [], error: null }]
    duble.fila.vinculos = [{ data: [{ usuario_id: "u-marcos" }], error: null }]

    const url = await destino(atribuirAfazer(formulario({ afazer_id: "t-1", responsavel_id: "u-marcos" })))
    expect(url).toContain("erro=")
    expect(url).toContain("Quem repassa")
  })

  it("reenviar a mesma pessoa não vira recusa absurda", async () => {
    // Quem foi suspenso DEPOIS de receber a tarefa continua na lista do
    // seletor (o cartão precisa mostrar quem está com ela). Sem o atalho de
    // "nada mudou", reenviar o formulário sem tocar em nada seria recusado por
    // "essa pessoa não tem acesso ativo" — correto na regra, absurdo na tela.
    duble.fila.afazeres = [tarefa({ responsavelId: "u-suspenso" })]

    const url = await destino(atribuirAfazer(formulario({ afazer_id: "t-1", responsavel_id: "u-suspenso" })))
    expect(duble.updates).toEqual([])
    expect(url).toContain("Nada mudou")
  })

  it("tarefa que não existe (ou que a RLS esconde) não segue para a escrita", async () => {
    duble.fila.afazeres = [{ data: null, error: null }]

    const url = await destino(atribuirAfazer(formulario({ afazer_id: "t-9", responsavel_id: "u-marcos" })))
    expect(duble.updates).toEqual([])
    expect(url).toContain("não encontrada")
  })
})

/**
 * O RESTO DO ENTERPRISE PELA MESMA RÉGUA — varredura de 19/08.
 *
 * Todas as escritas abaixo tinham a mesma falha da A16 e nenhuma tinha teste:
 * checavam só `error` e, como policy recusada devolve `error: null` com zero
 * linha, anunciavam sucesso. A fila do dublê devolve `{ data: [], error: null }`
 * — a assinatura EXATA de uma recusa da RLS no PostgREST — e o que se afirma é
 * sempre a mesma coisa: a URL final não pode dizer que aconteceu.
 */
describe("escrita recusada pela RLS não vira sucesso na tela", () => {
  beforeEach(() => {
    duble.fila = {}
    duble.updates = []
    duble.inserts = []
  })

  it("o voto que a policy recusa não vira 'Voto registrado'", async () => {
    // O pior lugar para uma escrita mentir: a decisão se apura por contagem, e
    // um voto que não existe não aparece em recontagem nenhuma. As cinco travas
    // de `votos: cotista vota uma vez, em nome proprio` — suspenso, não-cotista,
    // urna fechada — chegam todas assim, sem `error`.
    duble.fila.votos = [{ data: [], error: null }]

    const url = await destino(votar(formulario({ votacao_id: "v-1", voto: "sim" })))
    expect(url).toContain("erro=")
    expect(url).not.toContain("Voto registrado")
    expect(url).toContain("votação ainda está aberta")
  })

  it("voto repetido continua com a frase do 23505, e não com a da recusa", async () => {
    // A duplicata é a única causa que a action SABE nomear, porque vem com
    // código. Ela não pode ser engolida pela frase genérica nova.
    duble.fila.votos = [{ data: null, error: { code: "23505" } }]

    const url = await destino(votar(formulario({ votacao_id: "v-1", voto: "sim" })))
    expect(url).toContain("Você já votou")
  })

  it("saldo de estoque recusado interrompe ANTES de gravar o movimento", async () => {
    // A ordem é o que se afirma aqui. Com a recusa engolida, a action seguia:
    // gravava o movimento e lançava o custo de uma retirada que não saiu da
    // prateleira — três escritas contando uma história que o saldo desmente.
    duble.fila.estoque_itens = [
      { data: { quantidade: 10, nome: "Filtro", custo_unitario_centavos: 5000 }, error: null },
      { data: [], error: null },
    ]

    const url = await destino(movimentarEstoque(formulario({ item_id: "i-1", tipo: "retirada", quantidade: "2" })))
    expect(duble.inserts).toEqual([])
    expect(url).toContain("erro=")
    expect(url).toContain("estoque não foi atualizado")
  })

  it("custo recusado no Financeiro é dito na frase, não escondido atrás de 'lançado'", async () => {
    // O achado central de `lancarCustoComOrigem`: ela devolvia "lancado" para
    // `error` nulo, que é justamente como a recusa chega. `/frota` ficava com o
    // custo faltando e a tela dizia que ele tinha entrado.
    duble.fila.estoque_itens = [
      { data: { quantidade: 10, nome: "Filtro", custo_unitario_centavos: 5000 }, error: null },
      { data: [{ id: "i-1" }], error: null },
    ]
    duble.fila.estoque_movimentos = [{ data: { id: "m-1" }, error: null }]
    duble.fila.lancamentos_financeiros = [{ data: [], error: null }]

    const url = await destino(movimentarEstoque(formulario({ item_id: "i-1", tipo: "retirada", quantidade: "2" })))
    expect(url).toContain("Estoque atualizado")
    expect(url).toContain("NÃO entrou no Financeiro")
  })

  it("custo aceito continua dizendo que entrou", async () => {
    // A contraprova: o conserto não podia transformar sucesso em aviso.
    duble.fila.estoque_itens = [
      { data: { quantidade: 10, nome: "Filtro", custo_unitario_centavos: 5000 }, error: null },
      { data: [{ id: "i-1" }], error: null },
    ]
    duble.fila.estoque_movimentos = [{ data: { id: "m-1" }, error: null }]
    duble.fila.lancamentos_financeiros = [{ data: [{ id: "l-1" }], error: null }]

    const url = await destino(movimentarEstoque(formulario({ item_id: "i-1", tipo: "retirada", quantidade: "2" })))
    expect(url).toContain("ok=")
    expect(url).toContain("custo lançado no Financeiro")
  })

  it("movimento recusado é contado na frase, mesmo com o saldo já gravado", async () => {
    // O saldo passou e não dá pra desfazer; o histórico do almoxarifado não. A
    // única saída honesta é dizer as duas coisas.
    duble.fila.estoque_itens = [
      { data: { quantidade: 10, nome: "Filtro", custo_unitario_centavos: null }, error: null },
      { data: [{ id: "i-1" }], error: null },
    ]
    duble.fila.estoque_movimentos = [{ data: null, error: null }]

    const url = await destino(movimentarEstoque(formulario({ item_id: "i-1", tipo: "entrada", quantidade: "2" })))
    expect(url).toContain("Estoque atualizado")
    expect(url).toContain("NÃO entrou no histórico")
  })

  it("item de estoque recusado não vira 'Item cadastrado'", async () => {
    duble.fila.estoque_itens = [{ data: [], error: null }]

    const url = await destino(criarItemEstoque(formulario({ nome: "Filtro de óleo" })))
    expect(url).toContain("erro=")
    expect(url).not.toContain("Item cadastrado")
  })

  it("serviço recusado não vira 'Serviço aberto' — e a frase não chuta a causa", async () => {
    // A frase antiga mandava conferir o acesso a Motores. Este `if` também pega
    // erro de banco, e mandar a pessoa para o lugar errado com ar de certeza é
    // o vício que a casa já corrigiu duas vezes.
    duble.fila.servicos_mecanica = [{ data: [], error: null }]

    const url = await destino(abrirServico(formulario({ problema_informado: "Motor falhando" })))
    expect(url).toContain("erro=")
    expect(url).not.toContain("Serviço aberto")
    expect(url).not.toContain("acesso a Motores")
  })

  it("envio do cotista recusado não vira 'Enviado à administradora'", async () => {
    // O cotista suspenso continua com /atualizacoes aberta no navegador: ele
    // escrevia, o banco recusava calado, e do lado dele ficava "enviado".
    duble.fila.envios_cotista = [{ data: [], error: null }]

    const url = await destino(enviarAoAdm(formulario({ texto: "Motor com barulho estranho" })))
    expect(url).toContain("erro=")
    expect(url).not.toContain("Enviado à administradora")
  })
})
