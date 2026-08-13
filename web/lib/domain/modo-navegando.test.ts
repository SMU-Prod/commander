import { describe, expect, it } from "vitest"
import {
  RAIO_CHEGADA_DESTINO_M,
  amortecerRumo,
  chegouAoDestino,
  diferencaAngular,
  emMovimento,
  progressoNaRota,
  zoomPorVelocidade,
} from "./modo-navegando"

describe("modo-navegando", () => {
  describe("emMovimento — entrada do modo", () => {
    it("nao ativa parado nem sem GPS", () => {
      expect(emMovimento(null)).toBe(false)
      expect(emMovimento(0)).toBe(false)
    })
    it("nao ativa com o balanco tipico de barco atracado (GPS chacoalha alguns decimos de no)", () => {
      expect(emMovimento(0.3)).toBe(false)
      expect(emMovimento(1.5)).toBe(false)
      expect(emMovimento(1.99)).toBe(false)
    })
    it("ativa em movimento real", () => {
      expect(emMovimento(2)).toBe(true)
      expect(emMovimento(5)).toBe(true)
      expect(emMovimento(25)).toBe(true)
    })
  })

  describe("chegouAoDestino", () => {
    it("raio de chegada e o esperado (documenta o limiar escolhido)", () => {
      expect(RAIO_CHEGADA_DESTINO_M).toBe(50)
    })
    it("ainda longe nao chegou", () => {
      expect(chegouAoDestino(1)).toBe(false) // 1 MN ~ 1852 m
      expect(chegouAoDestino(0.1)).toBe(false) // ~185 m
    })
    it("dentro do raio conta como chegada", () => {
      expect(chegouAoDestino(0)).toBe(true)
      expect(chegouAoDestino(RAIO_CHEGADA_DESTINO_M / 1852)).toBe(true) // exatamente no raio
      expect(chegouAoDestino(0.02)).toBe(true) // ~37 m
    })
  })

  describe("zoomPorVelocidade", () => {
    it("parado ou sem SOG fica no zoom mais perto", () => {
      expect(zoomPorVelocidade(null)).toBe(16.5)
      expect(zoomPorVelocidade(0)).toBe(16.5)
    })
    it("afasta conforme a velocidade sobe", () => {
      const parado = zoomPorVelocidade(0)
      const devagar = zoomPorVelocidade(5)
      const cruzeiro = zoomPorVelocidade(15)
      const planando = zoomPorVelocidade(30)
      expect(devagar).toBeLessThan(parado)
      expect(cruzeiro).toBeLessThan(devagar)
      expect(planando).toBeLessThanOrEqual(cruzeiro)
    })
    it("nunca passa do piso minimo, mesmo em velocidade absurda", () => {
      expect(zoomPorVelocidade(200)).toBe(12.5)
      expect(zoomPorVelocidade(80)).toBeGreaterThanOrEqual(12.5)
    })
    it("velocidade negativa (nunca deveria acontecer, mas nao pode quebrar) cai no zoom parado", () => {
      expect(zoomPorVelocidade(-3)).toBe(16.5)
    })
  })

  describe("diferencaAngular", () => {
    it("casos simples sem virada de quadrante", () => {
      expect(diferencaAngular(10, 20)).toBe(10)
      expect(diferencaAngular(20, 10)).toBe(-10)
      expect(diferencaAngular(90, 90)).toBe(0)
    })
    it("atravessa 359 -> 0 pelo caminho curto (+), nao pelo longo (-357)", () => {
      expect(diferencaAngular(359, 2)).toBe(3)
    })
    it("atravessa 0 -> 359 pelo caminho curto (-), nao pelo longo (+357)", () => {
      expect(diferencaAngular(2, 359)).toBe(-3)
    })
    it("meia-volta exata fica no limite negativo do intervalo", () => {
      expect(diferencaAngular(0, 180)).toBe(-180)
    })
  })

  describe("amortecerRumo — suaviza sem tremer, mesmo virando 359°→0°", () => {
    it("anda so uma fracao do caminho ate o rumo novo (fator 0.5)", () => {
      expect(amortecerRumo(90, 100, 0.5)).toBeCloseTo(95, 5)
    })
    it("fator 0 nao muda nada; fator 1 vai direto pro valor novo", () => {
      expect(amortecerRumo(90, 150, 0)).toBe(90)
      expect(amortecerRumo(90, 150, 1)).toBe(150)
    })
    it("virada 359° -> 2°: o resultado fica logo apos 0°, nunca do lado errado do circulo (~180°)", () => {
      const r = amortecerRumo(359, 2, 0.5)
      expect(r).toBeCloseTo(0.5, 5)
      expect(r).not.toBeCloseTo(180, 0)
    })
    it("virada no sentido contrario, 2° -> 359°, tambem fica perto de 0°, nunca em ~180°", () => {
      const r = amortecerRumo(2, 359, 0.5)
      expect(r).toBeCloseTo(0.5, 5)
    })
    it("mantem o resultado sempre normalizado em [0, 360)", () => {
      expect(amortecerRumo(1, 358, 0.9)).toBeGreaterThanOrEqual(0)
      expect(amortecerRumo(1, 358, 0.9)).toBeLessThan(360)
    })
  })

  describe("progressoNaRota", () => {
    it("null com menos de 2 pontos", () => {
      expect(progressoNaRota([], { la: 0, lo: 0 })).toBeNull()
      expect(progressoNaRota([{ la: 0, lo: 0 }], { la: 0, lo: 0 })).toBeNull()
    })

    it("rota de uma perna so (fallback de rumo direto): proxima virada = distancia restante = distancia ate o destino", () => {
      const origem = { la: -23.0, lo: -44.0 }
      const destino = { la: -23.0, lo: -43.9 }
      const r = progressoNaRota([origem, destino], origem)
      expect(r).not.toBeNull()
      expect(r!.indiceSegmentoAtual).toBe(0)
      expect(r!.ultimoSegmento).toBe(true)
      expect(r!.proximaViradaNm).toBeCloseTo(r!.distanciaRestanteNm, 6)
      expect(r!.proximaViradaNm).toBeGreaterThan(5) // ~0.1 grau de longitude a essa latitude, dezenas de MN? checa so que e > 0 com folga
    })

    it("posicao logo apos a primeira virada: projeta no segundo segmento, soma so o que falta", () => {
      const a = { la: 0, lo: 0 }
      const b = { la: 0, lo: 1 } // 1 grau de longitude no equador
      const c = { la: 1, lo: 1 } // sobe 1 grau de latitude
      // um pouco depois de B, já subindo rumo a C
      const pos = { la: 0.05, lo: 1 }
      const r = progressoNaRota([a, b, c], pos)!
      expect(r.indiceSegmentoAtual).toBe(1)
      expect(r.ultimoSegmento).toBe(true)
      // falta so o trecho de pos ate c (bem menor que o trecho inteiro a->b->c)
      const distanciaTotalABC = 60 + 60 // ~60 MN por grau no equador, aproximado
      expect(r.distanciaRestanteNm).toBeLessThan(distanciaTotalABC)
      expect(r.distanciaRestanteNm).toBeCloseTo(r.proximaViradaNm, 6)
    })

    it("distancia restante soma os segmentos AINDA NAO percorridos, nao so o atual", () => {
      const a = { la: 0, lo: 0 }
      const b = { la: 0, lo: 1 }
      const c = { la: 0, lo: 2 }
      const d = { la: 0, lo: 3 }
      // ainda no primeiro segmento (perto de A)
      const pos = { la: 0, lo: 0.1 }
      const r = progressoNaRota([a, b, c, d], pos)!
      expect(r.indiceSegmentoAtual).toBe(0)
      expect(r.ultimoSegmento).toBe(false)
      // distancia restante inclui b->c e c->d além do trecho até b
      expect(r.distanciaRestanteNm).toBeGreaterThan(r.proximaViradaNm)
    })

    it("posicao fora da linha (ao lado) ainda projeta no segmento mais perto por perpendicular", () => {
      const a = { la: 0, lo: 0 }
      const b = { la: 0, lo: 2 }
      const c = { la: 2, lo: 2 }
      // ao lado do trecho a->b, mais perto dele que de b->c
      const pos = { la: 0.05, lo: 1 }
      const r = progressoNaRota([a, b, c], pos)!
      expect(r.indiceSegmentoAtual).toBe(0)
    })
  })
})
