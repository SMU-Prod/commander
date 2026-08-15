/** Estilos compartilhados dos formulários da ficha (embarcação, equipamento, item, perfil). */
export const campo = "w-full rounded-[10px] border border-line bg-campo px-3 py-3 text-base"
export const rot = "rotulo mb-1.5 block text-dim"

/**
 * Linha de dois campos lado a lado (onda 55).
 *
 * POR QUE `items-end` E NÃO SÓ `grid-cols-2`. O app é usado a 390px e o
 * container é limitado a 430px, então cada célula desta linha tem ~173px.
 * Rótulo com mais de ~18 caracteres ("Horas no último serviço",
 * "Identificação interna", "Telefone (com DDD)") quebra em duas linhas em
 * UMA das células — e como o padrão do grid é `stretch` com o conteúdo
 * fluindo do topo, só o campo daquela célula descia. O resultado era a
 * "escadinha": dois controles da mesma linha em alturas diferentes, que é
 * parte do que o dono descreveu como "caixas em cima de outras caixas".
 *
 * `items-end` alinha os controles pela BASE, então o rótulo pode quebrar à
 * vontade que os campos continuam na mesma linha. Vale só quando nenhum dos
 * dois campos tem `dica`/`erro` embaixo — com texto de apoio, quem alinha é
 * a base do texto, e aí o certo é empilhar (uma linha por campo).
 */
export const linhaCampos = "grid grid-cols-2 items-end gap-3"

/** Número (ou null) para o valor inicial de um campo em pt-BR, ex.: 14.6 → "14,6". */
export function numeroParaCampoPtBr(v: number | null): string {
  return v == null ? "" : String(v).replace(".", ",")
}
