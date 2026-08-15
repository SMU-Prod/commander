import Link from "next/link"
import { Icone } from "@/components/icone"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { RedeNav } from "@/components/ui/rede-nav"
import { supabaseServer } from "@/lib/supabase/server"
import type { PerfilComandante } from "@/lib/db/types"

// Onda 39 — renomeada de /marketplace pra /comandantes (a URL não tinha
// acompanhado o rótulo do bottom-nav, já trocado numa auditoria de
// usabilidade anterior). Ver docs/CONTRIBUTING.md, Glossário: "Comandantes" é
// o nome final desta VITRINE DE PERFIS, e ela nunca volta a se chamar
// Marketplace — esse nome é da área de DEMANDAS (/marketplace, onda 45).
export default async function ComandantesPage() {
  const supabase = await supabaseServer()
  const { data: perfis, error } = await supabase
    .from("perfis_comandante").select("*").eq("tipo", "comandante").eq("visivel", true).order("created_at")
  if (error) throw new Error("Não foi possível carregar os comandantes. Recarregue a página.")

  return (
    <main>
      <h1 className="titulo-pagina">Comandantes</h1>
      <p className="apoio mt-1 text-dim">Comandantes disponíveis para contratar direto pelo WhatsApp.</p>
      <RedeNav atual="comandantes" className="mt-4" />

      <div className="sombra-1 mt-4 rounded-[14px] border border-line bg-panel px-4">
        {((perfis ?? []) as PerfilComandante[]).length === 0 && (
          <EstadoVazio
            variant="linha"
            icone="pessoas"
            titulo="Ainda não há comandantes cadastrados na sua região"
            descricao="Assim que houver, eles aparecem aqui."
          />
        )}
        {((perfis ?? []) as PerfilComandante[]).map((p) => (
          <div key={p.usuario_id} className="border-b border-line py-3.5 last:border-0">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-line bg-panel2 font-mono-instr text-sm text-accent-forte">
                {p.nome_publico.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="titulo-card">{p.nome_publico}</p>
                <p className="apoio mt-0.5 text-dim">
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
            {p.bio && <p className="apoio mt-2 text-dim">{p.bio}</p>}
            <span className="mt-2 inline-block rounded border border-line px-1.5 py-0.5 font-mono-instr text-[11px] uppercase tracking-[.1em] text-dim">
              {p.verificado ? "Verificado" : "Documentação declarada"}
            </span>
          </div>
        ))}
      </div>

      <p className="apoio mt-4 leading-relaxed text-dim">
        O selo &quot;Verificado&quot; será emitido quando a validação documental entrar em operação.
        Até lá, os dados são declarados pelo próprio profissional e a contratação é combinada
        diretamente entre as partes.
      </p>

      <Link href="/comandantes/perfil" className="mt-6 inline-flex items-center gap-1 apoio text-dim">
        <Icone nome="pessoas" className="size-3.5" /> É comandante? Toque aqui para criar seu perfil.
      </Link>
    </main>
  )
}
