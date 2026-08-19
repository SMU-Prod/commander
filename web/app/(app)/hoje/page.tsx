import Link from "next/link"
import { redirect } from "next/navigation"
import { Suspense, type ReactNode } from "react"
// O `Avatar` ficou: ele desapareceu do cabeçalho (que virou a `FaixaTopo`
// global) mas continua desenhando a fileira de tripulantes, lá embaixo.
import { Avatar } from "@/components/avatar"
import { CardEmbarcacao } from "@/components/card-embarcacao"
import { CaminhoInicial } from "@/components/onboarding/caminho-inicial"
import { Icone, type NomeIcone } from "@/components/icone"
import { TituloTela } from "@/components/titulo-tela"
import { Cartao } from "@/components/ui/cartao"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { GraficoBarras } from "@/components/ui/grafico-barras"
import { Kpi } from "@/components/ui/kpi"
import { LinhaLista } from "@/components/ui/linha-lista"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { Selo } from "@/components/ui/selo"
import {
  calcularSemaforo,
  formatarDataCurta,
  PESO,
  seloDoFarol,
  temInformacaoSuficiente,
  type StatusFarol,
} from "@/lib/domain/semaforo"
import {
  calcularSaudeEmbarcacao,
  FAROL_ESTADO_SAUDE,
  type ItemParaSaude,
  type OcorrenciaParaSaude,
} from "@/lib/domain/saude"
import { AREA_AGENDA } from "@/lib/domain/agenda"
import { formatarCarimbo } from "@/lib/domain/datas"
import { formatarReais, resumoGastos, variacaoPercentual } from "@/lib/domain/gastos"
import { carregarCapaDoHeroi, carregarPainel, carregarProximaViagem, hojeISO, itemMonitoradoToItemCalc } from "@/lib/consultas"
import { abaDoItem, nomeDoEquipamento } from "@/lib/domain/diario"
import {
  apoioDaRevisao,
  contagemDaSaude,
  estadoExibidoDaSaude,
  horasDoMotor,
  idadeCompacta,
  linkDoFator,
  prazoCompacto,
  precisaDoCaminhoInicial,
  primeirosPassos,
  rotuloDaSaude,
  seloDoMar,
  textoUltimaSaida,
  variacaoDoMes,
} from "@/lib/domain/inicio"
import { ESTADOS_QUE_PESAM_NA_SAUDE } from "@/lib/domain/ocorrencias"
import { podeVer, podeEditar, type Aba } from "@/lib/domain/permissoes"
import { resumoAno, type EventoParaResumoAno } from "@/lib/domain/resumo-ano"
import type { Ocorrencia } from "@/lib/db/types"
import { boletimDoMar } from "@/lib/mar"
import { LINK_TABUA_MARE_CHM, pontoCardeal } from "@/lib/domain/mar"
import { supabaseServer } from "@/lib/supabase/server"
import { ALVO_ACAO, PILULA_ACAO, PILULA_ACAO_PRINCIPAL, TOQUE } from "@/lib/ui/acoes"

const ROTULO_MARE: Record<"preamar" | "baixa-mar", string> = { preamar: "Preamar", "baixa-mar": "Baixa-mar" }

/** Conteúdo do boletim — sem casca própria desde a onda 57: ele mora DENTRO
 *  do cartão "Mar agora", e cartão dentro de cartão empilha borda e sombra
 *  que não existem (docs/DESIGN.md §5, elevação). */
async function BoletimDoMar({ lat, lon }: { lat: number; lon: number }) {
  const boletim = await boletimDoMar(lat, lon)
  if (!boletim) {
    return <p className="corpo text-dim">Boletim indisponível agora. Tente mais tarde.</p>
  }
  return (
    <>
      {/* Onda 93 (achado 5.12) — os três rótulos eram
          `text-[11px] uppercase tracking-[.12em]`, que é `.rotulo` reescrita à
          mão com o tracking derivado (.12 contra .16). O `font-mono-instr` do
          pai já dava a fonte; agora a classe dá as quatro coisas de uma vez. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono-instr text-sm tabular-nums">
        <span><span className="rotulo mr-1.5 text-dim">Onda</span>{boletim.ondaM != null ? `${boletim.ondaM.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} m` : "—"}</span>
        <span>
          <span className="rotulo mr-1.5 text-dim">Vento</span>
          {boletim.ventoKt != null
            ? `${Math.round(boletim.ventoKt)} kt${boletim.ventoGraus != null ? ` ${pontoCardeal(boletim.ventoGraus)}` : ""}`
            : "—"}
        </span>
        <span><span className="rotulo mr-1.5 text-dim">Água</span>{boletim.aguaC != null ? `${Math.round(boletim.aguaC)} °C` : "—"}</span>
        {/* Onda 57 — era uma pílula escrita à mão aqui (border + cor por
            nível, mais uma das doze cópias que a varredura de 15/08 achou).
            Agora é o mesmo `Selo` do estado do barco: uma anatomia só de
            "estado tem cor E palavra". */}
        <span className="ml-auto"><Selo estado={seloDoMar(boletim.selo.nivel)}>{boletim.selo.rotulo}</Selo></span>
      </div>
      {/* ONDA 84 — O AVISO PASSA A DIZER DE QUÊ.
          O dono viu "ONDA 1 m · VENTO 4 kt" ao lado de um selo âmbar
          "ATENÇÃO NO MAR" e perguntou o que aquilo indicava. O selo estava
          certo e ilegível: ele nomeia o NÍVEL e nunca nomeava a CAUSA, então
          numa linha com três números não havia como saber qual deles pesou.
          Agora a causa vem escrita, com a mesma medida que está acima —
          "atenção no mar · onda 1,4 m" se lê de uma vez. */}
      {boletim.selo.motivo && (
        <p className={`apoio mt-1.5 ${boletim.selo.nivel === "crit" ? "text-crit" : "text-warn"}`}>
          Por causa de {boletim.selo.motivo}.
        </p>
      )}
      {/* Maré (onda 20): sempre rotulada "estimativa" + link pra tábua oficial
          do CHM — nunca "tábua de marés" nem "preamar/baixa-mar oficial"
          (ressalva de honestidade obrigatória, ver CONTRIBUTING.md). Uma
          linha só, pra não virar painel meteorológico dentro do boletim de
          5 segundos da Início. */}
      {boletim.proximaMareEstimada && (
        <p className="apoio mt-2 text-dim">
          {ROTULO_MARE[boletim.proximaMareEstimada.tipo]} estimada às{" "}
          <span className="font-mono-instr tabular-nums">
            {String(boletim.proximaMareEstimada.hora).padStart(2, "0")}h
          </span>{" "}
          ·{" "}
          {/* Sem dourado: o acento desta tela é a ação principal (Registrar
              saída), e link em meio de parágrafo não disputa com ela. */}
          <a href={LINK_TABUA_MARE_CHM} target="_blank" rel="noopener noreferrer" className="underline">
            tábua oficial do CHM
          </a>
        </p>
      )}
    </>
  )
}

/**
 * Ação secundária do cabeçalho de um cartão — usada 8 vezes nesta tela.
 *
 * ONDA 84 — ELA ERA TEXTO CINZA, E ESTA É A PRIMEIRA TELA DO APP.
 *
 * A onda 82 diagnosticou o problema e consertou `SecaoPagina`, `EstadoVazio`
 * e três telas: "texto cinza é exatamente o que o app usa para rótulo e
 * apoio, ou seja, para o que NÃO se toca". E deixou a Início de fora, com
 * oito ocorrências — a varredura passou pelos componentes compartilhados e
 * não pelas classes escritas à mão.
 *
 * O contraste ficava dentro do MESMO cartão: em "Gastos do mês", a ação do
 * estado vazio é uma pílula de 36px e a do cabeçalho, dois centímetros
 * acima, era texto cinza sem forma nenhuma. Mesmo cartão, mesmo gesto, dois
 * vestidos.
 *
 * Continua discreta (docs/DESIGN.md §6, regra 2: a segunda ação da tela não
 * disputa com a principal) — mas discreta agora quer dizer contorno, não
 * ausência de forma.
 *
 * E O RÓTULO VIROU UM SÓ. Esta tela tinha SEIS palavras para o mesmo gesto:
 * "Ver tudo", "Ver financeiro", "Ver todos", "Ver detalhes", "Ver ficha" e
 * "Gerenciar". O `docs/DESIGN.md` §6, regra 6, é explícito — *"duas telas que
 * fazem a mesma coisa têm que parecer a mesma coisa"* —, e vocabulário é
 * metade dessa aparência: seis nomes para "abrir a seção" fazem a pessoa
 * parar para ler, em vez de reconhecer.
 *
 * Sobram DUAS exceções, e as duas mudam o que acontece de verdade:
 * "Gerenciar" leva a uma tela de EDIÇÃO (convidar, remover acesso), não a uma
 * lista; e "Completar" aparece só quando o barco ainda não tem dado — é
 * convite para preencher, não para ver.
 */
function AcaoCartao({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={ALVO_ACAO}>
      <span className={PILULA_ACAO}>{children}</span>
    </Link>
  )
}

/**
 * O CARTUCHO DE SEVERIDADE DA LINHA DE ALERTA (onda 7).
 * ===========================================================================
 * O mockup desenha o alerta como LINHA compacta: símbolo de severidade à
 * esquerda, duas linhas de texto, chevron à direita — que é literalmente o §26
 * do HAULIX (*"Alerta: ícone · título · descrição · status · ações. Compacto —
 * nunca alertas enormes"*). Antes desta onda a esquerda era o `Farol`: um
 * ponto de 8px, o mesmo que a lista de motores e a de hubs usam.
 *
 * O PONTO NÃO ESTAVA ERRADO — ESTAVA NO LUGAR ERRADO. Ele é a marca de estado
 * de um ITEM dentro de uma lista de itens; aqui a linha inteira só existe
 * porque alguma coisa está errada, e o que a esquerda precisa dizer é O QUANTO
 * (vencido ou na margem), à distância de um braço, no píer, no sol. Os 36px do
 * cartucho dão ao vermelho ~1.300px² contra os ~50 do ponto.
 *
 * COR E FORMA, NUNCA SÓ COR (`docs/DESIGN.md` §6, regra 3): o glifo é o mesmo
 * nos dois estados e quem diz a palavra é o `subtitulo` da linha — "Vencido",
 * "Atenção", "Aberta · gravidade Alta" —, que vem de `FatorSaude.detalhe`, do
 * domínio, com teste. Por isso o cartucho é decoração pura para leitor de tela
 * (o `Icone` já é `aria-hidden` por construção) em vez de carregar um
 * `aria-label` que repetiria o texto ao lado.
 *
 * O tom é o do ESTADO e não um tom de hub: aqui a única cor que pode aparecer
 * é a do semáforo (a mesma régua que o cartucho dos oito hubs de `/barco`
 * respeita ao contrário — lá o tom é do hub e o estado mora no farol).
 */
const CARTUCHO_ALERTA: Record<StatusFarol, string> = {
  vencido: "border-crit/30 bg-crit/12 text-crit",
  atencao: "border-warn/30 bg-warn/12 text-warn",
  ok: "border-ok/30 bg-ok/12 text-ok",
}

function MarcaDeAlerta({ status }: { status: StatusFarol }) {
  return (
    <span
      className={`flex size-9 shrink-0 items-center justify-center rounded-[var(--raio-controle)] border ${CARTUCHO_ALERTA[status]}`}
    >
      <Icone nome="alerta" className="size-5" />
    </span>
  )
}

/**
 * TRIPULAÇÃO (onda 16) — vínculos reais do barco: dono (PROP) + comandantes
 * com acesso (CMDT). Nunca uma fileira fantasma: sozinho no barco vira convite.
 *
 * ONDA 100 — ESTÁ NUMA FUNÇÃO PORQUE É A ÚNICA CADEIA DE VERDADE DA TELA, e o
 * `Promise.all` da página precisa poder tratá-la como UM item. Os três degraus
 * existem de fato: os vínculos dizem quem está a bordo, os perfis dizem o nome
 * de quem os vínculos apontaram, e a URL assinada precisa do caminho do avatar
 * que só o perfil conhece. Nenhum deles é fila falsa.
 *
 * O QUE FICOU DE FORA, E POR QUÊ: dá para transformar os dois primeiros
 * degraus em um só, pedindo `vinculos` com `profiles` embutido (a chave
 * estrangeira `vinculos_usuario_id_fkey` existe e o PostgREST sabe atravessá-la).
 * Não foi feito porque isso troca a forma da consulta — e com ela a maneira
 * como a RLS de `profiles` é aplicada — por UMA volta de rede num total de
 * cinco, e não há sessão de teste contra este banco para provar que a lista
 * sai idêntica. Ganho pequeno, verificação impossível hoje: fica escrito, não
 * feito.
 *
 * O `createSignedUrl` continua um por avatar (teto de 5) em vez do
 * `createSignedUrls` em lote: as cinco já saem juntas, então o relógio é o
 * mesmo — o que se economizaria são conexões, não espera, e a versão em lote
 * devolve erro por item, que é outra régua de falha para esta tela ter de
 * aprender.
 */
async function carregarTripulacao(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  embarcacaoId: string,
): Promise<{
  tripulantes: { id: string; nome: string; avatarPath: string | null }[]
  tripulantesVisiveis: { id: string; nome: string; avatarPath: string | null }[]
  tripulantesExtras: number
  urlsTripulacao: Map<string, string | null>
}> {
  const { data: vinculosCrew } = await supabase
    .from("vinculos").select("usuario_id").eq("embarcacao_id", embarcacaoId)
  const idsCrew = [...new Set((vinculosCrew ?? []).map((v) => v.usuario_id))]
  const { data: perfisCrew } = idsCrew.length > 0
    ? await supabase.from("profiles").select("id, nome, avatar_path").in("id", idsCrew)
    : { data: [] as { id: string; nome: string; avatar_path: string | null }[] }
  const tripulantes = idsCrew.map((id) => {
    const p = (perfisCrew ?? []).find((pc) => pc.id === id)
    return { id, nome: p?.nome?.trim() || "Comandante", avatarPath: p?.avatar_path ?? null }
  })
  const tripulantesVisiveis = tripulantes.slice(0, 5)
  const urlsTripulacao = new Map(
    await Promise.all(
      tripulantesVisiveis
        .filter((t): t is typeof t & { avatarPath: string } => t.avatarPath != null)
        .map(async (t) => {
          const { data } = await supabase.storage.from("acervo").createSignedUrl(t.avatarPath, 3600)
          return [t.id, data?.signedUrl ?? null] as const
        }),
    ),
  )
  return {
    tripulantes,
    tripulantesVisiveis,
    tripulantesExtras: Math.max(0, tripulantes.length - tripulantesVisiveis.length),
    urlsTripulacao,
  }
}

export default async function HojePage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const { embarcacao, equipamentos, itens, papel, permissoes } = painel
  const hoje = hojeISO()
  const anoAtual = hoje.slice(0, 4)

  const avaliados = itens
    .map((i) => {
      const eq = equipamentos.find((e) => e.id === i.equipamento_id) ?? null
      const calc = itemMonitoradoToItemCalc(i)
      const r = calcularSemaforo(calc, eq?.horas_atuais ?? null, hoje)
      const temInformacao = temInformacaoSuficiente(calc, eq?.horas_atuais ?? null)
      const aba = abaDoItem(i, equipamentos)
      return { item: i, eq, r, temInformacao, aba }
    })
    .sort((a, b) => PESO[b.r.status] - PESO[a.r.status])

  const motores = equipamentos.filter((e) => e.tipo === "motor")

  // Quanto falta pra cada item — a contagem regressiva mono do canvas
  // (tela-1b: "-19 d" vencido, "18 h" na margem), à direita da linha de
  // "Precisa da sua atenção". Indexado por id porque a lista que ele
  // percorre é a de FATORES da saúde (que já mistura manutenção e
  // ocorrência, ordenada por criticidade), não a de itens.
  const restantePorItem = new Map(avaliados.map((a) => [a.item.id, prazoCompacto(a.r)]))

  // A revisão que o KPI de cada motor mostra. `avaliados` já vem do pior pro
  // melhor, então o primeiro item COM informação daquele motor é o mais
  // grave dele — mesma escolha que o hero fazia desde a onda 16.
  const revisaoPorMotor = new Map(
    motores.map((m) => [m.id, avaliados.find((a) => a.eq?.id === m.id && a.temInformacao)?.r ?? null]),
  )

  // "Última leitura" é renderizada DENTRO do cartão "Motores" e rotulada
  // assim — então ela só pode olhar para motores. Até a onda 57 era o máximo
  // de `ultima_leitura` de TODOS os equipamentos: a data podia vir de uma
  // bateria e ser lida como leitura de horímetro, e um barco sem motor
  // cadastrado mas com leitura em outro equipamento simplesmente perdia a
  // informação (o bloco onde ela mora nem é renderizado).
  const leiturasMotores = motores.map((m) => m.ultima_leitura).filter((d): d is string => d != null).sort()
  const ultimaLeitura = leiturasMotores.length > 0
    ? formatarCarimbo(leiturasMotores[leiturasMotores.length - 1])
    : null

  // "Tudo em dia" só pode ser dito quando existe dado real por trás: alguma
  // leitura de horas de verdade, ou algum vencimento com data informada pelo
  // dono. O onboarding cria itens com ultimo_ciclo_data = hoje sem o dono ter
  // digitado nada — por isso ultimo_ciclo_data não conta aqui, só os campos
  // que só existem se alguém realmente informou algo.
  // Tentei incluir `intervalo_meses` aqui para cobrir itens tipo "verniz a
  // cada 12 meses" — e reverti: o onboarding cria "Troca de óleo e filtros"
  // com intervalo_meses = 12 (ver lib/acoes/onboarding.ts), então incluir esse
  // campo faria o barco recém-cadastrado voltar a dizer "tudo em dia" sem dado
  // nenhum, que é o bug original. Fica o falso-negativo estreito (barco que só
  // monitora itens por intervalo em meses segue vendo "falta informação"):
  // errar para o lado de pedir informação é melhor que mentir que está em dia.
  // ONDA 57 — este mesmo sinal agora também segura o SELO da Saúde
  // (`estadoExibidoDaSaude`): antes ele só segurava o texto do bloco de
  // pendências, e o anel ao lado seguia dizendo "Saudável" no mesmo barco.
  const temDadoReal =
    equipamentos.some((e) => e.ultima_leitura != null) ||
    itens.some((i) => i.data_fixa != null || i.ultimo_ciclo_horas != null)

  const supabase = await supabaseServer()

  // ONDA 100 — CATORZE ESPERAS EM FILA VIRARAM DUAS, E A FILA ERA QUASE TODA
  // FALSA.
  //
  // Esta tela é a irmã do defeito que a onda 96 consertou uma camada abaixo,
  // no `carregarPainel` — e o diagnóstico é literalmente o mesmo: as consultas
  // "esperavam por causa de onde a variável foi lida, não por dependência de
  // dado". Da saudação até a tripulação eram catorze `await` em sequência, cada
  // um pagando uma volta de rede até São Paulo (~150 ms medidos, contra 0,5 a
  // 1,3 ms de trabalho dentro do Postgres). 14 × 150 ms ≈ 2,1 s — que é
  // exatamente o que o cronômetro mostrava com o banco praticamente vazio.
  //
  // O grafo real de dependência desta tela tem DOIS níveis:
  //
  //   1. tudo que só precisa de `user.id` e `embarcacao.id` — os dois já
  //      conhecidos desde o `carregarPainel` da primeira linha;
  //   2. só a tripulação, que é uma cadeia de verdade: os vínculos dizem QUEM
  //      está a bordo, os perfis dizem o NOME de quem, e a URL assinada precisa
  //      do caminho do avatar que veio no perfil. Três degraus reais.
  //
  // O QUE ISTO CUSTA, e por que é aceitável: consultas que antes só saíam sob
  // condição (`podeVerDiario`, `podeVerGastos`) continuam sob condição — o
  // ternário virou `Promise.resolve`, não uma consulta a mais para quem não
  // pode ver. E uma falha isolada continua isolada: o cliente Supabase resolve
  // com `{ data: null, error }` em vez de rejeitar, então o `Promise.all` não
  // desmonta a tela inteira por causa de um cartão — cada bloco continua
  // dizendo a verdade sobre o que conseguiu carregar, como antes.
  //
  // E A CONSULTA DE `profiles` SUMIU DAQUI. Ela era idêntica à que o
  // `carregarPainel` já fazia (onda 63) e vinha junto com um `auth.getUser()`
  // que é OUTRA ida à rede, não uma leitura de cookie. Duas voltas de rede para
  // saber o que já estava em `painel.perfil`.
  //
  // ONDA 7 — `nomeUsuario` e `avatarPath` saíram junto com a fileira de
  // saudação: quem desenha o avatar da conta agora é a `FaixaTopo`, e ela o
  // faz com as INICIAIS (o mesmo `nomeDoAvatar` do desktop), sem pedir URL
  // assinada nenhuma ao storage.

  // Seu ano no mar (onda 18, Pilar Strava do Mar) — totais pessoais a partir
  // das saídas já registradas no diário, sem coleta nova nenhuma.
  const podeVerDiario = podeVer(permissoes, "diario")
  // Despesas do mês (onda 16; fonte trocada na onda 42) — mesma janela de 6
  // meses e a mesma `lib/domain/gastos.ts` de sempre, mas lendo de
  // `lancamentos_financeiros` em vez de `eventos.custo_centavos`. É a mesma
  // decisão da migration 042: o Financeiro é a fonte do dinheiro, e somar as
  // duas contaria o mesmo gasto duas vezes. Só `status = 'pago'` entra — uma
  // conta a vencer não é dinheiro que saiu.
  const podeVerGastos = podeVer(permissoes, "gastos")
  const inicioJanelaGastos = `${Number(anoAtual) - 1}-01-01`

  const [
    { urlCapa, temFotos },
    { data: comandantes },
    { data: eventosSaida },
    proximaViagem,
    { data: ocorrenciasAtivasBrutas },
    { data: despesasMes },
    tripulacao,
  ] = await Promise.all([
    carregarCapaDoHeroi(),
    supabase
      .from("perfis_comandante").select("usuario_id, nome_publico, categoria, disponibilidade")
      .eq("tipo", "comandante").eq("visivel", true).limit(2),
    // A ORDEM É DA CONSULTA, NÃO DO ACASO. Até a onda 57 a saída mais recente
    // saía de um `reduce` com `>` estrito sobre uma consulta SEM `order`: com
    // duas saídas na mesma data, qual delas ditava a frase do cartão dependia
    // da ordem que o Postgres devolveu naquela requisição — a mesma tela,
    // recarregada, podia trocar de frase. Desempate por hora de saída, com
    // `nullsFirst: false` pra que a saída COM horário ganhe da que não tem
    // (ela é a única das duas que consegue dizer o tempo no mar).
    //
    // ONDA 100 — `distancia_nm` NO LUGAR DE `trilha`. Esta consulta baixava a
    // TRILHA GPS INTEIRA de todas as saídas do ano para somar um float por
    // saída. Medido no próprio banco: uma trilha no teto (4.000 pontos) pesa
    // 205,6 kB, e a linha desta consulta cai de 210.687 para 124 bytes. Um
    // barco que sai 3×/semana chega a dezembro com 144 saídas — 28,9 MB
    // baixados a cada abertura da tela inicial para exibir um número, contra
    // 17,4 kB agora. A distância é gravada na hora de salvar a trilha (ver
    // `lib/acoes/trilha.ts` e a migration 092), e a trilha crua só desce onde
    // alguém de fato desenha o traçado.
    //
    // ORDEM OBRIGATÓRIA: a migration 092 tem de ser aplicada ANTES deste
    // código subir. Sem a coluna, o PostgREST recusa a consulta inteira.
    podeVerDiario
      ? supabase
          .from("eventos").select("tipo, data, hora_saida, hora_retorno, distancia_nm")
          .eq("embarcacao_id", embarcacao.id).eq("tipo", "navegacao")
          .gte("data", `${anoAtual}-01-01`)
          .order("data", { ascending: false })
          .order("hora_saida", { ascending: false, nullsFirst: false })
      : Promise.resolve({ data: [] as EventoParaResumoAno[] }),
    // Próximas paradas (onda 19, Pilar Strava do Mar) — a PRÓXIMA viagem
    // planejada (data futura mais perto), com 2-3 paradas visíveis. Mesma
    // checagem de `podeVerDiario` (viagem é conteúdo de navegação, igual
    // "Seu ano no mar" acima) — sem ela, nem consulta o banco. Sem viagem
    // planejada, o cartão simplesmente não aparece mais abaixo (regra de
    // honestidade — nada de porta pra sala vazia).
    podeVerDiario ? carregarProximaViagem() : Promise.resolve(null),
    // Ocorrências abertas (onda 32) — gate de descoberta: precisa aparecer na
    // Início, não só dentro de cada hub. Sem filtro de aba na query: a RLS já
    // devolve só as ocorrências dos setores que esta pessoa pode ver, então
    // "sozinho no barco" ou "acesso restrito" nunca vazam linha nenhuma. Busca
    // TODAS as ativas (sem limite) porque a saúde (abaixo) precisa da lista
    // inteira pra pontuar corretamente.
    //
    // Onda 44: o filtro é `ESTADOS_QUE_PESAM_NA_SAUDE` (aberta + em
    // acompanhamento), não "tudo que não é resolvida" — ocorrência ANULADA
    // (PRD §7) não é problema vivo e não pode entrar nesta lista, nem no
    // cartão nem na conta da Saúde. Filtrar na origem mantém a fórmula e os
    // pesos de `lib/domain/saude.ts` intocados.
    //
    // ONDA 57 — elas deixaram de ter cartão próprio na Início. Ocorrência
    // aberta e manutenção vencida são a mesma pergunta ("o que precisa de
    // mim?") e viviam em dois blocos separados, cada um com sua ordenação:
    // agora as duas entram no MESMO cartão pela lista de fatores da Saúde,
    // que o PRD §3.4 já manda ordenar por criticidade.
    supabase
      .from("ocorrencias").select("*").eq("embarcacao_id", embarcacao.id)
      .in("estado", [...ESTADOS_QUE_PESAM_NA_SAUDE]).order("created_at", { ascending: false }),
    // ONDA 7 — O CONTADOR DO SINO SAIU DAQUI, e a URL assinada do avatar
    // também. Os dois alimentavam a fileira de saudação do topo (avatar,
    // "Olá, fulano", seletor de barco e sino), que o cabeçalho global do
    // mockup substituiu — o sino e o seletor agora moram na `FaixaTopo`, que o
    // layout de `(app)` monta uma vez para todas as telas. O `Promise.all`
    // cai de nove para sete promessas; a URL assinada era ida de rede DE
    // VERDADE (`createSignedUrl` no storage), então esta é uma volta a menos,
    // não só uma linha a menos.
    podeVerGastos
      ? supabase
          .from("lancamentos_financeiros").select("data, valor_centavos").eq("embarcacao_id", embarcacao.id)
          .eq("tipo", "despesa").eq("status", "pago").gte("data", inicioJanelaGastos)
      : Promise.resolve({ data: [] as { data: string; valor_centavos: number }[] }),
    carregarTripulacao(supabase, embarcacao.id),
  ])

  const saidasDoAno = (eventosSaida ?? []) as EventoParaResumoAno[]
  const totaisAno = resumoAno(saidasDoAno, Number(anoAtual))
  // A saída mais recente sai da MESMA consulta do resumo do ano (nada de ida
  // extra ao banco só pra uma data) — e, ordenada acima, é simplesmente a
  // primeira. Por isso a frase do cartão diz o ano em voz alta quando não há
  // nenhuma: a janela é o ano corrente, e um "nenhuma saída registrada" seco
  // seria falso pra quem navegou em dezembro passado.
  const ultimaSaida = saidasDoAno[0] ?? null

  const ocorrenciasAtivas = (ocorrenciasAtivasBrutas ?? []) as Ocorrencia[]

  // Há quanto tempo cada ocorrência existe — a coluna mono do cartão de
  // atenção (canvas tela-1b: "6 d" no vazamento). Indexado por id pelo mesmo
  // motivo de `restantePorItem` acima.
  const idadePorOcorrencia = new Map(ocorrenciasAtivas.map((o) => [o.id, idadeCompacta(o.created_at, hoje)]))

  // Saúde da Embarcação — desde 15/08/2026 é a régua declarativa do PRD
  // FINAL §5 (Saudável / Atenção / Ação necessária, o pior estado prevalece),
  // não mais uma nota 0-100: o PRD proíbe porcentagem aqui em três lugares e
  // o dono autorizou a troca. Histórico completo em `lib/domain/saude.ts`.
  // Itens sem informação suficiente não entram no cálculo (nem a favor, nem
  // contra) — mesma regra de honestidade de sempre.
  const itensParaSaude: ItemParaSaude[] = avaliados.map((a) => ({
    id: a.item.id, nome: a.item.nome, aba: a.aba, status: a.r.status, temInformacao: a.temInformacao,
  }))
  const ocorrenciasParaSaude: OcorrenciaParaSaude[] = ocorrenciasAtivas.map((o) => ({
    id: o.id, titulo: o.titulo, aba: o.aba, estado: o.estado, gravidade: o.gravidade,
  }))
  const saude = calcularSaudeEmbarcacao(itensParaSaude, ocorrenciasParaSaude)
  const estadoSaude = estadoExibidoDaSaude(saude, temDadoReal)
  const pendencias = saude.fatores.slice(0, 3)

  /**
   * ONDA 7 — A SAÚDE SAI DO CARTÃO E VAI PARA O HERÓI, AO LADO DO NOME.
   * =========================================================================
   * É o item 1 do mockup de 19/08, com a única alteração que ele não podia ter
   * como estava: **a porcentagem não entra** (PRD §1.1, §27.2 e §28; a
   * história das duas notas já arrancadas está no topo de `lib/domain/saude.ts`).
   * O anel é bezel e o número dentro dele é CONTAGEM — quantas coisas pedem
   * ação —, e a leitura por extenso vai junto, palavra por palavra: é o mesmo
   * `contagemDaSaude` que o cartão imprimia, com o mesmo `ocorrenciasAtivas.length`.
   *
   * Ou seja: nada do que a tela dizia deixou de ser dito. O que mudou é onde —
   * e o "onde" é o ponto do mockup: o estado do barco encostado no nome do
   * barco, sobre a foto dele, em vez de num cartão de 86px de altura três
   * blocos abaixo.
   *
   * `saude.fatores.length` e não uma soma nova: é o TAMANHO da lista que
   * "Precisa da sua atenção" enumera logo abaixo — o resumo e o detalhe leem a
   * mesma lista, então não há como um discordar do outro.
   *
   * O destino do toque acompanha o estado, como a ação do cartão fazia:
   * `/barco/saude` quando há o que detalhar, `/barco` quando o convite ainda é
   * "complete o cadastro".
   */
  const saudeNoHeroi = {
    farol: estadoSaude != null ? FAROL_ESTADO_SAUDE[estadoSaude] : null,
    rotulo: rotuloDaSaude(estadoSaude),
    pendencias: estadoSaude != null ? saude.fatores.length : null,
    partes: estadoSaude != null ? contagemDaSaude(saude, ocorrenciasAtivas.length) : null,
    href: estadoSaude != null ? "/barco/saude" : "/barco",
  }

  // ONDA 96 — O CAMINHO DO DIA 1, E ELE NÃO CUSTA UMA IDA AO BANCO.
  //
  // Os três sinais saem de `equipamentos` e `itens`, que o `carregarPainel`
  // da primeira linha já trouxe. Fazer o guia consultar por conta própria
  // devolveria à fila justamente a espera que a onda 100 tirou desta tela
  // (15 idas em sequência viraram 6, 2.945 ms viraram 1.159) — e por um dado
  // que já está em memória.
  //
  // `data_fixa` e não `ultimo_ciclo_data`: o onboarding grava
  // `ultimo_ciclo_data = hoje` sozinho (`lib/acoes/onboarding.ts`), então
  // contar por ele marcaria como FEITO um passo que ninguém deu. É a mesma
  // recusa que `temDadoReal`, vinte linhas acima, já faz pelo mesmo motivo.
  const passosIniciais = primeirosPassos({
    motores: motores.map((m) => ({ id: m.id, horasAtuais: m.horas_atuais })),
    documentosComValidade: itens.filter((i) => i.categoria === "documento" && i.data_fixa != null).length,
    podeEditarMotores: podeEditar(permissoes, "motores"),
    podeEditarDocumentos: podeEditar(permissoes, "documentos"),
  })

  // UM ASSUNTO POR TELA, E A REGRA QUE DECIDE QUAL (docs/DESIGN.md §5).
  //
  // A Saúde é o assunto assim que ela TEM o que dizer — ela é o resumo de que
  // "Precisa da sua atenção" é o detalhe (as duas leem a mesma lista de
  // fatores), e promover o detalhe acima do resumo inverteria a hierarquia
  // progressiva que o §2 do DESIGN copia do Navionics: contagem → item →
  // detalhe. Enquanto ela diz "Sem dados", o assunto da tela é o caminho que
  // faz ela existir. Os dois nunca são assunto ao mesmo tempo porque a mesma
  // condição decide os dois — não é disciplina de quem edita a tela depois,
  // é uma variável só.
  const saudeEhAssunto = estadoSaude != null

  const entradasGastos = (despesasMes ?? [])
    .map((l) => ({ data: l.data, custoCentavos: l.valor_centavos, grupo: "" }))
  const resumoMes = resumoGastos(entradasGastos, hoje)
  const variacaoGastos = variacaoPercentual(resumoMes.meses[5].totalCentavos, resumoMes.meses[4].totalCentavos)

  const { tripulantes, tripulantesVisiveis, tripulantesExtras, urlsTripulacao } = tripulacao
  const sozinhoNoBarco = tripulantes.length <= 1
  const podeConvidar = papel === "PROP"

  return (
    /**
     * ONDA 57 — A INÍCIO DEIXA DE SER UMA PILHA DE RÓTULOS SOLTOS.
     *
     * Antes: onze blocos, cada um precedido de um rótulo `.rotulo` e
     * desenhando a própria casca à mão (mesma borda, mesmo raio, escritos
     * onze vezes). O dono chamou isso de "tudo zoneado parecendo informação
     * solta" — e ele estava descrevendo exatamente isto: nenhuma anatomia
     * comum, então nada parecia da mesma família.
     *
     * Agora: UMA anatomia (`Cartao`, com ícone + título + ação no topo) e
     * uma grade. No celular, uma coluna na ordem em que o dono decide as
     * coisas (foto → estado → pendências → diário → motores → gastos); a
     * partir de `lg`, DUAS COLUNAS DE ALTURAS INDEPENDENTES.
     *
     * A DECISÃO ASSUMIDA É UMA (docs/DESIGN.md §4): a foto do barco. Todo o
     * resto se comporta como instrumento — número em fonte tabular, estado
     * em selo, nada de gradiente, sombra ou dourado disputando atenção.
     *
     * ONDA 63 — POR QUE A GRADE DE 3 COLUNAS VIROU PAINEL + TRILHA.
     *
     * A auditoria de 18/08 mediu aqui, a 1440, "~180px de vazio embaixo do
     * cartão Saúde e um quadrante inferior direito morto do tamanho de um
     * cartão". A causa não era a ordem dos blocos: era a GRADE. Numa grade,
     * a linha tem uma altura só — o cartão Saúde (110px de conteúdo) ao
     * lado do herói (256px) deixa 146px de buraco, e `lg:items-start` (que
     * estava certo: esticar o cartão só transformaria o buraco num vazio
     * DENTRO da borda) não tem como fechar isso. Reordenar não resolvia
     * também: qualquer permutação de blocos de alturas diferentes em linhas
     * de 3 recria o buraco em outro lugar.
     *
     * O que a referência (Haulix) faz e a grade não fazia: um painel grande
     * de conteúdo principal e uma COLUNA de cartões menores ao lado, cada
     * uma correndo na própria altura. Duas colunas de fluxo independente
     * não têm linha, logo não têm buraco de linha — o vazio some por
     * construção, sem inventar conteúdo pra preencher.
     *
     * COMO ISSO CONVIVE COM O CELULAR INTACTO: as duas colunas são
     * `display: contents` abaixo de `lg` (as `<div>` somem da caixa e os
     * cartões voltam a ser filhos diretos desta grade de uma coluna), e
     * cada cartão carrega o `order-*` da posição que ele sempre teve no
     * aparelho. Os valores sobem dentro de cada coluna, então em `lg` —
     * onde as `<div>` viram colunas de verdade — a ordem do `order` é a
     * ordem do DOM e nada se reembaralha. O 390 não muda um pixel; foi
     * medido antes e depois.
     *
     * O reparto é por ALTURA, não por importância: o painel fica com a foto
     * e os três blocos altos (pendências, gastos, tripulação) e a trilha com
     * os seis compactos. Com o barco cheio da varredura as duas colunas
     * fecham em ~1030px cada — a diferença que sobra é menor que um cartão,
     * que é o critério: buraco de rodapé só é visível quando cabe um bloco
     * dentro dele.
     */
    // Acabamento Haulix (16/08): gap de desktop desce de 24 pra 16px —
    // densidade é respeito (DESIGN §6.5), e era o que a referência tem.
    <main className="grid gap-3 lg:grid-cols-3 lg:items-start lg:gap-4">
      {/* ONDA 7 — A FILEIRA DE SAUDAÇÃO VIRA O TÍTULO DA TELA.
          Aqui havia avatar + "Olá, fulano" + seletor de barco + sino, escritos
          à mão nesta página porque *"NO CELULAR o app não tem uma barra
          superior global"*. Ele tem, desde esta onda: o cabeçalho do mockup
          (marca à esquerda, sino à direita) desceu para o celular em `FaixaTopo`
          e vale em toda tela — foi ele que liberou a vaga de "Serviços" na
          barra de baixo. As quatro peças foram para lá, uma a uma:
            · sino → cabeçalho, com o MESMO `ContadorAvisos` do trilho;
            · seletor de barco → cabeçalho, quando há mais de um (era a única
              porta de troca de barco do celular; sem isso, sumiria);
            · avatar da conta → cabeçalho no desktop; no celular a conta mora no
              Menu, que é uma das cinco vagas da barra;
            · "Olá, fulano" → não foi para lugar nenhum. É a única coisa que a
              tela deixou de dizer, e é saudação, não dado.
          No lugar entra o que o mockup põe e o app não tinha: o NOME DA ÁREA,
          com o filete dourado. */}
      <div className="lg:col-span-3">
        <TituloTela>Início</TituloTela>
      </div>

      {erro && (
        <p className="rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2 corpo lg:col-span-3">
          {erro}
        </p>
      )}

      {/* ---- PAINEL: a foto e os três blocos altos ----------------------
          `contents` abaixo de `lg` — a <div> some da caixa e os cartões
          voltam a ser filhos diretos da grade de uma coluna do celular,
          onde o `order-*` de cada um repõe a posição de sempre. */}
      <div className="contents lg:col-span-2 lg:flex lg:flex-col lg:gap-4">
        {/* ONDA 96 — O CAMINHO DO DIA 1 ABRE A TELA, E SÓ ENQUANTO EXISTE.
            `order-1` é a única posição livre da escada que a onda 63 montou
            (2 herói, 3 saúde, 4 atenção…), e é a certa: quem não sabe o que
            fazer precisa ler isto ANTES de qualquer instrumento. Na coluna
            larga do desktop pelo mesmo motivo — é lá que o olho cai, e foi
            exatamente o que a auditoria mediu faltar.
            Ele some por conta própria quando o barco tem os três dados, sem
            botão de dispensar: some por ter sido FEITO, nunca por ter sido
            escondido. */}
        {precisaDoCaminhoInicial(passosIniciais) && (
          <CaminhoInicial
            className="order-1"
            passos={passosIniciais}
            peso={saudeEhAssunto ? "secao" : "assunto"}
          />
        )}

        {/* A foto do dono é o assunto da tela — a única emoção, e a decisão
            assumida do redesenho. As horas de motor continuam fora dela (têm o
            cartão "Motores").
            ONDA 7 — O ESTADO VOLTA PARA CIMA DA FOTO, e não é a volta do que a
            onda 57 tirou. O que saiu daqui em 57 foi um SEGUNDO vocabulário
            ("Tudo em dia") competindo com o do cartão da Saúde; o que entra
            agora é a Saúde INTEIRA, com a palavra do PRD §5 e a mesma leitura
            que o cartão imprimia — e o cartão saiu da tela no mesmo commit.
            Um estado, um vocabulário, um lugar: ao lado do nome do barco, que
            é onde o mockup o pôs. */}
        <CardEmbarcacao
          className="order-2"
          embarcacao={embarcacao}
          saude={saudeNoHeroi}
          urlCapa={urlCapa}
          podeEditarFotos={podeEditar(permissoes, "fotos")}
          temFotos={temFotos}
        />

        {/* Um cartão só pro que pede ação, alimentado pela lista de FATORES da
            Saúde: manutenção vencida e ocorrência aberta juntas, na ordem de
            criticidade que o PRD §3.4 manda. Antes eram dois blocos separados
            — e o dono tinha que comparar sozinho qual dos dois era mais
            urgente. Não aparece quando não há dado real nenhum: nesse caso o
            convite já está no cartão da Saúde, e dois convites idênticos na
            mesma tela é o começo do "informação solta". */}
        {(pendencias.length > 0 || temDadoReal) && (
          <div className="order-4">
            {/* ONDA 7 — O CARTÃO COM LISTA DENTRO VIRA UMA PILHA DE LINHAS.
                =============================================================
                Item 2 do mockup, e ele coincide com o §26 do HAULIX: *"Alerta:
                ícone · título · descrição · status · ações. Compacto — nunca
                alertas enormes"*. O que havia aqui era o oposto da segunda
                metade: um `Cartao` de primeiro nível (borda, lustro, 16px de
                raio, cabeçalho com ícone e ação) embrulhando de uma a três
                linhas — moldura de painel para conteúdo de lista.
                O cabeçalho não sumiu: virou `SecaoPagina`, que é a etiqueta de
                seção da casa e leva a MESMA ação "Ver tudo" na mesma pílula de
                contorno (`lib/ui/acoes.ts`). O que sumiu foi a segunda casca
                em volta de linhas que já têm casca própria.
                `variant="cartao"` e não `"grupo"`: as linhas agora vivem soltas
                sobre o fundo da página, e é para exatamente este caso que a
                variante existe — o docblock de `LinhaLista` já a descrevia como
                *"alertas soltos de /hoje"*, um consumidor que nunca existiu até
                agora. */}
            <SecaoPagina
              denso
              icone="alerta"
              acao={saude.fatores.length > pendencias.length
                ? { href: "/barco/saude", rotulo: "Ver tudo" }
                : undefined}
            >
              Precisa da sua atenção
            </SecaoPagina>
            {pendencias.length > 0 ? (
              <div className="grid gap-2">
                {pendencias.map((f) => (
                  <LinhaLista
                    key={`${f.tipo}:${f.id}`}
                    variant="cartao"
                    href={linkDoFator(f, podeEditar(permissoes, f.aba))}
                    /* O ponto de 8px do `Farol` era a marca certa numa LISTA de
                       itens, onde o estado distingue uma linha da vizinha. Aqui
                       toda linha é um problema, e o que a esquerda precisa dizer
                       é o quanto — ver `MarcaDeAlerta`, no topo do arquivo. */
                    leading={<MarcaDeAlerta status={f.farol} />}
                    titulo={f.nome}
                    subtitulo={f.detalhe}
                    /* A coluna mono do canvas (tela-1b): manutenção mostra a
                       contagem regressiva ("-19 d", "18 h"); ocorrência não tem
                       prazo — mostra a idade ("6 d" aberta há seis dias), o
                       único número honesto de quem não tem vencimento. A cor é
                       a do farol da linha. */
                    valor={f.tipo === "ocorrencia" ? idadePorOcorrencia.get(f.id) : restantePorItem.get(f.id)}
                    valorClassName={f.farol === "vencido" ? "text-crit" : "text-warn"}
                    /* A seta do mockup. Sem ela a linha promete detalhe e não
                       mostra a saída; `LinhaLista` só a desenha por padrão
                       quando há `href`, e aqui ele é `undefined` para quem não
                       pode editar a área do item (`linkDoFator`) — nesse caso a
                       prop também não desenha nada, que é o certo. */
                    chevron={linkDoFator(f, podeEditar(permissoes, f.aba)) != null}
                  />
                ))}
              </div>
            ) : (
              /* Sem pendência a linha não é alerta, então não veste a anatomia
                 de alerta: é uma frase, e o bloco é do tamanho dela. Palavra
                 por palavra a mesma de antes. */
              <p className="corpo rounded-[var(--raio-cartao)] border border-line bg-panel p-3 text-dim">
                Nenhum vencimento na margem. Bom vento e mar calmo.
              </p>
            )}
          </div>
        )}

        {podeVerGastos && (
          <Cartao
            icone="cifrao"
            titulo="Gastos do mês"
            className="order-7"
            acao={resumoMes.totalMesCentavos > 0
              ? <AcaoCartao href="/financeiro">Ver tudo</AcaoCartao>
              : undefined}
          >
            {resumoMes.totalMesCentavos > 0 ? (
              <>
                <Kpi
                  rotulo="Total pago no mês"
                  valor={formatarReais(resumoMes.totalMesCentavos)}
                  apoio={variacaoDoMes(variacaoGastos)}
                />
                {/* Onda 79 (instrumentos) — mini-gráfico do cartão vira
                    `GraficoBarras`; altura fixa de 72px (não responsiva),
                    igual ao componente antigo — é um "spark-bar" ao lado do
                    KPI dentro de um `Cartao` que já tem moldura própria,
                    contexto compacto que a régua responsiva do §5 (140/200)
                    não cobre. */}
                <div className="mt-3">
                  <GraficoBarras
                    pontos={resumoMes.meses.map((m) => ({
                      rotulo: m.rotulo,
                      valor: m.totalCentavos / 100,
                      destaque: m.mes === hoje.slice(0, 7),
                    }))}
                    cor="var(--dado)"
                    metrica="R$"
                    alturaClasse="h-[72px]"
                    rotulo="Despesas dos últimos 6 meses"
                  />
                </div>
              </>
            ) : (
              /* ONDA 103 — `densidade="denso"` nos QUATRO vazios desta tela.
                 Medido a 390px antes de mexer: este cartão fechava em 244px e
                 o de Tripulação em 228px — os dois maiores da Início depois
                 do herói — sem UMA palavra a mais que os cartões de 100px ao
                 lado. A diferença inteira era ar, e o dono chamou isso de
                 "grandes áreas vazias". Aqui o vazio não é a tela: é uma
                 linha dela, disputando espaço com outros nove cartões — que é
                 exatamente a condição do grau denso (ver `estado-vazio.tsx`).
                 Anda junto com o `enfase="discreta"` do parágrafo abaixo, mas
                 é outra decisão: aquela trata o peso da AÇÃO, esta o respiro
                 do BLOCO. */
              <EstadoVazio
                variant="linha"
                enfase="discreta"
                densidade="denso"
                icone="cifrao"
                titulo="Nenhuma despesa paga este mês"
                descricao="Vaga, combustível, manutenção — o que sai do bolso fica registrado aqui."
                acao={{ href: "/financeiro/novo?tipo=despesa", rotulo: "Registrar despesa" }}
              />
            )}
          </Cartao>
        )}

        <Cartao
          icone="pessoas"
          titulo="Tripulação"
          className="order-9"
          acao={!sozinhoNoBarco && podeConvidar
            ? <AcaoCartao href="/tripulacao">Gerenciar</AcaoCartao>
            : undefined}
        >
          {sozinhoNoBarco ? (
            <EstadoVazio
              variant="linha"
              enfase="discreta"
              densidade="denso"
              icone="pessoas"
              titulo="Só você tem acesso a este barco"
              descricao={podeConvidar
                ? "Convide comandantes de confiança pra dividir o controle."
                : "Nenhum outro comandante convidado ainda."}
              acao={podeConvidar ? { href: "/tripulacao", rotulo: "Convidar comandante" } : undefined}
            />
          ) : (
            <>
              <div className="flex items-center -space-x-2">
                {tripulantesVisiveis.map((t) => (
                  <Avatar key={t.id} url={urlsTripulacao.get(t.id) ?? null} nome={t.nome} tamanho="size-9" />
                ))}
                {tripulantesExtras > 0 && (
                  <span className="flex size-9 items-center justify-center rounded-[var(--raio-pilula)] border border-line bg-panel2 font-mono-instr text-xs text-dim">
                    +{tripulantesExtras}
                  </span>
                )}
              </div>
              <p className="apoio mt-2 text-dim">
                <span className="font-mono-instr tabular-nums">{tripulantes.length}</span>{" "}
                {tripulantes.length === 1 ? "pessoa tem" : "pessoas têm"} acesso a este barco
              </p>
            </>
          )}
        </Cartao>

        {(comandantes ?? []).length > 0 && (
          <Cartao
            icone="pessoas"
            titulo="Comandantes disponíveis"
            className="order-11"
            acao={<AcaoCartao href="/comandantes">Ver tudo</AcaoCartao>}
          >
            {(comandantes ?? []).map((c) => (
              <LinhaLista
                key={c.usuario_id}
                href="/comandantes"
                titulo={c.nome_publico}
                subtitulo={[c.categoria, c.disponibilidade].filter(Boolean).join(" · ")}
              />
            ))}
          </Cartao>
        )}
      </div>

      {/* ---- TRILHA: os seis blocos compactos, na própria altura -------
          Mesma mecânica da coluna acima: `contents` no celular, coluna de
          verdade em `lg`. É esta coluna que antes terminava 180px antes do
          herói e deixava o quadrante inferior direito morto. */}
      <div className="contents lg:flex lg:flex-col lg:gap-4">
        {/* ONDA 7 — O CARTÃO "SAÚDE" SAIU DAQUI, E A `order-3` FICOU VAGA.
            =================================================================
            Ele era o resumo do que "Precisa da sua atenção" detalha, e ficava
            TRÊS blocos abaixo da foto, do outro lado da grade — o mockup põe a
            mesma informação encostada no nome do barco, e essa é a metade boa
            da mudança. A outra metade é que manter os dois seria dizer a mesma
            coisa duas vezes na mesma tela, com dois desenhos: o anel e o
            cartão brigariam por ser o assunto, e "dois assuntos numa tela é
            zero assunto" (`docs/DESIGN.md` §5).
            O QUE FOI CONFERIDO ANTES DE APAGAR, peça por peça:
              · o selo com a palavra do PRD §5 → é o rótulo embaixo do anel;
              · a leitura "1 vencido · 2 na margem · 1 ocorrência aberta" → é a
                linha `LeituraDaSaude` do herói, do mesmo `contagemDaSaude`;
              · a ação "Ver tudo" → o anel inteiro é o link para `/barco/saude`;
              · a ação "Completar" e a frase *"Cadastre horas de motor ou
                vencimentos com data…"* → só apareciam sem dado nenhum, que é
                EXATAMENTE a condição em que o `CaminhoInicial` abre a tela como
                assunto, com os três passos nomeados e o motivo de cada um. O
                convite não sumiu: parou de ser dito duas vezes.
            `saudeEhAssunto` continua vivo, e continua decidindo a mesma coisa:
            enquanto a Saúde não tem o que dizer, o assunto da tela é o caminho
            que a faz existir. */}

        {/* O Diário é o coração do app (PRD §6) e era um ícone num grid de
            cinco atalhos. Vira cartão com a ÚNICA ação dourada da tela. Foi
            este cartão que tirou o FAB "+ Registrar" da Início na onda 57
            (dois botões de registrar na mesma tela, um deles por cima do
            conteúdo, é a definição de ação principal duplicada) — e na onda
            60 o FAB aposentou do app inteiro (ver `lib/ui/superficies.ts`):
            este botão é o caminho de registrar a partir daqui. */}
        {podeVerDiario && (
          <Cartao
            icone="relatorio"
            titulo="Diário de Bordo"
            className="order-5"
            acao={<AcaoCartao href="/diario">Ver tudo</AcaoCartao>}
          >
            <p className="corpo">{textoUltimaSaida(ultimaSaida, anoAtual)}</p>
            {totaisAno && (
              <>
                <p className="rotulo mt-3 text-dim">Seu ano no mar</p>
                <div className="mt-2 grid grid-cols-3 gap-3">
                  <Kpi rotulo="Saídas" valor={String(totaisAno.saidas)} />
                  {/* Distância só existe com trilha GPS de verdade
                      (`resumoAno`). Sem nenhuma, o honesto é um traço: "0 MN"
                      diria que o barco saiu e não andou. */}
                  <Kpi
                    rotulo="Distância"
                    valor={totaisAno.milhasNm > 0 ? `${Math.round(totaisAno.milhasNm).toLocaleString("pt-BR")} MN` : "—"}
                  />
                  <Kpi rotulo="No mar" valor={`${Math.round(totaisAno.horasNoMar).toLocaleString("pt-BR")} h`} />
                </div>
              </>
            )}
            {podeEditar(permissoes, "diario") && (
              <Link
                /* ONDA 62 — o botão diz "Registrar saída", então ele abre o
                   formulário de SAÍDA (canvas tela-3b), não o seletor de 6
                   tipos: `?tipo=navegacao` faz /diario/novo cair direto na
                   tela do canvas. */
                href="/diario/novo?tipo=navegacao"
                /* ONDA 102 — A AÇÃO PRINCIPAL DA TELA PASSA A VESTIR A FORMA
                   DECLARADA DELA, em vez de uma escrita à mão aqui.
                   Ela era `min-h-11` + `--raio-controle` + `bg-accent`: os
                   mesmos três ingredientes de `PILULA_ACAO_PRINCIPAL`
                   (`lib/ui/acoes.ts`), com dois valores diferentes — 44px de
                   caixa em vez de 36 de desenho, e canto de 8px em vez de
                   pílula. Ou seja, o gesto "ação principal, cheia, dourada"
                   tinha dois vestidos: um aqui e outro nas ~49 telas que o
                   recebem pelo `EstadoVazio`. Dois vestidos para o mesmo gesto
                   é a definição de deriva do `docs/DESIGN.md` §6.6 — e o 44
                   cravado era, além disso, o último `min-h-11` escrito à mão
                   desta tela (a régua mora em `--altura-controle` desde a onda
                   91). O alvo continua sendo 44px: ele vem do <Link>; a pílula
                   de 36 é o desenho por dentro, a separação que o próprio
                   `lib/ui/acoes.ts` documenta. */
                className="mt-3 inline-flex min-h-[var(--altura-controle)] items-center self-start"
              >
                <span className={PILULA_ACAO_PRINCIPAL}>Registrar saída</span>
              </Link>
            )}
          </Cartao>
        )}

        <Cartao
          icone="motor"
          titulo="Motores"
          className="order-6"
          /* Vazio, quem convida é o próprio `EstadoVazio` — dois links pro
             mesmo assunto no mesmo cartão é ruído, não conveniência. */
          acao={motores.length > 0 ? <AcaoCartao href="/barco">Ver tudo</AcaoCartao> : undefined}
        >
          {/* `enfase="discreta"` nos QUATRO estados vazios desta tela (aqui,
              Gastos, Mar agora e Tripulação). Num barco recém-cadastrado eles
              aparecem TODOS ao mesmo tempo, e cada um dourado somava quatro
              "aqui se age" em cima dos que a tela já gasta legitimamente — o
              orçamento é dois (docs/DESIGN.md §5). Nenhum deles é a ação
              principal da Início: essa é "Registrar saída", no Diário. O
              padrão do componente segue dourado pras ~49 telas em que o estado
              vazio É o corpo inteiro e a ação dele É a ação da tela. */}
          {motores.length === 0 ? (
            <EstadoVazio
              variant="linha"
              enfase="discreta"
              densidade="denso"
              icone="motor"
              titulo="Nenhum motor cadastrado"
              descricao="Cadastre pra ganhar horímetro e alerta de revisão automáticos."
              acao={podeEditar(permissoes, "motores")
                ? { href: "/barco/equipamento/novo?tipo=motor", rotulo: "Cadastrar motor" }
                : undefined}
            />
          ) : (
            <>
              <div className={`grid gap-3 ${motores.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                {motores.map((m) => (
                  <Kpi
                    key={m.id}
                    rotulo={nomeDoEquipamento(m)}
                    valor={horasDoMotor(m)}
                    apoio={apoioDaRevisao(revisaoPorMotor.get(m.id) ?? null)}
                    /* O apoio acende junto com o prazo (canvas tela-1b: o
                       "Revisão em 18 h" do motor BE é âmbar; o horímetro em
                       cima fica claro — a leitura é fato, o estado é do
                       prazo). `seloDoFarol` é a mesma tradução de sempre. */
                    apoioEstado={seloDoFarol(revisaoPorMotor.get(m.id)?.status ?? null)}
                  />
                ))}
              </div>
              {/* Honestidade (PRD §11): o horímetro é sempre informado à mão,
                  então dizer QUANDO foi a última leitura é parte do número. */}
              {ultimaLeitura && <p className="apoio mt-3 text-dim">Última leitura: {ultimaLeitura}</p>}
            </>
          )}
        </Cartao>

        <Cartao icone="mapa" titulo="Mar agora" className="order-8">
          {embarcacao.marina_lat == null || embarcacao.marina_lon == null ? (
            <EstadoVazio
              variant="linha"
              enfase="discreta"
              densidade="denso"
              icone="mapa"
              titulo="Ligue o boletim do mar"
              descricao="Defina a posição da marina para ver onda, vento e água aqui."
              acao={{ href: "/barco/local", rotulo: "Definir posição" }}
            />
          ) : (
            // Esqueleto MEDIDO, não chutado. Era uma barra de `h-[46px]` — fora
            // da escala (docs/DESIGN.md §5) e 31px mais curta que o conteúdo:
            // o boletim renderizado mede 77px, tanto em 390 quanto em 1440
            // (a fileira de números quebra em duas linhas nas duas larguras,
            // porque o cartão "Mar agora" é estreito também na grade de três
            // colunas), e embaixo dela vem a linha da maré estimada. Esqueleto
            // curto demais troca a espera por um salto de layout.
            // Duas barras, todas em degraus da escala: 48 + 12 + 16 = 76px.
            <Suspense
              fallback={
                <div className="animate-pulse">
                  <div className="h-12 rounded-[var(--raio-controle)] bg-panel2" />
                  <div className="mt-3 h-4 w-2/3 rounded-[var(--raio-controle)] bg-panel2" />
                </div>
              }
            >
              <BoletimDoMar lat={embarcacao.marina_lat} lon={embarcacao.marina_lon} />
            </Suspense>
          )}
          {/* Iniciar navegação mora aqui e não num botão dourado próprio: é a
              ação do MAR, e o dourado da tela já tem dono. */}
          <LinhaLista
            className="mt-3"
            href="/navegar"
            leading={<Icone nome="mapa" className="size-4 shrink-0 text-dim" />}
            titulo="Iniciar navegação"
            subtitulo="Grave a trilha desta saída no mapa"
          />
        </Cartao>

        {/* 5 colunas desde a onda 43 (Agenda entrou aqui): em 375px sobram
            ~62px por coluna e o maior rótulo ("Contatos", 11px) mede ~47px —
            cabe. Este é o caminho de descoberta da Agenda a partir da Início
            (gate do CONTRIBUTING.md: no máximo 3 toques); o segundo caminho é
            o Menu.
            O Diário trocou de ícone (calendário -> relatório) porque o
            calendário passou a ser da Agenda: dois atalhos vizinhos com o
            mesmo desenho é o mesmo problema que o glossário resolve nos nomes.
            O Diário é o registro do que aconteceu; a Agenda é o que está
            marcado.
            ONDA 57 — os cinco ícones eram dourados. Cinco atalhos de navegação
            não são cinco ações principais: viraram cinza, e o dourado ficou
            com quem manda na tela. */}
        <Cartao icone="raio" titulo="Acesso rápido" className="order-10">
          <div className="grid grid-cols-5 gap-2 text-center">
            {(
              [
                { href: "/barco", rotulo: "Barco", icone: "embarcacao" },
                // Onda 46: a Agenda ganhou área própria na matriz (PRD §8). Este
                // atalho lê `AREA_AGENDA` em vez de escrever a área na mão — assim
                // o que a Início esconde é exatamente o que a RLS recusa.
                { href: "/agenda", rotulo: "Agenda", aba: AREA_AGENDA, icone: "calendario" },
                { href: "/barco/documentos", rotulo: "Docs", aba: "documentos", icone: "documento" },
                { href: "/diario", rotulo: "Diário", icone: "relatorio" },
                { href: "/barco/contatos", rotulo: "Contatos", aba: "contatos", icone: "pessoas" },
              ] as { href: string; rotulo: string; aba?: Aba; icone: NomeIcone }[]
            )
              .filter((a) => !a.aba || podeVer(permissoes, a.aba))
              .map((a) => (
                /* ONDA 102 — três acabamentos numa peça que se toca cinco
                   vezes por tela:
                   · `--altura-controle` no lugar do `min-h-11` cravado — a
                     régua de toque tem token desde a onda 91, e este era um
                     dos dois lugares desta tela que ainda escreviam o número;
                   · `.apoio` (12px/500) no lugar de `text-[11px] font-medium`:
                     11 é o PISO da escala, reservado a etiqueta de
                     instrumento, e estes cinco são rótulos de navegação que se
                     LEEM. Foi exatamente disto que o dono reclamou — "fontes
                     pequenas". Medido a 390px: a coluna tem 54px úteis e o
                     maior rótulo ("Contatos") mede ~51px em 12px, então cabe
                     sem truncar;
                   · hover sobe UM nível (§49) e o toque confirma (`TOQUE`) —
                     a pastilha era inerte no ponteiro e no dedo. A transição
                     vem de `.transicao-ui` e não de `transition-colors`
                     porque `TOQUE` já pede `transition-transform`, e
                     `transition-property` é uma só (o porquê medido está em
                     `app/globals.css`, na definição da classe). */
                <Link key={a.href} href={a.href}
                  className={`transicao-ui flex min-h-[var(--altura-controle)] flex-col items-center justify-center gap-1 rounded-[var(--raio-controle)] bg-panel2 px-1 py-2 hover:bg-panel3 ${TOQUE}`}>
                  <Icone nome={a.icone} className="size-5 text-dim" />
                  <span className="apoio">{a.rotulo}</span>
                </Link>
              ))}
          </div>
        </Cartao>

        {/* Próximas paradas (onda 19) — só aparece com uma viagem planejada de
            verdade (data futura), nunca um cartão vazio convidando pra uma
            feature sem dado nenhum atrás. */}
        {proximaViagem && (
          <Cartao icone="estrela" titulo="Próxima viagem" className="order-12">
            <LinhaLista
              href={`/navegar/viagem/${proximaViagem.id}`}
              titulo={proximaViagem.nome}
              subtitulo={
                proximaViagem.paradas.slice(0, 3).map((p) => p.nome).join(" · ") +
                (proximaViagem.paradas.length > 3 ? ` · +${proximaViagem.paradas.length - 3}` : "")
              }
              valor={formatarDataCurta(proximaViagem.data_prevista)}
            />
          </Cartao>
        )}
      </div>
    </main>
  )
}
