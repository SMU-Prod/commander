import { describe, expect, it } from "vitest"
import { formatarReais } from "./gastos"
import {
  avaliacaoLiberada,
  calcularExpiracao,
  calcularMetricasComerciais,
  CAMPOS_PROPOSTA,
  contarPorTipo,
  demandaExpirada,
  demandaViva,
  demandasCompativeis,
  diasAteExpirar,
  DIAS_PADRAO_EXPIRACAO,
  estadoDoNegocio,
  etapaComercial,
  faltaConfirmacaoDe,
  filtroTipoDemandaValido,
  formatarDiaCurto,
  interesseAtendeDemanda,
  propostaTem,
  resumoDaProposta,
  rotuloDaResposta,
  ROTULO_CURTO_TIPO_DEMANDA,
  taxonomiaDaCategoria,
  tempoRelativo,
  tituloDaDemanda,
  tituloDaDisponibilidade,
  TIPOS_DEMANDA,
  usuariosCompativeis,
  type ConfirmacaoNegocio,
  type DemandaParaMatching,
  type InteresseParaMatching,
} from "./marketplace"

// ---------------------------------------------------------------------------
// §11.2 — o Commander gera o título
// ---------------------------------------------------------------------------
describe("tituloDaDemanda — os 5 exemplos do PRD §11.1", () => {
  it("profissional: 'eletricista em Angra' sai dos campos, não de texto digitado", () => {
    expect(
      tituloDaDemanda({ tipo: "profissional", regiaoNome: "Angra dos Reis", categoriaNome: "Elétrica" }),
    ).toBe("Serviço de Elétrica em Angra dos Reis")
  })

  it("tripulação: função + região + a data da saída", () => {
    expect(
      tituloDaDemanda({
        tipo: "tripulacao", regiaoNome: "Paraty", funcaoNome: "Marinheiro", dataDesejada: "2026-08-22",
      }),
    ).toBe("Marinheiro em Paraty — 22/08")
  })

  it("tripulação com período: mostra os dois extremos", () => {
    expect(
      tituloDaDemanda({
        tipo: "tripulacao", regiaoNome: "Ilhabela", funcaoNome: "Comandante",
        dataDesejada: "2026-12-26", dataFim: "2027-01-05",
      }),
    ).toBe("Comandante em Ilhabela — 26/12 a 05/01")
  })

  it("produto: 'Compro' + categoria, com marca quando informada", () => {
    expect(
      tituloDaDemanda({ tipo: "produto", regiaoNome: "Angra dos Reis", categoriaNome: "Rádio e comunicação" }),
    ).toBe("Compro Rádio e comunicação — Angra dos Reis")
    expect(
      tituloDaDemanda({
        tipo: "produto", regiaoNome: "Niterói", categoriaNome: "Eletrônica e navegação", marcaNome: "Garmin",
      }),
    ).toBe("Compro Eletrônica e navegação Garmin — Niterói")
  })

  it("vaga: 'vaga molhada para 80 pés', igual ao exemplo do PRD", () => {
    expect(
      tituloDaDemanda({ tipo: "vaga_embarcacao", regiaoNome: "Angra dos Reis", portePes: 80, tipoVaga: "molhada" }),
    ).toBe("Vaga molhada para 80 pés em Angra dos Reis")
  })

  it("caminhão: '1.500 L de diesel', com separador de milhar pt-BR", () => {
    expect(
      tituloDaDemanda({
        tipo: "caminhao", regiaoNome: "Angra dos Reis", combustivelNome: "Diesel S10", quantidadeLitros: 1500,
      }),
    ).toBe("1.500 L de Diesel S10 em Angra dos Reis")
  })

  it("nunca fica sem título, mesmo com taxonomia faltando", () => {
    for (const tipo of TIPOS_DEMANDA) {
      const t = tituloDaDemanda({ tipo, regiaoNome: "Outra região" })
      expect(t.length).toBeGreaterThan(0)
      expect(t).toContain("Outra região")
    }
  })

  it("data única repetida em início e fim não vira intervalo bobo", () => {
    expect(
      tituloDaDemanda({
        tipo: "tripulacao", regiaoNome: "Búzios", funcaoNome: "Marinheiro",
        dataDesejada: "2026-08-22", dataFim: "2026-08-22",
      }),
    ).toBe("Marinheiro em Búzios — 22/08")
  })
})

describe("formatarDiaCurto", () => {
  it("não escorrega de fuso (new Date('2026-08-22') seria 21/08 no Brasil)", () => {
    expect(formatarDiaCurto("2026-08-22")).toBe("22/08")
    expect(formatarDiaCurto("2026-01-01")).toBe("01/01")
  })
})

describe("tituloDaDisponibilidade (§11.3)", () => {
  it("monta a partir de função, tipo de trabalho, região e período", () => {
    expect(
      tituloDaDisponibilidade({
        funcaoNome: "Comandante", regiaoNome: "Angra dos Reis", tipoTrabalho: "temporada",
        dataInicio: "2026-12-20", dataFim: "2027-01-10",
      }),
    ).toBe("Comandante — Temporada em Angra dos Reis — 20/12 a 10/01")
  })
})

// ---------------------------------------------------------------------------
// §11.2 — expiração
// ---------------------------------------------------------------------------
describe("calcularExpiracao (§11.2)", () => {
  it("sem data específica: 30 dias, o padrão do PRD", () => {
    expect(calcularExpiracao("2026-08-15T12:00:00.000Z", null, null)).toBe("2026-09-14")
    expect(DIAS_PADRAO_EXPIRACAO).toBe(30)
  })

  it("com data desejada: usa o prazo da própria demanda, não os 30 dias", () => {
    expect(calcularExpiracao("2026-08-15T12:00:00.000Z", "2026-08-22", null)).toBe("2026-08-22")
  })

  it("com período: vence no fim do período", () => {
    expect(calcularExpiracao("2026-08-15T12:00:00.000Z", "2026-08-22", "2026-08-25")).toBe("2026-08-25")
  })

  it("a demanda de sábado morre no sábado, mesmo sendo daqui a 2 dias", () => {
    const expira = calcularExpiracao("2026-08-15T12:00:00.000Z", "2026-08-17", null)
    expect(demandaExpirada(expira, "2026-08-18")).toBe(true)
  })
})

describe("demandaExpirada / diasAteExpirar", () => {
  it("vence NO dia, não antes", () => {
    expect(demandaExpirada("2026-08-22", "2026-08-22")).toBe(false)
    expect(demandaExpirada("2026-08-22", "2026-08-23")).toBe(true)
  })

  it("conta dias inclusive virando o mês e o ano", () => {
    expect(diasAteExpirar("2026-08-22", "2026-08-22")).toBe(0)
    expect(diasAteExpirar("2026-09-01", "2026-08-30")).toBe(2)
    expect(diasAteExpirar("2027-01-02", "2026-12-31")).toBe(2)
    expect(diasAteExpirar("2026-08-20", "2026-08-22")).toBe(-2)
  })
})

describe("demandaViva — mesma condição da RLS", () => {
  it("aberta no prazo está viva; fechada ou vencida, não", () => {
    expect(demandaViva({ status: "aberta", expira_em: "2026-08-22" }, "2026-08-15")).toBe(true)
    expect(demandaViva({ status: "em_negociacao", expira_em: "2026-08-22" }, "2026-08-15")).toBe(true)
    expect(demandaViva({ status: "aberta", expira_em: "2026-08-10" }, "2026-08-15")).toBe(false)
    expect(demandaViva({ status: "fechada", expira_em: "2026-08-22" }, "2026-08-15")).toBe(false)
    expect(demandaViva({ status: "cancelada", expira_em: "2026-08-22" }, "2026-08-15")).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// §11.4 — matching determinístico
// ---------------------------------------------------------------------------
const ANGRA = "regiao-angra"
const PARATY = "regiao-paraty"
const ELETRICA = "cat-eletrica"
const MECANICA = "cat-mecanica"
const MARINHEIRO = "func-marinheiro"
const COMANDANTE = "func-comandante"
const DIESEL = "comb-diesel"
const GASOLINA = "comb-gasolina"

const interesse = (over: Partial<InteresseParaMatching> = {}): InteresseParaMatching => ({
  usuario_id: "u1",
  tipo_demanda: "profissional",
  regiao_id: ANGRA,
  categoria_id: null,
  funcao_id: null,
  combustivel_id: null,
  porte_max_pes: null,
  ativo: true,
  ...over,
})

const demanda = (over: Partial<DemandaParaMatching> = {}): DemandaParaMatching => ({
  tipo: "profissional",
  regiao_id: ANGRA,
  categoria_id: ELETRICA,
  funcao_id: null,
  combustivel_id: null,
  porte_pes: null,
  ...over,
})

describe("interesseAtendeDemanda (§11.4)", () => {
  it("mesma região + mesmo tipo, sem categoria marcada = recebe tudo da região", () => {
    expect(interesseAtendeDemanda(interesse(), demanda())).toBe(true)
  })

  it("região diferente nunca bate — é a primeira eliminatória do PRD", () => {
    expect(interesseAtendeDemanda(interesse({ regiao_id: PARATY }), demanda())).toBe(false)
  })

  it("tipo de demanda diferente nunca bate", () => {
    expect(interesseAtendeDemanda(interesse({ tipo_demanda: "produto" }), demanda())).toBe(false)
  })

  it("categoria marcada filtra: eletricista não recebe pedido de mecânica", () => {
    expect(interesseAtendeDemanda(interesse({ categoria_id: ELETRICA }), demanda())).toBe(true)
    expect(interesseAtendeDemanda(interesse({ categoria_id: MECANICA }), demanda())).toBe(false)
  })

  it("interesse desativado não recebe nada", () => {
    expect(interesseAtendeDemanda(interesse({ ativo: false }), demanda())).toBe(false)
  })

  it("função filtra candidatura de tripulação", () => {
    const d = demanda({ tipo: "tripulacao", categoria_id: null, funcao_id: MARINHEIRO })
    expect(interesseAtendeDemanda(interesse({ tipo_demanda: "tripulacao", funcao_id: MARINHEIRO }), d)).toBe(true)
    expect(interesseAtendeDemanda(interesse({ tipo_demanda: "tripulacao", funcao_id: COMANDANTE }), d)).toBe(false)
    // sem função marcada = qualquer função
    expect(interesseAtendeDemanda(interesse({ tipo_demanda: "tripulacao" }), d)).toBe(true)
  })

  it("combustível filtra solicitação de caminhão", () => {
    const d = demanda({ tipo: "caminhao", categoria_id: null, combustivel_id: DIESEL })
    expect(interesseAtendeDemanda(interesse({ tipo_demanda: "caminhao", combustivel_id: DIESEL }), d)).toBe(true)
    expect(interesseAtendeDemanda(interesse({ tipo_demanda: "caminhao", combustivel_id: GASOLINA }), d)).toBe(false)
  })

  it("porte máximo é TETO: marina de 80 pés recebe a de 60, não a de 100", () => {
    const marina = (max: number) => interesse({ tipo_demanda: "vaga_embarcacao", porte_max_pes: max })
    const vaga = (pes: number) => demanda({ tipo: "vaga_embarcacao", categoria_id: null, porte_pes: pes })
    expect(interesseAtendeDemanda(marina(80), vaga(60))).toBe(true)
    expect(interesseAtendeDemanda(marina(80), vaga(80))).toBe(true)
    expect(interesseAtendeDemanda(marina(80), vaga(100))).toBe(false)
    // marina sem teto declarado recebe todas
    expect(interesseAtendeDemanda(interesse({ tipo_demanda: "vaga_embarcacao" }), vaga(100))).toBe(true)
  })

  it("é determinístico: mesma entrada, mesma resposta, sempre", () => {
    const i = interesse({ categoria_id: ELETRICA })
    const d = demanda()
    const respostas = Array.from({ length: 20 }, () => interesseAtendeDemanda(i, d))
    expect(new Set(respostas).size).toBe(1)
  })
})

describe("demandasCompativeis / usuariosCompativeis", () => {
  it("filtra sem reordenar — a ordem que chegou é a ordem que fica", () => {
    const lista = [
      { ...demanda(), id: "a" },
      { ...demanda({ regiao_id: PARATY }), id: "b" },
      { ...demanda({ categoria_id: MECANICA }), id: "c" },
    ]
    const meus = [interesse({ categoria_id: ELETRICA })]
    expect(demandasCompativeis(lista, meus).map((d) => d.id)).toEqual(["a"])

    const todos = [interesse()]
    expect(demandasCompativeis(lista, todos).map((d) => d.id)).toEqual(["a", "c"])
  })

  it("sem interesse cadastrado, nada é compatível (e não é o mesmo que 'tudo')", () => {
    expect(demandasCompativeis([{ ...demanda(), id: "a" }], [])).toEqual([])
  })

  it("usuários vêm sem repetição e em ordem estável", () => {
    const interesses = [
      interesse({ usuario_id: "zeca", categoria_id: ELETRICA }),
      interesse({ usuario_id: "ana" }),
      interesse({ usuario_id: "ana", categoria_id: ELETRICA }),
      interesse({ usuario_id: "bia", regiao_id: PARATY }),
    ]
    expect(usuariosCompativeis(demanda(), interesses)).toEqual(["ana", "zeca"])
  })
})

// ---------------------------------------------------------------------------
// §11.5 — campos por tipo
// ---------------------------------------------------------------------------
describe("CAMPOS_PROPOSTA (§11.5)", () => {
  it("cobre os cinco tipos, sem lista vazia", () => {
    for (const tipo of TIPOS_DEMANDA) expect(CAMPOS_PROPOSTA[tipo].length).toBeGreaterThan(0)
  })

  it("serviço tem 'necessidade de visita'; produto não", () => {
    expect(propostaTem("profissional", "precisa_visita")).toBe(true)
    expect(propostaTem("produto", "precisa_visita")).toBe(false)
  })

  it("produto tem marca/modelo, condição, entrega e prazo", () => {
    for (const c of ["marca_modelo", "condicao", "entrega", "prazo_dias"] as const) {
      expect(propostaTem("produto", c)).toBe(true)
    }
  })

  it("marina tem tipo de vaga, período e água/energia", () => {
    for (const c of ["tipo_vaga", "periodo", "agua_energia"] as const) {
      expect(propostaTem("vaga_embarcacao", c)).toBe(true)
    }
  })

  it("posto tem preço/L, quantidade, taxa de deslocamento e valor estimado", () => {
    for (const c of ["preco_litro", "quantidade_litros", "taxa_deslocamento", "valor_estimado"] as const) {
      expect(propostaTem("caminhao", c)).toBe(true)
    }
  })

  it("tripulação puxa o perfil profissional", () => {
    expect(propostaTem("tripulacao", "perfil_profissional")).toBe(true)
  })

  it("responder uma vaga é 'candidatura'; o resto é 'proposta'", () => {
    expect(rotuloDaResposta("tripulacao")).toBe("candidatura")
    expect(rotuloDaResposta("profissional")).toBe("proposta")
  })
})

describe("taxonomiaDaCategoria", () => {
  it("serviço para profissional, produto para compra, nada para os outros", () => {
    expect(taxonomiaDaCategoria("profissional")).toBe("categoria_servico")
    expect(taxonomiaDaCategoria("produto")).toBe("categoria_produto")
    expect(taxonomiaDaCategoria("tripulacao")).toBeNull()
    expect(taxonomiaDaCategoria("vaga_embarcacao")).toBeNull()
    expect(taxonomiaDaCategoria("caminhao")).toBeNull()
  })
})

describe("resumoDaProposta", () => {
  it("só mostra o que o tipo usa — valor de produto não vaza campo de posto", () => {
    const linhas = resumoDaProposta("produto", {
      marca_modelo: "Icom IC-M330", condicao: "novo", valor_centavos: 189000,
      entrega: "ambos", prazo_dias: 3, preco_litro_centavos: 640,
    })
    // Dinheiro sai de `formatarReais` (lib/domain/gastos.ts) — a expectativa
    // usa a mesma função de propósito: escrever "R$ 1.890,00" à mão aqui
    // testaria o espaço estreito do Intl, não a regra do Marketplace.
    expect(linhas).toEqual([
      "Icom IC-M330", "Novo", formatarReais(189000), "Entrego ou retirada", "Prazo 3 dias",
    ])
  })

  it("posto: preço por litro, quantidade e estimativa", () => {
    expect(
      resumoDaProposta("caminhao", {
        preco_litro_centavos: 640, quantidade_litros: 1500,
        taxa_deslocamento_centavos: 0, valor_estimado_centavos: 960000,
      }),
    ).toEqual([
      `${formatarReais(640)}/L`, "1.500 L", "Sem taxa de deslocamento", `Estimado ${formatarReais(960000)}`,
    ])
  })

  it("'a combinar' aparece como texto, não como R$ 0,00", () => {
    expect(resumoDaProposta("profissional", { valor_a_combinar: true })).toEqual(["Valor a combinar"])
  })

  it("prazo 0 vira 'Pronta entrega' e 1 dia fica no singular", () => {
    expect(resumoDaProposta("produto", { prazo_dias: 0 })).toEqual(["Pronta entrega"])
    expect(resumoDaProposta("produto", { prazo_dias: 1 })).toEqual(["Prazo 1 dia"])
  })

  it("proposta vazia não inventa linha nenhuma", () => {
    expect(resumoDaProposta("profissional", {})).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// §11.6 — confirmação bilateral
// ---------------------------------------------------------------------------
const conf = (
  usuario_id: string,
  papel: "cliente" | "fornecedor",
  decisao: "realizado" | "confirmado" | "negado",
): ConfirmacaoNegocio => ({ usuario_id, papel, decisao })

describe("estadoDoNegocio (§11.6)", () => {
  it("um lado marcou realizado: ainda aguarda o outro", () => {
    expect(estadoDoNegocio([conf("dono", "cliente", "realizado")])).toBe("aguardando_confirmacao")
  })

  it("o outro confirmou: confirmado bilateralmente", () => {
    expect(
      estadoDoNegocio([conf("dono", "cliente", "realizado"), conf("presta", "fornecedor", "confirmado")]),
    ).toBe("confirmado")
  })

  it("os dois dizendo 'realizado' também é acordo", () => {
    expect(
      estadoDoNegocio([conf("dono", "cliente", "realizado"), conf("presta", "fornecedor", "realizado")]),
    ).toBe("confirmado")
  })

  it("negação de qualquer lado derruba, mesmo com o outro tendo confirmado", () => {
    expect(
      estadoDoNegocio([conf("dono", "cliente", "realizado"), conf("presta", "fornecedor", "negado")]),
    ).toBe("negado")
    expect(
      estadoDoNegocio([conf("dono", "cliente", "negado"), conf("presta", "fornecedor", "confirmado")]),
    ).toBe("negado")
  })

  it("sem declaração nenhuma não é confirmado", () => {
    expect(estadoDoNegocio([])).toBe("aguardando_confirmacao")
  })

  it("duas linhas do MESMO papel não confirmam nada (o banco já impede, a regra também)", () => {
    expect(
      estadoDoNegocio([conf("dono", "cliente", "realizado"), conf("dono2", "cliente", "confirmado")]),
    ).toBe("aguardando_confirmacao")
  })
})

describe("avaliacaoLiberada — o gancho da próxima onda (§14)", () => {
  it("só depois da confirmação bilateral, nunca antes", () => {
    expect(avaliacaoLiberada([conf("dono", "cliente", "realizado")])).toBe(false)
    expect(avaliacaoLiberada([conf("dono", "cliente", "realizado"), conf("p", "fornecedor", "negado")])).toBe(false)
    expect(avaliacaoLiberada([conf("dono", "cliente", "realizado"), conf("p", "fornecedor", "confirmado")])).toBe(true)
  })
})

describe("faltaConfirmacaoDe", () => {
  it("sabe quem ainda não se manifestou", () => {
    const cs = [conf("dono", "cliente", "realizado")]
    expect(faltaConfirmacaoDe(cs, "presta")).toBe(true)
    expect(faltaConfirmacaoDe(cs, "dono")).toBe(false)
  })
})

describe("etapaComercial (§11.6) — Solicitação → ... → Confirmação bilateral", () => {
  const base = { temProposta: false, temPropostaAceita: false, temNegocio: false, confirmacoes: [] }

  it("recém-publicada é Solicitação", () => {
    expect(etapaComercial(base)).toBe("solicitacao")
  })

  it("com proposta recebida vira Proposta", () => {
    expect(etapaComercial({ ...base, temProposta: true })).toBe("proposta")
  })

  it("proposta aceita já é Em negociação, sem ninguém carimbar campo", () => {
    expect(etapaComercial({ ...base, temProposta: true, temPropostaAceita: true })).toBe("em_negociacao")
  })

  it("um lado marcou realizado: Negócio realizado", () => {
    expect(
      etapaComercial({
        temProposta: true, temPropostaAceita: true, temNegocio: true,
        confirmacoes: [conf("dono", "cliente", "realizado")],
      }),
    ).toBe("negocio_realizado")
  })

  it("os dois confirmaram: Confirmado", () => {
    expect(
      etapaComercial({
        temProposta: true, temPropostaAceita: true, temNegocio: true,
        confirmacoes: [conf("dono", "cliente", "realizado"), conf("p", "fornecedor", "confirmado")],
      }),
    ).toBe("confirmado")
  })

  it("negado volta pra Em negociação — as partes ainda estão conversando", () => {
    expect(
      etapaComercial({
        temProposta: true, temPropostaAceita: true, temNegocio: true,
        confirmacoes: [conf("dono", "cliente", "realizado"), conf("p", "fornecedor", "negado")],
      }),
    ).toBe("em_negociacao")
  })
})

// ---------------------------------------------------------------------------
// §21.1 — métricas do Admin
// ---------------------------------------------------------------------------
describe("calcularMetricasComerciais (§21.1)", () => {
  const confirmado = (valor: number | null) => ({
    fornecedor_id: "p1",
    valor_final_centavos: valor,
    confirmacoes: [conf("dono", "cliente", "realizado"), conf("p1", "fornecedor", "confirmado")],
  })

  it("só conta negócio confirmado bilateralmente", () => {
    const m = calcularMetricasComerciais({
      demandasPublicadas: 10,
      propostasEnviadas: 25,
      negocios: [
        confirmado(100000),
        confirmado(300000),
        { fornecedor_id: "p2", valor_final_centavos: 999999, confirmacoes: [conf("dono", "cliente", "realizado")] },
      ],
    })
    expect(m.negociosConfirmados).toBe(2)
    expect(m.volumeInformadoCentavos).toBe(400000)
    expect(m.ticketMedioCentavos).toBe(200000)
    expect(m.conversaoPercentual).toBe(20)
  })

  it("negócio sem valor informado não entra na média (não vira zero)", () => {
    const m = calcularMetricasComerciais({
      demandasPublicadas: 2, propostasEnviadas: 2, negocios: [confirmado(100000), confirmado(null)],
    })
    expect(m.negociosConfirmados).toBe(2)
    expect(m.negociosComValor).toBe(1)
    expect(m.ticketMedioCentavos).toBe(100000)
  })

  it("sem dado nenhum não inventa 0% nem R$ 0 de ticket", () => {
    const m = calcularMetricasComerciais({ demandasPublicadas: 0, propostasEnviadas: 0, negocios: [] })
    expect(m.ticketMedioCentavos).toBeNull()
    expect(m.conversaoPercentual).toBeNull()
    expect(m.volumeInformadoCentavos).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Onda 62 (canvas tela-3i) — a apresentação do cartão e dos chips
// ---------------------------------------------------------------------------
describe("tempoRelativo — o carimbo de idade do cartão", () => {
  const AGORA = "2026-08-18T12:00:00Z"

  it("abaixo de um minuto é 'agora' — segundos não decidem nada", () => {
    expect(tempoRelativo("2026-08-18T11:59:30Z", AGORA)).toBe("agora")
  })

  it("minutos, depois horas, depois dias — os degraus do canvas", () => {
    expect(tempoRelativo("2026-08-18T11:25:00Z", AGORA)).toBe("há 35 min")
    expect(tempoRelativo("2026-08-18T10:00:00Z", AGORA)).toBe("há 2 h")
    expect(tempoRelativo("2026-08-15T12:00:00Z", AGORA)).toBe("há 3 dias")
    expect(tempoRelativo("2026-08-17T11:00:00Z", AGORA)).toBe("há 1 dia")
  })

  it("relógio adiantado ou data inválida viram 'agora', nunca 'há -3 min'", () => {
    expect(tempoRelativo("2026-08-18T13:00:00Z", AGORA)).toBe("agora")
    expect(tempoRelativo("não-é-data", AGORA)).toBe("agora")
  })
})

describe("contarPorTipo + filtroTipoDemandaValido — os chips com número", () => {
  it("conta por tipo e zera o que não tem demanda (pra tela esconder o chip)", () => {
    const c = contarPorTipo([
      { tipo: "profissional" }, { tipo: "profissional" }, { tipo: "vaga_embarcacao" },
    ])
    expect(c.profissional).toBe(2)
    expect(c.vaga_embarcacao).toBe(1)
    expect(c.produto).toBe(0)
    expect(c.caminhao).toBe(0)
  })

  it("filtro da URL: tipo válido passa, lixo vira null (Tudo), nunca erro", () => {
    expect(filtroTipoDemandaValido("tripulacao")).toBe("tripulacao")
    expect(filtroTipoDemandaValido("qualquer-coisa")).toBeNull()
    expect(filtroTipoDemandaValido(undefined)).toBeNull()
  })

  it("todo tipo tem rótulo curto — chip nunca fica sem nome", () => {
    for (const t of TIPOS_DEMANDA) {
      expect(ROTULO_CURTO_TIPO_DEMANDA[t]).toBeTruthy()
    }
  })
})
