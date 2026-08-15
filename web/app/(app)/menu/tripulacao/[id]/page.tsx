import { permanentRedirect } from "next/navigation"

/** A matriz de permissões acompanhou a lista: `/menu/tripulacao/[id]` →
 *  `/tripulacao/[id]` (onda 58, spec de arquitetura §4.1 — ver o comentário
 *  em `../page.tsx`). */
export default async function MatrizAntigaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  permanentRedirect(`/tripulacao/${id}`)
}
