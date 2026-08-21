"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { subirArquivo } from "@/lib/acervo"
import { carregarPainel } from "@/lib/consultas"
import { abaDoEquipamento } from "@/lib/domain/diario"
import { ZONAS } from "@/lib/domain/mapa-embarcacao"
import { parseDecimalPtBr } from "@/lib/domain/numeros"
import { ROTULO_ABA } from "@/lib/domain/permissoes"
import { supabaseServer } from "@/lib/supabase/server"

const TIPOS = ["motor", "gerador", "bateria", "painel", "outro"]
const POSICOES = ["BB", "BE", "central"]
const TIPOS_BATERIA = ["chumbo_acido", "agm", "gel", "litio", "outro"]

function erroNovo(msg: string): never {
  redirect(`/barco/equipamento/novo?erro=${encodeURIComponent(msg)}`)
}
function erroEditar(id: string, msg: string): never {
  redirect(`/barco/equipamento/${id}/editar?erro=${encodeURIComponent(msg)}`)
}

function camposDoForm(formData: FormData, falhar: (msg: string) => never) {
  const texto = (k: string) => String(formData.get(k) ?? "").trim() || null
  const tipo = String(formData.get("tipo") ?? "")
  if (!TIPOS.includes(tipo)) falhar("Escolha o tipo do equipamento.")
  const posicaoBruta = texto("posicao")
  const posicao = posicaoBruta && POSICOES.includes(posicaoBruta) ? posicaoBruta : null

  // Tipo de bateria (onda 41, PRD §14) só existe em baterias. Se a pessoa
  // escolheu "AGM" e depois trocou o tipo pra Gerador, o campo some da tela
  // mas continua no FormData — descartar aqui evita salvar um gerador AGM.
  const tipoBateriaBruto = texto("tipo_bateria")
  const tipo_bateria =
    tipo === "bateria" && tipoBateriaBruto && TIPOS_BATERIA.includes(tipoBateriaBruto)
      ? tipoBateriaBruto
      : null

  const inteiro = (k: string, rotulo: string) => {
    const bruto = texto(k)
    if (bruto === null) return null
    const n = parseDecimalPtBr(bruto)
    if (n === null || n < 0) falhar(`Informe ${rotulo} com números.`)
    return Math.round(n)
  }
  const horasBruto = texto("horas_atuais")
  const horas = horasBruto === null ? null : parseDecimalPtBr(horasBruto)
  if (horasBruto !== null && (horas === null || horas < 0)) falhar("Informe as horas com números.")

  // "Onde fica no barco" (onda 61, spec §4) — "ainda não sei" chega como
  // string vazia do select e vira null, igual à posição logo acima. Contra
  // um enum inválido no FormData (não deveria acontecer vindo do próprio
  // select, mas o servidor não confia em input de formulário) devolve erro
  // em vez de gravar lixo — mesma régua de `tipo`.
  const zonaBruta = texto("zona")
  if (zonaBruta !== null && !(ZONAS as readonly string[]).includes(zonaBruta)) falhar("Zona inválida.")
  const zona = zonaBruta

  return {
    tipo,
    posicao,
    zona,
    marca: texto("marca"),
    modelo: texto("modelo"),
    numero_serie: texto("numero_serie"),
    identificacao_interna: texto("identificacao_interna"),
    ano: inteiro("ano", "o ano"),
    potencia_hp: inteiro("potencia_hp", "a potência"),
    combustivel: texto("combustivel"),
    quantidade: inteiro("quantidade", "a quantidade"),
    tipo_bateria,
    horas_atuais: horas,
    observacoes: texto("observacoes"),
  }
}

/**
 * O vínculo com o catálogo de motor (onda 64, PRD 3D §16).
 *
 * Assíncrono e separado de `camposDoForm` porque ele CONFERE no banco: um id
 * inválido chegando pelo FormData bateria na foreign key e o erro genérico do
 * insert diria "pode ser que o proprietário não liberou seu acesso", que é
 * mentira. Melhor perguntar antes e falar a verdade.
 *
 * Duas regras, as duas com precedente no arquivo:
 *
 *   · Só motor tem modelo de motor. Se a pessoa escolheu um D6 e depois
 *     trocou o tipo pra Gerador, o campo some da tela mas continua no
 *     FormData — mesma armadilha do `tipo_bateria` logo acima, mesma cura.
 *
 *   · Vazio é `null` legítimo, não erro. Escolher do catálogo é opcional por
 *     decisão de produto (ver `SeletorModeloMotor`): quem tem motor fora do
 *     catálogo continua cadastrando por marca/modelo em texto livre.
 */
async function modeloDeMotorDoForm(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  formData: FormData,
  tipo: string,
  falhar: (msg: string) => never,
): Promise<string | null> {
  const id = String(formData.get("motor_modelo_id") ?? "").trim()
  if (!id || tipo !== "motor") return null
  const { data } = await supabase.from("motor_modelos").select("id").eq("id", id).maybeSingle()
  if (!data) falhar("Esse motor saiu do catálogo. Escolha outro ou preencha Marca e Modelo.")
  return data.id
}

/** Mesma validação de MIME do avatar (`lib/acoes/perfil.ts`) — sem arquivo, devolve null sem tocar no foto_path atual. */
async function fotoDoForm(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  embarcacaoId: string,
  formData: FormData,
  falhar: (msg: string) => never,
): Promise<string | null> {
  const foto = formData.get("foto")
  if (!(foto instanceof File) || foto.size === 0) return null
  if (!["image/jpeg", "image/png", "image/webp"].includes(foto.type)) falhar("Use JPG, PNG ou WebP.")
  const r = await subirArquivo(supabase, embarcacaoId, "fotos", foto)
  if ("erro" in r) falhar(r.erro)
  return r.path
}

export async function criarEquipamento(formData: FormData) {
  const supabase = await supabaseServer()
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const dados = camposDoForm(formData, erroNovo)
  const motorModeloId = await modeloDeMotorDoForm(supabase, formData, dados.tipo, erroNovo)
  const fotoPath = await fotoDoForm(supabase, painel.embarcacao.id, formData, erroNovo)

  const { data, error } = await supabase
    .from("equipamentos")
    .insert({
      embarcacao_id: painel.embarcacao.id,
      ...dados,
      motor_modelo_id: motorModeloId,
      ...(fotoPath ? { foto_path: fotoPath } : {}),
      ultima_leitura: dados.horas_atuais != null ? new Date().toISOString() : null,
    })
    .select("id, tipo")
    .single()
  if (error || !data) {
    if (fotoPath) await supabase.storage.from("acervo").remove([fotoPath])
    erroNovo(
      `Não deu para salvar. Se for comandante, pode ser que o proprietário não liberou seu acesso a ${ROTULO_ABA[abaDoEquipamento(dados.tipo)]} — senão, tente de novo.`,
    )
  }

  revalidatePath("/barco")
  revalidatePath("/barco/eletrica")
  revalidatePath("/hoje")
  redirect(
    data.tipo === "motor"
      ? `/barco/equipamento/${data.id}?ok=${encodeURIComponent("Equipamento criado")}`
      : `/barco/eletrica?ok=${encodeURIComponent("Equipamento criado")}`,
  )
}

export async function salvarEquipamento(formData: FormData) {
  const supabase = await supabaseServer()
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const id = String(formData.get("equipamento_id") ?? "")
  const atual = painel.equipamentos.find((e) => e.id === id)
  if (!atual) erroEditar(id, "Equipamento não encontrado.")
  const dados = camposDoForm(formData, (msg) => erroEditar(id, msg))
  const motorModeloId = await modeloDeMotorDoForm(supabase, formData, dados.tipo, (msg) => erroEditar(id, msg))
  const fotoPath = await fotoDoForm(supabase, painel.embarcacao.id, formData, (msg) => erroEditar(id, msg))

  const { data, error } = await supabase
    .from("equipamentos")
    .update({ ...dados, motor_modelo_id: motorModeloId, ...(fotoPath ? { foto_path: fotoPath } : {}) })
    .eq("id", id).select("id").maybeSingle()
  if (error || !data) {
    if (fotoPath) await supabase.storage.from("acervo").remove([fotoPath])
    erroEditar(
      id,
      `Não deu para salvar. Se for comandante, pode ser que o proprietário não liberou seu acesso a ${ROTULO_ABA[abaDoEquipamento(dados.tipo)]} — senão, tente de novo.`,
    )
  }

  // troca de foto: só apaga a antiga do storage depois de confirmar que o update deu certo
  if (fotoPath && atual.foto_path) {
    await supabase.storage.from("acervo").remove([atual.foto_path])
  }

  revalidatePath("/barco")
  revalidatePath("/barco/eletrica")
  revalidatePath(`/barco/equipamento/${id}`)
  redirect(`/barco/equipamento/${id}?ok=${encodeURIComponent("Equipamento salvo")}`)
}

/**
 * ONDA 146 — o "Remover" do palco da ficha (imagem 12 do guia).
 *
 * A foto real SEMPRE teve caminho de entrada (o upload da onda 15, via
 * formulário de editar) e caminho de TROCA (subir outra por cima), mas
 * nenhum de saída: quem subiu a foto errada só podia substituí-la. O palco
 * novo mostra a pílula "Remover" ao lado de "Trocar foto", e ela precisa de
 * uma action que devolva o equipamento ao estado "sem foto" — que volta a
 * mostrar o render do hub, nunca um retângulo vazio.
 *
 * Mesma coreografia do resto do arquivo: o update com `.select()` confirma
 * que a linha realmente mudou (RLS recusa em silêncio), o arquivo do
 * storage só sai DEPOIS da confirmação (best-effort: arquivo órfão é
 * aceitável, linha apontando pra arquivo apagado não é), e o retorno fala
 * a verdade nos dois desfechos.
 */
export async function removerFotoEquipamento(formData: FormData) {
  const supabase = await supabaseServer()
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const id = String(formData.get("equipamento_id") ?? "")
  const equipamento = painel.equipamentos.find((e) => e.id === id)
  if (!equipamento) erroEditar(id, "Equipamento não encontrado.")
  const fotoAtual = equipamento.foto_path
  // Sem foto não há o que remover — dois toques seguidos no mesmo botão (ou
  // uma aba antiga aberta) voltam pra ficha sem inventar erro.
  if (!fotoAtual) redirect(`/barco/equipamento/${id}`)

  const { data, error } = await supabase
    .from("equipamentos").update({ foto_path: null }).eq("id", id).select("id").maybeSingle()
  if (error || !data) {
    redirect(
      `/barco/equipamento/${id}?erro=${encodeURIComponent(
        `Não deu para remover a foto. Se for comandante, pode ser que o proprietário não liberou seu acesso a ${ROTULO_ABA[abaDoEquipamento(equipamento.tipo)]} — senão, tente de novo.`,
      )}`,
    )
  }

  await supabase.storage.from("acervo").remove([fotoAtual])

  revalidatePath("/barco")
  revalidatePath("/barco/eletrica")
  revalidatePath(`/barco/equipamento/${id}`)
  redirect(`/barco/equipamento/${id}?ok=${encodeURIComponent("Foto removida")}`)
}

export async function excluirEquipamento(formData: FormData) {
  const supabase = await supabaseServer()
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const id = String(formData.get("equipamento_id") ?? "")
  const equipamento = painel.equipamentos.find((e) => e.id === id)
  if (!equipamento) erroEditar(id, "Equipamento não encontrado.")

  // o select confirma que a linha saiu: sem ele, uma exclusão barrada pelo
  // acesso voltaria sem erro e o app anunciaria "excluído" à toa
  const { data: apagado, error } = await supabase
    .from("equipamentos").delete().eq("id", id).select("id")
  if (error || !apagado?.length) {
    erroEditar(
      id,
      `Não deu para excluir. Se for comandante, pode ser que o proprietário não liberou seu acesso a ${ROTULO_ABA[abaDoEquipamento(equipamento.tipo)]} — senão, tente de novo.`,
    )
  }

  if (equipamento.foto_path) {
    // best-effort: arquivo órfão é aceitável; linha fantasma não.
    await supabase.storage.from("acervo").remove([equipamento.foto_path])
  }

  revalidatePath("/barco")
  revalidatePath("/barco/eletrica")
  revalidatePath("/hoje")
  redirect(
    equipamento.tipo === "motor"
      ? `/barco?ok=${encodeURIComponent("Equipamento excluído")}`
      : `/barco/eletrica?ok=${encodeURIComponent("Equipamento excluído")}`,
  )
}
