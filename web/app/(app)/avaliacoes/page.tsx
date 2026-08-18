import Link from "next/link"
import { redirect } from "next/navigation"
import { CartaoAvaliacao } from "@/components/avaliacoes/cartao-avaliacao"
import { SeletorNota } from "@/components/avaliacoes/estrelas"
import { ResumoReputacao } from "@/components/avaliacoes/reputacao"
import { Icone } from "@/components/icone"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { Campo, CampoSelect, CampoTextarea } from "@/components/ui/campo"
import { Chip, ChipLinha } from "@/components/ui/chip"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import {
  contestarAvaliacao, editarAvaliacao, marcarProblemaSolucionado,
  responderAvaliacao, responderProblemaSolucionado,
} from "@/lib/acoes/avaliacoes"
import {
  carregarAvaliacoesFeitas, carregarAvaliacoesRecebidas, carregarNegociosParaAvaliar,
  type AvaliacaoCompleta,
} from "@/lib/consultas-avaliacoes"
import {
  calcularReputacao, diasRestantesParaEditar, MOTIVOS_CONTESTACAO, podeContestar,
  podeEditarAvaliacao, respostasParaNota,
} from "@/lib/domain/avaliacoes"
import { supabaseServer } from "@/lib/supabase/server"

const VOLTA = "/avaliacoes"

/**
 * Avaliações (onda 49, PRD §14) — as três coisas que uma pessoa faz aqui:
 *  · avaliar quem atendeu (só depois do negócio confirmado pelos dois lados);
 *  · responder / contestar / marcar como solucionado o que disseram dela;
 *  · corrigir a própria avaliação enquanto o prazo de 30 dias vale.
 *
 * O formulário de CRIAR não mora aqui de propósito: ele nasce na ficha do
 * pedido (/marketplace/[id]), junto do negócio que o liberou — é lá que a
 * pessoa está quando termina de confirmar. Esta tela só aponta o caminho.
 */
export default async function AvaliacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string; ver?: string }>
}) {
  const { ok, erro, ver } = await searchParams
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [recebidas, feitas, pendentes] = await Promise.all([
    carregarAvaliacoesRecebidas(),
    carregarAvaliacoesFeitas(),
    carregarNegociosParaAvaliar(),
  ])
  const reputacao = calcularReputacao(recebidas.map((r) => r.avaliacao))
  // Canvas tela-4c: "Recebidas | Enviadas" como pílulas de filtro — a mesma
  // moeda de interface de toda lista do app (Chip), no lugar de duas seções
  // empilhadas. Recebidas é o padrão: é a pergunta que traz a pessoa aqui.
  const aba = ver === "enviadas" ? "enviadas" : "recebidas"

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref="/menu"
        voltarRotulo="Menu"
        titulo="Avaliações"
        descricao="Avaliação só existe depois que os dois lados confirmam o negócio no Commander. É o que faz a nota valer alguma coisa."
      />

      {ok && <p className="corpo mt-3 rounded-lg border border-ok/40 bg-ok/10 px-3 py-2">{ok}</p>}
      {erro && <p className="corpo mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      <div className="mt-4">
        <ResumoReputacao reputacao={reputacao} />
        {reputacao.quantidade > 0 && (
          <Link href={`/avaliacoes/${user.id}`} className="apoio mt-2 inline-block text-accent-forte">
            Ver como aparece no seu perfil
          </Link>
        )}
      </div>

      {pendentes.length > 0 && (
        <>
          <SecaoPagina icone="estrela">Prontos para avaliar</SecaoPagina>
          <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
            {pendentes.map((p) => (
              <Link
                key={p.negocioId}
                href={`/marketplace/${p.demandaId}`}
                className="flex items-center gap-3 border-b border-line py-3.5 last:border-0"
              >
                <Icone nome="estrela" className="size-4 shrink-0 text-accent-forte" />
                <span className="min-w-0 flex-1">
                  <span className="corpo block font-medium">{p.fornecedorNome}</span>
                  <span className="apoio block text-dim">Negócio confirmado — conte como foi</span>
                </span>
                <Icone nome="chevron" className="size-4 shrink-0 text-dim" />
              </Link>
            ))}
          </div>
        </>
      )}

      <ChipLinha className="mt-5">
        <Chip href="/avaliacoes" ativo={aba === "recebidas"}>Recebidas</Chip>
        <Chip href="/avaliacoes?ver=enviadas" ativo={aba === "enviadas"}>Enviadas</Chip>
      </ChipLinha>

      {aba === "recebidas" ? (
        <>
          {reputacao.ocultadas > 0 && (
            <p className="apoio mt-3 text-dim">
              {reputacao.ocultadas === 1
                ? "1 avaliação foi ocultada por violação e não entra na média."
                : `${reputacao.ocultadas} avaliações foram ocultadas por violação e não entram na média.`}{" "}
              Você continua vendo cada uma abaixo.
            </p>
          )}
          {recebidas.length === 0 ? (
            <EstadoVazio
              className="mt-3"
              icone="estrela"
              titulo="Ninguém avaliou você ainda"
              descricao="Assim que um negócio fechado pelo Commander for confirmado pelos dois lados, o cliente pode avaliar."
            />
          ) : (
            <div className="mt-3 space-y-2">
              {recebidas.map((item) => (
                <CartaoAvaliacao key={item.avaliacao.id} item={item}>
                  <AcoesDoAvaliado item={item} />
                </CartaoAvaliacao>
              ))}
            </div>
          )}
        </>
      ) : feitas.length === 0 ? (
        <EstadoVazio
          className="mt-3"
          icone="marketplace"
          titulo="Você ainda não avaliou ninguém"
          descricao="Depois de fechar e confirmar um negócio no Marketplace, a avaliação abre na ficha do pedido."
          acao={{ href: "/marketplace", rotulo: "Ir para o Marketplace" }}
        />
      ) : (
        <div className="mt-3 space-y-2">
          {feitas.map((item) => (
            <CartaoAvaliacao key={item.avaliacao.id} item={item} cabecalho={item.avaliacao.avaliado_nome}>
              <AcoesDoCliente item={item} />
            </CartaoAvaliacao>
          ))}
        </div>
      )}
    </main>
  )
}

/** O que o AVALIADO pode fazer: responder (uma vez, texto padronizado),
 *  contestar (só 1 ou 2 estrelas) e marcar o problema como solucionado. */
function AcoesDoAvaliado({ item }: { item: AvaliacaoCompleta }) {
  const { avaliacao, resposta, contestacao, solucao } = item
  const respostas = respostasParaNota(avaliacao.nota)

  return (
    <div className="mt-3 space-y-3 border-t border-line pt-3">
      {!resposta && (
        <form action={responderAvaliacao} className="space-y-2">
          <input type="hidden" name="avaliacao_id" value={avaliacao.id} />
          <input type="hidden" name="volta" value={VOLTA} />
          <CampoSelect
            label="Responder" id={`resposta-${avaliacao.id}`} name="resposta_codigo" required defaultValue=""
            dica="Uma resposta por avaliação, escolhida da lista — o Commander padroniza para a conversa não virar briga pública."
          >
            <option value="" disabled>Escolha a resposta</option>
            {respostas.map((r) => <option key={r.codigo} value={r.codigo}>{r.texto}</option>)}
          </CampoSelect>
          <button className="h-11 w-full rounded-lg border border-line text-sm font-medium">
            Publicar resposta
          </button>
        </form>
      )}

      {!solucao && (
        <details className="rounded-lg border border-line px-3 py-2">
          <summary className="apoio cursor-pointer text-dim">Marcar como “problema solucionado”</summary>
          <form action={marcarProblemaSolucionado} className="mt-2 space-y-2">
            <input type="hidden" name="avaliacao_id" value={avaliacao.id} />
            <input type="hidden" name="volta" value={VOLTA} />
            <Campo
              label="O que foi feito (opcional)" id={`solucao-${avaliacao.id}`} name="descricao"
              maxLength={300} placeholder="Refizemos o serviço sem custo em 12/08."
              dica="O cliente confirma ou nega. A nota não muda por causa disso — se ele quiser mudá-la, edita a própria avaliação."
            />
            <button className="h-11 w-full rounded-lg border border-line text-sm font-medium">
              Registrar solução
            </button>
          </form>
        </details>
      )}

      {podeContestar(avaliacao.nota) && !contestacao && (
        <details className="rounded-lg border border-crit/40 px-3 py-2">
          <summary className="apoio cursor-pointer text-crit">Contestar avaliação</summary>
          <form action={contestarAvaliacao} className="mt-2 space-y-2">
            <input type="hidden" name="avaliacao_id" value={avaliacao.id} />
            <input type="hidden" name="volta" value={VOLTA} />
            <p className="apoio text-dim">
              Contestar não tira a avaliação do ar. A equipe Commander analisa e decide manter ou ocultar por
              violação — e nunca altera a nota que o cliente deu.
            </p>
            <CampoSelect
              label="Motivo" id={`motivo-${avaliacao.id}`} name="motivo_codigo" required defaultValue=""
            >
              <option value="" disabled>Escolha o motivo</option>
              {MOTIVOS_CONTESTACAO.map((m) => <option key={m.codigo} value={m.codigo}>{m.texto}</option>)}
            </CampoSelect>
            <CampoTextarea
              label="Detalhe (obrigatório em “Outro motivo”)" id={`detalhe-${avaliacao.id}`} name="detalhe"
              rows={3} maxLength={600}
            />
            <button className="h-11 w-full rounded-lg border border-crit/40 text-sm font-medium text-crit">
              Enviar contestação
            </button>
          </form>
        </details>
      )}
    </div>
  )
}

/** O que o CLIENTE pode fazer na avaliação que escreveu: editar por 30 dias
 *  (§14) e responder ao "problema solucionado" do outro lado. */
function AcoesDoCliente({ item }: { item: AvaliacaoCompleta }) {
  const { avaliacao, solucao } = item
  const podeEditar = podeEditarAvaliacao(avaliacao.criado_em)
  const dias = diasRestantesParaEditar(avaliacao.criado_em)

  return (
    <div className="mt-3 space-y-3 border-t border-line pt-3">
      {solucao && solucao.resposta == null && (
        <div>
          <p className="apoio text-dim">
            {avaliacao.avaliado_nome} informou que o problema foi solucionado. Foi mesmo?
          </p>
          <div className="mt-2 flex gap-2">
            <form action={responderProblemaSolucionado} className="flex-1">
              <input type="hidden" name="avaliacao_id" value={avaliacao.id} />
              <input type="hidden" name="volta" value={VOLTA} />
              <input type="hidden" name="resposta" value="confirmado" />
              <button className="h-11 w-full rounded-lg border border-ok/40 text-sm font-medium text-ok">
                Sim, foi resolvido
              </button>
            </form>
            <form action={responderProblemaSolucionado} className="flex-1">
              <input type="hidden" name="avaliacao_id" value={avaliacao.id} />
              <input type="hidden" name="volta" value={VOLTA} />
              <input type="hidden" name="resposta" value="negado" />
              <button className="h-11 w-full rounded-lg border border-line text-sm font-medium text-dim">
                Não foi
              </button>
            </form>
          </div>
        </div>
      )}

      {podeEditar ? (
        <details className="rounded-lg border border-line px-3 py-2">
          <summary className="apoio cursor-pointer text-dim">
            Editar minha avaliação · {dias === 0 ? "último dia" : `${dias} dias restantes`}
          </summary>
          <form action={editarAvaliacao} className="mt-2 space-y-3">
            <input type="hidden" name="avaliacao_id" value={avaliacao.id} />
            <input type="hidden" name="volta" value={VOLTA} />
            <SeletorNota defaultValue={avaliacao.nota} />
            <CampoTextarea
              label="Comentário (opcional)" id={`comentario-${avaliacao.id}`} name="comentario"
              rows={3} maxLength={800} defaultValue={avaliacao.comentario ?? ""}
            />
            <button className="h-11 w-full rounded-lg bg-accent text-sm font-semibold text-acao-texto">
              Salvar alteração
            </button>
          </form>
        </details>
      ) : (
        <p className="apoio text-dim">
          O prazo de 30 dias para editar esta avaliação já passou — ela agora é histórico.
        </p>
      )}
    </div>
  )
}
