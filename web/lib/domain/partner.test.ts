import { describe, expect, it } from "vitest"
import {
  atividadesValidas,
  AVISO_DISPONIBILIDADE_MARINA,
  BLOCOS_PERFIL_PARTNER,
  demandaCompativelComPartner,
  demandasDoPartner,
  demandasParaPartner,
  ehTipoPartner,
  FILTRO_TODOS,
  filtrarVitrine,
  filtroTipoValido,
  ICONE_TIPO_PARTNER,
  menuDoPartner,
  partnerPago,
  PLANO_DO_TIPO_PARTNER,
  recebeDemandas,
  ROTULO_MEU_PERFIL,
  ROTULO_TIPO_PARTNER,
  taxonomiasDoPartner,
  TIPOS_PARTNER,
  tiposDeDemandaDoPartner,
  toggleDisponivel,
  vagaAtendeDemanda,
  vagaTemConteudo,
  type DemandaParaPartner,
  type PartnerParaMatching,
  type PartnerParaRegra,
  type TipoPartner,
  type VagaDeclarada,
} from "./partner"
import { PLANOS } from "./planos"
import { TIPOS_DEMANDA } from "./marketplace"

const simples = (categoria: TipoPartner): PartnerParaRegra => ({
  categoria,
  tambem_vende_produtos: false,
  tambem_presta_servicos: false,
})

describe("catálogo de tipos (§13)", () => {
  it("cobre os seis tipos do §13 mais a válvula 'outros'", () => {
    expect([...TIPOS_PARTNER].sort()).toEqual(
      ["loja_nautica", "marina", "outros", "posto", "pousada", "prestador", "restaurante"],
    )
  })

  it("exibe o TIPO REAL, nunca 'Commander Partner' (§13)", () => {
    // "Commander Partner" é o nome do PLANO/ecossistema; o que a tela mostra
    // é o tipo do negócio. Se um rótulo destes virar "Commander Partner", o
    // §13 quebra — por isso o teste, e não só o comentário.
    for (const tipo of TIPOS_PARTNER) {
      expect(ROTULO_TIPO_PARTNER[tipo]).not.toMatch(/commander/i)
      expect(ROTULO_TIPO_PARTNER[tipo]).not.toMatch(/partner/i)
    }
    expect(ROTULO_TIPO_PARTNER.prestador).toBe("Prestador de Serviço")
    expect(ROTULO_TIPO_PARTNER.loja_nautica).toBe("Loja Náutica")
    expect(ROTULO_TIPO_PARTNER.marina).toBe("Marina")
  })

  it("aponta pra planos que existem de verdade no catálogo do §2", () => {
    for (const tipo of TIPOS_PARTNER) {
      const plano = PLANO_DO_TIPO_PARTNER[tipo]
      if (plano == null) continue
      expect(PLANOS[plano].perfil).toBe("partner")
    }
  })

  it("cobra só Prestador e Loja (§2: os dois de R$ 24,90)", () => {
    expect(TIPOS_PARTNER.filter(partnerPago)).toEqual(["prestador", "loja_nautica"])
    expect(PLANOS.partner_prestador.valorCentavos).toBe(2490)
    expect(PLANOS.partner_loja.valorCentavos).toBe(2490)
    expect(PLANOS.partner_marina.valorCentavos).toBe(0)
    expect(PLANOS.partner_posto.valorCentavos).toBe(0)
  })

  it("tem ícone e rótulo de perfil pra todo tipo", () => {
    for (const tipo of TIPOS_PARTNER) {
      expect(ICONE_TIPO_PARTNER[tipo]).toBeTruthy()
      expect(ROTULO_MEU_PERFIL[tipo].length).toBeGreaterThan(3)
    }
  })
})

describe("menu por tipo (§13.1, §13.2)", () => {
  it("dá ao Prestador exatamente o menu escrito no §13.1", () => {
    expect(menuDoPartner("prestador").map((i) => i.rotulo)).toEqual([
      "Início", "Marketplace", "Explorar", "Meu Perfil", "Minha Conta",
    ])
  })

  it("troca 'Meu Perfil' por 'Minha Loja' no §13.2", () => {
    expect(menuDoPartner("loja_nautica").map((i) => i.rotulo)).toEqual([
      "Início", "Marketplace", "Explorar", "Minha Loja", "Minha Conta",
    ])
  })

  it("chama a aba do Posto de 'Solicitações', não de Marketplace (§13.4)", () => {
    // §13.4: "Não precisa receber o Marketplace geral" — o rótulo prometeria
    // um mural que ele não vê.
    const rotulos = menuDoPartner("posto").map((i) => i.rotulo)
    expect(rotulos).toContain("Solicitações")
    expect(rotulos).not.toContain("Marketplace")
  })

  it("não dá aba de Marketplace a quem não recebe demanda nenhuma", () => {
    for (const tipo of ["restaurante", "pousada", "outros"] as const) {
      expect(menuDoPartner(tipo).map((i) => i.rotulo)).not.toContain("Marketplace")
      expect(recebeDemandas(tipo)).toBe(false)
    }
  })

  it("todo menu tem Início, Explorar, perfil e Minha Conta", () => {
    for (const tipo of TIPOS_PARTNER) {
      const rotulos = menuDoPartner(tipo).map((i) => i.rotulo)
      expect(rotulos[0]).toBe("Início")
      expect(rotulos).toContain("Explorar")
      expect(rotulos).toContain(ROTULO_MEU_PERFIL[tipo])
      expect(rotulos.at(-1)).toBe("Minha Conta")
    }
  })
})

describe("atividades complementares (§13.1, §13.2)", () => {
  it("só o Prestador vende produtos e só a Loja presta serviços", () => {
    expect(toggleDisponivel("prestador")).toEqual({
      tambem_vende_produtos: true,
      tambem_presta_servicos: false,
    })
    expect(toggleDisponivel("loja_nautica")).toEqual({
      tambem_vende_produtos: false,
      tambem_presta_servicos: true,
    })
  })

  it("nenhum outro tipo ganha toggle — §13.3 diz 'apenas' e §13.4 dispensa o geral", () => {
    for (const tipo of ["marina", "posto", "restaurante", "pousada", "outros"] as const) {
      expect(toggleDisponivel(tipo)).toEqual({
        tambem_vende_produtos: false,
        tambem_presta_servicos: false,
      })
    }
  })

  it("desliga toggle forjado por POST em tipo que não pode ativá-lo", () => {
    // A tela esconde o campo; isto aqui é a trava de verdade.
    expect(
      atividadesValidas("marina", { tambem_vende_produtos: true, tambem_presta_servicos: true }),
    ).toEqual({ tambem_vende_produtos: false, tambem_presta_servicos: false })

    expect(
      atividadesValidas("prestador", { tambem_vende_produtos: true, tambem_presta_servicos: true }),
    ).toEqual({ tambem_vende_produtos: true, tambem_presta_servicos: false })
  })
})

describe("que demandas cada tipo recebe (§13 + §11.1)", () => {
  it("Prestador recebe serviço; com 'também vendo produtos', recebe produto também", () => {
    expect(tiposDeDemandaDoPartner(simples("prestador"))).toEqual(["profissional"])
    expect(
      tiposDeDemandaDoPartner({ ...simples("prestador"), tambem_vende_produtos: true }),
    ).toEqual(["profissional", "produto"])
  })

  it("Loja recebe produto; com 'também presto serviços', recebe serviço também", () => {
    expect(tiposDeDemandaDoPartner(simples("loja_nautica"))).toEqual(["produto"])
    expect(
      tiposDeDemandaDoPartner({ ...simples("loja_nautica"), tambem_presta_servicos: true }),
    ).toEqual(["profissional", "produto"])
  })

  it("Marina recebe APENAS vaga (§13.3), mesmo com flags forjadas", () => {
    expect(tiposDeDemandaDoPartner(simples("marina"))).toEqual(["vaga_embarcacao"])
    expect(
      tiposDeDemandaDoPartner({
        categoria: "marina",
        tambem_vende_produtos: true,
        tambem_presta_servicos: true,
      }),
    ).toEqual(["vaga_embarcacao"])
  })

  it("Posto recebe só caminhão (§13.4)", () => {
    expect(tiposDeDemandaDoPartner(simples("posto"))).toEqual(["caminhao"])
  })

  it("Restaurante, Pousada e Outros não recebem demanda", () => {
    expect(tiposDeDemandaDoPartner(simples("restaurante"))).toEqual([])
    expect(tiposDeDemandaDoPartner(simples("pousada"))).toEqual([])
    expect(tiposDeDemandaDoPartner(simples("outros"))).toEqual([])
  })

  it("nenhum Partner recebe demanda de tripulação — ela é da rede do §12", () => {
    for (const tipo of TIPOS_PARTNER) {
      expect(tiposDeDemandaDoPartner(simples(tipo))).not.toContain("tripulacao")
    }
  })

  it("só devolve tipos de demanda que o §11.1 realmente tem", () => {
    for (const tipo of TIPOS_PARTNER) {
      for (const t of tiposDeDemandaDoPartner(simples(tipo))) {
        expect(TIPOS_DEMANDA).toContain(t)
      }
    }
  })

  it("filtra a vitrine pelo tipo antes de qualquer interesse", () => {
    const demandas = [
      { id: "a", tipo: "vaga_embarcacao" as const },
      { id: "b", tipo: "profissional" as const },
      { id: "c", tipo: "caminhao" as const },
    ]
    expect(demandasDoPartner(demandas, simples("marina")).map((d) => d.id)).toEqual(["a"])
    expect(demandasDoPartner(demandas, simples("posto")).map((d) => d.id)).toEqual(["c"])
    expect(demandasDoPartner(demandas, simples("restaurante"))).toEqual([])
  })
})

describe("taxonomia declarada (§13.2, §21.2)", () => {
  it("Prestador declara serviços; Loja declara produtos e marcas", () => {
    expect(taxonomiasDoPartner(simples("prestador"))).toEqual(["categoria_servico"])
    expect(taxonomiasDoPartner(simples("loja_nautica"))).toEqual(["categoria_produto", "marca"])
  })

  it("o toggle amplia a taxonomia que o parceiro declara", () => {
    expect(
      taxonomiasDoPartner({ ...simples("prestador"), tambem_vende_produtos: true }),
    ).toEqual(["categoria_servico", "categoria_produto", "marca"])
    expect(
      taxonomiasDoPartner({ ...simples("loja_nautica"), tambem_presta_servicos: true }),
    ).toEqual(["categoria_servico", "categoria_produto", "marca"])
  })

  it("Posto declara combustível (é o requisito do matching de caminhão)", () => {
    expect(taxonomiasDoPartner(simples("posto"))).toEqual(["combustivel"])
  })

  it("Marina, Restaurante, Pousada e Outros não declaram taxonomia de atividade", () => {
    for (const tipo of ["marina", "restaurante", "pousada", "outros"] as const) {
      expect(taxonomiasDoPartner(simples(tipo))).toEqual([])
    }
  })
})

describe("blocos de perfil por tipo (§13.3 a §13.6)", () => {
  it("Marina pede acesso náutico, estrutura, atracação e vagas", () => {
    expect(BLOCOS_PERFIL_PARTNER.marina).toContain("acesso_nautico")
    expect(BLOCOS_PERFIL_PARTNER.marina).toContain("estrutura")
    expect(BLOCOS_PERFIL_PARTNER.marina).toContain("atracacao")
    expect(BLOCOS_PERFIL_PARTNER.marina).toContain("vagas")
  })

  it("só a Marina tem vagas e só a Pousada tem acomodações e check-in/out", () => {
    for (const tipo of TIPOS_PARTNER) {
      expect(BLOCOS_PERFIL_PARTNER[tipo].includes("vagas")).toBe(tipo === "marina")
      expect(BLOCOS_PERFIL_PARTNER[tipo].includes("acomodacoes")).toBe(tipo === "pousada")
      expect(BLOCOS_PERFIL_PARTNER[tipo].includes("check_in_out")).toBe(tipo === "pousada")
      expect(BLOCOS_PERFIL_PARTNER[tipo].includes("cardapio")).toBe(tipo === "restaurante")
    }
  })

  it("Prestador e Loja não têm bloco físico — §13.1/§13.2 não pedem nenhum", () => {
    expect(BLOCOS_PERFIL_PARTNER.prestador).toEqual([])
    expect(BLOCOS_PERFIL_PARTNER.loja_nautica).toEqual([])
  })
})

describe("vagas da Marina (§13.3)", () => {
  const vaga = (over: Partial<VagaDeclarada> = {}): VagaDeclarada => ({
    tipo: "molhada",
    total: null,
    disponiveis: null,
    porte_max_pes: null,
    preco_diaria_centavos: null,
    preco_mensal_centavos: null,
    sob_consulta: false,
    ...over,
  })

  it("diz na tela que disponibilidade é declarada, não reserva", () => {
    expect(AVISO_DISPONIBILIDADE_MARINA).toMatch(/declarada/i)
    expect(AVISO_DISPONIBILIDADE_MARINA).toMatch(/não é reserva/i)
  })

  it("linha totalmente vazia não vira cartão", () => {
    expect(vagaTemConteudo(vaga())).toBe(false)
    expect(vagaTemConteudo(vaga({ total: 20 }))).toBe(true)
    expect(vagaTemConteudo(vaga({ sob_consulta: true }))).toBe(true)
  })

  it("atende quando o tipo bate e o porte cabe no teto", () => {
    const molhada80 = vaga({ tipo: "molhada", porte_max_pes: 80 })
    expect(vagaAtendeDemanda(molhada80, { tipo_vaga: "molhada", porte_pes: 60 })).toBe(true)
    expect(vagaAtendeDemanda(molhada80, { tipo_vaga: "molhada", porte_pes: 80 })).toBe(true)
    expect(vagaAtendeDemanda(molhada80, { tipo_vaga: "molhada", porte_pes: 100 })).toBe(false)
    expect(vagaAtendeDemanda(molhada80, { tipo_vaga: "seca", porte_pes: 30 })).toBe(false)
  })

  it("vaga sem teto declarado atende qualquer porte", () => {
    expect(vagaAtendeDemanda(vaga({ tipo: "seca" }), { tipo_vaga: "seca", porte_pes: 300 })).toBe(true)
  })
})

describe("matching pelo cadastro do Partner (§11.4)", () => {
  const demanda = (over: Partial<DemandaParaPartner> = {}): DemandaParaPartner => ({
    tipo: "profissional",
    regiao_id: "angra",
    categoria_id: null,
    combustivel_id: null,
    tipo_vaga: null,
    porte_pes: null,
    ...over,
  })
  const partner = (over: Partial<PartnerParaMatching> = {}): PartnerParaMatching => ({
    categoria: "prestador",
    tambem_vende_produtos: false,
    tambem_presta_servicos: false,
    regiao_id: "angra",
    atividades: [],
    ...over,
  })

  it("corta pelo tipo antes de qualquer outra pergunta (§13.3/§13.4)", () => {
    expect(demandaCompativelComPartner(demanda({ tipo: "caminhao", combustivel_id: "diesel" }), partner())).toBe(false)
    expect(
      demandaCompativelComPartner(
        demanda({ tipo: "profissional" }),
        partner({ categoria: "posto" }),
      ),
    ).toBe(false)
  })

  it("exige a mesma região", () => {
    expect(demandaCompativelComPartner(demanda({ regiao_id: "paraty" }), partner())).toBe(false)
    expect(demandaCompativelComPartner(demanda({ regiao_id: "angra" }), partner())).toBe(true)
  })

  it("quem não declarou categoria atende todas — não declarar não é declarar zero", () => {
    expect(demandaCompativelComPartner(demanda({ categoria_id: "eletrica" }), partner())).toBe(true)
  })

  it("quem declarou categoria só recebe o que declarou", () => {
    const p = partner({ atividades: [{ id: "eletrica", tipo: "categoria_servico" }] })
    expect(demandaCompativelComPartner(demanda({ categoria_id: "eletrica" }), p)).toBe(true)
    expect(demandaCompativelComPartner(demanda({ categoria_id: "mecanica" }), p)).toBe(false)
  })

  it("não confunde categoria de serviço com categoria de produto", () => {
    // A loja declarou "Elétrica e baterias" (produto). Uma demanda de SERVIÇO
    // de elétrica só chega a ela se o toggle "também presto serviços" estiver
    // ligado — e mesmo assim ela não declarou nenhum serviço, então atende
    // todos os serviços.
    const loja = partner({
      categoria: "loja_nautica",
      tambem_presta_servicos: true,
      atividades: [{ id: "eletrica-baterias", tipo: "categoria_produto" }],
    })
    expect(demandaCompativelComPartner(demanda({ tipo: "profissional", categoria_id: "eletrica" }), loja)).toBe(true)
    expect(
      demandaCompativelComPartner(demanda({ tipo: "produto", categoria_id: "motor-pecas" }), loja),
    ).toBe(false)
    expect(
      demandaCompativelComPartner(demanda({ tipo: "produto", categoria_id: "eletrica-baterias" }), loja),
    ).toBe(true)
  })

  it("o Posto só recebe o combustível que declarou", () => {
    const posto = partner({
      categoria: "posto",
      atividades: [{ id: "diesel-s10", tipo: "combustivel" }],
    })
    expect(demandaCompativelComPartner(demanda({ tipo: "caminhao", combustivel_id: "diesel-s10" }), posto)).toBe(true)
    expect(demandaCompativelComPartner(demanda({ tipo: "caminhao", combustivel_id: "gasolina-comum" }), posto)).toBe(false)
  })

  it("a Marina só recebe vaga que cabe no que ela declarou", () => {
    const marina = partner({ categoria: "marina" })
    const vagas: VagaDeclarada[] = [{
      tipo: "molhada", total: 20, disponiveis: 3, porte_max_pes: 80,
      preco_diaria_centavos: null, preco_mensal_centavos: null, sob_consulta: true,
    }]
    const pedido = (tipo_vaga: "seca" | "molhada", porte_pes: number) =>
      demanda({ tipo: "vaga_embarcacao", tipo_vaga, porte_pes })

    expect(demandaCompativelComPartner(pedido("molhada", 60), marina, vagas)).toBe(true)
    expect(demandaCompativelComPartner(pedido("molhada", 120), marina, vagas)).toBe(false)
    expect(demandaCompativelComPartner(pedido("seca", 25), marina, vagas)).toBe(false)
    // Marina que ainda não declarou vaga nenhuma continua recebendo tudo —
    // senão ela nunca receberia o primeiro pedido e nunca teria motivo pra
    // cadastrar.
    expect(demandaCompativelComPartner(pedido("seca", 25), marina, [])).toBe(true)
  })

  it("preserva a ordem de chegada ao filtrar a lista", () => {
    const p = partner()
    const lista = [
      { id: "a", ...demanda({ categoria_id: "eletrica" }) },
      { id: "b", ...demanda({ regiao_id: "paraty" }) },
      { id: "c", ...demanda({ categoria_id: "mecanica" }) },
    ]
    expect(demandasParaPartner(lista, p).map((d) => d.id)).toEqual(["a", "c"])
  })
})

describe("filtros do Explorar (§10)", () => {
  const p = (id: string, categoria: TipoPartner, regiao_id: string, atividades: string[] = []) => ({
    id, categoria, regiao_id, atividades,
  })
  const lista = [
    p("1", "marina", "angra"),
    p("2", "prestador", "angra", ["eletrica"]),
    p("3", "prestador", "paraty", ["mecanica"]),
    p("4", "restaurante", "paraty"),
  ]

  it("'Todos' não filtra nada", () => {
    expect(filtrarVitrine(lista, { tipo: FILTRO_TODOS }).length).toBe(4)
    expect(filtrarVitrine(lista, {}).length).toBe(4)
  })

  it("filtra por tipo de Partner", () => {
    expect(filtrarVitrine(lista, { tipo: "prestador" }).map((x) => x.id)).toEqual(["2", "3"])
  })

  it("filtra por região", () => {
    expect(filtrarVitrine(lista, { regiaoId: "paraty" }).map((x) => x.id)).toEqual(["3", "4"])
  })

  it("filtra por categoria/atividade declarada", () => {
    expect(filtrarVitrine(lista, { atividadeId: "eletrica" }).map((x) => x.id)).toEqual(["2"])
  })

  it("combina os três eixos", () => {
    expect(
      filtrarVitrine(lista, { tipo: "prestador", regiaoId: "angra", atividadeId: "eletrica" }).map((x) => x.id),
    ).toEqual(["2"])
    expect(
      filtrarVitrine(lista, { tipo: "prestador", regiaoId: "angra", atividadeId: "mecanica" }),
    ).toEqual([])
  })

  it("lixo na URL vira 'Todos' em vez de erro de página", () => {
    expect(filtroTipoValido("marina")).toBe("marina")
    expect(filtroTipoValido("banana")).toBe(FILTRO_TODOS)
    expect(filtroTipoValido(undefined)).toBe(FILTRO_TODOS)
    expect(ehTipoPartner("prestador")).toBe(true)
    expect(ehTipoPartner("banana")).toBe(false)
  })
})
