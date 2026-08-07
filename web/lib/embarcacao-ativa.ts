"use server"
import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"

const COOKIE = "barco"

export async function lerEmbarcacaoAtiva(): Promise<string | null> {
  return (await cookies()).get(COOKIE)?.value ?? null
}

export async function definirEmbarcacaoAtiva(formData: FormData) {
  const id = String(formData.get("embarcacao_id") ?? "")
  if (id) {
    ;(await cookies()).set(COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 })
  }
  revalidatePath("/", "layout")
}
