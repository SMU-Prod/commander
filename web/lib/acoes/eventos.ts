"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { subirArquivo } from "@/lib/acervo"
import { carregarPainel, hojeISO } from "@/lib/consultas"
import { zerarCiclo } from "@/lib/domain/diario"
import { parseDecimalPtBr } from "@/lib/domain/numeros"
import { supabaseServer } from "@/lib/supabase/server"

function erroNovo(msg: string): never {
  redirect(`/diario/novo?erro=${encodeURIComponent(msg)}`)
}

export async function criarEvento(formData: FormData) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")

  const texto = (k: string) => {
    const v = String(formData.get(k) ?? "").trim()
    return v === "" ? null : v
  }
  const tipo = texto("tipo") ?? "manutencao"
  const data = texto("data") ?? hojeISO()
  const alvo = texto("alvo")
  const equipamentoId = alvo?.startsWith("eq:") ? alvo.slice(3) : null
  const categoria = alvo?.startsWith("cat:") ? alvo.slice(4) : null
  if (equipamentoId && !painel.equipamentos.some((e) => e.id === equipamentoId)) {
    erroNovo("Equipamento inválido.")
  }

  const custoBruto = texto("custo")
  let custoCentavos: number | null = null
  if (custoBruto != null) {
    const reais = parseDecimalPtBr(custoBruto)
    if (reais === null || reais < 0) erroNovo("Informe um custo válido (ex.: 1.850,00).")
    custoCentavos = Math.round(reais * 100)
  }

  const horasBruto = texto("horas")
  const horas = horasBruto != null ? parseDecimalPtBr(horasBruto) : null
  if (horasBruto != null && (horas === null || horas < 0)) erroNovo("Informe horas válidas.")

  const itemId = texto("item_id")
  const item = itemId ? (painel.itens.find((i) => i.id === itemId) ?? null) : null
  if (itemId && !item) erroNovo("Item monitorado inválido.")

  const contatoId = texto("contato_id")
  if (contatoId) {
    const { data: contato } = await supabase.from("contatos")
      .select("id").eq("id", contatoId).eq("embarcacao_id", painel.embarcacao.id).maybeSingle()
    if (!contato) erroNovo("Contato inválido.")
  }

  let anexoPath: string | null = null
  const anexo = formData.get("anexo")
  if (anexo instanceof File && anexo.size > 0) {
    const r = await subirArquivo(supabase, painel.embarcacao.id, "eventos", anexo)
    if ("erro" in r) erroNovo(r.erro)
    else anexoPath = r.path
  }
  const { error } = await supabase.from("eventos").insert({
    embarcacao_id: painel.embarcacao.id,
    equipamento_id: equipamentoId,
    item_monitorado_id: item?.id ?? null,
    contato_id: contatoId,
    tipo,
    categoria,
    data,
    horas_no_momento: horas,
    descricao: texto("descricao"),
    custo_centavos: custoCentavos,
    anexo_path: anexoPath,
    criado_por: user.id,
  })
  if (error) {
    if (anexoPath) await supabase.storage.from("acervo").remove([anexoPath])
    erroNovo("Não foi possível salvar o evento. Tente de novo.")
  }

  if (item) {
    const eq = painel.equipamentos.find((e) => e.id === item.equipamento_id)
    const atualizacao = zerarCiclo(item, { data, horas: horas ?? eq?.horas_atuais ?? null })
    const { error: erroItem } = await supabase
      .from("itens_monitorados").update(atualizacao).eq("id", item.id)
    if (erroItem) {
      revalidatePath("/diario")
      redirect(`/diario?erro=${encodeURIComponent("Evento salvo, mas o ciclo do item não foi zerado. Confira o item.")}`)
    }
  }

  revalidatePath("/diario")
  revalidatePath("/barco")
  revalidatePath("/hoje")
  redirect("/diario")
}
