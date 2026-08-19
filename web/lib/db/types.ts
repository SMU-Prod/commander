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
import type { DestinoAfazer, EstadoAfazer } from "@/lib/domain/afazeres"
import type {
  AcaoSobreEnvio,
  EstadoEnvio,
  TipoEnvio,
} from "@/lib/domain/cotista-plano"
import type { CategoriaEstoque } from "@/lib/domain/estoque-combustivel"
import type { EstadoServico } from "@/lib/domain/mecanica"
import type { ZonaEmbarcacao } from "@/lib/domain/mapa-embarcacao"
import type { PlanoId, PromocaoId } from "@/lib/domain/planos"
import type { TipoEmbarcacao } from "@/lib/domain/tipo-embarcacao"
import type { NomeIconeParceiro } from "@/lib/mapa/pino-parceiro"

export interface Embarcacao {
  id: string
  nome: string
  estaleiro: string | null
  modelo: string | null
  /** Tipo do barco (enum `tipo_embarcacao`, migration 056) — os chips do
   *  onboarding (canvas tela-3j). Nullable de propósito: barco existente
   *  fica sem tipo até o dono escolher em /barco/editar — não se inventa
   *  dado. É também o futuro seletor do modelo 3D do Mapa da Embarcação. */
  tipo: TipoEmbarcacao | null
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
  /** §13 do PRD Upgrade 3 — quantas vagas de cotista esta unidade tem
   *  (migration 061). `0` = não é unidade de cotas. A OCUPAÇÃO não fica
   *  aqui: é derivada da contagem de vínculos com papel COTISTA, pra
   *  "redefinir o link" não zerar a conta e "remover acesso" liberar vaga
   *  sozinho. */
  cotas_total: number
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
  /** Vínculo com o catálogo de motor (onda 64, PRD 3D §16). Nullable e
   *  opcional POR DESENHO: `marca`/`modelo` em texto livre continuam
   *  valendo e nunca são apagados. Quem escolhe do catálogo ganha
   *  identidade (e, na onda 67, os hotspots 3D da família); quem tem motor
   *  fora do catálogo continua digitando. */
  motor_modelo_id: string | null
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
  /** O part number que o DONO usa (onda 64, PRD 3D §16): quem troca a peça
   *  pode usar um equivalente de fornecedor, e o que importa na recompra é o
   *  dele, não o código OEM do catálogo.
   *
   *  COLETADO E NUNCA EXIBIDO — medido em 19/08/2026. Os formulários de
   *  `barco/itens/novo` e `barco/itens/[id]/editar` pedem este campo e
   *  nenhuma tela o mostra de volta. A função que escolhia entre este código
   *  e o do catálogo (`partNumberVigente`) foi apagada por não ter
   *  consumidor; o histórico está no comentário que ficou no lugar dela, em
   *  `lib/domain/catalogo-motor.ts`. */
  part_number_oem: string | null
  /** Vínculo com o componente do catálogo. Nullable: item criado à mão
   *  ("Troca de óleo BB") continua existindo sem componente nenhum. */
  motor_componente_id: string | null
  created_at: string
}

// ---------------------------------------------------------------------------
// Catálogo de motor (onda 64 — migrations 057/058)
// ---------------------------------------------------------------------------
// Vocabulário do produto, não dado de ninguém: leitura aberta a quem está
// logado, escrita só admin — mesma política de `taxonomia`.

export interface MotorFabricante {
  id: string
  slug: string
  nome: string
  segmento: "popa" | "centro_rabeta" | "diesel_interno"
  ordem: number
  ativo: boolean
  criado_em: string
}

export interface MotorFamilia {
  id: string
  fabricante_id: string
  slug: string
  nome: string
  observacao: string | null
  ordem: number
  ativo: boolean
  criado_em: string
}

export interface MotorModelo {
  id: string
  familia_id: string
  slug: string
  nome: string
  potencia_hp: number | null
  /** As duas pontas nullable: motor em linha não tem ano final, e de motor
   *  antigo às vezes não se sabe o inicial. */
  ano_inicio: number | null
  ano_fim: number | null
  combustivel: string | null
  ordem: number
  ativo: boolean
  criado_em: string
}

export interface MotorComponente {
  id: string
  familia_id: string
  slug: string
  nome: string
  sistema: SistemaMotorDb
  /** Nasce nulo na semente (migration 058): inventar código OEM faria o dono
   *  comprar a peça errada confiando no app. */
  part_number_oem: string | null
  /** Idem: chutar intervalo num app que existe pra avisar de manutenção é o
   *  tipo de erro que estraga motor. Vem do manual ou não vem. */
  intervalo_horas: number | null
  intervalo_meses: number | null
  ordem: number
  ativo: boolean
  criado_em: string
}

export type SistemaMotorDb =
  | "lubrificacao" | "combustivel" | "arrefecimento" | "eletrica"
  | "transmissao" | "admissao_escape" | "propulsao" | "outro"

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
  /** DIVERGÊNCIA CORRIGIDA (19/08/2026, medida no catálogo vivo): estava
   *  `boolean`, e a coluna é NULLABLE e sem default. Saída antiga — e qualquer
   *  insert que não mande o campo — chega com `null`, que é "ninguém disse se
   *  tem trilha", diferente de "não tem". Passou despercebido porque `null` é
   *  falsy e hoje ninguém lê o campo direto; mas um tipo que promete não-nulo é
   *  justamente o que autorizaria a próxima tela a escrever
   *  `tem_trilha ? "Com trilha" : "Sem trilha"` e afirmar o que não sabe. */
  tem_trilha: boolean | null
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
  /** DE ONDE O CUSTO VEIO — as duas colunas entraram na migration 065 (§10/§11
   *  do Upgrade 3) e NÃO estavam declaradas aqui até 19/08/2026, apesar de
   *  `lancarCustoComOrigem` (`lib/acoes/enterprise.ts`) escrever nas duas. Tipo
   *  que ignora coluna viva é o mesmo defeito de tipo que promete coluna morta,
   *  do lado avesso: a tela que quisesse marcar "custo automático" não tinha
   *  como saber que o dado já estava no banco.
   *
   *  `null` nos dois = lançamento DIGITADO por gente no Financeiro. Não existe
   *  origem "manual" implícita: o `check` do banco até aceita a palavra
   *  `'manual'`, mas nada no app a grava — o que o app grava é ausência. Por
   *  isso `origem` nula não pode virar um selo "Manual" na tela sem que alguém
   *  decida que as duas coisas são a mesma. */
  origem: OrigemLancamentoDb | null
  /** O id da linha que gerou o custo (movimento de estoque, abastecimento,
   *  serviço…). O índice único `lancamentos_uma_entrada_por_origem` é sobre
   *  `(origem, origem_id) where origem_id is not null` — é ele que faz o duplo
   *  clique bater em 23505 em vez de duplicar a despesa. */
  origem_id: string | null
  criado_por: string | null
  created_at: string
}

/** `check` de `lancamentos_financeiros.origem` (migration 065). `manual` está
 *  na lista do banco e nenhum caminho do app o escreve — ver o comentário da
 *  coluna. Os outros cinco são os automatismos do Upgrade 3. */
export type OrigemLancamentoDb =
  | "combustivel" | "mecanica" | "estoque" | "avaria" | "documentacao" | "manual"

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
  /** Onda 69 — os cinco papéis Enterprise entraram ao lado de PROP/CMDT
   *  (migration 059). O vocabulário e os presets de permissão de cada um
   *  vivem em `lib/domain/enterprise.ts`. */
  papel: PapelDb
  nivel: string
  permissoes: Record<string, { ver?: boolean; editar?: boolean }> | null
  /** §3 do PRD Upgrade 3 — a régua de confiança, POR VÍNCULO e não por
   *  perfil: dois membros de Operações na mesma empresa podem ter réguas
   *  diferentes ("funcionário novo exige conferência 1 a 1"). */
  modo_aprovacao: ModoAprovacaoDb
  /** §13 — suspensão por inadimplência (migration 061). Suspender NÃO apaga
   *  o vínculo: reativar devolve o acesso sem refazer convite, e a vaga
   *  continua ocupada (a pessoa não perde o lugar por estar em atraso —
   *  quem decide tirar é o ADM, com o botão de remover). */
  suspenso_em: string | null
  suspenso_por: string | null
  created_at: string
}

/** §13 — o link de convite do cotista (migration 061). Só uma porta: as
 *  vagas moram em `embarcacoes.cotas_total` e a ocupação é derivada dos
 *  vínculos, pra "redefinir o link" não zerar a contagem. */
export interface ConviteCotista {
  id: string
  embarcacao_id: string
  codigo: string
  ativo: boolean
  criado_por: string | null
  criado_em: string
}

export type PapelDb =
  | "PROP" | "CMDT"
  | "ADM_GERAL" | "ADM" | "OPERACOES" | "MECANICA" | "COTISTA"

export type ModoAprovacaoDb = "sem_aprovacao" | "somente_criticos" | "tudo"

/** §22 — a trilha de auditoria (migration 059). Append-only por construção:
 *  a tabela não tem policy de update nem de delete. */
export interface Auditoria {
  id: string
  embarcacao_id: string
  /** `null` quando a pessoa saiu da plataforma — some o nome, não o fato. */
  autor_id: string | null
  evento: EventoAuditadoDb
  entidade: string
  entidade_id: string | null
  alvo: string | null
  antes: Record<string, unknown> | null
  depois: Record<string, unknown> | null
  motivo: string | null
  criado_em: string
}

/** §6 do PRD Upgrade 3 — check-out e check-in numa linha só (migration 060).
 *  Quase tudo nullable porque a home de campo tem que ser rápida; o domínio
 *  (`lib/domain/patio.ts`) devolve `null` no que falta em vez de inventar. */
export interface MovimentoPatio {
  id: string
  embarcacao_id: string
  responsavel_id: string | null
  saida_em: string
  saida_horas: number | null
  /** Percentual do ponteiro do painel — litro é assunto do Hub Combustível. */
  saida_combustivel_pct: number | null
  saida_estado: string | null
  saida_foto_path: string | null
  /** Tudo nulo enquanto a unidade está fora. */
  retorno_em: string | null
  retorno_horas: number | null
  retorno_combustivel_pct: number | null
  retorno_estado: string | null
  retorno_foto_path: string | null
  /** Quem devolve pode não ser quem tirou. */
  retorno_responsavel_id: string | null
  /** A avaria aberta a partir do retorno (§6). */
  ocorrencia_id: string | null
  /** §3, régua de aprovação (migration 060). `true` por padrão porque
   *  check-in/out NÃO são ações críticas — travar o pátio esperando ADM pra
   *  soltar um Jet é a fricção que o §6 manda evitar. Quem está no modo "tudo
   *  exige aprovação" nasce `false` e espera o ADM.
   *  ATENÇÃO: `aprovado` sozinho NÃO diz se alguém conferiu — `true` sem
   *  carimbo significa "a régua não exigia", e é diferente de "o ADM aprovou".
   *  Quem separa as quatro situações é `situacaoDaAprovacao`
   *  (`lib/domain/patio.ts`), pela existência da decisão gravada. */
  aprovado: boolean
  /** `on delete set null`: funcionário desligado apaga o nome, não o fato de
   *  que a conferência aconteceu. */
  aprovado_por: string | null
  aprovado_em: string | null
  criado_em: string
}

export type EventoAuditadoDb =
  | "criou" | "alterou" | "excluiu" | "aprovou" | "recusou"
  | "publicou_para_cotistas" | "bloqueou_cotista" | "desbloqueou_cotista"
  | "ajustou_com_divergencia"

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
  /** Carimbo (`dateCreated`) do evento Asaas que produziu o `status` acima
   *  (migration 075, achado A-06). O webhook só aplica evento com carimbo
   *  maior ou igual a este — é o que impede um `PAYMENT_OVERDUE` reentregue
   *  de derrubar quem já regularizou.
   *
   *  `null` é "não sei quando", NUNCA "muito antigo": assinatura anterior à
   *  migration, ou evento que o gateway mandou sem carimbo. Nesse caso o
   *  evento passa — na dúvida, a favor de quem paga. */
  ultimo_evento_em: string | null
  criado_em: string
  atualizado_em: string
}

/** O que uma entrega do webhook produziu (migration 076, achado A-07).
 *  Lista fechada, espelhada na `check` da coluna `asaas_eventos.resultado`. */
export type ResultadoEventoAsaas =
  /** Mudou linha no Commander. */
  | "aplicado"
  /** Reconhecido, mas nada a mudar (já estava assim, ou é terminal). */
  | "sem_efeito"
  /** A assinatura ou cobrança não existe no Commander — A-07. É o caso grave:
   *  pode haver cliente sendo cobrado por acesso que o app não conhece. */
  | "sem_correspondencia"
  /** Carimbo mais velho que o já aplicado — A-06, descartado de propósito. */
  | "fora_de_ordem"
  /** Tipo de evento que o Commander não trata. */
  | "evento_ignorado"
  /** Falha ao gravar. Único que devolve 5xx, pro Asaas retentar. */
  | "erro"

/**
 * Trilha de entregas do webhook do Asaas (migration 076, achado A-07).
 *
 * Uma linha por ENTREGA, inclusive reentrega do mesmo `evento_id` — duplicata
 * é o fato que se quer enxergar, não sujeira a esconder. Append-only: a tabela
 * não tem policy de update nem de delete, e só Suporte/CEO leem.
 */
export interface AsaasEvento {
  id: string
  /** `id` do corpo do Asaas (`evt_…`). `null` em entrega antiga sem id. */
  evento_id: string | null
  /** `event` do corpo: PAYMENT_CONFIRMED, PAYMENT_OVERDUE, … */
  tipo: string
  /** `dateCreated` da raiz do corpo. `null` = o gateway não mandou. */
  ocorrido_em: string | null
  asaas_payment_id: string | null
  asaas_subscription_id: string | null
  resultado: ResultadoEventoAsaas
  detalhe: string | null
  /** Quantas linhas o evento mudou. `null` = não chegou a tentar escrever —
   *  e `null` aqui nunca deve ser desenhado como 0: "não tentou" e "tentou e
   *  não mudou nada" são diagnósticos opostos. */
  linhas_afetadas: number | null
  /** O JSON cru, exatamente como chegou. */
  corpo: unknown
  recebido_em: string
}

/** Tolerância configurável do §23 — linha única, mudada por SQL do dono. */
export interface AssinaturaParametros {
  id: true
  tolerancia_dias: number
  atualizado_em: string
}

/**
 * Promoção de uma pessoa (§2.1 migração, §2.2 entrada pelo Gold).
 *
 * CORRIGIDO EM 19/08/2026 — a frase que estava aqui dizia "o banco garante no
 * máximo UMA vigente por usuário — não acumulam", e o banco NÃO garante isso.
 * Medido no catálogo vivo: os únicos índices da tabela são o `pkey` em `id` e
 * `idx_assinatura_promocoes_usuario` em `(usuario_id, valido_ate desc)`, que
 * **não é único**; não há constraint de exclusão nem trigger. Nada impede duas
 * linhas vigentes para a mesma pessoa.
 *
 * O que é verdade, e é outra coisa: **"não acumulam" é garantido pela LEITURA,
 * não pelo banco.** `carregarAssinatura` (`lib/consultas.ts`) busca com
 * `.gte("valido_ate", hoje).order("valido_ate", desc).limit(1)` — havendo
 * duas, a de validade mais longa vence e a outra é ignorada. É determinístico,
 * então não é bug; mas é escolha do leitor, e uma segunda linha vigente ficaria
 * invisível em vez de dar erro.
 *
 * Por que não foi "consertado" com um índice único: a regra é sobre estar
 * VIGENTE, que depende da data de hoje, e Postgres exige expressão IMMUTABLE
 * em predicado de índice — `current_date` é STABLE (`now()` mede
 * `provolatile = 's'`), então `... where valido_ate >= current_date` é
 * recusado. E um índice único só em `usuario_id`, sem o predicado, seria
 * ERRADO por outro motivo: proibiria para sempre uma segunda promoção, mesmo
 * depois de a primeira expirar — justamente a sequência §2.1 → §2.2 que o PRD
 * prevê. A ferramenta correta seria uma constraint de exclusão sobre o período
 * de validade, que exige uma coluna `valido_de` que o produto nunca definiu.
 * Ver a nota do QUARTO LOTE em `supabase/migrations/APLICAR-2026-08-19.md`.
 *
 * Nada no app escreve nesta tabela: `assinatura_promocoes` tem RLS ligada com
 * uma única policy, de SELECT — as linhas nascem por SQL da operação.
 */
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
   *  `web/lib/nmea/fila.ts`).
   *
   *  DIVERGÊNCIA CORRIGIDA (19/08/2026, medida no catálogo vivo): estava
   *  `string | null`, com o comentário "null em linhas gravadas antes desta
   *  onda". A coluna é **NOT NULL** no banco de hoje, e `registrarSondagens`
   *  (`lib/acoes/sondagem.ts`) sempre monta a chave — não existe linha sem ela.
   *  Prometer `null` que nunca chega é o erro simétrico ao de prometer coluna
   *  morta: obriga quem lê a escrever um ramo de ausência que nunca roda, e
   *  esse ramo nunca é testado com dado real. */
  origem_id: string
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
// Ver web/lib/domain/rota.ts.
/**
 * PROJEÇÃO, não a linha da tabela — e é por isso que ela pode ficar aqui sem
 * ser duplicata de nada.
 *
 * Deriva de `public.corredores`, que no banco vivo tem CINCO colunas:
 * `celula_id, lat, lon, passagens, ultima_passagem`. O que falta aqui é
 * `ultima_passagem` (`timestamptz not null default now()`), e falta de
 * propósito: quem produz este objeto é o `select("celula_id, lat, lon,
 * passagens")` de `app/api/corredores/route.ts`, e quem consome é
 * `buscarCorredores` (`lib/mapa/corredores.ts`), que só precisa da intensidade.
 * Servir a data da última passagem num agregado anônimo estreitaria o anonimato
 * de graça — carimbo de hora é o tipo de campo que, cruzado com uma célula de
 * poucos metros, volta a apontar para uma saída específica.
 *
 * Não há caso de `null`: as quatro colunas são NOT NULL na origem.
 */
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

// ---------------------------------------------------------------------------
// ONDA ENTERPRISE — as cinco que moravam dentro das páginas
// ---------------------------------------------------------------------------
// Achado P2-5 de `docs/auditoria/2026-08-19-banco-e-rls.md`, item 13 dos
// ABERTOS de `docs/auditoria/2026-08-19-fechamento.md`: `Afazer`, `Tanque`,
// `EstoqueItem`, `Orcamento` e `Votacao` eram declarados INLINE, dentro do
// corpo dos componentes de página, enquanto todo o resto do app declara tipo
// de tabela aqui. Tipo de tabela escondido dentro de uma página não é só
// desorganização: ele nasce do que AQUELA tela usa, não do que a coluna É — e
// então cada tela reinventa uma versão parcial e ligeiramente diferente da
// mesma linha, sem ninguém para compará-las.
//
// As que vêm abaixo foram escritas a partir de `information_schema.columns` e
// `pg_constraint` do banco vivo (`khgjtxvmduizyooqaoox`, lido em 19/08/2026),
// NÃO a partir das declarações que estavam nas páginas. Onde as duas coisas
// divergiam, quem manda é a coluna — e a divergência está anotada no campo.
//
// SEGUNDA LEVA, 19/08/2026 (`ServicoMecanica`, `EstoqueMovimento`,
// `TanqueMovimento`, `EnvioCotista`): as quatro tinham o MESMO sintoma, e é o
// mais enganoso da lista — a consulta era `select("*")`, que traz a linha
// inteira, e o tipo declarava um subconjunto. Não é um recorte: recorte é
// quando o `select` pede menos. Aqui o dado chegava e o tipo o escondia, então
// a coluna existia, vinha pelo fio, e nenhuma tela sabia que podia mostrá-la —
// que é como `fornecedor` de tanque e `tipo` de envio ficaram anos sendo
// gravados sem nunca voltar para quem os digitou.

/**
 * §20 do PRD Upgrade 3 — tarefa de pátio (migration 066).
 *
 * `embarcacao_id` é nullable de propósito: tarefa de casa (comprar filtro,
 * ligar pro despachante) não pertence a barco nenhum. É o que faz `/afazeres`
 * buscar com `.or("embarcacao_id.eq.<id>,embarcacao_id.is.null")` em vez de
 * `.eq()` — ver `app/(app)/afazeres/page.tsx:53`.
 */
export interface Afazer {
  id: string
  /** `null` = tarefa da operação, não de uma unidade específica. */
  embarcacao_id: string | null
  /** NOT NULL no banco — a página omitia este campo por completo. */
  dono_id: string
  titulo: string
  detalhe: string | null
  /** `check` do banco: 'operacoes' | 'mecanica' | 'qualquer'. Default 'qualquer'. */
  destino: DestinoAfazer
  /**
   * A quem a tarefa foi atribuída. A policy de INSERT viva EXIGE que este
   * usuário tenha vínculo não suspenso na unidade — e mesmo assim nenhum dos
   * dois inserts de `lib/acoes/enterprise.ts` o envia (achado A16, ABERTO).
   * Validação de um campo que ninguém preenche: a coluna existe, a regra
   * existe, o dado nunca chega.
   */
  responsavel_id: string | null
  /** `date`, não `timestamptz` — chega como "AAAA-MM-DD", sem hora nem fuso. */
  prazo: string | null
  /** `check` do banco: 'aberto' | 'em_andamento' | 'concluido'. Default 'aberto'. */
  estado: EstadoAfazer
  /**
   * DIVERGÊNCIA CORRIGIDA: a página declarava `string | null`. O banco tem
   * `check (origem_tipo in ('manutencao','avaria'))` — são dois valores, não
   * texto livre. Com `string` o `switch` sobre a origem nunca ficava exaustivo
   * e o compilador não reprovava um valor inventado.
   */
  origem_tipo: "manutencao" | "avaria" | null
  origem_id: string | null
  criado_por: string | null
  concluido_em: string | null
  criado_em: string
}

/**
 * §11 do PRD Upgrade 3 — tanque do Hub Combustível (migration 064).
 *
 * O saldo atual NÃO mora aqui: ele é somado a partir de `tanque_movimentos`
 * (`saldoTeorico`, em `lib/domain/estoque-combustivel.ts`). Só o ponto de
 * partida é coluna. Número derivado que se guarda é número que sai de
 * sincronia — a decisão está escrita em `064_estoque_e_combustivel.sql:41-46`.
 */
export interface Tanque {
  id: string
  /**
   * NOT NULL no banco; a página omitia. É por ele que a RLS recorta a lista
   * inteira (`tanques: o dono le` = `dono_id = auth.uid()`), e é o único
   * predicado — a tela busca sem filtro e deixa a policy cortar.
   */
  dono_id: string
  // A2/084 — `base_id` NÃO existe mais. Medido em `pg_attribute` no banco de
  // hoje: `attnum 3` de `tanques` e de `estoque_itens` está `attisdropped`, e
  // `bases_operacionais` sumiu de `pg_class`. A migration foi aplicada. O
  // campo ficou aqui declarado depois disso, e essa é a forma mais cara de
  // erro que este arquivo pode ter: um `select("base_id")` escrito confiando
  // no tipo compila e só quebra em produção, com 400 do PostgREST.
  nome: string
  combustivel: string | null
  /** `numeric` do banco; o PostgREST serializa como número JSON. */
  capacidade_litros: number | null
  /** NOT NULL, default 0. */
  saldo_inicial_litros: number
  minimo_litros: number | null
  criado_em: string
}

/**
 * §10 do PRD Upgrade 3 — item de estoque (migration 064).
 * O nome corrige o da página, que chamava isto de `Item` — genérico demais
 * para conviver com os outros seis `item` do app.
 */
export interface EstoqueItem {
  id: string
  /** NOT NULL no banco; a página omitia. Mesmo papel de recorte que em `Tanque`. */
  dono_id: string
  // `base_id` também já morreu aqui — ver a nota em `Tanque`.
  nome: string
  /** `check` do banco com as nove categorias do §10, na mesma ordem. */
  categoria: CategoriaEstoque
  unidade: string | null
  /**
   * `numeric` NOT NULL, default 0, com `check (quantidade >= 0)`. Chega como
   * número JSON — o `Number(i.quantidade)` de `app/(app)/estoque/page.tsx:66`
   * é redundante (inofensivo, mas denuncia a dúvida que este tipo resolve).
   */
  quantidade: number
  minimo: number | null
  fornecedor: string | null
  /**
   * `bigint` no banco, `check (>= 0 ou null)`. A página de estoque omitia; a
   * de mecânica lia (`app/(app)/mecanica/page.tsx:51-52,150`) com uma terceira
   * declaração inline — exatamente o sintoma que o P2-5 descreve.
   */
  custo_unitario_centavos: number | null
  criado_em: string
}

/**
 * §12 do PRD Upgrade 3 — orçamento de serviço de mecânica (migration 063).
 * `servico_id` é nullable porque o orçamento pode nascer antes do serviço.
 */
export interface Orcamento {
  id: string
  /** NOT NULL no banco — a página omitia, e é a coluna que a RLS usa. */
  embarcacao_id: string
  servico_id: string | null
  /** O problema como foi descrito na hora de pedir o orçamento. */
  problema: string | null
  servico_proposto: string
  fornecedor: string | null
  pecas: string | null
  /** `bigint`, `check (>= 0 ou null)`. */
  valor_centavos: number | null
  /** `date` — "AAAA-MM-DD", sem hora. */
  valido_ate: string | null
  /** Coletada nunca: não há campo de upload na tela (resíduo do achado A15). */
  anexo_path: string | null
  criado_por: string | null
  criado_em: string
}

/**
 * §12 do PRD Upgrade 3 — votação de cotistas sobre um orçamento (migration 063).
 *
 * DIVERGÊNCIA ESTRUTURAL CORRIGIDA: a página declarava
 * `{ id, orcamento_id, encerrada_em, votos: { voto: Voto }[] }` — três colunas
 * mais um EMBED do PostgREST. `votos` não é coluna desta tabela; é a relação
 * `public.votos`. Este tipo é a LINHA. Quem precisar da forma com o embed
 * compõe, sem reabrir a declaração:
 *
 *     type VotacaoComVotos = Votacao & { votos: { voto: Voto }[] }
 *
 * (`Voto` continua vindo de `@/lib/domain/mecanica` — é a união
 * `"aprovar" | "nao_aprovar"`, espelhada no `check` de `votos.voto`.)
 */
export interface Votacao {
  id: string
  /** NOT NULL no banco — a página omitia. */
  embarcacao_id: string
  orcamento_id: string
  aberta_por: string | null
  aberta_em: string
  /** `null` enquanto aberta. Escrita por `encerrarVotacao`
   *  (`lib/acoes/enterprise.ts:390`). */
  encerrada_em: string | null
}

/**
 * §12 do PRD Upgrade 3 — o serviço na bancada da oficina (migration 063).
 * Tabela `public.servicos_mecanica`, conferida no catálogo vivo em 19/08/2026.
 *
 * Morava como `type Servico` no topo de `app/(app)/mecanica/page.tsx`, com 9
 * das 16 colunas, alimentado por um `select("*")`. As DATAS são o motivo de
 * este tipo importar: são quatro (`entrada_em`, `inicio_em`, `conclusao_em`,
 * `publicado_em`) e cada `null` responde uma pergunta diferente sobre o mesmo
 * motor. Uma tela que trate as quatro como "sem data" perde a única informação
 * que a oficina tem sobre atraso.
 */
export interface ServicoMecanica {
  id: string
  embarcacao_id: string
  /** A avaria que originou o serviço. `null` = serviço aberto direto na
   *  oficina, sem ocorrência antes — comum na manutenção programada. FK
   *  `on delete set null`: apagar a avaria não apaga o conserto. */
  ocorrencia_id: string | null
  /** O que o dono/pátio relatou. `null` = ninguém escreveu o sintoma. */
  problema_informado: string | null
  /** O que a oficina concluiu. `null` = ainda não diagnosticou, e é isso que
   *  separa "estamos olhando" de "já sabemos o que é". NUNCA desenhar como
   *  "sem problema encontrado". */
  diagnostico: string | null
  /** O que foi feito. `null` enquanto não consertou. */
  conserto: string | null
  /** Horímetro na entrada. `null` = não anotaram — não é zero hora de uso. */
  horas: number | null
  /** `date` ("AAAA-MM-DD"), as três. Cada `null` é uma etapa que ainda não
   *  aconteceu OU que ninguém registrou, e o app não distingue as duas:
   *  `entrada_em` nulo não significa que o barco não está lá.
   *  `conclusao_em` é a única cuja ausência tem leitura segura, porque
   *  `estado` a confirma — e mesmo assim quem manda é `estado`. */
  entrada_em: string | null
  inicio_em: string | null
  conclusao_em: string | null
  /** Coletada nunca (auditoria 19/08, A15): não há campo de upload em tela
   *  nenhuma, e nenhuma action escreve. Vazia em 100% das linhas. `null` aqui
   *  é "não existe caminho de escrita", não "o fornecedor não mandou o PDF" —
   *  mostrar a coluna renderiza "Anexo: —" em toda linha e não devolve anexo a
   *  ninguém. Ver a nota longa em `app/(app)/mecanica/page.tsx`. */
  anexo_path: string | null
  estado: EstadoServico
  /** §7 — quando o laudo virou visível para os cotistas. `null` = NÃO
   *  publicado, e essa é a trava do §7: o cotista não enxerga laudo não
   *  publicado, e quem garante é a RLS (migration 063), não o botão da tela. */
  publicado_em: string | null
  /** `on delete set null` nos dois: funcionário desligado apaga o nome, não o
   *  fato de que a publicação e a abertura aconteceram. */
  publicado_por: string | null
  criado_por: string | null
  criado_em: string
}

/** `check` de `estoque_movimentos.tipo` (migration 064). `ajuste` é a correção
 *  de inventário — existe justamente para que uma contagem física não precise
 *  ser maquiada como entrada ou retirada falsa. */
export type TipoMovimentoEstoqueDb = "entrada" | "retirada" | "ajuste"

/**
 * §10 do PRD Upgrade 3 — o que entrou e saiu do almoxarifado (migration 064).
 * Tabela `public.estoque_movimentos`, conferida no catálogo vivo em
 * 19/08/2026. Morava como `type Movimento` dentro do componente de
 * `app/(app)/estoque/page.tsx`, com 7 das 9 colunas e `tipo: string`.
 *
 * O SALDO NÃO MORA AQUI NEM EM LUGAR NENHUM DE PROPÓSITO — ele é
 * `estoque_itens.quantidade`, que a action atualiza junto. Esta tabela é o
 * histórico de por quê.
 */
export interface EstoqueMovimento {
  id: string
  item_id: string
  tipo: TipoMovimentoEstoqueDb
  /** `numeric` NOT NULL, e SEM `check` de sinal no banco — diferente de
   *  `estoque_itens.quantidade`, que tem `>= 0`. É o que permite ao `ajuste`
   *  registrar uma correção para baixo. */
  quantidade: number
  /** Para qual unidade a peça foi. `null` = movimento do almoxarifado que não
   *  aponta para barco nenhum (uma entrada de compra, um ajuste de contagem) —
   *  nunca "unidade desconhecida". FK `on delete set null`: apagar a
   *  embarcação não apaga o fato de que a peça saiu. */
  embarcacao_id: string | null
  /** O serviço de mecânica que consumiu a peça. `null` = retirada avulsa. É
   *  por ele que `app/(app)/mecanica/page.tsx` soma o custo de peças por
   *  serviço; retirada sem `servico_id` some dessa conta, o que é correto —
   *  ela não pertence a serviço nenhum. */
  servico_id: string | null
  motivo: string | null
  autor_id: string | null
  criado_em: string
}

/** `check` de `tanque_movimentos.tipo` (migration 064). `medicao` NÃO é
 *  entrada nem saída: é a leitura física da régua, que existe para o saldo
 *  teórico poder ser comparado com o real em vez de ser corrigido em silêncio. */
export type TipoMovimentoTanqueDb = "entrada" | "saida" | "medicao"

/**
 * §11 do PRD Upgrade 3 — movimento do tanque da base (migration 064).
 * Tabela `public.tanque_movimentos`, conferida no catálogo vivo em 19/08/2026.
 * Morava como `type Mov` dentro do componente de
 * `app/(app)/combustivel/page.tsx`, com 10 das 12 colunas.
 *
 * É desta tabela que sai o saldo do tanque (`saldoTeorico`, em
 * `lib/domain/estoque-combustivel.ts`) — `tanques` só guarda o ponto de
 * partida. Número derivado que se guarda é número que sai de sincronia.
 */
export interface TanqueMovimento {
  id: string
  tanque_id: string
  tipo: TipoMovimentoTanqueDb
  /** `numeric` NOT NULL, `check (>= 0)`. Na `medicao` este número é o volume
   *  LIDO na régua, não uma variação — quem interpreta é o domínio. */
  litros: number
  /** Para onde foi. O banco tem um `check` amarrando os dois: numa `saida`,
   *  pelo menos um dos dois é obrigatório — não existe combustível que some do
   *  tanque sem destino. Nos outros tipos os dois são nulos e isso é o normal.
   *  `destino_livre` é o escape para destino que não é unidade cadastrada
   *  (carro da equipe, gerador da base). FK `on delete set null`: apagar a
   *  embarcação apaga o destino, não o litro que saiu. */
  destino_embarcacao_id: string | null
  destino_livre: string | null
  /** De quem se comprou. `null` = não anotaram — foi exatamente o campo que a
   *  auditoria 19/08 (A15) achou sendo gravado e nunca exibido: quem digitou
   *  "Posto Ilha" numa entrada de 800 litros nunca mais viu de quem comprou. */
  fornecedor: string | null
  /** `bigint`, `check (null ou >= 0)`. `null` = compra sem valor informado, e
   *  NÃO combustível de graça. Um zero aqui derrubaria o R$/litro da base. */
  valor_centavos: number | null
  comprovante_path: string | null
  motivo: string | null
  autor_id: string | null
  criado_em: string
}

/**
 * §15 do PRD Upgrade 3 — o que o cotista informa à administradora (migration
 * 066). Tabela `public.envios_cotista`, conferida no catálogo vivo em
 * 19/08/2026.
 *
 * Morava dentro de `app/(app)/atualizacoes/page.tsx` como um `type Envio`
 * local, e aqui o sintoma da segunda leva é o mais claro de todos — a consulta
 * é `select("*")`, ou seja, traz a linha INTEIRA, e a declaração listava 10 das
 * 13 colunas. As três que sobravam não
 * eram "campos que a tela não usa": eram campos que a tela não sabia que
 * existiam, e não há como uma tela decidir mostrar o que ela não enxerga.
 *
 * A REGRA QUE GOVERNA A TABELA (§15): *nada enviado pelo cotista altera
 * automaticamente o registro oficial*. Toda linha aqui é um PEDIDO. Isso é o
 * que dá sentido ao par `estado`/`acao` — e é por isso que a ficha da unidade
 * não tem nenhuma FK apontando para cá.
 */
export interface EnvioCotista {
  id: string
  embarcacao_id: string
  /** Quem enviou. NOT NULL: envio sem autor não teria procedência, que é o
   *  produto inteiro do §15 (ver `linhaDeProcedencia`). */
  cotista_id: string
  tipo: TipoEnvio
  /** O relato em si. `null` = a pessoa mandou só número (horas/combustível) e
   *  não escreveu nada — a tela cai para "Envio" em vez de inventar frase. */
  texto: string | null
  /** `numeric`. `null` = o cotista não anotou o horímetro, NUNCA "zero hora".
   *  É a leitura que o ADM pode escolher promover a registro oficial com a
   *  ação `atualizar_horas`; um zero desenhado aqui viraria um zero gravado
   *  lá. */
  horas: number | null
  /** Percentual do ponteiro (`check` de 0 a 100 no banco), mesma unidade do
   *  Pátio. `null` = não anotou. Repare que 0 é valor LEGÍTIMO — tanque
   *  vazio — e é exatamente por isso que a ausência precisa ser `null`. */
  combustivel_pct: number | null
  /** NUNCA PREENCHIDA (auditoria 19/08, A15): a coluna existe desde a
   *  migration 066 e nada no app escreve nela — o formulário não pede arquivo
   *  e `enviarAoAdm` não sobe nenhum. `null` aqui não é "o cotista não mandou
   *  foto": é "não existe caminho para mandar". Fica declarada para que a
   *  onda que fizer o upload encontre a coluna, e para que ninguém desenhe um
   *  "Foto: —" em 100% dos cartões enquanto isso. */
  foto_path: string | null
  estado: EstadoEnvio
  /** O ADM que decidiu. `null` enquanto `estado = 'aguardando'` — e também
   *  depois, se o perfil dele sumir. Por isso `linhaDeProcedencia` cai para
   *  "a administradora" em vez de deixar a frase sem sujeito. */
  decidido_por: string | null
  /** Quando decidiu. `null` = ainda ninguém decidiu. As três colunas de
   *  decisão andam juntas na prática, mas o banco não tem `check` amarrando —
   *  não presuma que `estado != 'aguardando'` implica carimbo. */
  decidido_em: string | null
  /** O que o ADM fez com o envio. `null` enquanto aguarda. */
  acao: AcaoSobreEnvio | null
  criado_em: string
}
