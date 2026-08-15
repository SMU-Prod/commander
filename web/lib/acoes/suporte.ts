"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { exigirAreaAdmin } from "@/lib/admin"
import { registrarLogAdmin } from "@/lib/log-admin"
import { PLANOS, type PlanoId } from "@/lib/domain/planos"
import { supabaseServer } from "@/lib/supabase/server"

/**
 * Ações do Suporte (PRD §21).
 *
 * O escopo do §21 é "Usuários, embarcações, planos/status, chamados e
 * operação de suporte; sem configurações estratégicas críticas". Traduzido
 * pra código: o Suporte LÊ quase tudo do cliente e ESCREVE quase nada.
 *
 * Existem exatamente duas escritas aqui, e as duas são explícitas,
 * intencionais e registradas:
 *
 *   1. `registrarAtendimento` — a anotação do que foi feito no chamado.
 *      Grava SÓ em `admin_logs`, que já responde "quem, quando, função,
 *      ação, entidade afetada" (§21.3). Não criei tabela de chamados: o §21
 *      cita a palavra "chamados" e o PRD não descreve o objeto em lugar
 *      nenhum — inventar um helpdesk a partir de uma palavra seria
 *      construir o módulo errado e caro.
 *
 *   2. `concederCortesia` — acesso premium por cortesia quando o cliente foi
 *      prejudicado. A capacidade já existia no banco desde a migration 049
 *      (policy "premium_concessoes: suporte cria") e não tinha tela.
 *
 * O QUE NÃO EXISTE AQUI, DE PROPÓSITO: nenhuma edição de dado técnico da
 * embarcação. Horas de motor, manutenção, documento e ocorrência são do
 * dono do barco e da tripulação dele. O Suporte VÊ pra atender; se um dia
 * precisar corrigir algo, que seja uma ação nomeada, com policy própria e
 * log próprio — não um formulário genérico de edição.
 */

function erro(caminho: string, msg: string): never {
  redirect(`${caminho}?erro=${encodeURIComponent(msg)}`)
}
function ok(caminho: string, msg: string): never {
  redirect(`${caminho}?ok=${encodeURIComponent(msg)}`)
}

/**
 * Registra o atendimento prestado.
 *
 * O log é o único destino. Isso tem uma consequência boa e uma ruim, e as
 * duas ficam ditas: bom, porque o registro é imutável (a tabela tem
 * update/delete revogados — nem o CEO reescreve); ruim, porque o histórico
 * de atendimento de um cliente só se lê no `/admin/logs` filtrando pela
 * entidade, não numa aba bonita na ficha dele. Quando o módulo de chamados
 * existir, é ele que vira a casa disso.
 */
export async function registrarAtendimento(formData: FormData) {
  await exigirAreaAdmin("usuarios")

  const usuarioId = String(formData.get("usuario_id") ?? "")
  const caminho = `/admin/usuarios/${usuarioId}`
  const nota = String(formData.get("nota") ?? "").trim()
  if (!nota) erro(caminho, "Escreva o que foi feito no atendimento.")
  if (nota.length > 1000) erro(caminho, "A anotação ficou longa demais — resuma em até 1000 caracteres.")

  const assunto = String(formData.get("assunto") ?? "").trim() || "Atendimento"

  await registrarLogAdmin({
    acao: "suporte.atendimento",
    entidade: "profiles",
    entidadeId: usuarioId,
    detalhes: { assunto, nota },
  })

  revalidatePath(caminho)
  ok(caminho, "Atendimento registrado no log administrativo")
}

/**
 * Concede acesso premium por cortesia até uma data.
 *
 * Não é "ativar assinatura": nenhuma linha de `assinaturas` é criada, nenhum
 * gateway é acionado, ninguém passa a ser cobrado. É uma CONCESSÃO com
 * validade — o mesmo mecanismo que o §2.2 usa pra entregar 6 meses de
 * Commander a quem comprou o Gold. Quando vence, a conta volta ao nível
 * dela sozinha, sem cancelamento nem cobrança pendente.
 */
export async function concederCortesia(formData: FormData) {
  await exigirAreaAdmin("usuarios")
  const supabase = await supabaseServer()

  const usuarioId = String(formData.get("usuario_id") ?? "")
  const caminho = `/admin/usuarios/${usuarioId}`

  const plano = String(formData.get("plano") ?? "") as PlanoId
  // Só plano que existe no catálogo e que faz sentido conceder. Enterprise é
  // "Em breve" (§2) e Free não é concessão — conceder Free seria conceder
  // nada com cara de gentileza.
  const CONCEDIVEIS: PlanoId[] = ["commander", "commander_pro", "captain_pro"]
  if (!CONCEDIVEIS.includes(plano)) erro(caminho, "Escolha um plano que possa ser concedido.")

  const validoAte = String(formData.get("valido_ate") ?? "").trim()
  if (!validoAte) erro(caminho, "Informe até quando vale a cortesia.")
  const hoje = new Date().toISOString().slice(0, 10)
  if (validoAte <= hoje) erro(caminho, "A cortesia precisa valer para uma data futura.")

  const motivo = String(formData.get("motivo") ?? "").trim()
  if (!motivo) erro(caminho, "Diga por que a cortesia está sendo concedida — é o que o log vai guardar.")

  const { data: inserida, error } = await supabase
    .from("premium_concessoes")
    .insert({ usuario_id: usuarioId, origem: "cortesia", valido_ate: validoAte, plano_concedido: plano })
    .select("id")
  if (error || !inserida?.length) erro(caminho, "Não foi possível conceder a cortesia. Tente de novo.")

  await registrarLogAdmin({
    acao: "suporte.cortesia.conceder",
    entidade: "premium_concessoes",
    entidadeId: inserida[0].id as string,
    statusDepois: `${plano} até ${validoAte}`,
    detalhes: { usuario_id: usuarioId, plano, valido_ate: validoAte, motivo },
  })

  revalidatePath(caminho)
  ok(caminho, `Cortesia de ${PLANOS[plano].rotulo} concedida até ${validoAte.split("-").reverse().join("/")}`)
}
