"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { carregarNivelPlano, carregarPainel, carregarUsoTripulacao } from "@/lib/consultas"
import { PRESETS } from "@/lib/domain/permissoes"
import { mensagemBloqueio, vagasTripulacao } from "@/lib/domain/plano-acesso"
import { supabaseServer } from "@/lib/supabase/server"

export async function aceitarConvite(formData: FormData) {
  const codigo = String(formData.get("codigo") ?? "").trim()
  function erroAceite(msg: string): never {
    redirect(`/convite/${encodeURIComponent(codigo)}?erro=${encodeURIComponent(msg)}`)
  }
  if (codigo === "") redirect("/hoje?erro=" + encodeURIComponent("Convite inválido."))
  const supabase = await supabaseServer()
  const { error } = await supabase.rpc("aceitar_convite", { p_codigo: codigo })
  if (error) {
    erroAceite(
      error.message.includes("expirado") || error.message.includes("inválido")
        ? "Este convite não é mais válido — peça um novo ao proprietário."
        : error.message.includes("tripulação")
          ? "Você já faz parte desta tripulação."
          : // §19 — as vagas podem ter acabado entre o convite ser criado e
            // alguém aceitar (o plano do dono pode ter caído nesse meio-tempo).
            // O convite continua guardado; quem resolve é o proprietário.
            error.message.includes("limite_acessos")
            ? "As vagas de tripulação desta embarcação estão ocupadas. Peça ao proprietário para liberar uma vaga."
            : "Não foi possível aceitar o convite. Tente de novo.",
    )
  }
  revalidatePath("/hoje")
  redirect("/hoje")
}

function erroTripulacao(msg: string): never {
  redirect(`/menu/tripulacao?erro=${encodeURIComponent(msg)}`)
}

/**
 * §19: "Limite: até 2 acessos de tripulação por embarcação. Convite pendente
 * OCUPA VAGA." E §2.3: o Free "não pode adicionar tripulação" (limite 0).
 *
 * A trava vale nos três lugares que o §27.2 exige: na tela
 * (`menu/tripulacao/page.tsx` esconde o formulário e mostra o motivo), aqui na
 * action, e no banco (trigger `convites_respeitam_limite`, migration 048). Os
 * dois primeiros existem pra dar mensagem boa; o terceiro é o que realmente
 * garante — action pode ser chamada direto.
 */
export async function criarConvite(formData: FormData) {
  const supabase = await supabaseServer()
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (painel.papel !== "PROP") erroTripulacao("Só o proprietário convida tripulação.")

  const [nivelPlanoAtual, uso] = await Promise.all([carregarNivelPlano(), carregarUsoTripulacao()])
  const vagas = vagasTripulacao(nivelPlanoAtual, uso.vinculos, uso.convites)
  if (!vagas.cabeMais) {
    erroTripulacao(
      vagas.total === 0
        ? mensagemBloqueio("tripulacao_adicionar").descricao
        : `Esta embarcação já usa as ${vagas.total} vagas de tripulação do plano (comandantes com acesso + convites ` +
            "aguardando resposta). Revogue um convite pendente ou remova um acesso para liberar vaga.",
    )
  }

  const nivel = String(formData.get("nivel") ?? "operacional") === "completo" ? "completo" : "operacional"
  const { data, error } = await supabase
    .from("convites")
    .insert({ embarcacao_id: painel.embarcacao.id, permissoes: PRESETS[nivel], nivel })
    .select("codigo")
    .single()
  if (error?.message.includes("limite_acessos")) {
    erroTripulacao("As vagas de tripulação desta embarcação acabaram de ser preenchidas. Recarregue a página.")
  }
  if (error || !data) erroTripulacao("Não foi possível criar o convite. Tente de novo.")

  revalidatePath("/menu/tripulacao")
  redirect(`/menu/tripulacao?criado=${encodeURIComponent(data.codigo)}`)
}

export async function revogarConvite(formData: FormData) {
  const supabase = await supabaseServer()
  const id = String(formData.get("convite_id") ?? "")
  const { error } = await supabase.from("convites").delete().eq("id", id).is("usado_em", null)
  if (error) erroTripulacao("Não foi possível revogar.")
  revalidatePath("/menu/tripulacao")
  redirect("/menu/tripulacao")
}
