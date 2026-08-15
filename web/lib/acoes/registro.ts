"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { carregarPainel } from "@/lib/consultas"
import { validarLeitura } from "@/lib/domain/leituras"
import { parseDecimalPtBr } from "@/lib/domain/numeros"
import { podeEditar } from "@/lib/domain/permissoes"
import { supabaseServer } from "@/lib/supabase/server"
import { hojeISO } from "@/lib/domain/datas"
import { atualizarLeituraEquipamento } from "@/lib/acoes/leituras"

export async function registrarVoltaAoMar(formData: FormData) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  // §27.2: "Permissões devem ser aplicadas tanto na interface quanto no
  // backend/API". Esta action escreve `equipamentos.horas_atuais` — o número
  // que a Saúde e todo o cálculo de manutenção usam. A tela `/diario/[id]/horas`
  // já checava, mas o botão flutuante "+ Registrar" (`app/(app)/layout.tsx`)
  // é o outro caminho até aqui, e por ele não passava guard nenhum: sobrava
  // só a RLS, que recusa em silêncio e faz o app dizer "pronto" pra uma
  // leitura que não foi gravada.
  if (!podeEditar(painel.permissoes, "motores")) {
    redirect(`/hoje?erro=${encodeURIComponent("Seu acesso não permite atualizar as horas dos motores.")}`)
  }
  const embarcacaoId = painel.embarcacao.id
  const motores = painel.equipamentos.filter((e) => e.tipo === "motor")

  // 1º passo: validar tudo antes de gravar qualquer coisa
  const leituras: { equipamentoId: string; nova: number }[] = []
  for (const eq of motores) {
    const bruto = String(formData.get(`equipamento_${eq.id}`) ?? "").trim()
    if (bruto === "") continue
    const nova = parseDecimalPtBr(bruto)
    if (nova === null) redirect(`/hoje?erro=${encodeURIComponent("Digite as horas do motor (só números, ex.: 1250,5).")}`)
    const v = validarLeitura(nova, eq.horas_atuais)
    if (!v.ok) redirect(`/hoje?erro=${encodeURIComponent(v.erro)}`)
    leituras.push({ equipamentoId: eq.id, nova })
  }

  // 2º passo: gravar
  let falhas = 0
  for (const l of leituras) {
    const { data: atualizado, error: upErro } = await atualizarLeituraEquipamento(supabase, l.equipamentoId, l.nova)
    const { error: evErro } = await supabase.from("eventos").insert({
      embarcacao_id: embarcacaoId,
      equipamento_id: l.equipamentoId,
      tipo: "leitura_horas",
      horas_no_momento: l.nova,
      criado_por: user.id,
      data: hojeISO(),
    })
    if (upErro || !atualizado?.length || evErro) falhas++
  }

  const litros = String(formData.get("litros") ?? "").trim()
  const obs = String(formData.get("obs") ?? "").trim()
  if (litros !== "" || obs !== "") {
    const { error } = await supabase.from("eventos").insert({
      embarcacao_id: embarcacaoId,
      tipo: litros !== "" ? "abastecimento" : "navegacao",
      descricao: [obs || null, litros !== "" ? `${litros} L abastecidos` : null].filter(Boolean).join(" · "),
      criado_por: user.id,
      data: hojeISO(),
    })
    if (error) falhas++
  }

  revalidatePath("/hoje")
  revalidatePath("/barco")
  if (falhas > 0) {
    // NÃO afirme o que foi salvo: `falhas` conta os dois laços juntos (horas e
    // combustível/observação), então dizer "salvamos as horas" pode ser mentira
    // justamente quando o update das horas é que falhou.
    redirect(`/hoje?erro=${encodeURIComponent("Parte do registro não foi salva. Confira na Embarcação o que ficou faltando.")}`)
  }
  redirect("/hoje")
}
