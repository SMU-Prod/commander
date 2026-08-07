import Link from "next/link"
import { redirect } from "next/navigation"
import { Icone } from "@/components/icone"
import { criarConvite, revogarConvite } from "@/lib/acoes/convites"
import { carregarPainel } from "@/lib/consultas"
import { supabaseServer } from "@/lib/supabase/server"
import { Confirmar } from "@/components/confirmar"
import type { Convite, Vinculo } from "@/lib/db/types"

export default async function TripulacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; criado?: string }>
}) {
  const { erro, criado } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (painel.papel !== "PROP") redirect("/menu")

  const supabase = await supabaseServer()
  const [{ data: vinculos }, { data: convites }, { data: perfis }] = await Promise.all([
    supabase.from("vinculos").select("*").eq("embarcacao_id", painel.embarcacao.id).eq("papel", "CMDT"),
    supabase.from("convites").select("*").eq("embarcacao_id", painel.embarcacao.id)
      .is("usado_em", null).gt("expira_em", new Date().toISOString()).order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, nome"),
  ])
  const nomePorId = new Map((perfis ?? []).map((p: { id: string; nome: string }) => [p.id, p.nome]))

  const linkConvite = (codigo: string) => `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3010"}/convite/${codigo}`

  return (
    <main>
      <a href="/menu" className="inline-flex items-center gap-1 rotulo text-accent-forte">
        <Icone nome="voltar" className="size-4" /> Menu
      </a>
      <h1 className="mt-3 text-xl font-semibold">Tripulação</h1>
      {erro && <p className="mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 text-sm">{erro}</p>}

      {criado && (
        <div className="mt-4 rounded-[14px] border border-ok/40 bg-panel p-4">
          <p className="text-sm font-semibold">Convite criado</p>
          <p className="mt-1 break-all font-mono-instr text-xs text-dim">{linkConvite(criado)}</p>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`Entre na tripulação da ${painel.embarcacao.nome} no Commander: ${linkConvite(criado)}`)}`}
            target="_blank" rel="noopener noreferrer"
            className="mt-3 inline-block rounded-lg border border-ok/40 px-3 py-2 text-sm text-ok"
          >
            Compartilhar no WhatsApp
          </a>
        </div>
      )}

      <p className="mt-6 mb-2 font-mono-instr text-[11px] uppercase tracking-[.16em] text-dim">Comandantes com acesso</p>
      <div className="rounded-[14px] border border-line bg-panel px-4">
        {((vinculos ?? []) as Vinculo[]).length === 0 && (
          <p className="py-4 text-sm text-dim">Ninguém além de você ainda. Crie um convite abaixo.</p>
        )}
        {((vinculos ?? []) as Vinculo[]).map((v) => (
          <Link key={v.id} href={`/menu/tripulacao/${v.id}`}
            className="flex items-center gap-3 border-b border-line py-3 last:border-0">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{nomePorId.get(v.usuario_id) || "Comandante"}</p>
              <p className="mt-0.5 text-xs text-dim">
                {v.nivel === "completo" ? "Acesso completo" : v.nivel === "operacional" ? "Acesso operacional" : "Acesso personalizado"}
              </p>
            </div>
            <Icone nome="chevron" className="size-4 text-dim" />
          </Link>
        ))}
      </div>

      <p className="mt-6 mb-2 font-mono-instr text-[11px] uppercase tracking-[.16em] text-dim">Convites pendentes</p>
      <div className="rounded-[14px] border border-line bg-panel px-4">
        {((convites ?? []) as Convite[]).length === 0 && (
          <p className="py-4 text-sm text-dim">Nenhum convite aguardando.</p>
        )}
        {((convites ?? []) as Convite[]).map((c) => (
          <div key={c.id} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
            <div className="min-w-0 flex-1">
              <p className="font-mono-instr text-sm tabular-nums">{c.codigo}</p>
              <p className="mt-0.5 text-xs text-dim">
                {c.nivel === "completo" ? "Completo" : "Operacional"} · expira {new Date(c.expira_em).toLocaleDateString("pt-BR")}
              </p>
            </div>
            <form action={revogarConvite}>
              <input type="hidden" name="convite_id" value={c.id} />
              <Confirmar mensagem="Revogar convite?" rotulo="Revogar" className="flex h-11 items-center text-xs text-crit" />
            </form>
          </div>
        ))}
      </div>

      <p className="mt-6 mb-2 font-mono-instr text-[11px] uppercase tracking-[.16em] text-dim">Novo convite</p>
      <form action={criarConvite} className="space-y-3 rounded-[14px] border border-line bg-panel p-4">
        <div>
          <label className="mb-1.5 block font-mono-instr text-[11px] uppercase tracking-[.14em] text-dim" htmlFor="nivel">
            Acesso inicial
          </label>
          <select id="nivel" name="nivel" defaultValue="operacional"
            className="w-full rounded-[10px] border border-line bg-campo px-3 py-3 text-base">
            <option value="operacional">Operacional — registra horas e serviços, sem custos e documentos</option>
            <option value="completo">Completo — vê e edita tudo</option>
          </select>
        </div>
        <p className="text-xs text-dim">Você ajusta o acesso em detalhe depois, na matriz de permissões.</p>
        <button className="w-full rounded-xl bg-accent py-3 font-semibold text-acao-texto">Criar convite</button>
      </form>
    </main>
  )
}
