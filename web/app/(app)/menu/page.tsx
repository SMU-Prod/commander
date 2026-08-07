import Link from "next/link"
import { Icone } from "@/components/icone"
import { Logo } from "@/components/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { sair } from "@/lib/acoes/auth"
import { carregarPainel } from "@/lib/consultas"
import { supabaseServer } from "@/lib/supabase/server"

export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>
}) {
  const { erro } = await searchParams
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  const painel = await carregarPainel()

  return (
    <main>
      <div className="flex items-center justify-between">
        <h1 className="titulo-pagina">Menu</h1>
        <Logo compacto />
      </div>
      {erro && <p className="corpo mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      <p className="rotulo text-dim mt-6 mb-2 inline-flex items-center gap-1.5">
        <Icone nome="pessoas" className="size-3.5" /> Conta
      </p>
      <Link href="/menu/perfil" className="sombra-1 flex items-center justify-between rounded-[14px] border border-line bg-panel px-4 py-3.5">
        <div>
          <p className="titulo-card">{user?.email ?? "—"}</p>
          <p className="apoio mt-0.5 text-dim">Proprietário</p>
        </div>
        <Icone nome="chevron" className="size-4 text-dim" />
      </Link>
      <Link href="/menu/assinatura" className="sombra-1 mt-2 flex items-center justify-between rounded-[14px] border border-line bg-panel px-4 py-3.5">
        <span className="inline-flex items-center gap-2.5">
          <Icone nome="cifrao" className="size-4 text-dim" />
          <span className="titulo-card">Assinatura</span>
        </span>
        <Icone nome="chevron" className="size-4 text-dim" />
      </Link>

      <p className="rotulo text-dim mt-6 mb-2 inline-flex items-center gap-1.5">
        <Icone nome="imagem" className="size-3.5" /> Aparência
      </p>
      <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4 py-3.5">
        <ThemeToggle />
        <p className="apoio mt-2 text-dim">
          O modo claro é o padrão — feito para leitura sob sol forte na marina.
        </p>
      </div>

      <p className="rotulo text-dim mt-6 mb-2 inline-flex items-center gap-1.5">
        <Icone nome="alerta" className="size-3.5" /> Alertas
      </p>
      <Link href="/notificacoes" className="sombra-1 block rounded-[14px] border border-line bg-panel px-4 py-3.5">
        <p className="titulo-card">Configurar alertas</p>
        <p className="apoio mt-0.5 text-dim">Ative os avisos por aparelho e veja o histórico</p>
      </Link>

      {painel?.papel === "PROP" && (
        <>
          <p className="rotulo text-dim mt-6 mb-2 inline-flex items-center gap-1.5">
            <Icone nome="pessoas" className="size-3.5" /> Tripulação
          </p>
          <Link href="/menu/tripulacao" className="sombra-1 block rounded-[14px] border border-line bg-panel px-4 py-3.5">
            <p className="titulo-card">Tripulação</p>
            <p className="apoio mt-0.5 text-dim">Convide comandantes e ajuste as permissões</p>
          </Link>
        </>
      )}

      <p className="rotulo text-dim mt-6 mb-2">Em breve</p>
      <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
        {["Assinatura e faturas"].map((item) => (
          <p key={item} className="corpo border-b border-line py-3 text-dim last:border-0">
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
