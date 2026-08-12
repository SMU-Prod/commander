import Link from "next/link"
import { redirect } from "next/navigation"
import { Icone } from "@/components/icone"
import { ImportarGpxCliente } from "@/components/diario/importar-gpx-cliente"
import { carregarPainel } from "@/lib/consultas"

/**
 * Importar do plotter (onda 21) — anos de trilha ja gravada no
 * Garmin/Raymarine/Navionics do dono viram saida no Livro de Bordo de uma
 * vez, com o mesmo consentimento de corredores da onda 17. Alcancavel em 2
 * toques a partir de /hoje (aba Diário → "Importar do plotter").
 */
export default async function ImportarGpxPage() {
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")

  return (
    <main>
      <Link href="/diario" className="inline-flex items-center gap-1 rotulo text-accent-forte">
        <Icone nome="voltar" className="size-4" /> Diário
      </Link>
      <h1 className="titulo-pagina mt-3">Importar do plotter</h1>
      <p className="mt-1 apoio text-dim">
        Cada trilha do arquivo vira uma saída no Livro de Bordo — o dado é seu, não da Garmin.
      </p>
      <ImportarGpxCliente />
    </main>
  )
}
