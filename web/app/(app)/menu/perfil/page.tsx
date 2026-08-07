import Link from "next/link"
import { redirect } from "next/navigation"
import { Avatar } from "@/components/avatar"
import { Icone } from "@/components/icone"
import { salvarPerfil } from "@/lib/acoes/perfil"
import { supabaseServer } from "@/lib/supabase/server"

const campo = "w-full rounded-[10px] border border-line bg-campo px-3 py-3 text-base"
const rot = "rotulo mb-1.5 block text-dim"

export default async function PerfilPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const { data: perfil } = await supabase
    .from("profiles").select("nome, telefone, avatar_path").eq("id", user.id).maybeSingle()
  const url = perfil?.avatar_path
    ? (await supabase.storage.from("acervo").createSignedUrl(perfil.avatar_path, 3600)).data?.signedUrl ?? null
    : null

  return (
    <main>
      <Link href="/menu" className="inline-flex items-center gap-1 rotulo text-accent-forte">
        <Icone nome="voltar" className="size-4" /> Menu
      </Link>
      <h1 className="titulo-pagina mt-3">Meu perfil</h1>
      {erro && <p className="corpo mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      <div className="mt-5 flex items-center gap-3">
        <Avatar url={url} nome={perfil?.nome ?? "?"} tamanho="size-16" />
        <div>
          <p className="titulo-card">{perfil?.nome ?? "Sem nome"}</p>
          <p className="apoio text-dim">{user.email}</p>
        </div>
      </div>

      <form action={salvarPerfil} className="mt-5 space-y-3 sombra-1 rounded-[14px] border border-line bg-panel p-4">
        <div>
          <label className={rot} htmlFor="nome">Nome</label>
          <input id="nome" name="nome" required defaultValue={perfil?.nome ?? ""} className={campo} />
        </div>
        <div>
          <label className={rot} htmlFor="telefone">Telefone</label>
          <input id="telefone" name="telefone" inputMode="tel" defaultValue={perfil?.telefone ?? ""}
            placeholder="21 99999-0000" className={campo} />
        </div>
        <div>
          <label className={rot} htmlFor="avatar">Foto — opcional</label>
          <input id="avatar" name="avatar" type="file" accept="image/jpeg,image/png,image/webp"
            className={`${campo} py-2.5 corpo`} />
        </div>
        <button className="w-full rounded-xl bg-accent py-3 font-semibold text-acao-texto">Salvar perfil</button>
      </form>
    </main>
  )
}
