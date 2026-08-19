import { describe, expect, it } from "vitest"
import { carimboDoEvento } from "./asaas"

/**
 * O carimbo de ordem do webhook (achado A-06 da auditoria de 19/08/2026).
 *
 * Este é o único pedaço puro de `lib/asaas.ts` — o resto fala com a rede. E é
 * justamente o pedaço em que um erro é invisível em produção: se a leitura do
 * carimbo falhar em silêncio, tudo continua "funcionando" e a proteção contra
 * evento fora de ordem simplesmente não existe. Por isso os casos abaixo
 * cobrem os formatos que o gateway realmente manda, não só o feliz.
 */
describe("carimboDoEvento", () => {
  it("lê o formato que o Asaas manda: 'YYYY-MM-DD HH:mm:ss' em horário de Brasília", () => {
    // 15:23:45 em Brasília (UTC-3) = 18:23:45 em UTC.
    expect(carimboDoEvento({ dateCreated: "2026-08-19 15:23:45" }))
      .toBe("2026-08-19T18:23:45.000Z")
  })

  it("aceita data pura (meia-noite de Brasília)", () => {
    expect(carimboDoEvento({ dateCreated: "2026-08-19" }))
      .toBe("2026-08-19T03:00:00.000Z")
  })

  it("respeita o fuso quando o gateway manda um", () => {
    expect(carimboDoEvento({ dateCreated: "2026-08-19T18:23:45Z" }))
      .toBe("2026-08-19T18:23:45.000Z")
    expect(carimboDoEvento({ dateCreated: "2026-08-19T15:23:45-03:00" }))
      .toBe("2026-08-19T18:23:45.000Z")
  })

  it("é determinístico — não depende do fuso da máquina que roda o webhook", () => {
    // `new Date("2026-08-19 15:23:45")` sem fuso seria interpretado no fuso
    // LOCAL do Node. Numa function da Vercel (UTC) e no laptop de quem
    // desenvolve (UTC-3) o mesmo evento viraria instantes diferentes, e a
    // comparação de ordem passaria a depender de onde o código rodou.
    const emUtc = new Date("2026-08-19T15:23:45Z").toISOString()
    expect(carimboDoEvento({ dateCreated: "2026-08-19 15:23:45" })).not.toBe(emUtc)
  })

  it("ordena eventos do mesmo dia na ordem em que aconteceram", () => {
    const overdue = carimboDoEvento({ dateCreated: "2026-08-18 09:00:00" })!
    const confirmado = carimboDoEvento({ dateCreated: "2026-08-19 09:00:00" })!
    // É esta comparação de string ISO que o webhook usa para descartar o
    // OVERDUE reentregue depois do CONFIRMED. ISO em UTC ordena
    // lexicograficamente, por isso não é preciso construir Date pra comparar.
    expect(overdue < confirmado).toBe(true)
  })

  it("sem carimbo devolve null — e null é 'não sei quando', nunca 'muito antigo'", () => {
    // Quem chama trata null deixando o evento PASSAR. Se esta função
    // devolvesse uma data mínima em vez de null, todo evento sem carimbo
    // seria descartado como fora de ordem — e uma confirmação de pagamento
    // sumiria em silêncio.
    expect(carimboDoEvento({})).toBeNull()
    expect(carimboDoEvento(null)).toBeNull()
    expect(carimboDoEvento(undefined)).toBeNull()
    expect(carimboDoEvento({ dateCreated: "" })).toBeNull()
    expect(carimboDoEvento({ dateCreated: "   " })).toBeNull()
  })

  it("não lê o campo errado: `payment.dateCreated` não serve de carimbo", () => {
    // `payment.dateCreated` é a data de criação da COBRANÇA — idêntica em
    // todos os eventos daquela fatura. Ordenar por ela não ordenaria nada, e
    // pior: daria a impressão de haver ordem onde não há.
    expect(carimboDoEvento({ payment: { dateCreated: "2026-08-19" } })).toBeNull()
  })

  it("lixo não vira data", () => {
    expect(carimboDoEvento({ dateCreated: "ontem à tarde" })).toBeNull()
    expect(carimboDoEvento({ dateCreated: "2026-13-45 99:99:99" })).toBeNull()
    expect(carimboDoEvento({ dateCreated: 1755600000 })).toBeNull()
    expect(carimboDoEvento({ dateCreated: { quando: "agora" } })).toBeNull()
  })
})
