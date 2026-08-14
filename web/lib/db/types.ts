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
  | "hidraulica_agua_doce" | "hidraulica_grey_water" | "hidraulica_black_water" | "seguranca"

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
  /** saída criada por importação de GPX do plotter (onda 21), não gravada ao vivo. */
  importado_do_plotter: boolean
  /** true quando o GPX original não tinha horário em algum ponto — duração/velocidade
   *  não são exibidas pra essa saída (seriam fabricadas), só a distância. */
  trilha_sem_horario: boolean
  /** fingerprint da trilha original — usado só pra detectar reimportação, nunca exibido. */
  origem_hash: string | null
  created_at: string
}

// Ocorrências (onda 32) — entidade com estado, ver web/lib/domain/ocorrencias.ts.
export type EstadoOcorrenciaDb = "aberta" | "em_acompanhamento" | "resolvida"
export type AbaOcorrenciaDb =
  | "embarcacao" | "motores" | "eletrica" | "casco" | "hidraulica" | "seguranca" | "equipamentos" | "documentos"
export type GravidadeOcorrenciaDb = "baixa" | "media" | "alta"

export interface Ocorrencia {
  id: string
  embarcacao_id: string
  aba: AbaOcorrenciaDb
  equipamento_id: string | null
  item_monitorado_id: string | null
  evento_id: string | null
  titulo: string
  descricao: string | null
  estado: EstadoOcorrenciaDb
  gravidade: GravidadeOcorrenciaDb | null
  anexo_path: string | null
  criado_por: string | null
  resolvida_em: string | null
  created_at: string
}

export interface OcorrenciaTransicao {
  id: string
  ocorrencia_id: string
  estado_anterior: EstadoOcorrenciaDb | null
  estado_novo: EstadoOcorrenciaDb
  observacao: string | null
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

/** Onda 15 ("motor vivo") — sistema do equipamento (Arrefecimento, Injeção,
 *  Elétrica do motor, Transmissão...), opcionalmente apontando pra página
 *  certa de um documento do acervo. Ver `web/lib/domain/sistemas.ts`. */
export interface EquipamentoSistema {
  id: string
  equipamento_id: string
  nome: string
  documento_id: string | null
  pagina: number | null
  observacao: string | null
  ordem: number
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

// Onda 39 — "tipo" separa Comandantes (§47, skipper contratável) de
// Prestadores (§50, mecânico/eletricista/fibra...) na MESMA tabela/RLS/
// trigger anti-autoverificação (migration 037) em vez de inventar
// arquitetura nova. `categoria` guarda a habilitação (comandante) ou a
// especialidade (prestador) — mesmo campo texto-livre dos dois tipos, ver
// web/lib/domain/prestadores.ts pras sugestões de especialidade.
export type TipoPerfilComandante = "comandante" | "prestador"

export interface PerfilComandante {
  usuario_id: string
  tipo: TipoPerfilComandante
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

// Oportunidades (onda 39, PRD upgrade2-master §49/§53-54) — o mural do
// PRD Marketplace: publica uma demanda (vaga, diária, peça/serviço —
// "COMPRO — Rádio VHF"), prestadores/comandantes respondem. Ver migration
// 037 (tabelas) e 038 (nome autodeclarado do autor/respondente — profiles
// tem RLS de tripulação, ver comentário na migration). Nome final
// "Oportunidades" (não "Marketplace") — ver docs/CONTRIBUTING.md, Glossário.
export type TipoOportunidade = "vaga" | "diaria" | "peca_servico"
export type StatusOportunidade = "aberta" | "atendida" | "encerrada"

export interface Oportunidade {
  id: string
  autor_id: string
  autor_nome: string
  tipo: TipoOportunidade
  titulo: string
  categoria: string | null
  descricao: string | null
  local: string | null
  status: StatusOportunidade
  created_at: string
}

export interface RespostaOportunidade {
  id: string
  oportunidade_id: string
  respondente_id: string
  nome: string
  mensagem: string
  telefone: string | null
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
  /** Admin Commander (onda 35) — concedido manualmente via SQL, nunca autoatendido. */
  is_admin: boolean
}

// Commander Gold (onda 35) — fluxo completo: SOLICITAR → PAGAMENTO →
// AGENDAMENTO → AVALIAÇÃO PRESENCIAL → PROTOCOLO COMMANDER → ANÁLISE →
// APROVAÇÃO → COMMANDER GOLD. Ver web/lib/domain/gold.ts e migration 033.
export type FaixaPorteGold = "ate_30" | "31_40" | "41_50" | "51_60" | "61_80" | "81_mais"

export interface GoldPreco {
  faixa: FaixaPorteGold
  rotulo: string
  limite_pes: number | null
  valor_centavos: number | null
  atualizado_por: string | null
  atualizado_em: string
}

export interface GoldConsultor {
  id: string
  usuario_id: string | null
  nome: string
  email: string | null
  telefone: string | null
  regiao: string | null
  ativo: boolean
  criado_em: string
}

export type EstadoSolicitacaoGold =
  | "solicitado" | "aguardando_pagamento" | "pago" | "aguardando_agendamento" | "agendado"
  | "avaliacao_realizada" | "em_analise" | "aprovado" | "reprovado" | "cancelado"

export interface GoldSolicitacao {
  id: string
  embarcacao_id: string | null
  embarcacao_externa_nome: string | null
  embarcacao_externa_local: string | null
  embarcacao_externa_obs: string | null
  faixa_porte: FaixaPorteGold
  solicitante_id: string
  papel_solicitante: "proprietario" | "interessado"
  quem_paga: "proprio" | "interessado"
  estado: EstadoSolicitacaoGold
  criado_em: string
  atualizado_em: string
}

export interface GoldPagamento {
  id: string
  solicitacao_id: string
  quem_paga: "proprio" | "interessado"
  valor_centavos: number
  status: "pendente" | "pago" | "falhou" | "cancelado"
  asaas_customer_id: string | null
  asaas_payment_id: string | null
  link_pagamento: string | null
  metodo: string | null
  pago_em: string | null
  criado_em: string
}

export interface GoldAgendamento {
  id: string
  solicitacao_id: string
  consultor_id: string | null
  data_hora: string
  local: string | null
  status: "agendado" | "confirmado" | "realizado" | "cancelado" | "reagendado"
  observacoes: string | null
  criado_em: string
}

export const HUBS_PROTOCOLO_GOLD = [
  "motores", "casco", "eletrica", "hidraulica", "seguranca", "equipamentos", "documentacao", "historico",
] as const
export type HubProtocoloGold = (typeof HUBS_PROTOCOLO_GOLD)[number]
export type EstadoItemProtocolo = "avaliado" | "atencao" | "na"

export interface GoldAvaliacao {
  id: string
  solicitacao_id: string
  consultor_id: string | null
  agendamento_id: string | null
  data_avaliacao: string | null
  versao_protocolo: string
  status: "em_andamento" | "concluida"
  resultado: "aprovado" | "reprovado" | null
  validade_meses: 6 | 12 | null
  observacoes_gerais: string | null
  criado_em: string
  atualizado_em: string
}

export interface GoldProtocoloItem {
  id: string
  avaliacao_id: string
  hub: HubProtocoloGold
  estado: EstadoItemProtocolo
  observacao: string | null
  atualizado_em: string
}

export interface GoldSelo {
  id: string
  embarcacao_id: string
  solicitacao_id: string
  avaliacao_id: string
  consultor_id: string | null
  data_avaliacao: string
  validade_meses: 6 | 12
  validade_ate: string
  versao_protocolo: string
  criado_em: string
  atualizado_em: string
}

export interface PremiumConcessao {
  id: string
  usuario_id: string
  origem: "gold"
  origem_id: string | null
  valido_ate: string
  criado_em: string
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

// Corredores (onda 17) — agregado ANONIMO por celula de passagens reais de
// barcos, sem embarcacao_id/usuario_id nenhum (diferente da Sondagem acima).
// Ver web/lib/domain/rota.ts e migration 029_corredores.sql.
export interface CorredorAgregado {
  celula_id: string
  lat: number
  lon: number
  passagens: number
}

// Viagens (onda 19, Pilar Strava do Mar) — planejamento com paradas. Ver
// web/lib/domain/viagem.ts (montagem de pernas/ETA) e migration 030_viagens.
export interface ParadaDb {
  nome: string
  la: number
  lo: number
}

export interface Viagem {
  id: string
  embarcacao_id: string
  nome: string
  data_prevista: string
  paradas: ParadaDb[]
  criado_por: string | null
  created_at: string
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
