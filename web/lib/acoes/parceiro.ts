"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { parseDecimalPtBr } from "@/lib/domain/numeros"
import { supabaseServer } from "@/lib/supabase/server"
import { ehCorParceiroValida, ehIconeParceiroValido } from "@/lib/mapa/pino-parceiro"
import type { CategoriaParceiro } from "@/lib/db/types"

const CATEGORIAS: CategoriaParceiro[] = [
  "marina", "posto", "pousada", "restaurante", "loja_nautica", "outros",
]
const MIME_AUTORIZADOS = ["image/jpeg", "image/png", "image/webp"]
const MAX_FOTOS = 3

function erroParceiro(msg: string): never {
  redirect(`/parceiro?erro=${encodeURIComponent(msg)}`)
}

function ok(msg: string): never {
  redirect(`/parceiro?ok=${encodeURIComponent(msg)}`)
}

/** Traduz o erro do trigger de 1 atualização de preço/disponibilidade por dia (migration 020/021). */
function traduzErro(mensagem: string): string {
  if (mensagem.includes("limite de 1 atualizacao")) {
    return "O preço só pode ser atualizado uma vez por dia."
  }
  return "Não foi possível salvar. Tente de novo."
}

function precoCentavos(bruto: string | null, rotulo: string): number | null {
  if (bruto === null || bruto.trim() === "") return null
  const reais = parseDecimalPtBr(bruto)
  if (reais === null || reais <= 0) erroParceiro(`Informe ${rotulo} em reais (ex.: 120,00).`)
  return Math.round(reais * 100)
}

export async function salvarParceiro(formData: FormData) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login?volta=/parceiro")

  const texto = (k: string) => String(formData.get(k) ?? "").trim() || null

  const categoria = String(formData.get("categoria") ?? "") as CategoriaParceiro
  if (!CATEGORIAS.includes(categoria)) erroParceiro("Escolha uma categoria.")

  const nome = texto("nome")
  if (!nome || nome.length < 3) erroParceiro("O nome precisa de pelo menos 3 letras.")

  // Ícone/cor do pino (onda 10, Pedido 2) — paleta curada, nunca livre; o
  // formulário só manda hidden inputs vindos de EscolherPinoParceiro, mas
  // valida de novo aqui (nunca confia só no que o cliente mandou — o mesmo
  // CHECK existe no banco, migration 024, como segunda trava).
  const icone = texto("icone")
  if (!ehIconeParceiroValido(icone)) erroParceiro("Escolha um ícone válido pro pino.")
  const cor = texto("cor")
  if (!ehCorParceiroValida(cor)) erroParceiro("Escolha uma cor válida pro pino.")

  const latBruto = texto("lat")
  const lngBruto = texto("lng")
  const lat = latBruto === null ? NaN : Number(latBruto.replace(",", "."))
  const lng = lngBruto === null ? NaN : Number(lngBruto.replace(",", "."))
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) erroParceiro("Latitude inválida — confira as coordenadas.")
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) erroParceiro("Longitude inválida — confira as coordenadas.")

  const precoDiaria = precoCentavos(texto("preco_diaria"), "o preço da diária")
  const precoDiesel = categoria === "posto" ? precoCentavos(texto("preco_diesel"), "o preço do diesel") : null

  const caladoAplica = categoria === "pousada" || categoria === "restaurante"
  const caladoBruto = texto("calado_max_m")
  let caladoMax: number | null = null
  if (caladoAplica && caladoBruto) {
    caladoMax = parseDecimalPtBr(caladoBruto)
    if (caladoMax === null || caladoMax <= 0) erroParceiro("Informe o calado máximo em metros (ex.: 1,80).")
  }

  const temPoita = formData.get("tem_poita") === "on"
  const qtdPoitaBruto = texto("qtd_poitas")
  let qtdPoitas: number | null = null
  if (temPoita && qtdPoitaBruto) {
    const n = Number(qtdPoitaBruto)
    if (!Number.isInteger(n) || n < 0) erroParceiro("Informe quantas poitas em número inteiro.")
    qtdPoitas = n
  }

  const dados = {
    categoria,
    nome,
    icone,
    cor,
    sobre: texto("sobre"),
    telefone: texto("telefone"),
    email: texto("email"),
    horario: texto("horario"),
    lat,
    lng,
    preco_diaria_centavos: precoDiaria,
    preco_diesel_centavos: precoDiesel,
    calado_max_m: caladoMax,
    tem_poita: temPoita,
    qtd_poitas: qtdPoitas,
    traslado_incluso: categoria === "pousada" ? formData.get("traslado_incluso") === "on" : null,
    vaga_cortesia: categoria === "restaurante" ? formData.get("vaga_cortesia") === "on" : null,
    culinaria: categoria === "restaurante" ? texto("culinaria") : null,
    visivel: formData.get("visivel") === "on",
  }

  const { data: existente } = await supabase
    .from("parceiros").select("id").eq("usuario_id", user.id).maybeSingle()

  if (existente) {
    const { data: salvo, error } = await supabase
      .from("parceiros")
      .update(dados)
      .eq("id", existente.id)
      .select("id")
    if (error) erroParceiro(traduzErro(error.message))
    // sem o select, uma linha barrada pela RLS voltaria com error null e a
    // tela diria "salvo" sem ter salvado nada
    if (!salvo?.length) erroParceiro("Não deu para salvar seu perfil de parceiro. Tente de novo em instantes.")
  } else {
    // plano/visualizacoes/precos_atualizados_em ficam de fora: privilégio de
    // coluna barra escrita e a policy de insert exige os defaults
    const { data: salvo, error } = await supabase
      .from("parceiros")
      .insert({ ...dados, usuario_id: user.id })
      .select("id")
    if (error) erroParceiro("Não foi possível criar seu perfil de parceiro. Tente de novo.")
    if (!salvo?.length) erroParceiro("Não foi possível criar seu perfil de parceiro. Tente de novo.")
  }

  revalidatePath("/parceiro")
  ok("Perfil salvo")
}

export async function subirFotoParceiro(formData: FormData) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login?volta=/parceiro")

  const { data: parceiro, error: erroBusca } = await supabase
    .from("parceiros").select("id, fotos").eq("usuario_id", user.id).maybeSingle()
  if (erroBusca || !parceiro) erroParceiro("Cadastre seu perfil antes de enviar fotos.")

  const fotosAtuais = parceiro.fotos ?? []
  if (fotosAtuais.length >= MAX_FOTOS) erroParceiro("Máximo de 3 fotos. Exclua uma para enviar outra.")

  const arquivo = formData.get("foto")
  if (!(arquivo instanceof File) || arquivo.size === 0) erroParceiro("Escolha uma foto.")
  if (!MIME_AUTORIZADOS.includes(arquivo.type)) erroParceiro("Use JPG, PNG ou WebP.")

  const ext = arquivo.type === "image/png" ? "png" : arquivo.type === "image/webp" ? "webp" : "jpg"
  // pasta = <usuario_id>, exigida pela policy de storage (subir só na própria pasta)
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`
  const { error: erroUpload } = await supabase.storage.from("parceiros").upload(path, arquivo)
  if (erroUpload) erroParceiro("Falha ao enviar a foto. Tente de novo.")

  const { data: salvo, error } = await supabase
    .from("parceiros")
    .update({ fotos: [...fotosAtuais, path] })
    .eq("id", parceiro.id)
    .select("id")
  if (error || !salvo?.length) {
    await supabase.storage.from("parceiros").remove([path])
    erroParceiro("Não foi possível salvar a foto. Tente de novo.")
  }

  revalidatePath("/parceiro")
  ok("Foto enviada")
}

export async function excluirFotoParceiro(formData: FormData) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login?volta=/parceiro")

  const path = String(formData.get("path") ?? "")
  if (!path) erroParceiro("Foto não encontrada.")

  const { data: parceiro, error: erroBusca } = await supabase
    .from("parceiros").select("id, fotos").eq("usuario_id", user.id).maybeSingle()
  if (erroBusca || !parceiro) erroParceiro("Perfil de parceiro não encontrado.")
  if (!(parceiro.fotos ?? []).includes(path)) erroParceiro("Foto não encontrada.")

  const restantes = (parceiro.fotos ?? []).filter((f: string) => f !== path)
  const { data: salvo, error } = await supabase
    .from("parceiros")
    .update({ fotos: restantes })
    .eq("id", parceiro.id)
    .select("id")
  if (error || !salvo?.length) erroParceiro("Não foi possível excluir a foto.")

  await supabase.storage.from("parceiros").remove([path])

  revalidatePath("/parceiro")
  ok("Foto excluída")
}
