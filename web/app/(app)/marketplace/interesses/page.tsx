import { redirect } from "next/navigation"
import { Confirmar } from "@/components/confirmar"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { Campo, CampoSelect, CampoTextarea } from "@/components/ui/campo"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { removerInteresse, salvarInteresse, solicitarTaxonomia } from "@/lib/acoes/marketplace"
import { carregarTaxonomia, itensDoTipo, nomeDaRegiao } from "@/lib/consultas-marketplace"
import {
  ROTULO_TIPO_DEMANDA,
  ROTULO_TIPO_TAXONOMIA,
  TIPOS_DEMANDA,
  TIPOS_TAXONOMIA,
} from "@/lib/domain/marketplace"
import { supabaseServer } from "@/lib/supabase/server"
import type { InteresseMarketplace } from "@/lib/db/types"

/**
 * §11.4 — "Parceiro escolhe no cadastro suas regiões e áreas de interesse/
 * atuação." É esta tela que alimenta o matching: sem interesse cadastrado, a
 * lista "combinam com você" do Marketplace vem vazia, e é isso mesmo — o
 * PRD pede distribuição por compatibilidade, não spam pra base inteira.
 *
 * Um interesse = tipo de pedido + região (+ o refinamento que aquele tipo
 * aceita). Deixar categoria/função/combustível em branco significa "qualquer
 * um" — quem atende a região toda não precisa marcar item por item.
 */
export default async function InteressesPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; erro?: string; ok?: string }>
}) {
  const { tipo: tipoSelecionado, erro, ok } = await searchParams
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [taxonomia, { data: brutos }] = await Promise.all([
    carregarTaxonomia(),
    supabase.from("interesses_marketplace").select("*").eq("usuario_id", user.id).order("criado_em"),
  ])
  const interesses = (brutos as InteresseMarketplace[] | null) ?? []
  const mapa = new Map(taxonomia.map((t) => [t.id, t]))

  const regioes = itensDoTipo(taxonomia, "regiao")
  const servicos = itensDoTipo(taxonomia, "categoria_servico")
  const produtos = itensDoTipo(taxonomia, "categoria_produto")
  const funcoes = itensDoTipo(taxonomia, "funcao")
  const combustiveis = itensDoTipo(taxonomia, "combustivel")

  // O formulário muda conforme o tipo escolhido — mesma ideia da tela de
  // publicar: cada tipo tem um refinamento diferente, e mostrar os cinco de
  // uma vez confundiria mais do que ajudaria.
  const tipo = (TIPOS_DEMANDA as readonly string[]).includes(tipoSelecionado ?? "")
    ? (tipoSelecionado as (typeof TIPOS_DEMANDA)[number])
    : "profissional"

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref="/marketplace"
        voltarRotulo="Marketplace"
        titulo="O que eu quero receber"
        descricao="Escolha as regiões e as áreas que você atende. Só chegam pedidos que combinam com isso."
      />
      {erro && <p className="mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 text-sm">{erro}</p>}
      {ok && <p className="mt-3 rounded-lg border border-ok/40 bg-ok/10 px-3 py-2 text-sm">{ok}</p>}

      <SecaoPagina icone="sinal">Seus interesses</SecaoPagina>
      <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
        {interesses.length === 0 ? (
          <EstadoVazio
            variant="linha"
            icone="sinal"
            titulo="Nenhum interesse ainda"
            descricao="Adicione o primeiro abaixo — é o que faz um pedido chegar até você."
          />
        ) : (
          interesses.map((i) => {
            const refinamentos = [
              i.categoria_id ? mapa.get(i.categoria_id)?.nome : null,
              i.funcao_id ? mapa.get(i.funcao_id)?.nome : null,
              i.combustivel_id ? mapa.get(i.combustivel_id)?.nome : null,
              i.porte_max_pes != null ? `até ${i.porte_max_pes} pés` : null,
            ].filter(Boolean)
            return (
              <div key={i.id} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="titulo-card truncate">{ROTULO_TIPO_DEMANDA[i.tipo_demanda]}</p>
                  <p className="apoio mt-0.5 truncate text-dim">
                    {nomeDaRegiao(mapa, i.regiao_id)}
                    {refinamentos.length > 0 ? ` · ${refinamentos.join(" · ")}` : " · todas as categorias"}
                  </p>
                </div>
                <form action={removerInteresse} className="shrink-0">
                  <input type="hidden" name="interesse_id" value={i.id} />
                  <Confirmar mensagem="Parar de receber?" rotulo="Remover" />
                </form>
              </div>
            )
          })
        )}
      </div>

      <SecaoPagina icone="mais">Adicionar interesse</SecaoPagina>
      <div className="mb-3 flex flex-wrap gap-2">
        {TIPOS_DEMANDA.map((t) => (
          <a
            key={t}
            href={`/marketplace/interesses?tipo=${t}`}
            className={`rounded-full border px-3 py-1.5 apoio ${
              tipo === t ? "border-accent-forte bg-accent/10 text-accent-forte" : "border-line text-dim"
            }`}
          >
            {ROTULO_TIPO_DEMANDA[t]}
          </a>
        ))}
      </div>

      <form action={salvarInteresse} className="sombra-1 space-y-3 rounded-[14px] border border-line bg-panel p-4">
        <input type="hidden" name="tipo_demanda" value={tipo} />

        <CampoSelect label="Região que você atende" id="regiao_id" name="regiao_id" required defaultValue="">
          <option value="" disabled>Escolha a região</option>
          {regioes.map((r) => (
            <option key={r.id} value={r.id}>{r.uf ? `${r.nome} — ${r.uf}` : r.nome}</option>
          ))}
        </CampoSelect>

        {tipo === "profissional" && (
          <CampoSelect label="Categoria de serviço" id="categoria_id" name="categoria_id" defaultValue="">
            <option value="">Todas as categorias</option>
            {servicos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </CampoSelect>
        )}

        {tipo === "produto" && (
          <CampoSelect label="Categoria de produto" id="categoria_id" name="categoria_id" defaultValue="">
            <option value="">Todas as categorias</option>
            {produtos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </CampoSelect>
        )}

        {tipo === "tripulacao" && (
          <CampoSelect label="Função" id="funcao_id" name="funcao_id" defaultValue="">
            <option value="">Todas as funções</option>
            {funcoes.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </CampoSelect>
        )}

        {tipo === "caminhao" && (
          <CampoSelect label="Combustível que você fornece" id="combustivel_id" name="combustivel_id" defaultValue="">
            <option value="">Todos</option>
            {combustiveis.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </CampoSelect>
        )}

        {tipo === "vaga_embarcacao" && (
          <Campo
            label="Porte máximo que sua marina comporta (pés)" id="porte_max_pes" name="porte_max_pes"
            inputMode="numeric" placeholder="80"
            dica="Pedidos acima desse porte não chegam até você. Em branco = qualquer porte."
          />
        )}

        <button className="h-11 w-full rounded-xl bg-accent text-sm font-semibold text-acao-texto">
          Adicionar
        </button>
      </form>

      {/* §21.2 — a saída pra quem não achou a sua região/categoria na lista.
          Sem isso, a padronização viraria um beco sem saída e a pessoa
          escolheria "Outra região" pra sempre. */}
      <div id="pedir">
        <SecaoPagina icone="chat">Está faltando alguma opção?</SecaoPagina>
      </div>
      <form action={solicitarTaxonomia} className="sombra-1 space-y-3 rounded-[14px] border border-line bg-panel p-4">
        <input type="hidden" name="volta" value="/marketplace/interesses" />
        <p className="apoio text-dim">
          As listas são padronizadas pra que os pedidos cheguem em quem realmente atende. Se faltou a sua
          região, categoria ou marca, peça a inclusão.
        </p>
        <CampoSelect label="Tipo" id="tipo" name="tipo" required defaultValue="regiao">
          {TIPOS_TAXONOMIA.map((t) => (
            <option key={t} value={t}>{ROTULO_TIPO_TAXONOMIA[t]}</option>
          ))}
        </CampoSelect>
        <Campo label="Nome que está faltando" id="nome" name="nome" required placeholder="Ex.: Guarapari — ES" />
        <CampoTextarea label="Observação (opcional)" id="observacao" name="observacao" rows={2} maxLength={300} />
        <button className="h-11 w-full rounded-xl border border-line text-sm font-medium">Pedir inclusão</button>
      </form>
    </main>
  )
}
