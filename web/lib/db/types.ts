import type {
  DecisaoModeracao,
  RespostaSolucao,
  VisibilidadeAvaliacao,
} from "@/lib/domain/avaliacoes"
import type {
  CondicaoProduto,
  DecisaoConfirmacao,
  FormaEntrega,
  PapelNegocio,
  PeriodoVaga,
  StatusDemanda,
  StatusProposta,
  TipoDemanda,
  TipoTaxonomia,
  TipoTrabalho,
  TipoVaga,
} from "@/lib/domain/marketplace"
import type { ZonaEmbarcacao } from "@/lib/domain/mapa-embarcacao"
import type { PlanoId, PromocaoId } from "@/lib/domain/planos"
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
  /** Região da base (`taxonomia` tipo `regiao`), onda 52. É o que permite a
   *  segmentação regional da publicidade (§20) — sem isso o Dashboard só
   *  poderia exibir campanha sem segmentação. Fica nula até o proprietário
   *  escolher: ninguém deduz região a partir de lat/lon. */
  regiao_id: string | null
  foto_capa_path: string | null
  created_at: string
}

/** Tipo de bateria (PRD §14) — muda o regime de carga e a expectativa de
 *  vida útil, por isso o PRD pede o campo em vez de deixar no texto livre. */
export type TipoBateria = "chumbo_acido" | "agm" | "gel" | "litio" | "outro"

export interface Equipamento {
  id: string
  embarcacao_id: string
  tipo: "motor" | "gerador" | "bateria" | "painel" | "outro"
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
  /** Só faz sentido quando `tipo === "bateria"` (PRD §14). Null nos demais. */
  tipo_bateria: TipoBateria | null
  /** Zona física onde o equipamento mora (Mapa da Embarcação, onda 61).
   *  Nullable de propósito: equipamento sem zona aparece como "Não mapeado"
   *  no mapa — não se inventa dado nos existentes. */
  zona: ZonaEmbarcacao | null
  horas_atuais: number | null
  ultima_leitura: string | null
  created_at: string
}

export type CategoriaItem =
  | "documento" | "deck" | "fibra" | "inox" | "vidros" | "estofados" | "casco_outros"
  | "hidraulica_agua_doce" | "hidraulica_grey_water" | "hidraulica_black_water" | "seguranca"
  // Onda 41 (PRD §11): Óleo e Filtros deixam de ser nome livre e viram
  // subtipo. Estes sempre andam com `equipamento_id` (o motor), então a
  // área continua Motores — a categoria aqui é só o "que é isto".
  | "motor_oleo" | "motor_filtro_oleo" | "motor_filtro_combustivel"
  | "motor_filtro_ar" | "motor_filtro_outros"

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

// Checklist do Diário por hub (onda 40, ver web/lib/domain/checklist-diario.ts).
export type HubChecklistDiarioDb = "motores" | "casco" | "eletrica" | "hidraulica" | "seguranca"
export type EstadoChecklistHubDb = "ok" | "observacao"

export interface ItemChecklistDiarioDb {
  hub: HubChecklistDiarioDb
  estado: EstadoChecklistHubDb
  nota: string | null
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
  /** De onde a saída partiu (PRD §23) — texto livre: marina, poita, praia. */
  local_saida: string | null
  destino: string | null
  tripulacao: string[]
  /** Nomes livres de quem estava a bordo sem ser tripulação cadastrada
   *  (PRD §23). Dado pessoal: o PRD §27 cita "Passageiros" entre o que NÃO
   *  acompanha o barco numa transferência — `aceitar_transferencia` limpa. */
  passageiros: string[]
  mar_onda_m: number | null
  mar_vento_kt: number | null
  /** Checklist rápido por hub (onda 40, PRD §23) — só existe em saídas
   *  (`tipo === "navegacao"`) onde o dono tocou o checklist; `null` quando
   *  ninguém tocou (nunca um array com os 5 hubs "ok" inventado). */
  checklist: ItemChecklistDiarioDb[] | null
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
// "anulada" entrou na onda 44 (PRD §7, migration 045) — não é exclusão: a
// linha fica, com motivo, autor e data nas três colunas `*_anulacao/anulada_*`.
export type EstadoOcorrenciaDb = "aberta" | "em_acompanhamento" | "resolvida" | "anulada"
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
  /** Preenchidas juntas, e só quando `estado = 'anulada'` — o banco garante
   *  isso num check constraint (migration 045): anular "com registro" (PRD §7)
   *  não pode depender de o app lembrar de preencher. */
  anulada_em: string | null
  anulada_por: string | null
  motivo_anulacao: string | null
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

// Financeiro (onda 42, PRD FINAL §9.1–9.3) — ver web/lib/domain/financeiro.ts
// e migration 042. `lancamentos_financeiros` é a FONTE do dinheiro do barco:
// `eventos.custo_centavos` continua existindo como histórico do evento, mas
// nenhuma tela soma as duas coisas (seria contar o mesmo gasto duas vezes).
export interface LancamentoFinanceiro {
  id: string
  embarcacao_id: string
  tipo: TipoLancamentoDb
  categoria: CategoriaFinanceiraDb
  descricao: string
  valor_centavos: number
  data: string
  status: StatusLancamentoDb
  fornecedor: string | null
  forma_pagamento: FormaPagamentoDb | null
  comprovante_path: string | null
  observacao: string | null
  /** Evento do Diário que originou o lançamento ("Adicionar ao Financeiro").
   *  Índice único no banco: o mesmo evento nunca vira dois lançamentos. */
  evento_id: string | null
  /** Série recorrente deste vencimento. `null` = lançamento variável. */
  recorrencia_id: string | null
  /** Gasto da Carteira da Tripulação que virou despesa da embarcação. */
  carteira_movimento_id: string | null
  /** Negócio do Marketplace confirmado pelos dois lados que virou despesa
   *  ("Adicionar ao Financeiro", §11.6). Índice único + trigger na migration
   *  054: o mesmo negócio nunca vira dois lançamentos, e proposta sem
   *  confirmação bilateral não vira despesa nenhuma (§9.1). */
  negocio_id: string | null
  criado_por: string | null
  created_at: string
}

export type TipoLancamentoDb = "despesa" | "entrada"
export type StatusLancamentoDb = "pago" | "pendente"
export type CategoriaFinanceiraDb =
  | "marina_vaga" | "combustivel" | "manutencao" | "tripulacao" | "seguro"
  | "documentacao_taxas" | "limpeza_conservacao" | "pecas_equipamentos" | "transporte" | "outros"
export type FormaPagamentoDb =
  | "dinheiro" | "pix" | "cartao_credito" | "cartao_debito" | "boleto" | "transferencia" | "outro"
export type FrequenciaDb = "semanal" | "mensal" | "trimestral" | "semestral" | "anual"

export interface RecorrenciaFinanceira {
  id: string
  embarcacao_id: string
  tipo: TipoLancamentoDb
  categoria: CategoriaFinanceiraDb
  descricao: string
  valor_centavos: number
  frequencia: FrequenciaDb
  inicio: string
  /** Último dia coberto. Preenchido quando o dono muda o valor escolhendo
   *  "este e os próximos": a série antiga fecha e nasce outra (`origem_id`). */
  fim: string | null
  fornecedor: string | null
  forma_pagamento: FormaPagamentoDb | null
  observacao: string | null
  ativa: boolean
  origem_id: string | null
  criado_por: string | null
  created_at: string
}

// Carteira da Tripulação (onda 42, PRD FINAL §9.4) — ver
// web/lib/domain/carteira.ts e migration 043. Controle contábil de valores
// informados: o Commander não guarda, transfere nem movimenta dinheiro.
export type ModoCarteiraDb = "direto" | "aprovacao"
export type TipoMovimentoDb = "repasse" | "gasto" | "devolucao"
export type StatusMovimentoDb = "pendente" | "aprovado" | "recusado"

export interface Carteira {
  id: string
  embarcacao_id: string
  tripulante_id: string
  ativa: boolean
  exige_comprovante: boolean
  modo: ModoCarteiraDb
  observacao: string | null
  criado_por: string | null
  created_at: string
}

export interface CarteiraMovimento {
  id: string
  carteira_id: string
  tipo: TipoMovimentoDb
  valor_centavos: number
  data: string
  descricao: string
  /** Só o gasto tem — é a categoria com que ele entra no Financeiro. */
  categoria: CategoriaFinanceiraDb | null
  comprovante_path: string | null
  observacao: string | null
  status: StatusMovimentoDb
  motivo_recusa: string | null
  criado_por: string | null
  decidido_por: string | null
  decidido_em: string | null
  created_at: string
}

export interface Contato {
  id: string
  embarcacao_id: string
  nome: string
  empresa: string | null
  especialidade: string | null
  telefone: string | null
  email: string | null
  observacoes: string | null
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

// Transferência de propriedade (onda 37, PRD §27) — ver
// web/lib/acoes/transferencia.ts e migration 038_transferencia_embarcacao.
export type StatusTransferencia = "pendente" | "aceita" | "cancelada"

export interface Transferencia {
  id: string
  embarcacao_id: string
  de_usuario_id: string
  codigo: string
  destinatario_email: string
  status: StatusTransferencia
  para_usuario_id: string | null
  expira_em: string
  aceita_em: string | null
  cancelada_em: string | null
  criado_em: string
}

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
  // Onda 50 (migration 051, PRD §12) — "Perfil profissional: foto, função,
  // região, experiência, certificações, embarcações/portes...". Função e
  // região são ids de `taxonomia` (§11.2/§21.2: campos padronizados, não
  // texto livre) — os campos antigos `categoria`/`cidade` continuam vivos e
  // servem de fallback enquanto os novos estiverem vazios (§23, nada é
  // apagado). `foto_path` é o caminho no bucket público `perfis`.
  foto_path: string | null
  funcao_id: string | null
  regiao_id: string | null
  experiencia_anos: number | null
  porte_max_pes: number | null
  certificacoes: string | null
  atualizado_em: string
}

// MARKETPLACE ORIENTADO POR DEMANDA (onda 45, PRD upgrade2-master-final §11).
// Substitui `oportunidades`/`respostas_oportunidade` da onda 39 (migration 046
// migrou os dados e removeu as tabelas antigas — o porquê está no cabeçalho da
// migration). Note que `demandas` NÃO tem coluna `titulo`: o §11.2 manda o
// Commander gerar o título dos campos, e quem faz isso é `tituloDaDemanda`
// em lib/domain/marketplace.ts.
export interface ItemTaxonomiaDb {
  id: string
  tipo: TipoTaxonomia
  slug: string
  nome: string
  uf: string | null
  ordem: number
  ativo: boolean
  criado_em: string
}

export interface TaxonomiaSolicitacao {
  id: string
  solicitante_id: string
  tipo: TipoTaxonomia
  nome: string
  observacao: string | null
  status: "pendente" | "aprovada" | "recusada"
  criado_em: string
}

export interface Demanda {
  id: string
  autor_id: string
  autor_nome: string
  tipo: TipoDemanda
  regiao_id: string
  categoria_id: string | null
  funcao_id: string | null
  marca_id: string | null
  combustivel_id: string | null
  porte_pes: number | null
  tipo_vaga: TipoVaga | null
  quantidade_litros: number | null
  data_desejada: string | null
  data_fim: string | null
  observacao: string | null
  status: StatusDemanda
  expira_em: string
  criado_em: string
  atualizado_em: string
}

/** Tabela separada de propósito (§22): o telefone do proprietário só é
 *  legível depois que ele aceita a proposta — a RLS da migration 046 é quem
 *  garante, não a tela. */
export interface DemandaContato {
  demanda_id: string
  telefone: string | null
  email: string | null
  criado_em: string
}

export interface Proposta {
  id: string
  demanda_id: string
  autor_id: string
  autor_nome: string
  telefone: string | null
  disponibilidade: string | null
  data_possivel: string | null
  valor_centavos: number | null
  valor_a_combinar: boolean
  observacao: string | null
  precisa_visita: boolean | null
  marca_modelo: string | null
  condicao: CondicaoProduto | null
  entrega: FormaEntrega | null
  prazo_dias: number | null
  tipo_vaga: TipoVaga | null
  periodo: PeriodoVaga | null
  tem_agua_energia: boolean | null
  preco_litro_centavos: number | null
  quantidade_litros: number | null
  taxa_deslocamento_centavos: number | null
  valor_estimado_centavos: number | null
  status: StatusProposta
  criado_em: string
  atualizado_em: string
}

export interface Negocio {
  id: string
  demanda_id: string
  proposta_id: string
  cliente_id: string
  fornecedor_id: string
  valor_final_centavos: number | null
  criado_em: string
}

export interface NegocioConfirmacao {
  id: string
  negocio_id: string
  usuario_id: string
  papel: PapelNegocio
  decisao: DecisaoConfirmacao
  observacao: string | null
  criado_em: string
}

export interface InteresseMarketplace {
  id: string
  usuario_id: string
  tipo_demanda: TipoDemanda
  regiao_id: string
  categoria_id: string | null
  funcao_id: string | null
  combustivel_id: string | null
  porte_max_pes: number | null
  ativo: boolean
  criado_em: string
}

export interface Disponibilidade {
  id: string
  autor_id: string
  autor_nome: string
  funcao_id: string
  regiao_id: string
  tipo_trabalho: TipoTrabalho
  data_inicio: string | null
  data_fim: string | null
  experiencia_anos: number | null
  porte_max_pes: number | null
  certificacoes: string | null
  observacao: string | null
  telefone: string | null
  expira_em: string
  ativo: boolean
  criado_em: string
}

// AVALIAÇÕES E CONTESTAÇÕES (onda 49, PRD §14) — ver web/lib/domain/avaliacoes.ts
// e a migration 050. A linha só nasce a partir de um `negocio` confirmado
// pelos dois lados; isso é RLS, não convenção.
export interface Avaliacao {
  id: string
  negocio_id: string
  avaliador_id: string
  avaliado_id: string
  avaliador_nome: string
  avaliado_nome: string
  nota: number
  comentario: string | null
  visibilidade: VisibilidadeAvaliacao
  ocultada_em: string | null
  ocultada_por: string | null
  ocultacao_nota: string | null
  criado_em: string
  atualizado_em: string
}

/** Uma por avaliação (é a PK), e sempre um código da lista do §14.1 — nunca
 *  texto que o avaliado escreveu. */
export interface AvaliacaoResposta {
  avaliacao_id: string
  autor_id: string
  resposta_codigo: string
  criado_em: string
}

export interface AvaliacaoContestacao {
  id: string
  avaliacao_id: string
  autor_id: string
  motivo_codigo: string
  detalhe: string | null
  status: "pendente" | "analisada"
  decisao: DecisaoModeracao | null
  decidido_por: string | null
  decidido_em: string | null
  nota_admin: string | null
  criado_em: string
}

/** "Problema solucionado" (§14): o avaliado marca, o cliente confirma ou
 *  nega. Repare que não existe coluna de nota aqui — a nota não muda por
 *  causa disto, e a ausência da coluna é a garantia. */
export interface AvaliacaoSolucao {
  avaliacao_id: string
  marcado_por: string
  descricao: string | null
  marcado_em: string
  resposta: RespostaSolucao | null
  respondido_em: string | null
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

/**
 * Estado do selo Commander Verified por embarcação (onda 44, PRD §15,
 * migration 045). Duas datas e nada mais — é o mínimo que o prazo de 15 dias
 * exige pra existir; QUAL pilar caiu é sempre recalculado dos dados reais do
 * barco (ver `lib/domain/verified.ts`), nunca guardado aqui, pra não criar
 * uma segunda verdade que saia de sincronia com a primeira.
 */
export interface VerifiedEstado {
  embarcacao_id: string
  /** primeira vez que os cinco pilares ficaram de pé; null = nunca conquistado */
  conquistado_em: string | null
  /** quando o pilar caiu — é o relógio dos 15 dias; null = sem pendência */
  pendencia_desde: string | null
  atualizado_em: string
}

export type AlbumFoto = "exterior" | "interior" | "conves" | "documentacao" | "outros"

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
  // `is_admin` saiu na onda 48 (migration 049). O papel administrativo agora
  // mora em `admin_papeis` — ver `lib/domain/admin-papeis.ts` e o PRD §22
  // ("Admin deve operar por permissões de função, não por simples
  // 'admin=true'").
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
  /** Região da vistoria (`taxonomia` tipo `regiao`), onda 48. É o que a RLS
   *  usa pra limitar o Vistoriador às regiões autorizadas (PRD §21) — `null`
   *  significa "ainda não atribuída", e aí só CEO/Suporte enxergam. */
  regiao_id: string | null
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
  /** onda 47: `migracao`/`cortesia` entraram junto com as promoções do §2.1. */
  origem: "gold" | "migracao" | "cortesia"
  origem_id: string | null
  valido_ate: string
  /** onda 47 — a concessão agora nomeia o plano que entrega (§2.2: "6 meses do
   *  plano Commander"). Linhas antigas nascem com o default `commander`. */
  plano_concedido: PlanoId
  criado_em: string
}

/** Vocabulário do §23 — `inadimplente` virou `problema_pagamento` na onda 47
 *  (migration 048). A SITUAÇÃO derivada (tolerância, bloqueio) é calculada em
 *  `lib/domain/assinatura-ciclo.ts`, nunca gravada. */
export type StatusAssinatura = "pendente" | "ativa" | "problema_pagamento" | "cancelada"

export interface Assinatura {
  id: string
  usuario_id: string
  asaas_customer_id: string
  asaas_subscription_id: string
  plano: PlanoId
  status: StatusAssinatura
  valor_centavos: number
  /** Desde quando o pagamento falha — gravado pelo trigger do banco, é o que
   *  faz a tolerância do §23 ser contável. `null` fora do problema. */
  problema_desde: string | null
  criado_em: string
  atualizado_em: string
}

/** Tolerância configurável do §23 — linha única, mudada por SQL do dono. */
export interface AssinaturaParametros {
  id: true
  tolerancia_dias: number
  atualizado_em: string
}

/** Promoção vigente de uma pessoa (§2.1 migração, §2.2 entrada pelo Gold).
 *  O banco garante no máximo UMA vigente por usuário — não acumulam. */
export interface AssinaturaPromocao {
  id: string
  usuario_id: string
  promocao: PromocaoId
  plano: PlanoId
  valor_promocional_centavos: number
  desconto_gold_percentual: number
  valido_ate: string
  origem_id: string | null
  criado_em: string
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

// COMMANDER PARTNER (PRD §13) — `categoria` é o TIPO PRINCIPAL do Partner.
// "prestador" entrou na onda 51 (migration 052, §13.1). CUIDADO: não é o
// mesmo "prestador" de `perfis_comandante` (migration 037, tela
// /prestadores), que é PESSOA da rede profissional — aqui é conta Partner.
// Rótulos, menu e regras por tipo: web/lib/domain/partner.ts.
export type CategoriaParceiro =
  | "prestador" | "loja_nautica" | "marina" | "posto" | "restaurante" | "pousada" | "outros"
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
  // --- onda 51 / migration 052 (PRD §13 e §10) --------------------------
  /** Região da `taxonomia` — a MESMA lista do Marketplace (§10: "regiões
   *  padronizadas e compartilhadas"). Ponto no mapa não serve de filtro. */
  regiao_id: string
  /** §13.1 "Também vendo produtos" / §13.2 "Também presto serviços". Só o
   *  tipo dono do toggle pode ligá-lo — `atividadesValidas` em
   *  lib/domain/partner.ts é quem garante. */
  tambem_vende_produtos: boolean
  tambem_presta_servicos: boolean
  /** §13.3 "acesso náutico" / §13.5 "informações náuticas" / §13.6 "acesso
   *  pelo mar" — a mesma pergunta, uma coluna só. */
  acesso_nautico: string | null
  estrutura: string | null
  atracacao: string | null
  tem_combustivel: boolean
  /** "HH:MM:SS" ou null (§13.6). */
  check_in: string | null
  check_out: string | null
  /** §13.5 — galeria de IMAGENS do cardápio, separada de `fotos` (que são as
   *  do estabelecimento). Não existe cadastro de prato. */
  fotos_cardapio: string[]
}

/** Categoria/marca/combustível que o Partner declara atender (§13.1, §13.2,
 *  §13.4). Sempre id de `taxonomia` — §21.2 proíbe texto livre, e é isso que
 *  faz o filtro do Explorar e o matching do Marketplace falarem do mesmo
 *  "Elétrica". */
export interface ParceiroAtividade {
  parceiro_id: string
  taxonomia_id: string
  tipo: "categoria_servico" | "categoria_produto" | "marca" | "combustivel"
  criado_em: string
}

/** §13.3 — vaga seca/molhada da Marina. `disponiveis` é NÚMERO DECLARADO por
 *  ela, não saldo transacional: nada no app escreve aqui além da própria
 *  Marina, e `declarado_em` existe pra a tela mostrar a idade do número. */
export interface ParceiroVaga {
  parceiro_id: string
  tipo: "seca" | "molhada"
  total: number | null
  disponiveis: number | null
  porte_max_pes: number | null
  preco_diaria_centavos: number | null
  preco_mensal_centavos: number | null
  /** "sob consulta" é ESTADO, não preço zero (mesma decisão do Gold 81+ pés). */
  sob_consulta: boolean
  declarado_em: string
}

/** §13.6 — acomodação da Pousada/Hotel. `valor_diaria_centavos` é nullable
 *  porque o PRD diz "valores opcionais"; não há data/ocupação porque não há
 *  calendário nem booking no Upgrade 2. */
export interface ParceiroAcomodacao {
  id: string
  parceiro_id: string
  nome: string
  capacidade: number | null
  valor_diaria_centavos: number | null
  descricao: string | null
  ordem: number
  criado_em: string
}

// AGENDA (onda 43, PRD §8) — compromissos marcados. CUIDADO com o nome:
// `Evento` lá em cima é o DIÁRIO DE BORDO (o que já aconteceu); isto aqui é
// o que está MARCADO pra acontecer. Ver o cabeçalho da migration 044_agenda.
export type VisibilidadeAgendaDb = "particular" | "compartilhado" | "atribuido"

export interface AgendaEvento {
  id: string
  embarcacao_id: string
  titulo: string
  descricao: string | null
  /** "AAAA-MM-DD" */
  data: string
  /** "HH:MM:SS" ou null (compromisso de dia inteiro). */
  hora: string | null
  visibilidade: VisibilidadeAgendaDb
  /** Ponteiro opcional pra uma manutenção/documento. NUNCA concede acesso ao
   *  hub — quem lê o item continua passando pela RLS de `itens_monitorados`
   *  (PRD §8: "Receber um evento não concede acesso ao Hub relacionado"). */
  item_monitorado_id: string | null
  concluido_em: string | null
  criado_por: string | null
  created_at: string
}

export interface AgendaParticipante {
  evento_id: string
  usuario_id: string
  /** true = atribuído a essa pessoa, não só compartilhado. */
  responsavel: boolean
  created_at: string
}

// ADMIN COMMANDER (onda 48, PRD §21/§22) — papéis com escopo no lugar do
// `is_admin` binário. NÃO confundir com `permissoes.ts` (PROP/COMANDANTE/
// TRIPULANTE): aquilo é acesso à EMBARCAÇÃO, isto é cargo interno na empresa.
// Ver o cabeçalho de `lib/domain/admin-papeis.ts` e a migration 049.
export interface AdminPapelDb {
  id: string
  usuario_id: string
  papel: "ceo" | "suporte" | "comercial" | "vistoriador"
  ativo: boolean
  observacao: string | null
  criado_por: string | null
  criado_em: string
  atualizado_em: string
}

/** Regiões autorizadas — só fazem sentido no papel `vistoriador` (§21: "Não
 *  concede acesso nacional irrestrito"). Aponta pra `taxonomia` tipo
 *  `regiao`, a mesma lista do Marketplace. */
export interface AdminPapelRegiaoDb {
  papel_id: string
  regiao_id: string
  criado_em: string
}

/** §21.3 — "quem, quando, função, ação, entidade afetada e mudança de
 *  status". `papel` é texto congelado no momento da ação, não FK: revogar o
 *  papel amanhã não pode reescrever em que qualidade a pessoa agiu ontem. */
export interface AdminLogDb {
  id: string
  admin_id: string | null
  papel: string
  acao: string
  entidade: string
  entidade_id: string | null
  status_antes: string | null
  status_depois: string | null
  detalhes: Record<string, unknown> | null
  criado_em: string
}
