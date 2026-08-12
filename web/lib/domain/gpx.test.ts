import { describe, expect, it } from "vitest"
import { MAX_PONTOS_TRILHA } from "./geo"
import { hashTrilhaGpx, paraPontosArmazenaveis, parseGpx } from "./gpx"

function trkpt(lat: number, lon: number, iso?: string): string {
  return `<trkpt lat="${lat}" lon="${lon}">${iso ? `<time>${iso}</time>` : ""}</trkpt>`
}

function gpx(corpo: string): string {
  return `<?xml version="1.0"?><gpx version="1.1" creator="teste">${corpo}</gpx>`
}

describe("parseGpx — casos basicos", () => {
  it("uma trilha com horario vira 1 trilha, pontos na ordem, sem avisos", () => {
    const xml = gpx(`
      <trk><name>Saida da manha</name><trkseg>
        ${trkpt(-22.9, -43.1, "2026-01-05T12:00:00Z")}
        ${trkpt(-22.91, -43.11, "2026-01-05T12:05:00Z")}
        ${trkpt(-22.92, -43.12, "2026-01-05T12:10:00Z")}
      </trkseg></trk>
    `)
    const r = parseGpx(xml)
    expect(r.erro).toBeNull()
    expect(r.trilhas).toHaveLength(1)
    const t = r.trilhas[0]
    expect(t.nome).toBe("Saida da manha")
    expect(t.semHorario).toBe(false)
    expect(t.pontos).toHaveLength(3)
    expect(t.pontos.map((p) => p.t)).toEqual([...t.pontos.map((p) => p.t)].sort((a, b) => (a as number) - (b as number)))
    expect(t.pontosOriginais).toBe(3)
    expect(t.pontosResumidosPara).toBeNull()
  })

  it("multiplas <trk> viram multiplas trilhas candidatas", () => {
    const xml = gpx(`
      <trk><trkseg>${trkpt(-22.9, -43.1, "2026-01-01T10:00:00Z")}${trkpt(-22.91, -43.11, "2026-01-01T10:05:00Z")}</trkseg></trk>
      <trk><trkseg>${trkpt(-23.0, -44.0, "2026-01-02T10:00:00Z")}${trkpt(-23.01, -44.01, "2026-01-02T10:05:00Z")}</trkseg></trk>
    `)
    const r = parseGpx(xml)
    expect(r.trilhas).toHaveLength(2)
  })
})

describe("parseGpx — horario ausente", () => {
  it("pontos sem <time> marcam a trilha como semHorario, mas ela importa normalmente", () => {
    const xml = gpx(`
      <trk><trkseg>
        ${trkpt(-22.9, -43.1)}
        ${trkpt(-22.91, -43.11)}
        ${trkpt(-22.92, -43.12)}
      </trkseg></trk>
    `)
    const r = parseGpx(xml)
    expect(r.trilhas).toHaveLength(1)
    expect(r.trilhas[0].semHorario).toBe(true)
    expect(r.trilhas[0].pontos).toHaveLength(3)
    expect(r.trilhas[0].pontos.every((p) => p.t === null)).toBe(true)
  })

  it("trilha com ALGUNS pontos sem horario tambem vira semHorario (nao ha meio-termo honesto)", () => {
    const xml = gpx(`
      <trk><trkseg>
        ${trkpt(-22.9, -43.1, "2026-01-05T12:00:00Z")}
        ${trkpt(-22.91, -43.11)}
        ${trkpt(-22.92, -43.12, "2026-01-05T12:10:00Z")}
      </trkseg></trk>
    `)
    const r = parseGpx(xml)
    expect(r.trilhas[0].semHorario).toBe(true)
  })
})

describe("parseGpx — reordenacao", () => {
  it("pontos com timestamp fora de ordem sao reordenados por tempo crescente", () => {
    const xml = gpx(`
      <trk><trkseg>
        ${trkpt(-22.92, -43.12, "2026-01-05T12:10:00Z")}
        ${trkpt(-22.90, -43.10, "2026-01-05T12:00:00Z")}
        ${trkpt(-22.91, -43.11, "2026-01-05T12:05:00Z")}
      </trkseg></trk>
    `)
    const r = parseGpx(xml)
    const pontos = r.trilhas[0].pontos
    expect(pontos.map((p) => p.la)).toEqual([-22.9, -22.91, -22.92])
    expect(pontos.every((p, i) => i === 0 || (p.t as number) >= (pontos[i - 1].t as number))).toBe(true)
  })
})

describe("parseGpx — limite de pontos (amostragem uniforme)", () => {
  it("trilha maior que MAX_PONTOS_TRILHA e reduzida e o resumo informa quantos pontos originais havia", () => {
    const total = MAX_PONTOS_TRILHA + 500
    const inicio = Date.parse("2026-01-05T00:00:00Z") / 1000
    let corpo = "<trk><trkseg>"
    for (let i = 0; i < total; i++) {
      const iso = new Date((inicio + i * 10) * 1000).toISOString()
      corpo += trkpt(-22.9 - i * 0.0001, -43.1 - i * 0.0001, iso)
    }
    corpo += "</trkseg></trk>"
    const r = parseGpx(gpx(corpo))
    expect(r.trilhas).toHaveLength(1)
    const t = r.trilhas[0]
    expect(t.pontosOriginais).toBe(total)
    expect(t.pontos).toHaveLength(MAX_PONTOS_TRILHA)
    expect(t.pontosResumidosPara).toBe(MAX_PONTOS_TRILHA)
    // amostragem preserva primeiro e ultimo ponto real da trilha
    expect(t.pontos[0].t).toBeCloseTo(inicio, 0)
    expect(t.pontos[t.pontos.length - 1].t).toBeCloseTo(inicio + (total - 1) * 10, 0)
  })
})

describe("parseGpx — coordenadas absurdas", () => {
  it("pontos fora do intervalo valido de lat/lon sao descartados sem derrubar a trilha", () => {
    const xml = gpx(`
      <trk><trkseg>
        ${trkpt(-22.9, -43.1, "2026-01-05T12:00:00Z")}
        ${trkpt(200, 999, "2026-01-05T12:05:00Z")}
        ${trkpt(-22.92, -43.12, "2026-01-05T12:10:00Z")}
      </trkseg></trk>
    `)
    const r = parseGpx(xml)
    expect(r.trilhas).toHaveLength(1)
    expect(r.trilhas[0].pontos).toHaveLength(2)
    expect(r.trilhas[0].pontosDescartados).toBe(1)
  })

  it("trk cujos pontos sao TODOS absurdos vira trilha vazia ignorada, nunca aparece no resultado", () => {
    const xml = gpx(`
      <trk><trkseg>
        ${trkpt(999, 999, "2026-01-05T12:00:00Z")}
        ${trkpt(-999, -999, "2026-01-05T12:05:00Z")}
      </trkseg></trk>
    `)
    const r = parseGpx(xml)
    expect(r.trilhas).toHaveLength(0)
    expect(r.trilhasVaziasIgnoradas).toBe(1)
  })
})

describe("parseGpx — rte e wpt fora de escopo v1", () => {
  it("rotas planejadas (<rte>) sao ignoradas e contadas, nunca viram trilha", () => {
    const xml = gpx(`
      <rte><name>Rota planejada</name><rtept lat="-22.9" lon="-43.1"/><rtept lat="-23.0" lon="-44.0"/></rte>
      <trk><trkseg>${trkpt(-22.9, -43.1, "2026-01-05T12:00:00Z")}${trkpt(-22.91, -43.11, "2026-01-05T12:05:00Z")}</trkseg></trk>
    `)
    const r = parseGpx(xml)
    expect(r.rotasIgnoradas).toBe(1)
    expect(r.trilhas).toHaveLength(1)
  })

  it("waypoints (<wpt>) sao ignorados e contados", () => {
    const xml = gpx(`
      <wpt lat="-22.9" lon="-43.1"><name>Marina</name></wpt>
      <wpt lat="-23.0" lon="-44.0"/>
      <trk><trkseg>${trkpt(-22.9, -43.1, "2026-01-05T12:00:00Z")}${trkpt(-22.91, -43.11, "2026-01-05T12:05:00Z")}</trkseg></trk>
    `)
    const r = parseGpx(xml)
    expect(r.waypointsIgnorados).toBe(2)
    expect(r.trilhas).toHaveLength(1)
  })
})

describe("parseGpx — arquivo malformado ou mentiroso", () => {
  it("string vazia devolve erro honesto, nunca crasha", () => {
    const r = parseGpx("")
    expect(r.erro).toBeTruthy()
    expect(r.trilhas).toEqual([])
  })

  it("texto qualquer sem tag <gpx> devolve erro honesto", () => {
    const r = parseGpx("isso nao e um gpx, e so um texto qualquer")
    expect(r.erro).toBeTruthy()
    expect(r.trilhas).toEqual([])
  })

  it("gpx sem nenhuma trilha, rota ou waypoint devolve erro honesto", () => {
    const r = parseGpx(gpx("<metadata><name>vazio</name></metadata>"))
    expect(r.erro).toBeTruthy()
  })

  it("trkpt sem lat/lon e descartado sem lancar excecao", () => {
    const xml = gpx(`
      <trk><trkseg>
        <trkpt><time>2026-01-05T12:00:00Z</time></trkpt>
        ${trkpt(-22.9, -43.1, "2026-01-05T12:05:00Z")}
        ${trkpt(-22.91, -43.11, "2026-01-05T12:10:00Z")}
      </trkseg></trk>
    `)
    expect(() => parseGpx(xml)).not.toThrow()
    const r = parseGpx(xml)
    expect(r.trilhas[0].pontos).toHaveLength(2)
    expect(r.trilhas[0].pontosDescartados).toBe(1)
  })

  it("tag <trk> nunca fechada nao trava o parser inteiro", () => {
    const xml = gpx(`<trk><trkseg>${trkpt(-22.9, -43.1, "2026-01-05T12:00:00Z")}`)
    expect(() => parseGpx(xml)).not.toThrow()
  })
})

describe("hashTrilhaGpx — idempotencia pratica", () => {
  it("mesma trilha (mesmos pontos) produz o mesmo hash em execucoes diferentes", () => {
    const pontos = [
      { la: -22.9, lo: -43.1, t: 1000 },
      { la: -22.91, lo: -43.11, t: 1300 },
      { la: -22.92, lo: -43.12, t: 1600 },
    ]
    expect(hashTrilhaGpx(pontos)).toBe(hashTrilhaGpx(pontos.map((p) => ({ ...p }))))
  })

  it("trilhas com inicio/fim ou quantidade de pontos diferentes tem hash diferente", () => {
    const base = [
      { la: -22.9, lo: -43.1, t: 1000 },
      { la: -22.91, lo: -43.11, t: 1300 },
      { la: -22.92, lo: -43.12, t: 1600 },
    ]
    const outraQtd = [...base, { la: -22.93, lo: -43.13, t: 1900 }]
    const outroFim = [base[0], base[1], { la: -30, lo: -50, t: 1600 }]
    expect(hashTrilhaGpx(base)).not.toBe(hashTrilhaGpx(outraQtd))
    expect(hashTrilhaGpx(base)).not.toBe(hashTrilhaGpx(outroFim))
  })

  it("trilha sem horario ainda produz hash deterministico (t null)", () => {
    const pontos = [
      { la: -22.9, lo: -43.1, t: null },
      { la: -22.91, lo: -43.11, t: null },
    ]
    expect(hashTrilhaGpx(pontos)).toBe(hashTrilhaGpx(pontos.map((p) => ({ ...p }))))
    expect(hashTrilhaGpx(pontos)).not.toBe("")
  })
})

describe("paraPontosArmazenaveis", () => {
  it("mantem o t real quando existe", () => {
    const r = paraPontosArmazenaveis([{ la: 1, lo: 2, t: 500 }])
    expect(r).toEqual([{ la: 1, lo: 2, t: 500 }])
  })

  it("usa indice sequencial quando t e null (nunca usar pra duracao/velocidade)", () => {
    const r = paraPontosArmazenaveis([
      { la: 1, lo: 2, t: null },
      { la: 3, lo: 4, t: null },
    ])
    expect(r).toEqual([
      { la: 1, lo: 2, t: 0 },
      { la: 3, lo: 4, t: 1 },
    ])
  })
})
