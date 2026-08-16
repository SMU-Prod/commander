import Link from "next/link"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { Avatar } from "@/components/avatar"
import { CardEmbarcacao } from "@/components/card-embarcacao"
import { Farol } from "@/components/farol"
import { GraficoMesesGastos } from "@/components/grafico-meses-gastos"
import { Icone, type NomeIcone } from "@/components/icone"
import { SeletorEmbarcacao } from "@/components/seletor-embarcacao"
import { SinoNotificacoes } from "@/components/sino-notificacoes"
import { Cartao } from "@/components/ui/cartao"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { Kpi } from "@/components/ui/kpi"
import { LinhaLista } from "@/components/ui/linha-lista"
import { Selo } from "@/components/ui/selo"
import {
  calcularSemaforo,
  formatarDataCurta,
  PESO,
  temInformacaoSuficiente,
  textoRestanteCompacto,
} from "@/lib/domain/semaforo"
import { calcularSaudeEmbarcacao, type ItemParaSaude, type OcorrenciaParaSaude } from "@/lib/domain/saude"
import { AREA_AGENDA } from "@/lib/domain/agenda"
import { formatarCarimbo } from "@/lib/domain/datas"
import { formatarReais, resumoGastos, variacaoPercentual } from "@/lib/domain/gastos"
import { carregarNotificacoes, carregarPainel, carregarProximaViagem, hojeISO, itemMonitoradoToItemCalc } from "@/lib/consultas"
import { contadorSino } from "@/lib/domain/notificacoes"
import { abaDoItem, nomeDoEquipamento } from "@/lib/domain/diario"
import {
  apoioDaRevisao,
  contagemDaSaude,
  estadoExibidoDaSaude,
  horasDoMotor,
  linkDoFator,
  rotuloDaSaude,
  seloDaSaude,
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
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono-instr text-sm tabular-nums">
        <span><span className="mr-1.5 text-[11px] uppercase tracking-[.12em] text-dim">Onda</span>{boletim.ondaM != null ? `${boletim.ondaM.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} m` : "—"}</span>
        <span>
          <span className="mr-1.5 text-[11px] uppercase tracking-[.12em] text-dim">Vento</span>
          {boletim.ventoKt != null
            ? `${Math.round(boletim.ventoKt)} kt${boletim.ventoGraus != null ? ` ${pontoCardeal(boletim.ventoGraus)}` : ""}`
            : "—"}
        </span>
        <span><span className="mr-1.5 text-[11px] uppercase tracking-[.12em] text-dim">Água</span>{boletim.aguaC != null ? `${Math.round(boletim.aguaC)} °C` : "—"}</span>
        {/* Onda 57 — era uma pílula escrita à mão aqui (border + cor por
            nível, mais uma das doze cópias que a varredura de 15/08 achou).
            Agora é o mesmo `Selo` do estado do barco: uma anatomia só de
            "estado tem cor E palavra". */}
        <span className="ml-auto"><Selo estado={seloDoMar(boletim.selo.nivel)}>{boletim.selo.rotulo}</Selo></span>
      </div>
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

/** Link secundário do cabeçalho de um cartão. Discreto por regra (docs/
 *  DESIGN.md §6, regra 2: uma ação principal por tela, a segunda é um link
 *  discreto) e com os 44px de alvo que o app exige de qualquer coisa que se
 *  toca — o `apoio` sozinho dá 17px de altura clicável. */
const ACAO_CARTAO = "apoio inline-flex min-h-11 items-center text-dim"

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

  // Quanto falta pra cada item — o cartão "Precisa da sua atenção" mostra
  // isso à direita da linha. Indexado por id porque a lista que ele percorre
  // é a de FATORES da saúde (que já mistura manutenção e ocorrência,
  // ordenada por criticidade), não a de itens.
  const restantePorItem = new Map(avaliados.map((a) => [a.item.id, textoRestanteCompacto(a.r)]))

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
  const { data: { user } } = await supabase.auth.getUser()
  const { data: perfil } = await supabase
    .from("profiles").select("nome, avatar_path").eq("id", user?.id ?? "").maybeSingle()
  const nomeUsuario = perfil?.nome?.trim() || "comandante"
  const urlAvatar = perfil?.avatar_path
    ? (await supabase.storage.from("acervo").createSignedUrl(perfil.avatar_path, 3600)).data?.signedUrl ?? null
    : null
  const urlCapa = embarcacao.foto_capa_path
    ? (await supabase.storage.from("acervo").createSignedUrl(embarcacao.foto_capa_path, 3600)).data?.signedUrl ?? null
    : null
  const { data: comandantes } = await supabase
    .from("perfis_comandante").select("usuario_id, nome_publico, categoria, disponibilidade")
    .eq("tipo", "comandante").eq("visivel", true).limit(2)

  // Seu ano no mar (onda 18, Pilar Strava do Mar) — totais pessoais a partir
  // das saídas já registradas no diário, sem coleta nova nenhuma.
  const podeVerDiario = podeVer(permissoes, "diario")
  // A ORDEM É DA CONSULTA, NÃO DO ACASO. Até a onda 57 a saída mais recente
  // saía de um `reduce` com `>` estrito sobre uma consulta SEM `order`: com
  // duas saídas na mesma data, qual delas ditava a frase do cartão dependia
  // da ordem que o Postgres devolveu naquela requisição — a mesma tela,
  // recarregada, podia trocar de frase. Desempate por hora de saída, com
  // `nullsFirst: false` pra que a saída COM horário ganhe da que não tem
  // (ela é a única das duas que consegue dizer o tempo no mar).
  const { data: eventosSaida } = podeVerDiario
    ? await supabase
        .from("eventos").select("tipo, data, hora_saida, hora_retorno, trilha")
        .eq("embarcacao_id", embarcacao.id).eq("tipo", "navegacao")
        .gte("data", `${anoAtual}-01-01`)
        .order("data", { ascending: false })
        .order("hora_saida", { ascending: false, nullsFirst: false })
    : { data: [] as EventoParaResumoAno[] }
  const saidasDoAno = (eventosSaida ?? []) as EventoParaResumoAno[]
  const totaisAno = resumoAno(saidasDoAno, Number(anoAtual))
  // A saída mais recente sai da MESMA consulta do resumo do ano (nada de ida
  // extra ao banco só pra uma data) — e, ordenada acima, é simplesmente a
  // primeira. Por isso a frase do cartão diz o ano em voz alta quando não há
  // nenhuma: a janela é o ano corrente, e um "nenhuma saída registrada" seco
  // seria falso pra quem navegou em dezembro passado.
  const ultimaSaida = saidasDoAno[0] ?? null

  // Próximas paradas (onda 19, Pilar Strava do Mar) — a PRÓXIMA viagem
  // planejada (data futura mais perto), com 2-3 paradas visíveis. Mesma
  // checagem de `podeVerDiario` (viagem é conteúdo de navegação, igual
  // "Seu ano no mar" acima) — sem ela, nem consulta o banco. Sem viagem
  // planejada, o cartão simplesmente não aparece mais abaixo (regra de
  // honestidade — nada de porta pra sala vazia).
  const proximaViagem = podeVerDiario ? await carregarProximaViagem() : null

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
  const { data: ocorrenciasAtivasBrutas } = await supabase
    .from("ocorrencias").select("*").eq("embarcacao_id", embarcacao.id)
    .in("estado", [...ESTADOS_QUE_PESAM_NA_SAUDE]).order("created_at", { ascending: false })
  const ocorrenciasAtivas = (ocorrenciasAtivasBrutas ?? []) as Ocorrencia[]

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

  // Contador do sino (onda 44) — mesma fonte da tela /notificacoes, via
  // `cache()`: o badge e a lista nunca podem discordar.
  const contadorAvisos = contadorSino(await carregarNotificacoes())

  // Despesas do mês (onda 16; fonte trocada na onda 42) — mesma janela de 6
  // meses e a mesma `lib/domain/gastos.ts` de sempre, mas lendo de
  // `lancamentos_financeiros` em vez de `eventos.custo_centavos`. É a mesma
  // decisão da migration 042: o Financeiro é a fonte do dinheiro, e somar as
  // duas contaria o mesmo gasto duas vezes. Só `status = 'pago'` entra — uma
  // conta a vencer não é dinheiro que saiu.
  const podeVerGastos = podeVer(permissoes, "gastos")
  const inicioJanelaGastos = `${Number(anoAtual) - 1}-01-01`
  const { data: despesasMes } = podeVerGastos
    ? await supabase
        .from("lancamentos_financeiros").select("data, valor_centavos").eq("embarcacao_id", embarcacao.id)
        .eq("tipo", "despesa").eq("status", "pago").gte("data", inicioJanelaGastos)
    : { data: [] as { data: string; valor_centavos: number }[] }
  const entradasGastos = (despesasMes ?? [])
    .map((l) => ({ data: l.data, custoCentavos: l.valor_centavos, grupo: "" }))
  const resumoMes = resumoGastos(entradasGastos, hoje)
  const variacaoGastos = variacaoPercentual(resumoMes.meses[5].totalCentavos, resumoMes.meses[4].totalCentavos)

  // Tripulação (onda 16) — vínculos reais do barco: dono (PROP) + comandantes
  // com acesso (CMDT). Nunca uma fileira fantasma: sozinho no barco vira convite.
  const { data: vinculosCrew } = await supabase
    .from("vinculos").select("usuario_id").eq("embarcacao_id", embarcacao.id)
  const idsCrew = [...new Set((vinculosCrew ?? []).map((v) => v.usuario_id))]
  const { data: perfisCrew } = idsCrew.length > 0
    ? await supabase.from("profiles").select("id, nome, avatar_path").in("id", idsCrew)
    : { data: [] as { id: string; nome: string; avatar_path: string | null }[] }
  const tripulantes = idsCrew.map((id) => {
    const p = (perfisCrew ?? []).find((pc) => pc.id === id)
    return { id, nome: p?.nome?.trim() || "Comandante", avatarPath: p?.avatar_path ?? null }
  })
  const tripulantesVisiveis = tripulantes.slice(0, 5)
  const tripulantesExtras = Math.max(0, tripulantes.length - tripulantesVisiveis.length)
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
     * partir de `lg`, a mesma ordem numa grade de três colunas onde os
     * blocos largos (foto, pendências, gastos) ocupam duas.
     *
     * `lg:items-start` porque cartão não deve esticar até a altura da linha:
     * um cartão de três linhas esticado ao lado da foto vira uma caixa com
     * um palmo de vazio embaixo do conteúdo.
     *
     * A DECISÃO ASSUMIDA É UMA (docs/DESIGN.md §4): a foto do barco. Todo o
     * resto se comporta como instrumento — número em fonte tabular, estado
     * em selo, nada de gradiente, sombra ou dourado disputando atenção.
     */
    <main className="grid gap-3 lg:grid-cols-3 lg:items-start lg:gap-6">
      {/* Sino no topo com contador (PRD §5.2). Fica aqui, no cabeçalho da
          Início, porque NO CELULAR o app não tem uma barra superior global —
          e o topo da tela de casa é onde o dono chega. O contador aparece
          também no rodapé, na aba Avisos, que essa sim segue em toda tela.

          A partir de `lg` a barra superior global EXISTE: a `FaixaTopo`
          (onda 60) já carrega sino e nome do barco (o seletor, quando há
          mais de um). Então sino e seletor daqui somem em `lg:hidden` — sem
          isso eram dois sinos e dois nomes empilhados na mesma tela. A
          saudação com a foto de verdade fica em toda largura: é o que a
          faixa NÃO tem (lá o avatar é só iniciais do e-mail). */}
      <div className="flex items-center gap-3 lg:col-span-3">
        <Avatar url={urlAvatar} nome={nomeUsuario} />
        <div className="min-w-0 flex-1">
          <p className="apoio text-dim">Olá, {nomeUsuario.split(" ")[0]}</p>
          <span className="lg:hidden">
            <SeletorEmbarcacao
              atual={{ id: embarcacao.id, nome: embarcacao.nome }}
              opcoes={painel.embarcacoes}
            />
          </span>
        </div>
        <SinoNotificacoes contador={contadorAvisos} className="lg:hidden" />
      </div>

      {erro && (
        <p className="rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2 corpo lg:col-span-3">
          {erro}
        </p>
      )}

      {/* A foto do dono é o assunto da tela — a única emoção, e a decisão
          assumida do redesenho. Sem selo de status e sem grade de métricas
          por cima dela desde a onda 57: o estado tem cartão próprio logo ao
          lado (com o vocabulário do PRD §5, não um terceiro), e as horas de
          motor têm o cartão "Motores". Hero é foto e nome. */}
      <CardEmbarcacao
        className="lg:col-span-2"
        embarcacao={embarcacao}
        urlCapa={urlCapa}
        podeEditarFotos={podeEditar(permissoes, "fotos")}
      />

      <Cartao
        icone="escudo"
        titulo="Saúde"
        selo={<Selo estado={seloDaSaude(estadoSaude)}>{rotuloDaSaude(estadoSaude)}</Selo>}
        acao={
          estadoSaude != null
            ? <Link href="/barco/saude" className={ACAO_CARTAO}>Ver detalhes</Link>
            : <Link href="/barco" className={ACAO_CARTAO}>Completar</Link>
        }
      >
        {estadoSaude != null ? (
          /* A fonte de instrumento é do NÚMERO, não da frase (revisão da onda
             57). Este parágrafo inteiro era `font-mono-instr tabular-nums`:
             no caminho normal, oito palavras em monoespaçada ao lado dos
             números; no caminho vazio — barco com uma ocorrência ativa e
             nenhum item com horas ou data, que é alcançável —, a frase de
             reserva inteira. Mesmo defeito que a onda 56 tirou do hero.
             Agora `contagemDaSaude` devolve as partes e só o numeral leva a
             mono, como o cartão da Tripulação logo abaixo já fazia. */
          <p className="apoio text-dim">
            {contagemDaSaude(saude)?.map((parte, i) => (
              <span key={parte.rotulo}>
                {i > 0 && " · "}
                <span className="font-mono-instr tabular-nums">{parte.numero}</span> {parte.rotulo}
              </span>
            )) ?? "Nenhum item monitorado com data ou leitura."}
          </p>
        ) : (
          <p className="apoio text-dim">
            Cadastre horas de motor ou vencimentos com data pra saber como está a embarcação.
          </p>
        )}
      </Cartao>

      {/* Um cartão só pro que pede ação, alimentado pela lista de FATORES da
          Saúde: manutenção vencida e ocorrência aberta juntas, na ordem de
          criticidade que o PRD §3.4 manda. Antes eram dois blocos separados
          — e o dono tinha que comparar sozinho qual dos dois era mais
          urgente. Não aparece quando não há dado real nenhum: nesse caso o
          convite já está no cartão da Saúde, e dois convites idênticos na
          mesma tela é o começo do "informação solta". */}
      {(pendencias.length > 0 || temDadoReal) && (
        <Cartao
          icone="alerta"
          titulo="Precisa da sua atenção"
          className="lg:col-span-2"
          acao={saude.fatores.length > pendencias.length
            ? <Link href="/barco/saude" className={ACAO_CARTAO}>Ver tudo</Link>
            : undefined}
        >
          {pendencias.length > 0 ? (
            pendencias.map((f) => (
              <LinhaLista
                key={`${f.tipo}:${f.id}`}
                href={linkDoFator(f, podeEditar(permissoes, f.aba))}
                leading={<Farol status={f.farol} />}
                titulo={f.nome}
                subtitulo={f.detalhe}
                valor={restantePorItem.get(f.id)}
                valorClassName={f.farol === "vencido" ? "text-crit" : "text-warn"}
              />
            ))
          ) : (
            <p className="corpo text-dim">Nenhum vencimento na margem. Bom vento e mar calmo.</p>
          )}
        </Cartao>
      )}

      {/* O Diário é o coração do app (PRD §6) e era um ícone num grid de
          cinco atalhos. Vira cartão com a ÚNICA ação dourada da tela — e é
          por isso que o "+ Registrar" flutuante não aparece mais aqui (ver
          `lib/ui/superficies.ts`): dois botões de registrar na mesma tela,
          um deles por cima do conteúdo, é a definição de ação principal
          duplicada. */}
      {podeVerDiario && (
        <Cartao
          icone="relatorio"
          titulo="Diário de Bordo"
          acao={<Link href="/diario" className={ACAO_CARTAO}>Ver tudo</Link>}
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
              href="/diario/novo"
              className="mt-3 flex min-h-11 items-center justify-center rounded-[var(--raio-controle)] bg-accent text-sm font-semibold text-acao-texto"
            >
              Registrar saída
            </Link>
          )}
        </Cartao>
      )}

      <Cartao
        icone="motor"
        titulo="Motores"
        /* Vazio, quem convida é o próprio `EstadoVazio` — dois links pro
           mesmo assunto no mesmo cartão é ruído, não conveniência. */
        acao={motores.length > 0 ? <Link href="/barco" className={ACAO_CARTAO}>Ver ficha</Link> : undefined}
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
                />
              ))}
            </div>
            {/* Honestidade (PRD §11): o horímetro é sempre informado à mão,
                então dizer QUANDO foi a última leitura é parte do número. */}
            {ultimaLeitura && <p className="apoio mt-3 text-dim">Última leitura: {ultimaLeitura}</p>}
          </>
        )}
      </Cartao>

      {podeVerGastos && (
        <Cartao
          icone="cifrao"
          titulo="Gastos do mês"
          className="lg:col-span-2"
          acao={resumoMes.totalMesCentavos > 0
            ? <Link href="/financeiro" className={ACAO_CARTAO}>Ver financeiro</Link>
            : undefined}
        >
          {resumoMes.totalMesCentavos > 0 ? (
            <>
              <Kpi
                rotulo="Total pago no mês"
                valor={formatarReais(resumoMes.totalMesCentavos)}
                apoio={variacaoDoMes(variacaoGastos)}
              />
              <div className="mt-3">
                <GraficoMesesGastos meses={resumoMes.meses} mesAtual={hoje.slice(0, 7)} altura={72} comMoldura={false} />
              </div>
            </>
          ) : (
            <EstadoVazio
              variant="linha"
              enfase="discreta"
              icone="cifrao"
              titulo="Nenhuma despesa paga este mês"
              descricao="Vaga, combustível, manutenção — o que sai do bolso fica registrado aqui."
              acao={{ href: "/financeiro/novo?tipo=despesa", rotulo: "Registrar despesa" }}
            />
          )}
        </Cartao>
      )}

      <Cartao icone="mapa" titulo="Mar agora">
        {embarcacao.marina_lat == null || embarcacao.marina_lon == null ? (
          <EstadoVazio
            variant="linha"
            enfase="discreta"
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

      <Cartao
        icone="pessoas"
        titulo="Tripulação"
        acao={!sozinhoNoBarco && podeConvidar
          ? <Link href="/tripulacao" className={ACAO_CARTAO}>Gerenciar</Link>
          : undefined}
      >
        {sozinhoNoBarco ? (
          <EstadoVazio
            variant="linha"
            enfase="discreta"
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
                <span className="flex size-9 items-center justify-center rounded-full border border-line bg-panel2 font-mono-instr text-xs text-dim">
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
      <Cartao icone="raio" titulo="Acesso rápido">
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
              <Link key={a.href} href={a.href}
                className="flex min-h-11 flex-col items-center justify-center gap-1 rounded-[var(--raio-controle)] bg-panel2 px-1 py-2">
                <Icone nome={a.icone} className="size-5 text-dim" />
                <span className="text-[11px] font-medium">{a.rotulo}</span>
              </Link>
            ))}
        </div>
      </Cartao>

      {(comandantes ?? []).length > 0 && (
        <Cartao
          icone="pessoas"
          titulo="Comandantes disponíveis"
          acao={<Link href="/comandantes" className={ACAO_CARTAO}>Ver todos</Link>}
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

      {/* Próximas paradas (onda 19) — só aparece com uma viagem planejada de
          verdade (data futura), nunca um cartão vazio convidando pra uma
          feature sem dado nenhum atrás. */}
      {proximaViagem && (
        <Cartao icone="estrela" titulo="Próxima viagem">
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
    </main>
  )
}
