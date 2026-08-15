"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { parseDecimalPtBr } from "@/lib/domain/numeros"
import {
  atividadesValidas,
  perfilTem,
  TIPOS_PARTNER,
  TIPOS_VAGA_MARINA,
  taxonomiasDoPartner,
  type TipoPartner,
} from "@/lib/domain/partner"
import { supabaseServer } from "@/lib/supabase/server"
import { ehCorParceiroValida, ehIconeParceiroValido } from "@/lib/mapa/pino-parceiro"
import type { ItemTaxonomiaDb } from "@/lib/db/types"

/**
 * Ações do Commander Partner (onda 51 — PRD §13).
 *
 * Duas regras que valem pro arquivo inteiro:
 *
 * 1. NADA de decisão de produto aqui. Que campos existem, que toggles o tipo
 *    pode ligar e que taxonomia ele declara vem de `lib/domain/partner.ts`,
 *    que é puro e testado. Esta camada valida entrada e escreve.
 *
 * 2. O formulário NUNCA é fonte de autoridade. Um toggle que o tipo não pode
 *    ativar volta `false` mesmo que venha marcado no POST (`atividadesValidas`),
 *    e uma atividade de taxonomia que o tipo não declara é descartada antes do
 *    insert. A tela esconder o campo é conveniência; a trava é aqui — e a
 *    terceira é o banco (CHECK + FK composta da migration 052).
 */

const MIME_AUTORIZADOS = ["image/jpeg", "image/png", "image/webp"]
const MAX_FOTOS = 3
/** §13.5 — cardápio é galeria de páginas; o teto espelha o CHECK da 052. */
const MAX_FOTOS_CARDAPIO = 12

function erroParceiro(msg: string): never {
  redirect(`/parceiro/perfil?erro=${encodeURIComponent(msg)}`)
}

function ok(msg: string): never {
  redirect(`/parceiro/perfil?ok=${encodeURIComponent(msg)}`)
}

/** Traduz o erro do trigger de 1 atualização de preço por dia (migration 020). */
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

function inteiroOuNulo(bruto: string | null, rotulo: string): number | null {
  if (bruto === null || bruto.trim() === "") return null
  const n = Number(bruto)
  if (!Number.isInteger(n) || n < 0) erroParceiro(`Informe ${rotulo} em número inteiro.`)
  return n
}

/** "HH:MM" do input type=time → o `time` do Postgres. Vazio vira null. */
function horaOuNula(bruto: string | null): string | null {
  if (bruto === null || bruto.trim() === "") return null
  if (!/^\d{2}:\d{2}$/.test(bruto)) erroParceiro("Informe o horário no formato 00:00.")
  return `${bruto}:00`
}

export async function salvarParceiro(formData: FormData) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login?volta=/parceiro/perfil")

  const texto = (k: string) => String(formData.get(k) ?? "").trim() || null
  const ligado = (k: string) => formData.get(k) === "on"

  const categoria = String(formData.get("categoria") ?? "") as TipoPartner
  if (!(TIPOS_PARTNER as readonly string[]).includes(categoria)) erroParceiro("Escolha o tipo do seu negócio.")

  const nome = texto("nome")
  if (!nome || nome.length < 3) erroParceiro("O nome precisa de pelo menos 3 letras.")

  // §10 — região sai da taxonomia, nunca de texto digitado. Confere contra o
  // banco: um uuid qualquer no POST não pode virar "região" do parceiro.
  const regiaoId = texto("regiao_id")
  if (!regiaoId) erroParceiro("Escolha a região onde você atua.")
  const { data: regiao } = await supabase
    .from("taxonomia").select("id").eq("id", regiaoId).eq("tipo", "regiao").eq("ativo", true).maybeSingle()
  if (!regiao) erroParceiro("Região inválida — escolha uma da lista.")

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

  // §13.1/§13.2 — o toggle que o tipo não pode ligar volta false, sempre.
  const atividadesLigadas = atividadesValidas(categoria, {
    tambem_vende_produtos: ligado("tambem_vende_produtos"),
    tambem_presta_servicos: ligado("tambem_presta_servicos"),
  })

  const caladoAplica = perfilTem(categoria, "calado")
  const caladoBruto = texto("calado_max_m")
  let caladoMax: number | null = null
  if (caladoAplica && caladoBruto) {
    caladoMax = parseDecimalPtBr(caladoBruto)
    if (caladoMax === null || caladoMax <= 0) erroParceiro("Informe o calado máximo em metros (ex.: 1,80).")
  }

  const temPoita = perfilTem(categoria, "poita") && ligado("tem_poita")
  const qtdPoitas = temPoita ? inteiroOuNulo(texto("qtd_poitas"), "quantas poitas") : null

  const dados: Record<string, unknown> = {
    categoria,
    nome,
    icone,
    cor,
    regiao_id: regiaoId,
    sobre: texto("sobre"),
    telefone: texto("telefone"),
    email: texto("email"),
    horario: texto("horario"),
    lat,
    lng,
    tambem_vende_produtos: atividadesLigadas.tambem_vende_produtos,
    tambem_presta_servicos: atividadesLigadas.tambem_presta_servicos,
    // Blocos por tipo: quem não tem o bloco grava `null`, pra não sobrar
    // dado de um tipo antigo depois de o parceiro corrigir o cadastro.
    acesso_nautico: perfilTem(categoria, "acesso_nautico") ? texto("acesso_nautico") : null,
    estrutura: perfilTem(categoria, "estrutura") ? texto("estrutura") : null,
    atracacao: perfilTem(categoria, "atracacao") ? texto("atracacao") : null,
    tem_combustivel: categoria === "marina" && ligado("tem_combustivel"),
    check_in: perfilTem(categoria, "check_in_out") ? horaOuNula(texto("check_in")) : null,
    check_out: perfilTem(categoria, "check_in_out") ? horaOuNula(texto("check_out")) : null,
    calado_max_m: caladoMax,
    tem_poita: temPoita,
    qtd_poitas: qtdPoitas,
    traslado_incluso: perfilTem(categoria, "traslado") ? ligado("traslado_incluso") : null,
    vaga_cortesia: perfilTem(categoria, "restaurante_extra") ? ligado("vaga_cortesia") : null,
    culinaria: perfilTem(categoria, "restaurante_extra") ? texto("culinaria") : null,
    visivel: ligado("visivel"),
  }

  // Preço só entra no update quando o formulário DE VERDADE tinha o campo —
  // senão o trigger de "1 atualização por dia" (020) dispararia à toa e, pior,
  // o valor de um tipo antigo seria apagado por omissão.
  if (formData.has("preco_diesel")) {
    dados.preco_diesel_centavos = precoCentavos(texto("preco_diesel"), "o preço do combustível")
  }

  const { data: existente } = await supabase
    .from("parceiros").select("id").eq("usuario_id", user.id).maybeSingle()

  let parceiroId: string
  if (existente) {
    const { data: salvo, error } = await supabase
      .from("parceiros").update(dados).eq("id", existente.id).select("id")
    if (error) erroParceiro(traduzErro(error.message))
    // sem o select, uma linha barrada pela RLS voltaria com error null e a
    // tela diria "salvo" sem ter salvado nada
    if (!salvo?.length) erroParceiro("Não deu para salvar seu perfil de parceiro. Tente de novo em instantes.")
    parceiroId = existente.id
  } else {
    // plano/visualizacoes/precos_atualizados_em ficam de fora: privilégio de
    // coluna barra escrita e a policy de insert exige os defaults
    const { data: salvo, error } = await supabase
      .from("parceiros").insert({ ...dados, usuario_id: user.id }).select("id")
    if (error || !salvo?.length) erroParceiro("Não foi possível criar seu perfil de parceiro. Tente de novo.")
    parceiroId = salvo[0].id as string
  }

  await salvarAtividades(supabase, parceiroId, categoria, atividadesLigadas, formData)
  if (perfilTem(categoria, "vagas")) await salvarVagas(supabase, parceiroId, formData)
  else await supabase.from("parceiro_vagas").delete().eq("parceiro_id", parceiroId)

  revalidatePath("/parceiro")
  revalidatePath("/parceiro/perfil")
  revalidatePath("/explorar")
  ok("Perfil salvo")
}

type Cliente = Awaited<ReturnType<typeof supabaseServer>>

/**
 * Substitui o conjunto de atividades declaradas. Apaga e reinsere em vez de
 * calcular diferença: são poucas linhas, a chave é composta e o resultado é
 * idempotente — um diff daria três caminhos de erro pra ganhar nada.
 *
 * Os ids passam por dois filtros antes de entrar: têm que existir na
 * taxonomia ATIVA e ser de um tipo que ESTE tipo de Partner declara
 * (`taxonomiasDoPartner`). Sem isso, uma Marina poderia declarar marcas por
 * POST forjado, e o filtro do Explorar passaria a mentir.
 */
async function salvarAtividades(
  supabase: Cliente,
  parceiroId: string,
  categoria: TipoPartner,
  atividadesLigadas: { tambem_vende_produtos: boolean; tambem_presta_servicos: boolean },
  formData: FormData,
) {
  const tiposPermitidos = taxonomiasDoPartner({ categoria, ...atividadesLigadas })
  await supabase.from("parceiro_atividades").delete().eq("parceiro_id", parceiroId)
  if (tiposPermitidos.length === 0) return

  const pedidos = formData.getAll("atividade").map(String).filter(Boolean)
  if (pedidos.length === 0) return

  const { data: itens } = await supabase
    .from("taxonomia").select("id, tipo").in("id", pedidos).eq("ativo", true)
  const validos = ((itens as Pick<ItemTaxonomiaDb, "id" | "tipo">[] | null) ?? [])
    .filter((i) => (tiposPermitidos as readonly string[]).includes(i.tipo))
  if (validos.length === 0) return

  await supabase
    .from("parceiro_atividades")
    .insert(validos.map((i) => ({ parceiro_id: parceiroId, taxonomia_id: i.id, tipo: i.tipo })))
}

/**
 * §13.3 — as duas linhas de vaga da Marina. Linha sem nenhum dado é apagada
 * em vez de gravada vazia: "Vaga seca — — de —" não informa nada e ainda
 * ocuparia espaço na vitrine.
 *
 * Não há limite de 1 atualização por dia aqui, ao contrário do preço: §13.3
 * quer a disponibilidade o mais fresca possível ("declarada pela Marina"), e
 * o trigger `parceiro_vagas_carimbo` grava QUANDO ela declarou pra tela poder
 * mostrar a idade do número.
 */
async function salvarVagas(supabase: Cliente, parceiroId: string, formData: FormData) {
  for (const tipo of TIPOS_VAGA_MARINA) {
    const campo = (sufixo: string) => String(formData.get(`vaga_${tipo}_${sufixo}`) ?? "").trim() || null
    const sobConsulta = formData.get(`vaga_${tipo}_sob_consulta`) === "on"
    const total = inteiroOuNulo(campo("total"), "o total de vagas")
    const disponiveis = inteiroOuNulo(campo("disponiveis"), "as vagas disponíveis")
    const porte = inteiroOuNulo(campo("porte"), "o porte máximo em pés")
    const diaria = sobConsulta ? null : precoCentavos(campo("diaria"), "a diária da vaga")
    const mensal = sobConsulta ? null : precoCentavos(campo("mensal"), "a mensalidade da vaga")

    const vazia = total == null && disponiveis == null && porte == null && diaria == null && mensal == null && !sobConsulta
    if (vazia) {
      await supabase.from("parceiro_vagas").delete().eq("parceiro_id", parceiroId).eq("tipo", tipo)
      continue
    }
    if (total != null && disponiveis != null && disponiveis > total) {
      erroParceiro("As vagas disponíveis não podem passar do total.")
    }

    const { error } = await supabase.from("parceiro_vagas").upsert(
      {
        parceiro_id: parceiroId,
        tipo,
        total,
        disponiveis,
        porte_max_pes: porte,
        preco_diaria_centavos: diaria,
        preco_mensal_centavos: mensal,
        sob_consulta: sobConsulta,
      },
      { onConflict: "parceiro_id,tipo" },
    )
    if (error) erroParceiro("Não foi possível salvar as vagas. Confira os números e tente de novo.")
  }
}

// ---------------------------------------------------------------------------
// Fotos — estabelecimento (§13 geral) e Cardápio (§13.5)
// ---------------------------------------------------------------------------

/** As duas galerias moram em colunas diferentes da mesma linha (migration
 *  052). Uma função só, parametrizada, porque a única diferença é a coluna e
 *  o teto — duplicar daria dois lugares pra esquecer de validar o MIME. */
function galeria(album: string): { coluna: "fotos" | "fotos_cardapio"; max: number } {
  return album === "cardapio"
    ? { coluna: "fotos_cardapio", max: MAX_FOTOS_CARDAPIO }
    : { coluna: "fotos", max: MAX_FOTOS }
}

export async function subirFotoParceiro(formData: FormData) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login?volta=/parceiro/perfil")

  const { coluna, max } = galeria(String(formData.get("album") ?? "estabelecimento"))

  const { data: parceiro, error: erroBusca } = await supabase
    .from("parceiros").select(`id, ${coluna}`).eq("usuario_id", user.id).maybeSingle()
  if (erroBusca || !parceiro) erroParceiro("Cadastre seu perfil antes de enviar fotos.")

  const atuais = ((parceiro as Record<string, unknown>)[coluna] as string[] | null) ?? []
  if (atuais.length >= max) erroParceiro(`Máximo de ${max} fotos aqui. Exclua uma para enviar outra.`)

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
    .update({ [coluna]: [...atuais, path] })
    .eq("id", (parceiro as { id: string }).id)
    .select("id")
  if (error || !salvo?.length) {
    await supabase.storage.from("parceiros").remove([path])
    erroParceiro("Não foi possível salvar a foto. Tente de novo.")
  }

  revalidatePath("/parceiro/perfil")
  ok("Foto enviada")
}

export async function excluirFotoParceiro(formData: FormData) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login?volta=/parceiro/perfil")

  const path = String(formData.get("path") ?? "")
  if (!path) erroParceiro("Foto não encontrada.")
  const { coluna } = galeria(String(formData.get("album") ?? "estabelecimento"))

  const { data: parceiro, error: erroBusca } = await supabase
    .from("parceiros").select(`id, ${coluna}`).eq("usuario_id", user.id).maybeSingle()
  if (erroBusca || !parceiro) erroParceiro("Perfil de parceiro não encontrado.")

  const atuais = ((parceiro as Record<string, unknown>)[coluna] as string[] | null) ?? []
  if (!atuais.includes(path)) erroParceiro("Foto não encontrada.")

  const { data: salvo, error } = await supabase
    .from("parceiros")
    .update({ [coluna]: atuais.filter((f) => f !== path) })
    .eq("id", (parceiro as { id: string }).id)
    .select("id")
  if (error || !salvo?.length) erroParceiro("Não foi possível excluir a foto.")

  await supabase.storage.from("parceiros").remove([path])

  revalidatePath("/parceiro/perfil")
  ok("Foto excluída")
}

// ---------------------------------------------------------------------------
// §13.6 — acomodações da Pousada/Hotel
// ---------------------------------------------------------------------------

export async function adicionarAcomodacao(formData: FormData) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login?volta=/parceiro/perfil")

  const { data: parceiro } = await supabase
    .from("parceiros").select("id, categoria").eq("usuario_id", user.id).maybeSingle()
  if (!parceiro) erroParceiro("Cadastre seu perfil antes de adicionar acomodações.")
  const p = parceiro as { id: string; categoria: TipoPartner }
  if (!perfilTem(p.categoria, "acomodacoes")) erroParceiro("Acomodações são do perfil de Pousada/Hotel.")

  const nome = String(formData.get("nome") ?? "").trim()
  if (nome.length < 2) erroParceiro("Dê um nome à acomodação (ex.: Suíte vista mar).")

  const capacidade = inteiroOuNulo(String(formData.get("capacidade") ?? "").trim() || null, "a capacidade")
  if (capacidade != null && (capacidade < 1 || capacidade > 50)) {
    erroParceiro("A capacidade precisa ficar entre 1 e 50 pessoas.")
  }
  // §13.6: "valores OPCIONAIS" — vazio é resposta válida, não erro.
  const valor = precoCentavos(String(formData.get("valor_diaria") ?? "").trim() || null, "o valor da diária")

  const { error } = await supabase.from("parceiro_acomodacoes").insert({
    parceiro_id: p.id,
    nome,
    capacidade,
    valor_diaria_centavos: valor,
    descricao: String(formData.get("descricao") ?? "").trim() || null,
  })
  if (error) erroParceiro("Não foi possível adicionar a acomodação. Tente de novo.")

  revalidatePath("/parceiro/perfil")
  ok("Acomodação adicionada")
}

export async function excluirAcomodacao(formData: FormData) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login?volta=/parceiro/perfil")

  const id = String(formData.get("id") ?? "")
  if (!id) erroParceiro("Acomodação não encontrada.")

  // A RLS já barra apagar acomodação de outro parceiro; o `select` confirma
  // que a linha existia — sem ele, RLS silenciosa viraria "excluída" na tela.
  const { data, error } = await supabase.from("parceiro_acomodacoes").delete().eq("id", id).select("id")
  if (error || !data?.length) erroParceiro("Não foi possível excluir a acomodação.")

  revalidatePath("/parceiro/perfil")
  ok("Acomodação excluída")
}
