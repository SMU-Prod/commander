import { redirect } from "next/navigation"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { Campo, CampoSelect } from "@/components/ui/campo"
import { DonutNivel } from "@/components/ui/donut-nivel"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { Selo } from "@/components/ui/selo"
import { criarTanque, movimentarTanque } from "@/lib/acoes/enterprise"
import { carregarPainel } from "@/lib/consultas"
import {
  divergenciaDoTanque, formatarLitros, saldoTeorico,
} from "@/lib/domain/estoque-combustivel"
import { formatarReais } from "@/lib/domain/gastos"
import { supabaseServer } from "@/lib/supabase/server"
import { ACAO_NAO_ESTICA } from "@/lib/ui/superficies"

/**
 * HUB COMBUSTÍVEL (onda 78 — PRD §11).
 *
 * O centro da tela é o BALANÇO: saldo inicial + entradas − saídas = teórico,
 * comparado com a última medição da régua. É a conta que o §11 pede e a única
 * que revela combustível sumindo.
 *
 * O saldo teórico é calculado a cada abertura, nunca guardado — número
 * derivado que se guarda é número que sai de sincronia (migration 064).
 */
export default async function CombustivelPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")

  const supabase = await supabaseServer()
  const [{ data: tanques }, { data: movimentos }] = await Promise.all([
    supabase.from("tanques").select("*").order("nome"),
    supabase.from("tanque_movimentos").select("*").order("criado_em", { ascending: false }).limit(200),
  ])

  type Tanque = {
    id: string; nome: string; combustivel: string | null
    capacidade_litros: number | null; saldo_inicial_litros: number; minimo_litros: number | null
  }
  type Mov = {
    id: string; tanque_id: string; tipo: "entrada" | "saida" | "medicao"
    litros: number; destino_livre: string | null; destino_embarcacao_id: string | null
    valor_centavos: number | null; motivo: string | null; criado_em: string
  }

  const lista = (tanques ?? []) as Tanque[]
  const movs = (movimentos ?? []) as Mov[]

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref="/menu"
        voltarRotulo="Menu"
        titulo="Combustível"
        descricao="Tanque próprio, abastecimentos e o balanço entre a conta e a régua."
      />
      {erro && <p className="corpo mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      {lista.length === 0 ? (
        <EstadoVazio
          icone="oleo"
          titulo="Nenhum tanque cadastrado"
          descricao="Cadastre o tanque da base abaixo para acompanhar entrada, saída e balanço."
          className="mt-4"
        />
      ) : (
        lista.map((t) => {
          const doTanque = movs.filter((m) => m.tanque_id === t.id)
          const entradas = doTanque.filter((m) => m.tipo === "entrada").reduce((s, m) => s + Number(m.litros), 0)
          const saidas = doTanque.filter((m) => m.tipo === "saida").reduce((s, m) => s + Number(m.litros), 0)
          const teorico = saldoTeorico(Number(t.saldo_inicial_litros), entradas, saidas)
          // A medição mais recente é a primeira da lista (ordenada desc).
          const ultimaMedicao = doTanque.find((m) => m.tipo === "medicao")
          const div = ultimaMedicao ? divergenciaDoTanque(teorico, Number(ultimaMedicao.litros)) : null
          const abaixoDoMinimo = t.minimo_litros != null && teorico <= Number(t.minimo_litros)

          return (
            <section key={t.id}>
              <SecaoPagina icone="oleo">{t.nome}</SecaoPagina>

              {/* Onda 79 (instrumentos) — troca da barra fina desenhada à mão
                  pelo `DonutNivel` (spec §2 item 2, "Fuel level 3.61 gal" da
                  referência): mesma leitura de tanque, agora com o líquido.
                  `percentual` só existe quando o tanque tem capacidade
                  cadastrada — sem capacidade não há teto pra medir contra, e
                  o donut mostra o litro real sem inventar o anel (§7). O
                  "abaixo do mínimo" continua como `Selo`, e não como cor do
                  próprio donut: o líquido do donut é sempre dourado (é assim
                  na referência, tanque não fica vermelho) — quem carrega o
                  alarme operacional é o selo ao lado, igual ao chip de canto
                  do velocímetro. */}
              <div className="sombra-1 relative rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
                {abaixoDoMinimo && (
                  <div className="absolute right-4 top-4 z-10">
                    <Selo estado="atencao">Abaixo do mínimo</Selo>
                  </div>
                )}
                <DonutNivel
                  valor={teorico}
                  unidade="L"
                  percentual={
                    t.capacidade_litros != null
                      ? Math.round((teorico / Number(t.capacidade_litros)) * 100)
                      : null
                  }
                  apoio={t.minimo_litros != null ? `mín. ${formatarLitros(Number(t.minimo_litros))}` : undefined}
                  rotulo={`Saldo teórico de ${t.nome}`}
                />
                <p className="apoio mt-2 text-dim">
                  Inicial <span className="font-mono-instr tabular-nums">{formatarLitros(Number(t.saldo_inicial_litros))}</span>
                  {" · entradas "}<span className="font-mono-instr tabular-nums text-ok">+{formatarLitros(entradas)}</span>
                  {" · saídas "}<span className="font-mono-instr tabular-nums">−{formatarLitros(saidas)}</span>
                </p>

                {/* A comparação com a régua — o coração do §11. */}
                {div && (
                  <p className={`apoio mt-2 ${div.exigeMotivo ? "text-warn" : "text-dim"}`}>
                    Última medição: <span className="font-mono-instr tabular-nums">{formatarLitros(div.fisico)}</span>
                    {" — "}{div.frase}
                  </p>
                )}
              </div>

              <form action={movimentarTanque} className="sombra-1 mt-2 space-y-3 rounded-[14px] border border-line bg-panel p-4">
                <input type="hidden" name="tanque_id" value={t.id} />
                {/* O teórico viaja junto pra action saber se a medição
                    diverge sem recalcular o balanço inteiro. */}
                <input type="hidden" name="teorico" value={teorico} />
                <div className="grid grid-cols-2 gap-3">
                  <CampoSelect label="Movimento" id={`tipo-${t.id}`} name="tipo">
                    <option value="entrada">Entrada de combustível</option>
                    <option value="saida">Saída para unidade</option>
                    <option value="medicao">Medição da régua</option>
                  </CampoSelect>
                  <Campo label="Litros" id={`litros-${t.id}`} name="litros" inputMode="decimal" className="font-mono-instr tabular-nums" />
                </div>
                <CampoSelect
                  label="Destino — obrigatório na saída"
                  id={`destino-${t.id}`}
                  name="destino_embarcacao_id"
                  defaultValue=""
                >
                  <option value="">Escolha a unidade</option>
                  {painel.embarcacoes.map((e) => (
                    <option key={e.id} value={e.id}>{e.nome}</option>
                  ))}
                </CampoSelect>
                <Campo
                  label="Ou outro destino"
                  id={`destino-livre-${t.id}`}
                  name="destino_livre"
                  placeholder="Ex.: caminhão da marina"
                />
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Fornecedor" id={`forn-${t.id}`} name="fornecedor" />
                  <Campo label="Valor (R$)" id={`valor-${t.id}`} name="valor" inputMode="decimal" className="font-mono-instr tabular-nums" />
                </div>
                <Campo
                  label="Motivo"
                  id={`motivo-${t.id}`}
                  name="motivo"
                  dica="Obrigatório quando a medição não bate com o teórico."
                />
                <button className={`${ACAO_NAO_ESTICA} rounded-xl border border-line py-3 text-sm font-semibold`}>
                  Registrar movimento
                </button>
              </form>

              {doTanque.length > 0 && (
                <div className="sombra-1 mt-2 rounded-[14px] border border-line bg-panel px-4">
                  {doTanque.slice(0, 8).map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-2 border-b border-line py-3 last:border-0">
                      <span className="min-w-0">
                        <span className="corpo block truncate">
                          {m.tipo === "entrada" ? "Entrada" : m.tipo === "saida" ? "Saída" : "Medição"}
                          {m.destino_livre && ` · ${m.destino_livre}`}
                        </span>
                        <span className="apoio block text-dim">
                          <span className="font-mono-instr tabular-nums">
                            {new Date(m.criado_em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                          </span>
                          {m.motivo && ` · ${m.motivo}`}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block font-mono-instr text-sm tabular-nums">
                          {m.tipo === "saida" ? "−" : m.tipo === "entrada" ? "+" : ""}
                          {formatarLitros(Number(m.litros))}
                        </span>
                        {m.valor_centavos != null && (
                          <span className="apoio block font-mono-instr tabular-nums text-dim">
                            {formatarReais(m.valor_centavos)}
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )
        })
      )}

      <SecaoPagina icone="mais">Novo tanque</SecaoPagina>
      <form action={criarTanque} className="sombra-1 space-y-3 rounded-[14px] border border-line bg-panel p-4">
        <Campo label="Nome" id="nome" name="nome" placeholder="Ex.: Tanque da base — Marina da Glória" />
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Combustível" id="combustivel" name="combustivel" placeholder="Gasolina" />
          <Campo label="Capacidade (L)" id="capacidade" name="capacidade" inputMode="decimal" className="font-mono-instr tabular-nums" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Saldo inicial (L)" id="saldo_inicial" name="saldo_inicial" inputMode="decimal" className="font-mono-instr tabular-nums" />
          <Campo label="Mínimo (L)" id="minimo" name="minimo" inputMode="decimal" className="font-mono-instr tabular-nums" />
        </div>
        <button className={`${ACAO_NAO_ESTICA} rounded-xl border border-line py-3 text-sm font-semibold`}>
          Cadastrar tanque
        </button>
      </form>
    </main>
  )
}
