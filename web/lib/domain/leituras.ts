import { formatarCarimbo } from "@/lib/domain/datas"

const SALTO_MAXIMO_H = 500

export function validarLeitura(
  nova: number,
  atual: number | null,
): { ok: true } | { ok: false; erro: string } {
  if (!Number.isFinite(nova) || nova <= 0) {
    return { ok: false, erro: "Informe um número de horas válido." }
  }
  if (atual != null && nova < atual) {
    return { ok: false, erro: `A leitura (${nova} h) é menor que a atual (${atual} h). Horímetro não anda para trás.` }
  }
  if (atual != null && nova - atual > SALTO_MAXIMO_H) {
    return { ok: false, erro: `Salto de ${Math.round(nova - atual)} h de uma vez — confira a leitura.` }
  }
  return { ok: true }
}

/**
 * O carimbo humano do horímetro na ficha de equipamento (canvas tela-3c):
 * "Informado à mão em 09/08, 18:40 por Erick." — horímetro é dado de gente,
 * não telemetria (PRD §11); dizer QUEM informou e QUANDO é o que dá
 * confiança no número gigante logo acima. Reusa `formatarCarimbo` (o mesmo
 * carimbo do cartão Motores da Início) — nenhum formato novo de data; só a
 * concordância muda quando o carimbo é relativo ("hoje"/"ontem" no meio da
 * frase, não "em Hoje"). Sem autor conhecido (conta removida, evento antigo
 * sem `criado_por`), a frase fica só com o quando — nunca inventa um nome.
 */
export function carimboDaLeitura(criadoEm: string, nome: string | null, agora?: Date): string {
  const quando = formatarCarimbo(criadoEm, agora)
  const frase = quando.startsWith("Hoje")
    ? `hoje${quando.slice("Hoje".length)}`
    : quando.startsWith("Ontem")
      ? `ontem${quando.slice("Ontem".length)}`
      : `em ${quando}`
  return `Informado à mão ${frase}${nome ? ` por ${nome}` : ""}.`
}

/**
 * Decide se uma leitura de horas deve virar a leitura oficial do equipamento
 * (`equipamentos.horas_atuais`) — horímetro não anda para trás. Diferente de
 * `validarLeitura` (usada em "Voltei ao mar", que também barra saltos grandes
 * de uma vez): aqui a leitura pode vir de um evento do diário registrado com
 * meses de intervalo do anterior, então um salto grande é normal, não
 * suspeito — só a regressão é. Leitura igual à atual também propaga (confirma
 * que a informação foi conferida agora, atualiza `ultima_leitura`).
 */
export function devePropagarLeitura(nova: number, atual: number | null): boolean {
  return atual == null || nova >= atual
}
