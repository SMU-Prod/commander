"use client"
import { useState } from "react"
import { Icone } from "@/components/icone"
import { definirEmbarcacaoAtiva } from "@/lib/embarcacao-ativa"

export function SeletorEmbarcacao({
  atual,
  opcoes,
}: {
  atual: { id: string; nome: string }
  opcoes: { id: string; nome: string }[]
}) {
  const [aberto, setAberto] = useState(false)
  // Antes o seletor sumia com um barco só — e junto sumia a única pista de que
  // dá pra ter mais de um. Agora ele sempre abre, nem que seja só pra oferecer
  // "Cadastrar outra".
  return (
    <span className="relative inline-block">
      <button type="button" onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="inline-flex h-11 items-center gap-1 corpo font-medium">
        {atual.nome}
        <Icone nome="chevron" className="size-3.5 rotate-90 text-dim" />
      </button>
      {aberto && (
        <span className="sombra-2 absolute left-0 top-11 z-20 min-w-[200px] rounded-[12px] border border-line bg-panel p-1">
          {opcoes.map((o) => (
            <form key={o.id} action={definirEmbarcacaoAtiva}>
              <input type="hidden" name="embarcacao_id" value={o.id} />
              <button className={`flex h-11 w-full items-center rounded-lg px-3 corpo ${
                o.id === atual.id ? "bg-panel2 font-semibold" : ""
              }`}>
                {o.nome}
              </button>
            </form>
          ))}
          <a
            href="/onboarding"
            className="corpo flex h-11 w-full items-center gap-2 rounded-lg px-3 text-accent-forte"
          >
            <Icone nome="mais" className="size-4" /> Cadastrar outra
          </a>
        </span>
      )}
    </span>
  )
}
