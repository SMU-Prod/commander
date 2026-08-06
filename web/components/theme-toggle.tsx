"use client"
import { useEffect, useState } from "react"

const opcoes = [
  { valor: "light", rotulo: "Claro" },
  { valor: "dark", rotulo: "Escuro" },
] as const

export function ThemeToggle() {
  const [tema, setTema] = useState<"light" | "dark">("light")

  useEffect(() => {
    setTema(document.documentElement.dataset.theme === "dark" ? "dark" : "light")
  }, [])

  function trocar(novo: "light" | "dark") {
    setTema(novo)
    if (novo === "dark") document.documentElement.dataset.theme = "dark"
    else delete document.documentElement.dataset.theme
    try {
      localStorage.setItem("tema", novo)
    } catch {}
  }

  return (
    <div className="inline-flex rounded-[10px] border border-line bg-panel2 p-1" role="group" aria-label="Tema do aplicativo">
      {opcoes.map((o) => (
        <button
          key={o.valor}
          onClick={() => trocar(o.valor)}
          aria-pressed={tema === o.valor}
          className={`rounded-lg px-4 py-1.5 text-sm font-medium ${
            tema === o.valor ? "bg-accent text-acao-texto" : "text-dim"
          }`}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  )
}
