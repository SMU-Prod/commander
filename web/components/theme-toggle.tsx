"use client"
import { useEffect, useState } from "react"

const opcoes = [
  { valor: "light", rotulo: "Claro" },
  { valor: "dark", rotulo: "Escuro" },
] as const

export function ThemeToggle() {
  const [tema, setTema] = useState<"light" | "dark">("light")

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza estado inicial com o DOM pos-hydration
    setTema(document.documentElement.dataset.theme === "dark" ? "dark" : "light")
  }, [])

  function trocar(novo: "light" | "dark") {
    setTema(novo)
    // eslint-disable-next-line react-hooks/immutability -- troca de tema muta o DOM de proposito
    if (novo === "dark") document.documentElement.dataset.theme = "dark"
    // eslint-disable-next-line react-hooks/immutability -- troca de tema muta o DOM de proposito
    else delete document.documentElement.dataset.theme
    try {
      localStorage.setItem("tema", novo)
    } catch {}
  }

  return (
    <div className="inline-flex rounded-[var(--raio-cartao)] border border-line bg-panel2 p-1" role="group" aria-label="Tema do aplicativo">
      {opcoes.map((o) => (
        <button
          key={o.valor}
          onClick={() => trocar(o.valor)}
          aria-pressed={tema === o.valor}
          // ONDA 54 — `py-1.5` dava 32px de altura. É botão de verdade (não
          // texto), então vale a régua `min-h-11` do app. Aqui NÃO cabe
          // margem negativa como no `SecaoPagina`: o par de botões vive
          // dentro de uma moldura com `p-1`, e encolher por fora faria o
          // fundo do grupo cortar o botão ativo.
          className={`flex min-h-11 items-center rounded-[var(--raio-controle)] px-4 text-sm font-medium ${
            tema === o.valor ? "bg-accent text-acao-texto" : "text-dim-chip"
          }`}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  )
}
