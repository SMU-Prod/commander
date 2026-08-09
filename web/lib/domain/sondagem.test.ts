import { describe, expect, it } from "vitest"
import {
  celulaId,
  deveAceitarPorMovimento,
  parseDBT,
  parseDPT,
  parseSentencaProfundidade,
  reduzirPorCelula,
  validarChecksum,
  validarLeituraSondagem,
} from "./sondagem"

describe("validarChecksum", () => {
  it("aceita sentenca com checksum correto (exemplo de referencia NMEA)", () => {
    expect(validarChecksum("$GPVTG,230.0,T,231.3,M,3.0,N,5.6,K,D*24")).toBe(true)
  })

  it("aceita DPT com checksum correto", () => {
    expect(validarChecksum("$SDDPT,10.5,0.5*66")).toBe(true)
  })

  it("rejeita checksum errado — dado corrompido nunca vira sondagem", () => {
    expect(validarChecksum("$SDDPT,10.5,0.5*00")).toBe(false)
  })

  it("rejeita um unico caractere trocado no corpo (corrupcao tipica de radio/serial)", () => {
    // mesma sentenca de "$SDDPT,10.5,0.5*66", com 10.5 -> 19.5 mas checksum antigo
    expect(validarChecksum("$SDDPT,19.5,0.5*66")).toBe(false)
  })

  it("rejeita sentenca sem $ ou sem *hh", () => {
    expect(validarChecksum("SDDPT,10.5,0.5*66")).toBe(false)
    expect(validarChecksum("$SDDPT,10.5,0.5")).toBe(false)
  })

  it("rejeita hex de checksum malformado", () => {
    expect(validarChecksum("$SDDPT,10.5,0.5*ZZ")).toBe(false)
  })
})

describe("parseDPT", () => {
  it("extrai profundidade bruta e offset positivo (referencia linha d'agua)", () => {
    expect(parseDPT("$SDDPT,10.5,0.5*66")).toEqual({ profundidadeBrutaM: 10.5, offsetM: 0.5 })
  })

  it("extrai offset negativo (referencia quilha)", () => {
    expect(parseDPT("$SDDPT,10.5,-0.3*4D")).toEqual({ profundidadeBrutaM: 10.5, offsetM: -0.3 })
  })

  it("trata offset ausente como zero (nem todo equipamento envia offset configurado)", () => {
    expect(parseDPT("$SDDPT,10.5,*4D")).toEqual({ profundidadeBrutaM: 10.5, offsetM: 0 })
  })

  it("ignora o campo de alcance maximo do v3.0 quando presente", () => {
    expect(parseDPT("$SDDPT,10.5,0.5,100*7B")).toEqual({ profundidadeBrutaM: 10.5, offsetM: 0.5 })
  })

  it("aceita qualquer talker id de 2 letras antes de DPT", () => {
    // mesmo corpo de outro talker (ex.: II de integrated instruments) precisa de checksum proprio
    const comChecksumProprio = "$IIDPT,10.5,0.5*71"
    expect(parseDPT(comChecksumProprio)?.profundidadeBrutaM).toBe(10.5)
  })

  it("rejeita checksum invalido", () => {
    expect(parseDPT("$SDDPT,10.5,0.5*00")).toBeNull()
  })

  it("rejeita sentenca que nao e DPT", () => {
    expect(parseDPT("$SDDBT,034.4,f,010.5,M,005.7,F*03")).toBeNull()
  })

  it("rejeita profundidade nao numerica", () => {
    // "$SDDPT,--,0.5" com checksum calculado pra essa string exata
    expect(parseDPT("$SDDPT,--,0.5*7C")).toBeNull()
  })
})

describe("parseDBT", () => {
  it("prefere o campo em metros quando presente", () => {
    expect(parseDBT("$SDDBT,034.4,f,010.5,M,005.7,F*03")).toEqual({ profundidadeBrutaM: 10.5 })
  })

  it("cai para pes*0.3048 quando o campo de metros esta vazio", () => {
    const r = parseDBT("$SDDBT,034.4,f,,M,005.7,F*29")
    expect(r?.profundidadeBrutaM).toBeCloseTo(34.4 * 0.3048, 4)
  })

  it("devolve null quando nenhum campo de profundidade esta presente", () => {
    expect(parseDBT("$SDDBT,,f,,M,,F*28")).toBeNull()
  })

  it("rejeita checksum invalido", () => {
    expect(parseDBT("$SDDBT,034.4,f,010.5,M,005.7,F*00")).toBeNull()
  })

  it("rejeita sentenca que nao e DBT", () => {
    expect(parseDBT("$SDDPT,10.5,0.5*66")).toBeNull()
  })
})

describe("parseSentencaProfundidade", () => {
  it("DPT com offset positivo soma direto — profundidade abaixo da linha d'agua", () => {
    expect(parseSentencaProfundidade("$SDDPT,10.5,0.5*66")).toEqual({ profundidadeM: 11, fonte: "DPT" })
  })

  it("DPT com offset negativo soma direto — profundidade abaixo da quilha (mais conservadora)", () => {
    const r = parseSentencaProfundidade("$SDDPT,10.5,-0.3*4D")
    expect(r?.fonte).toBe("DPT")
    expect(r?.profundidadeM).toBeCloseTo(10.2, 6)
  })

  it("DBT usa o valor em metros direto, sem offset (nao tem esse campo)", () => {
    expect(parseSentencaProfundidade("$SDDBT,034.4,f,010.5,M,005.7,F*03")).toEqual({ profundidadeM: 10.5, fonte: "DBT" })
  })

  it("devolve null pra sentenca com checksum corrompido, mesmo que pareca DPT/DBT valida", () => {
    expect(parseSentencaProfundidade("$SDDPT,10.5,0.5*00")).toBeNull()
  })

  it("devolve null pra sentenca de outro tipo (ex.: GGA)", () => {
    expect(parseSentencaProfundidade("$GPVTG,230.0,T,231.3,M,3.0,N,5.6,K,D*24")).toBeNull()
  })
})

describe("validarLeituraSondagem", () => {
  const base = { profundidadeM: 12, lat: -23, lon: -43, idadePosicaoS: 2, velocidadeKt: 6 }

  it("aceita leitura plausivel", () => {
    expect(validarLeituraSondagem(base)).toEqual({ ok: true })
  })

  it("rejeita profundidade zero ou negativa", () => {
    expect(validarLeituraSondagem({ ...base, profundidadeM: 0 }).ok).toBe(false)
    expect(validarLeituraSondagem({ ...base, profundidadeM: -1 }).ok).toBe(false)
  })

  it("rejeita profundidade absurda (sensor sem eco / erro de leitura)", () => {
    expect(validarLeituraSondagem({ ...base, profundidadeM: 5000 }).ok).toBe(false)
  })

  it("rejeita leitura sem posicao GPS", () => {
    expect(validarLeituraSondagem({ ...base, lat: null, lon: null }).ok).toBe(false)
    expect(validarLeituraSondagem({ ...base, lat: null }).ok).toBe(false)
  })

  it("rejeita posicao velha demais", () => {
    expect(validarLeituraSondagem({ ...base, idadePosicaoS: 11 }).ok).toBe(false)
    expect(validarLeituraSondagem({ ...base, idadePosicaoS: 10 }).ok).toBe(true)
  })

  it("rejeita barco rapido demais pro feixe do sonar acompanhar", () => {
    expect(validarLeituraSondagem({ ...base, velocidadeKt: 21 }).ok).toBe(false)
    expect(validarLeituraSondagem({ ...base, velocidadeKt: 20 }).ok).toBe(true)
  })

  it("velocidade desconhecida (null) nao bloqueia — nem todo transporte informa SOG", () => {
    expect(validarLeituraSondagem({ ...base, velocidadeKt: null }).ok).toBe(true)
  })
})

describe("deveAceitarPorMovimento", () => {
  it("sempre aceita a primeira leitura (sem historico)", () => {
    expect(deveAceitarPorMovimento(null, { lat: -23, lon: -43, t: 0 })).toBe(true)
  })

  it("rejeita leitura no mesmo ponto pouco depois — barco parado nao acrescenta informacao nova", () => {
    const ultima = { lat: -23, lon: -43, t: 0 }
    const nova = { lat: -23, lon: -43, t: 5 }
    expect(deveAceitarPorMovimento(ultima, nova)).toBe(false)
  })

  it("aceita quando o barco andou o bastante (meia celula)", () => {
    const ultima = { lat: -23, lon: -43, t: 0 }
    // ~20m ao norte
    const nova = { lat: -23 + 20 / 111320, lon: -43, t: 5 }
    expect(deveAceitarPorMovimento(ultima, nova)).toBe(true)
  })

  it("aceita mesmo parado se passou tempo suficiente (mare muda devagar, mas muda)", () => {
    const ultima = { lat: -23, lon: -43, t: 0 }
    const nova = { lat: -23, lon: -43, t: 700 }
    expect(deveAceitarPorMovimento(ultima, nova)).toBe(true)
  })
})

describe("celulaId", () => {
  it("mesma celula pra pontos muito proximos", () => {
    expect(celulaId(-23.001, -43.001)).toBe(celulaId(-23.0010001, -43.0010001))
  })

  it("celulas diferentes pra pontos claramente afastados", () => {
    expect(celulaId(-23.0, -43.0)).not.toBe(celulaId(-23.01, -43.01))
  })
})

describe("reduzirPorCelula", () => {
  it("uma leitura isolada vira sua propria celula, sem alteracao", () => {
    const r = reduzirPorCelula([{ lat: -23, lon: -43, profundidadeM: 8 }])
    expect(r).toHaveLength(1)
    expect(r[0].profundidadeM).toBe(8)
    expect(r[0].leituras).toBe(1)
  })

  it("mediana com numero impar de leituras na mesma celula", () => {
    const r = reduzirPorCelula([
      { lat: -23, lon: -43, profundidadeM: 8 },
      { lat: -23, lon: -43, profundidadeM: 10 },
      { lat: -23, lon: -43, profundidadeM: 9 },
    ])
    expect(r).toHaveLength(1)
    expect(r[0].profundidadeM).toBe(9)
    expect(r[0].leituras).toBe(3)
  })

  it("numero par de leituras desempata pro MENOR dos dois centrais (nunca otimista)", () => {
    const r = reduzirPorCelula([
      { lat: -23, lon: -43, profundidadeM: 8 },
      { lat: -23, lon: -43, profundidadeM: 10 },
    ])
    expect(r[0].profundidadeM).toBe(8)
  })

  it("uma leitura isolada muito rasa nao destrói a celula (mediana perdoa 1 outlier, minimo nao perdoaria)", () => {
    const r = reduzirPorCelula([
      { lat: -23, lon: -43, profundidadeM: 12 },
      { lat: -23, lon: -43, profundidadeM: 11 },
      { lat: -23, lon: -43, profundidadeM: 0.3 }, // bounce de sonar isolado
    ])
    expect(r[0].profundidadeM).toBe(11)
  })

  it("agrupa por celula — pontos afastados nao se misturam", () => {
    const r = reduzirPorCelula([
      { lat: -23, lon: -43, profundidadeM: 8 },
      { lat: -23.05, lon: -43.05, profundidadeM: 20 },
    ])
    expect(r).toHaveLength(2)
  })
})
