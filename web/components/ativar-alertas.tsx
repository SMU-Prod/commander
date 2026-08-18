"use client"
import { useEffect, useState } from "react"
import { enviarPushTeste, removerAssinaturaPush, salvarAssinaturaPush } from "@/lib/acoes/push"
import { ACAO_NAO_ESTICA } from "@/lib/ui/superficies"

function base64ParaUint8(base64: string): Uint8Array {
  const preenchimento = "=".repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + preenchimento).replace(/-/g, "+").replace(/_/g, "/")
  const binaryString = atob(b64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

export function AtivarAlertas() {
  const [estado, setEstado] = useState<"carregando" | "sem-suporte" | "inativo" | "ativo">("carregando")
  const [msg, setMsg] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

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

  async function ativar() {
    if (ocupado) return
    setOcupado(true)
    setMsg(null)
    try {
      const permissao = await Notification.requestPermission()
      if (permissao !== "granted") {
        setMsg("Permissão negada — libere as notificações do site nas configurações do navegador.")
        return
      }
      const chave = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!chave) {
        setMsg("Push não configurado no servidor.")
        return
      }
      const reg = await navigator.serviceWorker.ready
      const ass = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64ParaUint8(chave) as BufferSource,
      })
      const r = await salvarAssinaturaPush(
        ass.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } },
      )
      if (!r.ok) {
        setMsg(r.erro)
        return
      }
      setEstado("ativo")
      setMsg("Avisos ativados neste aparelho.")
    } catch {
      setMsg("Não deu para ativar. No iPhone, primeiro instale o app: Compartilhar → Adicionar à Tela de Início.")
    } finally {
      setOcupado(false)
    }
  }

  async function desativar() {
    if (ocupado) return
    setOcupado(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const ass = await reg.pushManager.getSubscription()
      if (ass) {
        await removerAssinaturaPush(ass.endpoint)
        await ass.unsubscribe()
      }
      setEstado("inativo")
      setMsg(null)
    } finally {
      setOcupado(false)
    }
  }

  async function teste() {
    if (ocupado) return
    setOcupado(true)
    setMsg(null)
    const r = await enviarPushTeste()
    setMsg(r.ok ? "Enviado — a notificação deve chegar em segundos." : r.erro)
    setOcupado(false)
  }

  return (
    <div className="rounded-[14px] border border-line bg-panel p-4">
      <p className="text-sm font-semibold">Neste aparelho</p>
      {estado === "sem-suporte" && (
        <p className="mt-1.5 text-xs text-dim">
          Este navegador não suporta notificações. No iPhone, instale o app primeiro:
          Compartilhar → Adicionar à Tela de Início.
        </p>
      )}
      {estado === "inativo" && (
        /* Era um botão dourado de 1265px atravessando `/menu/ajustes` a
           1440 — a pior amostra do "app esticado" na auditoria de 18/08.
           `ACAO_NAO_ESTICA` mantém a linha inteira no celular e devolve a
           largura do conteúdo no monitor. */
        <button onClick={ativar} disabled={ocupado}
          className={`${ACAO_NAO_ESTICA} mt-3 rounded-xl bg-accent py-3 font-semibold text-acao-texto disabled:opacity-60`}>
          Ativar avisos neste aparelho
        </button>
      )}
      {estado === "ativo" && (
        <div className="mt-3 flex gap-2 sm:max-w-[26rem]">
          <button onClick={teste} disabled={ocupado}
            className="flex-1 rounded-xl border border-line py-2.5 text-sm font-medium disabled:opacity-60">
            Enviar teste
          </button>
          <button onClick={desativar} disabled={ocupado}
            className="flex-1 rounded-xl border border-crit/40 py-2.5 text-sm font-medium text-crit disabled:opacity-60">
            Desativar
          </button>
        </div>
      )}
      {msg && <p className="mt-2.5 text-xs text-dim">{msg}</p>}
    </div>
  )
}
