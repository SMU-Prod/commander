"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { validarLeitura } from "@/lib/domain/leituras"
import { parseDecimalPtBr } from "@/lib/domain/numeros"
import { supabaseServer } from "@/lib/supabase/server"

export async function registrarVoltaAoMar(formData: FormData) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: equipamentos } = await supabase
    .from("equipamentos")
    .select("id, embarcacao_id, horas_atuais")
    .eq("tipo", "motor")
  if (!equipamentos || equipamentos.length === 0) redirect("/onboarding")
  const embarcacaoId = equipamentos[0].embarcacao_id

  for (const eq of equipamentos) {
    const bruto = String(formData.get(`equipamento_${eq.id}`) ?? "").trim()
    if (bruto === "") continue
    const nova = parseDecimalPtBr(bruto)
    if (nova === null) redirect(`/hoje?erro=${encodeURIComponent("Informe um número de horas válido.")}`)
    const v = validarLeitura(nova, eq.horas_atuais)
    if (!v.ok) redirect(`/hoje?erro=${encodeURIComponent(v.erro)}`)

    await supabase
      .from("equipamentos")
      .update({ horas_atuais: nova, ultima_leitura: new Date().toISOString() })
      .eq("id", eq.id)
    await supabase.from("eventos").insert({
      embarcacao_id: embarcacaoId,
      equipamento_id: eq.id,
      tipo: "leitura_horas",
      horas_no_momento: nova,
      criado_por: user.id,
    })
  }

  const litros = String(formData.get("litros") ?? "").trim()
  const obs = String(formData.get("obs") ?? "").trim()
  if (litros !== "" || obs !== "") {
    await supabase.from("eventos").insert({
      embarcacao_id: embarcacaoId,
      tipo: litros !== "" ? "abastecimento" : "navegacao",
      descricao: [obs || null, litros !== "" ? `${litros} L abastecidos` : null].filter(Boolean).join(" · "),
      criado_por: user.id,
    })
  }

  revalidatePath("/hoje")
  revalidatePath("/barco")
  redirect("/hoje")
}
