import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { Confirmar } from "@/components/confirmar"
import { FormularioNovoEvento } from "@/components/campos-navegacao-evento"
import { ROTULO_TIPO_BATERIA } from "@/components/campos-tipo-equipamento"
import { DicaLeitorNativo } from "@/components/dica-leitor-nativo"
import { Farol } from "@/components/farol"
import { GuardaFormulario } from "@/components/guarda-formulario"
import { Icone } from "@/components/icone"
import { Abas } from "@/components/ui/abas"
import { BloqueioPremium } from "@/components/ui/bloqueio-premium"
import { BotaoCirculo } from "@/components/ui/botao-circulo"
import { BASE_BOTAO_FICHA, BotaoFicha } from "@/components/ui/botao-ficha"
import { BotaoPendente } from "@/components/ui/botao-pendente"
import { CabecalhoCartao } from "@/components/ui/cabecalho-cartao"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { Chip, ChipLinha } from "@/components/ui/chip"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { FaixaAlerta } from "@/components/ui/faixa-alerta"
import { FaixaKpi, PastilhaKpi } from "@/components/ui/faixa-kpi"
import { Gaveta } from "@/components/ui/gaveta"
import { GradeRotuloValor } from "@/components/ui/grade-rotulo-valor"
import { LinhaLista } from "@/components/ui/linha-lista"
import { MigalhaPao } from "@/components/ui/migalha-pao"
import { AcaoDoHub } from "@/components/ui/numeros-do-hub"
import { ObjetoHub } from "@/components/ui/objeto-hub"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { Selo } from "@/components/ui/selo"
import {
  calcularSemaforo, formatarDataCurta, linhaDaRegra, PESO, rotuloDoFarol, seloDoFarol,
  temInformacaoSuficiente, vencimentoPorData,
} from "@/lib/domain/semaforo"
import { carregarNivelPlano, carregarPainel, carregarUsoDiario, hojeISO, itemMonitoradoToItemCalc } from "@/lib/consultas"
import { carregarModeloDoCatalogo } from "@/lib/consultas-catalogo"
import { criarEvento } from "@/lib/acoes/eventos"
import { excluirEquipamento, removerFotoEquipamento } from "@/lib/acoes/equipamentos"
import { faixaDeAno, identidadeDoMotor, nomeCompletoDoModelo } from "@/lib/domain/catalogo-motor"
import { abaDoEquipamento } from "@/lib/domain/diario"
// (ROTULO_MOTOR saiu junto com a linha de regra escrita à mão — a frase agora
// é `linhaDaRegra`, a mesma do canvas, com teste em semaforo.test.ts.)
import { prazoCompacto } from "@/lib/domain/inicio"
import { carimboDaLeitura } from "@/lib/domain/leituras"
import { ROTULO_ZONA } from "@/lib/domain/mapa-embarcacao"
import { formatarReais } from "@/lib/domain/gastos"
import { avisoAcervoAcimaDoTeto, mensagemBloqueio, recursoLiberado } from "@/lib/domain/plano-acesso"
import { iconeDoSistema, ordenarSistemas, urlManualNaPagina } from "@/lib/domain/sistemas"
import { mediaHorasPorSemana, previsaoDias } from "@/lib/domain/uso"
import { podeEditar } from "@/lib/domain/permissoes"
import { supabaseServer } from "@/lib/supabase/server"
import { TOQUE } from "@/lib/ui/acoes"
import { hub, type ChaveHub } from "@/lib/ui/hubs"
import type { EquipamentoSistema } from "@/lib/db/types"

export default async function EquipamentoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  // ONDA 79 (chips de filtro com contagem, spec §3 item 10) — o recorte da
  // lista de Manutenções mora na URL, mesmo padrão de `/barco/historico`
  // (`FILTROS_SETOR`/`FILTROS_STATUS` ali): navegável, compartilhável,
  // sobrevive a um F5.
  // ONDA 146 — `registrar` abre a GAVETA de "Registrar manutenção" (imagem
  // 12 do guia) pelo mesmo princípio: gaveta aberta é URL, então o voltar do
  // navegador fecha e F5 reabre. `erro` é o retorno das actions que voltam
  // pra ESTA tela (remover foto) — a ficha não tinha onde mostrar a recusa.
  searchParams: Promise<{ filtroManut?: string; registrar?: string; erro?: string }>
}) {
  const { id } = await params
  const { filtroManut: filtroManutBruto, registrar, erro } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const equipamento = painel.equipamentos.find((e) => e.id === id)
  if (!equipamento) notFound()

  const ehMotor = equipamento.tipo === "motor"
  const aba = abaDoEquipamento(equipamento.tipo)
  const editavel = podeEditar(painel.permissoes, aba)
  const hoje = hojeISO()

  // ONDA 146 — o HUB desta ficha, pela mesma régua de `abaDoEquipamento`:
  // motor mora em Motores, "outro" em Equipamentos, o resto (gerador,
  // bateria, painel) em Elétrica. É a identidade que veste o medalhão do
  // cabeçalho, a borda do palco e o CTA da gaveta — classes SEMPRE lidas da
  // tabela de `lib/ui/hubs.ts`, nunca escritas à mão (§5: a cor do hub X só
  // aparece no hub X, e esta ficha É do hub dela).
  const chaveHub: ChaveHub = ehMotor ? "motores" : equipamento.tipo === "outro" ? "equipamentos" : "eletrica"
  const hubDaFicha = hub(chaveHub)

  // Registrar serviço grava no DIÁRIO (`criarEvento` exige `diario:editar`,
  // independente da aba do equipamento) — o convite só aparece pra quem a
  // action vai aceitar; oferecer e recusar depois seria clique morto.
  const podeDiario = podeEditar(painel.permissoes, "diario")

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

  // ONDA 79 — contagens reaproveitadas em três lugares novos desta ficha: a
  // faixa de KPI do topo, o alerta de vencidos e os chips de filtro da
  // lista. Um item SEM informação suficiente (`!temInfo`) não entra em
  // nenhum balde de status — ele já não entrava na conta da Saúde (comentário
  // mais abaixo), e contá-lo como "ok" aqui inflaria "Em dia" com item que
  // ninguém sabe se está em dia.
  const contarPorStatus = (status: "vencido" | "atencao" | "ok") =>
    itens.filter(({ r, temInfo }) => temInfo && r.status === status).length
  const vencidos = contarPorStatus("vencido")
  const emAtencao = contarPorStatus("atencao")
  const emDia = contarPorStatus("ok")

  const VALORES_FILTRO_MANUT = ["vencido", "atencao", "ok"] as const
  const filtroManut = (VALORES_FILTRO_MANUT as readonly string[]).includes(filtroManutBruto ?? "")
    ? (filtroManutBruto as (typeof VALORES_FILTRO_MANUT)[number])
    : null
  const itensExibidos = filtroManut ? itens.filter(({ r, temInfo }) => temInfo && r.status === filtroManut) : itens

  // ONDA 146 — os dois lados da porta da gaveta, com o filtro preservado:
  // abrir a gaveta não pode descartar o recorte que a pessoa escolheu na
  // lista, e fechá-la devolve exatamente a URL de onde ela veio.
  const baseFicha = `/barco/equipamento/${id}`
  const hrefRegistrar = filtroManut ? `${baseFicha}?filtroManut=${filtroManut}&registrar=1` : `${baseFicha}?registrar=1`
  const hrefFecharGaveta = filtroManut ? `${baseFicha}?filtroManut=${filtroManut}` : baseFicha
  const registrarAberto = registrar === "1" && podeDiario

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
  // ONDA 146 — o que a GAVETA precisa, buscado SÓ com ela aberta (a URL diz
  // quando): a lista de prestadores pro select do formulário, e o gate de
  // plano — a MESMA dupla de checagens de `/diario/novo`, porque a gaveta é
  // aquele formulário morando aqui. Bloqueado, a gaveta mostra o cadeado
  // honesto em vez do formulário que a action recusaria; e o aviso de acervo
  // acima do teto vem ANTES do cadeado, porque a primeira coisa a ler é que
  // nada foi apagado. `criarEvento` re-checa tudo no servidor de qualquer
  // jeito — bloqueio só na interface é decorativo.
  let contatosGaveta: { id: string; nome: string; especialidade: string | null }[] = []
  let bloqueioGaveta: ReturnType<typeof mensagemBloqueio> | null = null
  let avisoTetoGaveta: string | null = null
  if (registrarAberto) {
    const [nivel, usoDiario] = await Promise.all([carregarNivelPlano(), carregarUsoDiario()])
    if (!recursoLiberado("diario_registros", nivel, usoDiario)) {
      bloqueioGaveta = mensagemBloqueio("diario_registros", usoDiario)
      avisoTetoGaveta = avisoAcervoAcimaDoTeto("diario_registros", nivel, usoDiario)
    } else {
      const { data: contatos } = await supabase
        .from("contatos").select("id, nome, especialidade").order("nome")
      contatosGaveta = contatos ?? []
    }
  }

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

  // Reaproveitado pela pastilha de KPI "Horímetro" — mesma formatação do
  // mostrador do instrumento mais abaixo, escrita uma vez só.
  const horimetroTexto = equipamento.horas_atuais != null
    ? `${equipamento.horas_atuais.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h`
    : "—"

  // ONDA 146 — o segundo número de instrumento do cabeçalho (imagem 12):
  // "Próxima revisão" é o MENOR marco de horas entre os itens vigiados —
  // último ciclo + intervalo, que é exatamente o `horasRestantes` que o
  // semáforo já calculou, somado de volta ao horímetro. Nenhuma régua nova.
  // Sem horímetro ou sem item com intervalo de horas, o número NÃO existe e
  // nada é inventado: o convite de informar leitura já mora no cartucho do
  // horímetro, e item sem intervalo já tem o estado "Incompleto" na lista.
  const horasAtuais = equipamento.horas_atuais
  const marcosDeRevisao = horasAtuais == null
    ? []
    : itens.flatMap(({ temInfo, r }) => (temInfo && r.horasRestantes != null ? [horasAtuais + r.horasRestantes] : []))
  const proximaRevisaoTexto = marcosDeRevisao.length > 0
    ? `${Math.min(...marcosDeRevisao).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} h`
    : null

  // A pílula que senta SOBRE o palco (foto ou render): paleta FIXA de
  // instrumento — `meter` nos dois temas — porque o fundo dela é uma foto
  // arbitrária ou o navy do cartucho, e cor de tema em cima de foto é
  // loteria de contraste. Mesmo par translúcido dos controles sobre foto de
  // `card-embarcacao.tsx` (`bg-meter/70` + `text-meter-texto` + blur), e o
  // alvo de 44px vem do `min-h-[var(--altura-controle)]` da própria pílula.
  const PILULA_PALCO = `inline-flex min-h-[var(--altura-controle)] items-center gap-1.5 rounded-[var(--raio-pilula)] border border-meter-texto/25 bg-meter/70 px-4 text-sm font-medium text-meter-texto backdrop-blur ${TOQUE}`

  // ONDA 79 (anatomia Haulix, spec §3 item 2) — o mesmo caminho que
  // `voltarHref`/`voltarRotulo` já descrevem, só que por EXTENSO: "Voltar"
  // é a aresta (a tela anterior); a migalha é a hierarquia inteira até
  // aqui. Motor não tem degrau do meio porque `voltarHref` dele JÁ é
  // "/barco" — repetir o mesmo destino duas vezes na migalha seria migalha
  // decorativa, não caminho.
  const migalha = ehMotor
    ? [{ rotulo: "Barco", href: "/barco" }, { rotulo: nomeCurto(equipamento) }]
    : [
        { rotulo: "Barco", href: "/barco" },
        { rotulo: "Elétrica", href: "/barco/eletrica" },
        { rotulo: nomeCurto(equipamento) },
      ]

  return (
    <main>
      <MigalhaPao itens={migalha} />

      {/* ONDA 79 (spec §3 item 1) — a faixa de KPI da referência fica
          ACIMA de tudo, inclusive do título. Aqui os cinco números são da
          PRÓPRIA ficha (não da frota — o Commander não tem esse conceito):
          quanto sistema, quanto item de manutenção (e quanto vencido),
          quanto horímetro, quanto histórico. Tudo já calculado acima —
          nenhum dado novo buscado só pra esta faixa. */}
      <FaixaKpi className="mt-2">
        <PastilhaKpi icone="motor" rotulo="Sistemas" valor={String(sistemas.length)} />
        <PastilhaKpi icone="ferramenta" rotulo="Manutenções" valor={String(itens.length)} />
        <PastilhaKpi icone="alerta" rotulo="Vencidos" valor={String(vencidos)} />
        <PastilhaKpi icone="relogio" rotulo="Horímetro" valor={horimetroTexto} />
        <PastilhaKpi icone="calendario" rotulo="Histórico" valor={String((eventos ?? []).length)} />
      </FaixaKpi>

      {/* ONDA 60 — a anatomia de ficha da imagem 2 (docs/DESIGN-SYSTEM.md):
          título grande + chip de estado colado + subtítulo (marca/modelo) +
          barra de ações.
          ONDA 146 (imagem 12) — entra o MEDALHÃO do hub ao lado do nome
          (`hub=`, o mesmo cartucho+filete das oito telas de hub, agora com o
          título DESTA ficha) e, na barra da direita, os dois números de
          instrumento do mock: Horímetro atual e Próxima revisão — mini
          cartuchos `bg-meter`, porque número de instrumento veste navy fixo
          nesta casa. Cada um só existe COM dado por trás (sem leitura, o
          convite mora no cartucho grande do horímetro logo abaixo). */}
      <CabecalhoDetalhe
        className="mt-3"
        voltarHref={ehMotor ? "/barco" : "/barco/eletrica"}
        voltarRotulo={ehMotor ? "Embarcação" : "Elétrica"}
        hub={chaveHub}
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
        // ONDA 79 (spec §3 item 3) — a barra de ações da referência é DOIS
        // contornos + UM preenchido + "···". Aqui ficam os dois contornos
        // (Editar, Excluir); SEM preenchido de propósito — comentário
        // completo em `botao-ficha.tsx`: o CTA preenchido desta ficha já
        // mora colado no horímetro, e repeti-lo aqui duplicaria a ação
        // principal (docs/DESIGN.md §5, "ação que se repete não é ação
        // principal"). Sem "···" também: as únicas duas ações de nível
        // "ficha" que este equipamento tem são estas duas — inventar um
        // terceiro nível vazio seria clique morto.
        acoes={
          equipamento.horas_atuais != null || proximaRevisaoTexto != null || editavel ? (
            <>
              {equipamento.horas_atuais != null && (
                <span className="flex items-baseline gap-1.5 rounded-[var(--raio-controle)] border border-line bg-meter px-3 py-2">
                  <span className="rotulo-dado text-meter-dim">Horímetro</span>
                  <span className="tabular-nums text-sm font-semibold tabular-nums text-meter-texto">{horimetroTexto}</span>
                </span>
              )}
              {proximaRevisaoTexto != null && (
                <span className="flex items-baseline gap-1.5 rounded-[var(--raio-controle)] border border-line bg-meter px-3 py-2">
                  <span className="rotulo-dado text-meter-dim">Próxima revisão</span>
                  <span className="tabular-nums text-sm font-semibold tabular-nums text-meter-texto">{proximaRevisaoTexto}</span>
                </span>
              )}
              {editavel && (
                <>
                  <BotaoFicha href={`/barco/equipamento/${id}/editar`}>Editar</BotaoFicha>
                  <form action={excluirEquipamento}>
                    <input type="hidden" name="equipamento_id" value={id} />
                    <Confirmar
                      mensagem="Excluir equipamento e todo o seu histórico de itens?"
                      rotulo="Excluir equipamento"
                      className={`${BASE_BOTAO_FICHA} border-crit/30 bg-panel text-crit`}
                    />
                  </form>
                </>
              )}
            </>
          ) : undefined
        }
      />

      {/* O retorno de erro das actions que voltam pra ESTA tela (remover
          foto) — mesmo vestido da faixa de erro de /diario/novo. Sem isto a
          recusa era um redirect mudo. */}
      {erro && (
        <p className="mt-3 rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2 text-sm">{erro}</p>
      )}

      {/* ONDA 146 — O PALCO DA FICHA (imagem 12 do guia, os dois primeiros
          estados). Cartucho de instrumento — `raio-painel`, navy fixo
          (`bg-meter`), borda na cor do hub lida da tabela — mostrando:

            · COM foto real: a foto no palco inteiro, com as pílulas "Trocar
              foto" e "Remover" do mock (só pra quem pode editar). Trocar
              reaproveita o upload que o formulário de editar TEM desde a
              onda 15 — nenhum segundo caminho de foto nasce aqui.
            · SEM foto: o render do hub (`ObjetoHub`, o mesmo recorte
              normativo das telas de hub) sobre o véu na cor do hub, com a
              pílula "Adicionar foto real" — ilustração técnica neutra, nunca
              uma foto que finja ser o equipamento da pessoa (PRD §3.5).

          Este palco SUBSTITUI o retângulo de foto que morava lá embaixo
          (onda 15/62) — e com ele saem as 8 cores literais que aquele bloco
          escrevia à mão (o gradiente navy e o cinza do convite): o mapa de
          `tokens.test.ts` zera pra este arquivo. */}
      <div className={`raio-painel sombra-1 relative mt-5 overflow-hidden border bg-meter ${hubDaFicha.borda}`}>
        {urlFoto ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada e temporária do storage */}
            <img src={urlFoto} alt={`Foto de ${nomeCurto(equipamento)}`} className="h-52 w-full object-cover sm:h-64" />
            {editavel && (
              <div className="absolute bottom-3 right-3 flex flex-wrap justify-end gap-2">
                <Link href={`/barco/equipamento/${id}/editar`} className={PILULA_PALCO}>
                  <Icone nome="camera" className="size-4" /> Trocar foto
                </Link>
                <form action={removerFotoEquipamento}>
                  <input type="hidden" name="equipamento_id" value={id} />
                  <BotaoPendente aria-label="Remover a foto real" className={PILULA_PALCO}>
                    Remover
                  </BotaoPendente>
                </form>
              </div>
            )}
          </>
        ) : (
          <div className={`relative flex h-52 items-center justify-center sm:h-64 ${hubDaFicha.tom}`}>
            <span aria-hidden="true" className={`absolute inset-0 ${hubDaFicha.halo}`} />
            <ObjetoHub chave={chaveHub} className="relative h-36 w-56 sm:h-44 sm:w-72" />
            {editavel && (
              <Link
                href={`/barco/equipamento/${id}/editar`}
                aria-label={`Adicionar foto real do seu ${rotuloFotoConvite}`}
                className={`absolute bottom-3 right-3 ${PILULA_PALCO}`}
              >
                <Icone nome="camera" className="size-4" /> Adicionar foto real
              </Link>
            )}
          </div>
        )}
      </div>

      {/* ONDA 79 (spec §3 item 4) — navegação de salto pras seções da
          própria ficha, mesmo componente `Abas` das telas com rota própria
          por aba, só que aqui cada "aba" é uma âncora (`#manutencoes`...) —
          a ficha continua sendo UMA rota só, rolagem contínua (onda 62: "o
          topo é do horímetro e do que está pedindo ação"), isto é atalho,
          não recorte de conteúdo. `ativa=""` de propósito: nenhuma seção
          está "ativa" sem um scroll-spy de cliente, e fingir uma seria pior
          que não marcar nenhuma. A contagem de "Alertas" é a mesma dos
          vencidos+atenção da faixa de KPI — inclusive quando é ZERO
          (onda 79, `abas.tsx`: "Alerts 0" da referência aparece, não some). */}
      <Abas
        className="mt-4"
        abas={[
          { valor: "geral", rotulo: "Visão geral", href: "#" },
          { valor: "manutencoes", rotulo: "Manutenções", href: "#manutencoes", contagem: itens.length },
          { valor: "sistemas", rotulo: "Sistemas", href: "#sistemas", contagem: sistemas.length },
          { valor: "historico", rotulo: "Histórico", href: "#historico", contagem: (eventos ?? []).length },
          { valor: "alertas", rotulo: "Alertas", href: "#manutencoes", contagem: vencidos + emAtencao },
        ]}
        ativa=""
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
            // Onda 87 — `rotulo-dado` pelo tamanho (11px em caixa de frase), e
            // NÃO `.rotulo`: estes chips carregam o NOME do equipamento irmão,
            // e `.rotulo` é caixa alta — passaria a reescrever o conteúdo.
            <Link key={e.id} href={`/barco/equipamento/${e.id}`}
              className={`whitespace-nowrap rounded-[var(--raio-pilula)] border px-4 py-2 tabular-nums rotulo-dado ${
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
        <div className="mt-2 flex items-baseline gap-2 tabular-nums tabular-nums">
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
        {/* ONDA 115 (FIX-002 do PRD) — o destino trocou. Este botão abria
            `/diario/novo?tipo=leitura_horas`, e o formulário do Diário NÃO TEM
            esse tipo entre os seis cartões: o tipo chegava vazio e a pessoa
            via Data e Descrição, sem campo de horas — o C-02 da auditoria
            ("o principal atalho do detalhe do motor não executa sua função").
            Agora abre a tela própria de leitura, com validação contra
            regressão e gravação de histórico + horímetro juntos. */}
        {editavel && (
          <Link
            href={`/barco/equipamento/${id}/horimetro`}
            className="mt-3.5 inline-flex h-11 items-center rounded-[var(--raio-controle)] bg-accent px-5 text-sm font-semibold text-acao-texto"
          >
            Informar leitura
          </Link>
        )}
      </div>

      {/* ONDA 146 — o CTA da gaveta (imagem 12): "Registrar manutenção" na
          cor DESTE hub, a mesma barra de largura cheia que fecha as telas de
          hub (`AcaoDoHub`). Não fura o orçamento de dourado: o §5 autoriza a
          cor do hub no card do próprio sistema, e o dourado da ficha segue
          sendo só o "Informar leitura" acima. É um link pra `?registrar=1`
          — a gaveta abre por URL, então o voltar do navegador a fecha. */}
      {podeDiario && (
        <AcaoDoHub chave={chaveHub} href={hrefRegistrar} scroll={false} className="mt-3">
          Registrar manutenção
        </AcaoDoHub>
      )}

      {/* ONDA 79 — o painel de Manutenções ganha a anatomia de cartão
          Haulix inteira: cabeçalho em destaque (spec §3 item 5), alerta
          condicional de vencido (item 7) e chips de filtro com contagem
          (item 10), tudo dentro do MESMO cartão — como a referência
          aninha "Cargo Layout" + o resto. Substitui o `SecaoPagina` +
          `<div>` que existiam aqui; o comportamento da lista (empty state,
          farol, prazo) não mudou uma linha, só a moldura em volta. */}
      <div id="manutencoes" className="mt-6 scroll-mt-4">
        <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-3">
          <CabecalhoCartao
            icone="ferramenta"
            titulo="Manutenções"
            selo={itens.length > 0 ? <Selo estado={seloDoFarol(statusFicha)}>{rotuloDoFarol(statusFicha)}</Selo> : undefined}
            acao={
              editavel ? (
                <BotaoCirculo
                  icone="mais"
                  rotulo="Nova manutenção"
                  href={`/barco/itens/novo?alvo=${encodeURIComponent(`eq:${id}`)}`}
                />
              ) : undefined
            }
          />

          {/* Só desenha com vencido de verdade — docs/DESIGN.md §6, regra 4
              ("nunca decorar o vazio"): zero vencido, zero faixa. */}
          {vencidos > 0 && (
            <FaixaAlerta
              titulo={vencidos === 1 ? "1 manutenção vencida" : `${vencidos} manutenções vencidas`}
              className="mb-3"
            >
              Ite{vencidos === 1 ? "m passou" : "ns passaram"} do prazo — resolva assim que possível.
            </FaixaAlerta>
          )}

          {/* Recorte com contagem (spec §3 item 10) — só aparece havendo o
              que filtrar; lista vazia não ganha fileira de chip inútil. */}
          {itens.length > 0 && (
            <ChipLinha className="mb-3">
              <Chip href={`/barco/equipamento/${id}#manutencoes`} ativo={filtroManut === null} contagem={itens.length}>
                Todos
              </Chip>
              <Chip href={`/barco/equipamento/${id}?filtroManut=vencido#manutencoes`} ativo={filtroManut === "vencido"} contagem={vencidos}>
                Vencido
              </Chip>
              <Chip href={`/barco/equipamento/${id}?filtroManut=atencao#manutencoes`} ativo={filtroManut === "atencao"} contagem={emAtencao}>
                Atenção
              </Chip>
              <Chip href={`/barco/equipamento/${id}?filtroManut=ok#manutencoes`} ativo={filtroManut === "ok"} contagem={emDia}>
                Em dia
              </Chip>
            </ChipLinha>
          )}

          {itensExibidos.length === 0 && (
            <EstadoVazio
              variant="linha"
              icone="ferramenta"
              titulo={itens.length === 0 ? "Nenhuma manutenção cadastrada aqui ainda" : "Nenhum item neste recorte"}
            />
          )}
          {itensExibidos.map(({ item, calc, r, temInfo }) => {
          const dias = r.horasRestantes != null && r.horasRestantes >= 0 && media != null ? previsaoDias(r.horasRestantes, media) : null
          const venc = vencimentoPorData(calc)
          // Canvas tela-3c — item SEM informação suficiente não finge estado:
          // ponto vazado (não o farol verde) no lugar do farol. Ele não entra
          // na conta da Saúde, nem a favor nem contra.
          //
          // ONDA 92 (achado 6.2) — "Completar" era um `<span>` com verbo
          // imperativo na cor de ação, sem `href` e sem `button`: prometia uma
          // ação específica e entregava "abrir a ficha". Vira o estado que é.
          // `neutro`, não `atencao`: um item que a régua se recusa a avaliar
          // não pode receber uma cor de semáforo — "Sem dados" é a leitura
          // certa, e é a que `neutro` carrega. Ver o gêmeo desta linha em
          // `barco/documentos/page.tsx`.
          if (!temInfo) {
            return (
              <LinhaLista
                key={item.id}
                href={editavel ? `/barco/itens/${item.id}/editar` : undefined}
                leading={<span aria-label="sem informação suficiente" className="inline-block size-2 shrink-0 rounded-[var(--raio-pilula)] border border-dim/60 bg-transparent" />}
                titulo={item.nome}
                subtitulo={linhaDaRegra(calc)}
                trailing={<Selo estado="neutro">Incompleto</Selo>}
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
      </div>{/* fecha #manutencoes */}

      {/* A foto que morava aqui (onda 15/62) SUBIU: ela agora É o palco do
          topo, como a imagem 12 desenha — ver o cartucho logo abaixo do
          cabeçalho. */}

      {/* Sistemas (onda 15, "motor vivo") — o elo novo entre o equipamento e
          o manual do fabricante já guardado no acervo. Sistema com manual
          abre o PDF na página certa; sem manual, o clique leva a vincular
          um (nunca clique morto, ver docs/CONTRIBUTING.md). */}
      <SecaoPagina
        id="sistemas"
        className="scroll-mt-4"
        icone="motor"
        acao={editavel ? { href: `/barco/equipamento/${id}/sistemas/novo`, rotulo: "Sistema", icone: "mais" } : undefined}
      >
        Sistemas
      </SecaoPagina>
      <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
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
                  className="apoio flex min-h-11 shrink-0 items-center rounded-[var(--raio-controle)] border border-line px-3 text-dim"
                >
                  Editar
                </Link>
              )}
            </div>
          )
        })}
      </div>

      {/* ONDA 146 — "Registrar serviço" parou de NAVEGAR pra /diario/novo e
          passou a abrir a GAVETA (`?registrar=1`): é o mesmo formulário, só
          que sem tirar a pessoa da ficha. Some pra quem não pode escrever no
          Diário — antes o link levava até lá pra ouvir a recusa. */}
      <SecaoPagina
        id="historico"
        className="scroll-mt-4"
        icone="calendario"
        acao={podeDiario ? { href: hrefRegistrar, rotulo: "Registrar serviço" } : undefined}
      >
        Histórico
      </SecaoPagina>
      <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
        {(eventos ?? []).length === 0 && (
          <EstadoVazio variant="linha" icone="calendario" titulo="Nenhum serviço registrado neste equipamento ainda" />
        )}
        {(eventos ?? []).map((e) => (
          <LinhaLista
            key={e.id}
            titulo={e.descricao ?? e.tipo}
            subtitulo={
              <>
                <span className="tabular-nums tabular-nums">
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
          histórico → dados.
          ONDA 79 (spec §3 item 6) — o `<dl>` escrito à mão virou
          `GradeRotuloValor`: mesmo par de colunas, mesmo comportamento pro
          campo vazio ("—"), só que agora com o rótulo medido da referência
          (`.rotulo-dado`, caixa de frase) em vez do `.rotulo` maiúsculo —
          é literalmente o par "Client / Loading order" da imagem, com dado
          nosso. */}
      <SecaoPagina id="dados" className="scroll-mt-4" icone="documento">Dados</SecaoPagina>
      <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
        <GradeRotuloValor itens={especificacoes} />
        {equipamento.observacoes && <p className="apoio mt-3 text-dim">{equipamento.observacoes}</p>}
        {/* O "Editar equipamento" que morava aqui subiu pra barra de ações do
            cabeçalho (onda 60) — dois caminhos pro mesmo formulário na mesma
            tela era exatamente o que a anatomia de ficha veio arrumar. */}
      </div>

      {/* ONDA 146 — A GAVETA "Registrar manutenção" (terceiro estado da
          imagem 12): o formulário de serviço que a ficha sempre ofereceu —
          o MESMO `FormularioNovoEvento`/`criarEvento` de /diario/novo, já
          fixo em Manutenção e com este equipamento escolhido no "Onde no
          barco?" — agora abre POR CIMA da ficha em vez de navegar embora.
          Data, o que foi feito, renovação de ciclo, custo, horímetro,
          prestador e anexo: os campos do mock, com o `BotaoEnviar` de
          sempre avisando o envio. O `GuardaFormulario` usa a MESMA chave da
          tela do Diário de propósito: se a action recusar, o redirect de
          erro cai em /diario/novo e o rascunho digitado aqui é restaurado
          lá — nada se perde no caminho. Só entra na árvore com a URL
          dizendo `registrar=1`; presença é abertura (ver gaveta.tsx). */}
      {registrarAberto && (
        <Gaveta titulo="Registrar manutenção" fecharHref={hrefFecharGaveta}>
          {bloqueioGaveta ? (
            <>
              {avisoTetoGaveta && (
                <p className="corpo mb-3 rounded-[var(--raio-controle)] border border-line bg-panel2 px-3 py-2 text-dim">
                  {avisoTetoGaveta}
                </p>
              )}
              <BloqueioPremium {...bloqueioGaveta} />
            </>
          ) : (
            <form action={criarEvento} className="space-y-4">
              <GuardaFormulario chave="diario:novo" />
              <FormularioNovoEvento
                tipoFixo
                tipoInicial="manutencao"
                dataInicial={hoje}
                tripulacao={[]}
                equipamentos={painel.equipamentos}
                itens={painel.itens}
                contatos={contatosGaveta}
                alvoInicial={`eq:${id}`}
                itemInicial=""
                custoInicial=""
              />
            </form>
          )}
        </Gaveta>
      )}
    </main>
  )
}
