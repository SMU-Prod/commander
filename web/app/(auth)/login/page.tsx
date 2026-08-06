import { cadastrar, entrar } from "@/lib/acoes/auth"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; modo?: string }>
}) {
  const { erro, modo } = await searchParams
  const cadastro = modo === "cadastro"
  return (
    <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col justify-center px-6 pb-16">
      <p className="font-mono-instr text-[11px] uppercase tracking-[.2em] text-accent">GestNav</p>
      <h1 className="mt-2 text-2xl font-semibold">
        {cadastro ? "Crie sua conta" : "Entre na sua conta"}
      </h1>
      {erro && (
        <p className="mt-4 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 text-sm">{erro}</p>
      )}
      <form action={cadastro ? cadastrar : entrar} className="mt-6 space-y-4">
        {cadastro && (
          <input name="nome" required placeholder="Seu nome" className="w-full rounded-[10px] border border-line bg-[#0a1521] px-3 py-3 text-base" />
        )}
        <input name="email" type="email" required placeholder="E-mail" className="w-full rounded-[10px] border border-line bg-[#0a1521] px-3 py-3 text-base" />
        <input name="senha" type="password" required minLength={8} placeholder="Senha (mín. 8 caracteres)" className="w-full rounded-[10px] border border-line bg-[#0a1521] px-3 py-3 text-base" />
        <button className="w-full rounded-xl bg-accent py-3.5 font-semibold text-[#04121d]">
          {cadastro ? "Criar conta" : "Entrar"}
        </button>
      </form>
      <a href={cadastro ? "/login" : "/login?modo=cadastro"} className="mt-5 text-center text-sm text-dim">
        {cadastro ? "Já tenho conta — entrar" : "Não tem conta? Criar agora"}
      </a>
    </main>
  )
}
