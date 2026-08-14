import { describe, expect, it } from "vitest"
import type { ErrorEvent } from "@sentry/nextjs"
import { higienizarEvento } from "./sentry-scrub"

function eventoBase(sobrepor: Partial<ErrorEvent> = {}): ErrorEvent {
  return { type: undefined, ...sobrepor } as ErrorEvent
}

describe("higienizarEvento", () => {
  it("remove corpo, cookies e headers do request", () => {
    const evento = eventoBase({
      request: { url: "https://commander.soumardivers.com/hoje", data: { senha: "123" }, cookies: { sb: "x" }, headers: { authorization: "Bearer x" } },
    })
    const limpo = higienizarEvento(evento)
    expect(limpo.request?.data).toBeUndefined()
    expect(limpo.request?.cookies).toBeUndefined()
    expect(limpo.request?.headers).toBeUndefined()
  })

  it("remove o usuário do evento", () => {
    const evento = eventoBase({ user: { id: "u1", email: "dono@example.com" } })
    expect(higienizarEvento(evento).user).toBeUndefined()
  })

  it("redige coordenada de GPS na query string da URL principal", () => {
    const evento = eventoBase({
      request: { url: "https://commander.soumardivers.com/navegar?destino_la=-23.5&destino_lo=-45.1&destino_nome=Marina" },
    })
    const limpo = higienizarEvento(evento)
    expect(limpo.request?.url).not.toContain("-23.5")
    expect(limpo.request?.url).not.toContain("-45.1")
    expect(limpo.request?.url).toContain("destino_la=%5Bremovido%5D")
  })

  it("mantém a URL intacta quando não há parâmetro sensível", () => {
    const evento = eventoBase({ request: { url: "https://commander.soumardivers.com/hoje?tab=alertas" } })
    expect(higienizarEvento(evento).request?.url).toBe("https://commander.soumardivers.com/hoje?tab=alertas")
  })

  it("redige coordenada em breadcrumb de fetch/xhr sem mexer em outros tipos", () => {
    const evento = eventoBase({
      breadcrumbs: [
        { category: "fetch", data: { url: "https://x.test/api/corredores?lat=-23.5&lon=-45.1" } },
        { category: "ui.click", data: { url: "https://x.test/?lat=-23.5" } },
      ],
    })
    const limpo = higienizarEvento(evento)
    expect(limpo.breadcrumbs?.[0].data?.url).not.toContain("-23.5")
    // breadcrumb que não é fetch/xhr não é tocado
    expect(limpo.breadcrumbs?.[1].data?.url).toContain("-23.5")
  })

  it("não quebra com evento vazio (sem request/user/breadcrumbs)", () => {
    expect(() => higienizarEvento(eventoBase())).not.toThrow()
  })

  it("devolve a url original quando ela não é uma URL absoluta válida", () => {
    const evento = eventoBase({ request: { url: "não é uma url" } })
    expect(higienizarEvento(evento).request?.url).toBe("não é uma url")
  })
})
