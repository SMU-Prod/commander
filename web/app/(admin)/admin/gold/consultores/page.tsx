import Link from "next/link"
import { Icone } from "@/components/icone"
import { Campo } from "@/components/ui/campo"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { atualizarConsultor, criarConsultor } from "@/lib/acoes/gold-admin"
import { exigirAreaAdmin } from "@/lib/admin"
import { supabaseServer } from "@/lib/supabase/server"
import type { GoldConsultor } from "@/lib/db/types"

/** Admin > Consultores (Correção 19) — cadastro mínimo. O vínculo com o
 *  login do consultor é dele mesmo (`gold_reivindicar_consultor`, migration
 *  035) — o admin só cadastra nome/contato/e-mail. */
export default async function AdminConsultoresGoldPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>
}) {
  await exigirAreaAdmin("gold")
  const { ok, erro } = await searchParams
  const supabase = await supabaseServer()
  const { data } = await supabase.from("gold_consultores").select("*").order("criado_em", { ascending: false })
  const consultores = (data as GoldConsultor[] | null) ?? []

  return (
    <main>
      <Link href="/admin/gold" className="inline-flex items-center gap-1 rotulo text-accent-forte">
        <Icone nome="voltar" className="size-4" /> Commander Gold
      </Link>
      <h1 className="titulo-pagina mt-3">Consultores</h1>
      <p className="apoio mt-1 text-dim">
        Cadastre com o e-mail que o consultor usa pra entrar no Commander — o acesso à agenda dele
        vincula sozinho no primeiro login.
      </p>

      {ok && <p className="corpo mt-3 rounded-lg border border-ok/40 bg-ok/10 px-3 py-2">{ok}</p>}
      {erro && <p className="corpo mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      <p className="rotulo mt-6 mb-2 text-dim">Novo consultor</p>
      <form action={criarConsultor} className="sombra-1 space-y-3 rounded-[14px] border border-line bg-panel p-4">
        <Campo label="Nome" id="nome" name="nome" required />
        <Campo label="E-mail (o mesmo do login no Commander)" id="email" name="email" type="email" />
        <Campo label="Telefone" id="telefone" name="telefone" />
        <Campo label="Região de atuação" id="regiao" name="regiao" placeholder="Ilhabela, Rio de Janeiro..." />
        <button className="w-full rounded-xl bg-accent py-3 font-semibold text-acao-texto">Cadastrar consultor</button>
      </form>

      <p className="rotulo mt-6 mb-2 text-dim">Consultores cadastrados</p>
      {consultores.length === 0 ? (
        <EstadoVazio icone="pessoas" titulo="Nenhum consultor cadastrado ainda" />
      ) : (
        <div className="space-y-3">
          {consultores.map((c) => (
            <form key={c.id} action={atualizarConsultor} className="sombra-1 space-y-2 rounded-[14px] border border-line bg-panel p-4">
              <input type="hidden" name="id" value={c.id} />
              <div className="flex items-center justify-between gap-2">
                <p className="corpo font-medium">{c.nome}</p>
                <label className="apoio inline-flex items-center gap-1.5 text-dim">
                  <input type="checkbox" name="ativo" defaultChecked={c.ativo} className="size-4 accent-[var(--acao)]" /> Ativo
                </label>
              </div>
              {!c.usuario_id && <p className="apoio text-dim">Ainda não fez login — acesso pendente de vínculo.</p>}
              <input type="hidden" name="nome" value={c.nome} />
              <div className="grid grid-cols-2 gap-2">
                <Campo label="E-mail" id={`email_${c.id}`} name="email" type="email" defaultValue={c.email ?? ""} />
                <Campo label="Telefone" id={`telefone_${c.id}`} name="telefone" defaultValue={c.telefone ?? ""} />
              </div>
              <Campo label="Região" id={`regiao_${c.id}`} name="regiao" defaultValue={c.regiao ?? ""} />
              <button className="w-full rounded-xl border border-line bg-panel2 py-2.5 font-semibold">Salvar</button>
            </form>
          ))}
        </div>
      )}
    </main>
  )
}
