import Link from "next/link"
import { Logo } from "@/components/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { sair } from "@/lib/acoes/auth"
import { supabaseServer } from "@/lib/supabase/server"

export default async function MenuPage() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <main>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Menu</h1>
        <Logo compacto />
      </div>

      <p className="mt-6 mb-2 font-mono-instr text-[10.5px] uppercase tracking-[.16em] text-dim">Conta</p>
      <div className="rounded-[14px] border border-line bg-panel px-4 py-3.5">
        <p className="text-sm font-medium">{user?.email ?? "—"}</p>
        <p className="mt-0.5 text-xs text-dim">Proprietário</p>
      </div>

      <p className="mt-6 mb-2 font-mono-instr text-[10.5px] uppercase tracking-[.16em] text-dim">Aparência</p>
      <div className="rounded-[14px] border border-line bg-panel px-4 py-3.5">
        <ThemeToggle />
        <p className="mt-2 text-xs text-dim">
          O modo claro é o padrão — feito para leitura sob sol forte na marina.
        </p>
      </div>

      <p className="mt-6 mb-2 font-mono-instr text-[10.5px] uppercase tracking-[.16em] text-dim">Alertas</p>
      <Link href="/notificacoes" className="block rounded-[14px] border border-line bg-panel px-4 py-3.5">
        <p className="text-sm font-medium">Configurar alertas</p>
        <p className="mt-0.5 text-xs text-dim">Ative os avisos por aparelho e veja o histórico</p>
      </Link>

      <p className="mt-6 mb-2 font-mono-instr text-[10.5px] uppercase tracking-[.16em] text-dim">Em breve</p>
      <div className="rounded-[14px] border border-line bg-panel px-4">
        {["Assinatura e faturas", "Convidar comandante"].map((item) => (
          <p key={item} className="border-b border-line py-3 text-sm text-dim last:border-0">
            {item}
          </p>
        ))}
      </div>

      <form action={sair} className="mt-8">
        <button className="w-full rounded-xl border border-crit/40 py-3 text-sm font-semibold text-crit">
          Sair da conta
        </button>
      </form>
    </main>
  )
}
