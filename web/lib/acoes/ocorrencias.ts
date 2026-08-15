"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { subirArquivo } from "@/lib/acervo"
import { carregarPainel } from "@/lib/consultas"
import {
  ABAS_OCORRENCIA, ESTADOS_OCORRENCIA, podeTransicionar, proximaResolvidaEm, registroDaAnulacao,
  ROTULO_ESTADO, validarMotivoAnulacao, type EstadoOcorrencia,
} from "@/lib/domain/ocorrencias"
import { podeEditar, ROTULO_ABA, type Aba } from "@/lib/domain/permissoes"
import { supabaseServer } from "@/lib/supabase/server"
import type { Ocorrencia } from "@/lib/db/types"

function erroNova(msg: string): never {
  redirect(`/barco/ocorrencias/nova?erro=${encodeURIComponent(msg)}`)
}
function erroDetalhe(id: string, msg: string): never {
  redirect(`/barco/ocorrencias/${id}?erro=${encodeURIComponent(msg)}`)
}

function revalidarTudo(aba: string) {
  revalidatePath("/barco/ocorrencias")
  revalidatePath("/barco/historico")
  revalidatePath("/hoje")
  revalidatePath("/barco")
  if (aba === "hidraulica") revalidatePath("/barco/hidraulica")
  if (aba === "seguranca") revalidatePath("/barco/seguranca")
  if (aba === "eletrica" || aba === "equipamentos") revalidatePath("/barco/eletrica")
}

/** Registrar uma ocorrência direto (fora do Diário) — capacidade do PROP que
 *  faltava (auditoria §3: "Registrar ocorrências — AUSENTE"). O nascimento
 *  automático a partir de uma saída do Diário mora em `lib/acoes/eventos.ts`
 *  (`criarEvento`), que chama `inserirOcorrencia` abaixo — mesma escrita,
 *  duas portas de entrada. */
export async function criarOcorrencia(formData: FormData) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")

  const texto = (k: string) => {
    const v = String(formData.get(k) ?? "").trim()
    return v === "" ? null : v
  }
  const aba = texto("aba") as Aba | null
  if (!aba || !(ABAS_OCORRENCIA as readonly string[]).includes(aba)) erroNova("Escolha em qual setor isso aconteceu.")
  if (!podeEditar(painel.permissoes, aba)) {
    erroNova(`Seu acesso não permite registrar ocorrência em ${ROTULO_ABA[aba]}.`)
  }

  const titulo = texto("titulo")
  if (!titulo) erroNova("Dê um título curto pra essa ocorrência.")
  const descricao = texto("descricao")
  const gravidadeBruta = texto("gravidade")
  const gravidade = gravidadeBruta === "baixa" || gravidadeBruta === "media" || gravidadeBruta === "alta" ? gravidadeBruta : null
  const equipamentoId = texto("equipamento_id")
  if (equipamentoId && !painel.equipamentos.some((e) => e.id === equipamentoId)) erroNova("Equipamento inválido.")

  let anexoPath: string | null = null
  const anexo = formData.get("anexo")
  if (anexo instanceof File && anexo.size > 0) {
    const r = await subirArquivo(supabase, painel.embarcacao.id, "ocorrencias", anexo)
    if ("erro" in r) erroNova(r.erro)
    else anexoPath = r.path
  }

  const { data: criada, error } = await supabase.from("ocorrencias").insert({
    embarcacao_id: painel.embarcacao.id,
    aba,
    equipamento_id: equipamentoId,
    titulo,
    descricao,
    gravidade,
    anexo_path: anexoPath,
    criado_por: user.id,
  }).select("id").single()
  if (error || !criada) {
    if (anexoPath) await supabase.storage.from("acervo").remove([anexoPath])
    erroNova("Não foi possível registrar a ocorrência. Tente de novo.")
  }

  await supabase.from("ocorrencias_transicoes").insert({
    ocorrencia_id: criada!.id, estado_anterior: null, estado_novo: "aberta", criado_por: user.id,
  })

  revalidarTudo(aba)
  redirect(`/barco/ocorrencias/${criada!.id}?ok=${encodeURIComponent("Ocorrência registrada")}`)
}

/** Escrita compartilhada pelo nascimento automático a partir do Diário
 *  (`criarEvento`) — não é uma server action (sem "use server" isolado
 *  porque já vive num módulo "use server", mas não é chamada direto de um
 *  <form>). Mesma regra da casa: `.select()` + checagem, porque RLS
 *  barrando devolve `error: null` e a tela mentiria "salvo". Retorna o erro
 *  em vez de redirecionar — quem chama decide o que fazer (o Diário não
 *  pode perder a saída já registrada só porque a ocorrência falhou). */
export async function inserirOcorrenciaDoDiario(params: {
  embarcacaoId: string
  aba: Aba
  titulo: string
  descricao: string | null
  eventoId: string
  criadoPor: string
}): Promise<{ ok: true } | { ok: false }> {
  const supabase = await supabaseServer()
  const { data: criada, error } = await supabase.from("ocorrencias").insert({
    embarcacao_id: params.embarcacaoId,
    aba: params.aba,
    titulo: params.titulo,
    descricao: params.descricao,
    evento_id: params.eventoId,
    criado_por: params.criadoPor,
  }).select("id").single()
  if (error || !criada) return { ok: false }
  await supabase.from("ocorrencias_transicoes").insert({
    ocorrencia_id: criada.id, estado_anterior: null, estado_novo: "aberta", criado_por: params.criadoPor,
  })
  revalidatePath("/barco/ocorrencias")
  revalidatePath("/barco/historico")
  revalidatePath("/hoje")
  return { ok: true }
}

export async function transicionarOcorrencia(formData: FormData) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")

  const id = String(formData.get("ocorrencia_id") ?? "")
  const novoEstado = String(formData.get("novo_estado") ?? "") as EstadoOcorrencia
  const observacao = String(formData.get("observacao") ?? "").trim() || null

  const { data: atual } = await supabase.from("ocorrencias").select("*").eq("id", id).maybeSingle()
  const ocorrencia = atual as Ocorrencia | null
  if (!ocorrencia || ocorrencia.embarcacao_id !== painel.embarcacao.id) {
    redirect(`/barco/ocorrencias?erro=${encodeURIComponent("Não encontramos essa ocorrência. Atualize a página.")}`)
  }
  if (!podeEditar(painel.permissoes, ocorrencia.aba)) {
    erroDetalhe(id, `Seu acesso não permite alterar ocorrências em ${ROTULO_ABA[ocorrencia.aba]}.`)
  }
  if (!(ESTADOS_OCORRENCIA as readonly string[]).includes(novoEstado)) {
    erroDetalhe(id, "Estado inválido.")
  }
  if (!podeTransicionar(ocorrencia.estado, novoEstado)) {
    erroDetalhe(
      id,
      `Uma ocorrência ${ROTULO_ESTADO[ocorrencia.estado].toLowerCase()} não pode virar "${ROTULO_ESTADO[novoEstado].toLowerCase()}" diretamente.`,
    )
  }

  // "Pode ser anulada COM REGISTRO quando criada por engano" (PRD §7) — o
  // motivo é o registro. Sem ele a anulação viraria exclusão silenciosa, que
  // é justamente o que o §7 proíbe; por isso barra aqui antes de escrever
  // qualquer coisa (o banco também barra, no check constraint da migration
  // 045 — duas travas, porque essa é a parte que importa da funcionalidade).
  // O campo reaproveita a caixa de "Observação" que a tela já tinha: ao
  // anular ela deixa de ser opcional.
  const motivo = novoEstado === "anulada" ? validarMotivoAnulacao(observacao) : null
  if (novoEstado === "anulada" && !motivo) {
    erroDetalhe(id, "Pra anular, escreva o motivo — o registro fica no histórico, a ocorrência não é apagada.")
  }

  const agora = new Date().toISOString()
  const { data: salva, error } = await supabase.from("ocorrencias")
    .update({
      estado: novoEstado,
      resolvida_em: proximaResolvidaEm(novoEstado, agora),
      ...registroDaAnulacao(novoEstado, agora, user.id, motivo ?? ""),
    })
    .eq("id", id).select("id")
  if (error || !salva?.length) erroDetalhe(id, "Não foi possível salvar agora. Tente de novo em instantes.")

  const { error: erroTransicao } = await supabase.from("ocorrencias_transicoes").insert({
    ocorrencia_id: id, estado_anterior: ocorrencia.estado, estado_novo: novoEstado, observacao, criado_por: user.id,
  }).select("id")
  if (erroTransicao) {
    erroDetalhe(id, "O estado foi salvo, mas o histórico da mudança não. Recarregue para conferir.")
  }

  revalidarTudo(ocorrencia.aba)
  revalidatePath(`/barco/ocorrencias/${id}`)
  redirect(`/barco/ocorrencias/${id}?ok=${encodeURIComponent("Ocorrência atualizada")}`)
}
