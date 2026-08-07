import { Logo } from "@/components/logo"
import { cadastrar, entrar } from "@/lib/acoes/auth"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; modo?: string; volta?: string }>
}) {
  const { erro, modo, volta } = await searchParams
  const cadastro = modo === "cadastro"
  return (
    <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col justify-center px-6 pb-16">
      <div className="text-lg"><Logo /></div>
      <p className="mt-1 text-xs uppercase tracking-[.18em] text-dim">
        Gestão completa da sua embarcação
      </p>
      <h1 className="mt-6 text-2xl font-semibold">
        {cadastro ? "Crie sua conta" : "Entre na sua conta"}
      </h1>
      {erro && (
        <p className="mt-4 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 text-sm">{erro}</p>
      )}
      <form action={cadastro ? cadastrar : entrar} className="mt-6 space-y-4">
        <input type="hidden" name="volta" value={volta ?? ""} />
        {cadastro && (
          <div>
            <label htmlFor="nome" className="sr-only">Nome</label>
            <input id="nome" name="nome" required placeholder="Seu nome" autoComplete="name" className="w-full rounded-[10px] border border-line bg-campo px-3 py-3 text-base" />
          </div>
        )}
        <div>
          <label htmlFor="email" className="sr-only">E-mail</label>
          <input id="email" name="email" type="email" required placeholder="E-mail" autoComplete="email" className="w-full rounded-[10px] border border-line bg-campo px-3 py-3 text-base" />
        </div>
        <div>
          <label htmlFor="senha" className="sr-only">Senha</label>
          <input id="senha" name="senha" type="password" required minLength={8} placeholder="Senha (mín. 8 caracteres)" autoComplete={cadastro ? "new-password" : "current-password"} className="w-full rounded-[10px] border border-line bg-campo px-3 py-3 text-base" />
        </div>
        <button className="w-full rounded-xl bg-accent py-3.5 font-semibold text-acao-texto">
          {cadastro ? "Criar conta" : "Entrar"}
        </button>
      </form>
      <a
        href={cadastro ? `/login${volta ? `?volta=${encodeURIComponent(volta)}` : ""}` : `/login?modo=cadastro${volta ? `&volta=${encodeURIComponent(volta)}` : ""}`}
        className="mt-5 text-center text-sm text-dim"
      >
        {cadastro ? "Já tenho conta — entrar" : "Não tem conta? Criar agora"}
      </a>
    </main>
  )
}
