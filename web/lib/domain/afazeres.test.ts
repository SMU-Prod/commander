import { describe, expect, it } from "vitest"
import {
  alertaViraAfazerAutomaticamente,
  COLUNAS_IMPORTACAO,
  converterEmAfazer,
  DESTINOS_AFAZER,
  ESTADOS_AFAZER,
  importacaoVazia,
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

  it("ALERTA NÃO VIRA AFAZER SOZINHO — §20", () => {
    // Uma frota de 40 unidades produz dezenas de alertas por semana. Virar
    // tarefa automaticamente encheria a lista de coisa que ninguém aceitou
    // fazer, e lista que ninguém confia é lista que ninguém abre.
    expect(alertaViraAfazerAutomaticamente()).toBe(false)
  })

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
})
