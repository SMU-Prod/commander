import { textoDuracao } from "@/lib/domain/bordo"

export interface DadosCompartilharSaida {
  distanciaNm: number | null
  duracaoH: number | null
  origem: string | null
  destino: string | null
}

/**
 * Texto pronto pra Web Share API / clipboard ao compartilhar uma saída
 * (onda 18). Puro e testável — só menciona o que a saída realmente tem:
 * distância só com trilha (>0), duração só com hora_saida/hora_retorno,
 * rota só com origem e/ou destino. Nunca inventa dado pra saída antiga sem
 * trilha — na ausência de tudo, ainda sai um texto honesto ("Saída
 * registrada"), nunca uma frase vazia.
 */
export function textoCompartilharSaida(d: DadosCompartilharSaida): string {
  const medida = [
    d.distanciaNm != null && d.distanciaNm > 0
      ? `${d.distanciaNm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MN`
      : null,
    d.duracaoH != null ? textoDuracao(d.duracaoH) : null,
  ].filter((v): v is string => v != null)

  const cabecalho = medida.length > 0 ? `Saída de ${medida.join(" em ")}` : "Saída registrada"

  const rota = d.origem && d.destino
    ? ` — ${d.origem} → ${d.destino}`
    : d.destino
      ? ` — rumo a ${d.destino}`
      : ""

  return `${cabecalho}${rota}, pelo Commander`
}
