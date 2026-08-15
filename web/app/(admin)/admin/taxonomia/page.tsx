import Link from "next/link"
import { Icone } from "@/components/icone"
import { Chip, ChipLinha } from "@/components/ui/chip"
import { Campo } from "@/components/ui/campo"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { atualizarItemTaxonomia, criarItemTaxonomia } from "@/lib/acoes/admin-taxonomia"
import { exigirAreaAdmin } from "@/lib/admin"
import { ROTULO_TIPO_TAXONOMIA, TIPOS_TAXONOMIA, type TipoTaxonomia } from "@/lib/domain/marketplace"
import { supabaseServer } from "@/lib/supabase/server"
import type { ItemTaxonomiaDb, TaxonomiaSolicitacao } from "@/lib/db/types"

/**
 * §21.2 — "Admin controla categorias de serviço/produto, marcas, regiões,
 * funções profissionais, tipos de Partner e demais taxonomias."
 *
 * As tabelas são da onda 45 (migration 046); esta é a tela que faltava.
 * Lê os itens INATIVOS também (a lista pública filtra `ativo`, aqui não) —
 * desativar um item é a forma de aposentá-lo sem quebrar o que já aponta
 * pra ele, e o admin precisa enxergar o que aposentou.
 */
export default async function AdminTaxonomiaPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string; tipo?: string }>
}) {
  await exigirAreaAdmin("taxonomia")
  const { ok, erro, tipo: tipoBruto } = await searchParams
  const tipoAtivo = (TIPOS_TAXONOMIA.find((t) => t === tipoBruto) ?? "regiao") as TipoTaxonomia

  const supabase = await supabaseServer()
  const [{ data: itensBrutos }, { data: pedidosBrutos }] = await Promise.all([
    supabase.from("taxonomia").select("*").eq("tipo", tipoAtivo).order("ordem").order("nome"),
    supabase.from("taxonomia_solicitacoes").select("id").eq("status", "pendente"),
  ])
  const itens = (itensBrutos as ItemTaxonomiaDb[] | null) ?? []
  const pendentes = ((pedidosBrutos as Pick<TaxonomiaSolicitacao, "id">[] | null) ?? []).length

  return (
    <main>
      <Link href="/admin" className="rotulo inline-flex items-center gap-1 text-accent-forte">
        <Icone nome="voltar" className="size-4" /> Admin Commander
      </Link>
      <h1 className="titulo-pagina mt-3">Conteúdo padronizado</h1>
      <p className="apoio mt-1 text-dim">
        O vocabulário do produto. Marketplace, Explorar e os cadastros escolhem daqui — por isso não há campo de
        texto livre neles, e por isso um item errado aqui aparece errado em todo lugar.
      </p>

      <Link
        href="/admin/taxonomia/solicitacoes"
        className="sombra-1 mt-4 flex items-center gap-3 rounded-[14px] border border-line bg-panel px-4 py-3"
      >
        <Icone nome="chat" className="size-5 shrink-0 text-accent-forte" />
        <span className="min-w-0 flex-1">
          <span className="corpo block font-medium">Pedidos de inclusão</span>
          <span className="apoio block text-dim">
            {pendentes === 0 ? "Nenhum pedido pendente" : `${pendentes} pedido${pendentes > 1 ? "s" : ""} aguardando decisão`}
          </span>
        </span>
        <Icone nome="chevron" className="size-4 shrink-0 text-dim" />
      </Link>

      {ok && <p className="corpo mt-3 rounded-lg border border-ok/40 bg-ok/10 px-3 py-2">{ok}</p>}
      {erro && <p className="corpo mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      <ChipLinha quebra className="mt-5">
        {TIPOS_TAXONOMIA.map((t) => (
          <Chip key={t} href={`/admin/taxonomia?tipo=${t}`} ativo={t === tipoAtivo}>
            {ROTULO_TIPO_TAXONOMIA[t]}
          </Chip>
        ))}
      </ChipLinha>

      <p className="rotulo mt-6 mb-2 text-dim">Novo item em {ROTULO_TIPO_TAXONOMIA[tipoAtivo]}</p>
      <form action={criarItemTaxonomia} className="sombra-1 space-y-3 rounded-[14px] border border-line bg-panel p-4">
        <input type="hidden" name="tipo" value={tipoAtivo} />
        <Campo label="Nome" id="nome" name="nome" required placeholder="Como aparece para quem escolhe" />
        {tipoAtivo === "regiao" && (
          <Campo label="UF" id="uf" name="uf" maxLength={2} placeholder="RJ" className="uppercase" />
        )}
        <Campo
          label="Ordem"
          id="ordem"
          name="ordem"
          type="number"
          defaultValue={0}
          dica="Menor aparece primeiro. Empate desempata pelo nome."
        />
        <button className="w-full rounded-xl bg-accent py-3 font-semibold text-acao-texto">Criar item</button>
      </form>

      <p className="rotulo mt-8 mb-2 text-dim">
        {ROTULO_TIPO_TAXONOMIA[tipoAtivo]} · {itens.length} item{itens.length === 1 ? "" : "s"}
      </p>
      {itens.length === 0 ? (
        <EstadoVazio icone="guardado" titulo="Nada cadastrado neste tipo" descricao="Crie o primeiro item no formulário acima." />
      ) : (
        <div className="space-y-2">
          {itens.map((i) => (
            <form key={i.id} action={atualizarItemTaxonomia} className="sombra-1 space-y-2 rounded-[14px] border border-line bg-panel p-4">
              <input type="hidden" name="id" value={i.id} />
              <div className="flex items-center justify-between gap-2">
                <p className="apoio min-w-0 flex-1 truncate text-dim">
                  <code>{i.slug}</code>
                  {i.uf ? ` · ${i.uf}` : ""}
                </p>
                <label className="apoio inline-flex shrink-0 items-center gap-1.5 text-dim">
                  <input type="checkbox" name="ativo" defaultChecked={i.ativo} className="size-4 accent-[var(--acao)]" /> Ativo
                </label>
              </div>
              <div className="grid grid-cols-[1fr_5rem] gap-2">
                <Campo label="Nome" id={`nome_${i.id}`} name="nome" defaultValue={i.nome} required />
                <Campo label="Ordem" id={`ordem_${i.id}`} name="ordem" type="number" defaultValue={i.ordem} />
              </div>
              <button className="w-full rounded-xl border border-line bg-panel2 py-2.5 font-semibold">Salvar</button>
            </form>
          ))}
        </div>
      )}

      <p className="apoio mt-4 text-dim">
        O identificador (<code>slug</code>) não muda ao renomear: tudo que já foi publicado aponta pra ele. Corrigir
        a grafia é seguro; o que estava associado continua associado.
      </p>
    </main>
  )
}
