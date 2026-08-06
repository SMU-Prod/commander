import type { ItemMonitorado } from "@/lib/db/types"
import type { ItemCalc } from "@/lib/domain/semaforo"

export function itemMonitoradoToItemCalc(item: ItemMonitorado): ItemCalc {
  return {
    intervaloHoras: item.intervalo_horas,
    intervaloMeses: item.intervalo_meses,
    dataFixa: item.data_fixa,
    ultimoCicloData: item.ultimo_ciclo_data,
    ultimoCicloHoras: item.ultimo_ciclo_horas,
  }
}
