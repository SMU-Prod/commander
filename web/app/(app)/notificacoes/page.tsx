import Link from "next/link"
import { redirect } from "next/navigation"
import { AtivarAlertas } from "@/components/ativar-alertas"
import { Icone } from "@/components/icone"
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
 * CENTRAL DE NOTIFICAÇÕES (onda 44, PRD §5.2). Antes desta onda a tela era
 * uma lista única de vencimentos, sem filtro nenhum. O PRD pede quatro
 * filtros (+ Todas) e três níveis com peso visual diferente.
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

export default async function NotificacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string }>
}) {
  const { categoria: categoriaBruta } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")

  const categoria = (CATEGORIAS_NOTIFICACAO as readonly string[]).includes(categoriaBruta ?? "")
    ? (categoriaBruta as CategoriaNotificacao)
    : "todas"

  const todas = await carregarNotificacoes()
  const contagem = contarPorCategoria(todas)
  const visiveis = agruparSemelhantes(filtrarPorCategoria(todas, categoria))

  const criticas = visiveis.filter((n) => n.nivel === "critica")
  const importantes = visiveis.filter((n) => n.nivel === "importante")
  const informativas = visiveis.filter((n) => n.nivel === "informativa")

  const supabase = await supabaseServer()
  // Histórico do que já foi disparado. A RLS de `alertas_enviados` passou a
  // respeitar a matriz na migration 045 — antes qualquer pessoa com vínculo
  // lia o título de todo alerta, inclusive de hubs que ela não pode ver.
  const { data: enviados } = await supabase
    .from("alertas_enviados")
    .select("id, titulo, janela, enviado_em")
    .eq("embarcacao_id", painel.embarcacao.id)
    .order("enviado_em", { ascending: false })
    .limit(20)

  const linkCategoria = (valor: CategoriaNotificacao | "todas") =>
    valor === "todas" ? "/notificacoes" : `/notificacoes?categoria=${valor}`

  const filtros: { valor: CategoriaNotificacao | "todas"; rotulo: string; total: number }[] = [
    { valor: "todas", rotulo: "Todas", total: todas.length },
    ...CATEGORIAS_NOTIFICACAO.map((c) => ({
      valor: c,
      rotulo: ROTULO_CATEGORIA_NOTIFICACAO[c],
      total: contagem[c],
    })),
  ]

  return (
    <main>
      <h1 className="titulo-pagina">Avisos</h1>
      <p className="apoio mt-1 text-dim">
        Você só recebe aviso das áreas a que tem acesso.
      </p>

      <div className="mt-4">
        <AtivarAlertas />
      </div>

      <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {filtros.map((f) => (
          <Link
            key={f.valor}
            href={linkCategoria(f.valor)}
            className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 font-mono-instr text-[11.5px] tracking-wide ${
              categoria === f.valor
                ? "border-accent bg-accent font-semibold text-acao-texto"
                : "border-line bg-panel text-dim"
            }`}
          >
            {f.rotulo}
            {f.total > 0 && <span className="ml-1 tabular-nums">{f.total}</span>}
          </Link>
        ))}
      </div>

      {visiveis.length === 0 && (
        <EstadoVazio
          icone="escudo"
          titulo="Nenhum aviso por aqui"
          descricao={
            categoria === "todas"
              ? VAZIO_CATEGORIA_NOTIFICACAO.embarcacao
              : VAZIO_CATEGORIA_NOTIFICACAO[categoria]
          }
          className="mt-6"
        />
      )}

      {criticas.length > 0 && (
        <>
          <SecaoPagina icone="alerta">Críticas — {criticas.length}</SecaoPagina>
          <div className="space-y-2">
            {criticas.map((n) => <CartaoNotificacao key={n.id} n={n} />)}
          </div>
        </>
      )}

      {importantes.length > 0 && (
        <>
          <SecaoPagina icone="relogio">Importantes — {importantes.length}</SecaoPagina>
          <div className="space-y-2">
            {importantes.map((n) => <CartaoNotificacao key={n.id} n={n} />)}
          </div>
        </>
      )}

      {informativas.length > 0 && (
        <>
          <SecaoPagina icone="documento">Informativas — {informativas.length}</SecaoPagina>
          <div className="space-y-2">
            {informativas.map((n) => <CartaoNotificacao key={n.id} n={n} />)}
          </div>
        </>
      )}

      <SecaoPagina icone="calendario">Histórico de avisos</SecaoPagina>
      <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
        {(enviados ?? []).length === 0 && (
          <EstadoVazio
            variant="linha"
            icone="calendario"
            titulo="Nenhum aviso enviado ainda"
            descricao="Quando algo entrar na margem, você recebe aqui e no aparelho."
          />
        )}
        {((enviados ?? []) as Pick<AlertaEnviado, "id" | "titulo" | "janela" | "enviado_em">[]).map((a) => (
          <div key={a.id} className="border-b border-line py-3 last:border-0">
            <p className="titulo-card">{a.titulo}</p>
            <p className="mt-0.5 font-mono-instr text-[11px] tabular-nums text-dim">
              {formatarCarimbo(a.enviado_em)}
            </p>
          </div>
        ))}
      </div>
    </main>
  )
}
