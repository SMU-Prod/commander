export interface Embarcacao {
  id: string
  nome: string
  estaleiro: string | null
  modelo: string | null
  ano: number | null
  comprimento_m: number | null
  boca_m: number | null
  calado_m: number | null
  casco_material: string | null
  casco_numero: string | null
  tie: string | null
  capitania: string | null
  propulsao: string | null
  marina: string | null
  marina_lat: number | null
  marina_lon: number | null
  created_at: string
}

export interface Equipamento {
  id: string
  embarcacao_id: string
  tipo: "motor" | "gerador" | "bateria" | "outro"
  posicao: "BB" | "BE" | "central" | null
  marca: string | null
  modelo: string | null
  numero_serie: string | null
  ano: number | null
  potencia_hp: number | null
  combustivel: string | null
  horas_atuais: number | null
  ultima_leitura: string | null
  created_at: string
}

export type CategoriaItem =
  | "documento" | "deck" | "fibra" | "inox" | "vidros" | "estofados" | "casco_outros"

export interface ItemMonitorado {
  id: string
  embarcacao_id: string
  equipamento_id: string | null
  nome: string
  categoria: CategoriaItem | null
  intervalo_horas: number | null
  intervalo_meses: number | null
  data_fixa: string | null
  ultimo_ciclo_data: string | null
  ultimo_ciclo_horas: number | null
  created_at: string
}

export type TipoEvento =
  | "manutencao" | "abastecimento" | "navegacao" | "avaria" | "docagem" | "leitura_horas" | "outro"

export interface PontoTrilhaDb {
  t: number
  la: number
  lo: number
}

export interface Evento {
  id: string
  embarcacao_id: string
  equipamento_id: string | null
  item_monitorado_id: string | null
  contato_id: string | null
  tipo: TipoEvento
  categoria: CategoriaItem | null
  data: string
  horas_no_momento: number | null
  descricao: string | null
  custo_centavos: number | null
  anexo_path: string | null
  trilha: PontoTrilhaDb[] | null
  tem_trilha: boolean
  criado_por: string | null
  created_at: string
}

export interface Contato {
  id: string
  embarcacao_id: string
  nome: string
  especialidade: string | null
  telefone: string | null
  avaliacao: number | null
  created_at: string
}

export interface Documento {
  id: string
  embarcacao_id: string
  nome: string
  arquivo_path: string | null
  validade: string | null
  item_monitorado_id: string | null
  created_at: string
}

export interface PushAssinatura {
  id: string
  usuario_id: string
  endpoint: string
  p256dh: string
  auth: string
  created_at: string
}

export type JanelaAlertaDb = "d30" | "d15" | "d5" | "vencido" | "h_margem" | "h_vencido"

export interface AlertaEnviado {
  id: string
  embarcacao_id: string
  item_monitorado_id: string
  janela: JanelaAlertaDb
  ciclo_ref: string
  titulo: string
  enviado_em: string
}
