import Link from "next/link"
import { Icone } from "@/components/icone"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { RedeNav } from "@/components/ui/rede-nav"
import { ESPECIALIDADES_PRESTADOR, ICONE_POR_ESPECIALIDADE, type EspecialidadePrestador } from "@/lib/domain/prestadores"
import { supabaseServer } from "@/lib/supabase/server"
import type { PerfilComandante } from "@/lib/db/types"

/** Onda 39 (PRD upgrade2-master §50) — vitrine de Prestadores: mecânico,
 *  eletricista, fibra, estofamento, eletrônica, hidráulica e outros
 *  serviços náuticos. Reaproveita `perfis_comandante` com `tipo='prestador'`
 *  (migration 037) — mesma tabela/RLS/trigger anti-autoverificação de
 *  Comandantes (§47), não uma arquitetura nova.
 *
 *  ONDA 46 — ESTA TELA ABSORVEU A ABA "SERVIÇOS". O PRD FINAL manda eliminar
 *  Serviços (§10, e de novo como critério de aceite em §27.2: "Nenhum menu
 *  principal deve usar a antiga aba 'Serviços'"), e o dono autorizou em
 *  15/08/2026. Até a onda 45 existiam DUAS telas lendo exatamente a mesma
 *  consulta: `/prestadores` (diretório plano) e `/servicos` (a mesma lista,
 *  filtrada por categoria). A única coisa que `/servicos` fazia a mais era o
 *  filtro por especialidade — então ele veio pra cá em vez de ser perdido, e
 *  `/servicos?categoria=X` redireciona pra `/prestadores?categoria=X`
 *  preservando o filtro (`app/(app)/servicos/page.tsx`).
 *
 *  Por que aqui e não em `/explorar`, que é o destino que o §10 cita: Explorar
 *  é o mapa de LUGARES parceiros (marina, posto, pousada, restaurante) e
 *  prestador é PESSOA, não lugar — não tem ponto no mapa. A consolidação
 *  completa de §10 ("Explorar Parceiros" com cards de Partner por tipo,
 *  §13) é um módulo que ainda não existe (ver
 *  docs/auditoria/2026-08-15-prd-final-vs-codigo.md §3); o que o critério de
 *  aceite cobra HOJE é que a aba Serviços não exista, e ela não existe mais.
 *  A outra função de `/servicos` — publicar o que você precisa — foi pro
 *  Marketplace, que é onde o PRD põe demanda. */
function categoriaValida(v: string | undefined): EspecialidadePrestador | null {
  return (ESPECIALIDADES_PRESTADOR as readonly string[]).includes(v ?? "") ? (v as EspecialidadePrestador) : null
}

export default async function PrestadoresPage({
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
  if (error) throw new Error("Não foi possível carregar os prestadores. Recarregue a página.")

  const lista = (perfis ?? []) as PerfilComandante[]

  return (
    <main>
      <h1 className="titulo-pagina">Prestadores</h1>
      <p className="apoio mt-1 text-dim">
        Mecânico, eletricista, fibra e outros profissionais náuticos disponíveis para contratar direto pelo WhatsApp.
      </p>
      <p className="apoio mt-1 text-dim">
        São PESSOAS. Marinas, postos, pousadas e restaurantes ficam em{" "}
        <Link href="/explorar" className="text-accent-forte">Explorar</Link>, no mapa.
      </p>
      <RedeNav atual="prestadores" className="mt-4" />

      {/* Vindo da antiga aba Serviços (onda 46): achar quem resolve um
          problema começando pela categoria, não pelo nome de quem atende. */}
      <p className="rotulo mt-6 mb-2 text-dim">Por especialidade</p>
      <div className="grid grid-cols-2 gap-2.5">
        <Link
          href="/prestadores"
          aria-current={categoria === null ? "page" : undefined}
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
            href={`/prestadores?categoria=${encodeURIComponent(c)}`}
            aria-current={categoria === c ? "page" : undefined}
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
        {lista.length === 0 && (
          <EstadoVazio
            variant="linha"
            icone="ferramenta"
            titulo={categoria ? "Ninguém cadastrado nessa especialidade ainda" : "Ainda não há prestadores cadastrados na sua região"}
            descricao="Publique o que precisa no Marketplace — quem atende sua região responde direto."
            acao={{ href: "/marketplace/nova", rotulo: "Publicar no Marketplace" }}
          />
        )}
        {lista.map((p) => (
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

      <Link href="/prestadores/perfil" className="mt-6 inline-flex items-center gap-1 apoio text-dim">
        <Icone nome="ferramenta" className="size-3.5" /> É prestador de serviço? Toque aqui para criar seu perfil.
      </Link>
    </main>
  )
}
