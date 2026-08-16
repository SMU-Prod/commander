import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { FaixaTopo, nomeDoEmail, type EquipamentoFaixa, type ItemFaixa } from "./faixa-topo"

/**
 * Mesmo padrão de `abas.test.ts`: `renderToStaticMarkup` sem jsdom — a
 * `FaixaTopo` é função pura de props pra HTML, e o que precisa ser cobrado
 * é O QUE ela mostra e (tão importante quanto) o que ela se RECUSA a
 * mostrar: motor sem leitura não vira "—", revisão sem informação não vira
 * pílula, contador zerado não vira badge.
 */

const HOJE = "2026-08-15"

function motor(sobre: Partial<EquipamentoFaixa> = {}): EquipamentoFaixa {
  return { id: "m1", tipo: "motor", posicao: "BB", horas_atuais: 612, ...sobre }
}

function itemDeRevisao(sobre: Partial<ItemFaixa> = {}): ItemFaixa {
  return {
    equipamento_id: "m1",
    intervalo_horas: 100,
    intervalo_meses: null,
    data_fixa: null,
    ultimo_ciclo_data: null,
    ultimo_ciclo_horas: 550,
    ...sobre,
  }
}

const BARCO = { id: "e1", nome: "Andorinha do Mar" }

function html({
  equipamentos = [],
  itens = [],
  avisos = 0,
  email = "maria.souza@exemplo.com",
  embarcacoes = [BARCO],
}: {
  equipamentos?: EquipamentoFaixa[]
  itens?: ItemFaixa[]
  avisos?: number
  email?: string | null
  embarcacoes?: { id: string; nome: string }[]
} = {}) {
  return renderToStaticMarkup(
    createElement(FaixaTopo, {
      embarcacao: BARCO,
      embarcacoes,
      equipamentos,
      itens,
      hoje: HOJE,
      avisos,
      email,
    }),
  )
}

describe("FaixaTopo", () => {
  it("nome da embarcação (link /barco), sino (/notificacoes) e avatar (/menu/ajustes) sempre presentes", () => {
    const saida = html()
    expect(saida).toContain("Andorinha do Mar")
    expect(saida).toContain('href="/barco"')
    expect(saida).toContain('href="/notificacoes"')
    expect(saida).toContain('href="/menu/ajustes"')
  })

  it("com um barco só, o nome é link estático — sem seletor", () => {
    // O seletor é um botão com `aria-expanded`; o link não tem. É a marca
    // que separa as duas formas sem depender de classe de estilo.
    const saida = html()
    expect(saida).toContain('href="/barco"')
    expect(saida).not.toContain("aria-expanded")
  })

  it("com mais de um barco, o nome vira o SeletorEmbarcacao (spec §3.3) — trocar de barco existe no desktop", () => {
    const saida = html({ embarcacoes: [BARCO, { id: "e2", nome: "Vento Sul" }] })
    expect(saida).toContain("aria-expanded")
    expect(saida).toContain("Andorinha do Mar")
    // O link estático pra ficha sai de cena junto com o nome — a ficha
    // continua alcançável pelo trilho; a faixa não mostra o nome duas vezes.
    expect(saida).not.toContain('href="/barco"')
    // Fechado, o menu não vaza as opções pro HTML.
    expect(saida).not.toContain("Vento Sul")
  })

  it("o contador do sino aparece com avisos e SOME em zero", () => {
    expect(html({ avisos: 3 })).toContain("3 avisos que pedem atenção")
    expect(html({ avisos: 0 })).not.toContain("avisos que pedem atenção")
  })

  it("sem motores, nenhuma pílula de motor — e nenhum '—' decorativo", () => {
    const saida = html({ equipamentos: [{ id: "b1", tipo: "bateria", posicao: null, horas_atuais: null }] })
    expect(saida).not.toContain("Motor")
    expect(saida).not.toContain("—")
  })

  it("motor SEM leitura não vira pílula (KPI ausente, não traço)", () => {
    const saida = html({ equipamentos: [motor({ horas_atuais: null })] })
    expect(saida).not.toContain("Motor BB")
    expect(saida).not.toContain("—")
  })

  it("motor com leitura vira pílula: rótulo + horas em fonte de instrumento", () => {
    const saida = html({ equipamentos: [motor()] })
    expect(saida).toContain("Motor BB")
    // O número em mono E tabular — as duas classes, como em toda faixa de
    // KPI do app (perder só `tabular-nums` passaria despercebido no olho).
    const valor = saida.match(/<span class="([^"]*)">612,0 h<\/span>/)?.[1] ?? ""
    expect(valor).toContain("font-mono-instr")
    expect(valor).toContain("tabular-nums")
  })

  it("a revisão mais apertada entre os motores vira a pílula 'Revisão em …'", () => {
    const saida = html({
      equipamentos: [motor(), motor({ id: "m2", posicao: "BE", horas_atuais: 600 })],
      itens: [
        // m2 vem PRIMEIRO no array de propósito: 500 + 200 - 600 = 100h
        // restantes (ok). Se a redução dependesse da ordem em vez do
        // desempate por folga, seria esta a pílula — o bug que o teste cobra.
        itemDeRevisao({ equipamento_id: "m2", intervalo_horas: 200, ultimo_ciclo_horas: 500 }),
        // m1: 550 + 100 - 612 = 38h restantes — o mais apertado, vence.
        itemDeRevisao(),
      ],
    })
    expect(saida).toContain("Revisão em 38h")
    expect(saida).not.toContain("Revisão em 100h")
  })

  it("sem item com informação de verdade, a pílula de revisão não existe", () => {
    const saida = html({
      equipamentos: [motor()],
      // Intervalo sem último ciclo = sem informação suficiente.
      itens: [itemDeRevisao({ ultimo_ciclo_horas: null })],
    })
    expect(saida).not.toContain("Revisão")
    expect(saida).not.toContain("Sem revisão programada")
  })

  it("item de equipamento que não é motor não entra na revisão da faixa", () => {
    const saida = html({
      equipamentos: [
        motor({ horas_atuais: null }),
        { id: "g1", tipo: "gerador", posicao: null, horas_atuais: 900 },
      ],
      itens: [itemDeRevisao({ equipamento_id: "g1", ultimo_ciclo_horas: 850 })],
    })
    expect(saida).not.toContain("Revisão")
  })

  it("as iniciais do avatar vêm do e-mail, em tom neutro (sem dourado)", () => {
    const saida = html({ email: "maria.souza@exemplo.com" })
    expect(saida).toContain("MS")
    expect(saida).not.toContain("text-accent")
    // Sem e-mail, o Avatar cai no "?" — nunca quebra a faixa.
    expect(html({ email: null })).toContain(">?<")
  })
})

describe("nomeDoEmail", () => {
  it("transforma a parte local do e-mail num nome separável por espaços", () => {
    expect(nomeDoEmail("joao.silva@x.com")).toBe("joao silva")
    expect(nomeDoEmail("ana-paula_reis@x.com")).toBe("ana paula reis")
    expect(nomeDoEmail("erick@x.com")).toBe("erick")
  })

  it("sem e-mail devolve vazio (o Avatar resolve com '?')", () => {
    expect(nomeDoEmail(null)).toBe("")
    expect(nomeDoEmail("")).toBe("")
  })
})
