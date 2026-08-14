import { redirect } from "next/navigation"
import { ehAdminGold } from "@/lib/consultas-gold"

/** Barreira das telas `/admin/*` e das actions de admin do Commander Gold
 *  (onda 35). `is_admin` nunca é autoatendido — concessão manual via SQL
 *  pelo dono, documentada em `docs/OPERACAO.md`. */
export async function exigirAdmin(): Promise<void> {
  const admin = await ehAdminGold()
  if (!admin) redirect("/barco")
}
