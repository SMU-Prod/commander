import { redirect } from "next/navigation"
import { BarraCapacidade } from "@/components/ui/barra-capacidade"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { Campo, CampoSelect } from "@/components/ui/campo"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { Selo } from "@/components/ui/selo"
import { criarItemEstoque, movimentarEstoque } from "@/lib/acoes/enterprise"
import { carregarPainel } from "@/lib/consultas"
import {
  CATEGORIAS_ESTOQUE, estadoDoItem, precisaRepor,
  ROTULO_CATEGORIA_ESTOQUE, ROTULO_ESTADO_ESTOQUE, type CategoriaEstoque,
} from "@/lib/domain/estoque-combustivel"
import { supabaseServer } from "@/lib/supabase/server"
import { ACAO_NAO_ESTICA } from "@/lib/ui/superficies"

/**
 * ESTOQUE (onda 78 — PRD §10).
 *
 * A tela abre pelo que precisa de ação: o que acabou e o que está acabando
 * vêm primeiro, porque é o aviso de estoque baixo que o §10 pede. O resto da
 * prateleira vem depois, agrupado por categoria.
 *
 * Estoque é da EMPRESA, não do barco (migration 064) — por isso não há
 * seletor de embarcação aqui. A unidade entra na RETIRADA, que é onde mora o
 * rastro e o custo.
 */
export default async function EstoquePage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")

  const supabase = await supabaseServer()
  const { data } = await supabase.from("estoque_itens").select("*").order("nome")

  type Item = {
    id: string; nome: string; categoria: CategoriaEstoque; unidade: string | null
    quantidade: number; minimo: number | null; fornecedor: string | null
  }
  const itens = (data ?? []) as Item[]
  const comEstado = itens.map((i) => ({ ...i, estado: estadoDoItem(Number(i.quantidade), i.minimo) }))
  const repor = comEstado.filter((i) => precisaRepor(i.estado))
  const emOrdem = comEstado.filter((i) => !precisaRepor(i.estado))

  const Linha = ({ i }: { i: (typeof comEstado)[number] }) => (
    <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-3.5">
      <div className="flex items-center gap-2">
        <p className="titulo-card min-w-0 flex-1 truncate">{i.nome}</p>
        <span className="shrink-0 font-mono-instr text-sm font-semibold tabular-nums">
          {Number(i.quantidade).toLocaleString("pt-BR")}
          {i.unidade ? ` ${i.unidade}` : ""}
        </span>
      </div>
      <p className="apoio mt-0.5 text-dim">
        {ROTULO_CATEGORIA_ESTOQUE[i.categoria]}
        {i.minimo != null && ` · mínimo ${Number(i.minimo).toLocaleString("pt-BR")}`}
        {i.fornecedor && ` · ${i.fornecedor}`}
      </p>

      {/* Entrada, retirada e ajuste no mesmo formulário: no pátio é o mesmo
          gesto ("mexi no estoque"), e três botões separados por item fariam
          a lista triplicar de altura. */}
      <form action={movimentarEstoque} className="mt-3 flex flex-wrap items-end gap-2">
        <input type="hidden" name="item_id" value={i.id} />
        <CampoSelect label="O quê" id={`tipo-${i.id}`} name="tipo" wrapperClassName="min-w-[7.5rem] flex-1">
          <option value="retirada">Retirar</option>
          <option value="entrada">Entrada</option>
          <option value="ajuste">Ajustar para</option>
        </CampoSelect>
        <Campo
          label="Quanto"
          id={`qtd-${i.id}`}
          name="quantidade"
          inputMode="decimal"
          wrapperClassName="w-24"
          className="font-mono-instr tabular-nums"
        />
        <Campo
          label="Motivo"
          id={`motivo-${i.id}`}
          name="motivo"
          wrapperClassName="min-w-[8rem] flex-1"
          placeholder="Só no ajuste"
        />
        <button className="h-11 shrink-0 rounded-[var(--raio-controle)] border border-line px-4 text-sm font-medium">
          Aplicar
        </button>
      </form>
    </div>
  )

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref="/menu"
        voltarRotulo="Menu"
        titulo="Estoque"
        descricao="A prateleira da empresa — o que tem, o que está acabando e para onde foi."
        selo={repor.length > 0 ? <Selo estado="atencao">{`${repor.length} para repor`}</Selo> : undefined}
      />
      {erro && <p className="corpo mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      {/* Onda 79 (instrumentos) — DECISÃO: `BarraCapacidade` NÃO entrou por
          item (spec §2 item 3 sugeria isso), só no agregado abaixo.
          Testado e descartado: o componente é "usado/teto", mais cheio é
          pior (`tomPorUso`). Estoque é o OPOSTO — mais quantidade é melhor —
          e não existe teto no domínio (`estoque-combustivel.ts` só guarda
          `minimo`, um piso). Toda tentativa de encaixar item-a-item ou
          inverte a cor (usado=quantidade, total=mínimo faria estoque cheio
          virar "crítico" vermelho) ou mostra número errado (usado=mínimo,
          total=quantidade acerta a cor por acidente mas lê como "usado 3 de
          12", a leitura oposta da real) ou zera errado (zero em estoque é a
          PIOR leitura, e `tomPorUso` trata zero como neutro/cinza — a regra
          certa para "ninguém preencheu", errada para "acabou"). Nenhuma
          dessas é a peça certa pro dado errado.
          O que SOBROU do pedido, e cabe de verdade: quantos itens da
          prateleira pedem reposição agora, sobre o total — isso É usado/teto
          (mais itens pedindo reposição É pior), sem inventar limite nenhum. */}
      {itens.length > 0 && (
        <div className="sombra-1 mt-4 rounded-[var(--raio-cartao)] border border-line bg-panel p-3.5">
          <BarraCapacidade
            usado={repor.length}
            total={itens.length}
            unidade="itens"
            icone="alerta"
            rotulo="Precisam de reposição"
          />
        </div>
      )}

      {repor.length > 0 && (
        <>
          {/* O aviso do §10 vem primeiro porque é o único bloco que pede ação
              hoje — prateleira em ordem não precisa de atenção nenhuma. */}
          <SecaoPagina icone="alerta">Precisa repor</SecaoPagina>
          <div className="space-y-2">
            {repor.map((i) => (
              <div key={i.id} className="relative">
                <span
                  className={`absolute -top-1 right-3 z-10 rounded-full border px-2 py-0.5 text-[11px] ${
                    i.estado === "zerado" ? "border-crit/40 bg-panel text-crit" : "border-aten/40 bg-panel text-warn"
                  }`}
                >
                  {ROTULO_ESTADO_ESTOQUE[i.estado]}
                </span>
                <Linha i={i} />
              </div>
            ))}
          </div>
        </>
      )}

      <SecaoPagina icone="ferramenta">
        Prateleira{emOrdem.length > 0 ? ` — ${emOrdem.length}` : ""}
      </SecaoPagina>
      {itens.length === 0 ? (
        <EstadoVazio
          variant="linha"
          icone="ferramenta"
          titulo="Nenhum item no estoque"
          descricao="Cadastre abaixo o que a empresa guarda: filtros, óleo, coletes, peças."
        />
      ) : emOrdem.length === 0 ? (
        <EstadoVazio variant="linha" icone="ferramenta" titulo="Tudo o que existe está para repor" />
      ) : (
        <div className="space-y-2">
          {emOrdem.map((i) => <Linha key={i.id} i={i} />)}
        </div>
      )}

      <SecaoPagina icone="mais">Novo item</SecaoPagina>
      <form action={criarItemEstoque} className="sombra-1 space-y-3 rounded-[14px] border border-line bg-panel p-4">
        <Campo label="Nome" id="nome" name="nome" placeholder="Ex.: Filtro de óleo D6" />
        <div className="grid grid-cols-2 gap-3">
          <CampoSelect label="Categoria" id="categoria" name="categoria">
            {CATEGORIAS_ESTOQUE.map((c) => (
              <option key={c} value={c}>{ROTULO_CATEGORIA_ESTOQUE[c]}</option>
            ))}
          </CampoSelect>
          <Campo label="Unidade" id="unidade" name="unidade" placeholder="un, L, m" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Quantidade" id="quantidade" name="quantidade" inputMode="decimal" className="font-mono-instr tabular-nums" />
          <Campo
            label="Mínimo"
            id="minimo"
            name="minimo"
            inputMode="decimal"
            className="font-mono-instr tabular-nums"
            dica="Em branco, o item nunca avisa."
          />
        </div>
        <Campo label="Fornecedor — opcional" id="fornecedor" name="fornecedor" />
        <button className={`${ACAO_NAO_ESTICA} rounded-xl border border-line py-3 text-sm font-semibold`}>
          Cadastrar item
        </button>
      </form>
    </main>
  )
}
