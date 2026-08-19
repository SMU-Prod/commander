"use client"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { ALVO_ACAO, PILULA_ACAO } from "@/lib/ui/acoes"

/**
 * A TELA SE ATUALIZA DE VERDADE, E DIZ EXATAMENTE COMO.
 *
 * O problema é real e não tem saída elegante: um Server Component não empurra
 * nada. A thread renderiza no servidor e fica parada até alguém navegar — o
 * que numa conversa significa que a resposta do outro lado chega e a pessoa
 * não fica sabendo.
 *
 * POR QUE NÃO REALTIME DO SUPABASE, nesta primeira versão. A alternativa
 * existe e é melhor em regime: canal por conversa, autorizado por RLS, e a
 * mensagem aparece no instante. Ela ficou de fora por uma razão só, e é a
 * regra da casa: **o que não pode é a tela parecer viva sem ser.** Realtime
 * traz um socket, e socket cai — no 3G da marina, no túnel, no app que voltou
 * do segundo plano depois de uma hora. Quando ele cai sem a tela dizer,
 * produz-se exatamente a mentira mais cara possível aqui: uma conversa que
 * parece em dia e está congelada há vinte minutos. Fazer isso direito exige
 * detectar a queda, reconectar, recarregar o que se perdeu e DESENHAR o estado
 * "desconectado" — quatro coisas que não dá para testar sem duas contas reais
 * e uma rede ruim de verdade. Enquanto isso não existe, uma recarga
 * declarada é mais honesta que um tempo real que às vezes não é.
 *
 * O QUE ESTE COMPONENTE FAZ, sem enfeite:
 *  · pede ao roteador uma recarga a cada `segundos`, enquanto a aba está
 *    VISÍVEL. Aba escondida não recarrega nada — cobrar dados de quem está com
 *    o app no bolso é gastar bateria e franquia para atualizar uma tela que
 *    ninguém está olhando;
 *  · recarrega na hora em que a aba volta a ficar visível, que é o momento em
 *    que a informação velha volta a importar;
 *  · mostra o horário da ÚLTIMA VERIFICAÇÃO CONCLUÍDA, e o botão de verificar
 *    agora. É este par que separa "está atualizando" de "parece que está".
 *
 * O QUE ELE NÃO FAZ, e é a parte importante: não tem ponto pulsando, não tem
 * "ao vivo", não tem bolinha verde. Nenhum desses estados é um dado que este
 * componente possui — e inventar um seria o mesmo defeito, na outra direção.
 */
export function AtualizacaoViva({ segundos = 15 }: { segundos?: number }) {
  const router = useRouter()
  const [verificando, iniciar] = useTransition()
  const [verificadoEm, setVerificadoEm] = useState<string | null>(null)
  // Sem esta trava, o efeito abaixo carimbaria um horário na primeira
  // renderização (quando `verificando` já é `false` sem nunca ter sido `true`)
  // — ou seja, o app diria "verificado às 14:32" sem ter verificado nada.
  const pediu = useRef(false)

  useEffect(() => {
    if (verificando || !pediu.current) return
    pediu.current = false
    setVerificadoEm(
      new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Sao_Paulo",
      }).format(new Date()),
    )
  }, [verificando])

  const verificar = useCallback(() => {
    pediu.current = true
    // `router.refresh()` refaz o Server Component no servidor e troca só o que
    // mudou, preservando o que a pessoa digitou no campo de mensagem. Uma
    // recarga de página inteira apagaria o rascunho a cada 15 segundos.
    iniciar(() => router.refresh())
  }, [router])

  useEffect(() => {
    const seVisivel = () => {
      if (document.visibilityState === "visible") verificar()
    }
    const id = window.setInterval(seVisivel, segundos * 1000)
    document.addEventListener("visibilitychange", seVisivel)
    return () => {
      window.clearInterval(id)
      document.removeEventListener("visibilitychange", seVisivel)
    }
  }, [segundos, verificar])

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
      <p className="apoio text-dim">
        {/* A frase é o contrato: diz o intervalo, diz que depende da tela
            estar aberta, e não promete instantaneidade nenhuma. */}
        Atualiza sozinho a cada {segundos} segundos com esta tela aberta.
        {verificadoEm && ` Verificado às ${verificadoEm}.`}
      </p>
      <button type="button" onClick={verificar} disabled={verificando} className={ALVO_ACAO}>
        <span className={PILULA_ACAO}>{verificando ? "Verificando…" : "Verificar agora"}</span>
      </button>
    </div>
  )
}
