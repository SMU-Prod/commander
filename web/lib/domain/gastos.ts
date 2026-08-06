export interface GastoEntrada { data: string; custoCentavos: number; grupo: string }

export interface ResumoGastos {
  totalMesCentavos: number
  porGrupo: { grupo: string; totalCentavos: number }[]
  meses: { mes: string; rotulo: string; totalCentavos: number }[]
}

export function resumoGastos(entradas: GastoEntrada[], hoje: string): ResumoGastos {
  const [anoAtual, mesAtual] = hoje.split("-").map(Number)
  const total = anoAtual * 12 + (mesAtual - 1)

  const meses = Array.from({ length: 6 }, (_, i) => {
    const t = total - (5 - i)
    const y = Math.floor(t / 12)
    const m = (t % 12) + 1
    const chave = `${y}-${String(m).padStart(2, "0")}`
    const rotulo = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" })
      .format(new Date(Date.UTC(y, m - 1, 1)))
      .replace(".", "")
    return { mes: chave, rotulo, totalCentavos: 0 }
  })

  const porGrupo = new Map<string, number>()
  const chaveAtual = `${anoAtual}-${String(mesAtual).padStart(2, "0")}`
  for (const e of entradas) {
    const chave = e.data.slice(0, 7)
    const slot = meses.find((m) => m.mes === chave)
    if (slot) slot.totalCentavos += e.custoCentavos
    if (chave === chaveAtual) porGrupo.set(e.grupo, (porGrupo.get(e.grupo) ?? 0) + e.custoCentavos)
  }

  return {
    totalMesCentavos: meses[5].totalCentavos,
    porGrupo: [...porGrupo.entries()]
      .map(([grupo, totalCentavos]) => ({ grupo, totalCentavos }))
      .sort((a, b) => b.totalCentavos - a.totalCentavos),
    meses,
  }
}

export function formatarReais(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}
