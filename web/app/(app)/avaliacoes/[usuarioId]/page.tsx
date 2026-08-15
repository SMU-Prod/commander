import Link from "next/link"
import { redirect } from "next/navigation"
import { CartaoAvaliacao } from "@/components/avaliacoes/cartao-avaliacao"
import { ResumoReputacao } from "@/components/avaliacoes/reputacao"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { carregarAvaliacoesDe, nomePublicoDoUsuario } from "@/lib/consultas-avaliacoes"
import { calcularReputacao } from "@/lib/domain/avaliacoes"
import { supabaseServer } from "@/lib/supabase/server"

/**
 * O "perfil" do §14: média, quantidade e a indicação "Negócio confirmado pelo
 * Commander", com as avaliações abaixo.
 *
 * A lista vem da RLS, não de um filtro daqui: quem visita vê só as públicas;
 * o próprio avaliado vê também as que foram ocultadas por violação (marcadas
 * como tal), porque esconder dele o que o Commander ocultou seria julgá-lo
 * sem que ele soubesse do quê.
 *
 * Por isso a média é calculada de novo por `calcularReputacao` sobre a lista
 * recebida — é a função pura que sabe que avaliação oculta não entra na
 * conta, e o número exibido é sempre explicável pelo que está na tela.
 */
export default async function PerfilAvaliacoesPage({
  params,
}: {
  params: Promise<{ usuarioId: string }>
}) {
  const { usuarioId } = await params
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const itens = await carregarAvaliacoesDe(usuarioId)
  const reputacao = calcularReputacao(itens.map((i) => i.avaliacao))
  const nome = itens[0]?.avaliacao.avaliado_nome || (await nomePublicoDoUsuario(usuarioId))
  const souEu = user.id === usuarioId

  return (
    <main>
      <CabecalhoDetalhe voltarHref="/prestadores" voltarRotulo="Rede" titulo={nome} />

      <div className="mt-4">
        <ResumoReputacao reputacao={reputacao} />
      </div>

      {souEu && reputacao.ocultadas > 0 && (
        <p className="apoio mt-2 rounded-lg border border-line bg-panel px-3 py-2 text-dim">
          As avaliações ocultadas por violação aparecem abaixo só para você — quem visita este perfil não as
          vê, e elas não entram na média.
        </p>
      )}

      <SecaoPagina icone="chat">
        {reputacao.quantidade === 1 ? "1 avaliação" : `${reputacao.quantidade} avaliações`}
      </SecaoPagina>

      {itens.length === 0 ? (
        <EstadoVazio
          icone="estrela"
          titulo="Nenhuma avaliação ainda"
          descricao="No Commander, só avalia quem fechou negócio e confirmou o fechamento — por isso a primeira demora."
          acao={{ href: "/marketplace", rotulo: "Ver o Marketplace" }}
        />
      ) : (
        <div className="space-y-3">
          {itens.map((item) => (
            <CartaoAvaliacao key={item.avaliacao.id} item={item} />
          ))}
        </div>
      )}

      {souEu && (
        <p className="apoio mt-6">
          <Link href="/avaliacoes" className="text-accent-forte">
            Responder, contestar ou marcar como solucionado
          </Link>
        </p>
      )}
    </main>
  )
}
