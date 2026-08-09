import Link from "next/link"
import { redirect } from "next/navigation"
import { Confirmar } from "@/components/confirmar"
import { Icone } from "@/components/icone"
import { cancelarAssinatura } from "@/lib/acoes/assinatura"
import { listarCobrancas, proximaCobrancaAsaas, type CobrancaAsaas } from "@/lib/asaas"
import { formatarPreco, PLANOS } from "@/lib/domain/planos"
import { supabaseServer } from "@/lib/supabase/server"
import type { Assinatura } from "@/lib/db/types"

const ROTULO_STATUS: Record<Assinatura["status"], string> = {
  pendente: "Aguardando o primeiro pagamento",
  ativa: "Ativa",
  inadimplente: "Pagamento em atraso",
  cancelada: "Cancelada",
}

const ROTULO_COBRANCA: Record<string, string> = {
  PENDING: "Aguardando pagamento",
  RECEIVED: "Recebida",
  CONFIRMED: "Confirmada",
  OVERDUE: "Vencida",
  REFUNDED: "Estornada",
  RECEIVED_IN_CASH: "Recebida (em dinheiro)",
  // os status abaixo aparecem justamente na hora de maior ansiedade do
  // assinante (contestação, estorno, análise) — deixar vazar o código cru
  // em inglês seria o pior momento possível para o app falar difícil
  AWAITING_RISK_ANALYSIS: "Em análise",
  APPROVED_BY_RISK_ANALYSIS: "Aprovada na análise",
  REPROVED_BY_RISK_ANALYSIS: "Recusada na análise",
  REFUND_REQUESTED: "Estorno solicitado",
  REFUND_IN_PROGRESS: "Estorno em andamento",
  CHARGEBACK_REQUESTED: "Contestada pelo banco",
  CHARGEBACK_DISPUTE: "Contestação em disputa",
  AWAITING_CHARGEBACK_REVERSAL: "Aguardando reversão da contestação",
  DUNNING_REQUESTED: "Cobrança em recuperação",
  DUNNING_RECEIVED: "Recuperada",
  PAYMENT_DELETED: "Removida",
  RECEIVED_IN_CASH_UNDONE: "Recebimento desfeito",
}

/** "2026-08-17" -> "17/08/2026" — data pura do Asaas (sem hora), sem risco de fuso. */
function dataBr(iso: string): string {
  const [ano, mes, dia] = iso.split("-")
  return `${dia}/${mes}/${ano}`
}

export default async function AssinaturaPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data } = await supabase
    .from("assinaturas").select("*")
    .eq("usuario_id", user.id)
    .order("criado_em", { ascending: false })
    .limit(1).maybeSingle()
  const assinatura = data as Assinatura | null

  let proximaCobranca: string | null = null
  let cobrancas: CobrancaAsaas[] = []
  if (assinatura && assinatura.status !== "cancelada") {
    ;[proximaCobranca, cobrancas] = await Promise.all([
      proximaCobrancaAsaas(assinatura.asaas_subscription_id),
      listarCobrancas(assinatura.asaas_subscription_id),
    ])
  }

  return (
    <main>
      <Link href="/menu" className="inline-flex items-center gap-1 rotulo text-accent-forte">
        <Icone nome="voltar" className="size-4" /> Menu
      </Link>
      <h1 className="titulo-pagina mt-3">Assinatura</h1>
      {erro && <p className="corpo mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      {!assinatura || assinatura.status === "cancelada" ? (
        <div className="sombra-1 mt-5 rounded-[14px] border border-line bg-panel p-4">
          <p className="titulo-card">Você ainda não é assinante</p>
          <p className="apoio mt-1 text-dim">A promo de fundador trava o preço enquanto a assinatura durar.</p>
          <Link href="/assinar" className="mt-3 block w-full rounded-xl bg-accent py-3.5 text-center font-semibold text-acao-texto">
            Ver planos
          </Link>
        </div>
      ) : (
        <div className="sombra-1 mt-5 rounded-[14px] border border-line bg-panel p-4">
          <div className="flex items-baseline justify-between">
            <p className="titulo-card">{PLANOS[assinatura.plano].rotulo}</p>
            <p className="apoio text-dim">{ROTULO_STATUS[assinatura.status]}</p>
          </div>
          <p className="corpo mt-1">
            <span className="font-semibold">{formatarPreco(assinatura.valor_centavos)}</span>
            <span className="text-dim">{assinatura.plano === "fundador_anual" ? " /ano" : " /mês"}</span>
          </p>
          {proximaCobranca && (
            <p className="apoio mt-1 text-dim">Próxima cobrança em {dataBr(proximaCobranca)}</p>
          )}
          {assinatura.fundador_numero !== null && (
            <p className="apoio mt-2 inline-flex items-center gap-1.5 rounded-full border border-line bg-panel2 px-3 py-1.5 text-dim-chip">
              <Icone nome="estrela" className="size-3.5" /> Fundador #{assinatura.fundador_numero}
            </p>
          )}
          {assinatura.status === "pendente" && (
            <p className="apoio mt-3 text-dim">
              O link de pagamento foi aberto na hora da assinatura e também chega por e-mail. Pagou agora? O status atualiza sozinho em instantes.
            </p>
          )}
          <form action={cancelarAssinatura} className="mt-4">
            <Confirmar
              rotulo="Cancelar assinatura"
              mensagem="Cancelar a assinatura? O dossiê do barco fica congelado."
              className="text-sm text-crit"
            />
          </form>
        </div>
      )}

      {cobrancas.length > 0 && (
        <div className="sombra-1 mt-4 rounded-[14px] border border-line bg-panel px-4">
          <p className="rotulo pt-4 text-dim">Faturas</p>
          {cobrancas.map((c) => (
            <div key={c.id} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
              <div className="min-w-0 flex-1">
                <p className="titulo-card">{formatarPreco(c.valorCentavos)}</p>
                <p className="apoio mt-0.5 text-dim">
                  {/* fallback: status desconhecido nunca aparece cru — a pessoa
                      é mandada pra quem sabe responder */}
                  {dataBr(c.dataVencimento)} · {ROTULO_COBRANCA[c.status] ?? "Fale com a equipe sobre esta fatura"}
                </p>
              </div>
              {c.invoiceUrl && (
                <a href={c.invoiceUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-accent-forte">
                  <Icone nome="documento" className="size-4" /> Ver
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
