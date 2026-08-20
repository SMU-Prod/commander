import Link from "next/link"
import { redirect } from "next/navigation"
import { Farol } from "@/components/farol"
import { Icone } from "@/components/icone"
import { Abas } from "@/components/ui/abas"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { HeroiTecnico } from "@/components/ui/heroi-tecnico"
import { NumerosDoHub } from "@/components/ui/numeros-do-hub"
import { carregarPainel, hojeISO, itemMonitoradoToItemCalc } from "@/lib/consultas"
import { abaDoEquipamento, TIPO_ROTULO } from "@/lib/domain/diario"
import { formatarReais } from "@/lib/domain/gastos"
import { calcularSemaforo, formatarDataCurta, PESO, type StatusFarol } from "@/lib/domain/semaforo"
import { podeEditar, podeVer } from "@/lib/domain/permissoes"
import { supabaseServer } from "@/lib/supabase/server"
import type { Evento } from "@/lib/db/types"

/**
 * Hub Equipamentos (PRD §17) — "área flexível": o que existe a bordo e o dono
 * quer acompanhar, mas não é motor, elétrica, hidráulica nem segurança.
 * Bote, guincho, ar-condicionado, VHF, dessalinizador.
 *
 * Por que a tela existe: a onda 32 já deu a estes equipamentos (`tipo =
 * "outro"`) uma área própria na matriz de permissões e na RLS
 * (`aba_do_equipamento`), mas eles continuaram listados em Elétrica — quem
 * tinha só Equipamentos liberado não tinha onde vê-los, e quem tinha só
 * Elétrica via na tela coisas que o banco recusava salvar.
 */
/**
 * ONDA 135 — AS ABAS DO PILOTO (`/barco/motores`, onda 128) NESTE HUB.
 * Três abas, todas com dado real: Visão geral (a lista de equipamentos, que
 * era a tela inteira), Histórico (eventos do Diário pendurados nestes
 * equipamentos — consulta só quando a aba abre) e Alertas (o que o semáforo
 * acusa, direto do painel).
 */
const ABAS_EQUIPAMENTOS = ["geral", "historico", "alertas"] as const
type AbaEquipamentos = (typeof ABAS_EQUIPAMENTOS)[number]

export default async function EquipamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string }>
}) {
  const { aba: abaBruta } = await searchParams
  const aba = (ABAS_EQUIPAMENTOS.some((a) => a === abaBruta) ? abaBruta : "geral") as AbaEquipamentos

  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (!podeVer(painel.permissoes, "equipamentos")) {
    redirect(`/hoje?erro=${encodeURIComponent("Seu acesso não inclui os equipamentos.")}`)
  }
  const editavel = podeEditar(painel.permissoes, "equipamentos")
  const hoje = hojeISO()
  const equipamentos = painel.equipamentos.filter((e) => abaDoEquipamento(e.tipo) === "equipamentos")

  const statusDe = (eqId: string): StatusFarol =>
    painel.itens
      .filter((i) => i.equipamento_id === eqId)
      .map((i) => {
        const eq = painel.equipamentos.find((e) => e.id === eqId)
        return calcularSemaforo(itemMonitoradoToItemCalc(i), eq?.horas_atuais ?? null, hoje).status
      })
      .sort((a, b) => PESO[b] - PESO[a])[0] ?? "ok"

  // ONDA 109 — os números da trinca. Recorte por ITEM e não por equipamento:
  // "Atenção" conta o que vence, não quantas máquinas existem.
  // ONDA 135 — o estado de cada item sobe pra cá, calculado uma vez e lido
  // pela trinca, pela contagem da aba e pela aba Alertas.
  const itensDaArea = painel.itens.filter((i) => equipamentos.some((e) => e.id === i.equipamento_id))
  const itensComEstado = itensDaArea.map((i) => {
    const eq = equipamentos.find((e) => e.id === i.equipamento_id)
    return { item: i, estado: calcularSemaforo(itemMonitoradoToItemCalc(i), eq?.horas_atuais ?? null, hoje).status }
  })
  const emAlerta = itensComEstado.filter((x) => x.estado !== "ok")
  const pedemAtencao = emAlerta.length

  // O nome que a própria lista usa: identificação interna primeiro, marca e
  // modelo como sobrenome — a mesma régua das linhas da Visão geral.
  const nomeDo = (id: string | null) => {
    const e = equipamentos.find((x) => x.id === id)
    if (!e) return "Equipamento"
    return e.identificacao_interna || [e.marca, e.modelo].filter(Boolean).join(" ") || "Equipamento"
  }

  // O HISTÓRICO só desce do banco quando a aba dele está aberta — as outras
  // duas respondem com o `painel` que já está em mãos (padrão do piloto).
  let historico: Pick<Evento, "id" | "tipo" | "data" | "descricao" | "custo_centavos" | "horas_no_momento" | "equipamento_id">[] = []
  if (aba === "historico" && equipamentos.length > 0) {
    const supabase = await supabaseServer()
    const { data } = await supabase
      .from("eventos")
      .select("id, tipo, data, descricao, custo_centavos, horas_no_momento, equipamento_id")
      .eq("embarcacao_id", painel.embarcacao.id)
      .in("equipamento_id", equipamentos.map((e) => e.id))
      .order("data", { ascending: false })
      .limit(30)
    historico = data ?? []
  }

  return (
    <main>
      {/* ONDA 104 (§8 do Guia) — cabeçalho padrão, com a identidade do hub. */}
      <CabecalhoDetalhe
        voltarHref="/barco"
        voltarRotulo="Barco"
        hub="equipamentos"
        acao={editavel ? (
          <Link
            href="/barco/equipamento/novo?tipo=outro"
            className="inline-flex min-h-[var(--altura-controle)] shrink-0 items-center gap-1 rounded-[var(--raio-pilula)] bg-accent px-4 corpo font-semibold text-acao-texto"
          >
            <Icone nome="mais" className="size-4" /> Equipamento
          </Link>
        ) : undefined}
      />

      {/* ONDA 105 — o objeto grande do topo, como nas oito imagens do guia.
          É ilustração técnica, não render 3D nem foto: ver o cabeçalho de
          `components/ui/heroi-tecnico.tsx` e o desvio de biblioteca de assets
          registrado em `docs/DESIGN-SYSTEM.md`. */}
      <HeroiTecnico chave="equipamentos" className="mt-5 mb-4" />

      {/* ONDA 135 — as abas do piloto, com a pílula ativa na cor DESTE hub.
          Contagem só em Alertas, que custa zero (sai do painel); Histórico
          não mostra número de propósito — contá-lo obrigaria a consulta que
          a aba fechada existe pra não pagar. */}
      <Abas
        className="mb-4"
        ativa={aba}
        pilula
        classeAtiva="border-transparent bg-hub-equipamentos font-semibold text-acao-texto"
        abas={[
          { valor: "geral", rotulo: "Visão geral", href: "/barco/equipamentos" },
          { valor: "historico", rotulo: "Histórico", href: "/barco/equipamentos?aba=historico" },
          { valor: "alertas", rotulo: "Alertas", href: "/barco/equipamentos?aba=alertas", contagem: pedemAtencao },
        ]}
      />

      {aba === "geral" && (
        <>
          <NumerosDoHub
            chave="equipamentos"
            className="mb-4"
            numeros={[
              { rotulo: "Equipamentos", valor: String(equipamentos.length), icone: "ferramenta" },
              { rotulo: "Manutenções", valor: String(itensDaArea.length), icone: "relogio" },
              {
                rotulo: "Atenção",
                valor: String(pedemAtencao),
                icone: "alerta",
                estado: pedemAtencao > 0 ? "atencao" : undefined,
              },
            ]}
          />

          <div className="sombra-1 mt-6 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
            {equipamentos.length === 0 && (
              <div className="py-2">
                <EstadoVazio
                  icone="ferramenta"
                  titulo="Nada cadastrado ainda"
                  descricao="Cadastre o que tem manutenção própria e o app passa a avisar dos vencimentos junto com o resto."
                />
              </div>
            )}
            {equipamentos.map((e) => {
              const itens = painel.itens.filter((i) => i.equipamento_id === e.id)
              return (
                <Link key={e.id} href={`/barco/equipamento/${e.id}`}
                  className="flex items-center gap-3 border-b border-line py-3.5 last:border-0">
                  <Farol status={statusDe(e.id)} />
                  <div className="min-w-0 flex-1">
                    <p className="titulo-card">
                      {e.identificacao_interna || [e.marca, e.modelo].filter(Boolean).join(" ") || "Equipamento"}
                      {e.quantidade != null ? ` · ${e.quantidade}×` : ""}
                    </p>
                    <p className="apoio mt-0.5 text-dim">
                      {/* quando a identificação interna já é o título, marca e
                          modelo descem pra cá em vez de sumir da tela */}
                      {(e.identificacao_interna ? [e.marca, e.modelo].filter(Boolean).join(" ") : "") || "Sem marca informada"}
                      {` · ${itens.length} ${itens.length === 1 ? "item" : "itens"}`}
                    </p>
                  </div>
                  <Icone nome="chevron" className="size-4 text-dim" />
                </Link>
              )
            })}
          </div>
        </>
      )}

      {aba === "historico" && (
        historico.length === 0 ? (
          <EstadoVazio
            className="mt-6"
            icone="calendario"
            titulo="Nenhum registro dos equipamentos no Diário"
            descricao="Manutenção e avaria registradas no Diário de Bordo com um destes equipamentos apontado aparecem aqui."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {historico.map((e) => (
              <div key={e.id} className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-3">
                <p className="rotulo-dado tabular-nums text-dim">
                  {formatarDataCurta(e.data)} · {TIPO_ROTULO[e.tipo] ?? e.tipo} · {nomeDo(e.equipamento_id)}
                </p>
                <p className="titulo-card mt-0.5">{e.descricao?.trim() || (TIPO_ROTULO[e.tipo] ?? e.tipo)}</p>
                {(e.horas_no_momento != null || e.custo_centavos != null) && (
                  <p className="apoio mt-1 text-dim">
                    {e.horas_no_momento != null && (
                      <>horímetro <span className="tabular-nums text-texto">{e.horas_no_momento.toLocaleString("pt-BR")} h</span></>
                    )}
                    {e.horas_no_momento != null && e.custo_centavos != null && " · "}
                    {e.custo_centavos != null && (
                      <span className="tabular-nums text-texto">{formatarReais(e.custo_centavos)}</span>
                    )}
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
            titulo="Nenhum alerta nos equipamentos"
            descricao="Tudo que o semáforo vigia está em dia. Alerta aparece aqui quando uma manutenção vence ou encosta no prazo."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {/* ONDA 135 — vidro tintado pelo estado, na dose (a régua está em
                app/(app)/diario/page.tsx, no card de avaria): vencido tinge
                de crítico, atenção de âmbar — tinta 10→5% + borda 35%, e SÓ
                aqui, porque esta aba É o alarme. */}
            {emAlerta.map(({ item, estado }) => (
              <Link
                key={item.id}
                href={`/barco/equipamento/${item.equipamento_id}`}
                className={`sombra-1 flex items-center gap-3 rounded-[var(--raio-cartao)] border bg-panel p-3 ${
                  estado === "vencido"
                    ? "border-crit/35 bg-gradient-to-b from-crit/10 to-crit/5"
                    : "border-warn/35 bg-gradient-to-b from-warn/10 to-warn/5"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="titulo-card truncate">{item.nome}</p>
                  <p className="apoio mt-0.5 text-dim">{nomeDo(item.equipamento_id)}</p>
                </div>
                <Farol status={estado} />
                <Icone nome="chevron" className="size-4 shrink-0 text-dim" />
              </Link>
            ))}
          </div>
        )
      )}
    </main>
  )
}
