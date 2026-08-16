import type { ItemMonitorado } from "@/lib/db/types"
import type { ItemCalc } from "@/lib/domain/semaforo"

/** O parâmetro é o SUBCONJUNTO que a conversão lê, não a linha inteira do
 *  banco — linhas completas continuam entrando por estrutura, e quem só tem
 *  os cinco campos (a `FaixaTopo`, testes) não precisa fabricar o resto. */
export function itemMonitoradoToItemCalc(
  item: Pick<
    ItemMonitorado,
    "intervalo_horas" | "intervalo_meses" | "data_fixa" | "ultimo_ciclo_data" | "ultimo_ciclo_horas"
  >,
): ItemCalc {
  return {
    intervaloHoras: item.intervalo_horas,
    intervaloMeses: item.intervalo_meses,
    dataFixa: item.data_fixa,
    ultimoCicloData: item.ultimo_ciclo_data,
    ultimoCicloHoras: item.ultimo_ciclo_horas,
  }
}
