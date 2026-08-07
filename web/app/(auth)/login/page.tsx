import { Logo } from "@/components/logo"
import { cadastrar, entrar } from "@/lib/acoes/auth"

const campo =
  "w-full rounded-[10px] border border-white/15 bg-white/5 px-3 py-3.5 text-base text-texto placeholder:text-dim"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; aviso?: string; modo?: string; volta?: string }>
}) {
  const { erro, aviso, modo, volta } = await searchParams
  const cadastro = modo === "cadastro"
  return (
    <main
      data-theme="dark"
      className="mx-auto flex min-h-dvh max-w-[430px] flex-col justify-center bg-ink px-6 pb-16 text-texto"
      style={{ backgroundImage: "radial-gradient(ellipse 80% 45% at 50% 0%, var(--superficie-2) 0%, transparent 60%)" }}
    >
      <div className="text-xl"><Logo /></div>
      <p className="mt-2 text-xs uppercase tracking-[.18em] text-dim">
        O dossiê do seu barco
      </p>
      <h1 className="titulo-pagina mt-7">{cadastro ? "Crie sua conta" : "Entre na sua conta"}</h1>
      {erro && (
        <p className="mt-4 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 corpo">{erro}</p>
      )}
      {aviso && (
        <p className="mt-4 rounded-lg border border-line bg-white/5 px-3 py-2 corpo">{aviso}</p>
      )}
      <form action={cadastro ? cadastrar : entrar} className="mt-6 space-y-3.5">
        <input type="hidden" name="volta" value={volta ?? ""} />
        {cadastro && (
          <div>
            <label htmlFor="nome" className="sr-only">Nome</label>
            <input id="nome" name="nome" required placeholder="Seu nome" autoComplete="name" className={campo} />
          </div>
        )}
        <div>
          <label htmlFor="email" className="sr-only">E-mail</label>
          <input id="email" name="email" type="email" required placeholder="E-mail" autoComplete="email" className={campo} />
        </div>
        <div>
          <label htmlFor="senha" className="sr-only">Senha</label>
          <input id="senha" name="senha" type="password" required minLength={8}
            placeholder="Senha (mín. 8 caracteres)"
            autoComplete={cadastro ? "new-password" : "current-password"} className={campo} />
        </div>
        <button className="sombra-2 w-full rounded-xl bg-accent py-3.5 text-base font-semibold text-acao-texto">
          {cadastro ? "Criar conta" : "Entrar"}
        </button>
      </form>
      <a
        href={cadastro ? `/login${volta ? `?volta=${encodeURIComponent(volta)}` : ""}` : `/login?modo=cadastro${volta ? `&volta=${encodeURIComponent(volta)}` : ""}`}
        className="mt-6 text-center corpo text-dim"
      >
        {cadastro ? "Já tenho conta — entrar" : "Não tem conta? Criar agora"}
      </a>
    </main>
  )
}
