const MB = 1024 * 1024

export const COTA_MB = 500

export interface UsoCota {
  usadoBytes: number
  limiteBytes: number
  percentual: number
  restanteBytes: number
  cheio: boolean
}

export function usoDaCota(bytesUsados: number): UsoCota {
  const limiteBytes = COTA_MB * MB
  const usadoBytes = Math.max(0, bytesUsados)
  const percentual = Math.min(100, Math.round((usadoBytes / limiteBytes) * 100))
  return {
    usadoBytes,
    limiteBytes,
    percentual,
    restanteBytes: Math.max(0, limiteBytes - usadoBytes),
    cheio: usadoBytes >= limiteBytes,
  }
}

export function formatarBytes(bytes: number): string {
  if (bytes >= 1024 * MB) {
    return `${(bytes / (1024 * MB)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} GB`
  }
  if (bytes >= MB) {
    return `${Math.round(bytes / MB).toLocaleString("pt-BR")} MB`
  }
  return `${Math.round(bytes / 1024).toLocaleString("pt-BR")} KB`
}
