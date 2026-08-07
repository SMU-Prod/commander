/** Estilos compartilhados dos formulários da ficha (embarcação, equipamento, item, perfil). */
export const campo = "w-full rounded-[10px] border border-line bg-campo px-3 py-3 text-base"
export const rot = "rotulo mb-1.5 block text-dim"

/** Número (ou null) para o valor inicial de um campo em pt-BR, ex.: 14.6 → "14,6". */
export function numeroParaCampoPtBr(v: number | null): string {
  return v == null ? "" : String(v).replace(".", ",")
}
