import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { DicaLeitorNativo } from "@/components/dica-leitor-nativo"
import { Farol } from "@/components/farol"
import { Horimetro } from "@/components/horimetro"
import { Icone } from "@/components/icone"
import { calcularSemaforo, formatarDataCurta, PESO, textoRestante, vencimentoPorData } from "@/lib/domain/semaforo"
import { carregarPainel, hojeISO, itemMonitoradoToItemCalc } from "@/lib/consultas"
import { formatarReais } from "@/lib/domain/gastos"
import { iconeDoSistema, ordenarSistemas, urlManualNaPagina } from "@/lib/domain/sistemas"
import { mediaHorasPorSemana, previsaoDias } from "@/lib/domain/uso"
import { podeEditar } from "@/lib/domain/permissoes"
import { supabaseServer } from "@/lib/supabase/server"
import type { EquipamentoSistema } from "@/lib/db/types"

export default async function EquipamentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const equipamento = painel.equipamentos.find((e) => e.id === id)
  if (!equipamento) notFound()

  const ehMotor = equipamento.tipo === "motor"
  const aba = ehMotor ? "motores" : "eletrica"
  const editavel = podeEditar(painel.permissoes, aba)
  const hoje = hojeISO()

  const itens = painel.itens
    .filter((i) => i.equipamento_id === id)
    .map((i) => ({ item: i, r: calcularSemaforo(itemMonitoradoToItemCalc(i), equipamento.horas_atuais ?? null, hoje) }))
    .sort((a, b) => PESO[b.r.status] - PESO[a.r.status])
  const statusGeral = itens[0]?.r.status ?? "ok"

  const supabase = await supabaseServer()
  const urlFoto = equipamento.foto_path
    ? (await supabase.storage.from("acervo").createSignedUrl(equipamento.foto_path, 3600)).data?.signedUrl ?? null
    : null
  const [{ data: eventos }, { data: leituras }, { data: sistemasBrutos }] = await Promise.all([
    supabase.from("eventos")
      .select("id, data, tipo, descricao, horas_no_momento, custo_centavos, anexo_path")
      .eq("equipamento_id", id).order("data", { ascending: false }).limit(10),
    supabase.from("eventos")
      .select("data, horas_no_momento")
      .eq("equipamento_id", id).eq("tipo", "leitura_horas")
      .not("horas_no_momento", "is", null).order("data", { ascending: false }).limit(30),
    supabase.from("equipamento_sistemas").select("*").eq("equipamento_id", id),
  ])
  const sistemas = ordenarSistemas((sistemasBrutos ?? []) as EquipamentoSistema[])

  // Manual de cada sistema (onda 15, "motor vivo"): mesmo padrão de URL
  // assinada dos anexos do histórico logo abaixo — busca só os documentos
  // de verdade referenciados, nunca o acervo inteiro.
  const idsDocumentosDosSistemas = [...new Set(sistemas.map((s) => s.documento_id).filter((v): v is string => v != null))]
  const { data: documentosDosSistemas } = idsDocumentosDosSistemas.length
    ? await supabase.from("documentos").select("id, nome, arquivo_path").in("id", idsDocumentosDosSistemas)
    : { data: [] as { id: string; nome: string; arquivo_path: string | null }[] }
  const documentoPorId = new Map((documentosDosSistemas ?? []).map((d) => [d.id, d]))
  const urlsManual = new Map(
    await Promise.all(
      (documentosDosSistemas ?? [])
        .filter((d): d is { id: string; nome: string; arquivo_path: string } => d.arquivo_path != null)
        .map(async (d) => {
          const { data } = await supabase.storage.from("acervo").createSignedUrl(d.arquivo_path, 3600)
          return [d.id, data?.signedUrl ?? null] as const
        }),
    ),
  )

  const media = mediaHorasPorSemana(
    (leituras ?? []).map((l: { data: string; horas_no_momento: number }) => ({ data: l.data, horas: l.horas_no_momento })),
  )

  // Anexo (NF, foto do serviço) do histórico deste equipamento — mesmo
  // padrão de URL assinada já usado em Documentos.
  const urlsAnexo = new Map(
    await Promise.all(
      (eventos ?? [])
        .filter((e): e is typeof e & { anexo_path: string } => e.anexo_path != null)
        .map(async (e) => {
          const { data } = await supabase.storage.from("acervo").createSignedUrl(e.anexo_path, 3600)
          return [e.id, data?.signedUrl ?? null] as const
        }),
    ),
  )
  const irmaos = painel.equipamentos.filter((e) => e.tipo === equipamento.tipo)
  const rotuloTipo = ehMotor ? "Motor" : equipamento.tipo === "gerador" ? "Gerador" : equipamento.tipo === "bateria" ? "Baterias" : "Equipamento"
  const nomeCurto = (e: typeof equipamento) => `${rotuloTipo}${e.posicao ? ` ${e.posicao}` : ""}`
  // Concordância de gênero do convite da capa ("seu motor", "seu gerador",
  // "seu conjunto de baterias") — Pedido do Pedro: "se o cara botar que o
  // motor dele é um caterpillar, aparecer o caterpillar lá".
  const rotuloFotoConvite = ehMotor
    ? "motor"
    : equipamento.tipo === "gerador"
      ? "gerador"
      : equipamento.tipo === "bateria"
        ? "conjunto de baterias"
        : "equipamento"

  const especificacoes: [string, string | null][] = [
    ["Nº de série", equipamento.numero_serie],
    ["Identificação", equipamento.identificacao_interna],
    ["Ano", equipamento.ano != null ? String(equipamento.ano) : null],
    ["Potência", equipamento.potencia_hp != null ? `${equipamento.potencia_hp} hp` : null],
    ["Combustível", equipamento.combustivel],
    ["Quantidade", equipamento.quantidade != null ? `${equipamento.quantidade}×` : null],
  ]

  return (
    <main>
      <Link href={ehMotor ? "/barco" : "/barco/eletrica"} className="inline-flex items-center gap-1 rotulo text-accent-forte">
        <Icone nome="voltar" className="size-4" /> {ehMotor ? "Embarcação" : "Elétrica"}
      </Link>

      {irmaos.length > 1 && (
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {irmaos.map((e) => (
            <Link key={e.id} href={`/barco/equipamento/${e.id}`}
              className={`whitespace-nowrap rounded-full border px-4 py-2 font-mono-instr text-[11px] ${
                e.id === id ? "border-accent bg-accent font-semibold text-acao-texto" : "border-line bg-panel text-dim"
              }`}>
              {nomeCurto(e)}
            </Link>
          ))}
        </div>
      )}

      {/* Foto como capa (onda 15, "motor vivo") — o herói do topo da ficha,
          não mais um detalhe pequeno. Sem foto, convite claro pra adicionar
          em vez de um retângulo vazio; mesmo padrão visual do card da
          embarcação em components/card-embarcacao.tsx. */}
      <div className="sombra-1 mt-3 overflow-hidden rounded-[14px] border border-line bg-[#0b1d2d]">
        {urlFoto ? (
          /* eslint-disable-next-line @next/next/no-img-element -- URL assinada e temporária do storage */
          <img src={urlFoto} alt={`Foto de ${nomeCurto(equipamento)}`} className="h-56 w-full object-cover" />
        ) : editavel ? (
          <Link
            href={`/barco/equipamento/${id}/editar`}
            className="flex h-56 w-full flex-col items-center justify-center gap-2"
            style={{ backgroundImage: "radial-gradient(ellipse 90% 70% at 50% 15%, #16324a 0%, #0b1d2d 70%)" }}
          >
            <Icone nome="camera" className="size-7 text-[#7c93ab]" />
            <span className="corpo text-[#7c93ab]">Adicione uma foto real do seu {rotuloFotoConvite}</span>
          </Link>
        ) : (
          <div
            className="flex h-56 w-full items-center justify-center"
            style={{ backgroundImage: "radial-gradient(ellipse 90% 70% at 50% 15%, #16324a 0%, #0b1d2d 70%)" }}
          >
            <Icone nome="camera" className="size-7 text-[#7c93ab]" />
          </div>
        )}
      </div>

      <div className="mt-3">
        <Horimetro
          rotulo={`${nomeCurto(equipamento)} — ${[equipamento.marca, equipamento.modelo].filter(Boolean).join(" ") || "sem marca"}`}
          horas={equipamento.horas_atuais}
          status={statusGeral}
          grande
        />
      </div>
      {media != null && (
        <p className="apoio mt-2 text-center font-mono-instr tabular-nums text-dim">
          {media > 0
            ? `média de ${media.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h por semana`
            : "sem uso registrado no período"}
        </p>
      )}

      {/* Sistemas (onda 15, "motor vivo") — o elo novo entre o equipamento e
          o manual do fabricante já guardado no acervo. Sistema com manual
          abre o PDF na página certa; sem manual, o clique leva a vincular
          um (nunca clique morto, ver docs/CONTRIBUTING.md). */}
      <div className="mt-6 mb-2 flex items-baseline justify-between">
        <p className="rotulo flex items-center gap-1.5 text-dim">
          <Icone nome="motor" className="size-3.5" /> Sistemas
        </p>
        {editavel && (
          <Link href={`/barco/equipamento/${id}/sistemas/novo`} className="corpo inline-flex items-center gap-1 text-accent-forte">
            <Icone nome="mais" className="size-4" /> Sistema
          </Link>
        )}
      </div>
      <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
        {sistemas.length === 0 && (
          <p className="corpo py-4 text-dim">
            {editavel
              ? "Nenhum sistema cadastrado ainda — comece por Arrefecimento, Injeção, Elétrica do motor ou Transmissão."
              : "Nenhum sistema cadastrado aqui ainda."}
          </p>
        )}
        {sistemas.map((s) => {
          const documento = s.documento_id ? documentoPorId.get(s.documento_id) : undefined
          const urlManual = documento ? urlsManual.get(documento.id) : undefined
          const editarHref = `/barco/equipamento/${id}/sistemas/${s.id}/editar`
          const conteudo = (
            <>
              <Icone nome={iconeDoSistema(s.nome)} className="size-5 shrink-0 text-dim" />
              <div className="min-w-0 flex-1">
                <p className="titulo-card">{s.nome}</p>
                {s.observacao && <p className="apoio mt-0.5 text-dim">{s.observacao}</p>}
                {urlManual ? (
                  <>
                    <p className="apoio mt-0.5 text-accent-forte">
                      {s.pagina ? `Abrir manual · página ${s.pagina}` : "Abrir manual"}
                    </p>
                    <DicaLeitorNativo />
                  </>
                ) : (
                  <p className="apoio mt-0.5 text-dim">
                    {editavel ? "Sem manual vinculado — toque para vincular" : "Sem manual vinculado"}
                  </p>
                )}
              </div>
            </>
          )
          return (
            <div key={s.id} className="flex items-center gap-2 border-b border-line py-3 last:border-0">
              {urlManual ? (
                <a
                  href={urlManualNaPagina(urlManual, s.pagina)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-11 flex-1 items-center gap-3"
                >
                  {conteudo}
                </a>
              ) : editavel ? (
                <Link href={editarHref} className="flex min-h-11 flex-1 items-center gap-3">
                  {conteudo}
                </Link>
              ) : (
                <div className="flex min-h-11 flex-1 items-center gap-3">{conteudo}</div>
              )}
              {/* Quando o manual já está vinculado, a linha inteira abre o PDF —
                  precisa de um botão à parte pra chegar na edição (nome, troca
                  de documento, página, observação), senão essa rota fica sem
                  link nesse estado. */}
              {editavel && urlManual && (
                <Link
                  href={editarHref}
                  aria-label={`Editar ${s.nome}`}
                  className="apoio flex min-h-11 shrink-0 items-center rounded-lg border border-line px-3 text-dim"
                >
                  Editar
                </Link>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-6 mb-2 flex items-baseline justify-between">
        <p className="rotulo flex items-center gap-1.5 text-dim">
          <Icone nome="ferramenta" className="size-3.5" /> Manutenções
        </p>
        {editavel && (
          <Link href={`/barco/itens/novo?alvo=${encodeURIComponent(`eq:${id}`)}`} className="corpo text-accent-forte">
            Nova manutenção
          </Link>
        )}
      </div>
      <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
        {itens.length === 0 && (
          <p className="corpo py-4 text-dim">Nenhuma manutenção cadastrada aqui ainda.</p>
        )}
        {itens.map(({ item, r }) => {
          const dias = r.horasRestantes != null && media != null ? previsaoDias(r.horasRestantes, media) : null
          const venc = vencimentoPorData(itemMonitoradoToItemCalc(item))
          const nomeEItem = (
            <>
              <p className="titulo-card">{item.nome}</p>
              <p className="apoio mt-0.5 text-dim">
                {[
                  item.intervalo_horas != null ? `a cada ${item.intervalo_horas} h` : null,
                  item.intervalo_meses != null ? `${item.intervalo_meses} meses` : null,
                  item.especificacao,
                  item.quantidade,
                ].filter(Boolean).join(" · ") || "sem regra definida"}
              </p>
            </>
          )
          return (
            <div key={item.id} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
              <Farol status={r.status} />
              {editavel ? (
                <Link href={`/barco/itens/${item.id}/editar`} className="min-w-0 flex-1">{nomeEItem}</Link>
              ) : (
                <div className="min-w-0 flex-1">{nomeEItem}</div>
              )}
              <div className="shrink-0 text-right">
                <p className={`font-mono-instr text-sm font-semibold tabular-nums ${
                  r.status === "vencido" ? "text-crit" : r.status === "atencao" ? "text-warn" : "text-dim"
                }`}>
                  {textoRestante(r)}{venc ? ` · ${formatarDataCurta(venc)}` : ""}
                </p>
                {dias != null && dias > 0 && r.status !== "vencido" && (
                  <p className="apoio font-mono-instr tabular-nums text-dim">~{dias} dias</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <p className="rotulo mt-6 mb-2 flex items-center gap-1.5 text-dim">
        <Icone nome="documento" className="size-3.5" /> Especificação
      </p>
      <div className="sombra-1 rounded-[14px] border border-line bg-panel p-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          {especificacoes.map(([nome, valor]) => (
            <div key={nome}>
              <dt className="rotulo text-dim">{nome}</dt>
              <dd className="corpo mt-0.5">{valor ?? <span className="text-dim">—</span>}</dd>
            </div>
          ))}
        </dl>
        {equipamento.observacoes && <p className="apoio mt-3 text-dim">{equipamento.observacoes}</p>}
        {editavel && (
          <Link href={`/barco/equipamento/${id}/editar`} className="corpo mt-3 inline-block text-accent-forte">
            Editar equipamento
          </Link>
        )}
      </div>

      <div className="mt-6 mb-2 flex items-baseline justify-between">
        <p className="rotulo flex items-center gap-1.5 text-dim">
          <Icone nome="calendario" className="size-3.5" /> Histórico
        </p>
        <Link href={`/diario/novo?alvo=${encodeURIComponent(`eq:${id}`)}`} className="corpo text-accent-forte">
          Registrar serviço
        </Link>
      </div>
      <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
        {(eventos ?? []).length === 0 && (
          <p className="corpo py-4 text-dim">Nenhum serviço registrado neste equipamento ainda.</p>
        )}
        {(eventos ?? []).map((e) => (
          <div key={e.id} className="border-b border-line py-3 last:border-0">
            <p className="titulo-card">{e.descricao ?? e.tipo}</p>
            <p className="apoio mt-0.5 font-mono-instr tabular-nums text-dim">
              {e.data.split("-").reverse().join("/")}
              {e.horas_no_momento != null ? ` · ${e.horas_no_momento.toLocaleString("pt-BR")} h` : ""}
              {e.custo_centavos != null ? ` · ${formatarReais(e.custo_centavos)}` : ""}
            </p>
            {e.anexo_path && urlsAnexo.get(e.id) && (
              <a href={urlsAnexo.get(e.id)!} target="_blank" rel="noopener noreferrer" className="apoio mt-0.5 inline-block text-accent-forte">
                Abrir anexo
              </a>
            )}
          </div>
        ))}
      </div>
    </main>
  )
}
