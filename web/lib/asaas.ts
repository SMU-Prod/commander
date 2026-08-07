/** Cliente minimo da API Asaas v3. Sandbox por padrao; producao so com ASAAS_AMBIENTE=producao.
 *  O app nunca ve cartao: o checkout e sempre a invoiceUrl hospedada do Asaas. */

const BASE = process.env.ASAAS_AMBIENTE === "producao"
  ? "https://api.asaas.com/v3"
  : "https://api-sandbox.asaas.com/v3"

class AsaasError extends Error {}

/** Recusa de validacao (4xx com descricao legivel) — da pra mostrar ao usuario,
 *  ex.: "O CPF informado é inválido". Diferente de indisponibilidade. */
export class AsaasRecusa extends Error {}

async function asaas<T>(caminho: string, init?: RequestInit): Promise<T> {
  const chave = process.env.ASAAS_API_KEY
  if (!chave) throw new AsaasError("ASAAS_API_KEY não configurada")
  const r = await fetch(`${BASE}${caminho}`, {
    ...init,
    headers: { "Content-Type": "application/json", access_token: chave, ...init?.headers },
  })
  if (!r.ok) {
    const corpo = await r.text().catch(() => "")
    if (r.status >= 400 && r.status < 500) {
      try {
        const j = JSON.parse(corpo) as { errors?: Array<{ description?: string }> }
        const descricao = (j.errors ?? []).map((e) => e.description).filter(Boolean).join(" · ")
        if (descricao) throw new AsaasRecusa(descricao.slice(0, 200))
      } catch (e) {
        if (e instanceof AsaasRecusa) throw e
        // corpo nao era JSON — cai no erro generico abaixo
      }
    }
    throw new AsaasError(`Asaas ${r.status} em ${caminho}: ${corpo.slice(0, 300)}`)
  }
  return r.json() as Promise<T>
}

export async function criarClienteAsaas(dados: { nome: string; email: string; cpfCnpj: string }) {
  const c = await asaas<{ id: string }>("/customers", {
    method: "POST",
    body: JSON.stringify({ name: dados.nome, email: dados.email, cpfCnpj: dados.cpfCnpj }),
  })
  return c.id
}

export async function criarAssinaturaAsaas(dados: {
  customerId: string
  valorCentavos: number
  ciclo: "MONTHLY" | "YEARLY"
  descricao: string
  referenciaExterna: string
}) {
  // billingType UNDEFINED: o assinante escolhe cartao ou Pix na pagina do Asaas
  const vencimento = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const a = await asaas<{ id: string }>("/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      customer: dados.customerId,
      billingType: "UNDEFINED",
      value: dados.valorCentavos / 100,
      nextDueDate: vencimento,
      cycle: dados.ciclo,
      description: dados.descricao,
      externalReference: dados.referenciaExterna,
    }),
  })
  return a.id
}

export async function urlPrimeiraCobranca(subscriptionId: string, urlRetorno?: string): Promise<string | null> {
  const r = await asaas<{ data: Array<{ id: string; invoiceUrl?: string; status: string }> }>(
    `/payments?subscription=${encodeURIComponent(subscriptionId)}&limit=1`,
  )
  const cobranca = r.data[0]
  if (!cobranca) return null
  if (urlRetorno && cobranca.id) {
    // sem callback o assinante paga e fica preso na pagina do Asaas, sem caminho
    // de volta. Best-effort: se o PUT falhar, o fluxo segue — o webhook ativa igual.
    await asaas(`/payments/${encodeURIComponent(cobranca.id)}`, {
      method: "PUT",
      body: JSON.stringify({ callback: { successUrl: urlRetorno, autoRedirect: true } }),
    }).catch(() => {})
  }
  return cobranca.invoiceUrl ?? null
}

export async function cancelarAssinaturaAsaas(subscriptionId: string) {
  await asaas(`/subscriptions/${encodeURIComponent(subscriptionId)}`, { method: "DELETE" })
}
