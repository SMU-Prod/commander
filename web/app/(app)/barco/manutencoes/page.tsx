import Link from "next/link"
import { redirect } from "next/navigation"
import { Farol } from "@/components/farol"
import { Icone } from "@/components/icone"
import { Abas } from "@/components/ui/abas"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { LinhaLista } from "@/components/ui/linha-lista"
import { HeroiTecnico } from "@/components/ui/heroi-tecnico"
import { AcaoDoHub, NumerosDoHub } from "@/components/ui/numeros-do-hub"
import { carregarPainel, hojeISO, itemMonitoradoToItemCalc } from "@/lib/consultas"
import { TIPO_ROTULO } from "@/lib/domain/diario"
import { formatarReais } from "@/lib/domain/gastos"
import { podeEditar, podeVer } from "@/lib/domain/permissoes"
import { calcularSemaforo, formatarDataCurta, PESO, vencimentoPorData } from "@/lib/domain/semaforo"
import { supabaseServer } from "@/lib/supabase/server"
import type { Evento } from "@/lib/db/types"

/**
 * ONDA 101 — O HUB "MANUTENÇÕES", oitavo card da central técnica (spec §3).
 *
 * É o que a /barco chamava de "Outras manutenções": o item que vence e não
 * pertence a motor, elétrica, casco, hidráulica, segurança nem documento — o
 * que o formulário grava quando a pessoa escolhe "Embarcação (geral)" em
 * "Pertence a". Mesmo recorte do card que abre esta tela
 * (`categoria === null && equipamento_id === null`), pra porta e sala nunca
 * discordarem no número.
 *
 * ORDENADO PELO QUE APERTA PRIMEIRO, e isto é diferente da /barco, que
 * mostrava na ordem do banco: numa lista de manutenção o vencido tem que estar
 * em cima. `PESO` é a mesma escala de gravidade que o semáforo usa no app
 * inteiro; o desempate é o menor prazo. Nenhum valor muda — muda a ordem.
 */
/**
 * ONDA 135 — AS ABAS DO PILOTO (`/barco/motores`, onda 128) NESTE HUB.
 * O mock segmenta em "Próximas · Em andamento · Concluídas". "Em andamento"
 * fica de fora até existir o dado: manutenção pendurada na embarcação não tem
 * estado de execução em lugar nenhum do banco — aba apontando pra nada é a
 * mentira que o §6 proíbe. Entram as três que o produto responde: Próximas
 * (tudo que está pendurado, vencido em cima — é a lista que a tela sempre
 * foi), Concluídas (os eventos de manutenção da embarcação-geral no Diário,
 * consulta só quando a aba abre) e Alertas (o recorte do que o semáforo
 * acusa). A padrão é "proximas" — este hub não tem "Visão geral" porque a
 * lista É a visão geral dele.
 */
const ABAS_MANUTENCOES = ["proximas", "concluidas", "alertas"] as const
type AbaManutencoes = (typeof ABAS_MANUTENCOES)[number]

export default async function ManutencoesPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string }>
}) {
  const { aba: abaBruta } = await searchParams
  const aba = (ABAS_MANUTENCOES.some((a) => a === abaBruta) ? abaBruta : "proximas") as AbaManutencoes

  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (!podeVer(painel.permissoes, "embarcacao")) {
    redirect(`/hoje?erro=${encodeURIComponent("Seu acesso não inclui as manutenções gerais.")}`)
  }
  const editavel = podeEditar(painel.permissoes, "embarcacao")
  const hoje = hojeISO()

  const linhas = painel.itens
    .filter((i) => i.categoria === null && i.equipamento_id === null)
    .map((i) => {
      const calc = itemMonitoradoToItemCalc(i)
      return { item: i, r: calcularSemaforo(calc, null, hoje), venc: vencimentoPorData(calc) }
    })
    .sort((a, b) =>
      PESO[b.r.status] - PESO[a.r.status]
      || (a.r.diasRestantes ?? Infinity) - (b.r.diasRestantes ?? Infinity))
  const vencidas = linhas.filter((l) => l.r.status === "vencido").length
  const emAlerta = linhas.filter((l) => l.r.status !== "ok")

  // AS CONCLUÍDAS só descem do banco quando a aba delas está aberta (padrão
  // do histórico do piloto). O recorte espelha o dos itens desta tela:
  // manutenção SEM equipamento e SEM categoria — o que foi registrado no
  // Diário como coisa da embarcação inteira.
  let concluidas: Pick<Evento, "id" | "tipo" | "data" | "descricao" | "custo_centavos">[] = []
  if (aba === "concluidas") {
    const supabase = await supabaseServer()
    const { data } = await supabase
      .from("eventos")
      .select("id, tipo, data, descricao, custo_centavos")
      .eq("embarcacao_id", painel.embarcacao.id)
      .eq("tipo", "manutencao")
      .is("equipamento_id", null)
      .is("categoria", null)
      .order("data", { ascending: false })
      .limit(30)
    concluidas = data ?? []
  }

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref="/barco"
        voltarRotulo="Barco"
        hub="manutencoes"
        acao={editavel ? (
          <Link
            href="/barco/itens/novo"
            className="inline-flex min-h-[var(--altura-controle)] shrink-0 items-center gap-1 rounded-[var(--raio-pilula)] bg-accent px-4 corpo font-semibold text-acao-texto"
          >
            <Icone nome="mais" className="size-4" /> Manutenção
          </Link>
        ) : undefined}
      />

      {/* ONDA 105 — o objeto grande do topo, como nas oito imagens do guia.
          É ilustração técnica, não render 3D nem foto: ver o cabeçalho de
          `components/ui/heroi-tecnico.tsx` e o desvio de biblioteca de assets
          registrado em `docs/DESIGN-SYSTEM.md`. */}
      <HeroiTecnico chave="manutencoes" className="mt-5 mb-4" />

      {/* ONDA 135 — as abas do piloto, com a pílula ativa na cor DESTE hub.
          Contagem em Próximas e Alertas porque as duas custam zero (saem do
          painel); Concluídas não mostra número de propósito — contá-lo
          obrigaria a consulta que a aba fechada existe pra não pagar. */}
      <Abas
        className="mb-4"
        ativa={aba}
        pilula
        classeAtiva="border-transparent bg-hub-manutencoes font-semibold text-acao-texto"
        abas={[
          { valor: "proximas", rotulo: "Próximas", href: "/barco/manutencoes", contagem: linhas.length },
          { valor: "concluidas", rotulo: "Concluídas", href: "/barco/manutencoes?aba=concluidas" },
          { valor: "alertas", rotulo: "Alertas", href: "/barco/manutencoes?aba=alertas", contagem: emAlerta.length },
        ]}
      />

      {aba === "proximas" && (
        <>
          {/* ONDA 109 — a trinca da imagem 3, com os números que ESTA tela tem.
              "Vencidas" é o único que vira cor de estado, e só acima de zero. */}
          <NumerosDoHub
            chave="manutencoes"
            className="mb-4"
            numeros={[
              { rotulo: "Itens", valor: String(linhas.length), icone: "relogio" },
              { rotulo: "Em dia", valor: String(linhas.filter((l) => l.r.status === "ok").length), icone: "check" },
              {
                rotulo: "Vencidas",
                valor: String(vencidas),
                icone: "alerta",
                estado: vencidas > 0 ? "critico" : undefined,
              },
            ]}
          />

          {editavel && (
            <AcaoDoHub chave="manutencoes" href="/barco/itens/novo" className="mb-6">
              Cadastrar manutenção
            </AcaoDoHub>
          )}

          {linhas.length === 0 ? (
            <EstadoVazio
              className="mt-6"
              icone="relogio"
              titulo="Nenhuma outra manutenção cadastrada ainda"
              descricao="Antifouling, revisão do gerador de emergência, limpeza de tanque — qualquer coisa que vença por horas ou por data."
              acao={editavel ? { href: "/barco/itens/novo", rotulo: "Cadastrar manutenção" } : undefined}
            />
          ) : (
            <div className="sombra-1 mt-6 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
              {linhas.map(({ item, r, venc }) => {
                const dias = r.diasRestantes != null
                  ? r.diasRestantes < 0 ? `vencido há ${-r.diasRestantes} d` : `${r.diasRestantes} dias`
                  : "—"
                return (
                  <LinhaLista
                    key={item.id}
                    href={editavel ? `/barco/itens/${item.id}/editar` : undefined}
                    leading={<Farol status={r.status} />}
                    titulo={item.nome}
                    valor={`${dias}${venc ? ` · ${formatarDataCurta(venc)}` : ""}`}
                    valorClassName={r.status === "vencido" ? "text-crit" : r.status === "atencao" ? "text-warn" : "text-dim"}
                  />
                )
              })}
            </div>
          )}
        </>
      )}

      {aba === "concluidas" && (
        concluidas.length === 0 ? (
          <EstadoVazio
            className="mt-6"
            icone="calendario"
            titulo="Nenhuma manutenção geral registrada no Diário"
            descricao="Registre a manutenção feita no Diário de Bordo — sem apontar equipamento nem categoria — e o histórico dela aparece aqui."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {concluidas.map((e) => (
              <div key={e.id} className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-3">
                <p className="rotulo-dado tabular-nums text-dim">
                  {formatarDataCurta(e.data)} · {TIPO_ROTULO[e.tipo] ?? e.tipo}
                </p>
                <p className="titulo-card mt-0.5">{e.descricao?.trim() || (TIPO_ROTULO[e.tipo] ?? e.tipo)}</p>
                {e.custo_centavos != null && (
                  <p className="apoio mt-1 text-dim">
                    <span className="tabular-nums text-texto">{formatarReais(e.custo_centavos)}</span>
                  </p>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {aba === "alertas" && (
        emAlerta.length === 0 ? (
          <EstadoVazio
            className="mt-6"
            icone="seguranca"
            titulo="Nenhum alerta nas manutenções gerais"
            descricao="Tudo que o semáforo vigia está em dia. Alerta aparece aqui quando uma manutenção vence ou encosta no prazo."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {/* ONDA 135 — vidro tintado pelo estado, na dose (a régua está em
                app/(app)/diario/page.tsx, no card de avaria): vencido tinge de
                crítico, atenção de âmbar — tinta 10→5% + borda 35%, e SÓ aqui,
                porque esta aba É o alarme. Manutenção geral só tem tela de
                edição, então o card vira link apenas pra quem pode editar. */}
            {emAlerta.map(({ item, r, venc }) => {
              const dias = r.diasRestantes != null
                ? r.diasRestantes < 0 ? `vencido há ${-r.diasRestantes} d` : `${r.diasRestantes} dias`
                : null
              const casca = `sombra-1 flex items-center gap-3 rounded-[var(--raio-cartao)] border bg-panel p-3 ${
                r.status === "vencido"
                  ? "border-crit/35 bg-gradient-to-b from-crit/10 to-crit/5"
                  : "border-warn/35 bg-gradient-to-b from-warn/10 to-warn/5"
              }`
              const miolo = (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="titulo-card truncate">{item.nome}</p>
                    <p className="apoio mt-0.5 text-dim">
                      {[dias, venc ? formatarDataCurta(venc) : null].filter(Boolean).join(" · ") || "Sem prazo informado"}
                    </p>
                  </div>
                  <Farol status={r.status} />
                  {editavel && <Icone nome="chevron" className="size-4 shrink-0 text-dim" />}
                </>
              )
              return editavel ? (
                <Link key={item.id} href={`/barco/itens/${item.id}/editar`} className={casca}>{miolo}</Link>
              ) : (
                <div key={item.id} className={casca}>{miolo}</div>
              )
            })}
          </div>
        )
      )}
    </main>
  )
}
