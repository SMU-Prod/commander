import Link from "next/link"
import { redirect } from "next/navigation"
import { Confirmar } from "@/components/confirmar"
import { Icone } from "@/components/icone"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { encerrarDisponibilidade } from "@/lib/acoes/marketplace"
import { carregarMapaTaxonomia, nomeDaRegiao, tituloDeDisponibilidade } from "@/lib/consultas-marketplace"
import { hojeISO } from "@/lib/domain/datas"
import { formatarDiaCurto } from "@/lib/domain/marketplace"
import { supabaseServer } from "@/lib/supabase/server"
import type { Disponibilidade } from "@/lib/db/types"

/**
 * §11.3 — "Ofereço / Estou disponível". O espelho da demanda de tripulação:
 * em vez de o proprietário procurar, o profissional anuncia o próprio período.
 *
 * O PRD amarra a PUBLICAÇÃO ao Captain Pro; o portão não está implementado
 * porque os planos ainda não estão fechados — ver o TODO em
 * `lib/acoes/marketplace.ts`.
 */
export default async function DisponibilidadesPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; ok?: string }>
}) {
  const { erro, ok } = await searchParams
  const supabase = await supabaseServer()
  const hoje = hojeISO()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [mapa, { data: brutas }] = await Promise.all([
    carregarMapaTaxonomia(),
    supabase
      .from("disponibilidades").select("*")
      .eq("ativo", true).gte("expira_em", hoje)
      .order("criado_em", { ascending: false }).limit(100),
  ])
  const todas = (brutas as Disponibilidade[] | null) ?? []
  const minhas = todas.filter((d) => d.autor_id === user.id)
  const outras = todas.filter((d) => d.autor_id !== user.id)

  const cartao = (d: Disponibilidade, propria: boolean) => (
    <div key={d.id} className="border-b border-line py-3.5 last:border-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="titulo-card">{tituloDeDisponibilidade(mapa, d)}</p>
          <p className="apoio mt-0.5 text-dim">
            {d.autor_nome} · {nomeDaRegiao(mapa, d.regiao_id)}
          </p>
        </div>
        {propria && (
          <form action={encerrarDisponibilidade} className="shrink-0">
            <input type="hidden" name="disponibilidade_id" value={d.id} />
            <Confirmar mensagem="Encerrar?" rotulo="Encerrar" />
          </form>
        )}
      </div>
      <p className="apoio mt-1 text-dim">
        {[
          d.experiencia_anos != null ? `${d.experiencia_anos} ano${d.experiencia_anos === 1 ? "" : "s"} de experiência` : null,
          d.porte_max_pes != null ? `até ${d.porte_max_pes} pés` : null,
          d.certificacoes,
          `no ar até ${formatarDiaCurto(d.expira_em)}`,
        ].filter(Boolean).join(" · ")}
      </p>
      {d.observacao && <p className="corpo mt-1">{d.observacao}</p>}
      {d.telefone && (
        <a
          href={`https://wa.me/55${d.telefone.replace(/\D/g, "")}`}
          target="_blank" rel="noopener noreferrer"
          className="mt-2 inline-block rounded-lg border border-ok/40 px-2.5 py-1.5 text-xs text-ok"
        >
          WhatsApp
        </a>
      )}
    </div>
  )

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref="/marketplace"
        voltarRotulo="Marketplace"
        titulo="Profissionais disponíveis"
        descricao="Quem está oferecendo período de trabalho — comandante, marinheiro, tripulação de apoio."
      />
      {erro && <p className="mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 text-sm">{erro}</p>}
      {ok && <p className="mt-3 rounded-lg border border-ok/40 bg-ok/10 px-3 py-2 text-sm">{ok}</p>}

      <Link
        href="/marketplace/disponibilidades/nova"
        className="sombra-1 mt-4 flex h-11 items-center justify-center gap-1.5 rounded-xl bg-accent px-4 text-sm font-semibold text-acao-texto"
      >
        <Icone nome="mais" className="size-4" /> Estou disponível
      </Link>

      {minhas.length > 0 && (
        <>
          <SecaoPagina icone="pessoas">Suas publicações</SecaoPagina>
          <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
            {minhas.map((d) => cartao(d, true))}
          </div>
        </>
      )}

      <SecaoPagina icone="pessoas">No ar agora</SecaoPagina>
      <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
        {outras.length === 0 ? (
          <EstadoVazio
            variant="linha"
            icone="pessoas"
            titulo="Ninguém publicou disponibilidade ainda"
            descricao="Se você trabalha a bordo, seja o primeiro."
            acao={{ href: "/marketplace/disponibilidades/nova", rotulo: "Estou disponível" }}
          />
        ) : (
          outras.map((d) => cartao(d, false))
        )}
      </div>
    </main>
  )
}
