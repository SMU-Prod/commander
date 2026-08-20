import { redirect } from "next/navigation"
import { BarraCapacidade } from "@/components/ui/barra-capacidade"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { Campo, CampoSelect } from "@/components/ui/campo"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { Selo } from "@/components/ui/selo"
import { criarItemEstoque, movimentarEstoque } from "@/lib/acoes/enterprise"
import { carregarPainel } from "@/lib/consultas"
import type { EstoqueItem, EstoqueMovimento } from "@/lib/db/types"
import {
  CATEGORIAS_ESTOQUE, estadoDoItem, precisaRepor,
  ROTULO_CATEGORIA_ESTOQUE, ROTULO_ESTADO_ESTOQUE,
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
  // AUDITORIA 19/08, A4 — `estoque_movimentos` era write-only: a tela gravava
  // "esta peça saiu para aquela unidade" e não tinha como mostrar. Sem o
  // rastro, /estoque respondia só "quanto tem", e não "para onde foram os 8
  // litros de óleo que sumiram este mês" — que é a pergunta que justifica ter
  // controle de estoque.
  const [{ data }, { data: brutosMovimentos }, { data: servicosAbertos }] = await Promise.all([
    supabase.from("estoque_itens").select("*").order("nome"),
    supabase.from("estoque_movimentos").select("*")
      .order("criado_em", { ascending: false }).limit(20),
    // §12 — a peça que sai pra um serviço da oficina precisa dizer PARA QUAL,
    // senão não há como perguntar depois se o orçamento já inclui essa peça
    // (`avisoDeDuplicidade`). Só serviços em aberto: ninguém retira peça pra
    // um conserto que já terminou, e listar os concluídos faria o select
    // crescer sem parar.
    supabase.from("servicos_mecanica").select("id, problema_informado")
      .eq("embarcacao_id", painel.embarcacao.id).neq("estado", "concluido")
      .order("criado_em", { ascending: false }).limit(20),
  ])

  // AUDITORIA 19/08, P2-5 — esta tela declarava a linha à mão, com sete das
  // dez colunas e o nome genérico `Item`. A de mecânica declarava as MESMAS
  // colunas de novo, com um recorte diferente: era a divergência acontecendo,
  // não uma ameaça de divergência. A forma agora vem de `lib/db/types.ts`,
  // derivada do banco vivo — inclusive `dono_id` e `custo_unitario_centavos`,
  // que o `select("*")` já trazia e o tipo escondia.
  // ONDA 99 (P2-5) — o movimento seguia a mesma sorte do item: cópia à mão
  // escondendo `servico_id` e `autor_id`, que o `select("*")` já trazia. E
  // `tipo` era `string`, o que fazia o mapa de rótulo logo abaixo precisar de
  // um `?? m.tipo` pra não quebrar; agora é união fechada, vinda do `check`.
  const itens = (data ?? []) as EstoqueItem[]
  const comEstado = itens.map((i) => ({ ...i, estado: estadoDoItem(Number(i.quantidade), i.minimo) }))
  const repor = comEstado.filter((i) => precisaRepor(i.estado))
  const emOrdem = comEstado.filter((i) => !precisaRepor(i.estado))

  const movimentos = (brutosMovimentos ?? []) as EstoqueMovimento[]
  const servicos = (servicosAbertos ?? []) as { id: string; problema_informado: string | null }[]
  const itemPorId = new Map(itens.map((i) => [i.id, i]))
  const nomeDaUnidade = new Map(painel.embarcacoes.map((e) => [e.id, e.nome]))
  const ROTULO_MOVIMENTO: Record<string, string> = {
    entrada: "Entrada", retirada: "Retirada", ajuste: "Ajuste",
  }

  const Linha = ({ i }: { i: (typeof comEstado)[number] }) => (
    <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-3.5">
      <div className="flex items-center gap-2">
        <p className="titulo-card min-w-0 flex-1 truncate">{i.nome}</p>
        <span className="shrink-0 tabular-nums text-sm font-semibold tabular-nums">
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
          className="tabular-nums tabular-nums"
        />
        {/* AUDITORIA 19/08, B5 — O SELETOR QUE O CABEÇALHO JÁ PROMETIA.
            "A unidade entra na RETIRADA", diz o comentário lá em cima, e a
            action gravava a unidade ATIVA sem perguntar. Quem está no balcão
            do almoxarifado tirando um filtro raramente tem aberta no app a
            unidade que vai receber a peça — o rastro saía errado com cara de
            certo. A unidade ativa continua sendo o padrão, porque é o palpite
            certo na maioria das vezes; ela só deixou de ser imposta. Ignorado
            na entrada e no ajuste, que são movimentos da prateleira e não de
            nenhuma unidade. */}
        <CampoSelect
          label="Para qual unidade"
          id={`unidade-${i.id}`}
          name="embarcacao_id"
          wrapperClassName="min-w-[8rem] flex-1"
          defaultValue={painel.embarcacao.id}
          dica="Só vale na retirada."
        >
          {painel.embarcacoes.map((e) => (
            <option key={e.id} value={e.id}>{e.nome}</option>
          ))}
        </CampoSelect>
        {/* §12 e A4 — `estoque_movimentos.servico_id` existia e nunca era
            preenchido. É ele que permite ao app perguntar, na conclusão do
            serviço, se o valor da oficina já inclui estas peças; sem isso a
            unidade acumula o custo duas vezes e ninguém percebe, porque os
            dois lançamentos estão certos separadamente. Fica em branco por
            padrão: retirada que não é pra serviço nenhum é o caso comum. */}
        {servicos.length > 0 && (
          <CampoSelect
            label="Para qual serviço"
            id={`servico-${i.id}`}
            name="servico_id"
            wrapperClassName="min-w-[9rem] flex-1"
            defaultValue=""
            dica="Só na retirada."
          >
            <option value="">Nenhum serviço</option>
            {servicos.map((s) => (
              <option key={s.id} value={s.id}>{s.problema_informado ?? "Serviço"}</option>
            ))}
          </CampoSelect>
        )}
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
      {erro && <p className="corpo mt-3 rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

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
                  className={`absolute -top-1 right-3 z-10 rounded-[var(--raio-pilula)] border px-2 py-0.5 text-xs ${
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

      {/* A4 — o rastro, finalmente lido. Só as 20 últimas: quem abre esta
          seção está atrás de "para onde foi o que sumiu esta semana", não de
          um extrato contábil. */}
      {movimentos.length > 0 && (
        <>
          <SecaoPagina icone="relatorio">Últimas movimentações</SecaoPagina>
          {/* `--raio-cartao` e não `--raio-painel`: os 14px cravados aqui e no
              formulário abaixo eram o mesmo desenho do cartão de reposição lá
              em cima, que já vinha por token. Promover só o que estava à mão
              deixaria dois raios no mesmo nível da mesma tela. Subir a tela
              inteira está no relatório. */}
          <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
            {movimentos.map((m) => {
              const item = itemPorId.get(m.item_id)
              return (
                <div key={m.id} className="flex items-center justify-between gap-2 border-b border-line py-3 last:border-0">
                  <span className="min-w-0">
                    <span className="corpo block truncate">
                      {/* Item que não veio na consulta é item apagado depois do
                          movimento — o movimento continua sendo verdade, e a
                          linha diz que não sabe o nome em vez de sumir. */}
                      {item?.nome ?? "Item removido do cadastro"}
                    </span>
                    <span className="apoio block text-dim">
                      {ROTULO_MOVIMENTO[m.tipo] ?? m.tipo}
                      {m.embarcacao_id &&
                        ` · ${nomeDaUnidade.get(m.embarcacao_id) ?? "unidade fora da sua lista"}`}
                      {" · "}
                      <span className="tabular-nums tabular-nums">
                        {new Date(m.criado_em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                      </span>
                      {m.motivo && ` · ${m.motivo}`}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums text-sm tabular-nums">
                    {m.tipo === "retirada" ? "−" : m.tipo === "entrada" ? "+" : ""}
                    {Number(m.quantidade).toLocaleString("pt-BR")}
                    {item?.unidade ? ` ${item.unidade}` : ""}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}

      <SecaoPagina icone="mais">Novo item</SecaoPagina>
      <form action={criarItemEstoque} className="sombra-1 space-y-3 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
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
          <Campo label="Quantidade" id="quantidade" name="quantidade" inputMode="decimal" className="tabular-nums tabular-nums" />
          <Campo
            label="Mínimo"
            id="minimo"
            name="minimo"
            inputMode="decimal"
            className="tabular-nums tabular-nums"
            dica="Em branco, o item nunca avisa."
          />
        </div>
        <Campo label="Fornecedor — opcional" id="fornecedor" name="fornecedor" />
        {/* Era `rounded-xl` — 12px, degrau que a escala não tem. Botão se TOCA,
            então `--raio-controle`; menos redondo que o painel de propósito,
            porque raio maior contém e raio menor aperta. */}
        <button className={`${ACAO_NAO_ESTICA} rounded-[var(--raio-controle)] border border-line py-3 text-sm font-semibold`}>
          Cadastrar item
        </button>
      </form>
    </main>
  )
}
