import { describe, expect, it } from "vitest"
import {
  agruparPorDia,
  agruparPorPeriodo,
  camadaTemFonte,
  CAMADAS,
  CAMADAS_COM_FONTE,
  diaCompacto,
  diaDaSemana,
  diasDaSemana,
  ehCompartilhavel,
  ehHistorico,
  gradeDoMes,
  horaCurta,
  janelaDaVisualizacao,
  montarAgenda,
  naJanela,
  ordenarAgenda,
  podeGerenciarEventos,
  podeVerAgenda,
  ROTULO_CAMADA_PILULA,
  rotuloDia,
  rotuloMes,
  rotuloSemana,
  somarDias,
  ultimoDiaDoMes,
  visibilidadeEfetiva,
  type CompromissoParaAgenda,
  type DerivadoParaAgenda,
  type ItemAgenda,
} from "./agenda"
import { normalizarPermissoes, PRESETS } from "./permissoes"

const compromisso = (over: Partial<CompromissoParaAgenda> = {}): CompromissoParaAgenda => ({
  id: "c1",
  titulo: "Saída sábado",
  descricao: null,
  data: "2026-08-22",
  hora: "08:00:00",
  visibilidade: "compartilhado",
  concluido_em: null,
  criado_por: "dono",
  ...over,
})

const derivado = (over: Partial<DerivadoParaAgenda> = {}): DerivadoParaAgenda => ({
  id: "i1",
  data: "2026-08-25",
  titulo: "Troca de óleo",
  detalhe: "Motor BB",
  camada: "manutencoes",
  href: "/barco/itens/i1/editar",
  status: "atencao",
  ...over,
})

describe("aritmética de calendário", () => {
  it("somarDias vira o mês e o ano sem escorregar de fuso", () => {
    expect(somarDias("2026-08-22", 1)).toBe("2026-08-23")
    expect(somarDias("2026-08-31", 1)).toBe("2026-09-01")
    expect(somarDias("2026-12-31", 1)).toBe("2027-01-01")
    expect(somarDias("2026-01-01", -1)).toBe("2025-12-31")
  })

  it("diaDaSemana devolve 0 no domingo e 6 no sábado", () => {
    expect(diaDaSemana("2026-08-16")).toBe(0) // domingo
    expect(diaDaSemana("2026-08-22")).toBe(6) // sábado
  })

  it("ano bissexto: fevereiro de 2028 termina em 29", () => {
    expect(ultimoDiaDoMes("2028-02")).toBe("2028-02-29")
    expect(ultimoDiaDoMes("2026-02")).toBe("2026-02-28")
  })

  it("diasDaSemana devolve 7 dias, de domingo a sábado", () => {
    const dias = diasDaSemana("2026-08-19") // quarta
    expect(dias).toHaveLength(7)
    expect(dias[0]).toBe("2026-08-16")
    expect(dias[6]).toBe("2026-08-22")
  })
})

describe("gradeDoMes", () => {
  it("toda semana tem exatamente 7 colunas — sem buraco quebrando o alinhamento", () => {
    for (const mes of ["2026-08", "2026-02", "2028-02", "2026-11"]) {
      for (const semana of gradeDoMes(mes)) expect(semana).toHaveLength(7)
    }
  })

  it("começa no domingo e termina no sábado", () => {
    const semanas = gradeDoMes("2026-08")
    expect(diaDaSemana(semanas[0][0].data)).toBe(0)
    expect(diaDaSemana(semanas[semanas.length - 1][6].data)).toBe(6)
  })

  it("cobre o mês inteiro e marca os dias vizinhos como fora do mês", () => {
    const dias = gradeDoMes("2026-08").flat()
    const doMes = dias.filter((d) => d.doMes).map((d) => d.data)
    expect(doMes[0]).toBe("2026-08-01")
    expect(doMes[doMes.length - 1]).toBe("2026-08-31")
    expect(doMes).toHaveLength(31)
    expect(dias.some((d) => !d.doMes && d.data.startsWith("2026-07"))).toBe(true)
  })

  it("mês que começa no domingo não ganha uma semana vazia na frente", () => {
    // 2026-11-01 é um domingo.
    const semanas = gradeDoMes("2026-11")
    expect(semanas[0][0].data).toBe("2026-11-01")
    expect(semanas[0][0].doMes).toBe(true)
  })
})

describe("janelaDaVisualizacao", () => {
  it("semana cobre domingo a sábado da data âncora", () => {
    expect(janelaDaVisualizacao("semana", "2026-08-19")).toEqual({ de: "2026-08-16", ate: "2026-08-22" })
  })

  it("mês cobre a grade inteira, incluindo os dias vizinhos que aparecem na tela", () => {
    const j = janelaDaVisualizacao("mes", "2026-08-19")
    expect(j.de <= "2026-08-01").toBe(true)
    expect(j.ate >= "2026-08-31").toBe(true)
    expect(diaDaSemana(j.de)).toBe(0)
    expect(diaDaSemana(j.ate)).toBe(6)
  })

  it("lista começa no primeiro dia do mês âncora — pendência da semana passada não some", () => {
    const j = janelaDaVisualizacao("lista", "2026-08-19")
    expect(j.de).toBe("2026-08-01")
    expect(j.ate).toBe("2027-08-01") // teto de 12 meses — consulta precisa ter fim
  })
})

describe("visibilidade", () => {
  it("particular não é compartilhável; compartilhado e atribuído são", () => {
    expect(ehCompartilhavel("particular")).toBe(false)
    expect(ehCompartilhavel("compartilhado")).toBe(true)
    expect(ehCompartilhavel("atribuido")).toBe(true)
  })
})

describe("visibilidadeEfetiva", () => {
  it("lista vazia é particular — mesmo que o campo no banco diga outra coisa", () => {
    expect(visibilidadeEfetiva([])).toBe("particular")
  })
  it("com gente e sem responsável, é compartilhado", () => {
    expect(visibilidadeEfetiva([{ responsavel: false }, { responsavel: false }])).toBe("compartilhado")
  })
  it("um responsável basta pra ser atribuído", () => {
    expect(visibilidadeEfetiva([{ responsavel: false }, { responsavel: true }])).toBe("atribuido")
  })
})

describe("ehHistorico", () => {
  it("concluído é histórico", () => {
    expect(ehHistorico({ concluido_em: "2026-08-22T11:00:00.000Z" })).toBe(true)
  })
  it("não concluído nunca é histórico, mesmo com data no passado", () => {
    expect(ehHistorico({ concluido_em: null })).toBe(false)
  })
})

describe("horaCurta", () => {
  it("corta os segundos que o Postgres devolve", () => {
    expect(horaCurta("08:00:00")).toBe("08:00")
  })
  it("dia inteiro continua sem hora", () => {
    expect(horaCurta(null)).toBeNull()
  })
})

describe("naJanela", () => {
  it("inclui as duas pontas", () => {
    const j = { de: "2026-08-16", ate: "2026-08-22" }
    expect(naJanela("2026-08-16", j)).toBe(true)
    expect(naJanela("2026-08-22", j)).toBe(true)
    expect(naJanela("2026-08-15", j)).toBe(false)
    expect(naJanela("2026-08-23", j)).toBe(false)
  })
})

describe("ordenarAgenda", () => {
  it("dia inteiro abre o dia, depois vem por hora", () => {
    const base = { detalhe: null, origem: "compromisso" as const, href: null, status: null, compartilhado: false, meu: true, concluido: false }
    const itens: ItemAgenda[] = [
      { ...base, chave: "b", data: "2026-08-22", hora: "14:00", titulo: "Tarde" },
      { ...base, chave: "c", data: "2026-08-21", hora: "09:00", titulo: "Véspera" },
      { ...base, chave: "a", data: "2026-08-22", hora: null, titulo: "Dia inteiro" },
      { ...base, chave: "d", data: "2026-08-22", hora: "08:00", titulo: "Saída" },
    ]
    expect(ordenarAgenda(itens).map((i) => i.chave)).toEqual(["c", "a", "d", "b"])
  })

  it("não altera o array recebido", () => {
    const itens: ItemAgenda[] = [
      { chave: "z", data: "2026-08-30", hora: null, titulo: "Z", detalhe: null, origem: "compromisso", href: null, status: null, compartilhado: false, meu: true, concluido: false },
      { chave: "a", data: "2026-08-01", hora: null, titulo: "A", detalhe: null, origem: "compromisso", href: null, status: null, compartilhado: false, meu: true, concluido: false },
    ]
    ordenarAgenda(itens)
    expect(itens[0].chave).toBe("z")
  })
})

describe("montarAgenda — Agenda normal", () => {
  const janela = janelaDaVisualizacao("mes", "2026-08-19")

  it("sem camadas ligadas, mostra só compromissos de gente", () => {
    const itens = montarAgenda(
      { compromissos: [compromisso()], derivados: [derivado()] },
      { usuarioId: "dono", janela, camadas: [] },
    )
    expect(itens).toHaveLength(1)
    expect(itens[0].origem).toBe("compromisso")
    expect(itens[0].titulo).toBe("Saída sábado")
  })

  it("compromisso concluído não polui a agenda normal", () => {
    const itens = montarAgenda(
      { compromissos: [compromisso({ concluido_em: "2026-08-22T12:00:00.000Z" })], derivados: [] },
      { usuarioId: "dono", janela, camadas: [] },
    )
    expect(itens).toHaveLength(0)
  })

  it("concluído reaparece quando a pessoa pede pra ver o que já foi feito", () => {
    const itens = montarAgenda(
      { compromissos: [compromisso({ concluido_em: "2026-08-22T12:00:00.000Z" })], derivados: [] },
      { usuarioId: "dono", janela, camadas: [], incluirConcluidos: true },
    )
    expect(itens).toHaveLength(1)
    expect(itens[0].concluido).toBe(true)
  })

  it("fora da janela não entra", () => {
    const itens = montarAgenda(
      { compromissos: [compromisso({ data: "2026-10-05" })], derivados: [] },
      { usuarioId: "dono", janela, camadas: [] },
    )
    expect(itens).toHaveLength(0)
  })

  it("marca como meu só o que eu criei — compartilhado comigo não vira meu", () => {
    const itens = montarAgenda(
      { compromissos: [compromisso({ id: "c1", criado_por: "dono" }), compromisso({ id: "c2", criado_por: "outro" })], derivados: [] },
      { usuarioId: "dono", janela, camadas: [] },
    )
    expect(itens.find((i) => i.chave === "compromisso:c1")?.meu).toBe(true)
    expect(itens.find((i) => i.chave === "compromisso:c2")?.meu).toBe(false)
  })
})

describe("montarAgenda — Agenda Detalhada", () => {
  const janela = janelaDaVisualizacao("mes", "2026-08-19")

  it("camada só entra quando o filtro dela está ligado", () => {
    const dados = {
      compromissos: [],
      derivados: [derivado({ id: "a", camada: "manutencoes" }), derivado({ id: "b", camada: "documentos" })],
    }
    const so = montarAgenda(dados, { usuarioId: "dono", janela, camadas: ["documentos"] })
    expect(so.map((i) => i.chave)).toEqual(["documentos:b"])
  })

  it("linha derivada nunca é 'minha' nem 'compartilhada' — ela não pertence a ninguém", () => {
    const itens = montarAgenda(
      { compromissos: [], derivados: [derivado()] },
      { usuarioId: "dono", janela, camadas: ["manutencoes"] },
    )
    expect(itens[0].meu).toBe(false)
    expect(itens[0].compartilhado).toBe(false)
    expect(itens[0].status).toBe("atencao")
  })

  it("chave não colide entre camadas com o mesmo id de origem", () => {
    const itens = montarAgenda(
      {
        compromissos: [],
        derivados: [derivado({ id: "mesmo", camada: "manutencoes" }), derivado({ id: "mesmo", camada: "seguranca" })],
      },
      { usuarioId: "dono", janela, camadas: ["manutencoes", "seguranca"] },
    )
    expect(new Set(itens.map((i) => i.chave)).size).toBe(2)
  })
})

describe("camadas", () => {
  it("declara as seis do PRD, na ordem do PRD", () => {
    expect(CAMADAS).toEqual(["manutencoes", "documentos", "seguranca", "tarefas", "servicos", "financeiro"])
  })

  it("serviços e financeiro ainda não têm fonte — não viram filtro na tela", () => {
    expect(camadaTemFonte("manutencoes")).toBe(true)
    expect(camadaTemFonte("tarefas")).toBe(true)
    expect(camadaTemFonte("servicos")).toBe(false)
    expect(camadaTemFonte("financeiro")).toBe(false)
  })
})

describe("agruparPorDia", () => {
  it("junta os itens do mesmo dia mantendo a ordem", () => {
    const itens = montarAgenda(
      {
        compromissos: [compromisso({ id: "c1", hora: "08:00:00" }), compromisso({ id: "c2", hora: "18:00:00" })],
        derivados: [],
      },
      { usuarioId: "dono", janela: janelaDaVisualizacao("mes", "2026-08-19"), camadas: [] },
    )
    const porDia = agruparPorDia(itens)
    expect(porDia.get("2026-08-22")?.map((i) => i.hora)).toEqual(["08:00", "18:00"])
    expect(porDia.get("2026-08-23")).toBeUndefined()
  })
})

describe("permissão de gerenciar eventos", () => {
  it("PROP (permissoes null) sempre pode", () => {
    expect(podeVerAgenda(null)).toBe(true)
    expect(podeGerenciarEventos(null)).toBe(true)
  })

  it("acesso operacional pode — é quem opera o barco no dia a dia", () => {
    expect(podeGerenciarEventos(PRESETS.operacional)).toBe(true)
  })

  it("vínculo sem a área não cria nem compartilha evento da embarcação", () => {
    const sem = normalizarPermissoes({ fotos: { ver: true } })
    expect(podeVerAgenda(sem)).toBe(false)
    expect(podeGerenciarEventos(sem)).toBe(false)
  })
})

describe("rótulos de data", () => {
  it("mês em português com inicial maiúscula", () => {
    expect(rotuloMes("2026-08")).toBe("Agosto de 2026")
  })
  it("dia curto com o dia da semana", () => {
    expect(rotuloDia("2026-08-22")).toBe("sáb, 22/08")
  })
  it("semana dentro do mesmo mês mostra o mês uma vez só", () => {
    expect(rotuloSemana("2026-08-19")).toBe("16 – 22/08")
  })
  it("semana que atravessa o mês mostra os dois", () => {
    expect(rotuloSemana("2026-09-01")).toBe("30/08 – 05/09")
  })
})

// --- onda 62 (canvas tela-1h): a Lista com data em mono à esquerda ---------

describe("diaCompacto", () => {
  it("dia com dois dígitos e semana curta minúscula sem ponto", () => {
    expect(diaCompacto("2026-08-18")).toEqual({ dia: "18", semana: "ter" })
    expect(diaCompacto("2026-09-02")).toEqual({ dia: "02", semana: "qua" })
    expect(diaCompacto("2026-08-22")).toEqual({ dia: "22", semana: "sáb" })
  })
})

describe("agruparPorPeriodo", () => {
  const item = (data: string): ItemAgenda => ({
    chave: `c:${data}`,
    origem: "compromisso",
    data,
    hora: null,
    titulo: data,
    detalhe: null,
    href: null,
    status: null,
    compartilhado: false,
    meu: true,
    concluido: false,
  })

  it("a semana corrente vira 'Esta semana'; o resto agrupa por mês", () => {
    // hoje = terça 18/08/2026; semana corrente = 16 a 22/08.
    const secoes = agruparPorPeriodo(
      [item("2026-08-18"), item("2026-08-20"), item("2026-09-02"), item("2026-09-14")],
      "2026-08-18",
    )
    expect(secoes.map((s) => s.rotulo)).toEqual(["Esta semana", "Setembro"])
    expect(secoes[0].itens).toHaveLength(2)
    expect(secoes[1].itens).toHaveLength(2)
  })

  it("mês de outro ano leva o ano no nome — 'Setembro' sozinho mentiria", () => {
    const secoes = agruparPorPeriodo([item("2027-01-10")], "2026-08-18")
    expect(secoes[0].rotulo).toBe("Janeiro de 2027")
  })

  it("agrupamento é sequencial: a cronologia manda, mesmo repetindo rótulo", () => {
    // Item antes da semana corrente, dentro dela e depois dela, tudo em agosto.
    const secoes = agruparPorPeriodo(
      [item("2026-08-03"), item("2026-08-18"), item("2026-08-28")],
      "2026-08-18",
    )
    expect(secoes.map((s) => s.rotulo)).toEqual(["Agosto", "Esta semana", "Agosto"])
  })

  it("lista vazia devolve zero seções", () => {
    expect(agruparPorPeriodo([], "2026-08-18")).toEqual([])
  })
})

describe("ROTULO_CAMADA_PILULA", () => {
  it("toda camada com fonte tem rótulo curto de pílula", () => {
    for (const c of CAMADAS_COM_FONTE) {
      expect(ROTULO_CAMADA_PILULA[c].length).toBeGreaterThan(0)
    }
  })
})
