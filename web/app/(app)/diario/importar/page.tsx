import { redirect } from "next/navigation"
import { ImportarGpxCliente } from "@/components/diario/importar-gpx-cliente"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
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
      <CabecalhoDetalhe
        voltarHref="/diario"
        voltarRotulo="Diário"
        titulo="Importar do plotter"
        descricao="Cada trilha do arquivo vira uma saída no Livro de Bordo — o dado é seu, não da Garmin."
      />
      <ImportarGpxCliente />
    </main>
  )
}
