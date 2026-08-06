"use server"
import { redirect } from "next/navigation"
import { supabaseServer } from "@/lib/supabase/server"

// Itens padrão por motor (espec §6.1): revisão 500 h, óleo 250 h ou 12 meses
const ITENS_MOTOR = [
  { nome: "Revisão geral", intervalo_horas: 500, intervalo_meses: null },
  { nome: "Troca de óleo e filtros", intervalo_horas: 250, intervalo_meses: 12 },
]

export async function concluirOnboarding(formData: FormData) {
  const supabase = await supabaseServer()
  const texto = (k: string) => {
    const v = String(formData.get(k) ?? "").trim()
    return v === "" ? null : v
  }
  const numero = (k: string) => {
    const v = texto(k)
    return v === null ? null : Number(v.replace(",", "."))
  }

  const { data: embarcacaoId, error } = await supabase.rpc("criar_embarcacao", {
    p_nome: texto("nome") ?? "Minha embarcação",
    p_estaleiro: texto("estaleiro"),
    p_modelo: texto("modelo"),
    p_ano: numero("ano"),
    p_marina: texto("marina"),
  })
  if (error || !embarcacaoId) redirect(`/onboarding?erro=${encodeURIComponent("Não foi possível criar a embarcação")}`)

  const doisMotores = texto("qtd_motores") === "2"
  const motores = doisMotores
    ? [
        { posicao: "BB", horas: numero("horas_bb") },
        { posicao: "BE", horas: numero("horas_be") },
      ]
    : [{ posicao: "central", horas: numero("horas_bb") }]

  for (const m of motores) {
    const { data: eq } = await supabase
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
    if (eq) {
      await supabase.from("itens_monitorados").insert(
        ITENS_MOTOR.map((i) => ({
          embarcacao_id: embarcacaoId,
          equipamento_id: eq.id,
          nome: i.nome,
          intervalo_horas: i.intervalo_horas,
          intervalo_meses: i.intervalo_meses,
          ultimo_ciclo_horas: m.horas ?? 0,
          ultimo_ciclo_data: new Date().toISOString().slice(0, 10),
        })),
      )
    }
  }

  const documentos = [
    { nome: "Seguro da embarcação", validade: texto("seguro_validade") },
    { nome: "TIE", validade: texto("tie_validade") },
  ].filter((d) => d.validade != null)
  if (documentos.length > 0) {
    await supabase.from("itens_monitorados").insert(
      documentos.map((d) => ({ embarcacao_id: embarcacaoId, nome: d.nome, data_fixa: d.validade })),
    )
  }

  redirect("/hoje")
}
