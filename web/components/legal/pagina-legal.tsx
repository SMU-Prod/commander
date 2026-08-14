import Link from "next/link"
import type { ReactNode } from "react"
import { Icone, type NomeIcone } from "@/components/icone"
import { Logo } from "@/components/logo"

/**
 * Casca compartilhada de /termos e /privacidade (onda 30). Público, sem
 * login — ver `rotaPublica` em middleware.ts. De propósito NÃO força
 * `data-theme="dark"` como a landing/`/parceiros`: é texto longo pra ler
 * com calma, então segue o tema salvo pelo visitante (claro por padrão,
 * ver comentário em app/(app)/menu/page.tsx) em vez de impor o modo escuro
 * de marketing.
 */
export function PaginaLegal({
  titulo,
  icone,
  vigencia,
  outraPagina,
  children,
}: {
  titulo: string
  icone: NomeIcone
  /** Ex.: "14 de agosto de 2026". */
  vigencia: string
  outraPagina: { href: string; rotulo: string }
  children: ReactNode
}) {
  return (
    <div className="min-h-dvh bg-ink text-texto">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 pt-6">
        <Link href="/" className="flex items-center gap-2">
          <Logo compacto />
          <span className="rotulo text-accent">Commander</span>
        </Link>
        <Link href="/login" className="corpo font-medium text-dim hover:text-texto">
          Entrar
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <span className="flex size-11 items-center justify-center rounded-full bg-accent/12 text-accent-forte">
          <Icone nome={icone} className="size-5" />
        </span>
        <h1 className="titulo-pagina mt-4 text-3xl sm:text-4xl">{titulo}</h1>
        <p className="corpo mt-3 text-dim">
          Vigência: {vigencia}. Se mudarmos este texto, avisamos por e-mail e/ou dentro do
          app antes da mudança valer — a data acima sempre mostra a versão mais recente.
        </p>
        <p className="mt-2">
          <Link href={outraPagina.href} className="corpo inline-flex min-h-11 items-center text-accent-forte">
            Ler {outraPagina.rotulo} →
          </Link>
        </p>

        <div className="mt-8 space-y-10 border-t border-line pt-8">{children}</div>
      </main>

      <footer className="border-t border-line px-6 py-10">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left">
          <Link href="/" className="flex items-center gap-2">
            <Logo compacto />
            <span className="apoio text-dim">Commander</span>
          </Link>
          <Link href={outraPagina.href} className="apoio text-dim hover:text-texto">
            {outraPagina.rotulo}
          </Link>
          <a href="mailto:atendimento.smu@gmail.com" className="apoio text-dim hover:text-texto">
            atendimento.smu@gmail.com
          </a>
        </div>
        <p className="apoio mt-6 text-center text-dim/70">© {new Date().getFullYear()} Commander</p>
      </footer>
    </div>
  )
}

/** Cabeçalho de seção dentro do texto longo — h2 com um pouco mais de peso
 *  que `titulo-card` (feito pra cartão pequeno), mesma paleta de tokens. */
export function SecaoLegal({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-semibold tracking-tight text-texto">{titulo}</h2>
      <div className="corpo mt-3 space-y-3 text-dim [&_strong]:font-semibold [&_strong]:text-texto [&_a]:text-accent-forte [&_a]:underline [&_a]:underline-offset-2">
        {children}
      </div>
    </section>
  )
}

/** Bloco de destaque (usado para os avisos náuticos e de privacidade mais
 *  importantes — sondagem/corredores, limitação de responsabilidade). */
export function DestaqueLegal({ children }: { children: ReactNode }) {
  return (
    <div className="sombra-1 rounded-[14px] border border-accent/30 bg-accent/5 p-4">
      <div className="corpo space-y-3 text-texto [&_strong]:font-semibold">{children}</div>
    </div>
  )
}
