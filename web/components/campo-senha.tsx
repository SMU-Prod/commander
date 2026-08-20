"use client"
import { useState } from "react"

/**
 * Campo de senha da tela de entrada (onda 62, canvas tela-1a): rótulo mono
 * em cima, "mostrar"/"ocultar" DENTRO do campo — senha digitada com o barco
 * balançando é senha conferida antes do toque em Entrar.
 *
 * Client component só pela alternância de visibilidade; o formulário em
 * volta continua server action intocada (`entrar`/`cadastrar` em
 * `lib/acoes/auth.ts`).
 */
export function CampoSenha({
  autoComplete,
  placeholder,
}: {
  autoComplete: string
  placeholder?: string
}) {
  const [visivel, setVisivel] = useState(false)
  return (
    <div>
      <label htmlFor="senha" className="rotulo mb-1.5 block text-dim">Senha</label>
      <div className="flex h-12 items-center rounded-[var(--raio-controle)] border border-line bg-campo focus-within:border-dim">
        <input
          id="senha"
          name="senha"
          type={visivel ? "text" : "password"}
          required
          minLength={8}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="h-full min-w-0 flex-1 bg-transparent px-3.5 text-base text-texto placeholder:text-dim focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setVisivel((v) => !v)}
          aria-pressed={visivel}
          className="h-full shrink-0 px-3.5 text-sm font-medium text-dim-chip"
        >
          {visivel ? "ocultar" : "mostrar"}
        </button>
      </div>
    </div>
  )
}
