import { describe, expect, it } from "vitest"
import { abaDoItem, agruparPorMes, eventoNoFiltro, grupoDoEvento, validarNovoItem, zerarCiclo } from "./diario"

const ev = (p: Partial<Parameters<typeof eventoNoFiltro>[0]>) => ({
  tipo: "manutencao", categoria: null, custoCentavos: null, tipoEquipamento: null, ...p,
})

describe("eventoNoFiltro", () => {
  it("motores pega eventos de equipamento motor", () => {
    expect(eventoNoFiltro(ev({ tipoEquipamento: "motor" }), "motores")).toBe(true)
    expect(eventoNoFiltro(ev({ tipoEquipamento: "gerador" }), "motores")).toBe(false)
  })
  it("eletrica pega gerador e bateria", () => {
    expect(eventoNoFiltro(ev({ tipoEquipamento: "gerador" }), "eletrica")).toBe(true)
    expect(eventoNoFiltro(ev({ tipoEquipamento: "bateria" }), "eletrica")).toBe(true)
    expect(eventoNoFiltro(ev({ tipoEquipamento: "motor" }), "eletrica")).toBe(false)
  })
  it("casco pega categorias de casco e docagem", () => {
    expect(eventoNoFiltro(ev({ categoria: "fibra" }), "casco")).toBe(true)
    expect(eventoNoFiltro(ev({ tipo: "docagem" }), "casco")).toBe(true)
    expect(eventoNoFiltro(ev({ categoria: "documento" }), "casco")).toBe(false)
  })
  it("docs pega categoria documento; gastos pega custo positivo", () => {
    expect(eventoNoFiltro(ev({ categoria: "documento" }), "docs")).toBe(true)
    expect(eventoNoFiltro(ev({ custoCentavos: 185000 }), "gastos")).toBe(true)
    expect(eventoNoFiltro(ev({ custoCentavos: null }), "gastos")).toBe(false)
  })
  it("hidraulica pega as 3 categorias (agua doce/grey/black water)", () => {
    expect(eventoNoFiltro(ev({ categoria: "hidraulica_agua_doce" }), "hidraulica")).toBe(true)
    expect(eventoNoFiltro(ev({ categoria: "hidraulica_grey_water" }), "hidraulica")).toBe(true)
    expect(eventoNoFiltro(ev({ categoria: "hidraulica_black_water" }), "hidraulica")).toBe(true)
    expect(eventoNoFiltro(ev({ categoria: "fibra" }), "hidraulica")).toBe(false)
  })
  it("seguranca pega a categoria seguranca", () => {
    expect(eventoNoFiltro(ev({ categoria: "seguranca" }), "seguranca")).toBe(true)
    expect(eventoNoFiltro(ev({ categoria: "fibra" }), "seguranca")).toBe(false)
  })
  it("equipamentos pega equipamento tipo outro", () => {
    expect(eventoNoFiltro(ev({ tipoEquipamento: "outro" }), "equipamentos")).toBe(true)
    expect(eventoNoFiltro(ev({ tipoEquipamento: "motor" }), "equipamentos")).toBe(false)
  })
  it("tudo aceita qualquer evento", () => {
    expect(eventoNoFiltro(ev({}), "tudo")).toBe(true)
  })
})

describe("grupoDoEvento", () => {
  it("classifica por equipamento, categoria e fallback", () => {
    expect(grupoDoEvento(ev({ tipoEquipamento: "motor" }))).toBe("Motores")
    expect(grupoDoEvento(ev({ tipoEquipamento: "bateria" }))).toBe("Elétrica")
    expect(grupoDoEvento(ev({ tipoEquipamento: "outro" }))).toBe("Equipamentos")
    expect(grupoDoEvento(ev({ categoria: "inox" }))).toBe("Casco")
    expect(grupoDoEvento(ev({ tipo: "docagem" }))).toBe("Casco")
    expect(grupoDoEvento(ev({ categoria: "hidraulica_grey_water" }))).toBe("Hidráulica")
    expect(grupoDoEvento(ev({ categoria: "seguranca" }))).toBe("Segurança")
    expect(grupoDoEvento(ev({ categoria: "documento" }))).toBe("Documentos")
    expect(grupoDoEvento(ev({}))).toBe("Geral")
  })
})

describe("abaDoItem", () => {
  const equipamentos = [
    { id: "m1", tipo: "motor" }, { id: "g1", tipo: "gerador" }, { id: "o1", tipo: "outro" },
  ]
  it("motor vai pra motores, gerador/bateria pra eletrica, outro pra equipamentos", () => {
    expect(abaDoItem({ equipamento_id: "m1", categoria: null }, equipamentos)).toBe("motores")
    expect(abaDoItem({ equipamento_id: "g1", categoria: null }, equipamentos)).toBe("eletrica")
    expect(abaDoItem({ equipamento_id: "o1", categoria: null }, equipamentos)).toBe("equipamentos")
  })
  it("categorias novas vao pros hubs novos", () => {
    expect(abaDoItem({ equipamento_id: null, categoria: "hidraulica_agua_doce" }, [])).toBe("hidraulica")
    expect(abaDoItem({ equipamento_id: null, categoria: "hidraulica_black_water" }, [])).toBe("hidraulica")
    expect(abaDoItem({ equipamento_id: null, categoria: "seguranca" }, [])).toBe("seguranca")
  })
  it("documento e casco continuam como sempre; sem categoria cai em embarcacao", () => {
    expect(abaDoItem({ equipamento_id: null, categoria: "documento" }, [])).toBe("documentos")
    expect(abaDoItem({ equipamento_id: null, categoria: "fibra" }, [])).toBe("casco")
    expect(abaDoItem({ equipamento_id: null, categoria: null }, [])).toBe("embarcacao")
  })
})

describe("agruparPorMes", () => {
  it("agrupa preservando a ordem e rotula em pt-BR", () => {
    const grupos = agruparPorMes([
      { data: "2026-08-02" }, { data: "2026-08-01" }, { data: "2026-07-19" },
    ])
    expect(grupos).toHaveLength(2)
    expect(grupos[0].rotulo).toBe("Agosto de 2026")
    expect(grupos[0].eventos).toHaveLength(2)
    expect(grupos[1].rotulo).toBe("Julho de 2026")
  })
})

describe("zerarCiclo", () => {
  it("sempre zera a data; horas só quando o item monitora horas e há leitura", () => {
    expect(zerarCiclo({ intervalo_horas: 250 }, { data: "2026-08-06", horas: 1510 }))
      .toEqual({ ultimo_ciclo_data: "2026-08-06", ultimo_ciclo_horas: 1510 })
    expect(zerarCiclo({ intervalo_horas: null }, { data: "2026-08-06", horas: 1510 }))
      .toEqual({ ultimo_ciclo_data: "2026-08-06" })
    expect(zerarCiclo({ intervalo_horas: 250 }, { data: "2026-08-06", horas: null }))
      .toEqual({ ultimo_ciclo_data: "2026-08-06" })
  })
})

describe("validarNovoItem", () => {
  it("exige pelo menos uma regra de vencimento", () => {
    expect(validarNovoItem({ intervaloHoras: null, intervaloMeses: null, dataFixa: null }).ok).toBe(false)
    expect(validarNovoItem({ intervaloHoras: 250, intervaloMeses: null, dataFixa: null }).ok).toBe(true)
    expect(validarNovoItem({ intervaloHoras: null, intervaloMeses: 18, dataFixa: null }).ok).toBe(true)
    expect(validarNovoItem({ intervaloHoras: null, intervaloMeses: null, dataFixa: "2027-01-10" }).ok).toBe(true)
  })
  it("recusa intervalos não positivos", () => {
    expect(validarNovoItem({ intervaloHoras: 0, intervaloMeses: null, dataFixa: null }).ok).toBe(false)
    expect(validarNovoItem({ intervaloHoras: null, intervaloMeses: -2, dataFixa: null }).ok).toBe(false)
  })
})
