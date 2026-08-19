import { Icone } from "@/components/icone"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { LinhaLista } from "@/components/ui/linha-lista"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { exigirAreaAdmin } from "@/lib/admin"
import { carregarMapaTaxonomia, nomeDe, tituloDeDemanda } from "@/lib/consultas-marketplace"
import { formatarReais } from "@/lib/domain/gastos"
import {
  calcularMetricasComerciais,
  estadoDoNegocio,
  ROTULO_ESTADO_NEGOCIO,
  ROTULO_TIPO_DEMANDA,
  type ConfirmacaoNegocio,
} from "@/lib/domain/marketplace"
import { supabaseServer } from "@/lib/supabase/server"
import type { Demanda, Negocio, NegocioConfirmacao, Proposta } from "@/lib/db/types"

/**
 * §21.1 — "Pedidos, propostas, negócios confirmados, volume financeiro
 * informado e ticket médio" + "Regiões e categorias com maior atividade".
 *
 * Números vêm de `calcularMetricasComerciais` (lib/domain/marketplace.ts):
 * só entra negócio com confirmação BILATERAL, e volume/ticket contam apenas
 * o que foi informado — negócio confirmado sem valor não vira R$ 0, fica de
 * fora da média. Isso importa porque o §11.6 diz que "valor final é
 * opcional", e uma média inflada por zeros seria mentira estatística.
 *
 * Este painel lê `negocios` como admin (a RLS da migration 046 libera pra
 * `eh_admin()`), mas NÃO lê `demandas_contato` — o telefone do proprietário
 * (§22) não é métrica.
 */
export default async function AdminMarketplacePage() {
  await exigirAreaAdmin("marketplace")
  const supabase = await supabaseServer()

  const [mapa, { data: demandasBrutas }, { data: propostasBrutas }, { data: negociosBrutos }] =
    await Promise.all([
      carregarMapaTaxonomia(),
      supabase.from("demandas").select("*").order("criado_em", { ascending: false }).limit(500),
      supabase.from("propostas").select("*").limit(1000),
      supabase.from("negocios").select("*").order("criado_em", { ascending: false }).limit(500),
    ])

  const demandas = (demandasBrutas as Demanda[] | null) ?? []
  const propostas = (propostasBrutas as Proposta[] | null) ?? []
  const negocios = (negociosBrutos as Negocio[] | null) ?? []

  const { data: confirmacoesBrutas } = negocios.length
    ? await supabase.from("negocios_confirmacoes").select("*").in("negocio_id", negocios.map((n) => n.id))
    : { data: null }
  const confirmacoes = (confirmacoesBrutas as NegocioConfirmacao[] | null) ?? []
  const confirmacoesDe = (id: string): ConfirmacaoNegocio[] => confirmacoes.filter((c) => c.negocio_id === id)

  const metricas = calcularMetricasComerciais({
    demandasPublicadas: demandas.length,
    propostasEnviadas: propostas.filter((p) => p.status !== "retirada").length,
    negocios: negocios.map((n) => ({
      fornecedor_id: n.fornecedor_id,
      valor_final_centavos: n.valor_final_centavos,
      confirmacoes: confirmacoesDe(n.id),
    })),
  })

  const demandaPorId = new Map(demandas.map((d) => [d.id, d]))

  // "Regiões e categorias com maior atividade" (§21.1) — contagem simples
  // sobre as demandas publicadas, que é onde a atividade nasce.
  const contar = (chave: (d: Demanda) => string | null) => {
    const contagem = new Map<string, number>()
    for (const d of demandas) {
      const k = chave(d)
      if (k) contagem.set(k, (contagem.get(k) ?? 0) + 1)
    }
    return [...contagem.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8)
  }
  const porRegiao = contar((d) => nomeDe(mapa, d.regiao_id))
  const porCategoria = contar((d) => nomeDe(mapa, d.categoria_id))
  const porTipo = contar((d) => ROTULO_TIPO_DEMANDA[d.tipo])

  return (
    <main>
      {/* ONDA 93 — mesma correção de `/admin/gold`: esta tela não tinha
          saída. Ver o comentário longo lá. */}
      <CabecalhoDetalhe voltarHref="/admin" voltarRotulo="Admin Commander" />
      <h1 className="titulo-pagina mt-3 inline-flex items-center gap-2">
        <Icone nome="marketplace" className="size-5 text-accent-forte" /> Marketplace
      </h1>
      <p className="apoio mt-1 text-dim">
        Histórico comercial do §11.6. Sem comissão no Upgrade 2 — estes números existem para provar o valor
        gerado antes de qualquer cobrança sobre transação.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Numero rotulo="Pedidos publicados" valor={String(metricas.demandasPublicadas)} />
        <Numero rotulo="Propostas enviadas" valor={String(metricas.propostasEnviadas)} />
        <Numero rotulo="Negócios confirmados" valor={String(metricas.negociosConfirmados)} />
        <Numero
          rotulo="Conversão"
          valor={metricas.conversaoPercentual != null ? `${metricas.conversaoPercentual}%` : "—"}
        />
        <Numero rotulo="Volume informado" valor={formatarReais(metricas.volumeInformadoCentavos)} />
        <Numero
          rotulo="Ticket médio"
          valor={metricas.ticketMedioCentavos != null ? formatarReais(metricas.ticketMedioCentavos) : "—"}
          apoio={
            metricas.negociosComValor < metricas.negociosConfirmados
              ? `${metricas.negociosComValor} de ${metricas.negociosConfirmados} com valor informado`
              : undefined
          }
        />
      </div>

      <Lista titulo="Por tipo de pedido" linhas={porTipo} />
      <Lista titulo="Regiões com mais atividade" linhas={porRegiao} />
      <Lista titulo="Categorias com mais atividade" linhas={porCategoria} />

      <SecaoPagina>Negócios registrados</SecaoPagina>
      <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
        {negocios.length === 0 ? (
          <EstadoVazio variant="linha" icone="marketplace" titulo="Nenhum negócio registrado ainda" />
        ) : (
          negocios.map((n) => {
            const d = demandaPorId.get(n.demanda_id)
            const estado = estadoDoNegocio(confirmacoesDe(n.id))
            return (
              <LinhaLista
                key={n.id}
                titulo={d ? tituloDeDemanda(mapa, d) : "Pedido removido"}
                subtitulo={
                  ROTULO_ESTADO_NEGOCIO[estado] +
                  (n.valor_final_centavos != null
                    ? ` · ${formatarReais(n.valor_final_centavos)}`
                    : " · sem valor informado")
                }
              />
            )
          })
        )}
      </div>
    </main>
  )
}

function Numero({ rotulo, valor, apoio }: { rotulo: string; valor: string; apoio?: string }) {
  return (
    <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-3">
      <p className="rotulo text-dim">{rotulo}</p>
      {/* Mesmo cartão de KPI do dashboard, mesmo degrau: `.valor-forte` (20px)
          no lugar dos 18px de `text-lg`, que não eram degrau de escala nenhum.
          O porquê longo está em `app/(admin)/admin/page.tsx` — não repetido
          aqui pra não haver duas versões da mesma decisão divergindo. */}
      <p className="font-mono-instr valor-forte mt-1 font-semibold">{valor}</p>
      {apoio && <p className="apoio mt-0.5 text-dim">{apoio}</p>}
    </div>
  )
}

function Lista({ titulo, linhas }: { titulo: string; linhas: [string, number][] }) {
  if (linhas.length === 0) return null
  return (
    <>
      <SecaoPagina>{titulo}</SecaoPagina>
      <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
        {linhas.map(([nome, qtd]) => (
          <LinhaLista key={nome} titulo={nome} valor={qtd} />
        ))}
      </div>
    </>
  )
}
