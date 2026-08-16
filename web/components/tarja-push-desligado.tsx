"use client"
import Link from "next/link"
import { useEffect, useState } from "react"
import { Icone } from "@/components/icone"

/**
 * ONDA 58 — a tarja que sobrou quando o `AtivarAlertas` saiu de Avisos
 * (spec de arquitetura §3.2): a caixa de entrada só fala de push quando o
 * push está DESLIGADO, porque aí é informação sobre a própria caixa — "o
 * que você vê aqui não chega no seu bolso". Ligado, ela some; a gestão
 * (ativar, testar, desativar) mora em Ajustes.
 *
 * O sniff de suporte é o mesmo do `AtivarAlertas` (components/
 * ativar-alertas.tsx), e os quatro estados também — mas três deles rendem
 * `null`: `carregando` (não piscar tarja antes de saber), `sem-suporte`
 * (navegador sem push não tem o que ativar; o aviso de "instale o app no
 * iPhone" pertence a Ajustes, não à caixa de entrada) e `ativo`.
 */
export function TarjaPushDesligado() {
  const [estado, setEstado] = useState<"carregando" | "sem-suporte" | "inativo" | "ativo">("carregando")

  useEffect(() => {
    ;(async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setEstado("sem-suporte")
        return
      }
      const reg = await navigator.serviceWorker.ready
      const ass = await reg.pushManager.getSubscription()
      setEstado(ass ? "ativo" : "inativo")
    })().catch(() => setEstado("sem-suporte"))
  }, [])

  if (estado !== "inativo") return null

  return (
    // `/menu/ajustes` ainda não existe neste commit — a Tarefa 3 desta mesma
    // onda cria a rota (e é pra lá que o `AtivarAlertas` se muda). O link já
    // nasce apontando pro endereço definitivo pra não ter um commit de
    // "conserta o link da tarja" depois.
    //
    // Discreta de propósito: borda de linha, texto dim, zero dourado — o
    // orçamento de dourado da tela é da aba ativa e do filtro ativo. A ação
    // é o sublinhado neutro, o mesmo tratamento de link não-dourado do
    // `EstadoVazio enfase="discreta"`. `min-h-11` = alvo de toque de 44px.
    <Link
      href="/menu/ajustes"
      className="flex min-h-11 items-center gap-2 rounded-[var(--raio-controle)] border border-line bg-panel2 px-3 text-xs text-dim"
    >
      <Icone nome="alerta" className="size-4 shrink-0" />
      <span>
        Avisos no aparelho estão desligados —{" "}
        <span className="text-texto underline underline-offset-2">ativar em Ajustes</span>
      </span>
    </Link>
  )
}
