import { describe, expect, it } from "vitest"
import {
  ehTelaDeFormulario,
  mostrarRegistroRapido,
  FOLGA_COM_FAB,
  FOLGA_SEM_FAB,
} from "./superficies"

describe("ehTelaDeFormulario", () => {
  it("reconhece as rotas de criação pelo sufixo do app", () => {
    for (const r of [
      "/barco/itens/novo",
      "/barco/equipamento/novo",
      "/barco/ocorrencias/nova",
      "/diario/novo",
      "/agenda/novo",
      "/carteira/nova",
      "/financeiro/novo",
      "/financeiro/recorrentes/nova",
      "/marketplace/nova",
      "/marketplace/disponibilidades/nova",
      "/navegar/viagem/nova",
      "/oportunidades/nova",
      "/barco/equipamento/abc-123/sistemas/novo",
    ]) {
      expect(ehTelaDeFormulario(r), r).toBe(true)
    }
  })

  it("reconhece as rotas de edição", () => {
    for (const r of [
      "/barco/editar",
      "/barco/itens/abc/editar",
      "/barco/equipamento/abc/editar",
      "/barco/equipamento/abc/sistemas/xyz/editar",
    ]) {
      expect(ehTelaDeFormulario(r), r).toBe(true)
    }
  })

  it("cobre os formulários que não têm verbo no nome", () => {
    for (const r of [
      "/barco/contatos",
      "/barco/local",
      "/barco/selos/gold",
      "/barco/transferir",
      "/diario/importar",
      "/diario/abc/horas",
      "/prestadores/perfil",
      "/comandantes/perfil",
      "/menu/perfil",
    ]) {
      expect(ehTelaDeFormulario(r), r).toBe(true)
    }
  })

  it("não confunde tela de lista/hub com formulário", () => {
    for (const r of [
      "/hoje",
      "/barco",
      "/barco/equipamentos",
      "/barco/documentos",
      "/barco/fotos",
      "/barco/historico",
      "/barco/ocorrencias",
      "/barco/selos",
      "/barco/resumos",
      "/diario",
      "/agenda",
      "/financeiro",
      "/financeiro/lancamentos",
      "/marketplace",
      "/comandantes",
      "/notificacoes",
      "/menu",
      "/menu/tripulacao",
    ]) {
      expect(ehTelaDeFormulario(r), r).toBe(false)
    }
  })

  it("ignora barra final, query e hash", () => {
    expect(ehTelaDeFormulario("/barco/itens/novo/")).toBe(true)
    expect(ehTelaDeFormulario("/financeiro/novo?tipo=despesa")).toBe(true)
    expect(ehTelaDeFormulario("/barco/editar#casco")).toBe(true)
  })
})

describe("mostrarRegistroRapido", () => {
  it("mostra o FAB nos hubs e listas, onde ele serve", () => {
    for (const r of ["/barco", "/diario", "/financeiro", "/comandantes", "/menu"]) {
      expect(mostrarRegistroRapido(r), r).toBe(true)
    }
  })

  it("cede o lugar para a ação principal que já está no conteúdo", () => {
    // Onda 57: a Início ganhou o cartão "Diário de Bordo" com o botão
    // "Registrar saída", que leva ao mesmo registro. Com os dois, a tela de
    // casa tinha duas ações principais douradas, uma delas flutuando por
    // cima do conteúdo.
    expect(mostrarRegistroRapido("/hoje")).toBe(false)
    // e continua sendo tela de leitura, não de formulário — o motivo é outro
    expect(ehTelaDeFormulario("/hoje")).toBe(false)
  })

  it("esconde o FAB em toda tela de formulário", () => {
    for (const r of ["/barco/itens/novo", "/barco/editar", "/menu/perfil", "/barco/local"]) {
      expect(mostrarRegistroRapido(r), r).toBe(false)
    }
  })

  it("cede o lugar para a ação flutuante da própria tela", () => {
    // /barco/resumos tem o "Exportar PDF" nas MESMAS coordenadas fixas; com
    // os dois, o de cima come o toque e a exportação vira inalcançável.
    expect(mostrarRegistroRapido("/barco/resumos")).toBe(false)
    // e continua sendo tela de leitura, não de formulário
    expect(ehTelaDeFormulario("/barco/resumos")).toBe(false)
  })

  it("mantém a exceção antiga do mapa", () => {
    expect(mostrarRegistroRapido("/navegar")).toBe(false)
    // a tela de viagem nova é formulário — some pelos dois motivos
    expect(mostrarRegistroRapido("/navegar/viagem/nova")).toBe(false)
  })
})

describe("folga inferior", () => {
  it("soma a safe-area em vez de assumir zero", () => {
    // é a regressão desta onda: `pb-36` fixo funcionava no navegador e
    // deixava o botão de salvar debaixo do FAB no iPhone.
    expect(FOLGA_COM_FAB).toContain("env(safe-area-inset-bottom)")
    expect(FOLGA_SEM_FAB).toContain("env(safe-area-inset-bottom)")
  })

  it("reserva menos espaço quando não há FAB", () => {
    expect(FOLGA_COM_FAB).toContain("9rem")
    expect(FOLGA_SEM_FAB).toContain("4.75rem")
  })
})
