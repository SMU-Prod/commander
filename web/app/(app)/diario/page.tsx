import Link from "next/link"
import { redirect } from "next/navigation"
import { Icone, type NomeIcone } from "@/components/icone"
import { BarraFerramentas } from "@/components/ui/barra-ferramentas"
import { Chip } from "@/components/ui/chip"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { carregarPainel } from "@/lib/consultas"
import { duracaoHoras, textoDuracao, tituloDaSaida, tituloDoRegistro } from "@/lib/domain/bordo"
import { agruparPorMes, eventoNoFiltro, nomeDoEquipamento, TIPO_ROTULO, type FiltroDiario } from "@/lib/domain/diario"
import { formatarReais } from "@/lib/domain/gastos"
import { resumoTrilha } from "@/lib/domain/geo"
import { podeEditar } from "@/lib/domain/permissoes"
import { formatarDataCurta } from "@/lib/domain/semaforo"
import { supabaseServer } from "@/lib/supabase/server"
import type { Contato, Evento } from "@/lib/db/types"

const FILTROS: { valor: FiltroDiario; rotulo: string }[] = [
  { valor: "tudo", rotulo: "Tudo" }, { valor: "motores", rotulo: "Motores" },
  { valor: "eletrica", rotulo: "Elétrica" }, { valor: "casco", rotulo: "Casco" },
  { valor: "docs", rotulo: "Docs" }, { valor: "gastos", rotulo: "Gastos" },
]

// O ícone da pastilha de cada registro (canvas tela-3a): a SAÍDA leva o
// barco em dourado — é a atividade, o coração do feed; todo o resto fica
// neutro. Mesmo desenho dos cartões de "O que aconteceu?" no formulário,
// exceto navegação, que lá é mapa (gesto de registrar) e aqui é o barco
// (a coisa que saiu).
const ICONE_TIPO: Record<string, NomeIcone> = {
  navegacao: "embarcacao", manutencao: "ferramenta", abastecimento: "oleo",
  avaria: "alerta", docagem: "ancora", leitura_horas: "relogio", outro: "mais",
}

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
      // `local_saida` e `passageiros` entraram na onda 62: o feed do canvas
      // (tela-3a) põe a rota no título ("Angra dos Reis → Ilha Grande") e
      // conta quem estava a bordo — os dois campos já existiam na tabela
      // (PRD §23), só não eram lidos aqui.
      .select("id, embarcacao_id, equipamento_id, item_monitorado_id, contato_id, tipo, categoria, data, horas_no_momento, descricao, custo_centavos, anexo_path, trilha, hora_saida, hora_retorno, local_saida, destino, tripulacao, passageiros, mar_onda_m, mar_vento_kt, importado_do_plotter")
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
      {/* A frase de baixo do título é a do canvas (tela-3a): diz de uma vez o
          que mora aqui, pra primeira visita não precisar deduzir do filtro. */}
      <p className="apoio mt-1 text-dim">Toda saída, abastecimento e serviço registrado a bordo.</p>
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

      {/* ONDA 62 — A ANATOMIA DO FEED É A DO CANVAS (tela-3a): cada registro
          é um CARTÃO próprio — pastilha do tipo à esquerda (dourada só na
          saída, que é a atividade), o verbo no título, o carimbo da data em
          mono à direita. A saída ganha a fileira de pílulas de instrumento
          (No mar · Trilha · A bordo) com "sem GPS" no lugar de distância
          inventada — o diário não inventa milha. Antes era um painel único
          por mês com linhas separadas por borda; o canvas manda cartões. */}
      {grupos.map((g) => (
        <section key={g.rotulo}>
          <SecaoPagina>{g.rotulo}</SecaoPagina>
          <div className="flex flex-col gap-2">
            {g.eventos.map((e) => {
              const eq = e.equipamento_id ? porId.get(e.equipamento_id) : null
              const urlAnexo = e.anexo_path ? urlsAnexo.get(e.id) : null
              // A saida vira feed de atividade (onda 18): cartao inteiro leva pra
              // /diario/[id] (mapa da trilha + painel de numeros + compartilhar).
              // Os demais tipos de registro continuam sem link — nao e tudo que
              // e "atividade".
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
              // Quem estava a bordo, em gente: tripulacao com conta + passageiros
              // digitados. Zero nao vira pilula — ninguem registrou ninguem.
              const aBordo = (e.tripulacao ?? []).length + (e.passageiros ?? []).length
              const temMar = e.mar_onda_m != null || e.mar_vento_kt != null
              const apoioSaida = ehSaida
                ? [
                    tripNomes.length > 0 ? tripNomes.join(", ") : null,
                    temMar
                      ? `mar ${e.mar_onda_m != null ? `${e.mar_onda_m.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} m` : "—"} / ${e.mar_vento_kt != null ? `${Math.round(e.mar_vento_kt)} kt` : "—"}`
                      : null,
                    e.descricao,
                  ].filter(Boolean).join(" · ")
                : ""
              const titulo = ehSaida
                ? tituloDaSaida(e.local_saida, e.destino) ?? TIPO_ROTULO[e.tipo]
                : tituloDoRegistro(e.tipo, TIPO_ROTULO[e.tipo] ?? e.tipo, e.descricao, eq ? nomeDoEquipamento(eq) : null)
              const conteudo = (
                <>
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex size-[30px] shrink-0 items-center justify-center rounded-[var(--raio-controle)] ${
                        ehSaida ? "bg-accent/10 text-accent-forte" : "bg-panel2 text-dim"
                      }`}
                    >
                      <Icone nome={ICONE_TIPO[e.tipo] ?? "mais"} className="size-4" />
                    </span>
                    <p className="titulo-card min-w-0 flex-1 line-clamp-2">{titulo}</p>
                    <span className="shrink-0 font-mono-instr text-xs tabular-nums text-dim">
                      {formatarDataCurta(e.data)}
                    </span>
                  </div>
                  {ehSaida && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {duracaoEvento != null && (
                        <span className="flex items-center gap-1.5 rounded-[var(--raio-pilula)] border border-line px-2.5 py-[5px]">
                          <span className="rotulo text-dim">No mar</span>
                          <span className="font-mono-instr text-xs font-semibold tabular-nums">{textoDuracao(duracaoEvento)}</span>
                        </span>
                      )}
                      <span className="flex items-center gap-1.5 rounded-[var(--raio-pilula)] border border-line px-2.5 py-[5px]">
                        <span className="rotulo text-dim">Trilha</span>
                        {trilhaResumo ? (
                          <span className="font-mono-instr text-xs font-semibold tabular-nums">
                            {trilhaResumo.distanciaNm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MN
                          </span>
                        ) : (
                          // "sem GPS" no lugar de 0 MN — o diário não inventa
                          // distância (nota do próprio canvas).
                          <span className="font-mono-instr text-xs font-semibold text-dim">sem GPS</span>
                        )}
                      </span>
                      {aBordo > 0 && (
                        <span className="flex items-center gap-1.5 rounded-[var(--raio-pilula)] border border-line px-2.5 py-[5px]">
                          <span className="rotulo text-dim">A bordo</span>
                          <span className="font-mono-instr text-xs font-semibold tabular-nums">{aBordo}</span>
                        </span>
                      )}
                    </div>
                  )}
                  {ehSaida
                    ? apoioSaida && <p className="apoio mt-2.5 text-dim">{apoioSaida}</p>
                    : (e.horas_no_momento != null || e.contato_id || e.custo_centavos != null) && (
                        <p className="apoio mt-2 text-dim">
                          {e.contato_id && nomeContato.get(e.contato_id)}
                          {e.horas_no_momento != null && (
                            <>
                              {e.contato_id ? " · " : ""}horímetro{" "}
                              <span className="font-mono-instr tabular-nums text-texto">
                                {e.horas_no_momento.toLocaleString("pt-BR")} h
                              </span>
                            </>
                          )}
                          {e.custo_centavos != null && (
                            <>
                              {e.contato_id || e.horas_no_momento != null ? " · " : ""}
                              <span className="font-mono-instr tabular-nums text-texto">{formatarReais(e.custo_centavos)}</span>
                            </>
                          )}
                        </p>
                      )}
                  {(e.importado_do_plotter || (urlAnexo && !ehSaida)) && (
                    <p className="mt-2 flex flex-wrap items-center gap-1.5">
                      {e.importado_do_plotter && (
                        <span className="inline-flex items-center gap-1 rounded-[var(--raio-pilula)] border border-line px-2 py-0.5 font-mono-instr rotulo-dado text-dim">
                          <Icone nome="guardado" className="size-3" /> Importada do plotter
                        </span>
                      )}
                      {/* Só fora da saída: o cartão de saída inteiro já é um
                          <Link>, e âncora dentro de âncora é HTML inválido —
                          o anexo dela abre por /diario/[id]. */}
                      {urlAnexo && !ehSaida && (
                        <a href={urlAnexo} target="_blank" rel="noopener noreferrer" className="apoio inline-flex min-h-6 items-center text-accent-forte">
                          Abrir anexo
                        </a>
                      )}
                    </p>
                  )}
                </>
              )
              const casca = "block rounded-[var(--raio-cartao)] border border-line bg-panel p-3 sombra-1"
              return ehSaida ? (
                <Link key={e.id} href={`/diario/${e.id}`} className={casca}>
                  {conteudo}
                </Link>
              ) : (
                <div key={e.id} className={casca}>
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
