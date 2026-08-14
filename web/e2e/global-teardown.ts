import { existsSync, readFileSync, rmSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"
import { ARQUIVO_ID_USUARIO, ARQUIVO_SESSAO } from "./global-setup"

/** Contrapartida do `global-setup.ts`: apaga o usuário de teste efêmero (se
 *  algum foi criado) e limpa os arquivos locais de sessão. Roda sempre, com
 *  ou sem falha nos testes (garantia do Playwright p/ globalTeardown). */
export default async function globalTeardown() {
  rmSync(ARQUIVO_SESSAO, { force: true })

  if (!existsSync(ARQUIVO_ID_USUARIO)) return
  const id = readFileSync(ARQUIVO_ID_USUARIO, "utf8").trim()
  rmSync(ARQUIVO_ID_USUARIO, { force: true })
  if (!id) return

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) {
    console.log(`[e2e] falha ao apagar o usuário de teste efêmero (${error.message}) — apague manualmente pelo id: ${id}`)
  } else {
    console.log("[e2e] usuário de teste efêmero removido.")
  }
}
