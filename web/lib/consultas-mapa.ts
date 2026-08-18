import { cache } from "react"
import { supabaseServer } from "@/lib/supabase/server"
import { carregarPainel, hojeISO, itemMonitoradoToItemCalc } from "@/lib/consultas"
import {
  estadoDaZona,
  ZONAS,
  zonaDaOcorrencia,
  type ItemParaZona,
  type ZonaEmbarcacao,
} from "@/lib/domain/mapa-embarcacao"
import { ESTADOS_QUE_PESAM_NA_SAUDE, type EstadoOcorrencia, type Gravidade } from "@/lib/domain/ocorrencias"
import {
  calcularSemaforo,
  PESO,
  temInformacaoSuficiente,
  type ResultadoCalc,
  type StatusFarol,
} from "@/lib/domain/semaforo"
import type { Equipamento, ItemMonitorado } from "@/lib/db/types"

/**
 * MAPA DA EMBARCAÇÃO (onda 61, T4) — a leitura que a tela `/barco/mapa` e o
 * cartão de entrada em `/barco` compartilham. Uma função só, com `cache()`,
 * pra porta e a sala nunca discordarem no número (mesma razão do Menu:
 * "o filtro é o MESMO da tela de destino, senão o número da porta discorda
 * do que a sala mostra").
 *
 * Nada aqui inventa régua: o farol por item é `calcularSemaforo` (o mesmo da
 * ficha e da Saúde), o corte de ocorrência viva é `ESTADOS_QUE_PESAM_NA_SAUDE`
 * (mesma origem de /barco/saude), o estado da zona é `estadoDaZona` e o
 * endereço da ocorrência é `zonaDaOcorrencia` — os dois de
 * `lib/domain/mapa-embarcacao.ts`, com teste.
 */

export interface EquipamentoNoMapa {
  equipamento: Equipamento
  /** Pior farol entre os itens monitorados COM informação — `null` quando
   *  não há nenhum dado por trás (nunca verde por omissão, onda 16). */
  status: StatusFarol | null
  /** O resultado do pior item, pro `textoRestante` da linha; `null` junto
   *  com `status`. Empate de status desempata pelo prazo mais apertado —
   *  é o "próximo vencimento" que a linha promete. */
  pior: ResultadoCalc | null
  /** Farol de CADA item com informação — o insumo cru que `estadoDaZona`
   *  pede (a régua agrega por item, não pelo resumo do equipamento). */
  itens: ItemParaZona[]
}

export interface OcorrenciaNoMapa {
  id: string
  titulo: string
  estado: EstadoOcorrencia
  gravidade: Gravidade | null
}

export interface ZonaDoMapa {
  zona: ZonaEmbarcacao
  equipamentos: EquipamentoNoMapa[]
  /** Ocorrências vivas com endereço nesta zona (ver `zonaDaOcorrencia`). */
  ocorrencias: OcorrenciaNoMapa[]
  estado: StatusFarol | null
}

export interface MapaDaEmbarcacao {
  /** Só zonas COM equipamento, na ordem espacial de `ZONAS` — zona vazia não
   *  vira pino nem linha (não se decora o vazio, DESIGN §6.4). */
  zonas: ZonaDoMapa[]
  /** Equipamentos sem zona — o grupo "Não mapeados" e o convite do dia 1. */
  naoMapeados: EquipamentoNoMapa[]
  /** Quantas zonas estão em atenção ou vencidas — o resumo do cartão de
   *  entrada ("X zonas pedem atenção"). */
  zonasPedindoAtencao: number
}

/** A urgência de um resultado, só pra DESEMPATAR itens de mesmo status na
 *  escolha do "pior": o menor prazo (dias ou horas) vence. Nunca vai pra
 *  tela — quem aparece é `textoRestante`. */
function prazoMaisApertado(r: ResultadoCalc): number {
  return Math.min(r.diasRestantes ?? Infinity, r.horasRestantes ?? Infinity)
}

function avaliarEquipamento(
  equipamento: Equipamento,
  itens: readonly ItemMonitorado[],
  hoje: string,
): EquipamentoNoMapa {
  const comInformacao = itens
    .filter((i) => i.equipamento_id === equipamento.id)
    .map((i) => {
      const calc = itemMonitoradoToItemCalc(i)
      return {
        r: calcularSemaforo(calc, equipamento.horas_atuais ?? null, hoje),
        temInformacao: temInformacaoSuficiente(calc, equipamento.horas_atuais ?? null),
      }
    })
    .filter((x) => x.temInformacao)
  if (comInformacao.length === 0) return { equipamento, status: null, pior: null, itens: [] }
  const pior = comInformacao
    .map((x) => x.r)
    .sort((a, b) => PESO[b.status] - PESO[a.status] || prazoMaisApertado(a) - prazoMaisApertado(b))[0]
  return {
    equipamento,
    status: pior.status,
    pior,
    itens: comInformacao.map((x) => ({ status: x.r.status, temInformacao: true })),
  }
}

export const carregarMapaDaEmbarcacao = cache(async (): Promise<MapaDaEmbarcacao | null> => {
  const painel = await carregarPainel()
  if (!painel) return null
  const { embarcacao, equipamentos, itens } = painel
  const hoje = hojeISO()

  const supabase = await supabaseServer()
  // Mesmo recorte de /barco/saude: só o que ainda pesa (aberta/em
  // acompanhamento) — resolvida e anulada não pintam zona nenhuma.
  const { data: ocorrenciasBrutas, error } = await supabase
    .from("ocorrencias")
    .select("id, titulo, aba, equipamento_id, estado, gravidade")
    .eq("embarcacao_id", embarcacao.id)
    .in("estado", [...ESTADOS_QUE_PESAM_NA_SAUDE])
    .order("created_at", { ascending: false })
  if (error) throw new Error("Não foi possível carregar o mapa da embarcação. Recarregue a página.")

  const avaliados = equipamentos.map((e) => avaliarEquipamento(e, itens, hoje))
  const naoMapeados = avaliados.filter((a) => a.equipamento.zona == null)

  const zonas = ZONAS.map((zona): ZonaDoMapa | null => {
    const daZona = avaliados.filter((a) => a.equipamento.zona === zona)
    if (daZona.length === 0) return null
    const ocorrencias = (ocorrenciasBrutas ?? [])
      .filter((o) => zonaDaOcorrencia(o, equipamentos) === zona)
      .map((o): OcorrenciaNoMapa => ({
        id: o.id, titulo: o.titulo, estado: o.estado as EstadoOcorrencia, gravidade: o.gravidade as Gravidade | null,
      }))
    const estado = estadoDaZona(
      daZona.map((a) => ({ id: a.equipamento.id })),
      daZona.flatMap((a) => a.itens),
      ocorrencias,
    )
    return { zona, equipamentos: daZona, ocorrencias, estado }
  }).filter((z): z is ZonaDoMapa => z != null)

  return {
    zonas,
    naoMapeados,
    zonasPedindoAtencao: zonas.filter((z) => z.estado === "atencao" || z.estado === "vencido").length,
  }
})
