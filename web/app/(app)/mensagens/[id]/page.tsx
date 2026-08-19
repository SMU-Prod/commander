import Link from "next/link"
import { redirect } from "next/navigation"
import { AtualizacaoViva } from "@/components/mensagens/atualizacao-viva"
import { MarcarLida } from "@/components/mensagens/marcar-lida"
import { ThreadConversa } from "@/components/mensagens/thread-conversa"
import { GuardaFormulario } from "@/components/guarda-formulario"
import { BotaoEnviar } from "@/components/ui/botao-enviar"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { CampoTextarea } from "@/components/ui/campo"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { enviarMensagem } from "@/lib/acoes/mensagens"
import { carregarConversa } from "@/lib/consultas-mensagens"
import { LIMITE_CORPO_MENSAGEM, marcaDeLeitura, RELACAO_DO_OUTRO } from "@/lib/domain/mensagens"
import { ALVO_ACAO, PILULA_ACAO } from "@/lib/ui/acoes"
import { supabaseServer } from "@/lib/supabase/server"

/**
 * UMA CONVERSA — a thread entre as duas partes de uma proposta.
 *
 * O ACESSO NÃO É DECIDIDO AQUI. `carregarConversa` devolve `null` tanto para
 * id inexistente quanto para conversa de outra gente, porque a RLS (migration
 * 090) não entrega a linha — e os dois casos viram o MESMO redirect, de
 * propósito: dizer "essa conversa não é sua" já confirmaria que ela existe.
 * Mesma postura da ficha do Marketplace com pedido encerrado.
 *
 * A TELA SE MANTÉM ATUALIZADA POR RECARGA DECLARADA, não por tempo real — ver
 * `components/mensagens/atualizacao-viva.tsx`, que explica por que Realtime
 * ficou de fora desta versão. O resumo: um socket que cai sem avisar produz
 * uma conversa que PARECE em dia e está congelada, e é justamente a mentira
 * de tela que a casa proíbe.
 */
export default async function ConversaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ erro?: string; ok?: string }>
}) {
  const { id } = await params
  const { erro, ok } = await searchParams
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const aberta = await carregarConversa(id)
  if (!aberta) {
    redirect(`/mensagens?erro=${encodeURIComponent("Essa conversa não existe ou não é sua.")}`)
  }

  const { conversa, papel, nomeDoOutro, mensagens, lidoAte } = aberta
  // O que ESTA renderização mostrou — é isto que a marca de leitura avança, e
  // não o relógio: com `now()`, a mensagem que chegasse no mesmo segundo em
  // que a tela abriu sumiria do contador sem nunca ter aparecido.
  const ate = marcaDeLeitura(mensagens)

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref="/mensagens"
        voltarRotulo="Mensagens"
        titulo={nomeDoOutro}
        descricao={RELACAO_DO_OUTRO[papel]}
      />

      {/* O PEDIDO QUE ORIGINOU A CONVERSA, e o caminho de volta pra ele.
          A conversa é ancorada num pedido concreto — sem essa linha, quem abre
          a thread duas semanas depois lê preços sem saber de quê. O assunto é
          a cópia que a conversa carrega (migration 090): quando o anúncio
          vence, quem RESPONDEU perde o acesso à demanda pela RLS, e sem a
          cópia este cabeçalho ficaria vazio justo depois de o negócio
          acontecer.
          O link para `/marketplace/{id}` pode dar em "esse pedido não existe
          mais" pra quem respondeu, e está certo assim: o pedido encerrou
          mesmo. A conversa é que não encerra junto. */}
      <div className="sombra-1 mt-3 rounded-[var(--raio-cartao)] border border-line bg-panel p-3">
        <p className="rotulo text-dim">Sobre o pedido</p>
        <p className="corpo mt-0.5">{conversa.assunto}</p>
        <Link href={`/marketplace/${conversa.demanda_id}`} className={`${ALVO_ACAO} mt-1`}>
          <span className={PILULA_ACAO}>Ver o pedido e as propostas</span>
        </Link>
      </div>

      {erro && <p className="corpo mt-3 rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}
      {ok && <p className="corpo mt-3 rounded-[var(--raio-controle)] border border-ok/40 bg-ok/10 px-3 py-2">{ok}</p>}

      <AtualizacaoViva />

      {mensagens.length === 0 ? (
        <EstadoVazio
          className="mt-4"
          icone="chat"
          titulo="Comece a conversa"
          descricao={`${nomeDoOutro} vê a mensagem ao abrir o app. Combine prazo, valor e detalhes por aqui — tudo o que for dito fica registrado no pedido.`}
        />
      ) : (
        <ThreadConversa
          conversaId={conversa.id}
          mensagens={mensagens}
          usuarioId={user.id}
          nomeDoOutro={nomeDoOutro}
          lidoAte={lidoAte}
        />
      )}

      {/* O carimbo de leitura entra DEPOIS da thread e só existe quando há o
          que marcar. É um efeito de cliente: marcar durante a renderização
          seria escrever no banco a cada recarga da `AtualizacaoViva`. */}
      {ate && <MarcarLida conversaId={conversa.id} ate={ate} />}

      <form action={enviarMensagem} className="mt-4 space-y-3">
        {/* O campo mais fácil de perder do app: a pessoa escreve o combinado
            inteiro, a rede falha, a action redireciona com `?erro=` e o
            formulário volta em branco. `GuardaFormulario` é a peça da casa
            pra isso (PRD §24). A chave é por conversa — duas threads abertas
            em abas diferentes não podem sobrescrever o rascunho uma da
            outra. */}
        <GuardaFormulario chave={`mensagens:${conversa.id}`} />
        <input type="hidden" name="conversa_id" value={conversa.id} />
        <CampoTextarea
          label="Sua mensagem"
          id="corpo"
          name="corpo"
          rows={3}
          maxLength={LIMITE_CORPO_MENSAGEM}
          placeholder="Prazo, valor, o que precisa levar…"
          // A dica é a régua da casa escrita na tela: não há edição depois, e
          // apagar deixa marca. Dizer isso ANTES é o que faz a pessoa escrever
          // com o cuidado que um registro pede — e evita a surpresa de
          // descobrir a regra só ao tentar corrigir uma vírgula.
          dica="Não dá pra editar depois de enviar. Você pode apagar a sua mensagem, e fica registrado que ela existiu."
        />
        <BotaoEnviar rotulo="Enviar" larguraCheia />
      </form>
    </main>
  )
}
