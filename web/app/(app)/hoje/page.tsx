import { redirect } from "next/navigation"
import { Farol } from "@/components/farol"
import { Horimetro } from "@/components/horimetro"
import { calcularSemaforo, textoRestante, PESO, type StatusFarol } from "@/lib/domain/semaforo"
import { carregarPainel, hojeISO, itemMonitoradoToItemCalc } from "@/lib/consultas"

export default async function HojePage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const { embarcacao, equipamentos, itens } = painel
  const hoje = hojeISO()

  const avaliados = itens
    .map((i) => {
      const eq = equipamentos.find((e) => e.id === i.equipamento_id)
      const r = calcularSemaforo(itemMonitoradoToItemCalc(i), eq?.horas_atuais ?? null, hoje)
      const onde = eq ? `${i.nome} — Motor ${eq.posicao ?? ""}`.trim() : i.nome
      return { item: i, r, onde }
    })
    .sort((a, b) => PESO[b.r.status] - PESO[a.r.status])

  const alertas = avaliados.filter((a) => a.r.status !== "ok")
  const contagem = {
    vencido: avaliados.filter((a) => a.r.status === "vencido").length,
    atencao: avaliados.filter((a) => a.r.status === "atencao").length,
    ok: avaliados.filter((a) => a.r.status === "ok").length,
  }
  const motores = equipamentos.filter((e) => e.tipo === "motor")

  return (
    <main>
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-semibold">{embarcacao.nome}</h1>
          <p className="text-sm text-dim">{embarcacao.marina ?? "Marina não informada"}</p>
        </div>
        <div className="flex gap-2.5 font-mono-instr text-xs tabular-nums text-dim">
          <span className="flex items-center gap-1"><Farol status="vencido" />{contagem.vencido}</span>
          <span className="flex items-center gap-1"><Farol status="atencao" />{contagem.atencao}</span>
          <span className="flex items-center gap-1"><Farol status="ok" />{contagem.ok}</span>
        </div>
      </header>

      {erro && (
        <p className="mt-4 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 text-sm">{erro}</p>
      )}

      <p className="mt-6 mb-2 font-mono-instr text-[10.5px] uppercase tracking-[.16em] text-dim">
        {alertas.length > 0 ? "Precisa de atenção" : "Tudo em dia"}
      </p>
      {alertas.length === 0 && (
        <div className="rounded-[14px] border border-line bg-panel p-4 text-sm text-dim">
          Nenhum vencimento na margem. Bom vento e mar calmo.
        </div>
      )}
      <div className="space-y-2">
        {alertas.map(({ item, r, onde }) => (
          <div key={item.id} className="flex gap-3 rounded-[14px] border border-line bg-panel p-3.5">
            <span className={`w-[3px] shrink-0 self-stretch rounded ${r.status === "vencido" ? "bg-crit" : "bg-warn"}`} />
            <div>
              <p className="text-sm font-semibold">{onde}</p>
              <p className="mt-0.5 text-xs text-dim">{textoRestante(r)}</p>
            </div>
          </div>
        ))}
      </div>

      {motores.length > 0 && (
        <>
          <p className="mt-6 mb-2 font-mono-instr text-[10.5px] uppercase tracking-[.16em] text-dim">Horas de motor</p>
          <div className="grid grid-cols-2 gap-2">
            {motores.map((m) => {
              const status =
                avaliados
                  .filter((a) => a.item.equipamento_id === m.id)
                  .map((a) => a.r.status)
                  .sort((a, b) => PESO[b] - PESO[a])[0] ?? "ok"
              return <Horimetro key={m.id} rotulo={m.posicao ?? "Motor"} horas={m.horas_atuais ?? 0} status={status} />
            })}
          </div>
        </>
      )}
    </main>
  )
}
