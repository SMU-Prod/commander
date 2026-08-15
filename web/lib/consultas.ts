import { cache } from "react"
import { supabaseServer } from "@/lib/supabase/server"
import { itemMonitoradoToItemCalc as itemMonitoradoToItemCalcInterno } from "@/lib/domain/conversores"
import { abaDoItem, nomeDoEquipamento } from "@/lib/domain/diario"
import {
  filtrarPorPermissao, nivelDaOcorrencia, nivelDoStatusItem, ordenarNotificacoes,
  type Notificacao,
} from "@/lib/domain/notificacoes"
import {
  ESTADOS_QUE_PESAM_NA_SAUDE, ROTULO_ESTADO, ROTULO_GRAVIDADE,
  type EstadoOcorrencia, type Gravidade,
} from "@/lib/domain/ocorrencias"
import { calcularSemaforo, textoRestante } from "@/lib/domain/semaforo"
import { normalizarPermissoes, podeEditar, type Aba, type Permissoes } from "@/lib/domain/permissoes"
import { nivelPlano, type NivelPlano } from "@/lib/domain/plano-acesso"
import {
  avaliarSeloVerified, avaliarVerified,
  type ResultadoVerified, type SeloVerifiedAvaliado,
} from "@/lib/domain/verified"
import { lerEmbarcacaoAtiva } from "@/lib/embarcacao-ativa"
import type { Embarcacao, Equipamento, ItemMonitorado, VerifiedEstado, Viagem } from "@/lib/db/types"
import { hojeISO } from "@/lib/domain/datas"

export const carregarPainel = cache(async (): Promise<{
  embarcacao: Embarcacao
  equipamentos: Equipamento[]
  itens: ItemMonitorado[]
  papel: "PROP" | "CMDT"
  permissoes: Permissoes | null
  embarcacoes: { id: string; nome: string }[]
} | null> => {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  // O barco exibido segue o vínculo do usuário: prioriza o que está marcado
  // como ativo no cookie; sem cookie (ou apontando pra barco sem vínculo),
  // prioriza onde ele é PROP; como CMDT de vários barcos, vale o vínculo
  // mais antigo.
  const { data: meusVinculos, error: erroVinculos } = await supabase
    .from("vinculos")
    .select("embarcacao_id, papel, permissoes")
    .eq("usuario_id", user?.id ?? "")
    .order("created_at")
  if (erroVinculos) throw new Error("Não foi possível carregar seu acesso. Recarregue a página.")
  const ativa = await lerEmbarcacaoAtiva()
  const vinculo =
    (ativa ? (meusVinculos ?? []).find((v) => v.embarcacao_id === ativa) : undefined) ??
    (meusVinculos ?? []).find((v) => v.papel === "PROP") ??
    (meusVinculos ?? [])[0]
  if (!vinculo) return null

  const { data: embarcacao, error } = await supabase
    .from("embarcacoes")
    .select("*")
    .eq("id", vinculo.embarcacao_id)
    .maybeSingle()
  if (error) throw new Error("Não foi possível carregar os dados da embarcação. Recarregue a página.")
  if (!embarcacao) return null

  const [{ data: equipamentos, error: equipamentosError }, { data: itens, error: itensError }] = await Promise.all([
    supabase.from("equipamentos").select("*").eq("embarcacao_id", embarcacao.id).order("posicao"),
    supabase.from("itens_monitorados").select("*").eq("embarcacao_id", embarcacao.id).order("created_at"),
  ])
  if (equipamentosError || itensError) throw new Error("Não foi possível carregar os dados da embarcação. Recarregue a página.")

  const { data: todas } = await supabase.from("embarcacoes").select("id, nome").order("nome")

  const papel = vinculo.papel as "PROP" | "CMDT"
  const permissoes = papel === "PROP" ? null : normalizarPermissoes(vinculo.permissoes)

  return { embarcacao, equipamentos: equipamentos ?? [], itens: itens ?? [], papel, permissoes, embarcacoes: todas ?? [] }
})

/** Próxima viagem planejada (onda 19, Pilar Strava do Mar) — data futura mais
 *  perto pra embarcação ativa, pro cartão "Próximas paradas" em `/hoje`.
 *  `null` sem nenhuma viagem com `data_prevista` a partir de hoje: quem usa
 *  isto não mostra cartão nenhum (regra de honestidade — nada de porta pra
 *  sala vazia). `cache()` evita repetir a consulta na mesma renderização,
 *  mesmo padrão de `carregarPainel`/`carregarVerified`. */
export const carregarProximaViagem = cache(async (): Promise<Viagem | null> => {
  const painel = await carregarPainel()
  if (!painel) return null
  const supabase = await supabaseServer()
  const { data } = await supabase
    .from("viagens")
    .select("*")
    .eq("embarcacao_id", painel.embarcacao.id)
    .gte("data_prevista", hojeISO())
    .order("data_prevista", { ascending: true })
    .limit(1)
    .maybeSingle()
  return (data as Viagem | null) ?? null
})

/**
 * Commander Verified: busca o que `carregarPainel` não traz (a contagem de
 * eventos do diário — motores, manutenções, segurança e documentos já vêm em
 * `painel.equipamentos`/`painel.itens`) e entrega pronto ao domínio puro:
 * `avaliarVerified` nunca consulta o banco. Usado pelo card em `/barco`, pelo
 * hub `/barco/selos` e pela tela `/barco/selos/verified`; o `cache()` evita
 * repetir a consulta na mesma renderização.
 *
 * ONDA 44 — o prazo de regularização (PRD §15) precisa de memória: sem saber
 * DESDE QUANDO um pilar está caído, não existe "15 dias". As duas datas
 * moram em `verified_estado` (migration 045) e são atualizadas aqui, no
 * único lugar que já calcula o selo.
 *
 * Por que a gravação acontece durante a leitura, e não num cron: o relógio
 * só precisa estar correto quando alguém OLHA o selo — a situação
 * (regularização/suspenso) é derivada de `pendencia_desde` na hora, então
 * nenhuma tela mostra dado velho por falta de um job. O efeito colateral é
 * que a contagem começa na primeira visita depois da queda do pilar, não no
 * instante exato dela; na prática o dono abre o app bem antes dos 15 dias, e
 * o erro é sempre a favor dele.
 *
 * `podeEditar(..., "embarcacao")` guarda a escrita porque é o que a RLS de
 * `verified_estado` exige. Tripulação com acesso só de leitura vê o selo
 * calculado sobre o que já está gravado — nunca toma erro de permissão por
 * causa de um efeito colateral que não pediu.
 */
export const carregarVerified = cache(async (): Promise<
  (ResultadoVerified & { selo: SeloVerifiedAvaliado }) | null
> => {
  const painel = await carregarPainel()
  if (!painel) return null
  const supabase = await supabaseServer()
  const { embarcacao } = painel

  const [{ count: totalEventosDiario }, { data: estadoBruto }] = await Promise.all([
    // Pedidos de Commander Gold vivem em `gold_solicitacoes` desde a onda 35
    // (nao mais um evento marcador no diario) — entao a contagem de eventos
    // do Verified nunca precisou de exclusao: o pedido do Gold nao toca
    // `eventos`. Correcao 14 do PRD de Correcoes (Gold nao depende de
    // Verified) continua valendo por construcao, nao por filtro aqui.
    supabase.from("eventos").select("id", { count: "exact", head: true })
      .eq("embarcacao_id", embarcacao.id),
    supabase.from("verified_estado").select("conquistado_em, pendencia_desde")
      .eq("embarcacao_id", embarcacao.id).maybeSingle(),
  ])

  const resultado = avaliarVerified({
    equipamentos: painel.equipamentos,
    itens: painel.itens,
    hoje: hojeISO(),
    totalEventosDiario: totalEventosDiario ?? 0,
  })

  const estado = estadoBruto as Pick<VerifiedEstado, "conquistado_em" | "pendencia_desde"> | null
  const selo = avaliarSeloVerified(
    resultado,
    { conquistadoEm: estado?.conquistado_em ?? null, pendenciaDesde: estado?.pendencia_desde ?? null },
    new Date().toISOString(),
  )

  if (selo.estadoParaGravar && podeEditar(painel.permissoes, "embarcacao")) {
    await supabase.from("verified_estado").upsert(
      {
        embarcacao_id: embarcacao.id,
        conquistado_em: selo.estadoParaGravar.conquistadoEm,
        pendencia_desde: selo.estadoParaGravar.pendenciaDesde,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "embarcacao_id" },
    )
  }

  return { ...resultado, selo }
})

/**
 * Free ou Premium (onda 38, `web/lib/domain/plano-acesso.ts`) — a decisão é
 * sobre a ASSINATURA DO PROPRIETÁRIO, e `assinaturas`/`premium_concessoes`
 * (migrations 017/033) só deixam cada dono ler a PRÓPRIA linha via RLS.
 *
 * Em vez de abrir uma trinca nova nessas tabelas só pra um CMDT/tripulação
 * conseguir contar o limite do barco, esta função aplica a MESMA isenção que
 * já existe pro gate de cobrança (`web/app/(app)/layout.tsx`: "só o PROP
 * paga; CMDT/tripulação nunca vê paywall") — quem não é PROP nunca é
 * bloqueado por causa do plano. Isso não amplia poder nenhum: um CMDT já tem
 * `editar:true` em Diário/Fotos nos presets de permissão
 * (`lib/domain/permissoes.ts`) independente do plano; a única coisa que essa
 * função decide aqui é se o LIMITE do Free se aplica a ele — e a resposta,
 * por design, é não.
 */
export const carregarNivelPlano = cache(async (): Promise<NivelPlano> => {
  const painel = await carregarPainel()
  if (!painel) return "free"
  if (painel.papel !== "PROP") return "premium"

  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return "free"

  const [{ data: assinatura }, { data: concessoes }] = await Promise.all([
    supabase.from("assinaturas").select("status")
      .eq("usuario_id", user.id).in("status", ["ativa", "inadimplente"]).limit(1).maybeSingle(),
    supabase.from("premium_concessoes").select("valido_ate").eq("usuario_id", user.id),
  ])
  const concessaoValidoAte = (concessoes ?? []).reduce<string | null>(
    (maisRecente, c: { valido_ate: string }) => (maisRecente === null || c.valido_ate > maisRecente ? c.valido_ate : maisRecente),
    null,
  )
  return nivelPlano({ assinaturaAtiva: Boolean(assinatura), concessaoValidoAte }, hojeISO())
})

/** Total de registros já criados no Diário de Bordo desta embarcação — o
 *  contador que `recursoLiberado("diario_registros", ...)` compara contra
 *  `LIMITES_FREE.diarioRegistros`. */
export const carregarUsoDiario = cache(async (): Promise<number> => {
  const painel = await carregarPainel()
  if (!painel) return 0
  const supabase = await supabaseServer()
  const { count } = await supabase.from("eventos")
    .select("id", { count: "exact", head: true }).eq("embarcacao_id", painel.embarcacao.id)
  return count ?? 0
})

/** Total de fotos já enviadas ao acervo desta embarcação — o contador que
 *  `recursoLiberado("fotos", ...)` compara contra `LIMITES_FREE.fotos`.
 *  Independente da cota de ESPAÇO em MB (`lib/domain/cota.ts`, que vale
 *  igual pra todo mundo): este é o teto de QUANTIDADE só do Free. */
export const carregarUsoFotos = cache(async (): Promise<number> => {
  const painel = await carregarPainel()
  if (!painel) return 0
  const supabase = await supabaseServer()
  const { count } = await supabase.from("fotos")
    .select("id", { count: "exact", head: true }).eq("embarcacao_id", painel.embarcacao.id)
  return count ?? 0
})

/**
 * CENTRAL DE NOTIFICAÇÕES (onda 44, PRD §5.2) — monta a lista viva de avisos
 * desta pessoa, neste barco.
 *
 * Uma função só, com `cache()`, porque tanto a tela `/notificacoes` quanto o
 * contador do sino precisam do MESMO número: um badge dizendo "3" que abre
 * numa lista de 5 é pior que não ter badge. Como layout e página renderizam
 * na mesma request, o `cache()` faz a consulta acontecer uma vez.
 *
 * Duas travas de permissão, de propósito (PRD §5.2: "Notificações sempre
 * respeitam permissões do usuário"):
 *   1. a RLS já corta o que a pessoa não pode ver no banco (ocorrências);
 *   2. `filtrarPorPermissao` corta de novo aqui, porque os itens monitorados
 *      chegam pelo `carregarPainel` e a aba de cada um é decidida no front
 *      (`abaDoItem`) — sem esta segunda passada, um tripulante sem acesso a
 *      Documentos veria "Seguro vencido" na lista de avisos.
 *
 * Hoje só a categoria "embarcacao" tem fonte. Agenda, Marketplace e
 * Financeiro entram aqui quando existirem — sem mudar nada do resto.
 */
export const carregarNotificacoes = cache(async (): Promise<Notificacao[]> => {
  const painel = await carregarPainel()
  if (!painel) return []
  const { embarcacao, equipamentos, itens, permissoes } = painel
  const hoje = hojeISO()
  const supabase = await supabaseServer()

  const { data: ocorrenciasBrutas } = await supabase
    .from("ocorrencias").select("id, titulo, aba, estado, gravidade, created_at")
    .eq("embarcacao_id", embarcacao.id)
    .in("estado", [...ESTADOS_QUE_PESAM_NA_SAUDE])
    .order("created_at", { ascending: false })

  const deItens: Notificacao[] = itens
    .map((i) => {
      const eq = equipamentos.find((e) => e.id === i.equipamento_id) ?? null
      const r = calcularSemaforo(itemMonitoradoToItemCalcInterno(i), eq?.horas_atuais ?? null, hoje)
      const aba = abaDoItem(i, equipamentos)
      return { i, eq, r, aba }
    })
    .filter(({ r }) => r.status !== "ok")
    .map(({ i, eq, r, aba }) => ({
      id: `item:${i.id}`,
      titulo: eq ? `${i.nome} — ${nomeDoEquipamento(eq)}` : i.nome,
      detalhe: textoRestante(r),
      categoria: "embarcacao" as const,
      nivel: nivelDoStatusItem(r.status),
      aba,
      href: `/barco/itens/${i.id}/editar`,
      quando: null,
      // Agrupa por hub + severidade: "3 documentos vencidos" numa linha em
      // vez de três linhas quase iguais (PRD §5.2, evitar spam).
      grupo: `item:${aba}:${r.status}`,
    }))

  const deOcorrencias: Notificacao[] = ((ocorrenciasBrutas ?? []) as OcorrenciaParaNotificacao[]).map((o) => ({
    id: `ocorrencia:${o.id}`,
    titulo: o.titulo,
    detalhe: `${ROTULO_ESTADO[o.estado]}${o.gravidade ? ` · gravidade ${ROTULO_GRAVIDADE[o.gravidade]}` : ""}`,
    categoria: "embarcacao" as const,
    nivel: nivelDaOcorrencia(o.estado, o.gravidade),
    aba: o.aba,
    href: `/barco/ocorrencias/${o.id}`,
    quando: o.created_at,
    grupo: `ocorrencia:${o.aba}`,
  }))

  return ordenarNotificacoes(filtrarPorPermissao([...deItens, ...deOcorrencias], permissoes))
})

interface OcorrenciaParaNotificacao {
  id: string
  titulo: string
  aba: Aba
  estado: EstadoOcorrencia
  gravidade: Gravidade | null
  created_at: string
}

export { itemMonitoradoToItemCalc } from "@/lib/domain/conversores"
export { hojeISO } from "@/lib/domain/datas"
