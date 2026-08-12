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

/** Uma das 3 mini-métricas do rodapé do hero (Horas de motor / Próxima
 *  revisão / Documentos). `status` só colore quando há algo pra sinalizar —
 *  "ok"/null ficam no texto neutro (mesma convenção de cor do resto do
 *  app: warn/crit chamam atenção, "em dia" não precisa de verde extra aqui). */
export interface MetricaHero {
  rotulo: string
  valor: string
  status?: StatusFarol | null
}

export function CardEmbarcacao({
  embarcacao,
  statusGeral,
  urlCapa,
  podeEditarFotos,
  ultimaAtualizacao = null,
  metricas,
}: {
  embarcacao: Embarcacao
  statusGeral: StatusFarol
  urlCapa: string | null
  podeEditarFotos: boolean
  /** "Hoje, 08:30" — null quando não há nenhuma leitura registrada (regra de honestidade: só aparece se existir) */
  ultimaAtualizacao?: string | null
  /** Rodapé com mini-métricas + "Ver embarcação" — só em /hoje, que não tem o
   *  detalhe completo mais abaixo na tela (diferente de /barco, que já tem). */
  metricas?: [MetricaHero, MetricaHero, MetricaHero]
}) {
  const legenda = [embarcacao.estaleiro, embarcacao.modelo, embarcacao.ano].filter(Boolean).join(" · ")
  return (
    <div className="sombra-2 overflow-hidden rounded-[16px]">
      <div className="relative bg-[#0b1d2d]">
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
          <span className="rounded-full bg-[#0b1d2d]/75 px-2 py-0.5 font-mono-instr text-[11px] uppercase tracking-[.16em] text-[#e9f1f8] backdrop-blur">
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
      {metricas && (
        <div className="border-t border-line bg-panel p-3.5">
          {ultimaAtualizacao && (
            <p className="apoio mb-2.5 text-dim">Última atualização: {ultimaAtualizacao}</p>
          )}
          <div className="grid grid-cols-3 gap-2">
            {metricas.map((m) => (
              <div key={m.rotulo} className="min-w-0">
                <p className="truncate font-mono-instr text-[10px] uppercase tracking-[.08em] text-dim">{m.rotulo}</p>
                <p
                  className={`mt-0.5 truncate font-mono-instr text-[15px] font-semibold tabular-nums ${
                    m.status === "vencido" ? "text-crit" : m.status === "atencao" ? "text-warn" : ""
                  }`}
                >
                  {m.valor}
                </p>
              </div>
            ))}
          </div>
          <Link
            href="/barco"
            className="mt-3 flex h-11 items-center justify-center rounded-xl bg-accent text-sm font-semibold text-acao-texto"
          >
            Ver embarcação
          </Link>
        </div>
      )}
    </div>
  )
}
