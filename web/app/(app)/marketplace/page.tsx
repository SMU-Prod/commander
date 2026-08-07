import Link from "next/link"
import { supabaseServer } from "@/lib/supabase/server"
import type { PerfilComandante } from "@/lib/db/types"

export default async function MarketplacePage() {
  const supabase = await supabaseServer()
  const { data: perfis, error } = await supabase
    .from("perfis_comandante").select("*").eq("visivel", true).order("created_at")
  if (error) throw new Error("Não foi possível carregar o marketplace. Recarregue a página.")

  return (
    <main>
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Marketplace</h1>
        <Link href="/marketplace/perfil" className="text-sm text-accent-forte">Sou comandante</Link>
      </div>
      <p className="mt-1 text-sm text-dim">Comandantes disponíveis para contratar direto pelo WhatsApp.</p>

      <div className="mt-5 rounded-[14px] border border-line bg-panel px-4">
        {((perfis ?? []) as PerfilComandante[]).length === 0 && (
          <p className="py-5 text-sm text-dim">
            Nenhum comandante na vitrine ainda. É comandante? Toque em &quot;Sou comandante&quot; e crie seu perfil.
          </p>
        )}
        {((perfis ?? []) as PerfilComandante[]).map((p) => (
          <div key={p.usuario_id} className="border-b border-line py-3.5 last:border-0">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-line bg-panel2 font-mono-instr text-sm text-accent-forte">
                {p.nome_publico.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{p.nome_publico}</p>
                <p className="mt-0.5 text-xs text-dim">
                  {[p.categoria, p.cidade, p.disponibilidade].filter(Boolean).join(" · ")}
                </p>
              </div>
              {p.telefone && (
                <a href={`https://wa.me/55${p.telefone.replace(/\D/g, "")}`}
                  target="_blank" rel="noopener noreferrer"
                  className="rounded-lg border border-ok/40 px-2.5 py-1.5 text-xs text-ok">
                  WhatsApp
                </a>
              )}
            </div>
            {p.bio && <p className="mt-2 text-xs text-dim">{p.bio}</p>}
            <span className="mt-2 inline-block rounded border border-line px-1.5 py-0.5 font-mono-instr text-[10.5px] uppercase tracking-[.1em] text-dim">
              {p.verificado ? "Verificado" : "Documentação declarada"}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-dim">
        O selo &quot;Verificado&quot; será emitido quando a validação documental entrar em operação.
        Até lá, os dados são declarados pelo próprio profissional e a contratação é combinada
        diretamente entre as partes.
      </p>
    </main>
  )
}
