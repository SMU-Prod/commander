import Link from "next/link"
import { redirect } from "next/navigation"
import { Icone } from "@/components/icone"
import { BarraFerramentas } from "@/components/ui/barra-ferramentas"
import { Chip, ChipLinha } from "@/components/ui/chip"
import { FinanceiroNav } from "@/components/ui/financeiro-nav"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { LinhaLista } from "@/components/ui/linha-lista"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { carregarPainel, hojeISO } from "@/lib/consultas"
import {
  CATEGORIAS_FINANCEIRAS, ROTULO_CATEGORIA, formatarDataBr, rotuloStatus,
  type CategoriaFinanceira,
} from "@/lib/domain/financeiro"
import { formatarReais } from "@/lib/domain/gastos"
import { podeVer } from "@/lib/domain/permissoes"
import { supabaseServer } from "@/lib/supabase/server"
import type { LancamentoFinanceiro } from "@/lib/db/types"

type Filtro = "tudo" | "despesa" | "entrada" | "pendente"

const FILTROS: { valor: Filtro; rotulo: string }[] = [
  { valor: "tudo", rotulo: "Tudo" },
  { valor: "despesa", rotulo: "Despesas" },
  { valor: "entrada", rotulo: "Entradas" },
  { valor: "pendente", rotulo: "Pendentes" },
]

/** Financeiro · Lançamentos (PRD FINAL §9.1) — o extrato. Agrupado por mês,
 *  como o Histórico já faz, porque é assim que quem cuida do barco procura
 *  ("o que eu paguei em julho?"). */
export default async function LancamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string; categoria?: string }>
}) {
  const { filtro: filtroBruto, categoria: categoriaBruta } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (!podeVer(painel.permissoes, "gastos")) {
    redirect(`/hoje?erro=${encodeURIComponent("Seu acesso não inclui o Financeiro.")}`)
  }

  const filtro: Filtro = FILTROS.some((f) => f.valor === filtroBruto) ? (filtroBruto as Filtro) : "tudo"
  const categoria = (CATEGORIAS_FINANCEIRAS as readonly string[]).includes(categoriaBruta ?? "")
    ? (categoriaBruta as CategoriaFinanceira)
    : null

  const supabase = await supabaseServer()
  const { data: brutos, error } = await supabase.from("lancamentos_financeiros")
    .select("*").eq("embarcacao_id", painel.embarcacao.id)
    .order("data", { ascending: false }).limit(300)
  if (error) throw new Error("Não foi possível carregar os lançamentos. Recarregue a página.")

  const lancamentos = ((brutos ?? []) as LancamentoFinanceiro[]).filter((l) => {
    if (categoria && l.categoria !== categoria) return false
    if (filtro === "pendente") return l.status === "pendente"
    if (filtro === "despesa" || filtro === "entrada") return l.tipo === filtro
    return true
  })

  // Agrupamento por mês, na ordem em que já vêm (data desc).
  const grupos: { chave: string; rotulo: string; itens: LancamentoFinanceiro[] }[] = []
  for (const l of lancamentos) {
    const chave = l.data.slice(0, 7)
    if (grupos.at(-1)?.chave !== chave) {
      const [ano, mes] = chave.split("-").map(Number)
      const nome = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" })
        .format(new Date(Date.UTC(ano, mes - 1, 1)))
      grupos.push({ chave, rotulo: `${nome[0].toUpperCase()}${nome.slice(1)} de ${ano}`, itens: [] })
    }
    grupos.at(-1)!.itens.push(l)
  }

  const href = (f: Filtro, c: CategoriaFinanceira | null) => {
    const p = new URLSearchParams()
    if (f !== "tudo") p.set("filtro", f)
    if (c) p.set("categoria", c)
    const q = p.toString()
    return q ? `/financeiro/lancamentos?${q}` : "/financeiro/lancamentos"
  }
  const hoje = hojeISO()

  return (
    <main>
      <h1 className="titulo-pagina">Financeiro</h1>
      <p className="apoio mt-1 text-dim">Todo lançamento do barco, do mais recente ao mais antigo.</p>

      <FinanceiroNav atual="lancamentos" className="mt-4" />

      {/* ONDA 59 — a barra engole os dois grupos de chip (tipo/status +
          categoria, empilhados como Ocorrências já faz) e ganha a ação de
          criar, que sai de `AcoesUniversais`. O PRD previa DUAS ações
          universais ("+ Despesa" e "+ Entrada") em toda subaba, mas a regra
          de uma ação principal por tela (DESIGN §6.2: "a segunda mais
          importante é um link discreto") não convive com duas pílulas
          douradas na mesma tela. Despesa é o gesto mais frequente — o barco
          gasta lançamento a lançamento, entrada é esporádica (transferência,
          patrocínio) — então ela vira a ação da barra; "+ Entrada" recua a
          link discreto logo abaixo, mesmo padrão do "Importar do plotter"
          do Diário. `AcoesUniversais` continua igual e ainda serve Visão
          geral, Recorrentes e Relatórios sem mudança nenhuma — só o jeito
          de Lançamentos apresentar as mesmas duas ações mudou. */}
      <BarraFerramentas
        className="mt-3"
        filtros={
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <ChipLinha>
              {FILTROS.map((f) => (
                <Chip key={f.valor} href={href(f.valor, categoria)} ativo={filtro === f.valor}>
                  {f.rotulo}
                </Chip>
              ))}
            </ChipLinha>
            <ChipLinha>
              <Chip href={href(filtro, null)} ativo={categoria === null} nivel="secundario">
                Todas
              </Chip>
              {CATEGORIAS_FINANCEIRAS.map((c) => (
                <Chip key={c} href={href(filtro, c)} ativo={categoria === c} nivel="secundario">
                  {ROTULO_CATEGORIA[c]}
                </Chip>
              ))}
            </ChipLinha>
          </div>
        }
        acao={{ href: "/financeiro/novo?tipo=despesa", rotulo: "Despesa" }}
      />
      <div className="mt-2 flex justify-end">
        <Link
          href="/financeiro/novo?tipo=entrada"
          className="rotulo inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-accent-forte"
        >
          <Icone nome="mais" className="size-3.5" /> Entrada
        </Link>
      </div>

      {grupos.length === 0 && (
        <EstadoVazio
          className="mt-6"
          icone="cifrao"
          titulo="Nenhum lançamento com esse filtro"
          descricao="Registre uma despesa ou entrada acima — o Financeiro não depende de nenhuma outra tela pra funcionar."
        />
      )}

      {grupos.map((g) => (
        <section key={g.chave}>
          <SecaoPagina>{g.rotulo}</SecaoPagina>
          <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
            {g.itens.map((l) => (
              <LinhaLista
                key={l.id}
                href={`/financeiro/lancamentos/${l.id}`}
                titulo={l.descricao}
                subtitulo={
                  <>
                    <span className="font-mono-instr text-[11px] tabular-nums">{formatarDataBr(l.data)}</span>
                    {" · "}{ROTULO_CATEGORIA[l.categoria]}
                    {l.status === "pendente" && (
                      <span className={l.data < hoje ? "text-crit" : "text-warn"}>
                        {" · "}{l.data < hoje ? "vencido" : "pendente"}
                      </span>
                    )}
                    {l.carteira_movimento_id && " · via Carteira"}
                  </>
                }
                valor={`${l.tipo === "entrada" ? "+" : "−"} ${formatarReais(l.valor_centavos)}`}
                valorClassName={l.tipo === "entrada" ? "text-ok" : l.status === "pendente" ? "text-dim" : ""}
                valorSecundario={rotuloStatus(l.tipo, l.status)}
              />
            ))}
          </div>
        </section>
      ))}
    </main>
  )
}
