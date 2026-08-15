"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { exigirAreaAdmin } from "@/lib/admin"
import { registrarLogAdmin } from "@/lib/log-admin"
import {
  periodoValido,
  podeTransicionar,
  produtoValido,
  ROTULO_PRODUTO,
  ROTULO_STATUS_CAMPANHA,
  statusValido,
  type StatusCampanha,
} from "@/lib/domain/publicidade"
import { supabaseServer } from "@/lib/supabase/server"
import type { PublicidadeCampanhaDb } from "@/lib/db/publicidade"

/**
 * Ações do Comercial (PRD §21: "Partners, destaques, campanhas, publicidade
 * e métricas comerciais").
 *
 * Toda action confirma a ÁREA antes de tocar no banco, e a RLS da migration
 * 053 confirma de novo — defesa em profundidade, mesmo padrão do Gold. A
 * checagem daqui existe pra que a pessoa leia uma frase em português em vez
 * do erro cru do Postgres; a que VALE é a do banco.
 *
 * Toda mudança de estado grava em `admin_logs` via `registrar_log_admin`
 * (§21.3: "quem, quando, função, ação, entidade afetada e mudança de
 * status"). Preço e status entram com `status_antes`/`status_depois`
 * preenchidos — sem isso o log diria que algo mudou sem dizer de quê pra quê.
 */

const CAMINHO = "/admin/publicidade"

function erro(msg: string): never {
  redirect(`${CAMINHO}?erro=${encodeURIComponent(msg)}`)
}
function ok(msg: string): never {
  redirect(`${CAMINHO}?ok=${encodeURIComponent(msg)}`)
}

/** Reais em pt-BR ("199,90") → centavos. Vazio vira `null` = sob consulta. */
function centavosDoCampo(bruto: string): number | null | "invalido" {
  const limpo = bruto.trim().replace(/\./g, "").replace(",", ".")
  if (limpo === "") return null
  const n = Number(limpo)
  if (!Number.isFinite(n) || n < 0) return "invalido"
  return Math.round(n * 100)
}

// ===========================================================================
// §20 — "Preço não deve ser hardcoded; configurável no Admin/Comercial"
// ===========================================================================
export async function atualizarPrecoPublicidade(formData: FormData) {
  await exigirAreaAdmin("publicidade")
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  const produto = String(formData.get("produto") ?? "")
  if (!produtoValido(produto)) erro("Produto de publicidade desconhecido.")

  const centavos = centavosDoCampo(String(formData.get("valor_reais") ?? ""))
  if (centavos === "invalido") {
    erro("Valor inválido — use um número em reais (ex.: 199,90), ou deixe vazio para 'sob consulta'.")
  }

  const { data: antes } = await supabase
    .from("publicidade_produtos").select("preco_mensal_centavos").eq("produto", produto).maybeSingle()

  const { data: salvo, error } = await supabase
    .from("publicidade_produtos")
    .update({
      preco_mensal_centavos: centavos,
      atualizado_por: user?.id ?? null,
      atualizado_em: new Date().toISOString(),
    })
    .eq("produto", produto)
    .select("produto")
  // Sem o `select`, uma linha barrada pela RLS voltaria com `error` nulo e a
  // tela diria "salvo" sem ter salvado nada.
  if (error || !salvo?.length) erro("Não foi possível salvar o preço. Tente de novo.")

  await registrarLogAdmin({
    acao: "publicidade.preco.atualizar",
    entidade: "publicidade_produtos",
    entidadeId: produto,
    statusAntes: textoPreco((antes as { preco_mensal_centavos: number | null } | null)?.preco_mensal_centavos ?? null),
    statusDepois: textoPreco(centavos),
    detalhes: { produto: ROTULO_PRODUTO[produto] },
  })

  revalidatePath(CAMINHO)
  ok(`Preço de "${ROTULO_PRODUTO[produto]}" atualizado`)
}

/** Texto do log — "sob consulta" e não "null": o log é lido por gente. */
function textoPreco(centavos: number | null): string {
  return centavos == null ? "sob consulta" : `R$ ${(centavos / 100).toFixed(2).replace(".", ",")}`
}

// ===========================================================================
// Campanhas
// ===========================================================================
export async function criarCampanha(formData: FormData) {
  await exigirAreaAdmin("publicidade")
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  const parceiroId = String(formData.get("parceiro_id") ?? "")
  if (!parceiroId) erro("Escolha o Partner que vai anunciar.")

  const produto = String(formData.get("produto") ?? "")
  if (!produtoValido(produto)) erro("Escolha um dos três produtos de publicidade.")

  const inicio = String(formData.get("inicio") ?? "").trim()
  const fimBruto = String(formData.get("fim") ?? "").trim()
  const fim = fimBruto === "" ? null : fimBruto
  if (!periodoValido(inicio, fim)) {
    erro("Período inválido — a data de término não pode ser anterior à de início.")
  }

  const centavos = centavosDoCampo(String(formData.get("valor_reais") ?? ""))
  if (centavos === "invalido") erro("Valor cobrado inválido — use um número em reais (ex.: 199,90).")

  const prioridadeBruta = String(formData.get("prioridade") ?? "0").trim()
  const prioridade = Number(prioridadeBruta === "" ? "0" : prioridadeBruta)
  if (!Number.isInteger(prioridade)) erro("A prioridade precisa ser um número inteiro.")

  const { data: inserida, error } = await supabase
    .from("publicidade_campanhas")
    .insert({
      parceiro_id: parceiroId,
      produto,
      // Nasce em rascunho SEMPRE. Colocar no ar é uma segunda decisão, com
      // log próprio — criar e publicar no mesmo clique apagaria a diferença
      // entre "montei a proposta" e "o cliente está pagando".
      status: "rascunho" satisfies StatusCampanha,
      inicio,
      fim,
      regiao_id: String(formData.get("regiao_id") ?? "") || null,
      categoria_id: String(formData.get("categoria_id") ?? "") || null,
      prioridade,
      valor_centavos: centavos,
      chamada: String(formData.get("chamada") ?? "").trim() || null,
      criado_por: user?.id ?? null,
    })
    .select("id")
  if (error || !inserida?.length) erro("Não foi possível criar a campanha. Tente de novo.")

  await registrarLogAdmin({
    acao: "publicidade.campanha.criar",
    entidade: "publicidade_campanhas",
    entidadeId: inserida[0].id as string,
    statusDepois: "rascunho",
    detalhes: { produto: ROTULO_PRODUTO[produto], parceiro_id: parceiroId, inicio, fim },
  })

  revalidatePath(CAMINHO)
  ok("Campanha criada como rascunho — coloque no ar quando o acerto estiver fechado.")
}

/** Muda o estado da campanha respeitando as transições do domínio. */
export async function mudarStatusCampanha(formData: FormData) {
  await exigirAreaAdmin("publicidade")
  const supabase = await supabaseServer()

  const id = String(formData.get("id") ?? "")
  const destino = String(formData.get("status") ?? "")
  if (!statusValido(destino)) erro("Estado de campanha desconhecido.")

  const { data: atual } = await supabase
    .from("publicidade_campanhas").select("*").eq("id", id).maybeSingle()
  const campanha = atual as PublicidadeCampanhaDb | null
  if (!campanha) erro("Campanha não encontrada.")

  if (!podeTransicionar(campanha.status, destino)) {
    erro(
      `Não dá pra ir de "${ROTULO_STATUS_CAMPANHA[campanha.status]}" para ` +
        `"${ROTULO_STATUS_CAMPANHA[destino]}". Campanha encerrada não volta ao ar — crie uma nova.`,
    )
  }

  const { data: salva, error } = await supabase
    .from("publicidade_campanhas").update({ status: destino }).eq("id", id).select("id")
  if (error || !salva?.length) erro("Não foi possível mudar o estado da campanha. Tente de novo.")

  await registrarLogAdmin({
    acao: "publicidade.campanha.status",
    entidade: "publicidade_campanhas",
    entidadeId: id,
    statusAntes: campanha.status,
    statusDepois: destino,
    detalhes: { produto: ROTULO_PRODUTO[campanha.produto], parceiro_id: campanha.parceiro_id },
  })

  revalidatePath(CAMINHO)
  // O Dashboard de todo mundo muda quando uma campanha entra ou sai do ar.
  revalidatePath("/barco")
  revalidatePath("/explorar")
  ok(`Campanha agora está em "${ROTULO_STATUS_CAMPANHA[destino]}"`)
}

/** Ajustes de veiculação: período, segmentação, prioridade, chamada e valor.
 *  NÃO muda o Partner nem o produto — isso seria outra venda, e outra
 *  campanha, com contadores próprios. */
export async function editarCampanha(formData: FormData) {
  await exigirAreaAdmin("publicidade")
  const supabase = await supabaseServer()

  const id = String(formData.get("id") ?? "")
  const inicio = String(formData.get("inicio") ?? "").trim()
  const fimBruto = String(formData.get("fim") ?? "").trim()
  const fim = fimBruto === "" ? null : fimBruto
  if (!periodoValido(inicio, fim)) {
    erro("Período inválido — a data de término não pode ser anterior à de início.")
  }

  const centavos = centavosDoCampo(String(formData.get("valor_reais") ?? ""))
  if (centavos === "invalido") erro("Valor cobrado inválido — use um número em reais (ex.: 199,90).")

  const prioridade = Number(String(formData.get("prioridade") ?? "0").trim() || "0")
  if (!Number.isInteger(prioridade)) erro("A prioridade precisa ser um número inteiro.")

  const { data: salva, error } = await supabase
    .from("publicidade_campanhas")
    .update({
      inicio,
      fim,
      regiao_id: String(formData.get("regiao_id") ?? "") || null,
      categoria_id: String(formData.get("categoria_id") ?? "") || null,
      prioridade,
      valor_centavos: centavos,
      chamada: String(formData.get("chamada") ?? "").trim() || null,
    })
    .eq("id", id)
    .select("id")
  if (error || !salva?.length) erro("Não foi possível salvar a campanha. Tente de novo.")

  await registrarLogAdmin({
    acao: "publicidade.campanha.editar",
    entidade: "publicidade_campanhas",
    entidadeId: id,
    detalhes: { inicio, fim, prioridade, valor_centavos: centavos },
  })

  revalidatePath(CAMINHO)
  revalidatePath("/barco")
  revalidatePath("/explorar")
  ok("Campanha atualizada")
}

// ===========================================================================
// Partners (§21) — listar, ativar/suspender, ver plano
// ===========================================================================
/**
 * Suspende ou reativa o perfil de um Partner.
 *
 * Passa por RPC (`parceiro_admin_definir_visibilidade`) e não por UPDATE
 * direto porque RLS não filtra COLUNA: uma policy de update pro Comercial
 * deixaria ele reescrever telefone, preço e descrição do Partner inteiro. A
 * RPC toca `visivel` e nada mais. Ver o item 8 do cabeçalho da migration 053.
 */
export async function definirVisibilidadeParceiro(formData: FormData) {
  await exigirAreaAdmin("parceiros")
  const supabase = await supabaseServer()

  const id = String(formData.get("id") ?? "")
  const visivel = formData.get("visivel") === "sim"

  const { data, error } = await supabase.rpc("parceiro_admin_definir_visibilidade", {
    p_parceiro_id: id,
    p_visivel: visivel,
  })
  if (error) {
    redirect(`/admin/parceiros?erro=${encodeURIComponent("Não foi possível mudar o perfil do Partner. Tente de novo.")}`)
  }

  await registrarLogAdmin({
    acao: visivel ? "parceiro.reativar" : "parceiro.suspender",
    entidade: "parceiros",
    entidadeId: id,
    statusAntes: (data as boolean | null) ? "ativo" : "suspenso",
    statusDepois: visivel ? "ativo" : "suspenso",
  })

  revalidatePath("/admin/parceiros")
  revalidatePath("/explorar")
  redirect(
    `/admin/parceiros?ok=${encodeURIComponent(visivel ? "Partner reativado no Explorar" : "Partner suspenso do Explorar")}`,
  )
}
