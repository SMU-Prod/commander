import { afterEach, describe, expect, it } from "vitest"
import { dataSP, diaCivilSP, diasAteData, formatarCarimbo, horaSP, tempoRelativo } from "./datas"

describe("diasAteData", () => {
  it("0 é hoje, positivo é futuro, negativo é passado", () => {
    expect(diasAteData("2026-08-15", "2026-08-15")).toBe(0)
    expect(diasAteData("2026-08-22", "2026-08-15")).toBe(7)
    expect(diasAteData("2026-08-10", "2026-08-15")).toBe(-5)
  })
  it("atravessa mês e ano sem escorregar", () => {
    expect(diasAteData("2026-09-01", "2026-08-31")).toBe(1)
    expect(diasAteData("2027-01-01", "2026-12-31")).toBe(1)
    // 2028 é bissexto: 29/02 existe.
    expect(diasAteData("2028-03-01", "2028-02-28")).toBe(2)
  })
  it("não perde um dia por causa de fuso — a conta é sobre datas civis", () => {
    // `new Date("2026-08-22")` seria lido como UTC e viraria 21/08 no Brasil;
    // este teste é a trava contra alguém "simplificar" pra isso.
    expect(diasAteData("2026-08-22", "2026-08-21")).toBe(1)
  })
})

describe("dataSP", () => {
  it("converte epoch em AAAA-MM-DD no fuso de Sao Paulo (UTC-3)", () => {
    const epoca = Date.UTC(2026, 0, 5, 14, 30, 0) / 1000 // 14:30 UTC de 05/01 = 11:30 em SP, mesmo dia
    expect(dataSP(epoca)).toBe("2026-01-05")
  })
  it("madrugada UTC ainda pertence ao dia anterior em SP", () => {
    const epoca = Date.UTC(2026, 0, 6, 2, 15, 0) / 1000 // 02:15 UTC do dia 06 = 23:15 do dia 05 em SP
    expect(dataSP(epoca)).toBe("2026-01-05")
  })
})

describe("horaSP", () => {
  it("converte epoch em HH:MM no fuso de Sao Paulo (UTC-3)", () => {
    const epoca = Date.UTC(2024, 0, 15, 14, 30, 0) / 1000 // 14:30 UTC = 11:30 em SP
    expect(horaSP(epoca)).toBe("11:30")
  })
  it("vira o dia anterior quando o UTC ainda esta de madrugada em SP", () => {
    const epoca = Date.UTC(2024, 0, 15, 2, 15, 0) / 1000 // 02:15 UTC = 23:15 do dia 14 em SP
    expect(horaSP(epoca)).toBe("23:15")
  })
})

describe("tempoRelativo", () => {
  const agora = Date.UTC(2026, 7, 9, 12, 0, 0)

  it("menos de 1 minuto: 'agora mesmo'", () => {
    expect(tempoRelativo(agora - 30_000, agora)).toBe("agora mesmo")
  })
  it("minutos: 'há N min'", () => {
    expect(tempoRelativo(agora - 120_000, agora)).toBe("há 2 min")
  })
  it("exatamente 60 min vira 'há 1 h'", () => {
    expect(tempoRelativo(agora - 3_600_000, agora)).toBe("há 1 h")
  })
  it("horas: 'há N h'", () => {
    expect(tempoRelativo(agora - 2 * 3_600_000, agora)).toBe("há 2 h")
  })
  it("mais de 24h: 'há N d'", () => {
    expect(tempoRelativo(agora - 25 * 3_600_000, agora)).toBe("há 1 d")
  })
  it("instante no futuro (relógio ligeiramente dessincronizado) não vira negativo", () => {
    expect(tempoRelativo(agora + 5_000, agora)).toBe("agora mesmo")
  })
})

describe("formatarCarimbo — carimbo do hero de /hoje ('Última atualização')", () => {
  // agora = 2026-08-11 12:00 em SP (15:00 UTC)
  const agora = new Date(Date.UTC(2026, 7, 11, 15, 0, 0))

  it("mesmo dia em SP: 'Hoje, HH:MM'", () => {
    const iso = new Date(Date.UTC(2026, 7, 11, 11, 30, 0)).toISOString() // 08:30 SP
    expect(formatarCarimbo(iso, agora)).toBe("Hoje, 08:30")
  })
  it("dia anterior em SP: 'Ontem, HH:MM'", () => {
    const iso = new Date(Date.UTC(2026, 7, 10, 20, 0, 0)).toISOString() // 17:00 SP do dia 10
    expect(formatarCarimbo(iso, agora)).toBe("Ontem, 17:00")
  })
  it("mais de 2 dias: 'DD/MM, HH:MM'", () => {
    const iso = new Date(Date.UTC(2026, 7, 6, 12, 0, 0)).toISOString() // 09:00 SP do dia 06
    expect(formatarCarimbo(iso, agora)).toBe("06/08, 09:00")
  })
  it("virada de dia por fuso: madrugada UTC ainda é 'hoje' em SP (mesmo cuidado de horaSP)", () => {
    const agoraDeMadrugada = new Date(Date.UTC(2026, 7, 11, 2, 0, 0)) // 23:00 SP do dia 10
    const iso = new Date(Date.UTC(2026, 7, 11, 1, 30, 0)).toISOString() // 22:30 SP do dia 10 — mesmo dia em SP
    expect(formatarCarimbo(iso, agoraDeMadrugada)).toBe("Hoje, 22:30")
  })
})

describe("formatarCarimbo — data civil (sem hora) não anda um dia pra trás", () => {
  // agora = 2026-08-15 12:00 em SP (15:00 UTC)
  const agora = new Date(Date.UTC(2026, 7, 15, 15, 0, 0))

  it("a data gravada sem hora é exibida no dia em que foi gravada", () => {
    // ESTE É O BUG: `new Date("2026-08-10")` é meia-noite UTC, que em UTC-3 é
    // 21:00 do dia 09 — a leitura de 10/08 saía "09/08, 21:00" no cartão
    // "Motores" da Início. Data civil não é instante: é o dia, e ponto.
    expect(formatarCarimbo("2026-08-10", agora)).toBe("10/08")
  })

  it("não inventa um relógio pra um dado que não tem hora", () => {
    // "00:00" seria um número bonito que não é fato (docs/DESIGN.md §6, 7).
    expect(formatarCarimbo("2026-08-10", agora)).not.toContain(":")
  })

  it("hoje e ontem em data civil usam as mesmas palavras do carimbo completo", () => {
    expect(formatarCarimbo("2026-08-15", agora)).toBe("Hoje")
    expect(formatarCarimbo("2026-08-14", agora)).toBe("Ontem")
  })

  it("atravessa a virada do mês sem escorregar", () => {
    const primeiroDeSetembro = new Date(Date.UTC(2026, 8, 1, 15, 0, 0))
    expect(formatarCarimbo("2026-08-31", primeiroDeSetembro)).toBe("Ontem")
    expect(formatarCarimbo("2026-08-30", primeiroDeSetembro)).toBe("30/08")
  })

  it("a régua é a marina, não o relógio do servidor — vale em qualquer fuso", () => {
    // O servidor do Commander roda na Vercel (UTC) e a máquina de quem
    // desenvolve, em SP. Nenhum dos dois pode mudar a data que o dono lê:
    // Kiritimati (UTC+14) e Midway (UTC-11) são os dois extremos do planeta.
    const tzOriginal = process.env.TZ
    try {
      for (const tz of ["UTC", "Pacific/Kiritimati", "Pacific/Midway", "America/Sao_Paulo"]) {
        process.env.TZ = tz
        expect(formatarCarimbo("2026-08-10", agora), `fuso ${tz}`).toBe("10/08")
        expect(formatarCarimbo("2026-08-15", agora), `fuso ${tz}`).toBe("Hoje")
      }
    } finally {
      process.env.TZ = tzOriginal
    }
  })

  it("instante completo continua com hora — o carimbo real não perdeu nada", () => {
    const iso = new Date(Date.UTC(2026, 7, 10, 12, 0, 0)).toISOString() // 09:00 SP
    expect(formatarCarimbo(iso, agora)).toBe("10/08, 09:00")
  })
})

describe("diaCivilSP — o dia de um carimbo é o dia NA MARINA", () => {
  const tzOriginal = process.env.TZ
  afterEach(() => { process.env.TZ = tzOriginal })

  it("tira a data em SP de um timestamptz, não a data em UTC", () => {
    // 01:00 UTC do dia 12 é 22:00 do dia 11 na marina. Cortar os 10 primeiros
    // caracteres do ISO (o atalho antigo de `alertas.ts`) daria "2026-08-12"
    // e o app contaria um dia a menos desde a leitura.
    expect(diaCivilSP("2026-08-12T01:00:00+00:00")).toBe("2026-08-11")
    expect(diaCivilSP("2026-08-12T14:32:00+00:00")).toBe("2026-08-12")
  })

  it("data civil passa inteira — não tem instante pra converter", () => {
    expect(diaCivilSP("2026-08-10")).toBe("2026-08-10")
  })

  it("não depende do fuso do processo", () => {
    for (const tz of ["UTC", "Pacific/Kiritimati", "Pacific/Midway"]) {
      process.env.TZ = tz
      expect(diaCivilSP("2026-08-12T01:00:00+00:00"), `fuso ${tz}`).toBe("2026-08-11")
    }
  })
})
