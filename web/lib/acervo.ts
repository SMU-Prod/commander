import type { SupabaseClient } from "@supabase/supabase-js"

const TIPOS = ["application/pdf", "image/jpeg", "image/png", "image/webp"]
const MAX_BYTES = 10 * 1024 * 1024

export function validarArquivo(file: File): { ok: true } | { ok: false; erro: string } {
  if (file.size === 0) return { ok: false, erro: "O arquivo está vazio." }
  if (file.size > MAX_BYTES) return { ok: false, erro: "Arquivo acima de 10 MB." }
  if (!TIPOS.includes(file.type)) return { ok: false, erro: "Use PDF, JPG, PNG ou WebP." }
  return { ok: true }
}

export async function subirArquivo(
  supabase: SupabaseClient,
  embarcacaoId: string,
  pasta: "documentos" | "eventos" | "fotos",
  file: File,
): Promise<{ path: string } | { erro: string }> {
  const v = validarArquivo(file)
  if (!v.ok) return { erro: v.erro }
  const limpo = file.name.normalize("NFD").replace(/[^\w.-]/g, "_").slice(-80)
  const path = `${embarcacaoId}/${pasta}/${crypto.randomUUID()}-${limpo}`
  const { error } = await supabase.storage.from("acervo").upload(path, file)
  if (error) return { erro: "Falha ao enviar o arquivo. Tente de novo." }
  return { path }
}
