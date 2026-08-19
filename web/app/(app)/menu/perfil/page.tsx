import { redirect } from "next/navigation"
import { Avatar } from "@/components/avatar"
import { BotaoEnviar } from "@/components/ui/botao-enviar"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { Campo } from "@/components/ui/campo"
import { salvarPerfil } from "@/lib/acoes/perfil"
import { supabaseServer } from "@/lib/supabase/server"
import { TETO_FORMULARIO } from "@/lib/ui/superficies"

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
    <main className={TETO_FORMULARIO}>
      <CabecalhoDetalhe voltarHref="/menu" voltarRotulo="Menu" titulo="Meu perfil" />
      {erro && <p className="corpo mt-3 rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      <div className="mt-6 flex items-center gap-3">
        {/* || e não ??: profiles.nome é NOT NULL e nasce vazio no cadastro */}
        <Avatar url={url} nome={perfil?.nome || "?"} tamanho="size-16" />
        <div>
          <p className="titulo-card">{perfil?.nome || "Sem nome"}</p>
          <p className="apoio text-dim">{user.email}</p>
        </div>
      </div>

      <form action={salvarPerfil} className="mt-6 space-y-3 sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
        <Campo label="Nome" id="nome" name="nome" required defaultValue={perfil?.nome ?? ""} />
        <Campo
          label="Telefone"
          id="telefone"
          name="telefone"
          inputMode="tel"
          defaultValue={perfil?.telefone ?? ""}
          placeholder="21 99999-0000"
        />
        <Campo
          label="Foto — opcional"
          id="avatar"
          name="avatar"
          type="file"
          accept="image/jpeg,image/png,image/webp"
        />
        <BotaoEnviar rotulo="Salvar perfil" />
      </form>
    </main>
  )
}
