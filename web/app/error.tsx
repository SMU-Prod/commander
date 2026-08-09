"use client"

export default function Erro({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col items-center justify-center px-6 text-center">
      <p className="font-mono-instr text-[11px] uppercase tracking-[.2em] text-dim">Commander</p>
      <h1 className="titulo-pagina mt-3">Algo deu errado</h1>
      <p className="mt-2 text-sm text-dim">
        Não foi possível carregar seus dados. Verifique a conexão e tente de novo.
      </p>
      <button
        onClick={reset}
        className="mt-6 rounded-xl bg-accent px-6 py-3 font-semibold text-acao-texto"
      >
        Tentar de novo
      </button>
    </main>
  )
}
