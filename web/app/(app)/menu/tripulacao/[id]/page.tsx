import { notFound, redirect } from "next/navigation"
import { aplicarPreset, removerCmdt, salvarMatriz } from "@/lib/acoes/vinculos"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { carregarPainel } from "@/lib/consultas"
import { ABAS, ROTULO_ABA, normalizarPermissoes } from "@/lib/domain/permissoes"
import { supabaseServer } from "@/lib/supabase/server"
import type { Vinculo } from "@/lib/db/types"

export default async function MatrizPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ erro?: string; salvo?: string }>
}) {
  const { id } = await params
  const { erro, salvo } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (painel.papel !== "PROP") redirect("/menu")

  const supabase = await supabaseServer()
  const [{ data: vinculo }, { data: perfil }] = await Promise.all([
    supabase.from("vinculos").select("*").eq("id", id).eq("papel", "CMDT").maybeSingle(),
    supabase.from("vinculos").select("usuario_id").eq("id", id).maybeSingle()
      .then(async (r) => {
        if (!r.data) return { data: null }
        return supabase.from("profiles").select("nome").eq("id", r.data.usuario_id).maybeSingle()
      }),
  ])
  const v = vinculo as Vinculo | null
  if (!v || v.embarcacao_id !== painel.embarcacao.id) notFound()
  const permissoes = normalizarPermissoes(v.permissoes)
  const nome = (perfil as { nome: string } | null)?.nome || "Comandante"

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref="/menu/tripulacao"
        voltarRotulo="Tripulação"
        titulo={nome}
        descricao="Defina, área por área, o que este comandante vê e edita."
      />
      {erro && <p className="mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 text-sm">{erro}</p>}
      {salvo && <p className="mt-3 rounded-lg border border-ok/40 bg-panel px-3 py-2 text-sm">Permissões salvas.</p>}

      <div className="mt-4 flex gap-2">
        <form action={aplicarPreset} className="flex-1">
          <input type="hidden" name="vinculo_id" value={v.id} />
          <input type="hidden" name="preset" value="operacional" />
          <button className="w-full rounded-lg border border-line py-2 text-sm">Aplicar Operacional</button>
        </form>
        <form action={aplicarPreset} className="flex-1">
          <input type="hidden" name="vinculo_id" value={v.id} />
          <input type="hidden" name="preset" value="completo" />
          <button className="w-full rounded-lg border border-line py-2 text-sm">Aplicar Completo</button>
        </form>
      </div>

      <form action={salvarMatriz} className="mt-4">
        <input type="hidden" name="vinculo_id" value={v.id} />
        <div className="rounded-[14px] border border-line bg-panel px-4">
          <div className="flex items-center gap-3 border-b border-line py-2.5">
            <span className="flex-1 font-mono-instr text-[11px] uppercase tracking-[.14em] text-dim">Área</span>
            <span className="w-12 text-center font-mono-instr text-[11px] uppercase tracking-[.14em] text-dim">Ver</span>
            <span className="w-12 text-center font-mono-instr text-[11px] uppercase tracking-[.14em] text-dim">Editar</span>
          </div>
          {ABAS.map((aba) => (
            <div key={aba} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
              <span className="flex-1 text-sm">{ROTULO_ABA[aba]}</span>
              <span className="flex w-12 justify-center">
                <input type="checkbox" name={`${aba}_ver`} defaultChecked={permissoes[aba].ver}
                  aria-label={`Ver ${ROTULO_ABA[aba]}`} className="size-5 accent-[#d4af37]" />
              </span>
              <span className="flex w-12 justify-center">
                <input type="checkbox" name={`${aba}_editar`} defaultChecked={permissoes[aba].editar}
                  aria-label={`Editar ${ROTULO_ABA[aba]}`} className="size-5 accent-[#d4af37]" />
              </span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-dim">Marcar &quot;Editar&quot; libera &quot;Ver&quot; automaticamente ao salvar.</p>
        <button className="mt-3 w-full rounded-xl bg-accent py-3.5 font-semibold text-acao-texto">
          Salvar permissões
        </button>
      </form>

      <form action={removerCmdt} className="mt-6">
        <input type="hidden" name="vinculo_id" value={v.id} />
        <button className="w-full rounded-xl border border-crit/40 py-3 text-sm font-semibold text-crit">
          Remover da tripulação
        </button>
      </form>
    </main>
  )
}
