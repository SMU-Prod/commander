import Link from "next/link"
import { redirect } from "next/navigation"
import { Icone } from "@/components/icone"
import { avaliarContato, criarContato, excluirContato } from "@/lib/acoes/contatos"
import { carregarPainel } from "@/lib/consultas"
import { podeVer } from "@/lib/domain/permissoes"
import { supabaseServer } from "@/lib/supabase/server"
import { Confirmar } from "@/components/confirmar"
import type { Contato } from "@/lib/db/types"

const campo = "w-full rounded-[10px] border border-line bg-campo px-3 py-3 text-base"
const rotulo = "mb-1.5 block font-mono-instr text-[11px] uppercase tracking-[.14em] text-dim"

export default async function ContatosPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (!podeVer(painel.permissoes, "contatos")) redirect("/hoje?erro=" + encodeURIComponent("Seu acesso não inclui os contatos."))
  const supabase = await supabaseServer()
  const [{ data: contatos }, { data: eventos }] = await Promise.all([
    supabase.from("contatos").select("*").eq("embarcacao_id", painel.embarcacao.id).order("nome"),
    supabase.from("eventos").select("contato_id").eq("embarcacao_id", painel.embarcacao.id).not("contato_id", "is", null),
  ])
  const servicos = new Map<string, number>()
  for (const e of eventos ?? []) {
    if (e.contato_id) servicos.set(e.contato_id, (servicos.get(e.contato_id) ?? 0) + 1)
  }

  return (
    <main>
      <Link href="/barco" className="inline-flex items-center gap-1 rotulo text-accent-forte">
        <Icone nome="voltar" className="size-4" /> Barco
      </Link>
      <h1 className="titulo-pagina mt-3">Contatos</h1>
      {erro && <p className="mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 corpo">{erro}</p>}

      <div className="sombra-1 mt-5 rounded-[14px] border border-line bg-panel px-4">
        {(contatos ?? []).length === 0 && (
          <p className="corpo py-4 text-dim">Salve aqui o mecânico, o eletricista e todo mundo que cuida do barco.</p>
        )}
        {((contatos ?? []) as Contato[]).map((c) => (
          <div key={c.id} className="border-b border-line py-3 last:border-0">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="titulo-card">{c.nome}</p>
                <p className="apoio mt-0.5 text-dim">
                  {[c.especialidade, c.telefone, `${servicos.get(c.id) ?? 0} serviços neste barco`]
                    .filter(Boolean).join(" · ")}
                </p>
              </div>
              {c.telefone && (
                <a href={`https://wa.me/55${c.telefone.replace(/\D/g, "")}`} target="_blank"
                  className="rounded-lg border border-ok/40 px-2.5 py-1.5 text-xs text-ok">WhatsApp</a>
              )}
              <form action={excluirContato}>
                <input type="hidden" name="contato_id" value={c.id} />
                <Confirmar mensagem="Excluir contato?" rotulo="Excluir" className="flex h-11 items-center text-xs text-crit" />
              </form>
            </div>
            <form action={avaliarContato} className="mt-2 flex items-center gap-1" aria-label={`Avaliar ${c.nome}`}>
              <input type="hidden" name="contato_id" value={c.id} />
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} name="avaliacao" value={n} aria-label={`${n} estrelas`}
                  className={`flex size-11 items-center justify-center ${c.avaliacao != null && n <= c.avaliacao ? "text-warn" : "text-line"}`}>
                  <Icone nome="estrela" className="size-5" />
                </button>
              ))}
            </form>
          </div>
        ))}
      </div>

      <p className="rotulo text-dim mt-6 mb-2">Novo contato</p>
      <form action={criarContato} className="sombra-1 space-y-3 rounded-[14px] border border-line bg-panel p-4">
        <div>
          <label className={rotulo} htmlFor="nome">Nome</label>
          <input id="nome" name="nome" required className={campo} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={rotulo} htmlFor="especialidade">Especialidade</label>
            <input id="especialidade" name="especialidade" placeholder="Mecânica diesel" className={campo} />
          </div>
          <div>
            <label className={rotulo} htmlFor="telefone">Telefone (com DDD)</label>
            <input id="telefone" name="telefone" inputMode="tel" placeholder="21 99999-0000" className={campo} />
          </div>
        </div>
        <button className="w-full rounded-xl bg-accent py-3 font-semibold text-acao-texto">Salvar contato</button>
      </form>
    </main>
  )
}
