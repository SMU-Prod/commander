"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { carregarPainel } from "@/lib/consultas"
import { supabaseServer } from "@/lib/supabase/server"

/**
 * COTISTAS — cota, link e suspensão (onda 69b, PRD §13).
 *
 * Toda action aqui é do DONO da unidade. As policies da migration 061 já
 * exigem `eh_prop`, então o banco recusa sozinho; o `redirect` abaixo existe
 * pra pessoa ler uma frase em vez de ver uma tela que não faz nada.
 */

function erro(msg: string): never {
  redirect(`/cotistas?erro=${encodeURIComponent(msg)}`)
}

async function somenteDono() {
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (painel.papel !== "PROP") erro("Só o proprietário define as cotas desta unidade.")
  return painel
}

/** §13: "ADM define quantidade de cotistas da unidade (ex.: 10)". */
export async function definirCotas(formData: FormData) {
  const painel = await somenteDono()
  const bruto = String(formData.get("cotas_total") ?? "").trim()
  const n = Number(bruto)
  if (!Number.isInteger(n) || n < 0) erro("Informe um número inteiro de cotas.")
  if (n > 200) erro("Máximo de 200 cotas por unidade.")

  const supabase = await supabaseServer()
  const { error } = await supabase
    .from("embarcacoes").update({ cotas_total: n }).eq("id", painel.embarcacao.id)
  if (error) erro("Não deu pra salvar as cotas. Tente de novo.")

  revalidatePath("/cotistas")
  redirect(`/cotistas?ok=${encodeURIComponent("Cotas atualizadas")}`)
}

/**
 * §13: "ADM pode ... redefinir o link SEM REMOVER USUÁRIOS EXISTENTES."
 *
 * Redefinir = desativar o atual e criar outro. Os dois passos, nessa ordem,
 * porque o índice único parcial da migration 061 só admite um link ativo por
 * unidade — criar antes de desativar violaria a constraint.
 *
 * O que NÃO acontece aqui, e é o ponto do §13: nenhum vínculo é tocado. Quem
 * já entrou continua dentro, e a contagem de vagas nem percebe a troca,
 * porque ela é derivada dos vínculos e não do link.
 */
export async function redefinirLink() {
  const painel = await somenteDono()
  const supabase = await supabaseServer()

  await supabase.from("convites_cotista")
    .update({ ativo: false })
    .eq("embarcacao_id", painel.embarcacao.id).eq("ativo", true)

  const { error } = await supabase.from("convites_cotista").insert({
    embarcacao_id: painel.embarcacao.id,
  })
  if (error) erro("Não deu pra gerar o link. Tente de novo.")

  revalidatePath("/cotistas")
  redirect(`/cotistas?ok=${encodeURIComponent("Link novo gerado")}`)
}

/** §13: "ADM pode marcar cotista como inadimplente e suspender o acesso ...
 *  ADM reativa quando desejar. Manter auditoria de bloqueio/desbloqueio." */
export async function alternarSuspensao(formData: FormData) {
  const painel = await somenteDono()
  const vinculoId = String(formData.get("vinculo_id") ?? "")
  const suspender = formData.get("suspender") === "1"
  const motivo = String(formData.get("motivo") ?? "").trim() || null
  if (!vinculoId) erro("Não encontramos esse acesso.")

  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  // O estado ANTES, lido antes de escrever. Sem isto a linha de auditoria
  // consegue dizer "bloqueou" e não consegue dizer "de quê para quê" — que é
  // metade do valor dela numa disputa (ver A3 da auditoria de 19/08).
  const { data: antes } = await supabase.from("vinculos")
    .select("suspenso_em").eq("id", vinculoId).maybeSingle()

  const { data, error } = await supabase
    .from("vinculos")
    .update(
      suspender
        ? { suspenso_em: new Date().toISOString(), suspenso_por: user?.id ?? null }
        : { suspenso_em: null, suspenso_por: null },
    )
    .eq("id", vinculoId)
    .eq("embarcacao_id", painel.embarcacao.id)
    .select("id, usuario_id")

  // O `select` confirma que a linha mudou. Sem ele, uma atualização barrada
  // pela policy voltaria sem erro e o app anunciaria "suspenso" à toa — a
  // mesma lição que a revogação de vínculo aprendeu na onda 63.
  if (error || !data?.length) erro("Não deu pra mudar esse acesso. Atualize a página.")

  // §22 — bloqueio e desbloqueio são eventos auditados, com autor e hora.
  //
  // AUDITORIA 19/08, A3 — este insert omitia `alvo`, `antes`, `depois` e
  // `motivo`, os quatro campos que a migration 059 criou. O resultado é que
  // mesmo abrindo o banco na mão a linha não contava a história: dizia que
  // alguém bloqueou alguém, sem dizer quem, de que estado para qual, nem por
  // quê. Numa disputa entre administradora e cotista ("por que perdi acesso
  // em julho?"), era exatamente a parte que faltava.
  //
  // `alvo` guarda o NOME, não o id: a linha é lida por gente, e um uuid não
  // responde a pergunta. Nome vazio vira `null` — a linha então diz "um
  // cotista" em vez de inventar.
  const { data: perfilAlvo } = await supabase.from("profiles")
    .select("nome").eq("id", data[0].usuario_id).maybeSingle()

  await supabase.from("auditoria").insert({
    embarcacao_id: painel.embarcacao.id,
    autor_id: user?.id ?? null,
    evento: suspender ? "bloqueou_cotista" : "desbloqueou_cotista",
    entidade: "vinculos",
    entidade_id: vinculoId,
    alvo: (perfilAlvo?.nome as string | null)?.trim() || null,
    antes: { suspenso_em: antes?.suspenso_em ?? null },
    depois: { suspenso_em: suspender ? new Date().toISOString() : null },
    motivo,
  })

  revalidatePath("/cotistas")
  revalidatePath("/tripulacao")
  redirect(`/cotistas?ok=${encodeURIComponent(suspender ? "Acesso suspenso" : "Acesso reativado")}`)
}
