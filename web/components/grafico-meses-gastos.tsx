/** Barras dos últimos 6 meses de gasto — extraído de /barco/gastos (onda 8)
 *  pra ser reaproveitado também no card "Gastos do mês" de /hoje (onda 16).
 *  `comMoldura=false` entrega só as barras, sem cartão/borda própria, pra
 *  viver dentro de outro cartão (ex.: o Link de /hoje) sem aninhar bordas. */
export function GraficoMesesGastos({
  meses,
  mesAtual,
  altura = 132,
  comMoldura = true,
}: {
  meses: { mes: string; rotulo: string; totalCentavos: number }[]
  mesAtual: string
  altura?: number
  comMoldura?: boolean
}) {
  const maiorMes = Math.max(1, ...meses.map((m) => m.totalCentavos))
  const barras = (
    <div className="flex items-end gap-2" style={{ height: altura }}>
      {meses.map((m) => (
        <div key={m.mes} className="flex flex-1 flex-col items-center justify-end gap-1 self-stretch">
          <div
            /* Onda 57 — a barra do mês corrente era dourada. Dourado é ação
               principal e marca (docs/DESIGN.md §5), e aqui ele estava só
               marcando "este é o mês de agora" — trabalho que o contraste
               faz igual, sem gastar o acento que a tela reserva pro botão
               que importa. */
            className={`w-full rounded-t ${m.mes === mesAtual ? "bg-texto" : "bg-panel2 border border-line"}`}
            style={{ height: `${Math.round((m.totalCentavos / maiorMes) * 100)}%`, minHeight: m.totalCentavos > 0 ? 4 : 1 }}
          />
          <span className="font-mono-instr text-[11px] uppercase text-dim">{m.rotulo}</span>
        </div>
      ))}
    </div>
  )
  if (!comMoldura) return barras
  return <div className="sombra-1 rounded-[14px] border border-line bg-panel p-4">{barras}</div>
}
