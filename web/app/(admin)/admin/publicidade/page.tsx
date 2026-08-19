import { BotaoEnviar } from "@/components/ui/botao-enviar"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { Campo, CampoSelect } from "@/components/ui/campo"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { Selo } from "@/components/ui/selo"
import { ALVO_ACAO, PILULA_ACAO } from "@/lib/ui/acoes"
import {
  atualizarPrecoPublicidade,
  criarCampanha,
  editarCampanha,
  mudarStatusCampanha,
} from "@/lib/acoes/publicidade"
import { exigirAreaAdmin } from "@/lib/admin"
import { carregarAnunciantes, carregarCampanhas, carregarProdutosPublicidade } from "@/lib/consultas-publicidade"
import { carregarTaxonomia, itensDoTipo, nomeDe, carregarMapaTaxonomia } from "@/lib/consultas-marketplace"
import { hojeISO } from "@/lib/domain/datas"
import {
  campanhaVigente,
  descreverPeriodo,
  DESCRICAO_PRODUTO,
  formatarPrecoPublicidade,
  formatarTaxa,
  MAX_PATROCINADORES_DASHBOARD,
  podeTransicionar,
  PRODUTOS_PUBLICIDADE,
  ROTULO_PATROCINADO,
  ROTULO_PRODUTO,
  ROTULO_STATUS_CAMPANHA,
  taxaDeClique,
  type CampanhaParaExibicao,
  type StatusCampanha,
} from "@/lib/domain/publicidade"
import type { ItemTaxonomiaDb } from "@/lib/db/types"

/**
 * Admin > Publicidade e destaques (PRD §20, §21 escopo Comercial).
 *
 * Uma tela só porque é uma conversa só: quanto custa, quem está anunciando e
 * quanto rendeu. Separar preço de campanha obrigaria o Comercial a navegar
 * pra descobrir se o que ele acabou de vender bate com a tabela.
 *
 * O que esta tela NÃO mostra, e é decisão, não esquecimento: nada do
 * proprietário. Nem nome, nem telefone, nem embarcação. O §22 diz que
 * "Partner não recebe telefone/dados sensíveis do proprietário antes do
 * ponto de liberação previsto no fluxo"; o mesmo princípio vale internamente
 * — quem vende destaque não precisa do dado pessoal de ninguém pra vender
 * destaque. A RLS da migration 053 garante isso mesmo que alguém acrescente
 * um `select` aqui por descuido: `profiles` e `embarcacoes` não abrem pro
 * papel comercial.
 */
export default async function AdminPublicidadePage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>
}) {
  await exigirAreaAdmin("publicidade")
  const { ok, erro } = await searchParams

  const [produtos, campanhas, anunciantes, taxonomia, mapa] = await Promise.all([
    carregarProdutosPublicidade(),
    carregarCampanhas(),
    carregarAnunciantes(),
    carregarTaxonomia(),
    carregarMapaTaxonomia(),
  ])
  const regioes = itensDoTipo(taxonomia, "regiao")
  const categorias = [
    ...itensDoTipo(taxonomia, "categoria_servico"),
    ...itensDoTipo(taxonomia, "categoria_produto"),
  ]
  const hoje = hojeISO()

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref="/admin"
        voltarRotulo="Admin Commander"
        titulo="Publicidade e destaques"
        descricao="Regra única para qualquer Commander Partner, pago ou gratuito. Publicidade não altera a nota nem a posição do Partner nas avaliações."
      />

      {ok && <p className="corpo mt-3 rounded-[var(--raio-controle)] border border-ok/40 bg-ok/10 px-3 py-2">{ok}</p>}
      {erro && <p className="corpo mt-3 rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      {/* --- Preços (§20: "não deve ser hardcoded") --------------------- */}
      <SecaoPagina className="mt-8">Preços dos produtos</SecaoPagina>
      <p className="apoio -mt-1 mb-3 text-dim">
        Deixe em branco para marcar como &quot;sob consulta&quot; — sem preço definido, nada é cobrado
        automaticamente.
      </p>
      <div className="space-y-3">
        {produtos.map((p) => (
          <form
            key={p.produto}
            action={atualizarPrecoPublicidade}
            className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-4"
          >
            <input type="hidden" name="produto" value={p.produto} />
            <p className="corpo font-medium">{ROTULO_PRODUTO[p.produto]}</p>
            <p className="apoio mt-0.5 text-dim">{DESCRICAO_PRODUTO[p.produto]}</p>
            <div className="mt-3 flex items-end gap-3">
              <p className="apoio min-w-0 flex-1 text-dim">
                Atual: {formatarPrecoPublicidade(p.preco_mensal_centavos)}
              </p>
              {/* Mesma caixa de ~35px de `/admin/gold/precos`, mesma correção —
                  o porquê do `items-end` está escrito lá. O detalhe próprio
                  daqui é o `aria-label` que SAIU: ele existia porque não havia
                  rótulo nenhum, e mantê-lo agora sobrescreveria em silêncio o
                  rótulo que a pessoa VÊ (é o defeito que a regra "label in
                  name" nomeia — quem usa comando de voz pede "novo valor" e o
                  campo atende por outro nome). Qual produto está sendo
                  precificado continua dito pelo título do cartão, duas linhas
                  acima, e agora o `<label for>` dá ao campo um nome de
                  verdade. */}
              <Campo
                label="Novo valor"
                id={`preco_${p.produto}`}
                type="text"
                name="valor_reais"
                inputMode="decimal"
                placeholder="199,90"
                defaultValue={
                  p.preco_mensal_centavos != null
                    ? (p.preco_mensal_centavos / 100).toFixed(2).replace(".", ",")
                    : ""
                }
                wrapperClassName="w-28 shrink-0"
                className="text-right"
              />
              <BotaoEnviar rotulo="Salvar" variante="contorno" className="shrink-0 whitespace-nowrap" />
            </div>
          </form>
        ))}
      </div>

      {/* --- Nova campanha --------------------------------------------- */}
      <SecaoPagina className="mt-8">Nova campanha</SecaoPagina>
      {anunciantes.length === 0 ? (
        <EstadoVazio
          icone="ancora"
          titulo="Nenhum Partner cadastrado ainda"
          descricao="Campanha precisa de um anunciante. Assim que o primeiro Partner criar o perfil, ele aparece aqui."
        />
      ) : (
        <form action={criarCampanha} className="sombra-1 space-y-3 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
          <CampoSelect label="Partner" id="parceiro_id" name="parceiro_id" required defaultValue="">
            <option value="" disabled>Escolha…</option>
            {anunciantes.map((a) => (
              <option key={a.id} value={a.id}>{a.nome}</option>
            ))}
          </CampoSelect>

          <CampoSelect label="Produto" id="produto" name="produto" required defaultValue="">
            <option value="" disabled>Escolha…</option>
            {PRODUTOS_PUBLICIDADE.map((p) => (
              <option key={p} value={p}>{ROTULO_PRODUTO[p]}</option>
            ))}
          </CampoSelect>

          <div className="grid grid-cols-2 gap-3">
            <Campo label="Início" id="inicio" name="inicio" type="date" required defaultValue={hoje} />
            <Campo label="Término" id="fim" name="fim" type="date" dica="Vazio = sem término previsto" />
          </div>

          <SelecaoSegmentacao regioes={regioes} categorias={categorias} />

          <div className="grid grid-cols-2 gap-3">
            <Campo
              label="Valor cobrado (R$)"
              id="valor_reais"
              name="valor_reais"
              inputMode="decimal"
              placeholder="199,90"
              dica="Fica congelado nesta campanha"
            />
            <Campo
              label="Prioridade"
              id="prioridade"
              name="prioridade"
              inputMode="numeric"
              defaultValue="0"
              dica="Maior aparece primeiro"
            />
          </div>

          <Campo
            label="Chamada (opcional)"
            id="chamada"
            name="chamada"
            maxLength={120}
            placeholder="Vaga coberta em Angra, com traslado"
            dica="Frase curta exibida no anúncio. Sem link: o clique leva ao perfil do Partner."
          />

          <BotaoEnviar rotulo="Criar como rascunho" larguraCheia />
          <p className="apoio text-dim">
            A campanha nasce em rascunho. Colocar no ar é uma segunda decisão, registrada no log.
          </p>
        </form>
      )}

      {/* --- Campanhas -------------------------------------------------- */}
      <SecaoPagina className="mt-8">Campanhas</SecaoPagina>
      <p className="apoio -mt-1 mb-3 text-dim">
        No Dashboard do proprietário aparece {ROTULO_PATROCINADO.toLowerCase()}: uma unidade por vez, até{" "}
        {MAX_PATROCINADORES_DASHBOARD} no carrossel, sempre abaixo da área operacional.
      </p>

      {campanhas.length === 0 ? (
        <EstadoVazio
          icone="grafico"
          titulo="Nenhuma campanha ainda"
          descricao="Crie a primeira acima. Impressões e cliques passam a contar assim que ela entrar no ar."
        />
      ) : (
        <div className="space-y-3">
          {campanhas.map(({ campanha, parceiroNome, impressoes, cliques }) => {
            const noAr = campanhaVigente(campanha as CampanhaParaExibicao, hoje)
            const taxa = taxaDeClique(impressoes, cliques)
            return (
              <div key={campanha.id} className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="corpo truncate font-medium">{parceiroNome}</p>
                    <p className="apoio text-dim">{ROTULO_PRODUTO[campanha.produto]}</p>
                  </div>
                  <SeloCampanha status={campanha.status} noAr={noAr} />
                </div>

                <p className="apoio mt-2 text-dim">
                  {descreverPeriodo(campanha.inicio, campanha.fim)}
                  {" · "}
                  {campanha.regiao_id ? nomeDe(mapa, campanha.regiao_id) : "Todas as regiões"}
                  {campanha.categoria_id ? ` · ${nomeDe(mapa, campanha.categoria_id)}` : ""}
                </p>

                {/* Impressões, cliques e taxa (§21.1). Taxa some quando não
                    houve impressão: 0% diria que o anúncio não funciona,
                    quando o fato é que ele não rodou. */}
                <p className="apoio mt-1 font-mono-instr tabular-nums text-dim">
                  {impressoes.toLocaleString("pt-BR")} impressões · {cliques.toLocaleString("pt-BR")} cliques ·{" "}
                  {formatarTaxa(taxa)}
                </p>

                {campanha.status === "ativa" && !noAr && (
                  <p className="apoio mt-2 rounded-[var(--raio-controle)] border border-aten/40 bg-aten/10 px-2.5 py-1.5">
                    Marcada como ativa, mas fora do período — não está sendo exibida.
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <BotaoStatus id={campanha.id} de={campanha.status} para="ativa" rotulo="Colocar no ar" />
                  <BotaoStatus id={campanha.id} de={campanha.status} para="pausada" rotulo="Pausar" />
                  <BotaoStatus id={campanha.id} de={campanha.status} para="encerrada" rotulo="Encerrar" />
                </div>

                <details className="mt-3">
                  {/* Era texto dourado de 18px — a mesma "ação parecendo texto
                      comum" da onda 82, e o único jeito de editar a campanha.
                      `inline-flex` do `ALVO_ACAO` já apaga o triângulo nativo
                      do `<summary>`, então a pílula fica sozinha na linha. */}
                  <summary className={`${ALVO_ACAO} cursor-pointer list-none`}>
                    <span className={PILULA_ACAO}>Ajustar veiculação</span>
                  </summary>
                  <form action={editarCampanha} className="mt-3 space-y-3">
                    <input type="hidden" name="id" value={campanha.id} />
                    <div className="grid grid-cols-2 gap-3">
                      <Campo label="Início" id={`ini_${campanha.id}`} name="inicio" type="date" required defaultValue={campanha.inicio} />
                      <Campo label="Término" id={`fim_${campanha.id}`} name="fim" type="date" defaultValue={campanha.fim ?? ""} />
                    </div>
                    <SelecaoSegmentacao
                      regioes={regioes}
                      categorias={categorias}
                      sufixo={campanha.id}
                      regiaoAtual={campanha.regiao_id}
                      categoriaAtual={campanha.categoria_id}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <Campo
                        label="Valor cobrado (R$)"
                        id={`val_${campanha.id}`}
                        name="valor_reais"
                        inputMode="decimal"
                        defaultValue={
                          campanha.valor_centavos != null
                            ? (campanha.valor_centavos / 100).toFixed(2).replace(".", ",")
                            : ""
                        }
                      />
                      <Campo
                        label="Prioridade"
                        id={`pri_${campanha.id}`}
                        name="prioridade"
                        inputMode="numeric"
                        defaultValue={String(campanha.prioridade)}
                      />
                    </div>
                    <Campo
                      label="Chamada"
                      id={`cha_${campanha.id}`}
                      name="chamada"
                      maxLength={120}
                      defaultValue={campanha.chamada ?? ""}
                    />
                    <BotaoEnviar rotulo="Salvar veiculação" variante="contorno" larguraCheia />
                  </form>
                </details>
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}

/** Campos de segmentação (§20). Vazio = sem restrição, e o texto diz isso —
 *  "todas as regiões" é diferente de "nenhuma região", e a diferença muda
 *  quem vê o anúncio. */
function SelecaoSegmentacao({
  regioes,
  categorias,
  sufixo = "novo",
  regiaoAtual = null,
  categoriaAtual = null,
}: {
  regioes: ItemTaxonomiaDb[]
  categorias: ItemTaxonomiaDb[]
  sufixo?: string
  regiaoAtual?: string | null
  categoriaAtual?: string | null
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <CampoSelect
        label="Região"
        id={`regiao_${sufixo}`}
        name="regiao_id"
        defaultValue={regiaoAtual ?? ""}
        dica="Vazio = todas"
      >
        <option value="">Todas as regiões</option>
        {regioes.map((r) => (
          <option key={r.id} value={r.id}>{r.nome}</option>
        ))}
      </CampoSelect>
      <CampoSelect
        label="Categoria"
        id={`categoria_${sufixo}`}
        name="categoria_id"
        defaultValue={categoriaAtual ?? ""}
        dica="Vazio = todas"
      >
        <option value="">Todas as categorias</option>
        {categorias.map((c) => (
          <option key={c.id} value={c.id}>{c.nome}</option>
        ))}
      </CampoSelect>
    </div>
  )
}

/** Só mostra o botão quando a transição existe. Usa `podeTransicionar` — a
 *  MESMA função testada que a action confirma antes de escrever. Oferecer
 *  "colocar no ar" numa campanha encerrada seria prometer o que a action vai
 *  recusar, e o §24 chama isso de falhar silenciosamente. */
function BotaoStatus({
  id,
  de,
  para,
  rotulo,
}: {
  id: string
  de: StatusCampanha
  para: StatusCampanha
  rotulo: string
}) {
  if (!podeTransicionar(de, para)) return null
  return (
    <form action={mudarStatusCampanha}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={para} />
      {/* 30px de altura numa fileira de três — a campanha entra e sai do ar
          por aqui. `contorno` traz os 44px e o aviso de envio. */}
      <BotaoEnviar rotulo={rotulo} variante="contorno" className="whitespace-nowrap" />
    </form>
  )
}

/** A pílula de estado da campanha. O desenho era escrito aqui à mão, a 10px
 *  (abaixo do piso de 11px do globals.css) e com tracking derivado; agora só
 *  o MAPEAMENTO status → estado mora nesta tela, e a forma vem do `Selo`. */
function SeloCampanha({ status, noAr }: { status: StatusCampanha; noAr: boolean }) {
  const estado = status === "ativa" && noAr ? "ok" : status === "encerrada" ? "neutro" : "atencao"
  return <Selo estado={estado}>{ROTULO_STATUS_CAMPANHA[status]}</Selo>
}
