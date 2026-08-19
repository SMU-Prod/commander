import { cache } from "react"
import { redirect } from "next/navigation"
import {
  ehAdminQualquer,
  papeisValidos,
  podeAcessar,
  podeGerenciarAdministradores,
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

/**
 * Para onde mandar quem foi barrado.
 *
 * AUDITORIA 19/08, A20 — as quatro barreiras abaixo escreviam `papeis.length >
 * 0` (ou `=== 0`) à mão, quatro vezes, para responder "esta pessoa trabalha
 * aqui?". `ehAdminQualquer` era essa pergunta, escrita e testada, sem um único
 * chamador. A distinção que ela guarda é sutil e cara de perder: quem tem papel
 * mas não a área volta pro painel, quem não tem papel nenhum volta pro barco —
 * mandar um vistoriador pro `/barco` porque ele não é do Comercial faria o
 * painel parecer quebrado pra quem legitimamente o usa.
 */
function destinoDeQuemNaoPode(papeis: readonly PapelAdmin[]): string {
  return ehAdminQualquer(papeis) ? "/admin" : "/barco"
}

/** Porta do painel: qualquer papel ativo entra. Não libera dado nenhum — cada
 *  tela ainda exige a sua área. */
export async function exigirAdmin(): Promise<PapelAdmin[]> {
  const papeis = await meusPapeisAdmin()
  if (!ehAdminQualquer(papeis)) redirect("/barco")
  return papeis
}

/** Barreira por ÁREA — usa a mesma matriz testada de `domain/admin-papeis`,
 *  pra que tela e regra não possam divergir. */
export async function exigirAreaAdmin(area: AreaAdmin): Promise<PapelAdmin[]> {
  const papeis = await meusPapeisAdmin()
  if (!podeAcessar(papeis, area)) redirect(destinoDeQuemNaoPode(papeis))
  return papeis
}

export async function exigirPapelAdmin(papel: PapelAdmin): Promise<PapelAdmin[]> {
  const papeis = await meusPapeisAdmin()
  if (!temPapelAdmin(papeis, papel)) redirect(destinoDeQuemNaoPode(papeis))
  return papeis
}

/**
 * "O CEO/Super Admin é a conta-mãe que cria e gerencia os demais
 * administradores" (§21).
 *
 * A20 — era `ehCeo` direto. Dá o mesmo resultado hoje, e por isso a troca
 * parece cosmética: não é. `ehCeo` responde QUEM a pessoa é;
 * `podeGerenciarAdministradores` responde O QUE ela pode fazer, que é a
 * pergunta que esta barreira faz. No dia em que o §21 admitir um segundo papel
 * concedendo acesso, a regra muda num arquivo de domínio com teste — e esta
 * linha já está do lado certo.
 */
export async function exigirCeo(): Promise<PapelAdmin[]> {
  const papeis = await meusPapeisAdmin()
  if (!podeGerenciarAdministradores(papeis)) redirect(destinoDeQuemNaoPode(papeis))
  return papeis
}
