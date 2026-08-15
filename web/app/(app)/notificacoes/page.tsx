import Link from "next/link"
import { redirect } from "next/navigation"
import { Icone } from "@/components/icone"
import { TarjaPushDesligado } from "@/components/tarja-push-desligado"
import { Abas } from "@/components/ui/abas"
import { Chip, ChipLinha } from "@/components/ui/chip"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { carregarNotificacoes, carregarPainel } from "@/lib/consultas"
import { formatarCarimbo } from "@/lib/domain/datas"
import {
  agruparSemelhantes, CATEGORIAS_NOTIFICACAO, contarPorCategoria, filtrarPorCategoria,
  ROTULO_CATEGORIA_NOTIFICACAO, ROTULO_NIVEL_NOTIFICACAO, VAZIO_CATEGORIA_NOTIFICACAO,
  type CategoriaNotificacao, type NivelNotificacao, type NotificacaoAgrupada,
} from "@/lib/domain/notificacoes"
import { supabaseServer } from "@/lib/supabase/server"
import type { AlertaEnviado } from "@/lib/db/types"

/**
 * AVISOS — CAIXA DE ENTRADA CUJO OBJETIVO É FICAR VAZIA (onda 58, spec de
 * arquitetura §3). A tela da onda 44 empilhava quatro trabalhos com o mesmo
 * peso: ativar push, filtrar, ler, auditar histórico. Agora cada um tem o
 * peso do seu papel:
 *
 *   - LER é o trabalho. Críticas com peso inteiro; importantes e
 *     informativas recolhidas atrás da contagem (hierarquia progressiva,
 *     DESIGN.md §2: contagem → item → detalhe).
 *   - AUDITAR vira a aba Histórico — registro de "o app me avisou?", útil
 *     na dúvida e inútil no dia a dia.
 *   - ATIVAR PUSH morou aqui até esta onda; agora mora em Ajustes. Sobra a
 *     `TarjaPushDesligado`, que só aparece quando há o que dizer.
 *   - FILTRAR continua, só em Pendentes.
 *
 * Agenda, Marketplace e Financeiro aparecem como filtro mesmo sem o módulo
 * por trás — e mostram um estado vazio honesto, que diz que o módulo ainda
 * não está no ar. Esconder o filtro seria mais "limpo" e menos verdadeiro:
 * o dono precisa saber o que o app cobre e o que ainda não cobre.
 *
 * Quem monta a lista é `carregarNotificacoes` (`lib/consultas.ts`), a mesma
 * função que alimenta o contador do sino — o badge e a tela nunca divergem.
 * A filtragem por permissão acontece lá, antes de qualquer coisa chegar
 * aqui.
 */

/** Destaque visual por nível — o PRD manda destacar as críticas. Nada de
 *  dourado (`accent`): esse é do Commander Gold. */
const ESTILO_NIVEL: Record<NivelNotificacao, { cartao: string; chip: string; icone: string }> = {
  critica: {
    cartao: "border-crit/50 bg-crit/[0.06]",
    chip: "border-crit/50 text-crit",
    icone: "bg-crit/12 text-crit",
  },
  importante: {
    cartao: "border-line",
    chip: "border-warn/50 text-warn",
    icone: "bg-warn/12 text-warn",
  },
  informativa: {
    cartao: "border-line",
    chip: "border-line text-dim",
    icone: "bg-panel2 text-dim",
  },
}

function CartaoNotificacao({ n }: { n: NotificacaoAgrupada }) {
  const estilo = ESTILO_NIVEL[n.nivel]
  return (
    <Link
      href={n.href}
      className={`sombra-1 flex items-center gap-3 rounded-[14px] border bg-panel p-3.5 ${estilo.cartao}`}
    >
      <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${estilo.icone}`}>
        <Icone nome="alerta" className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="titulo-card truncate">{n.titulo}</p>
        <p className="apoio mt-0.5 truncate text-dim">
          {n.detalhe}
          {/* "Oportunidades semelhantes devem ser agrupadas para evitar spam"
              (PRD §5.2) — o resto do grupo vira um "+N" em vez de N linhas. */}
          {n.quantidade > 1 && ` · +${n.quantidade - 1} semelhante${n.quantidade > 2 ? "s" : ""}`}
        </p>
      </div>
      <span className={`shrink-0 rounded-full border px-2 py-0.5 font-mono-instr text-[10.5px] uppercase tracking-[.08em] ${estilo.chip}`}>
        {ROTULO_NIVEL_NOTIFICACAO[n.nivel]}
      </span>
    </Link>
  )
}

/**
 * Nível recolhido atrás da contagem — `<details>` nativo, zero JS, a página
 * continua RSC. Quem quer varrer as importantes abre; quem só passou pra
 * ver se há fogo não paga três cabeçalhos por dois itens.
 */
function NivelRecolhido({
  rotulo,
  itens,
  aberto = false,
}: {
  rotulo: string
  itens: NotificacaoAgrupada[]
  aberto?: boolean
}) {
  return (
    <details className="group mt-4" open={aberto}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-medium text-dim [&::-webkit-details-marker]:hidden">
        <Icone nome="chevron" className="size-4 transition-transform group-open:rotate-90" />
        {rotulo}
        <span className="font-mono-instr text-[11px] tabular-nums">{itens.length}</span>
      </summary>
      <div className="mt-2 space-y-2">
        {itens.map((n) => <CartaoNotificacao key={n.id} n={n} />)}
      </div>
    </details>
  )
}

export default async function NotificacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; aba?: string }>
}) {
  const { categoria: categoriaBruta, aba: abaBruta } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")

  // Só "historico" muda de aba; qualquer outro valor (inclusive lixo na URL)
  // cai em Pendentes — a caixa de entrada é o default e o fallback.
  const aba = abaBruta === "historico" ? "historico" : "pendentes"

  const categoria = (CATEGORIAS_NOTIFICACAO as readonly string[]).includes(categoriaBruta ?? "")
    ? (categoriaBruta as CategoriaNotificacao)
    : "todas"

  const todas = await carregarNotificacoes()
  const contagem = contarPorCategoria(todas)
  const visiveis = agruparSemelhantes(filtrarPorCategoria(todas, categoria))

  const criticas = visiveis.filter((n) => n.nivel === "critica")
  const importantes = visiveis.filter((n) => n.nivel === "importante")
  const informativas = visiveis.filter((n) => n.nivel === "informativa")

  // Como os links se compõem: o de CATEGORIA preserva a aba (filtrar não é
  // trocar de assunto), o de ABA não preserva a categoria — trocar de aba
  // limpa o filtro de propósito: o Histórico não filtra por categoria, então
  // um `?categoria=` sobrevivente na URL seria estado fantasma que voltaria
  // a filtrar Pendentes sem ninguém ter pedido. A rota ACEITA os dois juntos
  // (`?aba=historico&categoria=x` não quebra — o histórico só ignora a
  // categoria); os links é que não geram essa combinação.
  const linkCategoria = (valor: CategoriaNotificacao | "todas") => {
    const params = new URLSearchParams()
    if (aba !== "pendentes") params.set("aba", aba)
    if (valor !== "todas") params.set("categoria", valor)
    const query = params.toString()
    return query ? `/notificacoes?${query}` : "/notificacoes"
  }

  const filtros: { valor: CategoriaNotificacao | "todas"; rotulo: string; total: number }[] = [
    { valor: "todas", rotulo: "Todas", total: todas.length },
    ...CATEGORIAS_NOTIFICACAO.map((c) => ({
      valor: c,
      rotulo: ROTULO_CATEGORIA_NOTIFICACAO[c],
      total: contagem[c],
    })),
  ]

  // Histórico do que já foi disparado — só quando a aba pede. A RLS de
  // `alertas_enviados` passou a respeitar a matriz na migration 045 — antes
  // qualquer pessoa com vínculo lia o título de todo alerta, inclusive de
  // hubs que ela não pode ver.
  let enviados: Pick<AlertaEnviado, "id" | "titulo" | "janela" | "enviado_em">[] = []
  if (aba === "historico") {
    const supabase = await supabaseServer()
    const { data } = await supabase
      .from("alertas_enviados")
      .select("id, titulo, janela, enviado_em")
      .eq("embarcacao_id", painel.embarcacao.id)
      .order("enviado_em", { ascending: false })
      .limit(20)
    enviados = data ?? []
  }

  return (
    <main>
      <h1 className="titulo-pagina">Avisos</h1>
      <p className="apoio mt-1 text-dim">
        Você só recebe aviso das áreas a que tem acesso.
      </p>

      {/* O sublinhado dourado da aba ativa é um dos dois dourados desta tela
          (o outro é o chip de categoria ativo, em Pendentes). */}
      <Abas
        className="mt-4"
        ativa={aba}
        abas={[
          { valor: "pendentes", rotulo: "Pendentes", href: "/notificacoes", contagem: visiveis.length },
          { valor: "historico", rotulo: "Histórico", href: "/notificacoes?aba=historico" },
        ]}
      />

      {aba === "historico" ? (
        /* A aba já diz "Histórico" — repetir "Histórico de avisos" num
           cabeçalho de seção logo abaixo seria moldura fazendo o trabalho do
           conteúdo (spec §3.2), então o bloco entra sem `SecaoPagina`. */
        <div className="sombra-1 mt-4 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
          {enviados.length === 0 && (
            <EstadoVazio
              variant="linha"
              icone="calendario"
              titulo="Nenhum aviso enviado ainda"
              descricao="Quando algo entrar na margem, você recebe aqui e no aparelho."
            />
          )}
          {enviados.map((a) => (
            <div key={a.id} className="border-b border-line py-3 last:border-0">
              <p className="titulo-card">{a.titulo}</p>
              <p className="mt-0.5 font-mono-instr text-[11px] tabular-nums text-dim">
                {formatarCarimbo(a.enviado_em)}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="mt-4">
            <TarjaPushDesligado />
          </div>

          <ChipLinha className="mt-4">
            {filtros.map((f) => (
              <Chip key={f.valor} href={linkCategoria(f.valor)} ativo={categoria === f.valor}>
                {f.rotulo}
                {/* A contagem é número: fica em mono tabular mesmo com o rótulo
                    em sans — é exatamente a divisão que o app faz em toda lista. */}
                {f.total > 0 && <span className="ml-1.5 font-mono-instr tabular-nums">{f.total}</span>}
              </Chip>
            ))}
          </ChipLinha>

          {visiveis.length === 0 && (
            categoria === "todas" ? (
              /* Zero é uma resposta boa (spec §3.2): a caixa de entrada
                 EXISTE pra ficar vazia, então o vazio sem filtro é boa
                 notícia, não lápide — e sem decoração (DESIGN.md §6 regra 4). */
              <EstadoVazio
                icone="escudo"
                titulo="Nenhuma pendência"
                descricao="Quando algo crítico ou importante acontecer, aparece aqui e no aparelho."
                className="mt-6"
              />
            ) : (
              /* Com filtro ativo o vazio é da categoria: diz o que o app
                 cobre (ou ainda não cobre) naquela área. */
              <EstadoVazio
                icone="escudo"
                titulo="Nenhum aviso por aqui"
                descricao={VAZIO_CATEGORIA_NOTIFICACAO[categoria]}
                className="mt-6"
              />
            )
          )}

          {criticas.length > 0 && (
            <>
              <SecaoPagina icone="alerta">Críticas — {criticas.length}</SecaoPagina>
              <div className="space-y-2">
                {criticas.map((n) => <CartaoNotificacao key={n.id} n={n} />)}
              </div>
            </>
          )}

          {/* Sem crítica nenhuma e com importantes, o `<details>` de
              importantes nasce aberto: caixa de entrada sem nada em destaque
              e com o trabalho escondido atrás de um clique seria PIOR que a
              tela antiga — a pessoa veria "Importantes 3" fechado, leria
              como "nada urgente" e iria embora sem ver os três. */}
          {importantes.length > 0 && (
            <NivelRecolhido
              rotulo="Importantes"
              itens={importantes}
              aberto={criticas.length === 0}
            />
          )}

          {/* Mesma regra descendo um degrau: se informativas são TUDO que
              há, elas abrem — senão a tela inteira vira dois títulos
              fechados e a pessoa sai achando que não havia nada. */}
          {informativas.length > 0 && (
            <NivelRecolhido
              rotulo="Informativas"
              itens={informativas}
              aberto={criticas.length === 0 && importantes.length === 0}
            />
          )}
        </>
      )}
    </main>
  )
}
