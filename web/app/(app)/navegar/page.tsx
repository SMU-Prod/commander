"use client"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { salvarTrilha } from "@/lib/acoes/trilha"
import { haversineNm, resumoTrilha, MAX_PONTOS_TRILHA, type PontoTrilha, type ResumoTrilha } from "@/lib/domain/geo"

const RESUMO_VAZIO: ResumoTrilha = { distanciaNm: 0, duracaoH: 0, tempoMovimentoH: 0, velMediaKt: 0, velMaxKt: 0 }

export default function NavegarPage() {
  const router = useRouter()
  const [estado, setEstado] = useState<"pronto" | "gravando" | "parado" | "salvando">("pronto")
  const [msg, setMsg] = useState<string | null>(null)
  const [obs, setObs] = useState("")
  const [painel, setPainel] = useState({ velKt: 0, resumo: RESUMO_VAZIO, qtd: 0 })
  const pontosRef = useRef<PontoTrilha[]>([])
  const watchRef = useRef<number | null>(null)
  const wakeRef = useRef<{ release: () => Promise<void> } | null>(null)

  useEffect(() => {
    return () => {
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current)
      wakeRef.current?.release().catch(() => {})
    }
  }, [])

  async function iniciar() {
    if (watchRef.current != null) return
    if (!("geolocation" in navigator)) {
      setMsg("Este navegador não fornece localização.")
      return
    }
    setMsg(null)
    pontosRef.current = []
    setPainel({ velKt: 0, resumo: RESUMO_VAZIO, qtd: 0 })
    watchRef.current = navigator.geolocation.watchPosition(
      (p) => {
        const ponto = { t: Math.round(p.timestamp / 1000), la: p.coords.latitude, lo: p.coords.longitude }
        const lista = pontosRef.current
        if (lista.length >= MAX_PONTOS_TRILHA) return
        const ultimo = lista[lista.length - 1]
        if (!ultimo || haversineNm(ultimo, ponto) * 1852 >= 15 || ponto.t - ultimo.t >= 30) {
          lista.push(ponto)
          const pen = lista[lista.length - 2]
          const velKt = pen && ponto.t > pen.t ? haversineNm(pen, ponto) / ((ponto.t - pen.t) / 3600) : 0
          setPainel({ velKt, resumo: resumoTrilha(lista), qtd: lista.length })
        }
      },
      () => setMsg("Sem sinal de GPS — confira a permissão de localização."),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    )
    try {
      // mantém a tela acesa durante a navegação (best-effort)
      const wl = await (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request("screen")
      if (wl) wakeRef.current = wl
    } catch {}
    setEstado("gravando")
  }

  async function pararGps() {
    if (watchRef.current != null) {
      navigator.geolocation.clearWatch(watchRef.current)
      watchRef.current = null
    }
    await wakeRef.current?.release().catch(() => {})
    wakeRef.current = null
  }

  async function encerrarESalvar() {
    await pararGps()
    setEstado("salvando")
    const r = await salvarTrilha(pontosRef.current, obs)
    if (r.ok) {
      router.push("/diario")
      return
    }
    setMsg(r.erro)
    setEstado(pontosRef.current.length >= 2 ? "parado" : "pronto")
  }

  const mostrador = "rounded-[10px] border border-line bg-meter px-3 py-2 font-mono-instr tabular-nums text-meter-texto"
  const etiqueta = "text-[10px] uppercase tracking-[.14em] text-meter-dim"

  return (
    <main>
      <h1 className="text-xl font-semibold">Navegação</h1>
      <p className="mt-1 text-sm text-dim">
        Mantenha o app aberto durante o passeio — a trilha vira um evento no Diário de Bordo.
      </p>
      {msg && <p className="mt-3 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-sm">{msg}</p>}
      {estado === "parado" && (
        <p className="mt-3 rounded-lg border border-line bg-panel px-3 py-2 text-sm text-dim">
          GPS parado — a trilha está pronta para salvar.
        </p>
      )}

      <div className="mt-5 grid grid-cols-2 gap-2">
        <div className={mostrador}>
          <p className={etiqueta}>Velocidade</p>
          <p className="text-3xl">{painel.velKt.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} <span className="text-sm text-meter-dim">kt</span></p>
        </div>
        <div className={mostrador}>
          <p className={etiqueta}>Distância</p>
          <p className="text-3xl">{painel.resumo.distanciaNm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} <span className="text-sm text-meter-dim">nm</span></p>
        </div>
        <div className={mostrador}>
          <p className={etiqueta}>Tempo</p>
          <p className="text-3xl">{(painel.resumo.duracaoH * 60).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} <span className="text-sm text-meter-dim">min</span></p>
        </div>
        <div className={mostrador}>
          <p className={etiqueta}>Máxima</p>
          <p className="text-3xl">{painel.resumo.velMaxKt.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} <span className="text-sm text-meter-dim">kt</span></p>
        </div>
      </div>

      {estado === "pronto" && (
        <button onClick={iniciar} className="mt-5 w-full rounded-xl bg-accent py-4 text-base font-semibold text-acao-texto">
          Iniciar gravação
        </button>
      )}
      {estado !== "pronto" && (
        <>
          <div className="mt-5">
            <label htmlFor="obs" className="mb-1.5 block font-mono-instr text-[10.5px] uppercase tracking-[.14em] text-dim">
              Observação — opcional
            </label>
            <input id="obs" value={obs} onChange={(e) => setObs(e.target.value)}
              placeholder="Ex.: volta às Cagarras"
              className="w-full rounded-[10px] border border-line bg-campo px-3 py-3 text-base" />
          </div>
          <button onClick={encerrarESalvar} disabled={estado === "salvando"}
            className="mt-3 w-full rounded-xl bg-crit py-4 text-base font-semibold text-white disabled:opacity-60">
            {estado === "salvando" ? "Salvando…" : estado === "parado" ? "Tentar salvar de novo" : "Encerrar e salvar no diário"}
          </button>
          <p className="mt-2 text-center font-mono-instr text-[11px] tabular-nums text-dim">
            {painel.qtd} pontos gravados
            {painel.qtd >= MAX_PONTOS_TRILHA ? " · limite atingido — a trilha será salva até aqui" : ""}
          </p>
        </>
      )}
    </main>
  )
}
