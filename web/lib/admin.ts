import { cache } from "react"
import { redirect } from "next/navigation"
import {
  ehCeo,
  papeisValidos,
  podeAcessar,
  temPapelAdmin,
  type AreaAdmin,
  type PapelAdmin,
} from "@/lib/domain/admin-papeis"
import { supabaseServer } from "@/lib/supabase/server"

/**
 * Barreira das telas `/admin/*` e das actions administrativas.
 *
 * Onda 48 (PRD §21/§22): saiu o `is_admin` binário, entraram papéis. A tela
 * checa aqui e o banco checa de novo na RLS (migration 049) — defesa em
 * profundidade. A checagem daqui existe pra que a pessoa veja uma tela
 * coerente em vez de uma lista vazia sem explicação; a que VALE é a do banco.
 *
 * Nenhum papel é autoatendido: só o CEO concede papel, e o PRIMEIRO CEO
 * nasce por SQL direto do dono (docs/OPERACAO.md).
 */

/** Papéis ATIVOS do usuário logado. A RLS de `admin_papeis` já deixa cada um
 *  ler as próprias linhas, então não precisa de RPC. `cache` do React garante
 *  uma consulta por request mesmo com layout + página + action perguntando. */
export const meusPapeisAdmin = cache(async (): Promise<PapelAdmin[]> => {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase
    .from("admin_papeis").select("papel").eq("usuario_id", user.id).eq("ativo", true)
  return papeisValidos(((data as { papel: string }[] | null) ?? []).map((r) => r.papel))
})

/** Porta do painel: qualquer papel ativo entra. Não libera dado nenhum — cada
 *  tela ainda exige a sua área. */
export async function exigirAdmin(): Promise<PapelAdmin[]> {
  const papeis = await meusPapeisAdmin()
  if (papeis.length === 0) redirect("/barco")
  return papeis
}

/** Barreira por ÁREA — usa a mesma matriz testada de `domain/admin-papeis`,
 *  pra que tela e regra não possam divergir. */
export async function exigirAreaAdmin(area: AreaAdmin): Promise<PapelAdmin[]> {
  const papeis = await meusPapeisAdmin()
  if (!podeAcessar(papeis, area)) redirect(papeis.length > 0 ? "/admin" : "/barco")
  return papeis
}

export async function exigirPapelAdmin(papel: PapelAdmin): Promise<PapelAdmin[]> {
  const papeis = await meusPapeisAdmin()
  if (!temPapelAdmin(papeis, papel)) redirect(papeis.length > 0 ? "/admin" : "/barco")
  return papeis
}

/** "O CEO/Super Admin é a conta-mãe que cria e gerencia os demais
 *  administradores" (§21). */
export async function exigirCeo(): Promise<PapelAdmin[]> {
  const papeis = await meusPapeisAdmin()
  if (!ehCeo(papeis)) redirect(papeis.length > 0 ? "/admin" : "/barco")
  return papeis
}
