import Link from "next/link"
import { Icone } from "@/components/icone"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { RedeNav } from "@/components/ui/rede-nav"
import { ESPECIALIDADES_PRESTADOR, ICONE_POR_ESPECIALIDADE, type EspecialidadePrestador } from "@/lib/domain/prestadores"
import { supabaseServer } from "@/lib/supabase/server"
import type { PerfilComandante } from "@/lib/db/types"

function categoriaValida(v: string | undefined): EspecialidadePrestador | null {
  return (ESPECIALIDADES_PRESTADOR as readonly string[]).includes(v ?? "") ? (v as EspecialidadePrestador) : null
}

/** Onda 39 (PRD upgrade2-master §51) — "encontrar quem resolve determinado
 *  problema". Categoria primeiro, prestador depois — diferente de
 *  /prestadores (diretório plano) e, principalmente, diferente de /explorar
 *  (mapa de LUGARES parceiros — marina/posto/pousada/restaurante). O PRD é
 *  explícito: "não deve ser confundido com Explorar" — por isso o aviso
 *  abaixo do cabeçalho, não só o RedeNav. */
export default async function ServicosPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string }>
}) {
  const { categoria: categoriaBruta } = await searchParams
  const categoria = categoriaValida(categoriaBruta)

  const supabase = await supabaseServer()
  const query = supabase.from("perfis_comandante").select("*").eq("tipo", "prestador").eq("visivel", true)
  const { data: perfis, error } = categoria
    ? await query.ilike("categoria", categoria).order("created_at")
    : await query.order("created_at")
  if (error) throw new Error("Não foi possível carregar os serviços. Recarregue a página.")

  return (
    <main>
      <h1 className="titulo-pagina">Serviços</h1>
      <p className="apoio mt-1 text-dim">
        Encontre quem resolve um problema no seu barco — motor, elétrica, casco e mais.
      </p>
      <p className="apoio mt-1 text-dim">
        Isso é diferente de <Link href="/explorar" className="text-accent-forte">Explorar</Link>, que mostra
        lugares parceiros (marina, posto, pousada) no mapa — aqui são pessoas, não lugares.
      </p>
      <RedeNav atual="servicos" className="mt-4" />

      <p className="rotulo mt-6 mb-2 text-dim">Categorias</p>
      <div className="grid grid-cols-2 gap-2.5">
        <Link
          href="/servicos"
          className={`sombra-1 flex flex-col items-center gap-1.5 rounded-[14px] border px-3 py-4 text-center ${
            categoria === null ? "border-accent bg-accent/10" : "border-line bg-panel"
          }`}
        >
          <Icone nome="pessoas" className="size-6 text-accent-forte" />
          <span className="titulo-card">Todas</span>
        </Link>
        {ESPECIALIDADES_PRESTADOR.map((c) => (
          <Link
            key={c}
            href={`/servicos?categoria=${encodeURIComponent(c)}`}
            className={`sombra-1 flex flex-col items-center gap-1.5 rounded-[14px] border px-3 py-4 text-center ${
              categoria === c ? "border-accent bg-accent/10" : "border-line bg-panel"
            }`}
          >
            <Icone nome={ICONE_POR_ESPECIALIDADE[c]} className="size-6 text-accent-forte" />
            <span className="titulo-card">{c}</span>
          </Link>
        ))}
      </div>

      <p className="rotulo mt-6 mb-2 text-dim">
        {categoria ? `Prestadores — ${categoria}` : "Todos os prestadores"}
      </p>
      <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
        {((perfis ?? []) as PerfilComandante[]).length === 0 && (
          <EstadoVazio
            variant="linha"
            icone="ferramenta"
            titulo="Ninguém cadastrado nessa categoria ainda"
            descricao="Publique o que precisa em Oportunidades — prestadores podem responder direto."
            acao={{ href: "/oportunidades/nova", rotulo: "Publicar em Oportunidades" }}
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
          </div>
        ))}
      </div>
    </main>
  )
}
