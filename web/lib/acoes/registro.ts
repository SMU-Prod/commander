"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { carregarPainel } from "@/lib/consultas"
import { validarLeitura } from "@/lib/domain/leituras"
import { parseDecimalPtBr } from "@/lib/domain/numeros"
import { supabaseServer } from "@/lib/supabase/server"

export async function registrarVoltaAoMar(formData: FormData) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const embarcacaoId = painel.embarcacao.id
  const motores = painel.equipamentos.filter((e) => e.tipo === "motor")

  // 1º passo: validar tudo antes de gravar qualquer coisa
  const leituras: { equipamentoId: string; nova: number }[] = []
  for (const eq of motores) {
    const bruto = String(formData.get(`equipamento_${eq.id}`) ?? "").trim()
    if (bruto === "") continue
    const nova = parseDecimalPtBr(bruto)
    if (nova === null) redirect(`/hoje?erro=${encodeURIComponent("Informe um número de horas válido.")}`)
    const v = validarLeitura(nova, eq.horas_atuais)
    if (!v.ok) redirect(`/hoje?erro=${encodeURIComponent(v.erro)}`)
    leituras.push({ equipamentoId: eq.id, nova })
  }

  // 2º passo: gravar
  let falhas = 0
  for (const l of leituras) {
    const { error: upErro } = await supabase
      .from("equipamentos")
      .update({ horas_atuais: l.nova, ultima_leitura: new Date().toISOString() })
      .eq("id", l.equipamentoId)
    const { error: evErro } = await supabase.from("eventos").insert({
      embarcacao_id: embarcacaoId,
      equipamento_id: l.equipamentoId,
      tipo: "leitura_horas",
      horas_no_momento: l.nova,
      criado_por: user.id,
    })
    if (upErro || evErro) falhas++
  }

  const litros = String(formData.get("litros") ?? "").trim()
  const obs = String(formData.get("obs") ?? "").trim()
  if (litros !== "" || obs !== "") {
    const { error } = await supabase.from("eventos").insert({
      embarcacao_id: embarcacaoId,
      tipo: litros !== "" ? "abastecimento" : "navegacao",
      descricao: [obs || null, litros !== "" ? `${litros} L abastecidos` : null].filter(Boolean).join(" · "),
      criado_por: user.id,
    })
    if (error) falhas++
  }

  revalidatePath("/hoje")
  revalidatePath("/barco")
  if (falhas > 0) {
    redirect(`/hoje?erro=${encodeURIComponent("Parte do registro não pôde ser salva. Confira e tente de novo.")}`)
  }
  redirect("/hoje")
}
