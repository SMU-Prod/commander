import { existsSync, readFileSync, rmSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"
import { ARQUIVO_ID_BARCO, ARQUIVO_ID_USUARIO, ARQUIVO_SESSAO } from "./global-setup"

/** Contrapartida do `global-setup.ts`: apaga o usuário de teste efêmero (se
 *  algum foi criado) e limpa os arquivos locais de sessão. Roda sempre, com
 *  ou sem falha nos testes (garantia do Playwright p/ globalTeardown). */
export default async function globalTeardown() {
  rmSync(ARQUIVO_SESSAO, { force: true })

  const idBarco = existsSync(ARQUIVO_ID_BARCO) ? readFileSync(ARQUIVO_ID_BARCO, "utf8").trim() : ""
  rmSync(ARQUIVO_ID_BARCO, { force: true })

  if (!existsSync(ARQUIVO_ID_USUARIO)) return
  const id = readFileSync(ARQUIVO_ID_USUARIO, "utf8").trim()
  rmSync(ARQUIVO_ID_USUARIO, { force: true })
  if (!id) return

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

  // As FOTOS semeadas (onda 120) primeiro: apagar o usuário derruba as linhas
  // por cascade, mas os OBJETOS do bucket `acervo` não estão no cascade — sem
  // este passo, cada rodada deixaria três renders órfãos no storage. O prefixo
  // é o id do barco, o mesmo usado no upload do setup.
  if (idBarco) {
    const { data: objetos } = await admin.storage.from("acervo").list(`${idBarco}/fotos`)
    const caminhos = (objetos ?? []).map((o) => `${idBarco}/fotos/${o.name}`)
    if (caminhos.length > 0) {
      const { error: erroStorage } = await admin.storage.from("acervo").remove(caminhos)
      if (erroStorage) {
        console.log(`[e2e] falha ao apagar fotos de teste do storage (${erroStorage.message}) — apague pelo prefixo: acervo/${idBarco}/`)
      }
    }
  }

  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) {
    console.log(`[e2e] falha ao apagar o usuário de teste efêmero (${error.message}) — apague manualmente pelo id: ${id}`)
  } else {
    console.log("[e2e] usuário de teste efêmero removido.")
  }
}
