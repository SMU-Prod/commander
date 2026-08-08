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
  // billingType UNDEFINED: o assinante escolhe entre os meios habilitados NA CONTA Asaas.
  // A API nao aceita uma lista (ex.: so cartao+Pix) — e um unico billingType ou UNDEFINED
  // (todos os habilitados). Excluir Boleto sem perder Pix so da pra fazer desabilitando
  // Boleto na conta (Minha conta > Configuracoes > Configuracoes do sistema) — pendencia
  // do dono, documentada em docs/OPERACAO.md > "Desabilitar Boleto na conta Asaas".
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

export interface CobrancaAsaas {
  id: string
  dataVencimento: string
  valorCentavos: number
  status: string
  invoiceUrl: string | null
}

/** Historico de faturas da assinatura, pra tela mostrar valor/data/status/comprovante.
 *  Chamada direto de um Server Component (nao de uma server action) — por isso captura tudo
 *  aqui dentro: sem chave configurada ou qualquer erro da API, devolve lista vazia e a tela
 *  segue funcionando (a secao de faturas so nao aparece). */
export async function listarCobrancas(subscriptionId: string): Promise<CobrancaAsaas[]> {
  try {
    const r = await asaas<{
      data: Array<{ id: string; dueDate: string; value: number; status: string; invoiceUrl?: string }>
    }>(`/payments?subscription=${encodeURIComponent(subscriptionId)}&limit=20`)
    return r.data.map((p) => ({
      id: p.id,
      dataVencimento: p.dueDate,
      valorCentavos: Math.round(p.value * 100),
      status: p.status,
      invoiceUrl: p.invoiceUrl ?? null,
    }))
  } catch {
    return []
  }
}

/** Data da proxima cobranca — vem direto do `nextDueDate` da assinatura no Asaas (quem manda
 *  no calendario e o proprio Asaas, nao recalculamos aqui). null sem chave, com erro, ou se o
 *  campo nao vier — mesma regra defensiva de `listarCobrancas`. */
export async function proximaCobrancaAsaas(subscriptionId: string): Promise<string | null> {
  try {
    const a = await asaas<{ nextDueDate?: string }>(`/subscriptions/${encodeURIComponent(subscriptionId)}`)
    return a.nextDueDate ?? null
  } catch {
    return null
  }
}
