import { describe, expect, it } from "vitest"
import {
  COLUNAS_IMPORTACAO,
  converterEmAfazer,
  DESTINOS_AFAZER,
  ESTADOS_AFAZER,
  importacaoVazia,
  lerPlanilha,
  podeCriarAfazerProprio,
  resumoDaImportacao,
  ROTULO_DESTINO_AFAZER,
  ROTULO_ESTADO_AFAZER,
  validarImportacao,
  type LinhaImportada,
} from "./afazeres"

const linha = (over: Partial<LinhaImportada> & { linha: number }): LinhaImportada => ({
  nome: "Jet 01", tipo: "jet", marca: null, modelo: null, ano: null, serial: null, horas: null,
  ...over,
})

describe("afazeres (§20)", () => {
  it("todo estado e todo destino têm rótulo", () => {
    for (const e of ESTADOS_AFAZER) expect(ROTULO_ESTADO_AFAZER[e], e).toBeTruthy()
    for (const d of DESTINOS_AFAZER) expect(ROTULO_DESTINO_AFAZER[d], d).toBeTruthy()
  })

  describe("quem cria tarefa própria", () => {
    it("ADM e dono criam sempre", () => {
      expect(podeCriarAfazerProprio("ADM", "tudo")).toBe(true)
      expect(podeCriarAfazerProprio("ADM_GERAL", "tudo")).toBe(true)
      expect(podeCriarAfazerProprio("PROP", "tudo")).toBe(true)
    })

    it("Operações só cria se estiver sem aprovação — a régua do §3, reusada", () => {
      // Reusar a régua de confiança que já existe é o que impede o
      // Enterprise de ter dois sistemas de permissão concorrentes.
      expect(podeCriarAfazerProprio("OPERACOES", "sem_aprovacao")).toBe(true)
      expect(podeCriarAfazerProprio("OPERACOES", "somente_criticos")).toBe(false)
      expect(podeCriarAfazerProprio("OPERACOES", "tudo")).toBe(false)
    })

    it("cotista não cria tarefa nenhuma", () => {
      expect(podeCriarAfazerProprio("COTISTA", "sem_aprovacao")).toBe(false)
    })
  })

  /* "ALERTA NÃO VIRA AFAZER SOZINHO — §20" saiu junto com
     `alertaViraAfazerAutomaticamente` (auditoria 19/08). Ele media uma função
     que devolvia o literal `false`: a regra não estava sendo garantida por
     ela, e sim pela ausência de qualquer gatilho ligando alerta a `afazeres`.
     O que resta abaixo é o que de fato existe — a conversão que passa por
     alguém. */

  describe("conversão manual", () => {
    it("avaria vira 'Resolver'", () => {
      expect(converterEmAfazer({ tipo: "avaria", titulo: "Impeller batendo" }, "mecanica"))
        .toEqual({ titulo: "Resolver: Impeller batendo", destino: "mecanica" })
    })

    it("manutenção vira 'Executar'", () => {
      expect(converterEmAfazer({ tipo: "manutencao", titulo: "Troca de óleo" }, "operacoes").titulo)
        .toBe("Executar: Troca de óleo")
    })
  })
})

describe("importação de frota (§21)", () => {
  it("as colunas sugeridas do §21 estão nomeadas", () => {
    expect(COLUNAS_IMPORTACAO).toContain("nome")
    expect(COLUNAS_IMPORTACAO).toContain("horas")
    expect(COLUNAS_IMPORTACAO).toContain("proxima_revisao")
  })

  it("só o nome é obrigatório — igual ao onboarding de um barco avulso", () => {
    // Exigir mais na importação faria a empresa grande ter mais trabalho
    // que a pequena, o oposto do que o §21 quer.
    const r = validarImportacao([linha({ linha: 2, nome: "Jet 07" })])
    expect(r.validas).toHaveLength(1)
    expect(r.erros).toHaveLength(0)
  })

  it("linha sem nome vira erro apontando a linha", () => {
    const r = validarImportacao([linha({ linha: 5, nome: "   " })])
    expect(r.validas).toHaveLength(0)
    expect(r.erros[0]).toEqual({ linha: 5, problema: "Sem nome da unidade." })
  })

  it("nome repetido é ERRO e diz onde apareceu antes", () => {
    // Duas "Jet 01" na mesma frota tornam impossível saber qual saiu do
    // pátio. E "nome duplicado" sem número, numa planilha de 40 linhas,
    // é inútil.
    const r = validarImportacao([
      linha({ linha: 2, nome: "Jet 01" }),
      linha({ linha: 9, nome: "Jet 01" }),
    ])
    expect(r.validas).toHaveLength(1)
    expect(r.erros[0].linha).toBe(9)
    expect(r.erros[0].problema).toContain("linha 2")
  })

  it("repetição ignora caixa e espaço — 'jet 01' e 'Jet 01 ' são o mesmo barco", () => {
    const r = validarImportacao([
      linha({ linha: 2, nome: "Jet 01" }),
      linha({ linha: 3, nome: " jet 01 " }),
    ])
    expect(r.validas).toHaveLength(1)
    expect(r.erros).toHaveLength(1)
  })

  it("ano absurdo e horas negativas não entram", () => {
    const r = validarImportacao([
      linha({ linha: 2, nome: "A", ano: 1200 }),
      linha({ linha: 3, nome: "B", horas: -5 }),
    ])
    expect(r.validas).toHaveLength(0)
    expect(r.erros).toHaveLength(2)
  })

  it("uma linha ruim não derruba as boas", () => {
    const r = validarImportacao([
      linha({ linha: 2, nome: "Jet 01" }),
      linha({ linha: 3, nome: null }),
      linha({ linha: 4, nome: "Jet 02" }),
    ])
    expect(r.validas.map((v) => v.nome)).toEqual(["Jet 01", "Jet 02"])
    expect(r.erros).toHaveLength(1)
  })

  describe("resumo antes de confirmar", () => {
    it("diz quantas entram, mesmo sem erro", () => {
      const r = validarImportacao([linha({ linha: 2, nome: "A" }), linha({ linha: 3, nome: "B" })])
      expect(resumoDaImportacao(r)).toBe("2 unidades prontas para importar.")
    })

    it("uma unidade fala no singular", () => {
      const r = validarImportacao([linha({ linha: 2, nome: "A" })])
      expect(resumoDaImportacao(r)).toBe("1 unidade pronta para importar.")
    })

    it("com erro, diz os dois números", () => {
      const r = validarImportacao([linha({ linha: 2, nome: "A" }), linha({ linha: 3, nome: null })])
      expect(resumoDaImportacao(r)).toBe("1 unidade pronta para importar · 1 linha com problema.")
    })

    it("planilha sem nada aproveitável é reconhecida", () => {
      const r = validarImportacao([linha({ linha: 2, nome: null })])
      expect(importacaoVazia(r)).toBe(true)
    })
  })

  // AUDITORIA 19/08, A9 — o validador acima existia e não havia por onde
  // entrar. `lerPlanilha` é o pedaço que faltava: o que a pessoa TEM é uma
  // planilha, e o que ela consegue fazer sem instalar nada é colar.
  describe("ler a planilha colada", () => {
    it("colagem direta do Excel (tabulação) com cabeçalho", () => {
      const r = lerPlanilha(
        "nome\ttipo\tmarca\tmodelo\tano\tserial\thoras\n" +
        "Jet 01\tjet\tSea-Doo\tGTX 170\t2022\tYDV12345\t118,5",
      )
      expect(r).toHaveLength(1)
      expect(r[0]).toMatchObject({
        nome: "Jet 01", tipo: "jet", marca: "Sea-Doo", modelo: "GTX 170",
        ano: 2022, serial: "YDV12345", horas: 118.5,
      })
    })

    it("o número da linha é o da PLANILHA, com o cabeçalho contado", () => {
      // Um erro em "linha 3" que aponte pra linha 2 da tela é pior que não
      // numerar: a pessoa procura no lugar errado numa planilha de 40 linhas.
      const r = lerPlanilha("nome\ttipo\nJet 01\tjet\nJet 02\tjet")
      expect(r.map((l) => l.linha)).toEqual([2, 3])
    })

    it("CSV brasileiro com ponto e vírgula", () => {
      // Brasil usa vírgula decimal, então o CSV exportado aqui vem com `;`.
      const r = lerPlanilha("nome;tipo;horas\nLancha A;lancha;1.240,5")
      expect(r[0].nome).toBe("Lancha A")
      expect(r[0].horas).toBe(1240.5)
    })

    it("CSV em inglês com vírgula e ponto decimal", () => {
      const r = lerPlanilha("nome,tipo,horas\nJet 01,jet,118.5")
      expect(r[0].horas).toBe(118.5)
    })

    it("sem cabeçalho, a primeira linha JÁ É DADO e não some", () => {
      const r = lerPlanilha("Jet 01\tjet\tSea-Doo")
      expect(r).toHaveLength(1)
      expect(r[0].nome).toBe("Jet 01")
      expect(r[0].linha).toBe(1)
    })

    it("uma unidade chamada 'Modelo 3' não é confundida com cabeçalho", () => {
      // O cabeçalho exige DUAS colunas reconhecidas justamente por isso —
      // tratar essa linha como título perderia um barco em silêncio.
      const r = lerPlanilha("Modelo 3\tjet")
      expect(r).toHaveLength(1)
      expect(r[0].nome).toBe("Modelo 3")
    })

    it("aceita os apelidos que a planilha do cliente traz", () => {
      const r = lerPlanilha("Unidade;Horímetro\nJet 01;220")
      expect(r[0].nome).toBe("Jet 01")
      expect(r[0].horas).toBe(220)
    })

    it("linha em branco no meio não vira unidade fantasma", () => {
      const r = lerPlanilha("nome\ttipo\nJet 01\tjet\n\nJet 02\tjet\n")
      expect(r.map((l) => l.nome)).toEqual(["Jet 01", "Jet 02"])
    })

    it("célula vazia vira null, nunca string vazia", () => {
      const r = lerPlanilha("nome\ttipo\tmarca\nJet 01\t\t")
      expect(r[0].tipo).toBeNull()
      expect(r[0].marca).toBeNull()
    })

    it("texto colado sem nada devolve lista vazia, não explode", () => {
      expect(lerPlanilha("")).toEqual([])
      expect(lerPlanilha("   \n\n  ")).toEqual([])
    })

    it("a saída de lerPlanilha entra direto no validador", () => {
      // As duas metades da mesma conversa — é assim que a tela usa.
      const r = validarImportacao(lerPlanilha("nome\tano\nJet 01\t2022\n\t2020\nJet 01\t2019"))
      expect(r.validas.map((v) => v.nome)).toEqual(["Jet 01"])
      expect(r.erros.map((e) => e.linha)).toEqual([3, 4])
    })
  })
})
