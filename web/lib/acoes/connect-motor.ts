import type { SupabaseClient } from "@supabase/supabase-js"
import { atualizarLeituraEquipamento } from "@/lib/acoes/leituras"
import { devePropagarLeitura } from "@/lib/domain/leituras"
import type { MotorDinamico } from "@/lib/nmea/n2k-motor"

/**
 * Onda 34 — "Connect ligado ao Diário" (PRD, `docs/prd/commander-connect.txt`,
 * seção 5: "a aplicação mais importante é o Diário de Bordo... o Connect
 * pode reduzir preenchimento manual, registrar uso real dos motores").
 *
 * Quando o Connect tiver horas de motor confiáveis (`horasMotor`
 * decodificado de PGN 127489, ver `web/lib/nmea/n2k-motor.ts`), elas
 * alimentam a leitura oficial do equipamento pelo MESMO caminho que
 * "Voltei ao mar" (`web/lib/acoes/registro.ts`) e o registro de serviço do
 * Diário (`web/lib/acoes/eventos.ts`) já usam: `devePropagarLeitura`
 * decide SE propaga (nunca regride o horímetro — mesma régua dos outros
 * dois chamadores), `atualizarLeituraEquipamento` faz a MESMA escrita.
 * Nenhuma linha nova de `update equipamentos` nasce aqui — é o motivo
 * desta função existir em vez de gravar direto: um único ponto de
 * escrita, reusado.
 *
 * Não há hardware Commander Connect nesta onda (a caixa física ainda não
 * existe), então nada chama esta função em produção ainda; ela fica
 * pronta pro dia em que um transporte N2K real (irmão de
 * `web/lib/nmea/signalk.ts`/`nativo.ts`) entregar `MotorDinamico` de um
 * motor de verdade. Coberta por teste com dado do simulador
 * (`web/lib/acoes/connect-motor.test.ts`, que spawna
 * `scripts/simular-n2k.mjs` de verdade). UI: sem Connect instalado, nada
 * muda — nenhuma tela nova depende deste caminho nesta onda.
 *
 * Sem `"use server"` de propósito (mesmo motivo de `./leituras.ts`): esta
 * função recebe um `SupabaseClient`, que não é serializável — não pode
 * ser exportada de um arquivo de Server Actions.
 */
export type ResultadoSincronizacaoHorasConnect =
  | { status: "propagou"; horas: number }
  | { status: "sem_dado" }
  | { status: "nao_avancou" }
  | { status: "erro"; erro: string }

export async function sincronizarHorasMotorConnect(
  supabase: SupabaseClient,
  equipamentoId: string,
  horasAtuaisEquipamento: number | null,
  motor: Pick<MotorDinamico, "horasMotor">,
): Promise<ResultadoSincronizacaoHorasConnect> {
  if (motor.horasMotor == null) return { status: "sem_dado" }
  if (!devePropagarLeitura(motor.horasMotor, horasAtuaisEquipamento)) return { status: "nao_avancou" }

  const { data, error } = await atualizarLeituraEquipamento(supabase, equipamentoId, motor.horasMotor)
  if (error || !data?.length) {
    return { status: "erro", erro: "Não foi possível atualizar a leitura do equipamento." }
  }
  return { status: "propagou", horas: motor.horasMotor }
}
