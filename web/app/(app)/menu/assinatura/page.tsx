import Link from "next/link"
import { redirect } from "next/navigation"
import { Confirmar } from "@/components/confirmar"
import { Icone } from "@/components/icone"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { LinhaLista } from "@/components/ui/linha-lista"
import { cancelarAssinatura, trocarPlano } from "@/lib/acoes/assinatura"
import {
  asaasConfigurado, listarCobrancas, proximaCobrancaAsaas, type CobrancaAsaas,
} from "@/lib/asaas"
import { carregarAcessoEmbarcacoes, carregarAssinatura, carregarNivelPlano, carregarPainel } from "@/lib/consultas"
import { carregarTrilha } from "@/lib/consultas-captain"
import { O_QUE_O_CAPTAIN_FREE_FAZ, O_QUE_O_CAPTAIN_PRO_LIBERA } from "@/lib/domain/captain"
import { mensagemDowngrade, ROTULO_SITUACAO } from "@/lib/domain/assinatura-ciclo"
import { formatarPreco, PLANOS, planosDoPerfil, proximoUpgrade } from "@/lib/domain/planos"
import { BENEFICIOS_PAGOS, O_QUE_O_FREE_FAZ, ehPago } from "@/lib/domain/plano-acesso"
import { supabaseServer } from "@/lib/supabase/server"

/**
 * MINHA CONTA › ASSINATURA (onda 47 — PRD FINAL §2, §23).
 *
 * Mostra, nesta ordem: o plano vigente e o que ele libera, a situação da
 * cobrança (com o aviso de tolerância do §23 em destaque quando existe), o
 * caminho de upgrade/downgrade, e o HISTÓRICO DE FATURAS — que o §23 pede
 * nominalmente ("Histórico de faturas/cobranças disponível em Minha Conta").
 *
 * A situação vem de `avaliarCiclo` (regra pura), não do Asaas: o gateway diz
 * se a cobrança entrou; o que isso significa pro cliente é decisão do
 * Commander (§23, "estados modelados independentemente do fornecedor").
 */

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
 *  emitidas, a primeira (mais recente) que não é mais "a definir". */
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

  // Tripulação/CMDT não tem assinatura DA EMBARCAÇÃO — a cobrança do barco é
  // do proprietário, e `assinaturas`/`premium_concessoes` só deixam CADA DONO
  // ler a própria linha (RLS, migrations 017/033). Mesma filosofia de
  // "CMDT/tripulação nunca vê paywall" (`app/(app)/layout.tsx`): aqui o
  // caminho é avisar, não bloquear.
  //
  // ONDA 50 (§12) — ANTES, ESTA TELA ERA UM BECO SEM SAÍDA. Ela devolvia só
  // o aviso acima e parava, o que fechava a porta pro comandante contratado
  // assinar o Captain Pro: o plano existia no catálogo desde a onda 47, tinha
  // preço congelado no §2 e nenhum caminho de compra. O §12 separa as duas
  // assinaturas justamente por isso — a do barco é do dono, a da CARREIRA é
  // da pessoa. Agora a tela mostra as duas coisas: o aviso sobre o barco e o
  // degrau de carreira em que ela está.
  if (painel && painel.papel !== "PROP") {
    const { trilha, planoCarreira } = await carregarTrilha()
    const { assinatura: minha, ciclo: meuCiclo } = await carregarAssinatura()
    const temPro = planoCarreira === "captain_pro"
    const vivaPropria = minha != null && minha.status !== "cancelada"

    return (
      <main>
        <CabecalhoDetalhe voltarHref="/menu" voltarRotulo="Menu" titulo="Assinatura" />

        <div className="sombra-1 mt-5 rounded-[14px] border border-line bg-panel p-4">
          <p className="titulo-card">A assinatura da embarcação é do proprietário</p>
          <p className="apoio mt-1 text-dim">
            Cobrança e plano do barco ficam vinculados a quem é PROP nesta embarcação — fale com o
            proprietário para ver ou alterar. O seu acesso a bordo vem do convite dele, não de assinatura.
          </p>
        </div>

        {trilha === "captain" && (
          <div className="sombra-1 mt-4 rounded-[14px] border border-line bg-panel p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="titulo-card">{PLANOS[planoCarreira].rotulo}</p>
              <span
                className={`rotulo rounded-full px-2.5 py-1 ${
                  temPro ? "bg-accent/15 text-accent-forte" : "bg-panel2 text-dim"
                }`}
              >
                {temPro ? "Ativo" : "Gratuito"}
              </span>
            </div>
            <p className="apoio mt-1 text-dim">{PLANOS[planoCarreira].regra}</p>

            <ul className="mt-3 space-y-1.5">
              {(temPro ? O_QUE_O_CAPTAIN_PRO_LIBERA : O_QUE_O_CAPTAIN_FREE_FAZ).map((b) => (
                <li key={b} className="apoio flex items-start gap-2">
                  <Icone
                    nome={temPro ? "selo" : "documento"}
                    className={`mt-0.5 size-3.5 shrink-0 ${temPro ? "text-accent-forte" : "text-dim"}`}
                  />
                  <span>{b}</span>
                </li>
              ))}
            </ul>

            {vivaPropria ? (
              <div className="mt-4 rounded-lg border border-line bg-panel2 p-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="corpo font-medium">{formatarPreco(minha.valor_centavos)} /mês</p>
                  <p className="apoio text-dim">{meuCiclo ? ROTULO_SITUACAO[meuCiclo.situacao] : ""}</p>
                </div>
                <form action={cancelarAssinatura} className="mt-3">
                  <Confirmar
                    rotulo="Cancelar assinatura"
                    mensagem="Cancelar? Seu perfil sai da vitrine, mas nada do que você registrou é apagado."
                  />
                </form>
              </div>
            ) : (
              <Link
                href="/assinar?perfil=captain"
                className="mt-4 block w-full rounded-xl bg-accent py-3.5 text-center font-semibold text-acao-texto"
              >
                Assinar o {PLANOS.captain_pro.rotulo} — {formatarPreco(PLANOS.captain_pro.valorCentavos!)}/mês
              </Link>
            )}
          </div>
        )}
      </main>
    )
  }

  const { assinatura, plano, ciclo, promocao } = await carregarAssinatura()
  const nivel = await carregarNivelPlano()
  const acesso = await carregarAcessoEmbarcacoes()
  const chaveAsaas = asaasConfigurado()
  const temAssinaturaViva = assinatura != null && assinatura.status !== "cancelada"

  let proximaCobranca: string | null = null
  let cobrancas: CobrancaAsaas[] = []
  if (temAssinaturaViva) {
    ;[proximaCobranca, cobrancas] = await Promise.all([
      proximaCobrancaAsaas(assinatura.asaas_subscription_id),
      listarCobrancas(assinatura.asaas_subscription_id),
    ])
  }

  const formaPagamento = formaPagamentoAtual(cobrancas)
  const upgrade = proximoUpgrade(plano)
  const downgrade = plano === "commander_pro" ? "commander" : null
  const avisoDowngrade = mensagemDowngrade(acesso.divisao, acesso.limite)

  return (
    <main>
      <CabecalhoDetalhe voltarHref="/menu" voltarRotulo="Menu" titulo="Assinatura" />
      {erro && <p className="corpo mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}
      {ok && <p className="corpo mt-3 rounded-lg border border-ok/40 bg-ok/10 px-3 py-2">{ok}</p>}

      {/* §23: "durante tolerância, avisar claramente ANTES de bloquear". O
          aviso vem primeiro na tela justamente por isso — antes do plano,
          antes das faturas. */}
      {ciclo?.aviso && ciclo.situacao !== "ativa" && (
        <p
          className={`corpo mt-3 rounded-lg border px-3 py-2 ${
            ciclo.acessoPago ? "border-aten/40 bg-aten/10" : "border-crit/40 bg-crit/10"
          }`}
        >
          {ciclo.aviso}
        </p>
      )}

      {/* Plano vigente — sempre visível primeiro, com o que ele libera. */}
      <div className="sombra-1 mt-5 rounded-[14px] border border-line bg-panel p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="titulo-card">{PLANOS[plano].rotulo}</p>
          <span
            className={`rotulo rounded-full px-2.5 py-1 ${
              ehPago(nivel) ? "bg-accent/15 text-accent-forte" : "bg-panel2 text-dim"
            }`}
          >
            {ehPago(nivel) ? "Ativo" : "Gratuito"}
          </span>
        </div>
        <p className="apoio mt-1 text-dim">{PLANOS[plano].regra}</p>

        <ul className="mt-3 space-y-1.5">
          {(ehPago(nivel) ? BENEFICIOS_PAGOS : O_QUE_O_FREE_FAZ).map((b) => (
            <li key={b} className="apoio flex items-start gap-2">
              <Icone
                nome={ehPago(nivel) ? "selo" : "documento"}
                className={`mt-0.5 size-3.5 shrink-0 ${ehPago(nivel) ? "text-accent-forte" : "text-dim"}`}
              />
              <span>{b}</span>
            </li>
          ))}
        </ul>

        {promocao && (
          <p className="apoio mt-3 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2">
            Você está com uma condição promocional até {dataBr(promocao.validoAte)}
            {promocao.valorCentavos > 0 ? ` — ${formatarPreco(promocao.valorCentavos)}/mês` : " — sem cobrança"}.
            Depois desse período, a cobrança volta ao valor normal do plano.
            {promocao.descontoGoldPercentual > 0 &&
              ` No mesmo período, a avaliação Commander Gold tem ${promocao.descontoGoldPercentual}% de desconto.`}
          </p>
        )}
      </div>

      {/* §23, downgrade Pro → Commander: barco excedente fica pausado, nunca apagado. */}
      {avisoDowngrade && (
        <div className="sombra-1 mt-4 rounded-[14px] border border-aten/40 bg-panel p-4">
          <p className="titulo-card">Embarcações acima do plano</p>
          <p className="apoio mt-1 text-dim">{avisoDowngrade}</p>
          {acesso.divisao.precisaEscolher && (
            <Link href="/menu" className="apoio mt-3 inline-block font-semibold text-accent-forte">
              Escolher a embarcação ativa
            </Link>
          )}
        </div>
      )}

      {!temAssinaturaViva ? (
        <div className="sombra-1 mt-4 rounded-[14px] border border-line bg-panel p-4">
          <p className="titulo-card">
            {assinatura?.status === "cancelada" ? "Sua assinatura está cancelada" : "Você ainda não é assinante"}
          </p>
          <p className="apoio mt-1 text-dim">
            O Commander custa {formatarPreco(PLANOS.commander.valorCentavos!)}/mês e o Commander Pro{" "}
            {formatarPreco(PLANOS.commander_pro.valorCentavos!)}/mês. Nada do que você já registrou é apagado em
            nenhum dos casos.
          </p>
          <Link href="/assinar" className="mt-3 block w-full rounded-xl bg-accent py-3.5 text-center font-semibold text-acao-texto">
            Ver planos
          </Link>
        </div>
      ) : (
        <div className="sombra-1 mt-4 rounded-[14px] border border-line bg-panel p-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="titulo-card">Cobrança</p>
            <p className="apoio text-dim">{ciclo ? ROTULO_SITUACAO[ciclo.situacao] : ""}</p>
          </div>
          <p className="corpo mt-1">
            <span className="font-semibold">{formatarPreco(assinatura.valor_centavos)}</span>
            <span className="text-dim">{PLANOS[assinatura.plano].ciclo === "YEARLY" ? " /ano" : " /mês"}</span>
          </p>
          {proximaCobranca && (
            <p className="apoio mt-1 text-dim">Próxima cobrança em {dataBr(proximaCobranca)}</p>
          )}
          {formaPagamento && (
            <p className="apoio mt-1 text-dim">Forma de pagamento: {ROTULO_FORMA_PAGAMENTO[formaPagamento] ?? formaPagamento}</p>
          )}
          {!chaveAsaas && (
            <p className="apoio mt-3 rounded-lg border border-line bg-panel2 px-3 py-2 text-dim">
              O ambiente de pagamento não está configurado agora — próxima cobrança, forma de
              pagamento e faturas podem não aparecer mesmo com a assinatura ativa. Isso é uma
              limitação deste ambiente, não da sua assinatura.
            </p>
          )}

          {upgrade && assinatura.status !== "pendente" && (
            <form action={trocarPlano} className="mt-4 rounded-lg border border-accent/30 bg-accent/5 p-3">
              <input type="hidden" name="plano" value={upgrade} />
              <p className="corpo font-medium">Passe para o {PLANOS[upgrade].rotulo}</p>
              <p className="apoio mt-0.5 text-dim">
                {PLANOS[upgrade].regra} — {formatarPreco(PLANOS[upgrade].valorCentavos!)}/mês.
              </p>
              <button className="apoio mt-2 font-semibold text-accent-forte">Fazer upgrade</button>
            </form>
          )}

          {/* §23 — descer de plano é um caminho de primeira classe, não algo
              escondido: o cliente precisa saber que dá pra descer sem perder
              barco. */}
          {downgrade && assinatura.status !== "pendente" && (
            <form action={trocarPlano} className="mt-3">
              <input type="hidden" name="plano" value={downgrade} />
              <Confirmar
                rotulo={`Voltar para o ${PLANOS[downgrade].rotulo}`}
                mensagem={
                  `Voltar para o ${PLANOS[downgrade].rotulo}? As embarcações acima do limite não são apagadas — ` +
                  "a gestão delas fica pausada até você voltar para o Pro."
                }
                className="text-sm text-dim"
              />
            </form>
          )}

          <form action={cancelarAssinatura} className="mt-4">
            <Confirmar
              rotulo="Cancelar assinatura"
              mensagem="Cancelar a assinatura? Nada é apagado — o dossiê do barco continua guardado e volta inteiro se você reativar."
              className="text-sm text-crit"
            />
          </form>
        </div>
      )}

      {/* §23: "Histórico de faturas/cobranças disponível em Minha Conta." */}
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

      {/* §2 — Enterprise existe no catálogo só como reservado. */}
      {planosDoPerfil("proprietario")
        .filter((p) => p.disponibilidade === "em_breve")
        .map((p) => (
          <div key={p.id} className="mt-4 rounded-[14px] border border-line bg-panel2 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="titulo-card text-dim">{p.rotulo}</p>
              <span className="rotulo rounded-full bg-panel px-2.5 py-1 text-dim-chip">Em breve</span>
            </div>
            <p className="apoio mt-1 text-dim">
              Para frotas e operações maiores. Ainda estamos definindo o formato — se é o seu caso, fale com a
              equipe.
            </p>
          </div>
        ))}
    </main>
  )
}
