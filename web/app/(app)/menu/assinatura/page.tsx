import Link from "next/link"
import { redirect } from "next/navigation"
import { Confirmar } from "@/components/confirmar"
import { Icone } from "@/components/icone"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { LinhaLista } from "@/components/ui/linha-lista"
import { cancelarAssinatura, trocarPlano } from "@/lib/acoes/assinatura"
import {
  asaasConfigurado, detalhesAssinaturaAsaas, listarCobrancas, proximaCobrancaAsaas, type CobrancaAsaas,
} from "@/lib/asaas"
import { carregarNivelPlano, carregarPainel } from "@/lib/consultas"
import { formatarPreco, PLANOS, proximoUpgrade, type PlanoId } from "@/lib/domain/planos"
import { BENEFICIOS_PREMIUM, LIMITES_FREE } from "@/lib/domain/plano-acesso"
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

/** Vocabulário do meio de pagamento — cru do Asaas (`billingType`) nunca
 *  aparece em tela. "UNDEFINED" é o estado normal antes da primeira escolha
 *  (checkout ainda não fechado), não um erro. */
const ROTULO_FORMA_PAGAMENTO: Record<string, string> = {
  CREDIT_CARD: "Cartão de crédito",
  DEBIT_CARD: "Cartão de débito",
  PIX: "Pix",
  BOLETO: "Boleto",
  UNDEFINED: "A definir no pagamento",
}

/** "2026-08-17" -> "17/08/2026" — data pura do Asaas (sem hora), sem risco de fuso. */
function dataBr(iso: string): string {
  const [ano, mes, dia] = iso.split("-")
  return `${dia}/${mes}/${ano}`
}

/** Meio de pagamento mais recente com algo definido — entre as faturas já
 *  emitidas, a primeira (mais recente) que não é mais "a definir". Sem
 *  nenhuma, cai pro billingType da fatura mais nova mesmo (normalmente
 *  "UNDEFINED", e a tela mostra isso honestamente). */
function formaPagamentoAtual(cobrancas: CobrancaAsaas[]): string | null {
  if (cobrancas.length === 0) return null
  const definida = cobrancas.find((c) => c.billingType !== "UNDEFINED")
  return (definida ?? cobrancas[0]).billingType
}

export default async function AssinaturaPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; ok?: string }>
}) {
  const { erro, ok } = await searchParams
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const painel = await carregarPainel()

  // Tripulação/CMDT não tem assinatura própria — a cobrança é do
  // proprietário, e `assinaturas`/`premium_concessoes` só deixam CADA DONO
  // ler a própria linha (RLS, migrations 017/033). Em vez de uma tela de
  // cobrança vazia e confusa (ou fingir um Premium que não é "deles"), avisa
  // com honestidade — mesma filosofia de "CMDT/tripulação nunca vê paywall"
  // (`app/(app)/layout.tsx`), só que aqui o caminho é avisar, não bloquear.
  if (painel && painel.papel !== "PROP") {
    return (
      <main>
        <CabecalhoDetalhe voltarHref="/menu" voltarRotulo="Menu" titulo="Assinatura" />
        <div className="sombra-1 mt-5 rounded-[14px] border border-line bg-panel p-4">
          <p className="titulo-card">A assinatura é do proprietário</p>
          <p className="apoio mt-1 text-dim">
            Cobrança e plano ficam vinculados a quem é PROP nesta embarcação — fale com o
            proprietário para ver ou alterar a assinatura.
          </p>
        </div>
      </main>
    )
  }

  const { data } = await supabase
    .from("assinaturas").select("*")
    .eq("usuario_id", user.id)
    .order("criado_em", { ascending: false })
    .limit(1).maybeSingle()
  const assinatura = data as Assinatura | null
  const temAssinaturaViva = Boolean(assinatura) && assinatura!.status !== "cancelada"

  const nivel = await carregarNivelPlano()
  const chaveAsaas = asaasConfigurado()

  let proximaCobranca: string | null = null
  let cobrancas: CobrancaAsaas[] = []
  let valorVivo: { valorCentavos: number; ciclo: "MONTHLY" | "YEARLY" } | null = null
  if (temAssinaturaViva) {
    ;[proximaCobranca, cobrancas, valorVivo] = await Promise.all([
      proximaCobrancaAsaas(assinatura!.asaas_subscription_id),
      listarCobrancas(assinatura!.asaas_subscription_id),
      detalhesAssinaturaAsaas(assinatura!.asaas_subscription_id),
    ])
  }
  // O Asaas manda no ciclo/valor DE VERDADE (upgrade só escreve lá, nunca na
  // coluna local — ver `lib/acoes/assinatura.ts`). Sem resposta do Asaas
  // (sem chave, erro, ambiente sandbox fora do ar), cai pro que foi
  // gravado na assinatura — nunca uma tela em branco.
  const planoEfetivo: PlanoId | undefined = valorVivo
    ? (valorVivo.ciclo === "YEARLY" ? "fundador_anual" : "fundador_mensal")
    : assinatura?.plano
  const valorEfetivoCentavos = valorVivo?.valorCentavos ?? assinatura?.valor_centavos ?? 0
  const proximo = planoEfetivo ? proximoUpgrade(planoEfetivo) : null
  const formaPagamento = formaPagamentoAtual(cobrancas)

  return (
    <main>
      <CabecalhoDetalhe voltarHref="/menu" voltarRotulo="Menu" titulo="Assinatura" />
      {erro && <p className="corpo mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}
      {ok && <p className="corpo mt-3 rounded-lg border border-ok/40 bg-ok/10 px-3 py-2">{ok}</p>}

      {/* Plano da embarcação — Free ou Premium, sempre visível primeiro
          (PRD §43/§44): mostra o valor do Premium antes de qualquer detalhe
          de cobrança. */}
      <div className="sombra-1 mt-5 rounded-[14px] border border-line bg-panel p-4">
        <div className="flex items-center justify-between">
          <p className="titulo-card">Seu plano</p>
          <span
            className={`rotulo rounded-full px-2.5 py-1 ${
              nivel === "premium" ? "bg-accent/15 text-accent-forte" : "bg-panel2 text-dim"
            }`}
          >
            {nivel === "premium" ? "Premium" : "Free"}
          </span>
        </div>
        <ul className="mt-3 space-y-1.5">
          {BENEFICIOS_PREMIUM.map((b) => (
            <li key={b} className="apoio flex items-start gap-2">
              <Icone
                nome={nivel === "premium" ? "selo" : "cadeado"}
                className={`mt-0.5 size-3.5 shrink-0 ${nivel === "premium" ? "text-accent-forte" : "text-dim"}`}
              />
              <span className={nivel === "premium" ? "" : "text-dim"}>{b}</span>
            </li>
          ))}
        </ul>
        {nivel === "free" && (
          <p className="apoio mt-3 text-dim">
            No Free: até {LIMITES_FREE.diarioRegistros} registros no Diário e {LIMITES_FREE.fotos} fotos por
            embarcação — o resto do app funciona normalmente, sem limite.
          </p>
        )}
      </div>

      {!temAssinaturaViva ? (
        <div className="sombra-1 mt-4 rounded-[14px] border border-line bg-panel p-4">
          <p className="titulo-card">Você ainda não é assinante</p>
          <p className="apoio mt-1 text-dim">A promo de fundador trava o preço enquanto a assinatura durar.</p>
          <Link href="/assinar" className="mt-3 block w-full rounded-xl bg-accent py-3.5 text-center font-semibold text-acao-texto">
            Ver planos
          </Link>
        </div>
      ) : (
        <div className="sombra-1 mt-4 rounded-[14px] border border-line bg-panel p-4">
          <div className="flex items-baseline justify-between">
            <p className="titulo-card">{planoEfetivo ? PLANOS[planoEfetivo].rotulo : "Fundador"}</p>
            <p className="apoio text-dim">{ROTULO_STATUS[assinatura!.status]}</p>
          </div>
          <p className="corpo mt-1">
            <span className="font-semibold">{formatarPreco(valorEfetivoCentavos)}</span>
            <span className="text-dim">{planoEfetivo === "fundador_anual" ? " /ano" : " /mês"}</span>
          </p>
          {proximaCobranca && (
            <p className="apoio mt-1 text-dim">Próxima cobrança em {dataBr(proximaCobranca)}</p>
          )}
          {formaPagamento && (
            <p className="apoio mt-1 text-dim">Forma de pagamento: {ROTULO_FORMA_PAGAMENTO[formaPagamento] ?? formaPagamento}</p>
          )}
          {assinatura!.fundador_numero !== null && (
            <p className="apoio mt-2 inline-flex items-center gap-1.5 rounded-full border border-line bg-panel2 px-3 py-1.5 text-dim-chip">
              <Icone nome="estrela" className="size-3.5" /> Fundador #{assinatura!.fundador_numero}
            </p>
          )}
          {assinatura!.status === "pendente" && (
            <p className="apoio mt-3 text-dim">
              O link de pagamento foi aberto na hora da assinatura e também chega por e-mail. Pagou agora? O status atualiza sozinho em instantes.
            </p>
          )}
          {!chaveAsaas && (
            <p className="apoio mt-3 rounded-lg border border-line bg-panel2 px-3 py-2 text-dim">
              O ambiente de pagamento não está configurado agora — próxima cobrança, forma de
              pagamento e faturas podem não aparecer mesmo com a assinatura ativa. Isso é uma
              limitação deste ambiente, não da sua assinatura.
            </p>
          )}

          {/* Upgrade (PRD §44) — só existe UM upgrade real hoje: mensal→anual,
              mesmo preço/mês, 2 meses grátis. Nunca aparece pra quem já está
              no anual (proximoUpgrade devolve null). */}
          {proximo && assinatura!.status !== "pendente" && (
            <form action={trocarPlano} className="mt-4 rounded-lg border border-accent/30 bg-accent/5 p-3">
              <p className="corpo font-medium">Passe para o {PLANOS[proximo].rotulo}</p>
              <p className="apoio mt-0.5 text-dim">
                Mesmo preço por mês, 2 meses grátis por ano — {formatarPreco(PLANOS[proximo].valorCentavos)}/ano.
              </p>
              <button className="apoio mt-2 font-semibold text-accent-forte">Fazer upgrade</button>
            </form>
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
            <LinhaLista
              key={c.id}
              titulo={formatarPreco(c.valorCentavos)}
              // fallback: status desconhecido nunca aparece cru — a pessoa
              // é mandada pra quem sabe responder
              subtitulo={`${dataBr(c.dataVencimento)} · ${ROTULO_COBRANCA[c.status] ?? "Fale com a equipe sobre esta fatura"}`}
              trailing={
                c.invoiceUrl ? (
                  <a href={c.invoiceUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-accent-forte">
                    <Icone nome="documento" className="size-4" /> Ver
                  </a>
                ) : undefined
              }
            />
          ))}
        </div>
      )}
    </main>
  )
}
