import type { NomeIconeParceiro } from "@/lib/mapa/pino-parceiro"

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
  foto_capa_path: string | null
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
  identificacao_interna: string | null
  quantidade: number | null
  foto_path: string | null
  observacoes: string | null
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
  especificacao: string | null
  quantidade: string | null
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
  hora_saida: string | null
  hora_retorno: string | null
  destino: string | null
  tripulacao: string[]
  mar_onda_m: number | null
  mar_vento_kt: number | null
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

export interface Vinculo {
  id: string
  usuario_id: string
  embarcacao_id: string
  papel: "PROP" | "CMDT"
  nivel: string
  permissoes: Record<string, { ver?: boolean; editar?: boolean }> | null
  created_at: string
}

export interface Convite {
  id: string
  embarcacao_id: string
  codigo: string
  permissoes: Record<string, { ver?: boolean; editar?: boolean }>
  nivel: string
  criado_por: string | null
  expira_em: string
  usado_por: string | null
  usado_em: string | null
  created_at: string
}

export interface PerfilComandante {
  usuario_id: string
  nome_publico: string
  categoria: string | null
  cidade: string | null
  bio: string | null
  telefone: string | null
  disponibilidade: string | null
  visivel: boolean
  verificado: boolean
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

export type JanelaAlertaDb = "d30" | "d15" | "d5" | "vencido" | "h_margem" | "h_vencido" | "mar_ruim" | "motor_parado"

export interface AlertaEnviado {
  id: string
  embarcacao_id: string
  item_monitorado_id: string | null
  equipamento_id: string | null
  janela: JanelaAlertaDb
  ciclo_ref: string
  titulo: string
  enviado_em: string
}

export type AlbumFoto = "exterior" | "interior" | "conves" | "documentacao"

export interface Foto {
  id: string
  embarcacao_id: string
  album: AlbumFoto
  arquivo_path: string
  bytes: number
  legenda: string | null
  criado_por: string | null
  created_at: string
}

export interface Perfil {
  id: string
  nome: string
  telefone: string | null
  avatar_path: string | null
  created_at: string
}

export type StatusAssinatura = "pendente" | "ativa" | "inadimplente" | "cancelada"

export interface Assinatura {
  id: string
  usuario_id: string
  asaas_customer_id: string
  asaas_subscription_id: string
  plano: "fundador_mensal" | "fundador_anual"
  status: StatusAssinatura
  valor_centavos: number
  fundador_numero: number | null
  criado_em: string
  atualizado_em: string
}

// Sondagem colaborativa (onda 13) — ver web/lib/domain/sondagem.ts.
export type TransporteSondagem = "signalk" | "nativo"

export interface Sondagem {
  id: string
  embarcacao_id: string
  usuario_id: string
  lat: number
  lon: number
  profundidade_m: number
  celula_id: string
  transporte: TransporteSondagem
  medido_em: string
  criado_em: string
  /** Chave de deduplicação do cliente (`loteId:celulaId`, onda 14 — ver
   *  `web/lib/nmea/fila.ts` e a migration `026_sondagens_idempotencia.sql`).
   *  `null` em linhas gravadas antes desta onda. */
  origem_id: string | null
}

/** Linha devolvida por `sondagens_por_celula` (RPC) — SEMPRE agregado por
 *  celula, nunca a leitura individual de alguem (ver migration 025). */
export interface CelulaSondagemAgregada {
  celula_id: string
  lat: number
  lon: number
  profundidade_m: number
  leituras: number
  ultima_leitura: string
}

export type CategoriaParceiro = "marina" | "posto" | "pousada" | "restaurante"
export type PlanoParceiro = "cortesia" | "basico" | "destaque"

export interface Parceiro {
  id: string
  usuario_id: string
  categoria: CategoriaParceiro
  nome: string
  sobre: string | null
  telefone: string | null
  email: string | null
  horario: string | null
  lat: number
  lng: number
  // Ícone/cor do pino no mapa — escolhidos pelo parceiro (onda 10, Pedido 2).
  // Paleta e conjunto de ícones curados: web/lib/mapa/pino-parceiro.ts.
  icone: NomeIconeParceiro
  cor: string
  preco_diaria_centavos: number | null
  preco_diesel_centavos: number | null
  calado_max_m: number | null
  tem_poita: boolean
  qtd_poitas: number | null
  traslado_incluso: boolean | null
  vaga_cortesia: boolean | null
  culinaria: string | null
  plano: PlanoParceiro
  visivel: boolean
  fotos: string[]
  visualizacoes: number
  precos_atualizados_em: string | null
  criado_em: string
  atualizado_em: string
}
