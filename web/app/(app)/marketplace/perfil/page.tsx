import { redirect } from "next/navigation"
import { salvarPerfilComandante } from "@/lib/acoes/perfil-comandante"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { Campo, CampoTextarea } from "@/components/ui/campo"
import { supabaseServer } from "@/lib/supabase/server"
import type { PerfilComandante } from "@/lib/db/types"

export default async function PerfilComandantePage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const { data } = await supabase
    .from("perfis_comandante").select("*").eq("usuario_id", user.id).maybeSingle()
  const p = data as PerfilComandante | null

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref="/marketplace"
        voltarRotulo="Comandantes"
        titulo="Meu perfil de comandante"
        descricao="O que o dono do barco vê quando procura um comandante para contratar."
      />
      {erro && <p className="mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 text-sm">{erro}</p>}

      <form action={salvarPerfilComandante} className="mt-5 space-y-4">
        <Campo label="Nome profissional" id="nome_publico" name="nome_publico" required defaultValue={p?.nome_publico ?? ""} />
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Habilitação" id="categoria" name="categoria" list="categorias" defaultValue={p?.categoria ?? ""} placeholder="Capitão Amador">
            <datalist id="categorias">
              <option value="Arrais Amador" /><option value="Mestre Amador" />
              <option value="Capitão Amador" /><option value="Marinheiro Profissional" />
            </datalist>
          </Campo>
          <Campo label="Cidade" id="cidade" name="cidade" defaultValue={p?.cidade ?? ""} placeholder="Rio de Janeiro" />
        </div>
        <Campo label="Disponibilidade" id="disponibilidade" name="disponibilidade" defaultValue={p?.disponibilidade ?? ""} placeholder="Fins de semana e feriados" />
        <Campo label="WhatsApp (com DDD)" id="telefone" name="telefone" inputMode="tel" defaultValue={p?.telefone ?? ""} placeholder="21 99999-0000" />
        <CampoTextarea label="Apresentação" id="bio" name="bio" rows={3} defaultValue={p?.bio ?? ""} placeholder="Experiência, embarcações que já comandou…" />
        <label className="flex items-center gap-2.5 text-sm">
          <input type="checkbox" name="visivel" defaultChecked={p?.visivel ?? true} className="size-5 accent-[#d4af37]" />
          Aparecer na lista de comandantes disponíveis
        </label>
        <button className="w-full rounded-xl bg-accent py-3.5 font-semibold text-acao-texto">Salvar perfil</button>
      </form>
    </main>
  )
}
