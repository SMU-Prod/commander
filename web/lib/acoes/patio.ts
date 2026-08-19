"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { carregarPainel } from "@/lib/consultas"
import { parseDecimalPtBr } from "@/lib/domain/numeros"
import { retornoViraAvaria } from "@/lib/domain/patio"
import { supabaseServer } from "@/lib/supabase/server"

/**
 * CHECK-OUT E CHECK-IN (onda 70b, PRD-UPGRADE-3-COTAS §6).
 *
 * A régua que o §6 impõe às duas actions: *"home de campo rápida, botões
 * grandes e poucos passos"*. Quase nada é obrigatório — quem está com o Jet
 * na rampa anota o que dá, e o domínio (`lib/domain/patio.ts`) devolve `null`
 * no que faltar em vez de inventar número.
 */

function erro(msg: string): never {
  redirect(`/patio?erro=${encodeURIComponent(msg)}`)
}

/** Número opcional em pt-BR. Vazio é `null` legítimo; texto que não é número
 *  é erro, porque gravar `null` calado esconderia a digitação errada. */
function numeroOpcional(formData: FormData, chave: string, rotulo: string): number | null {
  const bruto = String(formData.get(chave) ?? "").trim()
  if (!bruto) return null
  const n = parseDecimalPtBr(bruto)
  if (n === null || n < 0) erro(`Informe ${rotulo} com números.`)
  return n
}

function percentualOpcional(formData: FormData, chave: string): number | null {
  const n = numeroOpcional(formData, chave, "o combustível")
  if (n === null) return null
  if (n > 100) erro("O combustível vai de 0 a 100%.")
  return Math.round(n)
}

const texto = (formData: FormData, k: string) => String(formData.get(k) ?? "").trim() || null

export async function registrarSaida(formData: FormData) {
  const supabase = await supabaseServer()
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase.from("movimentos_patio").insert({
    embarcacao_id: painel.embarcacao.id,
    responsavel_id: user?.id ?? null,
    saida_horas: numeroOpcional(formData, "saida_horas", "as horas"),
    saida_combustivel_pct: percentualOpcional(formData, "saida_combustivel_pct"),
    saida_estado: texto(formData, "saida_estado"),
  })

  // O índice único parcial (migration 060) impede duas saídas abertas na
  // mesma unidade. Quando ele dispara, a mensagem tem que explicar o que
  // aconteceu — "erro ao salvar" faria a pessoa tentar de novo pra sempre.
  if (error) {
    erro(
      error.code === "23505"
        ? "Esta unidade já está fora. Registre o retorno antes de uma nova saída."
        : "Não deu pra registrar a saída. Se você não tem acesso ao Diário deste barco, fale com o proprietário.",
    )
  }

  revalidatePath("/patio")
  redirect(`/patio?ok=${encodeURIComponent("Saída registrada")}`)
}

export async function registrarRetorno(formData: FormData) {
  const supabase = await supabaseServer()
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const { data: { user } } = await supabase.auth.getUser()

  const id = String(formData.get("movimento_id") ?? "")
  if (!id) erro("Não encontramos essa saída. Atualize a página.")

  const retornoHoras = numeroOpcional(formData, "retorno_horas", "as horas")
  const estado = texto(formData, "retorno_estado")

  // §6: "Se houver problema no retorno, permitir transformar imediatamente
  // em avaria." Quem decide é a MARCAÇÃO da pessoa, nunca uma dedução do
  // app — ver `retornoViraAvaria`, com teste.
  const houveProblema = formData.get("houve_problema") === "on"
  const avaria = retornoViraAvaria(houveProblema, estado)

  let ocorrenciaId: string | null = null
  if (avaria) {
    const { data: criada } = await supabase.from("ocorrencias").insert({
      embarcacao_id: painel.embarcacao.id,
      aba: "motores",
      titulo: avaria.titulo,
      descricao: avaria.descricao,
      estado: "aberta",
      criado_por: user?.id ?? null,
    }).select("id").maybeSingle()
    ocorrenciaId = criada?.id ?? null
  }

  const { data, error } = await supabase
    .from("movimentos_patio")
    .update({
      retorno_em: new Date().toISOString(),
      retorno_horas: retornoHoras,
      retorno_combustivel_pct: percentualOpcional(formData, "retorno_combustivel_pct"),
      retorno_estado: estado,
      retorno_responsavel_id: user?.id ?? null,
      ocorrencia_id: ocorrenciaId,
    })
    .eq("id", id)
    // `is null` no retorno: sem isso, dois toques no botão de check-in
    // sobrescreveriam o retorno já gravado com um horário novo.
    .is("retorno_em", null)
    .select("id")

  // A constraint do banco recusa horímetro andando pra trás. É a única
  // validação que precisa virar frase: as outras são opcionais.
  if (error || !data?.length) {
    erro(
      error?.code === "23514"
        ? "As horas do retorno não podem ser menores que as da saída. Confira o horímetro."
        : "Não deu pra registrar o retorno. Atualize a página e tente de novo.",
    )
  }

  revalidatePath("/patio")
  revalidatePath("/barco/ocorrencias")
  redirect(
    `/patio?ok=${encodeURIComponent(avaria ? "Retorno registrado e ocorrência aberta" : "Retorno registrado")}`,
  )
}
