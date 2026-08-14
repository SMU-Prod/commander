import { cache } from "react"
import { supabaseServer } from "@/lib/supabase/server"
import { normalizarPermissoes, type Permissoes } from "@/lib/domain/permissoes"
import { nivelPlano, type NivelPlano } from "@/lib/domain/plano-acesso"
import { avaliarVerified, type ResultadoVerified } from "@/lib/domain/verified"
import { lerEmbarcacaoAtiva } from "@/lib/embarcacao-ativa"
import type { Embarcacao, Equipamento, ItemMonitorado, Viagem } from "@/lib/db/types"
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

/** Commander Verified: busca o que `carregarPainel` não traz (fotos, eventos
 *  do diário, contatos — documentos com validade já vêm no `painel.itens`) e
 *  entrega pronto ao domínio puro — `avaliarVerified` nunca consulta o
 *  banco. Usado pelo card em `/barco` e pela tela `/barco/selos/verified`;
 *  o `cache()` evita repetir a consulta na mesma renderização. */
export const carregarVerified = cache(async (): Promise<ResultadoVerified | null> => {
  const painel = await carregarPainel()
  if (!painel) return null
  const supabase = await supabaseServer()
  const { embarcacao } = painel

  const [{ count: totalFotos }, { count: totalEventosDiario }, { count: totalContatos }] = await Promise.all([
    supabase.from("fotos").select("id", { count: "exact", head: true })
      .eq("embarcacao_id", embarcacao.id),
    // Pedidos de Commander Gold vivem em `gold_solicitacoes` desde a onda 35
    // (nao mais um evento marcador no diario) — entao a contagem de eventos
    // do Verified nunca precisou de exclusao: o pedido do Gold nao toca
    // `eventos`. Correcao 14 do PRD de Correcoes (Gold nao depende de
    // Verified) continua valendo por construcao, nao por filtro aqui.
    supabase.from("eventos").select("id", { count: "exact", head: true })
      .eq("embarcacao_id", embarcacao.id),
    supabase.from("contatos").select("id", { count: "exact", head: true })
      .eq("embarcacao_id", embarcacao.id),
  ])

  return avaliarVerified({
    embarcacao,
    equipamentos: painel.equipamentos,
    itens: painel.itens,
    hoje: hojeISO(),
    totalFotos: totalFotos ?? 0,
    totalEventosDiario: totalEventosDiario ?? 0,
    totalContatos: totalContatos ?? 0,
  })
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

export { itemMonitoradoToItemCalc } from "@/lib/domain/conversores"
export { hojeISO } from "@/lib/domain/datas"
