import Link from "next/link"
import { redirect } from "next/navigation"
import { Icone } from "@/components/icone"
import { UsarPosicao } from "@/components/usar-posicao"
import { salvarLocalMarina } from "@/lib/acoes/local"
import { carregarPainel } from "@/lib/consultas"

const campo = "w-full rounded-[10px] border border-line bg-campo px-3 py-3 font-mono-instr text-base tabular-nums"
const rotulo = "mb-1.5 block font-mono-instr text-[11px] uppercase tracking-[.14em] text-dim"

export default async function LocalPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (painel.papel !== "PROP") redirect("/hoje?erro=" + encodeURIComponent("Só o proprietário altera a posição da marina."))
  const { embarcacao } = painel

  return (
    <main>
      <Link href="/barco" className="inline-flex items-center gap-1 rotulo text-accent-forte">
        <Icone nome="voltar" className="size-4" /> Barco
      </Link>
      <h1 className="mt-3 text-xl font-semibold">Posição da marina</h1>
      <p className="mt-1 text-sm text-dim">
        É daqui que saem o boletim do mar da tela Início e, no futuro, o modo marina.
        Vá até o barco e toque em “Usar minha posição atual” — ou preencha as coordenadas.
      </p>
      {erro && <p className="mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 text-sm">{erro}</p>}

      <form action={salvarLocalMarina} className="mt-5 space-y-4">
        <UsarPosicao />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={rotulo} htmlFor="lat">Latitude</label>
            <input id="lat" name="lat" inputMode="text" placeholder="-22.9188"
              defaultValue={embarcacao.marina_lat ?? undefined} className={campo} />
          </div>
          <div>
            <label className={rotulo} htmlFor="lon">Longitude</label>
            <input id="lon" name="lon" inputMode="text" placeholder="-43.1706"
              defaultValue={embarcacao.marina_lon ?? undefined} className={campo} />
          </div>
        </div>
        <button className="w-full rounded-xl bg-accent py-3.5 font-semibold text-acao-texto">
          Salvar posição
        </button>
      </form>
    </main>
  )
}
