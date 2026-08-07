import Link from "next/link"
import { Icone } from "@/components/icone"
import type { StatusFarol } from "@/lib/domain/semaforo"
import type { Embarcacao } from "@/lib/db/types"

const ROTULO: Record<StatusFarol, string> = {
  ok: "Tudo em dia",
  atencao: "Precisa de atenção",
  vencido: "Item vencido",
}

const COR: Record<StatusFarol, string> = {
  ok: "text-[#2fd07a]",
  atencao: "text-[#ffb020]",
  vencido: "text-[#ff5c5c]",
}

export function CardEmbarcacao({
  embarcacao,
  statusGeral,
  urlCapa,
  podeEditarFotos,
}: {
  embarcacao: Embarcacao
  statusGeral: StatusFarol
  urlCapa: string | null
  podeEditarFotos: boolean
}) {
  const legenda = [embarcacao.estaleiro, embarcacao.modelo, embarcacao.ano].filter(Boolean).join(" · ")
  return (
    <div className="sombra-2 relative overflow-hidden rounded-[16px] bg-[#0b1d2d]">
      {urlCapa ? (
        /* eslint-disable-next-line @next/next/no-img-element -- URL assinada e temporária do storage */
        <img src={urlCapa} alt={`Foto de ${embarcacao.nome}`} className="h-44 w-full object-cover" />
      ) : (
        <Link
          href={podeEditarFotos ? "/barco/fotos" : "/barco"}
          className="flex h-44 w-full flex-col items-center justify-center gap-2"
          style={{ backgroundImage: "radial-gradient(ellipse 90% 70% at 50% 15%, #16324a 0%, #0b1d2d 70%)" }}
        >
          <Icone nome="camera" className="size-7 text-[#7c93ab]" />
          {podeEditarFotos && (
            <span className="corpo text-[#7c93ab]">Adicionar foto da embarcação</span>
          )}
        </Link>
      )}
      {/* Véu do topo: garante leitura do selo e do monograma sobre foto clara */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-16"
        style={{ backgroundImage: "linear-gradient(to bottom, rgb(11 29 45 / .55), rgb(11 29 45 / 0))" }}
      />
      {/* Véu de baixo: alto e denso — o nome é o texto mais importante do app
          e precisa se manter legível sobre casco branco no sol. */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-36"
        style={{
          backgroundImage:
            "linear-gradient(to top, rgb(11 29 45 / .96) 0%, rgb(11 29 45 / .88) 32%, rgb(11 29 45 / .5) 62%, rgb(11 29 45 / 0) 100%)",
        }}
      />
      <span className="absolute left-3 top-3 flex items-center gap-1.5">
        <svg viewBox="0 0 48 34" className="h-3.5 w-auto" aria-hidden="true">
          <path d="M4 32 V10 L15 22 24 5 33 22 44 10 V32 H36 V24 L28 32 H20 L12 24 V32 Z" fill="#d4af37" />
        </svg>
        <span className="font-mono-instr text-[10.5px] uppercase tracking-[.22em] text-[#e9f1f8]/70">
          Commander
        </span>
      </span>
      <div className="absolute inset-x-0 bottom-0 p-4">
        <h1
          className="text-[22px] font-semibold uppercase tracking-[.06em] text-[#e9f1f8]"
          style={{ textShadow: "0 1px 8px rgb(11 29 45 / .8)" }}
        >
          {embarcacao.nome}
        </h1>
        <div className="mt-1 flex items-center gap-2">
          <p className="apoio text-[#c2d1de]">{[embarcacao.marina, legenda].filter(Boolean).join(" · ")}</p>
        </div>
      </div>
      <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-[#0b1d2d]/80 px-2.5 py-1.5 backdrop-blur">
        <Icone nome="escudo" className={`size-3.5 ${COR[statusGeral]}`} />
        <span className={`font-mono-instr text-[11px] uppercase tracking-[.1em] ${COR[statusGeral]}`}>
          {ROTULO[statusGeral]}
        </span>
      </div>
    </div>
  )
}
