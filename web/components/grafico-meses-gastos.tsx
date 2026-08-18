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
      {meses.map((m) => {
        const proporcao = m.totalCentavos / maiorMes
        return (
          <div key={m.mes} className="flex flex-1 flex-col items-center justify-end gap-1 self-stretch">
            <div
              /* ONDA 63, auditoria visual §2 — TRÊS DEFEITOS NUM GRÁFICO SÓ.
                 A onda 57 tirou o dourado da barra do mês (certo: dourado é
                 ação e marca) e pôs `bg-texto` no lugar — branco puro no
                 escuro, preto puro no claro. O remédio virou o pior sintoma:
                 num mês de gasto alto essa barra ficava o objeto MAIS FORTE
                 da Início, acima da própria ação dourada. Junto vinham mais
                 dois: as barras dos outros meses eram contorno vazio (um
                 terceiro formato no mesmo gráfico) e um mês pequeno ao lado
                 de um mês grande virava fio de 4px — dado que existe e não
                 se lê.
                 Agora: UMA cor, a de dado (`--dado`), com o mês corrente
                 cheio e os anteriores a 45%. Zero continua sendo linha de
                 base fina — mês sem gasto não inventa altura —, mas
                 qualquer valor > 0 tem 8% de piso pra ser visível. */
              className={`w-full rounded-t ${m.mes === mesAtual ? "bg-dado" : "bg-dado/45"}`}
              style={{
                height: `${Math.round(Math.max(proporcao, m.totalCentavos > 0 ? 0.08 : 0) * 100)}%`,
                minHeight: m.totalCentavos > 0 ? 6 : 2,
              }}
            />
            <span className="font-mono-instr text-[11px] uppercase text-dim">{m.rotulo}</span>
          </div>
        )
      })}
    </div>
  )
  if (!comMoldura) return barras
  // `var(--raio-cartao)` e não `14px` cravado: com moldura, este gráfico é um
  // cartão como qualquer outro e tem que dobrar o canto junto com eles
  // (revisão da onda 57).
  return <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">{barras}</div>
}
