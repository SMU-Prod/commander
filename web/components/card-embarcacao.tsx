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
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-28"
        style={{ backgroundImage: "linear-gradient(to top, rgb(11 29 45 / .94), rgb(11 29 45 / 0))" }}
      />
      <div className="absolute inset-x-0 bottom-0 p-4">
        <h1 className="text-[22px] font-semibold uppercase tracking-[.06em] text-[#e9f1f8]">
          {embarcacao.nome}
        </h1>
        <div className="mt-1 flex items-center gap-2">
          <p className="apoio text-[#7c93ab]">{[embarcacao.marina, legenda].filter(Boolean).join(" · ")}</p>
        </div>
      </div>
      <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-[#0b1d2d]/80 px-2.5 py-1.5 backdrop-blur">
        <Icone nome="escudo" className={`size-3.5 ${COR[statusGeral]}`} />
        <span className={`font-mono-instr text-[10.5px] uppercase tracking-[.1em] ${COR[statusGeral]}`}>
          {ROTULO[statusGeral]}
        </span>
      </div>
    </div>
  )
}
