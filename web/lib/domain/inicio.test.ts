import { describe, expect, it } from "vitest"
import {
  apoioDaRevisao,
  contagemDaSaude,
  estadoExibidoDaSaude,
  horasDoMotor,
  linkDoFator,
  rotuloDaSaude,
  seloDaSaude,
  seloDoMar,
  textoUltimaSaida,
  variacaoDoMes,
} from "./inicio"
import type { FatorSaude, SaudeEmbarcacao } from "./saude"

const fator = (over: Partial<FatorSaude> = {}): FatorSaude => ({
  tipo: "manutencao", id: "f-1", nome: "Troca de óleo", aba: "motores",
  detalhe: "Vencido", critico: false, peso: 4, farol: "atencao", ...over,
})

const saude = (over: Partial<SaudeEmbarcacao> = {}): SaudeEmbarcacao => ({
  estado: "saudavel", emDia: 0, atencao: 0, vencido: 0, total: 0, fatores: [], ...over,
})

// =====================================================================
// O estado que a Início MOSTRA nem sempre é o que a régua calcula — e o
// motivo é honestidade, não estilo (docs/DESIGN.md §6, regra 7).
// =====================================================================

describe("estadoExibidoDaSaude", () => {
  it("mostra o estado da régua quando existe dado real por trás", () => {
    expect(estadoExibidoDaSaude(saude({ estado: "saudavel", emDia: 3, total: 3 }), true)).toBe("saudavel")
    expect(estadoExibidoDaSaude(saude({ estado: "atencao", fatores: [fator()] }), true)).toBe("atencao")
  })

  it("não diz 'Saudável' pra barco recém-cadastrado que nunca teve leitura nem data", () => {
    // O onboarding cria itens com `ultimo_ciclo_data = hoje` e
    // `intervalo_meses = 12` (lib/acoes/onboarding.ts): pra régua da Saúde
    // isso é "informação suficiente" e o barco nasce "Saudável" sem ninguém
    // ter digitado nada. É a MESMA mentira que o bloco de atenção já
    // recusava com `temDadoReal` — aqui ela para de aparecer em verde ao
    // lado da foto.
    expect(estadoExibidoDaSaude(saude({ estado: "saudavel", emDia: 4, total: 4 }), false)).toBeNull()
  })

  it("mas uma pendência viva vale por si, mesmo sem leitura de horas", () => {
    // Ocorrência aberta é fato informado pela pessoa: não depende de
    // horímetro nenhum pra ser verdade.
    const comOcorrencia = saude({
      estado: "acao_necessaria",
      fatores: [fator({ tipo: "ocorrencia", critico: true, farol: "vencido" })],
    })
    expect(estadoExibidoDaSaude(comOcorrencia, false)).toBe("acao_necessaria")
  })

  it("estado nulo da régua continua nulo", () => {
    expect(estadoExibidoDaSaude(saude({ estado: null }), true)).toBeNull()
  })
})

describe("seloDaSaude e rotuloDaSaude", () => {
  it("traduz os três estados do PRD pro vocabulário do Selo", () => {
    expect(seloDaSaude("saudavel")).toBe("ok")
    expect(seloDaSaude("atencao")).toBe("atencao")
    expect(seloDaSaude("acao_necessaria")).toBe("critico")
  })

  it("sem estado, o selo é neutro — nunca verde por omissão", () => {
    expect(seloDaSaude(null)).toBe("neutro")
    expect(rotuloDaSaude(null)).toBe("Sem dados")
  })

  it("usa a palavra do PRD §5, sem porcentagem nenhuma", () => {
    expect(rotuloDaSaude("saudavel")).toBe("Saudável")
    expect(rotuloDaSaude("acao_necessaria")).toBe("Ação necessária")
    for (const e of [null, "saudavel", "atencao", "acao_necessaria"] as const) {
      expect(rotuloDaSaude(e)).not.toMatch(/[0-9%]/)
    }
  })
})

describe("seloDoMar", () => {
  it("o boletim usa o mesmo vocabulário de estado do barco", () => {
    expect(seloDoMar("ok")).toBe("ok")
    expect(seloDoMar("atencao")).toBe("atencao")
    expect(seloDoMar("crit")).toBe("critico")
  })
})

describe("contagemDaSaude", () => {
  it("conta em uma linha só, do melhor pro pior", () => {
    expect(contagemDaSaude(saude({ emDia: 5, atencao: 1, vencido: 2, total: 8 })))
      .toBe("5 em dia · 1 em atenção · 2 vencidos")
  })

  it("omite o que é zero — '0 vencidos' é ruído, não informação", () => {
    expect(contagemDaSaude(saude({ emDia: 5, total: 5 }))).toBe("5 em dia")
    expect(contagemDaSaude(saude({ atencao: 2, total: 2 }))).toBe("2 em atenção")
  })

  it("concorda em número na única palavra que varia", () => {
    expect(contagemDaSaude(saude({ vencido: 1, total: 1 }))).toBe("1 vencido")
    expect(contagemDaSaude(saude({ vencido: 3, total: 3 }))).toBe("3 vencidos")
  })

  it("sem item com informação suficiente, não inventa contagem", () => {
    expect(contagemDaSaude(saude({ total: 0 }))).toBeNull()
  })
})

describe("horasDoMotor", () => {
  it("uma casa decimal e vírgula — é leitura de horímetro, não número redondo", () => {
    expect(horasDoMotor({ horas_atuais: 612 })).toBe("612,0 h")
    expect(horasDoMotor({ horas_atuais: 1284.5 })).toBe("1.284,5 h")
  })

  it("sem leitura, um traço — nunca zero, que seria mentira de motor novo", () => {
    expect(horasDoMotor({ horas_atuais: null })).toBe("—")
  })
})

describe("apoioDaRevisao", () => {
  it("conta pra frente quando ainda dá tempo", () => {
    expect(apoioDaRevisao({ status: "atencao", horasRestantes: 37.4, diasRestantes: null })).toBe("Revisão em 37h")
    expect(apoioDaRevisao({ status: "atencao", horasRestantes: null, diasRestantes: 12 })).toBe("Revisão em 12 dias")
  })

  it("diz vencida com todas as letras — é o fato consumado", () => {
    expect(apoioDaRevisao({ status: "vencido", horasRestantes: -12, diasRestantes: null })).toBe("Revisão vencida há 12h")
    expect(apoioDaRevisao({ status: "vencido", horasRestantes: null, diasRestantes: -3 })).toBe("Revisão vencida há 3 dias")
  })

  it("horas mandam sobre dias: é o prazo mais preciso de motor", () => {
    expect(apoioDaRevisao({ status: "atencao", horasRestantes: 20, diasRestantes: 300 })).toBe("Revisão em 20h")
  })

  it("sem item de revisão, admite que não sabe", () => {
    expect(apoioDaRevisao(null)).toBe("Sem revisão programada")
    expect(apoioDaRevisao({ status: "ok", horasRestantes: null, diasRestantes: null })).toBe("Sem revisão programada")
  })
})

describe("textoUltimaSaida", () => {
  it("data curta e tempo no mar quando os dois horários existem", () => {
    expect(textoUltimaSaida({ data: "2026-08-12", hora_saida: "08:00", hora_retorno: "12:30" }, "2026"))
      .toBe("Última saída em 12/08 · 4,5 h no mar")
  })

  it("sem horário, só a data — nunca uma duração inventada", () => {
    expect(textoUltimaSaida({ data: "2026-08-12", hora_saida: null, hora_retorno: null }, "2026"))
      .toBe("Última saída em 12/08")
  })

  it("sem saída, diz o ano de que está falando", () => {
    // A consulta da Início cobre o ano corrente. Dizer "nenhuma saída
    // registrada" seco seria falso pra quem navegou em dezembro passado.
    expect(textoUltimaSaida(null, "2026")).toBe("Nenhuma saída registrada em 2026.")
  })
})

describe("linkDoFator", () => {
  it("manutenção leva pro item, quando a pessoa pode editar a área dele", () => {
    expect(linkDoFator(fator({ id: "item-9" }), true)).toBe("/barco/itens/item-9/editar")
  })

  it("sem permissão de edição, a linha não vira link pra uma tela que recusa", () => {
    expect(linkDoFator(fator({ id: "item-9" }), false)).toBeUndefined()
  })

  it("ocorrência leva pra própria ocorrência, que é leitura", () => {
    expect(linkDoFator(fator({ tipo: "ocorrencia", id: "oc-3" }), false)).toBe("/barco/ocorrencias/oc-3")
  })
})

describe("variacaoDoMes", () => {
  it("descreve a variação em palavras, sem sinal de mais nem cor", () => {
    // Vermelho é do estado do barco (PRD §1.1) — gastar 20% a mais que o
    // mês passado não é uma emergência náutica.
    expect(variacaoDoMes(20)).toBe("20% acima do mês anterior")
    expect(variacaoDoMes(-15)).toBe("15% abaixo do mês anterior")
    expect(variacaoDoMes(0)).toBe("igual ao mês anterior")
  })

  it("sem os dois meses, não compara", () => {
    expect(variacaoDoMes(null)).toBeUndefined()
  })
})
