import { Farol } from "@/components/farol"
import { Horimetro } from "@/components/horimetro"
import { Icone, type NomeIcone } from "@/components/icone"

const ABAS: { rotulo: string; icone: NomeIcone; ativa?: boolean }[] = [
  { rotulo: "Início", icone: "inicio", ativa: true },
  { rotulo: "Embarcação", icone: "embarcacao" },
  { rotulo: "Marketplace", icone: "marketplace" },
  { rotulo: "Avisos", icone: "alerta" },
  { rotulo: "Menu", icone: "menu" },
]

/** Mock estático da tela inicial do app — nada de screenshot: é montado com
 *  os componentes reais (Farol, Horimetro, Icone) e dados fixos, só para a
 *  vitrine da landing. data-theme="dark" garante os tokens do tema escuro
 *  mesmo se a landing herdar de um contexto claro no futuro. */
export function MockTelas() {
  return (
    <div data-theme="dark" className="mx-auto w-full max-w-[300px] select-none sm:max-w-[320px]">
      {/* Moldura do aparelho */}
      <div className="sombra-2 rounded-[34px] border border-line bg-panel2 p-2">
        <div className="overflow-hidden rounded-[26px] border border-line bg-ink">
          {/* Barra de status fake */}
          <div className="flex items-center justify-between px-4 pb-1 pt-3 font-mono-instr text-[10px] tracking-[.12em] text-dim">
            <span>9:41</span>
            <span>••••</span>
          </div>

          <div className="space-y-3 px-3 pb-3 pt-1">
            {/* Card do barco — mesma linguagem visual do CardEmbarcacao real */}
            <div
              className="relative overflow-hidden rounded-[16px]"
              style={{ backgroundImage: "radial-gradient(ellipse 90% 70% at 50% 10%, #16324a 0%, #0b1d2d 75%)" }}
            >
              <div className="h-[122px]" />
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-20"
                style={{ backgroundImage: "linear-gradient(to top, rgb(11 29 45 / .95), rgb(11 29 45 / 0))" }}
              />
              <span className="absolute right-2.5 top-2.5 flex items-center gap-1.5 rounded-full bg-ink/80 px-2 py-1 backdrop-blur">
                <Farol status="ok" />
                <span className="font-mono-instr text-[9px] uppercase tracking-[.1em] text-ok">Tudo em dia</span>
              </span>
              <div className="absolute inset-x-0 bottom-0 p-3">
                <p className="text-base font-semibold uppercase tracking-[.05em] text-meter-texto">Blue Horizon</p>
                <p className="apoio text-meter-dim">Marina da Glória · Azimut 55</p>
              </div>
            </div>

            {/* Horímetros reais */}
            <div className="grid grid-cols-2 gap-2">
              <Horimetro rotulo="Motor BB" horas={612} status="ok" />
              <Horimetro rotulo="Motor BE" horas={608} status="ok" />
            </div>

            <div className="rounded-[12px] border border-line bg-panel px-3 py-2.5 apoio text-dim">
              Nenhum vencimento na margem. Bom vento e mar calmo.
            </div>
          </div>

          {/* Tab bar decorativa — não navega, só compõe a cena */}
          <div className="flex items-center justify-around border-t border-line bg-ink/95 px-1 pb-1 pt-2.5">
            {ABAS.map((a) => (
              <span key={a.rotulo} className={a.ativa ? "text-accent" : "text-dim"}>
                <Icone nome={a.icone} className="size-[18px]" />
              </span>
            ))}
          </div>
          <div className="flex justify-center pb-2">
            <span className="h-1 w-24 rounded-full bg-white/15" />
          </div>
        </div>
      </div>
    </div>
  )
}
