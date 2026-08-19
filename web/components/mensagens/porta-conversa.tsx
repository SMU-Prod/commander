import Link from "next/link"
import { Icone } from "@/components/icone"
import { BotaoEnviar } from "@/components/ui/botao-enviar"
import { SeloNaoLidas } from "@/components/mensagens/selo-nao-lidas"
import { abrirConversa } from "@/lib/acoes/mensagens"
import { carregarCaixaDeEntrada, carregarConversaDaProposta } from "@/lib/consultas-mensagens"
import { podeConversar } from "@/lib/domain/mensagens"
import { ALVO_ACAO, PILULA_ACAO } from "@/lib/ui/acoes"

/**
 * A PORTA: onde a conversa nasce, na ficha do pedido do Marketplace.
 *
 * Um componente e não um trecho solto de JSX porque a decisão inteira ("quem
 * vê", "já existe?", "quantas não lidas") depende de dado que só o servidor
 * tem — e deixar isso na página obrigaria a tela do Marketplace a carregar
 * conversa, contar não lidas e conhecer a regra de quem pode falar com quem.
 * Assim ela só posiciona: uma linha por proposta.
 *
 * QUEM VÊ O BOTÃO: exatamente as duas partes daquela proposta, e enquanto ela
 * não tiver sido retirada (`podeConversar`, no domínio, testado). Para
 * qualquer outra pessoa o componente devolve `null` — não é um botão
 * desabilitado, é a ausência dele: anunciar uma porta que o banco vai recusar
 * é o oposto do que o §24 pede.
 *
 * O QUE ACONTECE QUANDO AINDA NÃO EXISTE CONVERSA: aparece o botão que a CRIA.
 * `abrirConversa` grava a linha e leva direto para a thread vazia, onde a
 * pessoa escreve a primeira mensagem. Não existe estado intermediário de
 * "convite pendente" — a proposta já foi o convite, e um segundo aceite seria
 * uma etapa a mais entre duas pessoas que já estão tentando fechar negócio.
 *
 * REPARE NO QUE ELE NÃO EXIGE: nem a proposta ter sido ACEITA, nem o pedido
 * estar vivo. Combinar é o passo ANTES de aceitar — é conversando que se
 * decide qual proposta é a melhor —, e a conversa aberta continua legível
 * depois de o anúncio vencer, que é quando o registro do combinado passa a
 * valer.
 */
export async function PortaConversa({
  demandaId,
  propostaId,
  donoId,
  parceiroId,
  statusProposta,
  usuarioId,
  volta,
}: {
  demandaId: string
  propostaId: string
  /** `demandas.autor_id` — quem publicou o pedido. */
  donoId: string
  /** `propostas.autor_id` — quem respondeu. */
  parceiroId: string
  statusProposta: string
  usuarioId: string
  /** Para onde a action volta se der erro. Normalmente `/marketplace/{id}`. */
  volta: string
}) {
  if (!podeConversar({ usuarioId, donoId, parceiroId, statusProposta })) return null

  const conversa = await carregarConversaDaProposta(propostaId)

  if (conversa) {
    // `carregarCaixaDeEntrada` é `cache()`: numa ficha com três propostas isto
    // é UMA consulta, não três. E é o mesmo número que a caixa de entrada e o
    // Menu mostram — três lugares não podem discordar sobre quantas mensagens
    // esperam a pessoa.
    const naoLidas = (await carregarCaixaDeEntrada())
      .find((c) => c.conversa.id === conversa.id)?.naoLidas ?? 0
    return (
      <Link href={`/mensagens/${conversa.id}`} className={`${ALVO_ACAO} mt-2`}>
        <span className={PILULA_ACAO}>
          <Icone nome="chat" className="size-3.5" />
          Abrir conversa
          <SeloNaoLidas quantidade={naoLidas} />
        </span>
      </Link>
    )
  }

  return (
    <form action={abrirConversa} className="mt-2">
      <input type="hidden" name="demanda_id" value={demandaId} />
      <input type="hidden" name="proposta_id" value={propostaId} />
      <input type="hidden" name="volta" value={volta} />
      {/* `contorno` e não a dourada: a ficha do pedido já gasta o acento em
          "Aceitar e liberar meu contato", que é a decisão principal daquela
          tela. Quem diz "aqui se toca" é a forma (`lib/ui/acoes.ts`). */}
      <BotaoEnviar rotulo="Conversar aqui" rotuloEnviando="Abrindo conversa…" variante="contorno" />
    </form>
  )
}
