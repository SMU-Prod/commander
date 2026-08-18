import Link from "next/link"
import { CampoSenha } from "@/components/campo-senha"
import { Logo } from "@/components/logo"
import { cadastrar, entrar } from "@/lib/acoes/auth"

/**
 * ENTRAR (onda 62, canvas tela-1a) — wordmark no topo, campos com rótulo
 * mono, UMA ação dourada, e a ressalva de honestidade no rodapé desde o
 * primeiro toque (CONTRIBUTING.md a exige em toda superfície de navegação).
 *
 * O FLUXO não mudou nada: `entrar`/`cadastrar` de `lib/acoes/auth.ts`,
 * `?volta=` preservado nos dois sentidos. O canvas desenha ainda "Receber
 * link de acesso por e-mail" e "Esqueci minha senha" — os dois ficaram FORA
 * de propósito: não existe backend de link mágico nem de recuperação hoje, e
 * link pra porta que não abre é o beco que a onda 54 caçou.
 */

const campo =
  "h-12 w-full rounded-[var(--raio-controle)] border border-line bg-campo px-3.5 text-[15px] text-texto placeholder:text-dim"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; aviso?: string; modo?: string; volta?: string }>
}) {
  const { erro, aviso, modo, volta } = await searchParams
  const cadastro = modo === "cadastro"
  const linkAlternar = cadastro
    ? `/login${volta ? `?volta=${encodeURIComponent(volta)}` : ""}`
    : `/login?modo=cadastro${volta ? `&volta=${encodeURIComponent(volta)}` : ""}`
  return (
    <main
      data-theme="dark"
      className="mx-auto flex min-h-dvh max-w-[430px] flex-col bg-ink px-6 pb-10 pt-16 text-texto"
    >
      <div className="text-sm"><Logo /></div>

      <h1 className="titulo-pagina mt-10">{cadastro ? "Crie sua conta" : "Bem-vindo a bordo"}</h1>
      <p className="apoio mt-1.5 text-dim">
        {cadastro
          ? "Sua conta primeiro; a embarcação você cadastra logo depois."
          : "Entre para acompanhar sua embarcação, o diário e o que precisa de você."}
      </p>

      {erro && (
        <p className="corpo mt-4 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>
      )}
      {aviso && (
        <p className="corpo mt-4 rounded-lg border border-line bg-panel px-3 py-2">{aviso}</p>
      )}

      <form action={cadastro ? cadastrar : entrar} className="mt-7 space-y-3.5">
        <input type="hidden" name="volta" value={volta ?? ""} />
        {cadastro && (
          <div>
            <label htmlFor="nome" className="rotulo mb-1.5 block text-dim">Nome</label>
            <input id="nome" name="nome" required placeholder="Seu nome" autoComplete="name" className={campo} />
          </div>
        )}
        <div>
          <label htmlFor="email" className="rotulo mb-1.5 block text-dim">E-mail</label>
          <input
            id="email" name="email" type="email" required
            placeholder="voce@exemplo.com" autoComplete="email" className={campo}
          />
        </div>
        <CampoSenha
          autoComplete={cadastro ? "new-password" : "current-password"}
          placeholder={cadastro ? "Mínimo de 8 caracteres" : undefined}
        />
        {/* A única dourada da tela (DESIGN §5): uma ação principal. */}
        <button className="mt-1 h-12 w-full rounded-[var(--raio-controle)] bg-accent text-[15px] font-semibold text-acao-texto">
          {cadastro ? "Criar conta" : "Entrar"}
        </button>
        {cadastro && (
          <p className="apoio text-center text-dim">
            Ao criar a conta você concorda com os{" "}
            <Link href="/termos" className="text-accent-forte underline underline-offset-2">
              Termos de Uso
            </Link>{" "}
            e a{" "}
            <Link href="/privacidade" className="text-accent-forte underline underline-offset-2">
              Política de Privacidade
            </Link>
            .
          </p>
        )}
      </form>

      {/* O rodapé do canvas: divisor, a troca entrar/cadastrar e a ressalva
          de honestidade — presente antes mesmo do primeiro login. */}
      <div className="mt-auto flex flex-col gap-4 pt-10">
        <div className="h-px bg-line" />
        <a href={linkAlternar} className="corpo -my-2 flex min-h-11 items-center justify-center text-dim">
          {cadastro ? (
            <>Já tem conta?&nbsp;<span className="font-semibold text-accent-forte">Entrar</span></>
          ) : (
            <>Ainda não tem conta?&nbsp;<span className="font-semibold text-accent-forte">Cadastrar embarcação</span></>
          )}
        </a>
        <p className="text-center font-mono-instr text-[11px] leading-relaxed text-dim">
          O Commander não é auxílio à navegação.<br />
          Consulte sempre a carta náutica oficial.
        </p>
      </div>
    </main>
  )
}
