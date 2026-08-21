import { describe, expect, it } from "vitest"
import {
  bancosAoVivo,
  carimboAoVivo,
  hzParaRpm,
  JANELA_TELEMETRIA_MS,
  kelvinParaCelsius,
  motoresAoVivo,
  msParaNos,
  radParaGraus,
  rotuloFrescor,
  segundosParaHoras,
  type MapaTelemetria,
} from "./telemetria"

// Um instante fixo pra todos os testes de frescor — nenhum teste aqui lê o
// relógio de verdade, senão o resultado dependeria da hora em que o CI roda.
const AGORA = Date.parse("2026-08-20T12:00:00Z")
const ts = (msAtras: number) => new Date(AGORA - msAtras).toISOString()

describe("conversões SI → unidades da casa", () => {
  it("Kelvin vira °C (temperatura de motor e de água chegam em K)", () => {
    expect(kelvinParaCelsius(293.15)).toBeCloseTo(20, 5)
    expect(kelvinParaCelsius(358.15)).toBeCloseTo(85, 5)
    expect(kelvinParaCelsius(null)).toBeNull()
  })

  it("radianos viram graus, preservando o sinal (vento aparente é −π..π)", () => {
    expect(radParaGraus(Math.PI)).toBeCloseTo(180, 5)
    expect(radParaGraus(-Math.PI / 2)).toBeCloseTo(-90, 5)
    expect(radParaGraus(0)).toBe(0)
    expect(radParaGraus(null)).toBeNull()
  })

  it("segundos viram horas (runTime chega em s; horímetro da casa é em h)", () => {
    expect(segundosParaHoras(7200)).toBe(2)
    expect(segundosParaHoras(3_600_000)).toBe(1000)
    expect(segundosParaHoras(null)).toBeNull()
  })

  it("Hz vira rpm (revolutions do Signal K é rotação POR SEGUNDO)", () => {
    expect(hzParaRpm(25)).toBe(1500)
    expect(hzParaRpm(0)).toBe(0)
    expect(hzParaRpm(null)).toBeNull()
  })

  it("m/s vira nós — a MESMA conta do navegador de bordo, reexportada", () => {
    expect(msParaNos(10)).toBeCloseTo(19.44, 1)
    expect(msParaNos(null)).toBeNull()
  })
})

describe("rotuloFrescor", () => {
  it('leitura de até 2 min é "agora"', () => {
    expect(rotuloFrescor(ts(0), AGORA)).toBe("agora")
    expect(rotuloFrescor(ts(119_000), AGORA)).toBe("agora")
    expect(rotuloFrescor(ts(120_000), AGORA)).toBe("agora")
  })

  it("minutos até fechar uma hora, depois horas", () => {
    expect(rotuloFrescor(ts(5 * 60_000), AGORA)).toBe("há 5 min")
    expect(rotuloFrescor(ts(59 * 60_000), AGORA)).toBe("há 59 min")
    expect(rotuloFrescor(ts(60 * 60_000), AGORA)).toBe("há 1 h")
    expect(rotuloFrescor(ts(3 * 3_600_000), AGORA)).toBe("há 3 h")
    expect(rotuloFrescor(ts(47 * 3_600_000), AGORA)).toBe("há 47 h")
  })

  it("fora da janela de 48h é null — o cartão some, não mostra dado velho", () => {
    expect(rotuloFrescor(ts(JANELA_TELEMETRIA_MS), AGORA)).toBe("há 48 h")
    expect(rotuloFrescor(ts(JANELA_TELEMETRIA_MS + 1), AGORA)).toBeNull()
    expect(rotuloFrescor(ts(72 * 3_600_000), AGORA)).toBeNull()
  })

  it("ts inválido é null; ts no futuro (folga de relógio da ingestão) lê como agora", () => {
    expect(rotuloFrescor("não-é-data", AGORA)).toBeNull()
    expect(rotuloFrescor(ts(-5 * 60_000), AGORA)).toBe("agora")
  })
})

describe("carimboAoVivo", () => {
  it("fresco vira o carimbo de ao vivo", () => {
    expect(carimboAoVivo(ts(30_000), AGORA)).toEqual({ texto: "Ao vivo · agora", aoVivo: true })
  })

  it("mais velho diz quando foi a última leitura, sem fingir ao vivo", () => {
    expect(carimboAoVivo(ts(3 * 3_600_000), AGORA)).toEqual({ texto: "Última leitura há 3 h", aoVivo: false })
    expect(carimboAoVivo(ts(7 * 60_000), AGORA)).toEqual({ texto: "Última leitura há 7 min", aoVivo: false })
  })

  it("sem ts, ou fora da janela, não há carimbo nenhum", () => {
    expect(carimboAoVivo(null, AGORA)).toBeNull()
    expect(carimboAoVivo(ts(49 * 3_600_000), AGORA)).toBeNull()
  })
})

describe("bancosAoVivo", () => {
  it("agrupa voltagem e corrente por banco, com rótulo pra id numérico", () => {
    const mapa: MapaTelemetria = {
      "electrical.batteries.0.voltage": { valor: 12.6, ts: ts(60_000) },
      "electrical.batteries.0.current": { valor: -4.2, ts: ts(30_000) },
      "electrical.batteries.1.voltage": { valor: 13.8, ts: ts(90_000) },
    }
    const { bancos, tsMaisNovo } = bancosAoVivo(mapa)
    expect(bancos).toEqual([
      { rotulo: "Banco 0", voltagem: 12.6, corrente: -4.2 },
      { rotulo: "Banco 1", voltagem: 13.8, corrente: null },
    ])
    expect(tsMaisNovo).toBe(ts(30_000))
  })

  it("id com nome fica com o nome — sem inventar numeração", () => {
    const mapa: MapaTelemetria = {
      "electrical.batteries.house.voltage": { valor: 12.4, ts: ts(0) },
    }
    expect(bancosAoVivo(mapa).bancos).toEqual([{ rotulo: "house", voltagem: 12.4, corrente: null }])
  })

  it("valor que não é número finito vira null, nunca zero — e banco sem nada some", () => {
    const mapa: MapaTelemetria = {
      "electrical.batteries.0.voltage": { valor: "12.6", ts: ts(0) },
      "electrical.batteries.0.current": { valor: Number.NaN, ts: ts(0) },
      "electrical.batteries.1.voltage": { valor: 12.1, ts: ts(0) },
    }
    const { bancos } = bancosAoVivo(mapa)
    expect(bancos).toEqual([{ rotulo: "Banco 1", voltagem: 12.1, corrente: null }])
  })

  it("mapa sem elétrica devolve vazio e sem carimbo", () => {
    const mapa: MapaTelemetria = {
      "navigation.speedOverGround": { valor: 3.1, ts: ts(0) },
    }
    expect(bancosAoVivo(mapa)).toEqual({ bancos: [], tsMaisNovo: null })
  })
})

describe("motoresAoVivo", () => {
  const doisMotores = [{ posicao: "BB" as const }, { posicao: "BE" as const }]

  it("converte as três leituras e casa port↔BB / starboard↔BE quando o vínculo é único", () => {
    const mapa: MapaTelemetria = {
      "propulsion.port.revolutions": { valor: 25, ts: ts(10_000) },
      "propulsion.port.temperature": { valor: 358.15, ts: ts(20_000) },
      "propulsion.port.runTime": { valor: 3_600_000, ts: ts(30_000) },
      "propulsion.starboard.revolutions": { valor: 26, ts: ts(5_000) },
    }
    const { motores, tsMaisNovo } = motoresAoVivo(mapa, doisMotores)
    expect(motores).toHaveLength(2)
    expect(motores[0].rotulo).toBe("Motor BB")
    expect(motores[0].rpm).toBe(1500)
    expect(motores[0].temperaturaC).toBeCloseTo(85, 5)
    expect(motores[0].horas).toBe(1000)
    expect(motores[1]).toEqual({ rotulo: "Motor BE", rpm: 1560, temperaturaC: null, horas: null })
    expect(tsMaisNovo).toBe(ts(5_000))
  })

  it("nome que não é port/starboard sai pelo nome do path, sem inventar vínculo", () => {
    const mapa: MapaTelemetria = {
      "propulsion.main.revolutions": { valor: 20, ts: ts(0) },
    }
    const { motores } = motoresAoVivo(mapa, [{ posicao: "central" }])
    expect(motores).toEqual([{ rotulo: "main", rpm: 1200, temperaturaC: null, horas: null }])
  })

  it("vínculo ambíguo (dois motores BB cadastrados) também sai pelo nome do path", () => {
    const mapa: MapaTelemetria = {
      "propulsion.port.revolutions": { valor: 20, ts: ts(0) },
    }
    const { motores } = motoresAoVivo(mapa, [{ posicao: "BB" }, { posicao: "BB" }])
    expect(motores[0].rotulo).toBe("port")
  })

  it("port sem nenhum motor BB cadastrado fica no nome do path", () => {
    const mapa: MapaTelemetria = {
      "propulsion.port.revolutions": { valor: 20, ts: ts(0) },
    }
    expect(motoresAoVivo(mapa, [{ posicao: null }]).motores[0].rotulo).toBe("port")
  })

  it("motor cujas leituras são todas lixo não aparece — null nunca vira zero", () => {
    const mapa: MapaTelemetria = {
      "propulsion.port.revolutions": { valor: "alto", ts: ts(0) },
      "propulsion.starboard.revolutions": { valor: 0, ts: ts(0) },
    }
    const { motores } = motoresAoVivo(mapa, doisMotores)
    // 0 Hz é motor PARADO — leitura válida, aparece como 0 rpm de verdade.
    expect(motores).toEqual([{ rotulo: "Motor BE", rpm: 0, temperaturaC: null, horas: null }])
  })

  it("casados vêm antes (BB, depois BE), soltos depois em ordem de nome", () => {
    const mapa: MapaTelemetria = {
      "propulsion.zeta.revolutions": { valor: 10, ts: ts(0) },
      "propulsion.starboard.revolutions": { valor: 10, ts: ts(0) },
      "propulsion.alfa.revolutions": { valor: 10, ts: ts(0) },
      "propulsion.port.revolutions": { valor: 10, ts: ts(0) },
    }
    const { motores } = motoresAoVivo(mapa, doisMotores)
    expect(motores.map((m) => m.rotulo)).toEqual(["Motor BB", "Motor BE", "alfa", "zeta"])
  })

  it("mapa sem propulsão devolve vazio e sem carimbo", () => {
    expect(motoresAoVivo({}, doisMotores)).toEqual({ motores: [], tsMaisNovo: null })
  })
})
