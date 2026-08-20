/**
 * FilaDisco: FIFO com teto, persistência atômica e tolerância a arquivo ruim.
 */
import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FilaDisco } from '../src/fila'
import { Leitura } from '../src/tipos'

let dir: string
let arquivo: string

const leitura = (n: number): Leitura => ({
  path: `teste.path.${n}`,
  valor: n,
  ts: new Date(1700000000000 + n * 1000).toISOString()
})

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fila-commander-'))
  arquivo = path.join(dir, 'fila-pendentes.json')
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('FilaDisco', () => {
  it('mantém ordem FIFO: espiar devolve as mais antigas primeiro', () => {
    const fila = new FilaDisco(arquivo)
    fila.adicionar([leitura(1), leitura(2)])
    fila.adicionar([leitura(3)])
    expect(fila.espiar(2).map((l) => l.valor)).toEqual([1, 2])
    fila.remover(2)
    expect(fila.espiar(10).map((l) => l.valor)).toEqual([3])
  })

  it('estourou o teto: descarta as leituras MAIS ANTIGAS', () => {
    const fila = new FilaDisco(arquivo, 3)
    fila.adicionar([leitura(1), leitura(2), leitura(3)])
    fila.adicionar([leitura(4), leitura(5)])
    expect(fila.tamanho).toBe(3)
    expect(fila.espiar(10).map((l) => l.valor)).toEqual([3, 4, 5])
  })

  it('persiste em disco: outra instância do mesmo arquivo recupera a fila', () => {
    const fila = new FilaDisco(arquivo)
    fila.adicionar([leitura(1), leitura(2)])
    const renascida = new FilaDisco(arquivo)
    expect(renascida.tamanho).toBe(2)
    expect(renascida.espiar(10).map((l) => l.valor)).toEqual([1, 2])
  })

  it('remover persiste o novo estado (entrega confirmada não volta)', () => {
    const fila = new FilaDisco(arquivo)
    fila.adicionar([leitura(1), leitura(2), leitura(3)])
    fila.remover(2)
    const renascida = new FilaDisco(arquivo)
    expect(renascida.espiar(10).map((l) => l.valor)).toEqual([3])
  })

  it('arquivo corrompido não derruba o plugin: começa fila vazia', () => {
    fs.writeFileSync(arquivo, '{isso nao e json[', 'utf8')
    const fila = new FilaDisco(arquivo)
    expect(fila.tamanho).toBe(0)
  })

  it('descarta itens malformados ao carregar (só leituras válidas voltam)', () => {
    fs.writeFileSync(
      arquivo,
      JSON.stringify([leitura(1), { qualquer: 'coisa' }, null, leitura(2)]),
      'utf8'
    )
    const fila = new FilaDisco(arquivo)
    expect(fila.espiar(10).map((l) => l.valor)).toEqual([1, 2])
  })
})
