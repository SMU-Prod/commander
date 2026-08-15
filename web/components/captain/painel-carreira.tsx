import Link from "next/link"
import { Icone } from "@/components/icone"
import { SeloReputacao } from "@/components/avaliacoes/reputacao"
import { carregarAvaliacoesDe } from "@/lib/consultas-avaliacoes"
import { carregarDisponibilidadesDe, carregarTrabalhosConfirmados } from "@/lib/consultas-captain"
import { carregarMapaTaxonomia, tituloDeDisponibilidade } from "@/lib/consultas-marketplace"
import { calcularReputacao } from "@/lib/domain/avaliacoes"
import {
  motivoForaDaVitrine, O_QUE_O_CAPTAIN_PRO_LIBERA, perfilNaVitrine, PLANO_QUE_ATIVA_PERFIL,
  type TipoPerfilProfissional,
} from "@/lib/domain/captain"
import { formatarPreco, PLANOS } from "@/lib/domain/planos"
import type { PlanoId } from "@/lib/domain/planos"

/**
 * A CARREIRA, NA TELA DO PRÓPRIO PROFISSIONAL (onda 50, PRD §12).
 *
 * O §12 termina listando o que o perfil profissional mostra: "foto, função,
 * região, experiência, certificações, embarcações/portes, disponibilidade,
 * AVALIAÇÕES e TRABALHOS CONFIRMADOS". As três últimas não são campos que a
 * pessoa digita — são consequências do que ela fez no app. Este painel é onde
 * elas aparecem para ela, acima do formulário: primeiro o que já foi
 * conquistado, depois o que dá pra editar.
 *
 * Nenhum número aqui é guardado em coluna: reputação sai de `avaliacoes`
 * (§14), trabalhos saem de `negocios` com confirmação bilateral (§11.6) e a
 * disponibilidade sai de `disponibilidades` (§11.3). Contador paralelo
 * divergiria do histórico na primeira correção.
 */
export async function PainelCarreira({
  usuarioId,
  tipo,
  visivel,
  plano,
}: {
  usuarioId: string
  tipo: TipoPerfilProfissional
  /** `visivel` do perfil salvo. `false` quando a pessoa ainda nem criou. */
  visivel: boolean
  plano: PlanoId
}) {
  const [avaliacoes, trabalhos, disponibilidades, mapa] = await Promise.all([
    carregarAvaliacoesDe(usuarioId),
    carregarTrabalhosConfirmados(usuarioId),
    carregarDisponibilidadesDe(usuarioId),
    carregarMapaTaxonomia(),
  ])
  const reputacao = calcularReputacao(avaliacoes.map((a) => a.avaliacao))
  const noAr = perfilNaVitrine({ tipo, visivel, plano })
  const motivo = motivoForaDaVitrine({ tipo, visivel, plano })
  const planoExigido = PLANOS[PLANO_QUE_ATIVA_PERFIL[tipo]]

  return (
    <div className="mt-4 space-y-3">
      {/* 1. O perfil está no ar? É a primeira pergunta de quem abre esta tela. */}
      <div
        className={`sombra-1 rounded-[14px] border p-4 ${
          noAr ? "border-ok/40 bg-panel" : "border-accent/30 bg-panel"
        }`}
      >
        <p className="corpo inline-flex items-center gap-2 font-medium">
          <Icone nome={noAr ? "selo" : "cadeado"} className={`size-4 ${noAr ? "text-ok" : "text-accent-forte"}`} />
          {noAr ? "Seu perfil está na vitrine" : motivo?.titulo}
        </p>
        <p className="apoio mt-1 text-dim">
          {noAr
            ? "Proprietários que procuram profissional na sua região encontram você."
            : motivo?.descricao}
        </p>
        {/* Botão só quando o que falta é ASSINATURA. Se o que falta é o
            marcador "aparecer na lista", o conserto é o próprio formulário
            logo abaixo — mandar a pessoa pagar por algo que um checkbox
            resolve seria desonesto. */}
        {!noAr && visivel && (
          <Link
            href="/assinar?perfil=captain"
            className="mt-3 inline-block rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-acao-texto"
          >
            Assinar o {planoExigido.rotulo} — {formatarPreco(planoExigido.valorCentavos ?? 0)}/mês
          </Link>
        )}
      </div>

      {/* 2. Avaliações e trabalhos confirmados — o currículo que o app
             consegue provar. Só aparecem com número real; um "0 de 0" em
             cima do formulário só desanimaria quem está começando. */}
      {(reputacao.quantidade > 0 || trabalhos > 0) && (
        <div className="sombra-1 rounded-[14px] border border-line bg-panel p-4">
          <p className="rotulo text-dim">Seu histórico no Commander</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {trabalhos > 0 && (
              <span className="apoio inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-dim">
                <Icone nome="guardado" className="size-3.5 text-ok" />
                {trabalhos === 1 ? "1 trabalho confirmado" : `${trabalhos} trabalhos confirmados`}
              </span>
            )}
            <SeloReputacao reputacao={reputacao} href={`/avaliacoes/${usuarioId}`} />
          </div>
          <p className="apoio mt-2 text-dim">
            Conta só o que fechou aqui dentro e os dois lados confirmaram. Por isso demora — e por isso vale.
          </p>
        </div>
      )}

      {/* 3. Disponibilidade publicada (§11.3) — o perfil mostra, mas o dado
             mora no Marketplace; daqui só se navega até lá. */}
      <div className="sombra-1 rounded-[14px] border border-line bg-panel p-4">
        <p className="rotulo text-dim">Sua disponibilidade publicada</p>
        {disponibilidades.length === 0 ? (
          <p className="apoio mt-1 text-dim">
            Nada no ar agora. Publicar função, região e período faz você aparecer para quem está procurando
            tripulação nesses dias.
          </p>
        ) : (
          <ul className="mt-2 space-y-1">
            {disponibilidades.map((d) => (
              <li key={d.id} className="apoio">
                {tituloDeDisponibilidade(mapa, d)}
              </li>
            ))}
          </ul>
        )}
        <Link href="/marketplace/disponibilidades" className="apoio mt-2 inline-block font-semibold text-accent-forte">
          {disponibilidades.length === 0 ? "Publicar disponibilidade" : "Gerenciar no Marketplace"}
        </Link>
      </div>

      {/* 4. O que a assinatura entrega — só para quem ainda não tem. Repetir a
             lista para quem já paga seria vender o que a pessoa já comprou. */}
      {!noAr && (
        <div className="sombra-1 rounded-[14px] border border-line bg-panel p-4">
          <p className="rotulo text-dim">O que o {planoExigido.rotulo} libera</p>
          {/* A lista detalhada é a do §12 (Captain). O Partner Prestador tem
              a régua própria do §13.1, que ainda não foi implementada em
              onda nenhuma — então aqui ele mostra a regra do catálogo em vez
              de herdar promessas de Captain que não são dele. */}
          {tipo === "comandante" ? (
            <ul className="mt-2 space-y-1.5">
              {O_QUE_O_CAPTAIN_PRO_LIBERA.map((b) => (
                <li key={b} className="apoio flex items-start gap-2">
                  <Icone nome="selo" className="mt-0.5 size-3.5 shrink-0 text-accent-forte" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="apoio mt-2 text-dim">{planoExigido.regra}</p>
          )}
          <p className="apoio mt-3 rounded-lg border border-line bg-panel2 px-3 py-2 text-dim">
            O que ela <strong>não</strong> muda: o acesso às embarcações que você opera. Isso vem do convite do
            proprietário e das permissões que ele deu — nunca de assinatura.
          </p>
        </div>
      )}
    </div>
  )
}
