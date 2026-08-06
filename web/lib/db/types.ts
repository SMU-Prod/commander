export interface Embarcacao {
  id: string
  nome: string
  estaleiro: string | null
  modelo: string | null
  ano: number | null
  marina: string | null
}

export interface Equipamento {
  id: string
  embarcacao_id: string
  tipo: "motor" | "gerador" | "bateria" | "outro"
  posicao: "BB" | "BE" | "central" | null
  marca: string | null
  modelo: string | null
  horas_atuais: number | null
  ultima_leitura: string | null
}

export interface ItemMonitorado {
  id: string
  embarcacao_id: string
  equipamento_id: string | null
  nome: string
  intervalo_horas: number | null
  intervalo_meses: number | null
  data_fixa: string | null
  ultimo_ciclo_data: string | null
  ultimo_ciclo_horas: number | null
}

export interface Evento {
  id: string
  embarcacao_id: string
  equipamento_id: string | null
  item_monitorado_id: string | null
  tipo: "manutencao" | "abastecimento" | "navegacao" | "avaria" | "docagem" | "leitura_horas"
  data: string
  horas_no_momento: number | null
  descricao: string | null
  custo_centavos: number | null
}
