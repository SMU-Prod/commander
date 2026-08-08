import Link from "next/link"
import { redirect } from "next/navigation"
import { Icone } from "@/components/icone"
import { salvarPerfilComandante } from "@/lib/acoes/perfil-comandante"
import { supabaseServer } from "@/lib/supabase/server"
import type { PerfilComandante } from "@/lib/db/types"

const campo = "w-full rounded-[10px] border border-line bg-campo px-3 py-3 text-base"
const rotulo = "mb-1.5 block font-mono-instr text-[11px] uppercase tracking-[.14em] text-dim"

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
      <Link href="/marketplace" className="inline-flex items-center gap-1 rotulo text-accent-forte">
        <Icone nome="voltar" className="size-4" /> Comandantes
      </Link>
      <h1 className="mt-3 text-xl font-semibold">Meu perfil de comandante</h1>
      <p className="mt-1 text-sm text-dim">O que os proprietários da plataforma veem sobre você.</p>
      {erro && <p className="mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 text-sm">{erro}</p>}

      <form action={salvarPerfilComandante} className="mt-5 space-y-4">
        <div>
          <label className={rotulo} htmlFor="nome_publico">Nome profissional</label>
          <input id="nome_publico" name="nome_publico" required defaultValue={p?.nome_publico ?? ""} className={campo} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={rotulo} htmlFor="categoria">Habilitação</label>
            <input id="categoria" name="categoria" list="categorias" defaultValue={p?.categoria ?? ""} placeholder="Capitão Amador" className={campo} />
            <datalist id="categorias">
              <option value="Arrais Amador" /><option value="Mestre Amador" />
              <option value="Capitão Amador" /><option value="Marinheiro Profissional" />
            </datalist>
          </div>
          <div>
            <label className={rotulo} htmlFor="cidade">Cidade</label>
            <input id="cidade" name="cidade" defaultValue={p?.cidade ?? ""} placeholder="Rio de Janeiro" className={campo} />
          </div>
        </div>
        <div>
          <label className={rotulo} htmlFor="disponibilidade">Disponibilidade</label>
          <input id="disponibilidade" name="disponibilidade" defaultValue={p?.disponibilidade ?? ""} placeholder="Fins de semana e feriados" className={campo} />
        </div>
        <div>
          <label className={rotulo} htmlFor="telefone">WhatsApp (com DDD)</label>
          <input id="telefone" name="telefone" inputMode="tel" defaultValue={p?.telefone ?? ""} placeholder="21 99999-0000" className={campo} />
        </div>
        <div>
          <label className={rotulo} htmlFor="bio">Apresentação</label>
          <textarea id="bio" name="bio" rows={3} defaultValue={p?.bio ?? ""} placeholder="Experiência, embarcações que já comandou…" className={campo} />
        </div>
        <label className="flex items-center gap-2.5 text-sm">
          <input type="checkbox" name="visivel" defaultChecked={p?.visivel ?? true} className="size-5 accent-[#d4af37]" />
          Aparecer na lista de comandantes disponíveis
        </label>
        <button className="w-full rounded-xl bg-accent py-3.5 font-semibold text-acao-texto">Salvar perfil</button>
      </form>
    </main>
  )
}
