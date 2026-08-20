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
  CATEGORIAS_FINANCEIRAS, ROTULO_CATEGORIA, estadoDaLinha, rotuloDoGrupoMensal,
  rotuloPagoNoMes, totaisDoMes, valorDaLinha,
  type CategoriaFinanceira,
} from "@/lib/domain/financeiro"
import { formatarReais } from "@/lib/domain/gastos"
import { formatarDataCurta } from "@/lib/domain/semaforo"
import { podeVer } from "@/lib/domain/permissoes"
import { supabaseServer } from "@/lib/supabase/server"
import { ALVO_ACAO, PILULA_ACAO } from "@/lib/ui/acoes"
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

  const hoje = hojeISO()

  // Agrupamento por mês, na ordem em que já vêm (data desc). O rótulo é o
  // do canvas (tela-3e): só o mês no ano corrente ("Agosto"); ano por
  // extenso fora dele — `rotuloDoGrupoMensal`, com teste.
  const grupos: { chave: string; rotulo: string; itens: LancamentoFinanceiro[] }[] = []
  for (const l of lancamentos) {
    const chave = l.data.slice(0, 7)
    if (grupos.at(-1)?.chave !== chave) {
      grupos.push({ chave, rotulo: rotuloDoGrupoMensal(chave, hoje), itens: [] })
    }
    grupos.at(-1)!.itens.push(l)
  }

  // O cartão de totais do topo (canvas tela-3e) soma sobre TODOS os
  // lançamentos carregados, antes de filtro de chip — os filtros mudam a
  // lista, não o fato do mês. Só despesa paga entra no total; a vencer é a
  // conta assumida que ainda vai bater (`totaisDoMes`, com teste).
  const totais = totaisDoMes(
    ((brutos ?? []) as LancamentoFinanceiro[]).map((l) => ({
      tipo: l.tipo, status: l.status, data: l.data, valorCentavos: l.valor_centavos,
    })),
    hoje,
  )

  const href = (f: Filtro, c: CategoriaFinanceira | null) => {
    const p = new URLSearchParams()
    if (f !== "tudo") p.set("filtro", f)
    if (c) p.set("categoria", c)
    const q = p.toString()
    return q ? `/financeiro/lancamentos?${q}` : "/financeiro/lancamentos"
  }

  return (
    <main>
      <h1 className="titulo-pagina">Financeiro</h1>

      <FinanceiroNav atual="lancamentos" className="mt-4" />

      {/* Canvas tela-3e — o cartão de totais em cima do extrato: "Pago em
          agosto" (só o que JÁ saiu) e "A vencer" (a conta assumida que
          ainda vai bater). O "R$" aparece UMA vez aqui; nas linhas abaixo a
          coluna mono vai sem ele — a vírgula alinha e a comparação é de
          valor, não de texto. */}
      {/* `p-3` e não os 14px de antes: 14 não é degrau da escala base-8 (DESIGN §5) e
          era o único respiro desta tela fora dela. `.valor-forte` no lugar de
          `text-xl` — mesmo 20px, agora com o peso e a cor de DADO que o
          par rótulo-cinza/valor-branco precisa pra existir (onda 87). */}
      <div className="sombra-1 mt-4 rounded-[var(--raio-cartao)] border border-line bg-panel p-3">
        <div className="flex gap-3">
          <div className="flex-1">
            <p className="rotulo text-dim">{rotuloPagoNoMes(hoje)}</p>
            <p className="mt-1.5 tabular-nums valor-forte font-semibold">
              {formatarReais(totais.pagoCentavos)}
            </p>
          </div>
          <div className="flex-1">
            <p className="rotulo text-dim">A vencer</p>
            <p className={`mt-1.5 tabular-nums valor-forte font-semibold ${totais.aVencerCentavos > 0 ? "text-warn" : ""}`}>
              {formatarReais(totais.aVencerCentavos)}
            </p>
          </div>
        </div>
      </div>

      {/* ONDA 59 — a barra recebe só o filtro PRIMÁRIO (tipo/status), ao
          lado da ação de criar, que sai de `AcoesUniversais`. O PRD previa
          DUAS ações universais ("+ Despesa" e "+ Entrada") em toda subaba,
          mas a regra de uma ação principal por tela (DESIGN §6.2: "a
          segunda mais importante é um link discreto") não convive com duas
          pílulas douradas na mesma tela. Despesa é o gesto mais frequente —
          o barco gasta lançamento a lançamento, entrada é esporádica
          (transferência, patrocínio) — então ela vira a ação da barra;
          "+ Entrada" recua a link discreto, mesmo padrão do "Importar do
          plotter" do Diário. ONDA 60: e na mesma POSIÇÃO dele — acima da
          barra, encostado à direita. Ele morava abaixo da ChipLinha de
          categoria, e cada lista pendurava o sotaque discreto num degrau
          diferente; agora quem conhece o Diário acha o link secundário de
          Lançamentos no mesmo lugar. `AcoesUniversais` continua igual e
          ainda serve Visão geral, Recorrentes e Relatórios sem mudança
          nenhuma — só o jeito de Lançamentos apresentar as mesmas duas
          ações mudou.
          Categoria é refinamento SECUNDÁRIO dentro de tipo/status — o slot
          `filtros` da barra é UMA linha (regra em barra-ferramentas.tsx),
          então ela mora fora da barra, numa `ChipLinha` solta logo abaixo. */}
      {/* ONDA 82 — o alvo já tinha os 44px, mas o VESTIDO era mono dourado
          rastreado: um sexto jeito de escrever "ação secundária" (achado 5.2
          da auditoria de 19/08). A forma agora é a mesma de todo cabeçalho de
          seção do app. */}
      <div className="mt-2 flex justify-end">
        <Link href="/financeiro/novo?tipo=entrada" className={ALVO_ACAO}>
          <span className={PILULA_ACAO}>
            <Icone nome="mais" className="size-3.5" /> Entrada
          </span>
        </Link>
      </div>
      {/* mt-4 como no Diário e nas Ocorrências — a margem da barra é a mesma
          nas três listas (onda 60 unifica; aqui era mt-3). */}
      <BarraFerramentas
        className="mt-4"
        filtros={
          <>
            {FILTROS.map((f) => (
              <Chip key={f.valor} href={href(f.valor, categoria)} ativo={filtro === f.valor}>
                {f.rotulo}
              </Chip>
            ))}
          </>
        }
        acao={{ href: "/financeiro/novo?tipo=despesa", rotulo: "Despesa" }}
      />
      <ChipLinha className="mt-2">
        <Chip href={href(filtro, null)} ativo={categoria === null} nivel="secundario">
          Todas
        </Chip>
        {CATEGORIAS_FINANCEIRAS.map((c) => (
          <Chip key={c} href={href(filtro, c)} ativo={categoria === c} nivel="secundario">
            {ROTULO_CATEGORIA[c]}
          </Chip>
        ))}
      </ChipLinha>

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
          <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
            {g.itens.map((l) => {
              // Canvas tela-3e — a anatomia da linha: "09/08 · Posto
              // Verolme · pago". Fornecedor quando existe (é como o dono
              // lembra do gasto), categoria como reserva; "recorrente"
              // quando veio de série; o estado em minúscula fechando a
              // frase, com o tom da tela (`estadoDaLinha`, com teste).
              const estado = estadoDaLinha(l, hoje)
              const corEstado = estado.tom === "critico" ? "text-crit" : estado.tom === "aviso" ? "text-warn" : ""
              return (
                <LinhaLista
                  key={l.id}
                  href={`/financeiro/lancamentos/${l.id}`}
                  titulo={l.descricao}
                  subtitulo={
                    <>
                      <span className="tabular-nums tabular-nums">{formatarDataCurta(l.data)}</span>
                      {" · "}{l.fornecedor || ROTULO_CATEGORIA[l.categoria]}
                      {l.recorrencia_id && " · recorrente"}
                      {" · "}<span className={corEstado}>{estado.texto}</span>
                      {l.carteira_movimento_id && " · via Carteira"}
                    </>
                  }
                  // Coluna de dinheiro em mono tabular, sem "R$" repetido —
                  // entrada com "+" e verde; pendente esmaece até virar fato.
                  valor={valorDaLinha(l.tipo, l.valor_centavos)}
                  valorClassName={l.tipo === "entrada" ? "text-ok" : l.status === "pendente" ? "text-dim" : ""}
                />
              )
            })}
          </div>
        </section>
      ))}

      {grupos.length > 0 && (
        <p className="apoio mt-3 text-dim">
          Só lançamento pago entra no total do mês — conta a vencer não é dinheiro que saiu.
        </p>
      )}
    </main>
  )
}
