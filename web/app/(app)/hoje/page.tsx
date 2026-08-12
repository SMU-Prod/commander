import Link from "next/link"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { AnelStatus } from "@/components/anel-status"
import { Avatar } from "@/components/avatar"
import { CardEmbarcacao, type MetricaHero } from "@/components/card-embarcacao"
import { GraficoMesesGastos } from "@/components/grafico-meses-gastos"
import { Icone, type NomeIcone } from "@/components/icone"
import { SeletorEmbarcacao } from "@/components/seletor-embarcacao"
import {
  calcularSemaforo,
  PESO,
  resumoStatusGeral,
  temInformacaoSuficiente,
  textoRestante,
  textoRestanteCompacto,
  textoRestanteHero,
  type StatusFarol,
} from "@/lib/domain/semaforo"
import { formatarCarimbo } from "@/lib/domain/datas"
import { formatarReais, resumoGastos, variacaoPercentual } from "@/lib/domain/gastos"
import { carregarPainel, hojeISO, itemMonitoradoToItemCalc } from "@/lib/consultas"
import { abaDoItem, nomeDoEquipamento } from "@/lib/domain/diario"
import { podeVer, podeEditar, type Aba } from "@/lib/domain/permissoes"
import { resumoAno, type EventoParaResumoAno } from "@/lib/domain/resumo-ano"
import type { Equipamento } from "@/lib/db/types"
import { boletimDoMar } from "@/lib/mar"
import { supabaseServer } from "@/lib/supabase/server"

async function BoletimDoMar({ lat, lon }: { lat: number; lon: number }) {
  const boletim = await boletimDoMar(lat, lon)
  if (!boletim) {
    return (
      <div className="rounded-[14px] border border-line bg-panel p-4 corpo text-dim sombra-1">
        Boletim indisponível agora. Tente mais tarde.
      </div>
    )
  }
  return (
    <div className="rounded-[14px] border border-line bg-panel p-4 sombra-1">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono-instr text-sm tabular-nums">
        <span><span className="mr-1.5 text-[11px] uppercase tracking-[.12em] text-dim">Onda</span>{boletim.ondaM != null ? `${boletim.ondaM.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} m` : "—"}</span>
        <span><span className="mr-1.5 text-[11px] uppercase tracking-[.12em] text-dim">Vento</span>{boletim.ventoKt != null ? `${Math.round(boletim.ventoKt)} kt` : "—"}</span>
        <span><span className="mr-1.5 text-[11px] uppercase tracking-[.12em] text-dim">Água</span>{boletim.aguaC != null ? `${Math.round(boletim.aguaC)} °C` : "—"}</span>
        <span className={`ml-auto rounded px-2 py-0.5 font-mono-instr text-[11px] uppercase tracking-[.1em] ${
          boletim.selo.nivel === "ok" ? "border border-ok/40 text-ok"
          : boletim.selo.nivel === "atencao" ? "border border-warn/40 text-warn"
          : "border border-crit/40 text-crit"
        }`}>{boletim.selo.rotulo}</span>
      </div>
    </div>
  )
}

const ROTULO_DOC: Record<StatusFarol, string> = { ok: "Em dia", atencao: "Atenção", vencido: "Vencido" }

const iconeEquipamento = (tipo: string): NomeIcone =>
  tipo === "motor" ? "motor" : tipo === "bateria" ? "bateria" : "raio"

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

  const avaliados = itens
    .map((i) => {
      const eq = equipamentos.find((e) => e.id === i.equipamento_id) ?? null
      const calc = itemMonitoradoToItemCalc(i)
      const r = calcularSemaforo(calc, eq?.horas_atuais ?? null, hoje)
      const temInformacao = temInformacaoSuficiente(calc, eq?.horas_atuais ?? null)
      const onde = eq ? `${i.nome} — ${nomeDoEquipamento(eq)}` : i.nome
      return { item: i, eq, r, onde, temInformacao }
    })
    .sort((a, b) => PESO[b.r.status] - PESO[a.r.status])

  const alertas = avaliados.filter((a) => a.r.status !== "ok")
  const motores = equipamentos.filter((e) => e.tipo === "motor")

  // Anel de status geral: matemática real derivada do MESMO farol de sempre.
  // Itens sem informação suficiente não entram no cálculo (nem a favor, nem
  // contra) — ver `temInformacaoSuficiente`/`resumoStatusGeral` em
  // lib/domain/semaforo.ts (regra de honestidade da onda 16).
  const resumoAnel = resumoStatusGeral(avaliados.map((a) => ({ status: a.r.status, temInformacao: a.temInformacao })))

  // Manutenção próxima: só itens ligados a um equipamento (motor/elétrica) —
  // já vem ordenado do pior pro melhor porque filtra o array que o sort acima produziu.
  const manutencaoProxima = avaliados
    .filter((a): a is typeof a & { eq: Equipamento } => a.eq != null)
    .slice(0, 4)

  const itensMotorComInfo = avaliados.filter((a) => a.eq?.tipo === "motor" && a.temInformacao)
  const motorPrioritario = itensMotorComInfo[0] ?? null

  const metricaHorasMotor: MetricaHero = (() => {
    if (motores.length === 0) return { rotulo: "Horas de motor", valor: "—" }
    const ref = motorPrioritario?.eq ?? motores[0]
    const valor = ref.horas_atuais != null
      ? `${ref.horas_atuais.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}h`
      : "sem leitura"
    const rotulo = motores.length > 1 && ref.posicao ? `Motor ${ref.posicao}` : "Horas de motor"
    return { rotulo, valor }
  })()

  const metricaProximaRevisao: MetricaHero = motorPrioritario
    ? { rotulo: "Próxima revisão", valor: textoRestanteHero(motorPrioritario.r), status: motorPrioritario.r.status }
    : { rotulo: "Próxima revisão", valor: "—" }

  const itensDocComInfo = avaliados.filter((a) => a.item.categoria === "documento" && a.temInformacao)
  const statusDocPior = itensDocComInfo.map((a) => a.r.status).sort((x, y) => PESO[y] - PESO[x])[0]
  const metricaDocumentos: MetricaHero = statusDocPior
    ? { rotulo: "Documentos", valor: ROTULO_DOC[statusDocPior], status: statusDocPior }
    : { rotulo: "Documentos", valor: "Sem dados" }

  const leiturasEquipamentos = equipamentos.map((e) => e.ultima_leitura).filter((d): d is string => d != null).sort()
  const ultimaAtualizacao = leiturasEquipamentos.length > 0
    ? formatarCarimbo(leiturasEquipamentos[leiturasEquipamentos.length - 1])
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
  const temDadoReal =
    equipamentos.some((e) => e.ultima_leitura != null) ||
    itens.some((i) => i.data_fixa != null || i.ultimo_ciclo_horas != null)

  const statusGeral = avaliados[0]?.r.status ?? "ok"
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
    .eq("visivel", true).limit(2)

  // Seu ano no mar (onda 18, Pilar Strava do Mar) — totais pessoais a partir
  // das saídas já registradas no diário, sem coleta nova nenhuma.
  const podeVerDiario = podeVer(permissoes, "diario")
  const anoAtual = hoje.slice(0, 4)
  const { data: eventosSaida } = podeVerDiario
    ? await supabase
        .from("eventos").select("tipo, data, hora_saida, hora_retorno, trilha")
        .eq("embarcacao_id", embarcacao.id).eq("tipo", "navegacao")
        .gte("data", `${anoAtual}-01-01`)
    : { data: [] as EventoParaResumoAno[] }
  const totaisAno = resumoAno((eventosSaida ?? []) as EventoParaResumoAno[], Number(anoAtual))

  // Gastos do mês (onda 16) — mesma janela de 6 meses e mesma lógica de
  // /barco/gastos (lib/domain/gastos.ts), só que resumida pro cartão de /hoje.
  const podeVerGastos = podeVer(permissoes, "gastos")
  const inicioJanelaGastos = `${Number(hoje.slice(0, 4)) - 1}-01-01`
  const { data: eventosGastos } = podeVerGastos
    ? await supabase
        .from("eventos").select("data, custo_centavos").eq("embarcacao_id", embarcacao.id)
        .not("custo_centavos", "is", null).gte("data", inicioJanelaGastos)
    : { data: [] as { data: string; custo_centavos: number | null }[] }
  const entradasGastos = (eventosGastos ?? [])
    .filter((e) => (e.custo_centavos ?? 0) > 0)
    .map((e) => ({ data: e.data, custoCentavos: e.custo_centavos as number, grupo: "" }))
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
  const conteudoTripulacao = sozinhoNoBarco ? (
    <>
      <p className="titulo-card">Só você tem acesso a este barco</p>
      <p className="apoio mt-0.5 text-dim">
        {podeConvidar ? "Convide comandantes de confiança pra dividir o controle." : "Nenhum outro comandante convidado ainda."}
      </p>
    </>
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
        {tripulantes.length} {tripulantes.length === 1 ? "pessoa tem" : "pessoas têm"} acesso a este barco
      </p>
    </>
  )

  return (
    <main>
      <div className="mb-4 flex items-center gap-3">
        <Avatar url={urlAvatar} nome={nomeUsuario} />
        <div className="min-w-0">
          <p className="apoio text-dim">Olá, {nomeUsuario.split(" ")[0]}</p>
          <SeletorEmbarcacao
            atual={{ id: embarcacao.id, nome: embarcacao.nome }}
            opcoes={painel.embarcacoes}
          />
        </div>
      </div>
      <CardEmbarcacao
        embarcacao={embarcacao}
        statusGeral={statusGeral}
        urlCapa={urlCapa}
        podeEditarFotos={podeEditar(permissoes, "fotos")}
        ultimaAtualizacao={ultimaAtualizacao}
        metricas={[metricaHorasMotor, metricaProximaRevisao, metricaDocumentos]}
      />

      {erro && (
        <p className="mt-4 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 corpo">{erro}</p>
      )}

      <p className="rotulo text-dim mt-6 mb-2 inline-flex items-center gap-1.5">
        <Icone nome="escudo" className="size-3.5" /> Status geral
      </p>
      <AnelStatus resumo={resumoAnel} />

      <p className="rotulo text-dim mt-6 mb-2 inline-flex items-center gap-1.5">
        <Icone nome="alerta" className="size-3.5" />
        {alertas.length > 0 ? "Precisa de atenção" : temDadoReal ? "Tudo em dia" : "Falta informação"}
      </p>
      {alertas.length === 0 && (
        temDadoReal ? (
          <div className="sombra-1 rounded-[14px] border border-line bg-panel p-4 corpo text-dim">
            Nenhum vencimento na margem. Bom vento e mar calmo.
          </div>
        ) : (
          <div className="sombra-1 rounded-[14px] border border-line bg-panel p-4 text-center">
            <Icone nome="relogio" className="mx-auto size-7 text-dim" />
            <p className="corpo mt-2 font-medium">Ainda sem informação suficiente</p>
            <p className="apoio mt-1 text-dim">
              Nenhum motor tem leitura de horas real nem vencimento com data informada — não dá pra
              dizer se está tudo em dia. Complete em Embarcação para o farol valer de verdade.
            </p>
            <Link href="/barco" className="apoio mt-3 inline-block text-accent-forte">Completar em Embarcação</Link>
          </div>
        )
      )}
      <div className="space-y-2">
        {alertas.map(({ item, eq, r }) => {
          const editavelItem = podeEditar(permissoes, abaDoItem(item, equipamentos))
          const conteudo = (
            <>
              <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
                r.status === "vencido" ? "bg-crit/12 text-crit" : "bg-warn/12 text-warn"
              }`}>
                <Icone nome={item.equipamento_id ? "motor" : "documento"} className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="titulo-card truncate">{item.nome}</p>
                {/* Subtítulo só quando acrescenta algo: o equipamento do item.
                    Documento sem equipamento repetia o próprio nome embaixo
                    ("Seguro da embarcação / Seguro da embarcação" — QA do
                    emulador, onda 16). */}
                {eq && <p className="apoio mt-0.5 truncate text-dim">{nomeDoEquipamento(eq)}</p>}
              </div>
              <span className={`shrink-0 text-right font-mono-instr text-sm font-semibold tabular-nums ${
                r.status === "vencido" ? "text-crit" : "text-warn"
              }`}>
                {textoRestante(r)}
              </span>
              {editavelItem && <Icone nome="chevron" className="size-4 shrink-0 text-dim" />}
            </>
          )
          return editavelItem ? (
            <Link key={item.id} href={`/barco/itens/${item.id}/editar`}
              className="sombra-1 flex items-center gap-3 rounded-[14px] border border-line bg-panel p-3.5">
              {conteudo}
            </Link>
          ) : (
            <div key={item.id} className="sombra-1 flex items-center gap-3 rounded-[14px] border border-line bg-panel p-3.5">
              {conteudo}
            </div>
          )
        })}
      </div>

      {manutencaoProxima.length > 0 && (
        <>
          <p className="rotulo text-dim mt-6 mb-2 inline-flex items-center gap-1.5">
            <Icone nome="ferramenta" className="size-3.5" /> Manutenção próxima
          </p>
          <div className="space-y-2">
            {manutencaoProxima.map(({ item, eq, r, onde }) => {
              const editavelItem = podeEditar(permissoes, abaDoItem(item, equipamentos))
              const conteudo = (
                <>
                  <Icone nome={iconeEquipamento(eq.tipo)} className="size-4 shrink-0 text-dim" />
                  <p className="titulo-card min-w-0 flex-1 truncate">{onde}</p>
                  <span className={`shrink-0 font-mono-instr text-sm font-semibold tabular-nums ${
                    r.status === "vencido" ? "text-crit" : r.status === "atencao" ? "text-warn" : ""
                  }`}>
                    {textoRestanteCompacto(r)}
                  </span>
                </>
              )
              return editavelItem ? (
                <Link key={item.id} href={`/barco/itens/${item.id}/editar`}
                  className="sombra-1 flex items-center gap-3 rounded-[14px] border border-line bg-panel p-3.5">
                  {conteudo}
                </Link>
              ) : (
                <div key={item.id} className="sombra-1 flex items-center gap-3 rounded-[14px] border border-line bg-panel p-3.5">
                  {conteudo}
                </div>
              )
            })}
          </div>
        </>
      )}

      {podeVerGastos && (
        <>
          <p className="rotulo text-dim mt-6 mb-2 inline-flex items-center gap-1.5">
            <Icone nome="cifrao" className="size-3.5" /> Gastos do mês
          </p>
          {resumoMes.totalMesCentavos > 0 ? (
            <Link href="/barco/gastos" className="sombra-1 block rounded-[14px] border border-line bg-panel p-4">
              <div className="flex items-baseline justify-between gap-2">
                <p className="min-w-0 truncate font-mono-instr text-2xl font-semibold tabular-nums">{formatarReais(resumoMes.totalMesCentavos)}</p>
                {variacaoGastos != null && (
                  <span className={`inline-flex shrink-0 items-center gap-0.5 font-mono-instr text-xs font-semibold tabular-nums ${
                    variacaoGastos > 0 ? "text-crit" : variacaoGastos < 0 ? "text-ok" : "text-dim"
                  }`}>
                    <Icone nome="chevron" className={`size-3 ${variacaoGastos >= 0 ? "-rotate-90" : "rotate-90"}`} />
                    {Math.abs(variacaoGastos)}%
                  </span>
                )}
              </div>
              {variacaoGastos != null && <p className="apoio mt-0.5 text-dim">vs. mês anterior</p>}
              <div className="mt-3">
                <GraficoMesesGastos meses={resumoMes.meses} mesAtual={hoje.slice(0, 7)} altura={72} comMoldura={false} />
              </div>
            </Link>
          ) : (
            <Link href="/diario/novo" className="sombra-1 block rounded-[14px] border border-line bg-panel p-4">
              <p className="titulo-card">Nenhum gasto este mês</p>
              <p className="apoio mt-0.5 text-dim">Registre custos nos eventos do diário e eles aparecem aqui.</p>
            </Link>
          )}
        </>
      )}

      <p className="rotulo text-dim mt-6 mb-2 inline-flex items-center gap-1.5">
        <Icone nome="pessoas" className="size-3.5" /> Tripulação
      </p>
      {podeConvidar ? (
        <Link href="/menu/tripulacao" className="sombra-1 block rounded-[14px] border border-line bg-panel p-4">
          {conteudoTripulacao}
        </Link>
      ) : (
        <div className="sombra-1 rounded-[14px] border border-line bg-panel p-4">
          {conteudoTripulacao}
        </div>
      )}

      <p className="rotulo text-dim mt-6 mb-2 inline-flex items-center gap-1.5">
        <Icone nome="mapa" className="size-3.5" /> Mar agora
      </p>
      {embarcacao.marina_lat == null || embarcacao.marina_lon == null ? (
        <Link href="/barco/local" className="sombra-1 block rounded-[14px] border border-line bg-panel p-4">
          <p className="titulo-card">Ligue o boletim do mar</p>
          <p className="apoio mt-0.5 text-dim">Defina a posição da marina para ver onda, vento e água aqui.</p>
        </Link>
      ) : (
        <Suspense fallback={<div className="h-[74px] animate-pulse rounded-[14px] bg-panel2" />}>
          <BoletimDoMar lat={embarcacao.marina_lat} lon={embarcacao.marina_lon} />
        </Suspense>
      )}

      <Link href="/navegar" className="sombra-1 mt-3 block rounded-[14px] border border-accent/40 bg-panel p-3.5 text-center text-sm font-semibold text-accent-forte">
        <span className="inline-flex items-center justify-center gap-2">
          <Icone nome="mapa" className="size-4" /> Iniciar navegação — gravar trilha
        </span>
      </Link>

      <p className="rotulo text-dim mt-6 mb-2 inline-flex items-center gap-1.5">
        <Icone nome="raio" className="size-3.5" /> Acesso rápido
      </p>
      <div className="grid grid-cols-4 gap-2 text-center">
        {(
          [
            { href: "/barco", rotulo: "Barco", icone: "embarcacao" },
            { href: "/barco/documentos", rotulo: "Docs", aba: "documentos", icone: "documento" },
            { href: "/diario", rotulo: "Diário", icone: "calendario" },
            { href: "/barco/contatos", rotulo: "Contatos", aba: "contatos", icone: "pessoas" },
          ] as { href: string; rotulo: string; aba?: Aba; icone: NomeIcone }[]
        )
          .filter((a) => !a.aba || podeVer(permissoes, a.aba))
          .map((a) => (
            <Link key={a.href} href={a.href}
              className="sombra-1 flex flex-col items-center gap-1.5 rounded-[14px] border border-line bg-panel px-1 py-3">
              <Icone nome={a.icone} className="size-5 text-accent-forte" />
              <span className="text-[11px] font-medium">{a.rotulo}</span>
            </Link>
          ))}
      </div>

      {(comandantes ?? []).length > 0 && (
        <>
          <p className="rotulo text-dim mt-6 mb-2 inline-flex items-center gap-1.5">
            <Icone nome="pessoas" className="size-3.5" /> Comandantes disponíveis
          </p>
          <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
            {(comandantes ?? []).map((c) => (
              <div key={c.usuario_id} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="titulo-card">{c.nome_publico}</p>
                  <p className="apoio mt-0.5 text-dim">{[c.categoria, c.disponibilidade].filter(Boolean).join(" · ")}</p>
                </div>
                <Link href="/marketplace" className="text-xs text-accent-forte">Ver</Link>
              </div>
            ))}
          </div>
        </>
      )}

      {totaisAno && (
        <>
          <p className="rotulo text-dim mt-6 mb-2 inline-flex items-center gap-1.5">
            <Icone nome="medalha" className="size-3.5" /> Seu ano no mar
          </p>
          <Link href="/diario" className="sombra-1 block rounded-[14px] border border-line bg-panel p-4 text-center">
            <p className="font-mono-instr text-base font-semibold tabular-nums">
              {totaisAno.saidas} {totaisAno.saidas === 1 ? "saída" : "saídas"} · {Math.round(totaisAno.milhasNm).toLocaleString("pt-BR")} MN · {Math.round(totaisAno.horasNoMar).toLocaleString("pt-BR")} h
            </p>
          </Link>
        </>
      )}
    </main>
  )
}
