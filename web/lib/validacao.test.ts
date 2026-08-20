import { describe, expect, it } from "vitest"
import {
  TETO_DINHEIRO_CENTAVOS, TETO_TEXTO, validar, type Esquema,
} from "@/lib/validacao"

/**
 * O VALIDADOR DECLARATIVO DAS ACTIONS DE DINHEIRO, provado (auditoria 360 de
 * 20/08/2026, recomendação nº 10).
 *
 * O que está em jogo aqui não é o formulário bem preenchido — esse sempre
 * passou. É o POST que não veio da tela: campo faltando, valor negativo,
 * "2026-02-31", um texto de 100 mil caracteres. Antes, cada action lembrava
 * (ou esquecia) de checar cada um desses por conta própria; agora o schema
 * descreve o campo e o validador recusa com a primeira mensagem em linguagem
 * de gente. Cada teste abaixo é um desses esquecimentos possíveis.
 */

function formulario(campos: Record<string, string>): FormData {
  const f = new FormData()
  for (const [chave, valor] of Object.entries(campos)) f.set(chave, valor)
  return f
}

describe("tipos de campo", () => {
  it("texto devolve o valor aparado, sem espaços das pontas", () => {
    const r = validar(formulario({ descricao: "  Diesel no posto  " }), {
      descricao: { tipo: "texto", obrigatorio: true, erro: "Descreva o gasto." },
    })
    expect(r).toEqual({ ok: true, dados: { descricao: "Diesel no posto" } })
  })

  it("dinheiro entende a vírgula brasileira e devolve centavos", () => {
    const r = validar(formulario({ valor: "1.850,00" }), {
      valor: { tipo: "dinheiro", obrigatorio: true, erro: "Informe um valor." },
    })
    expect(r).toEqual({ ok: true, dados: { valor: 185_000 } })
  })

  it("dinheiro sem vírgula aceita ponto decimal (o mesmo parser do app)", () => {
    // "10.5" sem vírgula é decimal com ponto — regra herdada de
    // `parseDecimalPtBr`, que este validador REUSA em vez de reinventar.
    const r = validar(formulario({ valor: "10.5" }), {
      valor: { tipo: "dinheiro", obrigatorio: true, erro: "Informe um valor." },
    })
    expect(r).toEqual({ ok: true, dados: { valor: 1_050 } })
  })

  it("dinheiro que não é número recusa com a mensagem do campo", () => {
    const r = validar(formulario({ valor: "abc" }), {
      valor: { tipo: "dinheiro", obrigatorio: true, erro: "Informe um valor maior que zero (ex.: 1.850,00)." },
    })
    expect(r).toEqual({ ok: false, erro: "Informe um valor maior que zero (ex.: 1.850,00)." })
  })

  it("opção dentro da lista passa; fora da lista recusa com a mensagem do campo", () => {
    const esquema = {
      tipo: { tipo: "opcao", valores: ["despesa", "entrada"], obrigatorio: true, erro: "Escolha despesa ou entrada." },
    } as const satisfies Esquema
    expect(validar(formulario({ tipo: "entrada" }), esquema)).toEqual({ ok: true, dados: { tipo: "entrada" } })
    expect(validar(formulario({ tipo: "orcamento" }), esquema)).toEqual({ ok: false, erro: "Escolha despesa ou entrada." })
  })

  it("data aceita dia real do calendário, inclusive 29/02 de bissexto", () => {
    const esquema = {
      data: { tipo: "data", obrigatorio: true, erro: "Informe a data." },
    } as const satisfies Esquema
    expect(validar(formulario({ data: "2026-08-20" }), esquema)).toEqual({ ok: true, dados: { data: "2026-08-20" } })
    expect(validar(formulario({ data: "2024-02-29" }), esquema)).toEqual({ ok: true, dados: { data: "2024-02-29" } })
  })

  it("data recusa dia que não existe no calendário", () => {
    const esquema = {
      data: { tipo: "data", obrigatorio: true, erro: "Informe a data." },
    } as const satisfies Esquema
    // 31 de fevereiro passa num regex de formato — é exatamente o buraco que
    // o validador fecha: antes essa string ia até o Postgres pra ser recusada
    // lá, com mensagem genérica.
    expect(validar(formulario({ data: "2026-02-31" }), esquema)).toEqual({ ok: false, erro: "Informe a data." })
    expect(validar(formulario({ data: "2025-02-29" }), esquema)).toEqual({ ok: false, erro: "Informe a data." })
    expect(validar(formulario({ data: "2026-13-01" }), esquema)).toEqual({ ok: false, erro: "Informe a data." })
  })

  it("data recusa o formato brasileiro — o form manda ISO, tudo diferente é POST forjado", () => {
    const r = validar(formulario({ data: "20/08/2026" }), {
      data: { tipo: "data", obrigatorio: true, erro: "Informe a data." },
    })
    expect(r).toEqual({ ok: false, erro: "Informe a data." })
  })

  it("inteiro aceita número redondo e recusa quebrado", () => {
    const esquema = {
      vagas: { tipo: "inteiro", obrigatorio: true, erro: "Informe quantas vagas." },
    } as const satisfies Esquema
    expect(validar(formulario({ vagas: "12" }), esquema)).toEqual({ ok: true, dados: { vagas: 12 } })
    expect(validar(formulario({ vagas: "2,5" }), esquema)).toEqual({ ok: false, erro: "Informe quantas vagas." })
  })

  it("inteiro respeita min e max com mensagem que diz o limite", () => {
    const esquema = {
      vagas: { tipo: "inteiro", obrigatorio: true, min: 1, max: 50, erro: "Informe quantas vagas." },
    } as const satisfies Esquema
    expect(validar(formulario({ vagas: "0" }), esquema)).toEqual({ ok: false, erro: "Use um número a partir de 1." })
    expect(validar(formulario({ vagas: "51" }), esquema)).toEqual({ ok: false, erro: "Use um número até 50." })
  })
})

describe("obrigatórios e opcionais", () => {
  it("obrigatório ausente recusa com a mensagem do campo", () => {
    const r = validar(formulario({}), {
      valor: { tipo: "dinheiro", obrigatorio: true, erro: "Informe um valor maior que zero (ex.: 500,00)." },
    })
    expect(r).toEqual({ ok: false, erro: "Informe um valor maior que zero (ex.: 500,00)." })
  })

  it("obrigatório só com espaços conta como ausente", () => {
    const r = validar(formulario({ descricao: "   " }), {
      descricao: { tipo: "texto", obrigatorio: true, erro: "Descreva o gasto." },
    })
    expect(r).toEqual({ ok: false, erro: "Descreva o gasto." })
  })

  it("opcional ausente vira null, sem erro", () => {
    const r = validar(formulario({}), {
      observacao: { tipo: "texto" },
      data: { tipo: "data", erro: "Informe a data." },
    })
    expect(r).toEqual({ ok: true, dados: { observacao: null, data: null } })
  })

  it("opcional presente mas ilegível recusa — presença é diferente de validade", () => {
    // O caso perigoso do Marketplace: valor opcional digitado errado caía no
    // fallback em silêncio e a pessoa lançava um número que não digitou.
    const r = validar(formulario({ valor: "1.5oo,00" }), {
      valor: { tipo: "dinheiro", erro: "Confira o valor — use números, como 1.850,00." },
    })
    expect(r).toEqual({ ok: false, erro: "Confira o valor — use números, como 1.850,00." })
  })

  it("devolve a PRIMEIRA mensagem na ordem do schema, nunca um apanhado", () => {
    const r = validar(formulario({}), {
      tipo: { tipo: "opcao", valores: ["despesa", "entrada"], obrigatorio: true, erro: "Escolha despesa ou entrada." },
      valor: { tipo: "dinheiro", obrigatorio: true, erro: "Informe um valor." },
    })
    expect(r).toEqual({ ok: false, erro: "Escolha despesa ou entrada." })
  })
})

describe("limites", () => {
  it("dinheiro aceita até R$ 10 milhões cravados", () => {
    const r = validar(formulario({ valor: "10.000.000,00" }), {
      valor: { tipo: "dinheiro", obrigatorio: true, erro: "Informe um valor." },
    })
    expect(r).toEqual({ ok: true, dados: { valor: TETO_DINHEIRO_CENTAVOS } })
  })

  it("dinheiro um centavo acima do teto recusa dizendo o limite", () => {
    const r = validar(formulario({ valor: "10.000.000,01" }), {
      valor: { tipo: "dinheiro", obrigatorio: true, erro: "Informe um valor." },
    })
    expect(r).toEqual({
      ok: false,
      erro: "Esse valor passa de R$ 10.000.000,00 — confira se digitou certo.",
    })
  })

  it("dinheiro zero ou negativo recusa com a mensagem do campo", () => {
    const esquema = {
      valor: { tipo: "dinheiro", obrigatorio: true, erro: "Informe um valor maior que zero (ex.: 350,00)." },
    } as const satisfies Esquema
    expect(validar(formulario({ valor: "0,00" }), esquema))
      .toEqual({ ok: false, erro: "Informe um valor maior que zero (ex.: 350,00)." })
    expect(validar(formulario({ valor: "-10,00" }), esquema))
      .toEqual({ ok: false, erro: "Informe um valor maior que zero (ex.: 350,00)." })
  })

  it("texto aceita até o teto e recusa um caractere a mais", () => {
    const esquema = { observacao: { tipo: "texto" } } as const satisfies Esquema
    const noLimite = validar(formulario({ observacao: "x".repeat(TETO_TEXTO) }), esquema)
    expect(noLimite.ok).toBe(true)
    expect(validar(formulario({ observacao: "x".repeat(TETO_TEXTO + 1) }), esquema)).toEqual({
      ok: false,
      erro: `Esse texto ficou longo demais — use até ${TETO_TEXTO} caracteres.`,
    })
  })

  it("string gigante não passa nem chega perto do banco", () => {
    const r = validar(formulario({ observacao: "x".repeat(100_000) }), {
      observacao: { tipo: "texto" },
    })
    expect(r).toEqual({
      ok: false,
      erro: `Esse texto ficou longo demais — use até ${TETO_TEXTO} caracteres.`,
    })
  })

  it("max customizado de texto vale no lugar do teto padrão", () => {
    const r = validar(formulario({ nome: "x".repeat(101) }), {
      nome: { tipo: "texto", obrigatorio: true, max: 100, erro: "Informe o nome." },
    })
    expect(r).toEqual({ ok: false, erro: "Esse texto ficou longo demais — use até 100 caracteres." })
  })
})

describe("o que o schema não conhece", () => {
  it("campo desconhecido no formulário é ignorado, não recusado", () => {
    // POST forjado com campo extra não pode derrubar o formulário legítimo —
    // o validador só lê o que o schema declara; o resto nem é olhado.
    const f = formulario({ valor: "100,00", papel: "admin", plano_secreto: "gratis" })
    const r = validar(f, {
      valor: { tipo: "dinheiro", obrigatorio: true, erro: "Informe um valor." },
    })
    expect(r).toEqual({ ok: true, dados: { valor: 10_000 } })
  })

  it("arquivo enviado no lugar de um campo de texto conta como ausente", () => {
    // FormData aceita File em qualquer chave. Num campo obrigatório isso tem
    // que virar a mensagem do campo — nunca um "[object File]" gravado.
    const f = new FormData()
    f.set("descricao", new File(["conteudo"], "nota.pdf"))
    const r = validar(f, {
      descricao: { tipo: "texto", obrigatorio: true, erro: "Descreva o gasto." },
    })
    expect(r).toEqual({ ok: false, erro: "Descreva o gasto." })
  })
})
