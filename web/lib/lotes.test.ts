import { describe, expect, it } from "vitest"
import { emLotes } from "./lotes"

describe("emLotes", () => {
  it("processa todos os itens", async () => {
    const processados: number[] = []
    await emLotes([1, 2, 3, 4, 5], 2, async (n) => {
      processados.push(n)
    })
    expect(processados.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5])
  })

  it("respeita o tamanho do lote — nunca mais que N tarefas em voo ao mesmo tempo", async () => {
    let emVoo = 0
    let picoEmVoo = 0
    await emLotes([1, 2, 3, 4, 5, 6, 7], 3, async () => {
      emVoo++
      picoEmVoo = Math.max(picoEmVoo, emVoo)
      await new Promise((r) => setTimeout(r, 0))
      emVoo--
    })
    expect(picoEmVoo).toBeLessThanOrEqual(3)
  })

  it("falha de um item não aborta o lote nem os demais itens", async () => {
    const processados: number[] = []
    await emLotes([1, 2, 3, 4], 2, async (n) => {
      if (n === 2) throw new Error("falhou de propósito")
      processados.push(n)
    })
    expect(processados.sort((a, b) => a - b)).toEqual([1, 3, 4])
  })

  it("lista vazia não quebra", async () => {
    let chamadas = 0
    await emLotes([], 5, async () => {
      chamadas++
    })
    expect(chamadas).toBe(0)
  })
})
