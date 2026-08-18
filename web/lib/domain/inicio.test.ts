import { describe, expect, it } from "vitest"
import {
  apoioDaRevisao,
  contagemDaSaude,
  estadoExibidoDaSaude,
  horasDoMotor,
  idadeCompacta,
  linkDoFator,
  prazoCompacto,
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
  it("a linha do canvas: o pior primeiro, ocorrência aberta incluída", () => {
    // tela-1b: "1 vencido · 2 na margem · 1 ocorrência aberta"
    expect(contagemDaSaude(saude({ emDia: 5, atencao: 2, vencido: 1, total: 8 }), 1))
      .toEqual([
        { numero: 1, rotulo: "vencido" },
        { numero: 2, rotulo: "na margem" },
        { numero: 1, rotulo: "ocorrência aberta" },
      ])
  })

  it("com problema na linha, 'em dia' sai — o resumo é do que pede ação, não um censo", () => {
    expect(contagemDaSaude(saude({ emDia: 5, atencao: 2, total: 7 })))
      .toEqual([{ numero: 2, rotulo: "na margem" }])
  })

  it("sem nenhum problema, aí sim 'N em dia' é a informação", () => {
    expect(contagemDaSaude(saude({ emDia: 5, total: 5 }))).toEqual([{ numero: 5, rotulo: "em dia" }])
  })

  it("omite o que é zero — '0 vencidos' é ruído, não informação", () => {
    expect(contagemDaSaude(saude({ atencao: 2, total: 2 }))).toEqual([{ numero: 2, rotulo: "na margem" }])
  })

  it("concorda em número nas palavras que variam", () => {
    expect(contagemDaSaude(saude({ vencido: 1, total: 1 }))).toEqual([{ numero: 1, rotulo: "vencido" }])
    expect(contagemDaSaude(saude({ vencido: 3, total: 3 }))).toEqual([{ numero: 3, rotulo: "vencidos" }])
    expect(contagemDaSaude(saude({ total: 0 }), 2)).toEqual([{ numero: 2, rotulo: "ocorrências abertas" }])
  })

  it("barco cuja única pendência é ocorrência não fica mudo — o bug que a onda 62 fechou", () => {
    // Antes: selo âmbar ao lado de "Nenhum item monitorado com data ou
    // leitura." — o resumo ignorava a ocorrência que causou o âmbar.
    expect(contagemDaSaude(saude({ total: 0 }), 1)).toEqual([{ numero: 1, rotulo: "ocorrência aberta" }])
  })

  it("separa número de palavra — a fonte de instrumento é só do número", () => {
    // A garantia do achado: nenhuma parte carrega o numeral dentro do texto,
    // senão a tela volta a ter palavra em monoespaçada.
    for (const parte of contagemDaSaude(saude({ emDia: 5, atencao: 1, vencido: 2, total: 8 }), 3) ?? []) {
      expect(parte.rotulo).not.toMatch(/\d/)
    }
  })

  it("sem item com informação suficiente e sem ocorrência, não inventa contagem", () => {
    expect(contagemDaSaude(saude({ total: 0 }))).toBeNull()
  })
})

describe("prazoCompacto", () => {
  it("o mostrador do canvas: vencido negativo, na margem positivo", () => {
    // tela-1b: "-19 d" no seguro vencido, "18 h" na troca de óleo
    expect(prazoCompacto({ status: "vencido", horasRestantes: null, diasRestantes: -19 })).toBe("-19 d")
    expect(prazoCompacto({ status: "atencao", horasRestantes: 18.2, diasRestantes: null })).toBe("18 h")
    expect(prazoCompacto({ status: "atencao", horasRestantes: null, diasRestantes: 6 })).toBe("6 d")
  })

  it("horas mandam sobre dias — a mesma prioridade de textoRestanteCompacto, não uma segunda régua", () => {
    expect(prazoCompacto({ status: "atencao", horasRestantes: 20, diasRestantes: 300 })).toBe("20 h")
  })

  it("vencido há menos de meia hora vira '0 h', nunca '-0 h'", () => {
    expect(prazoCompacto({ status: "vencido", horasRestantes: -0.4, diasRestantes: null })).toBe("0 h")
  })

  it("sem prazo nenhum, um traço", () => {
    expect(prazoCompacto({ status: "ok", horasRestantes: null, diasRestantes: null })).toBe("—")
  })
})

describe("idadeCompacta", () => {
  it("há quanto tempo a ocorrência existe — o único número honesto de quem não tem prazo", () => {
    // tela-1b: "6 d" no vazamento em acompanhamento
    expect(idadeCompacta("2026-08-10T14:32:00Z", "2026-08-16")).toBe("6 d")
    expect(idadeCompacta("2026-08-16T08:00:00Z", "2026-08-16")).toBe("0 d")
  })

  it("carimbo no futuro é relógio errado, não idade negativa", () => {
    expect(idadeCompacta("2026-08-20T00:00:00Z", "2026-08-16")).toBe("0 d")
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

  it("motor legitimamente zerado mostra 0,0 h — o traço é de FALTA de dado, não de zero", () => {
    // Motor novo com horímetro em zero é uma leitura de verdade: alguém
    // digitou 0. Confundir isso com "sem dado" apagaria a única informação
    // que separa "motor recém-instalado" de "ninguém nunca leu o horímetro".
    expect(horasDoMotor({ horas_atuais: 0 })).toBe("0,0 h")
  })
})

describe("apoioDaRevisao", () => {
  it("conta pra frente quando ainda dá tempo", () => {
    expect(apoioDaRevisao({ status: "atencao", horasRestantes: 37.4, diasRestantes: null })).toBe("Revisão em 37 h")
    expect(apoioDaRevisao({ status: "atencao", horasRestantes: null, diasRestantes: 12 })).toBe("Revisão em 12 dias")
  })

  it("diz vencida com todas as letras — é o fato consumado", () => {
    expect(apoioDaRevisao({ status: "vencido", horasRestantes: -12, diasRestantes: null })).toBe("Revisão vencida há 12 h")
    expect(apoioDaRevisao({ status: "vencido", horasRestantes: null, diasRestantes: -3 })).toBe("Revisão vencida há 3 dias")
  })

  it("horas mandam sobre dias: é o prazo mais preciso de motor", () => {
    expect(apoioDaRevisao({ status: "atencao", horasRestantes: 20, diasRestantes: 300 })).toBe("Revisão em 20 h")
  })

  it("sem item de revisão, admite que não sabe", () => {
    expect(apoioDaRevisao(null)).toBe("Sem revisão programada")
    expect(apoioDaRevisao({ status: "ok", horasRestantes: null, diasRestantes: null })).toBe("Sem revisão programada")
  })

  it("revisão vencida há pouco NÃO pode aparecer como 'Revisão em 0h'", () => {
    // O bug: quem decidia "vencida" era o SINAL do número arredondado, e
    // `Math.round(-0.4)` é `-0` — e `-0 < 0` é `false`. Uma revisão vencida
    // há 24 minutos virava "Revisão em 0h", o oposto do fato, no cartão que
    // existe pra avisar. Quem decide é o `status`, que vem no mesmo objeto.
    expect(apoioDaRevisao({ status: "vencido", horasRestantes: -0.4, diasRestantes: null }))
      .toBe("Revisão vencida")
    expect(apoioDaRevisao({ status: "vencido", horasRestantes: -0.4, diasRestantes: null }))
      .not.toMatch(/Revisão em/)
  })

  it("vencida por DATA com horímetro folgado fala da data, não das horas", () => {
    // `calcularSemaforo` devolve o PIOR dos dois prazos: um item com data
    // fixa vencida e horas sobrando sai `status: "vencido"` com
    // `horasRestantes` positivo. Citar as horas aqui ("Revisão em 200h")
    // esconderia exatamente o vencimento que fez o status ser vencido.
    expect(apoioDaRevisao({ status: "vencido", horasRestantes: 200, diasRestantes: -5 }))
      .toBe("Revisão vencida há 5 dias")
  })
})

describe("textoUltimaSaida", () => {
  it("a frase do canvas: data por extenso e a duração na voz de textoDuracao", () => {
    // tela-1b: "Última saída em 9 de agosto — Angra dos Reis, 4 h 20 no mar."
    // (o destino não entra: a consulta da Início não o busca — nada de dado
    // novo por causa de frase).
    expect(textoUltimaSaida({ data: "2026-08-12", hora_saida: "08:00", hora_retorno: "12:30" }, "2026"))
      .toBe("Última saída em 12 de agosto — 4 h 30 no mar.")
    expect(textoUltimaSaida({ data: "2026-08-09", hora_saida: "08:30", hora_retorno: "12:50" }, "2026"))
      .toBe("Última saída em 9 de agosto — 4 h 20 no mar.")
  })

  it("sem horário, só a data — nunca uma duração inventada", () => {
    expect(textoUltimaSaida({ data: "2026-08-12", hora_saida: null, hora_retorno: null }, "2026"))
      .toBe("Última saída em 12 de agosto.")
  })

  it("com só um dos dois horários, omite a duração — nunca NaN nem um zero inventado", () => {
    // O <input type="time"> deixa gravar só a saída (quem registra antes de
    // voltar). Sem os dois lados não existe duração: a frase tem que ficar
    // só com a data, e não virar "NaN h no mar" nem "0 h no mar".
    const sóSaída = textoUltimaSaida({ data: "2026-08-12", hora_saida: "08:00", hora_retorno: null }, "2026")
    expect(sóSaída).toBe("Última saída em 12 de agosto.")
    const sóRetorno = textoUltimaSaida({ data: "2026-08-12", hora_saida: null, hora_retorno: "12:30" }, "2026")
    expect(sóRetorno).toBe("Última saída em 12 de agosto.")
    for (const frase of [sóSaída, sóRetorno]) {
      expect(frase).not.toMatch(/NaN/)
      expect(frase).not.toMatch(/no mar/)
    }
  })

  it("saída que atravessa a meia-noite diz isso em voz alta", () => {
    // "22:00 → 01:30" são 3,5 h de verdade (`duracaoHoras` já conta a
    // virada), mas sem a marca a conta parece errada — a frase vira "saiu
    // às 22h e ficou 3,5 h no mar" num dia que acabou às 24h. A mesma
    // palavra que /diario/[id] usa, pela regra 6 do DESIGN: duas telas que
    // dizem a mesma coisa dizem com as mesmas palavras.
    expect(textoUltimaSaida({ data: "2026-08-12", hora_saida: "22:00", hora_retorno: "01:30" }, "2026"))
      .toBe("Última saída em 12 de agosto — 3 h 30 no mar, retorno no dia seguinte.")
  })

  it("saída no mesmo dia não ganha a marca de virada", () => {
    expect(textoUltimaSaida({ data: "2026-08-12", hora_saida: "08:00", hora_retorno: "12:30" }, "2026"))
      .not.toMatch(/dia seguinte/)
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
