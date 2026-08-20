import Link from "next/link"
import { redirect } from "next/navigation"
import { Farol, FarolOcorrencia } from "@/components/farol"
import { Icone } from "@/components/icone"
import { Abas } from "@/components/ui/abas"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { LinhaLista } from "@/components/ui/linha-lista"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { HeroiTecnico } from "@/components/ui/heroi-tecnico"
import { AcaoDoHub, NumerosDoHub } from "@/components/ui/numeros-do-hub"
import { carregarPainel, hojeISO, itemMonitoradoToItemCalc } from "@/lib/consultas"
import { CATEGORIAS_HIDRAULICA, ROTULO_HIDRAULICA, TIPO_ROTULO } from "@/lib/domain/diario"
import { formatarReais } from "@/lib/domain/gastos"
import { ESTADOS_QUE_PESAM_NA_SAUDE, ROTULO_ESTADO } from "@/lib/domain/ocorrencias"
import { podeEditar, podeVer } from "@/lib/domain/permissoes"
import { calcularSemaforo, formatarDataCurta, vencimentoPorData } from "@/lib/domain/semaforo"
import { supabaseServer } from "@/lib/supabase/server"
import type { Evento, Ocorrencia } from "@/lib/db/types"

/**
 * ONDA 135 — AS ABAS DO PILOTO (`/barco/motores`, onda 128) NESTE HUB.
 * Três abas, todas com dado real: Visão geral (ocorrências abertas + as três
 * categorias, o que a tela já mostrava), Histórico (eventos do Diário nas
 * categorias da hidráulica — consulta só quando a aba abre) e Alertas (o que
 * o semáforo acusa, direto do painel). As ocorrências abertas continuam na
 * Visão geral, que é onde a seção sempre morou: elas têm entidade e tela
 * próprias (/barco/ocorrencias), e a aba Alertas é o recorte do SEMÁFORO —
 * misturar as duas contagens faria o número da pílula depender de uma
 * consulta que as outras abas não pagam.
 */
const ABAS_HIDRAULICA = ["geral", "historico", "alertas"] as const
type AbaHidraulica = (typeof ABAS_HIDRAULICA)[number]

export default async function HidraulicaPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string }>
}) {
  const { aba: abaBruta } = await searchParams
  const aba = (ABAS_HIDRAULICA.some((a) => a === abaBruta) ? abaBruta : "geral") as AbaHidraulica

  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (!podeVer(painel.permissoes, "hidraulica")) {
    redirect(`/hoje?erro=${encodeURIComponent("Seu acesso não inclui a hidráulica.")}`)
  }
  const editavel = podeEditar(painel.permissoes, "hidraulica")
  const hoje = hojeISO()
  const itens = painel.itens.filter((i) => (CATEGORIAS_HIDRAULICA as readonly string[]).includes(i.categoria ?? ""))

  // ONDA 135 — as ocorrências só descem do banco quando a Visão geral está
  // aberta: é a única aba que as desenha (padrão do histórico do piloto —
  // consulta extra só quando a aba dela abre).
  let ocorrencias: Ocorrencia[] = []
  if (aba === "geral") {
    const supabase = await supabaseServer()
    const { data: ocorrenciasBrutas } = await supabase.from("ocorrencias")
      .select("*").eq("embarcacao_id", painel.embarcacao.id).eq("aba", "hidraulica")
      .in("estado", [...ESTADOS_QUE_PESAM_NA_SAUDE]).order("created_at", { ascending: false })
    ocorrencias = (ocorrenciasBrutas ?? []) as Ocorrencia[]
  }

  // ONDA 109 — a trinca da imagem 3. Mesma régua da lista abaixo
  // (`calcularSemaforo`), calculada uma vez: número do topo que discorda das
  // linhas de baixo é o defeito que a onda 92 já pagou uma vez.
  // ONDA 135 — o resultado por item fica guardado, porque agora três leitores
  // o consomem: a trinca, a contagem da pílula e a aba Alertas.
  const avaliados = itens.map((i) => ({ item: i, r: calcularSemaforo(itemMonitoradoToItemCalc(i), null, hoje) }))
  const emDia = avaliados.filter((a) => a.r.status === "ok").length
  const emAlerta = avaliados.filter((a) => a.r.status !== "ok")
  const pedemAtencao = emAlerta.length

  // O HISTÓRICO só desce do banco quando a aba dele está aberta.
  let historico: Pick<Evento, "id" | "tipo" | "data" | "descricao" | "custo_centavos" | "categoria">[] = []
  if (aba === "historico") {
    const supabase = await supabaseServer()
    const { data } = await supabase
      .from("eventos")
      .select("id, tipo, data, descricao, custo_centavos, categoria")
      .eq("embarcacao_id", painel.embarcacao.id)
      .in("categoria", [...CATEGORIAS_HIDRAULICA])
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
        hub="hidraulica"
      />

      {/* ONDA 105 — o objeto grande do topo, como nas oito imagens do guia.
          É ilustração técnica, não render 3D nem foto: ver o cabeçalho de
          `components/ui/heroi-tecnico.tsx` e o desvio de biblioteca de assets
          registrado em `docs/DESIGN-SYSTEM.md`. */}
      <HeroiTecnico chave="hidraulica" className="mt-5 mb-4" />

      {/* ONDA 135 — as abas do piloto, com a pílula ativa na cor DESTE hub.
          Contagem só em Alertas, que custa zero (sai do painel); Histórico
          não mostra número de propósito — contá-lo obrigaria a consulta que
          a aba fechada existe pra não pagar. */}
      <Abas
        className="mb-4"
        ativa={aba}
        pilula
        classeAtiva="border-transparent bg-hub-hidraulica font-semibold text-acao-texto"
        abas={[
          { valor: "geral", rotulo: "Visão geral", href: "/barco/hidraulica" },
          { valor: "historico", rotulo: "Histórico", href: "/barco/hidraulica?aba=historico" },
          { valor: "alertas", rotulo: "Alertas", href: "/barco/hidraulica?aba=alertas", contagem: pedemAtencao },
        ]}
      />

      {aba === "geral" && (
        <>
          <NumerosDoHub
            chave="hidraulica"
            className="mb-4"
            numeros={[
              { rotulo: "Itens", valor: String(itens.length), icone: "oleo" },
              { rotulo: "Em dia", valor: String(emDia), icone: "check" },
              {
                rotulo: "Atenção",
                valor: String(pedemAtencao),
                icone: "alerta",
                estado: pedemAtencao > 0 ? "atencao" : undefined,
              },
            ]}
          />

          {editavel && (
            <AcaoDoHub
              chave="hidraulica"
              href={`/barco/itens/novo?alvo=${encodeURIComponent("cat:hidraulica_agua_doce")}`}
              className="mb-6"
            >
              Cadastrar item
            </AcaoDoHub>
          )}

          {ocorrencias.length > 0 && (
            <>
              {/* ONDA 92 (achado 6.1) — "Ver tudo" é o rótulo único do gesto
                  "abrir a seção". Eram oito palavras no app pro mesmo gesto; a
                  exceção continua sendo só o verbo que muda o que acontece de
                  verdade ("Gerenciar", "Editar" — telas de edição, não listas). */}
              <SecaoPagina icone="alerta" acao={{ href: "/barco/ocorrencias?setor=hidraulica", rotulo: "Ver tudo" }}>
                Ocorrências abertas
              </SecaoPagina>
              <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
                {ocorrencias.map((o) => (
                  <LinhaLista
                    key={o.id}
                    href={`/barco/ocorrencias/${o.id}`}
                    leading={<FarolOcorrencia estado={o.estado} />}
                    titulo={o.titulo}
                    valor={ROTULO_ESTADO[o.estado]}
                  />
                ))}
              </div>
            </>
          )}

          {CATEGORIAS_HIDRAULICA.map((c) => {
            const doGrupo = itens.filter((i) => i.categoria === c)
            return (
              <div key={c}>
                <SecaoPagina
                  acao={editavel ? { href: `/barco/itens/novo?alvo=${encodeURIComponent(`cat:${c}`)}`, rotulo: "Adicionar", icone: "mais" } : undefined}
                >
                  {ROTULO_HIDRAULICA[c]}
                </SecaoPagina>
                <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
                  {doGrupo.length === 0 && (
                    <EstadoVazio variant="linha" icone="oleo" titulo="Nada cadastrado ainda" />
                  )}
                  {doGrupo.map((i) => {
                    const r = calcularSemaforo(itemMonitoradoToItemCalc(i), null, hoje)
                    const venc = vencimentoPorData(itemMonitoradoToItemCalc(i))
                    const dias = r.diasRestantes != null
                      ? r.diasRestantes < 0 ? `vencido há ${-r.diasRestantes} d` : `${r.diasRestantes} dias`
                      : "—"
                    return (
                      <LinhaLista
                        key={i.id}
                        href={editavel ? `/barco/itens/${i.id}/editar` : undefined}
                        leading={<Farol status={r.status} />}
                        titulo={i.nome}
                        valor={`${dias}${venc ? ` · ${formatarDataCurta(venc)}` : ""}`}
                        valorClassName={r.status === "vencido" ? "text-crit" : r.status === "atencao" ? "text-warn" : "text-dim"}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })}
        </>
      )}

      {aba === "historico" && (
        historico.length === 0 ? (
          <EstadoVazio
            className="mt-6"
            icone="calendario"
            titulo="Nenhum registro da hidráulica no Diário"
            descricao="Manutenções registradas no Diário de Bordo numa categoria da hidráulica — água doce, grey water, black water — aparecem aqui."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {historico.map((e) => (
              <div key={e.id} className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-3">
                <p className="rotulo-dado tabular-nums text-dim">
                  {formatarDataCurta(e.data)} · {TIPO_ROTULO[e.tipo] ?? e.tipo}
                  {e.categoria != null && ROTULO_HIDRAULICA[e.categoria] ? ` · ${ROTULO_HIDRAULICA[e.categoria]}` : ""}
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
            titulo="Nenhum alerta na hidráulica"
            descricao="Tudo que o semáforo vigia está em dia. Alerta aparece aqui quando um item da hidráulica vence ou encosta no prazo."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {/* ONDA 135 — vidro tintado pelo estado, na dose (a régua está em
                app/(app)/diario/page.tsx, no card de avaria): vencido tinge de
                crítico, atenção de âmbar — tinta 10→5% + borda 35%, e SÓ aqui,
                porque esta aba É o alarme. Item de hidráulica só tem tela de
                edição, então o card vira link apenas pra quem pode editar. */}
            {emAlerta.map(({ item, r }) => {
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
                      {ROTULO_HIDRAULICA[item.categoria ?? ""] ?? "Hidráulica"}
                      {dias ? ` · ${dias}` : ""}
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
