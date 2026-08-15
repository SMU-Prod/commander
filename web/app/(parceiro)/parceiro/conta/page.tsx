import Link from "next/link"
import { redirect } from "next/navigation"
import { Icone } from "@/components/icone"
import { LinhaLista } from "@/components/ui/linha-lista"
import { SecaoPagina } from "@/components/ui/secao-pagina"
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
      <div className="sombra-1 rounded-[14px] border border-line bg-panel p-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="titulo-card">{plano ? plano.rotulo : "Parceiro"}</p>
          {planoId && <p className="corpo font-semibold">{precoEmTexto(planoId)}</p>}
        </div>
        {plano && <p className="apoio mt-1 text-dim">{plano.regra}</p>}

        {/* §2 distingue "Grátis" de "Grátis inicialmente" — e a diferença
            importa pra quem está do outro lado: uma é regra do plano, a outra
            é gratuidade de lançamento. Dizer isso agora evita a surpresa. */}
        {plano?.gratuitoInicialmente && (
          <p className="apoio mt-2 rounded-lg border border-line bg-panel2 px-3 py-2 text-dim">
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
                <Link
                  href="/assinar?perfil=partner"
                  className="mt-2.5 inline-block rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-acao-texto"
                >
                  Assinar {plano?.rotulo ?? "o plano"}
                </Link>
              </>
            )}
          </div>
        )}
      </div>

      <SecaoPagina icone="mapa">Visibilidade</SecaoPagina>
      <div className="sombra-1 rounded-[14px] border border-line bg-panel p-4">
        <p className="corpo inline-flex items-center gap-2">
          <Icone nome={meu.parceiro.visivel ? "selo" : "cadeado"} className="size-4 text-accent-forte" />
          {meu.parceiro.visivel ? "Seu perfil está visível no Explorar" : "Seu perfil está oculto"}
        </p>
        <p className="apoio mt-1 text-dim">
          {meu.parceiro.visualizacoes} {meu.parceiro.visualizacoes === 1 ? "visualização" : "visualizações"} até agora.
        </p>
      </div>

      <SecaoPagina icone="pessoas">Conta</SecaoPagina>
      <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
        {assinatura && <LinhaLista href="/menu/assinatura" titulo="Cobrança e faturas" />}
        <LinhaLista href="/parceiro/perfil" titulo="Editar meu perfil" />
      </div>

      <form action={sair} className="mt-6">
        <button className="corpo h-12 w-full rounded-xl border border-line text-dim">Sair da conta</button>
      </form>
    </main>
  )
}
