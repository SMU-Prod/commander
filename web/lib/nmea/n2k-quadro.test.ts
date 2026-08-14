import { describe, expect, it } from "vitest"
import { criarMontadorFastPacket, decodificarIdCan, type QuadroCan } from "./n2k-quadro"

/** Monta um identificador CAN de 29 bits a partir de prioridade/PGN/origem
 *  — inverso de `decodificarIdCan`, só pra teste (o simulador real,
 *  `scripts/simular-n2k.mjs`, tem a própria cópia independente — mesma
 *  razão documentada lá: roda fora da árvore de módulos de `web/`). */
function idCanDe(prioridade: number, pgn: number, origem: number): number {
  const dataPage = (pgn >> 16) & 0x1
  const pduFormat = (pgn >> 8) & 0xff
  const pduSpecific = pgn & 0xff
  return ((prioridade & 0x7) << 26) | (dataPage << 24) | (pduFormat << 16) | (pduSpecific << 8) | (origem & 0xff)
}

describe("decodificarIdCan", () => {
  it("extrai prioridade/PGN/origem de um quadro PDU2 (broadcast) — 127488", () => {
    const id = idCanDe(2, 127488, 5)
    expect(decodificarIdCan(id)).toEqual({ prioridade: 2, pgn: 127488, origem: 5 })
  })

  it("extrai corretamente a PGN 127489 (Engine Parameters, Dynamic)", () => {
    const id = idCanDe(2, 127489, 12)
    expect(decodificarIdCan(id)).toEqual({ prioridade: 2, pgn: 127489, origem: 12 })
  })

  it("extrai corretamente a PGN 127505 (Fluid Level), prioridade diferente", () => {
    const id = idCanDe(6, 127505, 200)
    expect(decodificarIdCan(id)).toEqual({ prioridade: 6, pgn: 127505, origem: 200 })
  })
})

describe("criarMontadorFastPacket", () => {
  it("PGN de quadro único (127488) passa direto, sem exigir remontagem", () => {
    const montador = criarMontadorFastPacket()
    const quadro: QuadroCan = { idCan: idCanDe(2, 127488, 5), dados: [0, 0x20, 0x28, 0xff, 0xff, 0xff, 0xff, 0xff] }
    const resultado = montador.processar(quadro)
    expect(resultado).not.toBeNull()
    expect(resultado!.pgn).toBe(127488)
    expect(Array.from(resultado!.dados)).toEqual(quadro.dados)
  })

  it("remonta 127489 (26 bytes) espalhado em 4 quadros fast packet", () => {
    const montador = criarMontadorFastPacket()
    const dados26 = Array.from({ length: 26 }, (_, i) => i + 1) // 1..26, fácil de conferir
    const seq = 3 // contador de sequência arbitrário (3 bits)

    const quadro0: QuadroCan = {
      idCan: idCanDe(2, 127489, 7),
      dados: [(seq << 5) | 0, 26, ...dados26.slice(0, 6)],
    }
    const quadro1: QuadroCan = { idCan: idCanDe(2, 127489, 7), dados: [(seq << 5) | 1, ...dados26.slice(6, 13)] }
    const quadro2: QuadroCan = { idCan: idCanDe(2, 127489, 7), dados: [(seq << 5) | 2, ...dados26.slice(13, 20)] }
    // último quadro: só 6 bytes reais (20..26), preenchido com padding até 8
    // (comportamento comum de gateway real) — o montador deve TRUNCAR no
    // total anunciado (26), ignorando o padding.
    const quadro3: QuadroCan = {
      idCan: idCanDe(2, 127489, 7),
      dados: [(seq << 5) | 3, ...dados26.slice(20, 26), 0xff],
    }

    expect(montador.processar(quadro0)).toBeNull()
    expect(montador.processar(quadro1)).toBeNull()
    expect(montador.processar(quadro2)).toBeNull()
    const completo = montador.processar(quadro3)

    expect(completo).not.toBeNull()
    expect(completo!.pgn).toBe(127489)
    expect(completo!.origem).toBe(7)
    expect(completo!.dados).toHaveLength(26)
    expect(Array.from(completo!.dados)).toEqual(dados26)
  })

  it("quadro de continuação sem início correspondente é descartado (não trava nem inventa dado)", () => {
    const montador = criarMontadorFastPacket()
    const orfao: QuadroCan = { idCan: idCanDe(2, 127489, 7), dados: [(1 << 5) | 2, 1, 2, 3, 4, 5, 6, 7] }
    expect(montador.processar(orfao)).toBeNull()
  })

  it("uma nova sequência (frame 0 de novo) substitui uma sequência anterior incompleta — quadro perdido no meio não trava o montador pra sempre", () => {
    const montador = criarMontadorFastPacket()
    const dados26 = Array.from({ length: 26 }, (_, i) => i + 100)

    // 1ª tentativa: começa, mas perde o quadro de continuação seguinte (nunca chega).
    montador.processar({ idCan: idCanDe(2, 127489, 7), dados: [(1 << 5) | 0, 26, ...dados26.slice(0, 6)] })

    // 2ª tentativa (sequência nova): completa normalmente.
    const seq2 = 2
    const r0 = montador.processar({ idCan: idCanDe(2, 127489, 7), dados: [(seq2 << 5) | 0, 26, ...dados26.slice(0, 6)] })
    const r1 = montador.processar({ idCan: idCanDe(2, 127489, 7), dados: [(seq2 << 5) | 1, ...dados26.slice(6, 13)] })
    const r2 = montador.processar({ idCan: idCanDe(2, 127489, 7), dados: [(seq2 << 5) | 2, ...dados26.slice(13, 20)] })
    const r3 = montador.processar({ idCan: idCanDe(2, 127489, 7), dados: [(seq2 << 5) | 3, ...dados26.slice(20, 26), 0xff, 0xff] })

    expect([r0, r1, r2]).toEqual([null, null, null])
    expect(r3).not.toBeNull()
    expect(Array.from(r3!.dados)).toEqual(dados26)
  })

  it("duas PGNs de fast packet de origens diferentes remontam em paralelo sem se misturar", () => {
    const montador = criarMontadorFastPacket()
    const dadosA = Array.from({ length: 26 }, () => 0xaa)
    const dadosB = Array.from({ length: 26 }, () => 0xbb)

    montador.processar({ idCan: idCanDe(2, 127489, 1), dados: [0, 26, ...dadosA.slice(0, 6)] })
    montador.processar({ idCan: idCanDe(2, 127489, 2), dados: [0, 26, ...dadosB.slice(0, 6)] })
    montador.processar({ idCan: idCanDe(2, 127489, 1), dados: [1, ...dadosA.slice(6, 13)] })
    montador.processar({ idCan: idCanDe(2, 127489, 2), dados: [1, ...dadosB.slice(6, 13)] })
    montador.processar({ idCan: idCanDe(2, 127489, 1), dados: [2, ...dadosA.slice(13, 20)] })
    montador.processar({ idCan: idCanDe(2, 127489, 2), dados: [2, ...dadosB.slice(13, 20)] })
    const completoA = montador.processar({ idCan: idCanDe(2, 127489, 1), dados: [3, ...dadosA.slice(20, 26)] })
    const completoB = montador.processar({ idCan: idCanDe(2, 127489, 2), dados: [3, ...dadosB.slice(20, 26)] })

    expect(Array.from(completoA!.dados)).toEqual(dadosA)
    expect(Array.from(completoB!.dados)).toEqual(dadosB)
  })
})
