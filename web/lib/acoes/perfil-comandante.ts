"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { supabaseServer } from "@/lib/supabase/server"
import type { TipoPerfilComandante } from "@/lib/db/types"

// Onda 39 — mesma tabela/RLS serve Comandantes (§47) e Prestadores (§50),
// só a rota de volta muda (ver migration 037 e o comentário em
// lib/db/types.ts, PerfilComandante). Rota inválida/ausente cai pra
// "comandante" — mesmo padrão de honestidade de sempre: nunca 404 silencioso.
const ROTA_POR_TIPO: Record<TipoPerfilComandante, string> = {
  comandante: "/comandantes",
  prestador: "/prestadores",
}

const MIME_FOTO = ["image/jpeg", "image/png", "image/webp"]
/** Foto de perfil é um avatar, não um álbum: 4 MB já cobre uma foto de
 *  celular sem tratamento e evita que um upload de 20 MB estoure o Server
 *  Action (o limite padrão do Next é bem menor que isso). */
const MAX_BYTES_FOTO = 4 * 1024 * 1024

function tipoValido(v: FormDataEntryValue | null): TipoPerfilComandante {
  return v === "prestador" ? "prestador" : "comandante"
}

function erroPerfil(tipo: TipoPerfilComandante, msg: string): never {
  redirect(`${ROTA_POR_TIPO[tipo]}/perfil?erro=${encodeURIComponent(msg)}`)
}

/** Inteiro opcional vindo de campo de texto. Devolve `null` pra vazio e
 *  `undefined` pra lixo — quem chama decide se lixo é erro ou é "não
 *  informado". Aqui é erro: número errado no currículo é pior que ausente. */
function inteiroOpcional(bruto: string): number | null | undefined {
  const t = bruto.trim()
  if (t === "") return null
  const n = Number(t.replace(/\D/g, ""))
  return Number.isFinite(n) && n > 0 ? n : undefined
}

/**
 * §12 e §11.2/§21.2 — função e região vêm da `taxonomia`, não de texto livre.
 * Um id inventado seria aceito pela FK só se existisse na tabela, mas nada
 * impediria mandar um id de MARCA no campo de função: a checagem é do TIPO,
 * não só da existência. Sem isso, o matching do §11.4 receberia lixo.
 */
async function idDeTaxonomiaValido(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  id: string | null,
  tipo: "funcao" | "regiao",
): Promise<boolean> {
  if (id == null) return true
  const { data } = await supabase
    .from("taxonomia").select("id").eq("id", id).eq("tipo", tipo).eq("ativo", true).maybeSingle()
  return data != null
}

export async function salvarPerfilComandante(formData: FormData) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const tipo = tipoValido(formData.get("tipo"))
  const texto = (k: string) => String(formData.get(k) ?? "").trim() || null
  const nome = texto("nome_publico")
  if (!nome) erroPerfil(tipo, "Informe seu nome profissional.")

  const funcaoId = texto("funcao_id")
  const regiaoId = texto("regiao_id")
  const [funcaoOk, regiaoOk] = await Promise.all([
    idDeTaxonomiaValido(supabase, funcaoId, "funcao"),
    idDeTaxonomiaValido(supabase, regiaoId, "regiao"),
  ])
  if (!funcaoOk) erroPerfil(tipo, "Escolha uma função da lista.")
  if (!regiaoOk) erroPerfil(tipo, "Escolha uma região da lista.")

  const experiencia = inteiroOpcional(String(formData.get("experiencia_anos") ?? ""))
  if (experiencia === undefined || (experiencia != null && experiencia > 80)) {
    erroPerfil(tipo, "Experiência em anos: informe um número entre 1 e 80, ou deixe em branco.")
  }
  const porte = inteiroOpcional(String(formData.get("porte_max_pes") ?? ""))
  if (porte === undefined || (porte != null && porte > 400)) {
    erroPerfil(tipo, "Porte máximo em pés: informe um número entre 1 e 400, ou deixe em branco.")
  }

  // A foto é enviada no MESMO formulário do resto (§24 — um passo, não dois):
  // sobe primeiro, e se a gravação da linha falhar o arquivo é removido logo
  // abaixo. Sem isso, um erro de RLS deixaria lixo no bucket para sempre.
  const arquivo = formData.get("foto")
  let fotoPath: string | null = null
  if (arquivo instanceof File && arquivo.size > 0) {
    if (!MIME_FOTO.includes(arquivo.type)) erroPerfil(tipo, "Use JPG, PNG ou WebP na foto.")
    if (arquivo.size > MAX_BYTES_FOTO) erroPerfil(tipo, "A foto precisa ter menos de 4 MB.")
    const ext = arquivo.type === "image/png" ? "png" : arquivo.type === "image/webp" ? "webp" : "jpg"
    // pasta = <usuario_id>, exigida pela policy do bucket `perfis` (051)
    const caminho = `${user.id}/${crypto.randomUUID()}.${ext}`
    const { error: erroUpload } = await supabase.storage.from("perfis").upload(caminho, arquivo)
    if (erroUpload) erroPerfil(tipo, "Não foi possível enviar a foto. Tente de novo.")
    fotoPath = caminho
  }

  // `foto_path` só entra no upsert quando há foto nova: omitir a chave
  // preserva a foto atual, enquanto mandar `null` a apagaria a cada salvamento
  // de texto. Trocar a foto é upload novo; TIRAR a foto tem ação própria.
  const { data: salvo, error } = await supabase.from("perfis_comandante").upsert({
    usuario_id: user.id,
    tipo,
    nome_publico: nome,
    categoria: texto("categoria"),
    cidade: texto("cidade"),
    bio: texto("bio"),
    telefone: texto("telefone"),
    disponibilidade: texto("disponibilidade"),
    funcao_id: funcaoId,
    regiao_id: regiaoId,
    experiencia_anos: experiencia,
    porte_max_pes: porte,
    certificacoes: texto("certificacoes"),
    ...(fotoPath ? { foto_path: fotoPath } : {}),
    visivel: formData.get("visivel") === "on",
  }).select("usuario_id")
  // sem o select, uma escrita barrada pela RLS voltaria com error null e a
  // tela diria "salvo" sem ter salvado nada (regra da casa, ver CONTRIBUTING.md).
  if (error || !salvo?.length) {
    if (fotoPath) await supabase.storage.from("perfis").remove([fotoPath])
    erroPerfil(tipo, "Não foi possível salvar o perfil. Tente de novo.")
  }

  const rota = ROTA_POR_TIPO[tipo]
  revalidatePath(rota)
  revalidatePath(`${rota}/perfil`)
  revalidatePath("/hoje")
  redirect(rota)
}

/** Tirar a foto do perfil. Ação separada do salvar porque apagar é
 *  irreversível e nunca pode ser efeito colateral de "salvei o telefone". */
export async function removerFotoDePerfil(formData: FormData) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const tipo = tipoValido(formData.get("tipo"))

  const { data: perfil } = await supabase
    .from("perfis_comandante").select("foto_path").eq("usuario_id", user.id).maybeSingle()
  const caminho = (perfil as { foto_path: string | null } | null)?.foto_path
  if (!caminho) redirect(`${ROTA_POR_TIPO[tipo]}/perfil`)

  const { data: salvo, error } = await supabase
    .from("perfis_comandante").update({ foto_path: null }).eq("usuario_id", user.id).select("usuario_id")
  if (error || !salvo?.length) erroPerfil(tipo, "Não foi possível remover a foto. Tente de novo.")
  // O arquivo sai depois da linha: se a ordem fosse inversa e a gravação
  // falhasse, o perfil apontaria pra um arquivo que não existe mais.
  await supabase.storage.from("perfis").remove([caminho])

  revalidatePath(`${ROTA_POR_TIPO[tipo]}/perfil`)
  redirect(`${ROTA_POR_TIPO[tipo]}/perfil`)
}
