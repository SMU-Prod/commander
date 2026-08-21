"use client"
import { useState } from "react"
import { Icone } from "@/components/icone"
import { criarTokenConector } from "@/lib/acoes/conector"
import { ALVO_ACAO, PILULA_ACAO } from "@/lib/ui/acoes"

/**
 * ONDA 140 — GERAR O TOKEN DO COMMANDER CONNECTOR (Ajustes → Navegação).
 * ===========================================================================
 * O fluxo do dono de barco: instala o plugin "Commander Connector" na App
 * Store do Signal K dele → volta aqui → gera o token → cola na configuração
 * do plugin. O token aparece UMA vez (só o hash vive no banco — ver
 * lib/acoes/conector.ts); por isso o botão de copiar mora do lado e a tela
 * avisa que ele não será mostrado de novo.
 */
export function ConectorToken() {
  const [estado, setEstado] = useState<
    { fase: "ocioso" } | { fase: "gerando" } | { fase: "pronto"; token: string } | { fase: "erro"; erro: string }
  >({ fase: "ocioso" })
  const [copiado, setCopiado] = useState(false)

  async function gerar() {
    setEstado({ fase: "gerando" })
    const r = await criarTokenConector()
    setEstado("erro" in r ? { fase: "erro", erro: r.erro } : { fase: "pronto", token: r.token })
  }

  async function copiar(token: string) {
    try {
      await navigator.clipboard.writeText(token)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    } catch {}
  }

  return (
    <div className="sombra-1 mt-3 rounded-[var(--raio-cartao)] border border-line bg-panel px-4 py-3.5">
      <p className="titulo-card">Commander Connector</p>
      <p className="apoio mt-1 text-dim">
        Tem um servidor Signal K a bordo? Instale o plugin “Commander Connector” na App Store dele e
        cole lá o token gerado aqui. O barco passa a enviar os dados que você autorizar, mesmo com o
        celular longe.{" "}
        <a href="/menu/conectar-barco" className="font-semibold text-accent-forte">
          Ver o passo a passo
        </a>
      </p>

      {estado.fase === "pronto" ? (
        <div className="mt-3">
          <p className="break-all rounded-[var(--raio-controle)] border border-line bg-campo px-3 py-2 tabular-nums text-xs">
            {estado.token}
          </p>
          <div className="mt-1 flex items-center gap-3">
            <button type="button" onClick={() => copiar(estado.token)} className={ALVO_ACAO}>
              <span className={PILULA_ACAO}>
                <Icone nome={copiado ? "check" : "copiar"} className="size-4" />
                {copiado ? "Token copiado" : "Copiar token"}
              </span>
            </button>
          </div>
          <p className="apoio mt-1 text-dim">
            Guarde agora — por segurança ele não será mostrado de novo. Se perder, gere outro.
          </p>
        </div>
      ) : (
        <div className="mt-2">
          <button type="button" onClick={gerar} disabled={estado.fase === "gerando"} className={ALVO_ACAO} aria-busy={estado.fase === "gerando"}>
            <span className={`${PILULA_ACAO} ${estado.fase === "gerando" ? "animate-pulse" : ""}`}>
              {estado.fase === "gerando" ? "Gerando token…" : "Gerar token do conector"}
            </span>
          </button>
          {estado.fase === "erro" && (
            <p className="corpo mt-2 rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2">
              {estado.erro}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
