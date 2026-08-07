"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { carregarPainel, hojeISO } from "@/lib/consultas"
import { validarNovoItem } from "@/lib/domain/diario"
import { parseDecimalPtBr } from "@/lib/domain/numeros"
import { supabaseServer } from "@/lib/supabase/server"

function erroNovo(msg: string): never {
  redirect(`/barco/itens/novo?erro=${encodeURIComponent(msg)}`)
}

export async function criarItemMonitorado(formData: FormData) {
  const supabase = await supabaseServer()
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")

  const texto = (k: string) => String(formData.get(k) ?? "").trim() || null
  const nome = texto("nome")
  if (!nome) erroNovo("Dê um nome ao item.")
  const especificacao = texto("especificacao")
  const quantidade = texto("quantidade")

  const alvo = texto("alvo") ?? "emb"
  const equipamentoId = alvo.startsWith("eq:") ? alvo.slice(3) : null
  const categoria = alvo.startsWith("cat:") ? alvo.slice(4) : null

  const numero = (k: string, msg: string) => {
    const v = texto(k)
    if (v === null) return null
    const n = parseDecimalPtBr(v)
    if (n === null) erroNovo(msg)
    return n
  }
  const intervaloHoras = numero("intervalo_horas", "Informe um intervalo de horas válido.")
  const intervaloMeses = numero("intervalo_meses", "Informe um intervalo de meses válido.")
  const dataFixa = texto("data_fixa")

  const v = validarNovoItem({ intervaloHoras, intervaloMeses, dataFixa })
  if (!v.ok) erroNovo(v.erro)

  const { error } = await supabase.from("itens_monitorados").insert({
    embarcacao_id: painel.embarcacao.id,
    equipamento_id: equipamentoId,
    categoria,
    nome,
    especificacao,
    quantidade,
    intervalo_horas: intervaloHoras,
    intervalo_meses: intervaloMeses,
    data_fixa: dataFixa,
    ultimo_ciclo_data: texto("ultimo_ciclo_data") ?? hojeISO(),
    ultimo_ciclo_horas: numero("ultimo_ciclo_horas", "Informe horas válidas no último serviço."),
  })
  if (error) erroNovo("Não foi possível criar o item. Tente de novo.")

  revalidatePath("/barco")
  revalidatePath("/hoje")
  redirect("/barco")
}
