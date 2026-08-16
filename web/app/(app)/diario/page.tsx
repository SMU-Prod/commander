import Link from "next/link"
import { redirect } from "next/navigation"
import { Icone } from "@/components/icone"
import { BarraFerramentas } from "@/components/ui/barra-ferramentas"
import { Chip } from "@/components/ui/chip"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { carregarPainel } from "@/lib/consultas"
import { duracaoHoras, textoDuracao } from "@/lib/domain/bordo"
import { agruparPorMes, eventoNoFiltro, TIPO_ROTULO, type FiltroDiario } from "@/lib/domain/diario"
import { formatarReais } from "@/lib/domain/gastos"
import { resumoTrilha } from "@/lib/domain/geo"
import { podeEditar } from "@/lib/domain/permissoes"
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
  const podeEscrever = podeEditar(painel.permissoes, "diario")
  const supabase = await supabaseServer()
  const [{ data: eventos, error: erroEventos }, { data: contatos }] = await Promise.all([
    supabase.from("eventos")
      .select("id, embarcacao_id, equipamento_id, item_monitorado_id, contato_id, tipo, categoria, data, horas_no_momento, descricao, custo_centavos, anexo_path, trilha, hora_saida, hora_retorno, destino, tripulacao, mar_onda_m, mar_vento_kt, importado_do_plotter")
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
      <h1 className="titulo-pagina">Diário de Bordo</h1>
      {/* Importar do plotter (onda 21) — anos de trilha ja gravada no
          Garmin/Raymarine/Navionics viram saida de uma vez, sem digitar nada.
          Segunda acao discreta pra nao competir com o "Registrar" da
          BarraFerramentas (o gesto mais comum), mas ainda ≤3 toques a
          partir de /hoje. */}
      {podeEscrever ? (
        <div className="mt-2 flex justify-end">
          <Link
            href="/diario/importar"
            className="rotulo inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-accent-forte"
          >
            <Icone nome="guardado" className="size-3.5" /> Importar do plotter
          </Link>
        </div>
      ) : (
        // §24: em vez de a área de ação sumir sem explicação, ela diz por quê.
        <p className="apoio mt-2 text-dim">
          Seu acesso ao Diário é de leitura. Quem registra saídas e manutenções é quem tem permissão de
          editar — fale com o proprietário.
        </p>
      )}
      {erro && <p className="mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 corpo">{erro}</p>}

      {/* ONDA 59 — a barra engole o ChipLinha de filtros e ganha a ação de
          criar, que saiu do cabeçalho. §27.2 continua valendo: a ação só
          existe pra quem pode escrever (`podeEscrever`); quem só lê vê os
          filtros sozinhos, sem a pílula dourada. */}
      <BarraFerramentas
        className="mt-4"
        filtros={
          <>
            {FILTROS.map((f) => (
              <Chip
                key={f.valor}
                href={f.valor === "tudo" ? "/diario" : `/diario?filtro=${f.valor}`}
                ativo={filtro === f.valor}
              >
                {f.rotulo}
              </Chip>
            ))}
          </>
        }
        acao={podeEscrever ? { href: "/diario/novo", rotulo: "Registrar" } : undefined}
      />

      {grupos.length === 0 && (
        <EstadoVazio
          icone="calendario"
          titulo="Nenhum registro por aqui ainda"
          descricao="Toque em “Registrar” para criar o primeiro — cada serviço registrado vira histórico e dossiê do barco."
          acao={{ href: "/diario/novo", rotulo: "Registrar" }}
          className="mt-6"
        />
      )}

      {grupos.map((g) => (
        <section key={g.rotulo}>
          <SecaoPagina>{g.rotulo}</SecaoPagina>
          <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
            {g.eventos.map((e) => {
              const eq = e.equipamento_id ? porId.get(e.equipamento_id) : null
              const meta = [
                e.horas_no_momento != null ? `${e.horas_no_momento.toLocaleString("pt-BR")} h` : null,
                e.contato_id ? nomeContato.get(e.contato_id) : null,
                e.custo_centavos != null ? formatarReais(e.custo_centavos) : null,
              ].filter(Boolean).join(" · ")
              const urlAnexo = e.anexo_path ? urlsAnexo.get(e.id) : null
              // A saida vira feed de atividade (onda 18): cartao inteiro leva pra
              // /diario/[id] (mapa da trilha + painel de numeros + compartilhar).
              // Os demais tipos de registro continuam exatamente como estavam —
              // nao e tudo que e "atividade".
              const ehSaida = e.tipo === "navegacao"
              const duracaoEvento = ehSaida ? duracaoHoras(e.hora_saida, e.hora_retorno) : null
              // Trilha ja vem selecionada na query (poucas saidas por barco —
              // custo aceitavel pra ter distancia real no feed sem outra ida
              // ao banco); so soma quando tem pontos suficientes de verdade.
              const trilhaResumo = ehSaida && Array.isArray(e.trilha) && e.trilha.length >= 2
                ? resumoTrilha(e.trilha)
                : null
              const tripNomes = (e.tripulacao ?? [])
                .map((id) => nomePerfil.get(id))
                .filter((n): n is string => Boolean(n))
              const temMar = e.mar_onda_m != null || e.mar_vento_kt != null
              const detalhesSaida = ehSaida
                ? [
                    e.destino,
                    tripNomes.length > 0 ? tripNomes.join(", ") : null,
                    temMar
                      ? `mar ${e.mar_onda_m != null ? `${e.mar_onda_m.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} m` : "—"} / ${e.mar_vento_kt != null ? `${Math.round(e.mar_vento_kt)} kt` : "—"}`
                      : null,
                  ].filter(Boolean).join(" · ")
                : ""
              // Mini indicacao visual do feed: distancia (so com trilha) e/ou
              // duracao — nunca inventa o que a saida nao tem.
              const badgeAtividade = ehSaida
                ? [
                    trilhaResumo ? `${trilhaResumo.distanciaNm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MN` : null,
                    duracaoEvento != null ? textoDuracao(duracaoEvento) : null,
                  ].filter(Boolean).join(" · ")
                : ""
              const conteudo = (
                <>
                  <div className="w-11 shrink-0 text-center font-mono-instr tabular-nums text-[11px] leading-tight text-dim">
                    <span className="block text-base text-texto">{e.data.slice(8, 10)}</span>
                    {new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" })
                      .format(new Date(`${e.data}T00:00:00Z`)).replace(".", "")}
                  </div>
                  <div className="min-w-0 flex-1">
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
                    {(badgeAtividade || e.importado_do_plotter) && (
                      <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {badgeAtividade && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 font-mono-instr text-[11px] tabular-nums text-accent-forte">
                            <Icone nome="mapa" className="size-3" /> {badgeAtividade}
                          </span>
                        )}
                        {e.importado_do_plotter && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-line bg-panel px-2 py-0.5 font-mono-instr text-[11px] text-dim">
                            <Icone nome="guardado" className="size-3" /> Importada do plotter
                          </span>
                        )}
                      </p>
                    )}
                    {meta && <p className="mt-1 font-mono-instr text-[11px] tabular-nums text-dim">{meta}</p>}
                    {urlAnexo && (
                      <a href={urlAnexo} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block apoio text-accent-forte">
                        Abrir anexo
                      </a>
                    )}
                  </div>
                  {ehSaida && <Icone nome="chevron" className="size-4 shrink-0 self-center text-dim" />}
                </>
              )
              return ehSaida ? (
                <Link key={e.id} href={`/diario/${e.id}`} className="flex gap-3 border-b border-line py-3 last:border-0">
                  {conteudo}
                </Link>
              ) : (
                <div key={e.id} className="flex gap-3 border-b border-line py-3 last:border-0">
                  {conteudo}
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </main>
  )
}
