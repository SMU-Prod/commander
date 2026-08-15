"use server"
import { redirect } from "next/navigation"
import { supabaseServer } from "@/lib/supabase/server"
import { parseDecimalPtBr } from "@/lib/domain/numeros"
import { hojeISO } from "@/lib/domain/datas"
import { definirEmbarcacaoAtiva } from "@/lib/embarcacao-ativa"

// Itens padrão por motor (espec §6.1): revisão 500 h, óleo 250 h ou 12 meses
const ITENS_MOTOR = [
  { nome: "Revisão geral", intervalo_horas: 500, intervalo_meses: null },
  { nome: "Troca de óleo e filtros", intervalo_horas: 250, intervalo_meses: 12 },
]

export async function concluirOnboarding(formData: FormData) {
  // Antes esta action recusava quem ja tinha barco (redirect /hoje) — o que
  // tornava IMPOSSIVEL cadastrar uma segunda embarcacao. A RPC criar_embarcacao
  // ja cria o vinculo PROP de quem chamou, entao serve igual pro primeiro e
  // pro quinto barco. So exige estar logado.
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login?volta=/onboarding")
  const texto = (k: string) => {
    const v = String(formData.get(k) ?? "").trim()
    return v === "" ? null : v
  }
  const numero = (k: string) => parseDecimalPtBr(String(formData.get(k) ?? ""))

  const { data: embarcacaoId, error } = await supabase.rpc("criar_embarcacao", {
    p_nome: texto("nome") ?? "Minha embarcação",
    p_estaleiro: texto("estaleiro"),
    p_modelo: texto("modelo"),
    p_ano: numero("ano"),
    p_marina: texto("marina"),
  })
  if (error || !embarcacaoId) {
    // §2/§28 — o limite de embarcações do plano é aplicado NO BANCO
    // (`criar_embarcacao`, migration 048), não só na tela: §27.2 exige a regra
    // nos dois lados. O erro vem como `limite_embarcacoes_N`; traduzir aqui é
    // o que o §24 pede pra "Limite atingido" — explicar o limite e oferecer o
    // upgrade, nunca falhar em silêncio nem cuspir erro de banco.
    const limite = error?.message.match(/limite_embarcacoes_(\d+)/)?.[1]
    if (limite) {
      redirect(
        `/onboarding?erro=${encodeURIComponent(
          `Seu plano cadastra ${limite} ${limite === "1" ? "embarcação" : "embarcações"}. ` +
            "Para cuidar de mais barcos no mesmo aplicativo, passe para o Commander Pro em Menu › Assinatura.",
        )}`,
      )
    }
    redirect(`/onboarding?erro=${encodeURIComponent("Não deu para cadastrar o barco agora. Confira sua conexão e tente de novo.")}`)
  }

  const doisMotores = texto("qtd_motores") === "2"
  const motores = doisMotores
    ? [
        { posicao: "BB", horas: numero("horas_bb") },
        { posicao: "BE", horas: numero("horas_be") },
      ]
    : [{ posicao: "central", horas: numero("horas_bb") }]

  let falhas = 0

  for (const m of motores) {
    const { data: eq, error: eqError } = await supabase
      .from("equipamentos")
      .insert({
        embarcacao_id: embarcacaoId,
        tipo: "motor",
        posicao: m.posicao,
        marca: texto("motor_marca"),
        modelo: texto("motor_modelo"),
        horas_atuais: m.horas,
        ultima_leitura: m.horas != null ? new Date().toISOString() : null,
      })
      .select("id")
      .single()
    if (eqError || !eq) {
      falhas++
    } else {
      const { error: itensError } = await supabase.from("itens_monitorados").insert(
        ITENS_MOTOR.map((i) => ({
          embarcacao_id: embarcacaoId,
          equipamento_id: eq.id,
          nome: i.nome,
          intervalo_horas: i.intervalo_horas,
          intervalo_meses: i.intervalo_meses,
          ultimo_ciclo_horas: m.horas,
          ultimo_ciclo_data: hojeISO(),
        })),
      )
      if (itensError) falhas++
    }
  }

  const documentos = [
    { nome: "Seguro da embarcação", validade: texto("seguro_validade") },
    { nome: "TIE", validade: texto("tie_validade") },
  ].filter((d) => d.validade != null)
  if (documentos.length > 0) {
    const { error: docsError } = await supabase.from("itens_monitorados").insert(
      documentos.map((d) => ({ embarcacao_id: embarcacaoId, nome: d.nome, data_fixa: d.validade, categoria: "documento" })),
    )
    if (docsError) falhas++
  }

  // o barco recem-criado vira o ativo — senao a pessoa cadastra e continua
  // vendo o barco antigo, sem entender o que aconteceu
  const escolha = new FormData()
  escolha.set("embarcacao_id", String(embarcacaoId))
  await definirEmbarcacaoAtiva(escolha)

  if (falhas > 0) {
    redirect(`/hoje?erro=${encodeURIComponent("Embarcação criada, mas parte dos dados não foi. Confira em Embarcação o que ficou faltando.")}`)
  }
  redirect(`/hoje?ok=${encodeURIComponent("Embarcação cadastrada")}`)
}
