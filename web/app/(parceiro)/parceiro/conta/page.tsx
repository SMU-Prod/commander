import Link from "next/link"
import { redirect } from "next/navigation"
import { Icone } from "@/components/icone"
import { BotaoEnviar } from "@/components/ui/botao-enviar"
import { LinhaLista } from "@/components/ui/linha-lista"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { PILULA_ACAO_PRINCIPAL } from "@/lib/ui/acoes"
import { sair } from "@/lib/acoes/auth"
import { carregarAssinatura } from "@/lib/consultas"
import { carregarMeuPartner } from "@/lib/consultas-partner"
import { ROTULO_SITUACAO } from "@/lib/domain/assinatura-ciclo"
import { PLANOS, precoEmTexto } from "@/lib/domain/planos"
import { PLANO_DO_TIPO_PARTNER, partnerPago, ROTULO_TIPO_PARTNER } from "@/lib/domain/partner"

/**
 * MINHA CONTA do Partner (PRD §13.1/§13.2, último item do menu; §2 pros
 * preços e §23 pro ciclo de cobrança).
 *
 * Mostra o plano do TIPO do parceiro — não uma lista dos sete planos do §2.
 * Uma Marina não precisa ver o preço do Commander Pro; ela precisa saber que
 * o plano dela é grátis e o que isso inclui.
 */
export default async function ParceiroContaPage() {
  const meu = await carregarMeuPartner()
  if (!meu) redirect("/parceiro/perfil")

  const tipo = meu.parceiro.categoria
  const planoId = PLANO_DO_TIPO_PARTNER[tipo]
  const plano = planoId ? PLANOS[planoId] : null
  const pago = partnerPago(tipo)
  const { assinatura, ciclo } = await carregarAssinatura()

  return (
    <main>
      <h1 className="titulo-pagina">Minha Conta</h1>
      <p className="apoio mt-1 text-dim">{ROTULO_TIPO_PARTNER[tipo]} · {meu.parceiro.nome}</p>

      <SecaoPagina icone="carteira">Seu plano</SecaoPagina>
      <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="titulo-card">{plano ? plano.rotulo : "Parceiro"}</p>
          {/* O preço é a coluna de dinheiro deste cartão, e `.valor` (14px) é
              o degrau exato disso — o `corpo` que estava aqui dá os mesmos
              14px e nada mais: nem tabular, nem a cor de dado que separa o
              valor do rótulo ao lado.
              SEM `tabular-nums`, e é decisão e não esquecimento:
              `precoEmTexto` devolve tanto "R$ 24,90/mês" quanto "Grátis",
              "Grátis inicialmente" e "A definir". A fonte de instrumento
              serve pra dígito em coluna; aplicada a palavra corrida ela vira
              soletração — o mesmo argumento que `components/ui/chip.tsx`
              registra pra não usá-la em rótulo. */}
          {planoId && <p className="valor font-semibold">{precoEmTexto(planoId)}</p>}
        </div>
        {plano && <p className="apoio mt-1 text-dim">{plano.regra}</p>}

        {/* §2 distingue "Grátis" de "Grátis inicialmente" — e a diferença
            importa pra quem está do outro lado: uma é regra do plano, a outra
            é gratuidade de lançamento. Dizer isso agora evita a surpresa. */}
        {plano?.gratuitoInicialmente && (
          <p className="apoio mt-2 rounded-[var(--raio-controle)] border border-line bg-panel2 px-3 py-2 text-dim">
            Este tipo de perfil é gratuito no lançamento. Se passar a ser cobrado, você é avisado antes — nada
            é bloqueado sem aviso.
          </p>
        )}

        {pago && (
          <div className="mt-3">
            {assinatura && ciclo ? (
              <p className="corpo">
                Assinatura: <span className="font-medium">{ROTULO_SITUACAO[ciclo.situacao]}</span>
              </p>
            ) : (
              <>
                <p className="apoio text-dim">
                  Seu perfil aparece no Explorar, mas as oportunidades do Marketplace são do plano pago.
                </p>
                {/* Era um bloco de 40px com raio de 12 — dois valores fora
                    das duas escalas. A anatomia do app para "pílula dentro de
                    um alvo de 44px" já está escrita em `lib/ui/acoes.ts` e é
                    a que `EstadoVazio` usa. */}
                <Link href="/assinar?perfil=partner" className="mt-2 inline-flex min-h-11 items-center">
                  <span className={PILULA_ACAO_PRINCIPAL}>Assinar {plano?.rotulo ?? "o plano"}</span>
                </Link>
              </>
            )}
          </div>
        )}
      </div>

      <SecaoPagina icone="mapa">Visibilidade</SecaoPagina>
      <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
        <p className="corpo inline-flex items-center gap-2">
          <Icone nome={meu.parceiro.visivel ? "selo" : "cadeado"} className="size-4 text-accent-forte" />
          {meu.parceiro.visivel ? "Seu perfil está visível no Explorar" : "Seu perfil está oculto"}
        </p>
        <p className="apoio mt-1 text-dim">
          {meu.parceiro.visualizacoes} {meu.parceiro.visualizacoes === 1 ? "visualização" : "visualizações"} até agora.
        </p>
      </div>

      <SecaoPagina icone="pessoas">Conta</SecaoPagina>
      <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
        {assinatura && <LinhaLista href="/menu/assinatura" titulo="Cobrança e faturas" />}
        <LinhaLista href="/parceiro/perfil" titulo="Editar meu perfil" />
      </div>

      <form action={sair} className="mt-6">
        <BotaoEnviar rotulo="Sair da conta" variante="contorno" larguraCheia />
      </form>
    </main>
  )
}
