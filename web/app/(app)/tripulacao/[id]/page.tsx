import { notFound, redirect } from "next/navigation"
import { aplicarPreset, removerCmdt, salvarMatriz } from "@/lib/acoes/vinculos"
import { BotaoEnviar } from "@/components/ui/botao-enviar"
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
        voltarHref="/tripulacao"
        voltarRotulo="Tripulação"
        titulo={nome}
        descricao="Defina, área por área, o que este comandante vê e edita."
      />
      {erro && <p className="corpo mt-3 rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}
      {salvo && <p className="corpo mt-3 rounded-[var(--raio-controle)] border border-ok/40 bg-panel px-3 py-2">Permissões salvas.</p>}

      {/* Os dois atalhos de preset tinham 39px — 5px abaixo da régua — e
          reescreviam à mão a pílula de contorno que `BotaoEnviar` já
          desenha. `larguraCheia` porque cada um divide a linha ao meio. */}
      <div className="mt-4 flex gap-2">
        <form action={aplicarPreset} className="flex-1">
          <input type="hidden" name="vinculo_id" value={v.id} />
          <input type="hidden" name="preset" value="operacional" />
          <BotaoEnviar rotulo="Aplicar Operacional" variante="contorno" larguraCheia />
        </form>
        <form action={aplicarPreset} className="flex-1">
          <input type="hidden" name="vinculo_id" value={v.id} />
          <input type="hidden" name="preset" value="completo" />
          <BotaoEnviar rotulo="Aplicar Completo" variante="contorno" larguraCheia />
        </form>
      </div>

      <form action={salvarMatriz} className="mt-4">
        <input type="hidden" name="vinculo_id" value={v.id} />
        <div className="rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
          {/* `.rotulo` no lugar de `text-[11px] uppercase tracking-[.14em]`:
              é o MESMO desenho escrito à mão, e `.14em` era mais um dos onze
              trackings que a auditoria contou pro mesmo gesto (achado 5.12). */}
          <div className="flex items-center gap-3 border-b border-line py-2">
            <span className="rotulo flex-1 text-dim">Área</span>
            <span className="rotulo w-12 text-center text-dim">Ver</span>
            <span className="rotulo w-12 text-center text-dim">Editar</span>
          </div>
          {ABAS.map((aba) => (
            <div key={aba} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
              <span className="corpo flex-1">{ROTULO_ABA[aba]}</span>
              <span className="flex w-12 justify-center">
                <input type="checkbox" name={`${aba}_ver`} defaultChecked={permissoes[aba].ver}
                  aria-label={`Ver ${ROTULO_ABA[aba]}`} className="size-5 accent-[var(--acao)]" />
              </span>
              <span className="flex w-12 justify-center">
                <input type="checkbox" name={`${aba}_editar`} defaultChecked={permissoes[aba].editar}
                  aria-label={`Editar ${ROTULO_ABA[aba]}`} className="size-5 accent-[var(--acao)]" />
              </span>
            </div>
          ))}
        </div>
        <p className="apoio mt-2 text-dim">Marcar &quot;Editar&quot; libera &quot;Ver&quot; automaticamente ao salvar.</p>
        <BotaoEnviar rotulo="Salvar permissões" className="mt-3" />
      </form>

      <form action={removerCmdt} className="mt-6">
        <input type="hidden" name="vinculo_id" value={v.id} />
        <button className="w-full rounded-[var(--raio-controle)] border border-crit/40 py-3 text-sm font-semibold text-crit">
          Remover da tripulação
        </button>
      </form>
    </main>
  )
}
