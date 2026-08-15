import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import {
  calcularReputacao,
  DIAS_EDICAO_AVALIACAO,
  diasRestantesParaEditar,
  estadoDaSolucao,
  estrelasCheias,
  faixaDaNota,
  formatarMedia,
  formatarQuantidade,
  MOTIVOS_CONTESTACAO,
  notaDepoisDaSolucao,
  notaValida,
  podeAvaliar,
  podeContestar,
  podeEditarAvaliacao,
  RESPOSTAS_PRONTAS,
  respostasParaNota,
  SELO_NEGOCIO_CONFIRMADO,
  textoDaResposta,
  textoDoMotivo,
} from "./avaliacoes"
import type { ConfirmacaoNegocio } from "./marketplace"

const CLIENTE = "cliente-1"
const FORNECEDOR = "fornecedor-1"

const confirmadoBilateral: ConfirmacaoNegocio[] = [
  { usuario_id: FORNECEDOR, papel: "fornecedor", decisao: "realizado" },
  { usuario_id: CLIENTE, papel: "cliente", decisao: "confirmado" },
]

describe("podeAvaliar — a trava do §14", () => {
  it("libera o cliente quando o negócio foi confirmado pelos dois lados", () => {
    expect(
      podeAvaliar({ usuarioId: CLIENTE, clienteId: CLIENTE, confirmacoes: confirmadoBilateral, jaAvaliou: false }),
    ).toBe(true)
  })

  it("não libera com uma declaração só — falta o outro lado", () => {
    expect(
      podeAvaliar({
        usuarioId: CLIENTE,
        clienteId: CLIENTE,
        confirmacoes: [{ usuario_id: FORNECEDOR, papel: "fornecedor", decisao: "realizado" }],
        jaAvaliou: false,
      }),
    ).toBe(false)
  })

  it("não libera quando um dos lados negou", () => {
    expect(
      podeAvaliar({
        usuarioId: CLIENTE,
        clienteId: CLIENTE,
        confirmacoes: [
          { usuario_id: FORNECEDOR, papel: "fornecedor", decisao: "realizado" },
          { usuario_id: CLIENTE, papel: "cliente", decisao: "negado" },
        ],
        jaAvaliou: false,
      }),
    ).toBe(false)
  })

  it("não libera sem negócio nenhum", () => {
    expect(
      podeAvaliar({ usuarioId: CLIENTE, clienteId: CLIENTE, confirmacoes: [], jaAvaliou: false }),
    ).toBe(false)
  })

  it("quem prestou o serviço não avalia o cliente (uma direção só)", () => {
    expect(
      podeAvaliar({ usuarioId: FORNECEDOR, clienteId: CLIENTE, confirmacoes: confirmadoBilateral, jaAvaliou: false }),
    ).toBe(false)
  })

  it("não avalia duas vezes o mesmo negócio", () => {
    expect(
      podeAvaliar({ usuarioId: CLIENTE, clienteId: CLIENTE, confirmacoes: confirmadoBilateral, jaAvaliou: true }),
    ).toBe(false)
  })
})

describe("edição da própria avaliação por 30 dias (§14)", () => {
  const criado = "2026-08-01T12:00:00.000Z"

  it("dá pra editar no mesmo dia", () => {
    expect(podeEditarAvaliacao(criado, new Date("2026-08-01T12:05:00.000Z"))).toBe(true)
  })

  it("dá pra editar no dia 29", () => {
    expect(podeEditarAvaliacao(criado, new Date("2026-08-30T11:00:00.000Z"))).toBe(true)
  })

  it("no instante exato dos 30 dias já não dá", () => {
    expect(podeEditarAvaliacao(criado, new Date("2026-08-31T12:00:00.000Z"))).toBe(false)
  })

  it("depois do prazo não dá", () => {
    expect(podeEditarAvaliacao(criado, new Date("2026-09-15T12:00:00.000Z"))).toBe(false)
  })

  it("conta os dias que restam", () => {
    expect(DIAS_EDICAO_AVALIACAO).toBe(30)
    expect(diasRestantesParaEditar(criado, new Date("2026-08-01T12:00:00.000Z"))).toBe(30)
    expect(diasRestantesParaEditar(criado, new Date("2026-08-19T12:00:00.000Z"))).toBe(12)
    expect(diasRestantesParaEditar(criado, new Date("2026-09-15T12:00:00.000Z"))).toBe(-1)
  })
})

describe("§14.1 — respostas prontas", () => {
  it("as três faixas seguem o corte do PRD (1–2 negativa, 3 intermediária, 4–5 positiva)", () => {
    expect(faixaDaNota(1)).toBe("negativa")
    expect(faixaDaNota(2)).toBe("negativa")
    expect(faixaDaNota(3)).toBe("intermediaria")
    expect(faixaDaNota(4)).toBe("positiva")
    expect(faixaDaNota(5)).toBe("positiva")
  })

  it("cada nota só enxerga as respostas do seu tom", () => {
    expect(respostasParaNota(5).map((r) => r.codigo)).toEqual([
      "pos_confianca", "pos_preferencia", "pos_reconhecimento",
    ])
    expect(respostasParaNota(3)).toHaveLength(3)
    expect(respostasParaNota(1)).toHaveLength(6)
    // Nenhum "obrigado pelo reconhecimento" embaixo de uma nota 1.
    expect(respostasParaNota(1).every((r) => r.faixa === "negativa")).toBe(true)
  })

  it("são 12 respostas, com códigos únicos", () => {
    expect(RESPOSTAS_PRONTAS).toHaveLength(12)
    expect(new Set(RESPOSTAS_PRONTAS.map((r) => r.codigo)).size).toBe(12)
  })

  it("código desconhecido não vira texto", () => {
    expect(textoDaResposta("pos_confianca")).toContain("confiança em nosso trabalho")
    expect(textoDaResposta("inventado")).toBeNull()
  })
})

describe("§14.2 — motivos de contestação", () => {
  it("são os 8 do PRD, na ordem, com 'Outro motivo' por último", () => {
    expect(MOTIVOS_CONTESTACAO).toHaveLength(8)
    expect(MOTIVOS_CONTESTACAO[7].codigo).toBe("outro")
  })

  it("código desconhecido não vira texto", () => {
    expect(textoDoMotivo("uso_indevido")).toContain("uso indevido")
    expect(textoDoMotivo("inventado")).toBeNull()
  })

  it("nota 1 e 2 liberam contestar; 3 pra cima não", () => {
    expect(podeContestar(1)).toBe(true)
    expect(podeContestar(2)).toBe(true)
    expect(podeContestar(3)).toBe(false)
    expect(podeContestar(5)).toBe(false)
  })
})

/**
 * Este teste lê o PRD de verdade. A ideia é que ninguém "melhore" o texto das
 * respostas prontas sem que a suíte grite: são frases que o dono travou
 * (§14.1/§14.2), não copy de programador.
 */
describe("as frases são as do PRD, palavra por palavra", () => {
  const prd = readFileSync(
    fileURLToPath(new URL("../../../docs/prd/upgrade2-master-final.txt", import.meta.url)),
    "utf8",
  )
  const linhas = new Set(prd.split(/\r?\n/).map((l) => l.trim()))

  it.each(RESPOSTAS_PRONTAS.map((r) => [r.codigo, r.texto]))("resposta %s", (_codigo, texto) => {
    expect(linhas.has(texto)).toBe(true)
  })

  it.each(MOTIVOS_CONTESTACAO.map((m) => [m.codigo, m.texto]))("motivo %s", (_codigo, texto) => {
    expect(linhas.has(texto)).toBe(true)
  })

  it("o selo do perfil é o texto do §14", () => {
    expect(SELO_NEGOCIO_CONFIRMADO).toBe("Negócio confirmado pelo Commander")
    expect(prd).toContain("Negócio confirmado pelo Commander")
  })
})

describe("§14 — problema solucionado não mexe na nota", () => {
  it("a nota continua a mesma depois de solução confirmada", () => {
    expect(notaDepoisDaSolucao(1)).toBe(1)
    expect(notaDepoisDaSolucao(2)).toBe(2)
  })

  it("estados da solução", () => {
    expect(estadoDaSolucao(null)).toBe("nenhuma")
    expect(estadoDaSolucao({ resposta: null })).toBe("aguardando_cliente")
    expect(estadoDaSolucao({ resposta: "confirmado" })).toBe("confirmada")
    expect(estadoDaSolucao({ resposta: "negado" })).toBe("negada")
  })
})

describe("média e quantidade do perfil (§14)", () => {
  it("sem avaliação a média é ausente, nunca zero", () => {
    const r = calcularReputacao([])
    expect(r.media).toBeNull()
    expect(r.quantidade).toBe(0)
    expect(formatarMedia(r.media)).toBe("—")
    expect(formatarQuantidade(r.quantidade)).toBe("Sem avaliações ainda")
  })

  it("média simples, com uma casa decimal", () => {
    const r = calcularReputacao([
      { nota: 5, visibilidade: "publica" },
      { nota: 4, visibilidade: "publica" },
      { nota: 5, visibilidade: "publica" },
    ])
    expect(r.media).toBe(4.7)
    expect(r.quantidade).toBe(3)
    expect(formatarMedia(r.media)).toBe("4,7")
    expect(formatarQuantidade(r.quantidade)).toBe("3 avaliações")
    expect(formatarQuantidade(1)).toBe("1 avaliação")
  })

  /**
   * A decisão da onda, e a razão dela: a média tem que ser explicável pelo
   * que está na tela. Ocultada por violação sai da conta E da quantidade —
   * senão o leitor veria um número que nenhuma avaliação visível justifica, e
   * o avaliado seguiria punido por um texto que o Commander já declarou
   * inválido e que ele não pode mais responder.
   */
  it("avaliação oculta por violação NÃO entra na média nem na quantidade", () => {
    const r = calcularReputacao([
      { nota: 5, visibilidade: "publica" },
      { nota: 5, visibilidade: "publica" },
      { nota: 1, visibilidade: "oculta_violacao" },
    ])
    expect(r.media).toBe(5)
    expect(r.quantidade).toBe(2)
    expect(r.ocultadas).toBe(1)
  })

  it("todas ocultas = perfil sem nota, e não média zero", () => {
    const r = calcularReputacao([
      { nota: 1, visibilidade: "oculta_violacao" },
      { nota: 2, visibilidade: "oculta_violacao" },
    ])
    expect(r.media).toBeNull()
    expect(r.quantidade).toBe(0)
    expect(r.ocultadas).toBe(2)
  })

  it("contestação pendente não muda nada — a avaliação segue pública e contando", () => {
    // "Contestação não remove avaliação automaticamente" (§14): uma avaliação
    // 1 estrela contestada continua `publica` até o Admin decidir.
    const r = calcularReputacao([
      { nota: 5, visibilidade: "publica" },
      { nota: 1, visibilidade: "publica" },
    ])
    expect(r.media).toBe(3)
    expect(r.quantidade).toBe(2)
    expect(r.ocultadas).toBe(0)
  })

  it("distribuição por estrela só conta o que entra na média", () => {
    const r = calcularReputacao([
      { nota: 5, visibilidade: "publica" },
      { nota: 5, visibilidade: "publica" },
      { nota: 3, visibilidade: "publica" },
      { nota: 1, visibilidade: "oculta_violacao" },
    ])
    expect(r.distribuicao).toEqual([0, 0, 1, 0, 2])
  })

  it("estrelas cheias arredondam só na exibição", () => {
    expect(estrelasCheias(null)).toBe(0)
    expect(estrelasCheias(4.7)).toBe(5)
    expect(estrelasCheias(4.4)).toBe(4)
  })

  it("nota fora de 1..5 não é nota", () => {
    expect(notaValida(0)).toBe(false)
    expect(notaValida(6)).toBe(false)
    expect(notaValida(3.5)).toBe(false)
    expect(notaValida(3)).toBe(true)
  })
})
