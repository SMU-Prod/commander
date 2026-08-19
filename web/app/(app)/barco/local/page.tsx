import Link from "next/link"
import { redirect } from "next/navigation"
import { Icone } from "@/components/icone"
import { UsarPosicao } from "@/components/usar-posicao"
import { salvarLocalMarina } from "@/lib/acoes/local"
import { carregarPainel } from "@/lib/consultas"
import { ACAO_NAO_ESTICA, TETO_FORMULARIO } from "@/lib/ui/superficies"

// Onda 93 (achado 5.9) — era `10px` cravado. Vira `--raio-controle` (8px) pelo
// mesmo critério que vestiu o grupo de controles do Mapbox em globals.css: quem
// se TOCA é controle, quem CONTÉM conteúdo é cartão. Campo de formulário é
// controle, então 8.
const campo = "w-full rounded-[var(--raio-controle)] border border-line bg-campo px-3 py-3 font-mono-instr text-base tabular-nums"
// Onda 87 — `.rotulo` já É mono, 11px, caixa alta e rastreada; o que estava
// aqui era ela reescrita à mão, com o tracking derivado (.14 contra .16).
const rotulo = "mb-1.5 block rotulo text-dim"

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
    <main className={TETO_FORMULARIO}>
      <Link href="/barco" className="inline-flex items-center gap-1 rotulo text-accent-forte">
        <Icone nome="voltar" className="size-4" /> Barco
      </Link>
      <h1 className="titulo-pagina mt-3">Posição da marina</h1>
      <p className="mt-1 text-sm text-dim">
        É daqui que saem o boletim do mar da tela Início e, no futuro, o modo marina.
        Vá até o barco e toque em “Usar minha posição atual” — ou preencha as coordenadas.
      </p>
      {erro && <p className="mt-3 rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2 text-sm">{erro}</p>}

      <form action={salvarLocalMarina} className="mt-6 space-y-4">
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
        <button className={`${ACAO_NAO_ESTICA} rounded-[var(--raio-controle)] bg-accent py-3.5 font-semibold text-acao-texto`}>
          Salvar posição
        </button>
      </form>
    </main>
  )
}
