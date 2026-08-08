import Link from "next/link"
import { redirect } from "next/navigation"
import { Icone } from "@/components/icone"
import { carregarPainel } from "@/lib/consultas"
import { duracaoHoras, textoDuracao } from "@/lib/domain/bordo"
import { agruparPorMes, eventoNoFiltro, TIPO_ROTULO, type FiltroDiario } from "@/lib/domain/diario"
import { formatarReais } from "@/lib/domain/gastos"
import { supabaseServer } from "@/lib/supabase/server"
import type { Contato, Evento } from "@/lib/db/types"

const FILTROS: { valor: FiltroDiario; rotulo: string }[] = [
  { valor: "tudo", rotulo: "Tudo" }, { valor: "motores", rotulo: "Motores" },
  { valor: "eletrica", rotulo: "Elétrica" }, { valor: "casco", rotulo: "Casco" },
  { valor: "docs", rotulo: "Docs" }, { valor: "gastos", rotulo: "Gastos" },
]

export default async function DiarioPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string; erro?: string }>
}) {
  const { filtro: bruto, erro } = await searchParams
  const filtro = (FILTROS.some((f) => f.valor === bruto) ? bruto : "tudo") as FiltroDiario

  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const supabase = await supabaseServer()
  const [{ data: eventos, error: erroEventos }, { data: contatos }] = await Promise.all([
    supabase.from("eventos")
      .select("id, embarcacao_id, equipamento_id, item_monitorado_id, contato_id, tipo, categoria, data, horas_no_momento, descricao, custo_centavos, anexo_path, tem_trilha, hora_saida, hora_retorno, destino, tripulacao, mar_onda_m, mar_vento_kt")
      .eq("embarcacao_id", painel.embarcacao.id)
      .order("data", { ascending: false }).order("created_at", { ascending: false }).limit(300),
    supabase.from("contatos").select("id, nome"),
  ])
  if (erroEventos) throw new Error("Não foi possível carregar o diário. Recarregue a página.")

  const porId = new Map(painel.equipamentos.map((e) => [e.id, e]))
  const nomeContato = new Map((contatos ?? []).map((c: Pick<Contato, "id" | "nome">) => [c.id, c.nome]))

  const visiveis = ((eventos ?? []) as Evento[]).filter((e) =>
    eventoNoFiltro(
      {
        tipo: e.tipo, categoria: e.categoria, custoCentavos: e.custo_centavos,
        tipoEquipamento: e.equipamento_id ? porId.get(e.equipamento_id)?.tipo ?? null : null,
      },
      filtro,
    ),
  )
  const grupos = agruparPorMes(visiveis)

  // Anexo (NF, foto do serviço) só era gravado — nunca reaparecia em lugar
  // nenhum. Mesmo padrão de URL assinada já usado em Documentos.
  const urlsAnexo = new Map(
    await Promise.all(
      visiveis
        .filter((e): e is Evento & { anexo_path: string } => e.anexo_path != null)
        .map(async (e) => {
          const { data } = await supabase.storage.from("acervo").createSignedUrl(e.anexo_path, 3600)
          return [e.id, data?.signedUrl ?? null] as const
        }),
    ),
  )

  // Nomes da tripulacao a bordo (Livro de Bordo) — so busca perfis dos ids
  // que realmente aparecem nos eventos visiveis.
  const idsTripulacao = [...new Set(visiveis.flatMap((e) => e.tripulacao ?? []))]
  const { data: perfisTripulacao } = idsTripulacao.length
    ? await supabase.from("profiles").select("id, nome").in("id", idsTripulacao)
    : { data: [] as { id: string; nome: string }[] }
  const nomePerfil = new Map((perfisTripulacao ?? []).map((p: { id: string; nome: string }) => [p.id, p.nome]))

  return (
    <main>
      <div className="flex items-baseline justify-between">
        <h1 className="titulo-pagina">Diário de Bordo</h1>
        <Link href="/diario/novo" className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-acao-texto">
          <span className="inline-flex items-center gap-1">
            <Icone nome="mais" className="size-4" /> Registrar
          </span>
        </Link>
      </div>
      {erro && <p className="mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 corpo">{erro}</p>}

      <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {FILTROS.map((f) => (
          <Link
            key={f.valor}
            href={f.valor === "tudo" ? "/diario" : `/diario?filtro=${f.valor}`}
            className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 font-mono-instr text-[11.5px] tracking-wide ${
              filtro === f.valor ? "border-accent bg-accent font-semibold text-acao-texto" : "border-line bg-panel text-dim"
            }`}
          >
            {f.rotulo}
          </Link>
        ))}
      </div>

      {grupos.length === 0 && (
        <div className="sombra-1 mt-6 rounded-[14px] border border-line bg-panel p-5 text-center corpo text-dim">
          Nenhum registro por aqui ainda. Toque em &quot;+ Registrar&quot; para criar o primeiro —
          cada serviço registrado vira histórico e dossiê do barco.
        </div>
      )}

      {grupos.map((g) => (
        <section key={g.rotulo}>
          <p className="rotulo text-dim mt-6 mb-2">{g.rotulo}</p>
          <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
            {g.eventos.map((e) => {
              const eq = e.equipamento_id ? porId.get(e.equipamento_id) : null
              const meta = [
                e.horas_no_momento != null ? `${e.horas_no_momento.toLocaleString("pt-BR")} h` : null,
                e.contato_id ? nomeContato.get(e.contato_id) : null,
                e.custo_centavos != null ? formatarReais(e.custo_centavos) : null,
              ].filter(Boolean).join(" · ")
              const urlAnexo = e.anexo_path ? urlsAnexo.get(e.id) : null
              // Ficha da saida (Livro de Bordo): duracao, destino, quem estava a
              // bordo e a condicao do mar registrada no momento — so pra navegacao.
              const duracaoEvento = e.tipo === "navegacao" ? duracaoHoras(e.hora_saida, e.hora_retorno) : null
              const tripNomes = (e.tripulacao ?? [])
                .map((id) => nomePerfil.get(id))
                .filter((n): n is string => Boolean(n))
              const temMar = e.mar_onda_m != null || e.mar_vento_kt != null
              const detalhesSaida = e.tipo === "navegacao"
                ? [
                    duracaoEvento != null ? textoDuracao(duracaoEvento) : null,
                    e.destino,
                    tripNomes.length > 0 ? tripNomes.join(", ") : null,
                    temMar
                      ? `mar ${e.mar_onda_m != null ? `${e.mar_onda_m.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} m` : "—"} / ${e.mar_vento_kt != null ? `${Math.round(e.mar_vento_kt)} kt` : "—"}`
                      : null,
                  ].filter(Boolean).join(" · ")
                : ""
              return (
                <div key={e.id} className="flex gap-3 border-b border-line py-3 last:border-0">
                  <div className="w-11 shrink-0 text-center font-mono-instr tabular-nums text-[11px] leading-tight text-dim">
                    <span className="block text-base text-texto">{e.data.slice(8, 10)}</span>
                    {new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" })
                      .format(new Date(`${e.data}T00:00:00Z`)).replace(".", "")}
                  </div>
                  <div className="min-w-0">
                    <p className="titulo-card">
                      {TIPO_ROTULO[e.tipo] ?? e.tipo}
                      {eq
                        ? ` — ${
                            eq.tipo === "motor"
                              ? "Motor"
                              : eq.tipo === "gerador"
                                ? "Gerador"
                                : eq.tipo === "bateria"
                                  ? "Bateria"
                                  : "Equipamento"
                          } ${eq.posicao ?? ""}`
                        : ""}
                    </p>
                    {e.descricao && <p className="apoio mt-0.5 text-dim">{e.descricao}</p>}
                    {detalhesSaida && <p className="apoio mt-0.5 text-dim">{detalhesSaida}</p>}
                    {meta && <p className="mt-1 font-mono-instr text-[11px] tabular-nums text-dim">{meta}</p>}
                    <div className="mt-1 flex gap-3">
                      {urlAnexo && (
                        <a href={urlAnexo} target="_blank" rel="noopener noreferrer" className="apoio text-accent-forte">
                          Abrir anexo
                        </a>
                      )}
                      {e.tem_trilha && (
                        <Link href={`/diario/trilha/${e.id}`} className="apoio text-accent-forte">
                          Ver trilha na carta
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </main>
  )
}
