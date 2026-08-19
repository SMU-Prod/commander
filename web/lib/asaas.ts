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

/** Upgrade (PRD §44) — troca valor/ciclo da assinatura JÁ existente no Asaas
 *  (PUT, não cria assinatura nova). Usada só pra mensal→anual (a única
 *  direção que `proximoUpgrade`, `lib/domain/planos.ts`, permite) — o Asaas
 *  aplica o novo ciclo a partir da próxima cobrança, sem cobrar diferença
 *  retroativa. */
export async function atualizarAssinaturaAsaas(
  subscriptionId: string, dados: { valorCentavos: number; ciclo: "MONTHLY" | "YEARLY" },
) {
  await asaas(`/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    method: "PUT",
    body: JSON.stringify({ value: dados.valorCentavos / 100, cycle: dados.ciclo }),
  })
}

/** `true` só quando ASAAS_API_KEY existe — mesma flag dormente que já
 *  protege a assinatura (`NEXT_PUBLIC_COBRANCA_ATIVA` decide se o gate
 *  REDIRECIONA pra /assinar; esta aqui decide se o BOTÃO de pagamento da
 *  avaliação Commander Gold existe de verdade ou honestamente avisa que a
 *  contratação abre em breve — ver `lib/acoes/gold.ts`). Sem chave, o app
 *  nunca finge que abriu cobrança. */
export function asaasConfigurado(): boolean {
  return Boolean(process.env.ASAAS_API_KEY)
}

/** Cobrança avulsa (não-assinatura) — usada pela avaliação presencial do
 *  Commander Gold, que é pagamento único, não recorrente. Mesmo padrão de
 *  `criarAssinaturaAsaas`: `billingType: "UNDEFINED"` deixa o pagador
 *  escolher entre os meios habilitados na conta. A página de fatura
 *  (`invoiceUrl`) já traz o QR Code do Pix quando habilitado — é o "link/QR
 *  Code" que a Correção 08 pede pro fluxo do INTERESSADO, sem precisar
 *  buscar a imagem do QR à parte. */
export async function criarCobrancaAvulsaAsaas(dados: {
  customerId: string
  valorCentavos: number
  descricao: string
  externalReference: string
  urlRetorno?: string
}): Promise<{ id: string; invoiceUrl: string | null }> {
  const vencimento = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const p = await asaas<{ id: string; invoiceUrl?: string }>("/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: dados.customerId,
      billingType: "UNDEFINED",
      value: dados.valorCentavos / 100,
      dueDate: vencimento,
      description: dados.descricao,
      externalReference: dados.externalReference,
    }),
  })
  if (dados.urlRetorno) {
    // best-effort, mesma regra de urlPrimeiraCobranca: sem callback o
    // pagador so fica preso na pagina do Asaas depois de pagar.
    await asaas(`/payments/${encodeURIComponent(p.id)}`, {
      method: "PUT",
      body: JSON.stringify({ callback: { successUrl: dados.urlRetorno, autoRedirect: true } }),
    }).catch(() => {})
  }
  return { id: p.id, invoiceUrl: p.invoiceUrl ?? null }
}

export async function cancelarCobrancaAvulsaAsaas(paymentId: string) {
  await asaas(`/payments/${encodeURIComponent(paymentId)}`, { method: "DELETE" })
}

/** Fuso da API do Asaas. O gateway é brasileiro e devolve data/hora em
 *  horário de Brasília SEM offset ("2026-08-19 15:23:45"). O Brasil não tem
 *  mais horário de verão desde 2019, então UTC-3 é constante o ano inteiro —
 *  não há ambiguidade a resolver. */
const FUSO_ASAAS = "-03:00"

/**
 * O carimbo de ORDEM de um evento do webhook (achado A-06).
 *
 * ---------------------------------------------------------------------------
 * QUAL CAMPO, E POR QUE NÃO O OUTRO
 * ---------------------------------------------------------------------------
 * O corpo do webhook do Asaas traz DOIS campos parecidos e só um serve:
 *
 *   · `dateCreated` na RAIZ — quando o EVENTO nasceu, com hora e segundo.
 *     É este. Duas entregas do mesmo evento trazem o mesmo valor; eventos
 *     diferentes trazem valores que crescem na ordem em que aconteceram.
 *   · `payment.dateCreated` — quando a COBRANÇA foi criada, só a data
 *     ("2026-08-19"). É o mesmo valor em TODOS os eventos daquela cobrança:
 *     um `PAYMENT_CONFIRMED` e um `PAYMENT_OVERDUE` da mesma fatura têm
 *     carimbo idêntico. Ordenar por ele não ordena nada.
 *
 * Por isso a leitura é da raiz, e `payment.dateCreated` NÃO entra como
 * segunda opção: um carimbo que não distingue os dois eventos é pior que
 * carimbo nenhum — ele daria a impressão de haver ordem onde não há.
 *
 * ---------------------------------------------------------------------------
 * `null` NÃO É ZERO, E NÃO É "MUITO ANTIGO"
 * ---------------------------------------------------------------------------
 * Entrega sem carimbo devolve `null`, e `null` significa "não sei quando" —
 * nunca uma data mínima. Quem chama trata isso deixando o evento PASSAR: na
 * dúvida, o erro é a favor de quem paga. Transformar ausência em "época zero"
 * descartaria a confirmação de pagamento de alguém em silêncio.
 */
export function carimboDoEvento(corpo: unknown): string | null {
  const bruto = (corpo as { dateCreated?: unknown } | null)?.dateCreated
  if (typeof bruto !== "string") return null
  const texto = bruto.trim()
  if (texto === "") return null

  // Já veio com fuso (ISO completo ou "Z")? Respeita o que o gateway disse.
  const temFuso = /(?:Z|[+-]\d{2}:?\d{2})$/.test(texto)
  // "2026-08-19 15:23:45" → "2026-08-19T15:23:45-03:00". A data pura
  // ("2026-08-19") também é aceita: vira meia-noite de Brasília.
  const normalizado = temFuso
    ? texto.replace(" ", "T")
    : `${texto.replace(" ", "T")}${texto.includes(":") ? "" : "T00:00:00"}${FUSO_ASAAS}`

  const data = new Date(normalizado)
  return Number.isNaN(data.getTime()) ? null : data.toISOString()
}

export interface CobrancaAsaas {
  id: string
  dataVencimento: string
  valorCentavos: number
  status: string
  invoiceUrl: string | null
  /** Meio de pagamento desta fatura específica ("CREDIT_CARD"/"PIX"/"BOLETO"/
   *  "UNDEFINED" quando ainda não escolhido) — cru do Asaas, quem exibe
   *  traduz (`ROTULO_FORMA_PAGAMENTO`, tela de assinatura). */
  billingType: string
}

/** Historico de faturas da assinatura, pra tela mostrar valor/data/status/comprovante.
 *  Chamada direto de um Server Component (nao de uma server action) — por isso captura tudo
 *  aqui dentro: sem chave configurada ou qualquer erro da API, devolve lista vazia e a tela
 *  segue funcionando (a secao de faturas so nao aparece). */
export async function listarCobrancas(subscriptionId: string): Promise<CobrancaAsaas[]> {
  try {
    const r = await asaas<{
      data: Array<{ id: string; dueDate: string; value: number; status: string; invoiceUrl?: string; billingType?: string }>
    }>(`/payments?subscription=${encodeURIComponent(subscriptionId)}&limit=20`)
    return r.data.map((p) => ({
      id: p.id,
      dataVencimento: p.dueDate,
      valorCentavos: Math.round(p.value * 100),
      status: p.status,
      invoiceUrl: p.invoiceUrl ?? null,
      billingType: p.billingType ?? "UNDEFINED",
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

/** Valor e ciclo AO VIVO da assinatura no Asaas — pra tela de assinatura
 *  nunca mostrar um valor/ciclo desatualizado depois de um `trocarPlano`
 *  (que só atualiza o Asaas, nunca a coluna local — ver comentário em
 *  `lib/acoes/assinatura.ts`). Mesma regra defensiva das outras leituras:
 *  `null` sem chave, com erro, ou campo ausente — quem chama cai pro dado
 *  local nesse caso. */
export async function detalhesAssinaturaAsaas(
  subscriptionId: string,
): Promise<{ valorCentavos: number; ciclo: "MONTHLY" | "YEARLY" } | null> {
  try {
    const a = await asaas<{ value?: number; cycle?: string }>(`/subscriptions/${encodeURIComponent(subscriptionId)}`)
    if (a.value == null || (a.cycle !== "MONTHLY" && a.cycle !== "YEARLY")) return null
    return { valorCentavos: Math.round(a.value * 100), ciclo: a.cycle }
  } catch {
    return null
  }
}
