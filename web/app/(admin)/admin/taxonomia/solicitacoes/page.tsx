import Link from "next/link"
import { Icone } from "@/components/icone"
import { Campo } from "@/components/ui/campo"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { aprovarSolicitacaoTaxonomia, recusarSolicitacaoTaxonomia } from "@/lib/acoes/admin-taxonomia"
import { exigirAreaAdmin } from "@/lib/admin"
import { ROTULO_TIPO_TAXONOMIA } from "@/lib/domain/marketplace"
import { supabaseServer } from "@/lib/supabase/server"
import type { Perfil, TaxonomiaSolicitacao } from "@/lib/db/types"

/**
 * §21.2 — "Usuário pode solicitar inclusão de marca/categoria ausente; evitar
 * duplicatas livres."
 *
 * O pedido é a válvula de escape que substitui o campo de texto livre: quem
 * não acha a própria marca não inventa uma string na demanda, pede a inclusão.
 * A curadoria acontece AQUI — o admin corrige a grafia antes de aprovar, que é
 * o que impede "mercruser" de virar uma marca ao lado de "MerCruiser".
 */
export default async function AdminSolicitacoesTaxonomiaPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>
}) {
  await exigirAreaAdmin("taxonomia")
  const { ok, erro } = await searchParams

  const supabase = await supabaseServer()
  const { data: pedidosBrutos } = await supabase
    .from("taxonomia_solicitacoes").select("*").order("criado_em", { ascending: false }).limit(200)
  const pedidos = (pedidosBrutos as TaxonomiaSolicitacao[] | null) ?? []

  const ids = [...new Set(pedidos.map((p) => p.solicitante_id))]
  const { data: perfisBrutos } = ids.length
    ? await supabase.from("profiles").select("id, nome").in("id", ids)
    : { data: null }
  const nomes = new Map(((perfisBrutos as Pick<Perfil, "id" | "nome">[] | null) ?? []).map((p) => [p.id, p.nome]))

  const pendentes = pedidos.filter((p) => p.status === "pendente")
  const decididos = pedidos.filter((p) => p.status !== "pendente")

  return (
    <main>
      <Link href="/admin/taxonomia" className="rotulo inline-flex items-center gap-1 text-accent-forte">
        <Icone nome="voltar" className="size-4" /> Conteúdo padronizado
      </Link>
      <h1 className="titulo-pagina mt-3">Pedidos de inclusão</h1>
      <p className="apoio mt-1 text-dim">
        Aprovar cria o item na lista oficial. Se já existir algo equivalente, o pedido fecha apontando pro que
        existe — o objetivo é não deixar duas versões do mesmo nome nascerem.
      </p>

      {ok && <p className="corpo mt-3 rounded-lg border border-ok/40 bg-ok/10 px-3 py-2">{ok}</p>}
      {erro && <p className="corpo mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      <p className="rotulo mt-6 mb-2 text-dim">Aguardando decisão</p>
      {pendentes.length === 0 ? (
        <EstadoVazio
          icone="chat"
          titulo="Nenhum pedido pendente"
          descricao="Quando alguém não encontrar uma marca ou categoria, o pedido aparece aqui."
        />
      ) : (
        <div className="space-y-3">
          {pendentes.map((p) => (
            <div key={p.id} className="sombra-1 space-y-3 rounded-[14px] border border-line bg-panel p-4">
              <div>
                <p className="corpo font-medium">{p.nome}</p>
                <p className="apoio text-dim">
                  {ROTULO_TIPO_TAXONOMIA[p.tipo]} · pedido por {nomes.get(p.solicitante_id) ?? "usuário removido"}
                </p>
                {p.observacao && <p className="apoio mt-1 text-dim">“{p.observacao}”</p>}
              </div>

              <form action={aprovarSolicitacaoTaxonomia} className="space-y-2">
                <input type="hidden" name="id" value={p.id} />
                <Campo
                  label="Nome que vai entrar na lista"
                  id={`nome_${p.id}`}
                  name="nome"
                  defaultValue={p.nome}
                  dica="Corrija a grafia antes de aprovar — é aqui que a duplicata é evitada."
                />
                <button className="w-full rounded-xl bg-accent py-2.5 font-semibold text-acao-texto">Aprovar e criar</button>
              </form>

              <form action={recusarSolicitacaoTaxonomia} className="space-y-2">
                <input type="hidden" name="id" value={p.id} />
                <Campo label="Motivo da recusa (opcional)" id={`motivo_${p.id}`} name="motivo" />
                <button className="w-full rounded-xl border border-line bg-panel2 py-2.5 font-semibold">Recusar</button>
              </form>
            </div>
          ))}
        </div>
      )}

      {decididos.length > 0 && (
        <>
          <p className="rotulo mt-8 mb-2 text-dim">Já decididos</p>
          <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
            {decididos.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-0">
                <div className="min-w-0">
                  <p className="corpo truncate">{p.nome}</p>
                  <p className="apoio text-dim">{ROTULO_TIPO_TAXONOMIA[p.tipo]}</p>
                </div>
                <p className={`apoio shrink-0 ${p.status === "aprovada" ? "text-ok" : "text-dim"}`}>
                  {p.status === "aprovada" ? "Aprovado" : "Recusado"}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  )
}
