export function parseDecimalPtBr(bruto: string): number | null {
  const v = bruto.trim()
  if (v === "") return null
  const normalizado = v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v
  const n = Number(normalizado)
  return Number.isFinite(n) ? n : null
}
