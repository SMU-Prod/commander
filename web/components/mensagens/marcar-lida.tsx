"use client"
import { useEffect } from "react"
import { marcarConversaLida } from "@/lib/acoes/mensagens"

/**
 * Carimba "li até aqui" DEPOIS que a thread apareceu na tela.
 *
 * POR QUE UM EFEITO NO CLIENTE E NÃO UMA LINHA NA PÁGINA. A tela é um Server
 * Component; escrever a marca lá dentro seria gravar no banco durante um GET.
 * Além de ser o anti-padrão que o App Router avisa, teria um efeito colateral
 * concreto neste módulo: a `AtualizacaoViva` recarrega a página a cada 15
 * segundos, então cada recarga viraria uma escrita — e a marca avançaria
 * sozinha sobre mensagens que chegaram enquanto a pessoa estava com o celular
 * na mesa, sem ninguém ter lido nada.
 *
 * `ate` NÃO É O RELÓGIO: é o carimbo da última mensagem que ESTA renderização
 * mostrou (`marcaDeLeitura`, no domínio). É o que garante que a mensagem
 * chegada no mesmo segundo em que a tela abriu continue contando como não
 * lida, em vez de sumir do contador sem nunca ter sido vista.
 *
 * A dependência do efeito é `ate`, e é ela que faz isto funcionar junto com a
 * atualização periódica: enquanto nada novo chega, o efeito não roda de novo;
 * quando a recarga traz uma mensagem nova, `ate` muda e a marca avança — que é
 * exatamente o momento em que a pessoa realmente a viu.
 *
 * Não renderiza nada. Se a gravação falhar, o efeito colateral é o contador
 * continuar subindo — o lado seguro do erro, e por isso a action nem devolve
 * falha para cá.
 */
export function MarcarLida({ conversaId, ate }: { conversaId: string; ate: string }) {
  useEffect(() => {
    void marcarConversaLida(conversaId, ate)
  }, [conversaId, ate])
  return null
}
