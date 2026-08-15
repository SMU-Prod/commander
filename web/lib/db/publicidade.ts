import type { ProdutoPublicidade, StatusCampanha } from "@/lib/domain/publicidade"

/**
 * Tipos das tabelas da migration 053 (PRD §20).
 *
 * POR QUE NÃO ESTÁ EM `lib/db/types.ts`: na onda 52 três frentes mexem no
 * mesmo arquivo ao mesmo tempo (Partner por tipo, Captain, planos). Um
 * arquivo por domínio novo evita o conflito e não custa nada — o import é
 * `@/lib/db/publicidade` em vez de `@/lib/db/types`. Se um dia as ondas
 * pararem de se cruzar, mover isto pra lá é um recorta-e-cola.
 */

/** §20: "Preço não deve ser hardcoded; configurável no Admin/Comercial".
 *  Três linhas fixas, uma por produto. */
export interface PublicidadeProdutoDb {
  produto: ProdutoPublicidade
  rotulo: string
  /** `null` = sob consulta. É um ESTADO, não um preço zerado — não gera
   *  cobrança automática nenhuma (mesma leitura da faixa 81+ pés do Gold). */
  preco_mensal_centavos: number | null
  ativo: boolean
  atualizado_por: string | null
  atualizado_em: string
}

export interface PublicidadeCampanhaDb {
  id: string
  parceiro_id: string
  produto: ProdutoPublicidade
  status: StatusCampanha
  /** "AAAA-MM-DD" */
  inicio: string
  /** "AAAA-MM-DD" ou `null` (sem término previsto). */
  fim: string | null
  /** `null` = sem segmentação por região — alcança todo mundo (§20). */
  regiao_id: string | null
  categoria_id: string | null
  prioridade: number
  /** O que foi cobrado NESTA campanha, congelado: reajustar a tabela de
   *  preços não pode reescrever o histórico comercial. */
  valor_centavos: number | null
  chamada: string | null
  criado_por: string | null
  criado_em: string
  atualizado_em: string
}

/** Contador DIÁRIO por campanha (§21.1). Não guarda quem viu, de propósito:
 *  pra saber que um anúncio performou não é preciso saber que o
 *  proprietário fulano o viu às 14h32 (§22). */
export interface PublicidadeMetricaDb {
  campanha_id: string
  /** "AAAA-MM-DD" */
  dia: string
  impressoes: number
  cliques: number
}
