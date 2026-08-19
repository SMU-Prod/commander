import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * A MENTIRA DE "SALVO" FORA DO ENTERPRISE — varredura de 19/08.
 *
 * `enterprise.test.ts` prova o defeito nas actions do Enterprise. Este arquivo
 * é o mesmo teste aplicado ao resto de `lib/acoes`, e existe porque a falha não
 * é de um módulo: é do formato de resposta do PostgREST. Quando uma policy
 * recusa, `error` vem NULO e `data` vem VAZIO — uma action que só olha `error`
 * conclui que deu certo, redireciona com a frase de sucesso, e a pessoa vai
 * embora achando que gravou.
 *
 * Todo caso aqui alimenta a fila com `{ data: [], error: null }`, que é a
 * assinatura exata dessa recusa, e afirma duas coisas sobre a URL final: que
 * ela NÃO diz que aconteceu, e que a frase que ela mostra no lugar não inventa
 * a causa — porque nenhuma dessas actions tem como saber se foi a policy, um
 * erro do banco ou a linha ter mudado debaixo dela.
 */

type Resposta = { data: unknown; error: unknown }

interface Encadeada {
  select: () => Encadeada
  eq: () => Encadeada
  is: () => Encadeada
  update: (valores: unknown) => Encadeada
  insert: (valores: unknown) => Encadeada
  delete: () => Encadeada
  maybeSingle: () => Promise<Resposta>
  single: () => Promise<Resposta>
  then: (ok: (r: Resposta) => unknown, falha?: (e: unknown) => unknown) => Promise<unknown>
}

const duble = vi.hoisted(() => {
  class ErroDeRedirect extends Error {
    url: string
    constructor(url: string) {
      super(`NEXT_REDIRECT ${url}`)
      this.url = url
    }
  }
  return {
    ErroDeRedirect,
    fila: {} as Record<string, Resposta[]>,
    /** Papel do painel — algumas actions só chegam à escrita sendo PROP. */
    papel: "PROP",
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
    papel: duble.papel,
    permissoes: {},
    itens: [],
    equipamentos: [],
  }),
  carregarNivelPlano: async () => "premium",
  carregarUsoTripulacao: async () => ({ vinculos: 0, convites: 0 }),
  hojeISO: () => "2026-08-19",
}))

vi.mock("@/lib/supabase/server", () => {
  const consulta = (tabela: string, resposta: Resposta): Encadeada => {
    const chain: Encadeada = {
      select: () => chain,
      eq: () => chain,
      is: () => chain,
      update: () => chain,
      insert: () => chain,
      delete: () => chain,
      maybeSingle: async () => resposta,
      single: async () => resposta,
      then: (ok, falha) => Promise.resolve(resposta).then(ok, falha),
    }
    void tabela
    return chain
  }
  return {
    supabaseServer: async () => ({
      auth: { getUser: async () => ({ data: { user: { id: "u-dono", email: "dono@exemplo.com" } } }) },
      from: (tabela: string) =>
        consulta(tabela, duble.fila[tabela]?.shift() ?? { data: null, error: null }),
    }),
  }
})

import { avaliarContato, excluirContato } from "./contatos"
import { revogarConvite } from "./convites"
import { definirCotas, redefinirLink } from "./cotistas"
import { salvarLocalMarina } from "./local"
import { cancelarTransferencia } from "./transferencia"

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
  throw new Error("a action não redirecionou — todas elas terminam em redirect")
}

/** A recusa da RLS como ela chega de verdade: sem erro, sem linha. */
const RECUSADA: Resposta = { data: [], error: null }

beforeEach(() => {
  duble.fila = {}
  duble.papel = "PROP"
})

describe("salvarLocalMarina", () => {
  it("posição recusada não manda a pessoa pro /hoje como se tivesse salvado", async () => {
    // `embarcacao: prop edita` recusa quem não é dono, e esta tela abre para
    // quem tem acesso à embarcação. O desfecho antigo era o pior possível:
    // redirect limpo pro /hoje, com o mapa exatamente onde estava.
    duble.fila.embarcacoes = [RECUSADA]

    const url = await destino(salvarLocalMarina(formulario({ lat: "-23,5", lon: "-45,1" })))
    expect(url).toContain("erro=")
    expect(url).toContain("posição não foi salva")
  })

  it("coordenada inválida continua sendo barrada antes de qualquer escrita", async () => {
    // Contraprova: o conserto não podia engolir a validação que já existia.
    const url = await destino(salvarLocalMarina(formulario({ lat: "999", lon: "-45,1" })))
    expect(url).toContain("não existem no mapa")
  })
})

describe("contatos", () => {
  it("nota recusada não volta pra lista em silêncio", async () => {
    duble.fila.contatos = [RECUSADA]

    const url = await destino(avaliarContato(formulario({ contato_id: "c-1", avaliacao: "5" })))
    expect(url).toContain("erro=")
    expect(url).toContain("nota não foi salva")
  })

  it("exclusão recusada não vira lista recarregada sem explicação", async () => {
    // Sem isto o contato reaparecia depois do "excluir" como se a página não
    // tivesse recarregado — e a pessoa clicava de novo, para sempre.
    duble.fila.contatos = [RECUSADA]

    const url = await destino(excluirContato(formulario({ contato_id: "c-1" })))
    expect(url).toContain("erro=")
    expect(url).toContain("não foi excluído")
  })
})

describe("revogarConvite", () => {
  it("convite que não saiu não vira tela de sucesso", async () => {
    duble.fila.convites = [RECUSADA]

    const url = await destino(revogarConvite(formulario({ convite_id: "cv-1" })))
    expect(url).toContain("erro=")
    expect(url).toContain("não foi revogado")
  })

  it("a frase serve tanto pra recusa quanto pro convite já aceito", () => {
    // As duas causas chegam idênticas — zero linha, sem erro — porque o filtro
    // `is("usado_em", null)` deixa de casar quando alguém aceita no intervalo.
    // Uma frase que escolhesse uma das duas estaria errada metade das vezes.
    duble.fila.convites = [RECUSADA]

    return destino(revogarConvite(formulario({ convite_id: "cv-1" }))).then((url) => {
      expect(url).not.toContain("acesso")
      expect(url).not.toContain("permiss")
      expect(url).toContain("em que pé ele está")
    })
  })
})

describe("cotistas", () => {
  it("cotas recusadas não viram 'Cotas atualizadas'", async () => {
    duble.fila.embarcacoes = [RECUSADA]

    const url = await destino(definirCotas(formulario({ cotas_total: "10" })))
    expect(url).toContain("erro=")
    expect(url).not.toContain("Cotas atualizadas")
  })

  it("link novo recusado não vira 'Link novo gerado'", async () => {
    // O pior desfecho deste: a pessoa distribui o link ANTIGO acreditando que
    // ele foi trocado — exatamente o contrário do que ela pediu.
    duble.fila.convites_cotista = [
      { data: null, error: null },
      RECUSADA,
    ]

    const url = await destino(redefinirLink())
    expect(url).toContain("erro=")
    expect(url).not.toContain("Link novo gerado")
  })

  it("quem não é dono nem chega à escrita", async () => {
    duble.papel = "CMDT"

    const url = await destino(definirCotas(formulario({ cotas_total: "10" })))
    expect(url).toContain("Só o proprietário")
  })
})

describe("cancelarTransferencia", () => {
  it("cancelamento que não pegou linha não vira tela limpa", async () => {
    duble.fila.transferencias = [RECUSADA]

    const url = await destino(cancelarTransferencia(formulario({ transferencia_id: "t-1" })))
    expect(url).toContain("erro=")
    expect(url).toContain("não foi cancelada")
  })
})
