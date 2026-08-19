import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ROTULO_TIPO_BATERIA } from "@/components/campos-tipo-equipamento"
import { DicaLeitorNativo } from "@/components/dica-leitor-nativo"
import { Farol } from "@/components/farol"
import { Icone } from "@/components/icone"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { LinhaLista } from "@/components/ui/linha-lista"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { Selo } from "@/components/ui/selo"
import {
  calcularSemaforo, formatarDataCurta, linhaDaRegra, PESO, rotuloDoFarol, seloDoFarol,
  temInformacaoSuficiente, vencimentoPorData,
} from "@/lib/domain/semaforo"
import { carregarPainel, hojeISO, itemMonitoradoToItemCalc } from "@/lib/consultas"
import { carregarModeloDoCatalogo } from "@/lib/consultas-catalogo"
import { faixaDeAno, identidadeDoMotor, nomeCompletoDoModelo } from "@/lib/domain/catalogo-motor"
import { abaDoEquipamento } from "@/lib/domain/diario"
// (ROTULO_MOTOR saiu junto com a linha de regra escrita à mão — a frase agora
// é `linhaDaRegra`, a mesma do canvas, com teste em semaforo.test.ts.)
import { prazoCompacto } from "@/lib/domain/inicio"
import { carimboDaLeitura } from "@/lib/domain/leituras"
import { ROTULO_ZONA } from "@/lib/domain/mapa-embarcacao"
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
  const aba = abaDoEquipamento(equipamento.tipo)
  const editavel = podeEditar(painel.permissoes, aba)
  const hoje = hojeISO()

  // Onda 64 — a identidade do catálogo (PRD 3D §16). Só motor consulta.
  const modeloCatalogo = ehMotor ? await carregarModeloDoCatalogo(equipamento.motor_modelo_id) : null

  // `calc` e `temInfo` calculados uma vez por item: a lista usa os três —
  // o farol (`r`), a frase da regra (`linhaDaRegra(calc)`) e o estado
  // "Completar" do canvas (tela-3c) pra item sem informação suficiente.
  const itens = painel.itens
    .filter((i) => i.equipamento_id === id)
    .map((i) => {
      const calc = itemMonitoradoToItemCalc(i)
      return {
        item: i,
        calc,
        r: calcularSemaforo(calc, equipamento.horas_atuais ?? null, hoje),
        temInfo: temInformacaoSuficiente(calc, equipamento.horas_atuais ?? null),
      }
    })
    .sort((a, b) => PESO[b.r.status] - PESO[a.r.status])
  // `null` = nenhum item monitorado: o selo do cabeçalho fica neutro ("Sem
  // dados") em vez de um "Em dia" sem dado por trás (honestidade, onda 16).
  const statusFicha = itens[0]?.r.status ?? null

  const supabase = await supabaseServer()
  const urlFoto = equipamento.foto_path
    ? (await supabase.storage.from("acervo").createSignedUrl(equipamento.foto_path, 3600)).data?.signedUrl ?? null
    : null
  const [{ data: eventos }, { data: leituras }, { data: sistemasBrutos }] = await Promise.all([
    supabase.from("eventos")
      .select("id, data, tipo, descricao, horas_no_momento, custo_centavos, anexo_path")
      .eq("equipamento_id", id).order("data", { ascending: false }).limit(10),
    // `created_at`/`criado_por` entram pro carimbo do horímetro (canvas
    // tela-3c: "Informado à mão em 09/08, 18:40 por Erick") — a MESMA
    // consulta de sempre, duas colunas a mais; nada novo é buscado.
    supabase.from("eventos")
      .select("data, horas_no_momento, created_at, criado_por")
      .eq("equipamento_id", id).eq("tipo", "leitura_horas")
      .not("horas_no_momento", "is", null).order("data", { ascending: false }).limit(30),
    supabase.from("equipamento_sistemas").select("*").eq("equipamento_id", id),
  ])
  const sistemas = ordenarSistemas((sistemasBrutos ?? []) as EquipamentoSistema[])

  // O carimbo humano do horímetro: a última leitura informada e QUEM
  // informou (nome do perfil, mesmo padrão de `profiles` usado no Diário).
  // Sem leitura nenhuma, o cartucho confessa em vez de fingir data.
  const ultimaLeitura = (leituras ?? [])[0] as
    | { data: string; created_at: string; criado_por: string | null }
    | undefined
  const { data: perfilDaLeitura } = ultimaLeitura?.criado_por
    ? await supabase.from("profiles").select("nome").eq("id", ultimaLeitura.criado_por).maybeSingle()
    : { data: null }
  const carimboHorimetro = ultimaLeitura
    ? carimboDaLeitura(ultimaLeitura.created_at ?? ultimaLeitura.data, (perfilDaLeitura as { nome: string } | null)?.nome ?? null)
    : null

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
        : equipamento.tipo === "painel"
          ? "painel de bordo"
          : "equipamento"

  const especificacoes: [string, string | null][] = [
    // Onda 64 — a linha do catálogo só existe quando há vínculo. Sem
    // vínculo ela não aparece como "—": um motor fora do catálogo não tem
    // buraco na ficha, tem uma linha a menos.
    ...(modeloCatalogo
      ? ([["Catálogo", [nomeCompletoDoModelo(modeloCatalogo), faixaDeAno(modeloCatalogo)]
          .filter(Boolean).join(" · ")]] as [string, string | null][])
      : []),
    ["Nº de série", equipamento.numero_serie],
    ["Identificação", equipamento.identificacao_interna],
    ["Ano", equipamento.ano != null ? String(equipamento.ano) : null],
    ["Potência", equipamento.potencia_hp != null ? `${equipamento.potencia_hp} hp` : null],
    ["Combustível", equipamento.combustivel],
    ["Quantidade", equipamento.quantidade != null ? `${equipamento.quantidade}×` : null],
    ["Tipo de bateria", equipamento.tipo_bateria ? ROTULO_TIPO_BATERIA[equipamento.tipo_bateria] : null],
  ]

  return (
    <main>
      {/* ONDA 60 — a anatomia de ficha da imagem 2 (docs/DESIGN-SYSTEM.md):
          título grande + chip de estado colado + subtítulo (marca/modelo) +
          barra de ações. "Editar" em CONTORNO, sem ação preenchida de
          propósito: a ação principal desta ficha ("Registrar serviço") já
          mora no corpo, na seção Histórico — duplicá-la aqui quebraria o
          "uma ação principal por tela" (docs/DESIGN.md §6.2), e o dourado de
          conteúdo desta tela já é do chip ativo dos irmãos logo abaixo. */}
      <CabecalhoDetalhe
        voltarHref={ehMotor ? "/barco" : "/barco/eletrica"}
        voltarRotulo={ehMotor ? "Embarcação" : "Elétrica"}
        titulo={nomeCurto(equipamento)}
        // Canvas tela-3c: marca/modelo E ano na mesma linha de apoio
        // ("Volvo Penta IPS 700 · 2019") — dados que a ficha já tem.
        // Onda 64 — quem decide o nome é `identidadeDoMotor`: catálogo ganha
        // do texto livre (é a identidade que ele existe pra dar), e sem
        // nenhum dos dois a linha some em vez de virar "—".
        descricao={
          [identidadeDoMotor(equipamento, modeloCatalogo), equipamento.ano]
            .filter(Boolean).join(" · ") || undefined
        }
        selo={<Selo estado={seloDoFarol(statusFicha)}>{rotuloDoFarol(statusFicha)}</Selo>}
        acoes={
          editavel ? (
            <Link
              href={`/barco/equipamento/${id}/editar`}
              className="flex min-h-11 items-center rounded-[var(--raio-pilula)] border border-line bg-panel px-4 text-sm text-texto"
            >
              Editar
            </Link>
          ) : undefined
        }
      />

      {/* Onda 61 — a zona física como chip (spec §3.4): um toque leva ao
          Mapa da Embarcação já com esta zona aberta. Só aparece com zona
          definida — sem zona, o convite mora no grupo "Não mapeados" do
          próprio mapa, não aqui (não se decora o vazio). Alvo de 44px no
          <Link>, pílula visual menor dentro — mesmo desenho dos pinos. */}
      {equipamento.zona && (
        <Link
          href={`/barco/mapa?zona=${equipamento.zona}`}
          aria-label={`Ver ${ROTULO_ZONA[equipamento.zona]} no Mapa da Embarcação`}
          className="mt-1 inline-flex min-h-11 items-center"
        >
          <span className="apoio inline-flex items-center gap-1.5 rounded-[var(--raio-pilula)] border border-line bg-panel px-3 py-1 text-dim">
            <Icone nome="mapa" className="size-3.5" /> {ROTULO_ZONA[equipamento.zona]}
          </span>
        </Link>
      )}

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

      {/* ONDA 62 (canvas tela-3c) — o cartucho escuro é O INSTRUMENTO da
          ficha: navy fixo (bg-meter, não segue o tema), número gigante em
          mono, e o carimbo de quem informou embaixo — horímetro é dado
          humano, não telemetria (PRD §11). A ação de informar leitura mora
          AQUI, colada no número que ela atualiza (abre o registro do Diário
          já no tipo certo). O farol saiu do mostrador: o estado da ficha já
          está no chip do cabeçalho, repetir aqui era dizer duas vezes. */}
      <div className="mt-3 rounded-[var(--raio-cartao)] border border-line bg-meter p-4 text-meter-texto">
        <p className="rotulo text-meter-dim">Horímetro</p>
        <div className="mt-2 flex items-baseline gap-2 font-mono-instr tabular-nums">
          <span className="text-4xl font-semibold">
            {equipamento.horas_atuais != null
              ? equipamento.horas_atuais.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
              : "—"}
          </span>
          <span className="rotulo text-meter-dim">{equipamento.horas_atuais != null ? "horas" : "sem leitura"}</span>
        </div>
        <p className="apoio mt-2.5 text-meter-dim">
          {carimboHorimetro ?? "Nenhuma leitura informada ainda."}
          {media != null && media > 0 && (
            <> Média de {media.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h por semana.</>
          )}
        </p>
        {editavel && (
          <Link
            href={`/diario/novo?tipo=leitura_horas&alvo=${encodeURIComponent(`eq:${id}`)}`}
            className="mt-3.5 inline-flex h-11 items-center rounded-[var(--raio-controle)] bg-accent px-5 text-sm font-semibold text-acao-texto"
          >
            Informar leitura
          </Link>
        )}
      </div>

      <SecaoPagina icone="ferramenta" acao={editavel ? { href: `/barco/itens/novo?alvo=${encodeURIComponent(`eq:${id}`)}`, rotulo: "Nova manutenção" } : undefined}>
        Manutenções
      </SecaoPagina>
      <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
        {itens.length === 0 && (
          <EstadoVazio variant="linha" icone="ferramenta" titulo="Nenhuma manutenção cadastrada aqui ainda" />
        )}
        {itens.map(({ item, calc, r, temInfo }) => {
          const dias = r.horasRestantes != null && r.horasRestantes >= 0 && media != null ? previsaoDias(r.horasRestantes, media) : null
          const venc = vencimentoPorData(calc)
          // Canvas tela-3c — item SEM informação suficiente não finge estado:
          // ponto vazado (não o farol verde) e "Completar" no lugar da
          // contagem. Ele não entra na conta da Saúde, nem a favor nem contra.
          if (!temInfo) {
            return (
              <LinhaLista
                key={item.id}
                href={editavel ? `/barco/itens/${item.id}/editar` : undefined}
                leading={<span aria-label="sem informação suficiente" className="inline-block size-2 shrink-0 rounded-full border border-dim/60 bg-transparent" />}
                titulo={item.nome}
                subtitulo={linhaDaRegra(calc)}
                trailing={editavel ? <span className="apoio shrink-0 font-medium text-accent-forte">Completar</span> : undefined}
              />
            )
          }
          return (
            <LinhaLista
              key={item.id}
              href={editavel ? `/barco/itens/${item.id}/editar` : undefined}
              leading={<Farol status={r.status} />}
              titulo={item.nome}
              subtitulo={linhaDaRegra(calc)}
              // A contagem regressiva da coluna direita: MESMO ResultadoCalc,
              // mesmo formato compacto da Início ("18 h", "-19 d") — nenhuma
              // régua nova (`prazoCompacto`, lib/domain/inicio.ts).
              valor={prazoCompacto(r)}
              valorClassName={r.status === "vencido" ? "text-crit" : r.status === "atencao" ? "text-warn" : ""}
              valorSecundario={
                dias != null && dias > 0 && r.status !== "vencido"
                  ? `~${dias} dias`
                  : venc
                    ? formatarDataCurta(venc)
                    : undefined
              }
            />
          )
        })}
      </div>
      {itens.some(({ temInfo }) => !temInfo) && (
        <p className="apoio mt-3 text-dim">
          Item sem intervalo não entra na conta da Saúde — nem a favor, nem contra.
        </p>
      )}

      {/* Foto (onda 15, "motor vivo") — continua na ficha, mas abaixo do
          instrumento e das manutenções: no canvas (tela-3c) o topo é do
          horímetro e do que está pedindo ação; a foto é contexto. Sem foto,
          convite claro em vez de retângulo vazio. */}
      <div className="sombra-1 mt-6 overflow-hidden rounded-[14px] border border-line bg-[#0b1d2d]">
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

      {/* Sistemas (onda 15, "motor vivo") — o elo novo entre o equipamento e
          o manual do fabricante já guardado no acervo. Sistema com manual
          abre o PDF na página certa; sem manual, o clique leva a vincular
          um (nunca clique morto, ver docs/CONTRIBUTING.md). */}
      <SecaoPagina icone="motor" acao={editavel ? { href: `/barco/equipamento/${id}/sistemas/novo`, rotulo: "Sistema", icone: "mais" } : undefined}>
        Sistemas
      </SecaoPagina>
      <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
        {sistemas.length === 0 && (
          <EstadoVazio
            variant="linha"
            icone="motor"
            titulo="Nenhum sistema cadastrado ainda"
            descricao={editavel ? "Comece por Arrefecimento, Injeção, Elétrica do motor ou Transmissão." : undefined}
          />
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

      <SecaoPagina icone="calendario" acao={{ href: `/diario/novo?alvo=${encodeURIComponent(`eq:${id}`)}`, rotulo: "Registrar serviço" }}>
        Histórico
      </SecaoPagina>
      <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
        {(eventos ?? []).length === 0 && (
          <EstadoVazio variant="linha" icone="calendario" titulo="Nenhum serviço registrado neste equipamento ainda" />
        )}
        {(eventos ?? []).map((e) => (
          <LinhaLista
            key={e.id}
            titulo={e.descricao ?? e.tipo}
            subtitulo={
              <>
                <span className="font-mono-instr tabular-nums">
                  {e.data.split("-").reverse().join("/")}
                  {e.horas_no_momento != null ? ` · ${e.horas_no_momento.toLocaleString("pt-BR")} h` : ""}
                  {e.custo_centavos != null ? ` · ${formatarReais(e.custo_centavos)}` : ""}
                </span>
                {e.anexo_path && urlsAnexo.get(e.id) && (
                  <a href={urlsAnexo.get(e.id)!} target="_blank" rel="noopener noreferrer" className="ml-2 text-accent-forte">
                    Abrir anexo
                  </a>
                )}
              </>
            }
          />
        ))}
      </div>

      {/* "Dados" (canvas tela-3c) — o nome da aba do canvas pro que era
          "Especificação": número de série, ano, potência, observações. Fecha
          a ficha na mesma ordem do canvas: instrumento → manutenção →
          histórico → dados. */}
      <SecaoPagina icone="documento">Dados</SecaoPagina>
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
        {/* O "Editar equipamento" que morava aqui subiu pra barra de ações do
            cabeçalho (onda 60) — dois caminhos pro mesmo formulário na mesma
            tela era exatamente o que a anatomia de ficha veio arrumar. */}
      </div>
    </main>
  )
}
