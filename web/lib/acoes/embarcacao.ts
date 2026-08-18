"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { carregarPainel } from "@/lib/consultas"
import { parseDecimalPtBr } from "@/lib/domain/numeros"
import { ehTipoEmbarcacao } from "@/lib/domain/tipo-embarcacao"
import { supabaseServer } from "@/lib/supabase/server"

function erroEditar(msg: string): never {
  redirect(`/barco/editar?erro=${encodeURIComponent(msg)}`)
}

export async function salvarDadosGerais(formData: FormData) {
  const supabase = await supabaseServer()
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (painel.papel !== "PROP") erroEditar("Só o proprietário edita os dados da embarcação.")

  const texto = (k: string) => String(formData.get(k) ?? "").trim() || null
  const nome = texto("nome")
  if (!nome) erroEditar("O barco precisa de um nome.")

  const medida = (k: string, rotulo: string) => {
    const bruto = texto(k)
    if (bruto === null) return null
    const n = parseDecimalPtBr(bruto)
    if (n === null || n <= 0) erroEditar(`Informe ${rotulo} em metros (ex.: 14,60).`)
    return n
  }
  const anoBruto = texto("ano")
  const ano = anoBruto === null ? null : parseDecimalPtBr(anoBruto)
  if (anoBruto !== null && (ano === null || ano < 1900 || ano > 2100)) {
    erroEditar("Informe um ano válido (ex.: 2016).")
  }

  // Tipo (onda 62) — enum `tipo_embarcacao` da migration 056. "Não informar"
  // (vazio) vira null de verdade — desfazer a escolha é permitido; valor fora
  // do enum também vira null (§27.2: validação no servidor, não só no banco).
  const tipoBruto = texto("tipo")
  const tipo = tipoBruto !== null && ehTipoEmbarcacao(tipoBruto) ? tipoBruto : null

  const { data: salva, error } = await supabase
    .from("embarcacoes")
    .update({
      nome,
      estaleiro: texto("estaleiro"),
      modelo: texto("modelo"),
      tipo,
      ano,
      marina: texto("marina"),
      // Região da base (onda 52) — item da `taxonomia`. Vazio vira null, que
      // significa "não informada": a segmentação de publicidade (§20) trata
      // isso como desconhecimento e não serve campanha regional nenhuma.
      regiao_id: texto("regiao_id"),
      comprimento_m: medida("comprimento_m", "o comprimento"),
      boca_m: medida("boca_m", "a boca"),
      calado_m: medida("calado_m", "o calado"),
      casco_material: texto("casco_material"),
      casco_numero: texto("casco_numero"),
      tie: texto("tie"),
      capitania: texto("capitania"),
      propulsao: texto("propulsao"),
    })
    .eq("id", painel.embarcacao.id)
    .select("id")
  // sem o select, uma linha barrada pela RLS voltaria com error null e a tela
  // diria "salvo" sem ter salvado nada
  if (error || !salva?.length) erroEditar("Não deu para salvar os dados do barco agora. Tente de novo em instantes.")

  revalidatePath("/barco")
  revalidatePath("/hoje")
  redirect(`/barco?ok=${encodeURIComponent("Dados da embarcação salvos")}`)
}
