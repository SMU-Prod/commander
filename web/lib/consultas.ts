import { cache } from "react"
import { supabaseServer } from "@/lib/supabase/server"
import { itemMonitoradoToItemCalc as itemMonitoradoToItemCalcInterno } from "@/lib/domain/conversores"
import { abaDoItem, nomeDoEquipamento } from "@/lib/domain/diario"
import {
  DIAS_AVISO_AGENDA, DIAS_AVISO_FINANCEIRO, filtrarPorPermissao, nivelDaOcorrencia,
  nivelDoCompromisso, nivelDoStatusItem, nivelDoVencimentoFinanceiro,
  NIVEL_AVISO_MARKETPLACE, ordenarNotificacoes,
  type Notificacao,
} from "@/lib/domain/notificacoes"
import {
  ESTADOS_QUE_PESAM_NA_SAUDE, ROTULO_ESTADO, ROTULO_GRAVIDADE,
  type EstadoOcorrencia, type Gravidade,
} from "@/lib/domain/ocorrencias"
import { calcularSemaforo, textoRestante } from "@/lib/domain/semaforo"
import { normalizarPermissoes, podeEditar, type Aba, type Permissoes } from "@/lib/domain/permissoes"
import { limiteEmbarcacoes, nivelPlano, type NivelPlano } from "@/lib/domain/plano-acesso"
import { PLANOS, type PlanoId, type PromocaoId } from "@/lib/domain/planos"
import {
  avaliarCiclo, dividirEmbarcacoesPorPlano, TOLERANCIA_PADRAO_DIAS,
  type CicloAvaliado, type DivisaoEmbarcacoes,
} from "@/lib/domain/assinatura-ciclo"
import {
  avaliarSeloVerified, avaliarVerified,
  type ResultadoVerified, type SeloVerifiedAvaliado,
} from "@/lib/domain/verified"
import { lerEmbarcacaoAtiva } from "@/lib/embarcacao-ativa"
import { ROTULO_FREQUENCIA, vencimentosNoIntervalo } from "@/lib/domain/financeiro"
import { formatarReais } from "@/lib/domain/gastos"
import type {
  Assinatura, Embarcacao, Equipamento, ItemMonitorado, PapelDb, RecorrenciaFinanceira,
  VerifiedEstado, Viagem,
} from "@/lib/db/types"
import { diasAteData, hojeISO } from "@/lib/domain/datas"

export const carregarPainel = cache(async (): Promise<{
  embarcacao: Embarcacao
  equipamentos: Equipamento[]
  itens: ItemMonitorado[]
  /** Onda 69 — os cinco papéis Enterprise entraram ao lado de PROP/CMDT. */
  papel: PapelDb
  permissoes: Permissoes | null
  embarcacoes: { id: string; nome: string }[]
  /** E-mail da conta logada — vem DE GRAÇA do `getUser()` que esta função
   *  sempre fez (onda 60). Continua aqui porque é o único dado de conta que
   *  NUNCA falta; o nome abaixo pode estar vazio num cadastro incompleto. */
  emailUsuario: string | null
  /**
   * ONDA 63 — O NOME DE VERDADE, PORQUE DUAS TELAS DISCORDAVAM SOBRE ELE.
   *
   * A faixa de topo derivava as iniciais do e-mail ("e2e-3f@…" → "E3") e a
   * saudação da Início lia o `nome` do perfil ("Erick Cardoso" → "EC"): dois
   * avatares com iniciais DIFERENTES a 60px um do outro, na mesma tela
   * (auditoria visual 18/08, §10). O argumento pra derivar do e-mail era não
   * pagar consulta por navegação — mas a conta estava errada nos dois
   * sentidos: `/hoje` e `/menu/ajustes` JÁ pagavam essa consulta por conta
   * própria, então trazê-la pra cá (que é `cache()` por requisição) não
   * soma consulta nenhuma — ELIMINA a repetida, e de quebra a faixa passa a
   * poder mostrar a foto real em vez de iniciais.
   */
  perfil: { nome: string | null; avatarPath: string | null } | null
} | null> => {
  // ONDA 96 — CINCO IDAS AO BANCO EM FILA VIRARAM TRÊS.
  //
  // Esta função roda em QUASE TODA tela do app, e o que ela fazia era esperar
  // cinco vezes em sequência: conta → vínculos → embarcação → (equipamentos +
  // itens) → (barcos + perfil). Cada espera é uma volta de rede até o banco,
  // e elas se somavam ANTES de a tela começar a existir — junto com a volta
  // que o middleware já paga (ver `middleware.ts`, mesma onda).
  //
  // O que a fila escondia é que a maior parte dela era falsa. O grafo real de
  // dependência tem três níveis, e só três:
  //
  //   1. quem é a pessoa                 → `getUser`
  //   2. a quais barcos ela tem acesso   → `vinculos` (precisa do id dela)
  //   3. TODO O RESTO                    → só precisa do id do BARCO e do id
  //                                        da PESSOA, os dois já conhecidos
  //
  // O caso que mais enganava: `equipamentos` e `itens` eram buscados por
  // `embarcacao.id` e por isso esperavam a embarcação carregar. Só que esse
  // id é `vinculo.embarcacao_id` — o MESMO valor que a consulta da embarcação
  // usa como filtro. Eles nunca precisaram esperar; esperavam por causa de
  // onde a variável foi lida, não por dependência de dado.
  //
  // `lerEmbarcacaoAtiva` sobe para o primeiro nível porque não é banco: é
  // leitura de cookie. Ficava no meio da fila cobrando o preço de uma espera
  // sem ser uma.
  //
  // O QUE ISTO CUSTA, e por que é aceitável: se a embarcação tiver sido
  // apagada mas o vínculo sobreviver, as consultas de equipamentos, itens e
  // barcos saem à toa antes do `return null`. É um caso raro (a FK apaga em
  // cascata) e sem custo de tempo — as três já estão em voo junto com a que
  // detecta o problema. Trocar essa folga por uma espera a mais em TODA
  // navegação seria pagar caro pelo caso que quase nunca acontece.
  const supabase = await supabaseServer()
  const [{ data: { user } }, ativa] = await Promise.all([
    supabase.auth.getUser(),
    lerEmbarcacaoAtiva(),
  ])

  // O barco exibido segue o vínculo do usuário: prioriza o que está marcado
  // como ativo no cookie; sem cookie (ou apontando pra barco sem vínculo),
  // prioriza onde ele é PROP; como CMDT de vários barcos, vale o vínculo
  // mais antigo.
  const { data: meusVinculos, error: erroVinculos } = await supabase
    .from("vinculos")
    .select("embarcacao_id, papel, permissoes")
    .eq("usuario_id", user?.id ?? "")
    .order("created_at")
  if (erroVinculos) throw new Error("Não foi possível carregar seu acesso. Recarregue a página.")
  const vinculo =
    (ativa ? (meusVinculos ?? []).find((v) => v.embarcacao_id === ativa) : undefined) ??
    (meusVinculos ?? []).find((v) => v.papel === "PROP") ??
    (meusVinculos ?? [])[0]
  if (!vinculo) return null

  // `.in()` pelos vínculos que já estão em memória: sem ele esta consulta
  // varria `embarcacoes` INTEIRA a cada navegação autenticada — a RLS
  // devolvia só as do usuário, mas o Postgres percorria a tabela toda antes
  // de filtrar. Custo O(total de barcos da plataforma), não O(barcos do
  // dono): 1,3 ms com 2 barcos, ~456 ms projetados com 1.000 assinantes, em
  // TODA página. Era a consulta mais cara do app (auditoria CTO 18/08).
  const idsDoUsuario = (meusVinculos ?? []).map((v) => v.embarcacao_id)
  const [
    { data: embarcacao, error },
    { data: equipamentos, error: equipamentosError },
    { data: itens, error: itensError },
    { data: todas },
    { data: perfilBruto },
  ] = await Promise.all([
    supabase.from("embarcacoes").select("*").eq("id", vinculo.embarcacao_id).maybeSingle(),
    supabase.from("equipamentos").select("*").eq("embarcacao_id", vinculo.embarcacao_id).order("posicao"),
    supabase.from("itens_monitorados").select("*").eq("embarcacao_id", vinculo.embarcacao_id).order("created_at"),
    supabase.from("embarcacoes").select("id, nome").in("id", idsDoUsuario).order("nome"),
    // Uma linha por id, indexada. Ver o comentário de `perfil` no tipo de
    // retorno: quem já fazia esta consulta por conta própria (`/hoje`,
    // `/menu/ajustes`) passa a reusar esta.
    supabase.from("profiles").select("nome, avatar_path").eq("id", user?.id ?? "").maybeSingle(),
  ])
  if (error) throw new Error("Não foi possível carregar os dados da embarcação. Recarregue a página.")
  if (!embarcacao) return null
  if (equipamentosError || itensError) throw new Error("Não foi possível carregar os dados da embarcação. Recarregue a página.")

  const papel = vinculo.papel as "PROP" | "CMDT"
  const permissoes = papel === "PROP" ? null : normalizarPermissoes(vinculo.permissoes)

  return {
    embarcacao,
    equipamentos: equipamentos ?? [],
    itens: itens ?? [],
    papel,
    permissoes,
    embarcacoes: todas ?? [],
    emailUsuario: user?.email ?? null,
    perfil: perfilBruto
      ? { nome: perfilBruto.nome as string | null, avatarPath: perfilBruto.avatar_path as string | null }
      : null,
  }
})

/** Próxima viagem planejada (onda 19, Pilar Strava do Mar) — data futura mais
 *  perto pra embarcação ativa, pro cartão "Próximas paradas" em `/hoje`.
 *  `null` sem nenhuma viagem com `data_prevista` a partir de hoje: quem usa
 *  isto não mostra cartão nenhum (regra de honestidade — nada de porta pra
 *  sala vazia). `cache()` evita repetir a consulta na mesma renderização,
 *  mesmo padrão de `carregarPainel`/`carregarVerified`. */
export const carregarProximaViagem = cache(async (): Promise<Viagem | null> => {
  const painel = await carregarPainel()
  if (!painel) return null
  const supabase = await supabaseServer()
  const { data } = await supabase
    .from("viagens")
    .select("*")
    .eq("embarcacao_id", painel.embarcacao.id)
    .gte("data_prevista", hojeISO())
    .order("data_prevista", { ascending: true })
    .limit(1)
    .maybeSingle()
  return (data as Viagem | null) ?? null
})

/**
 * Commander Verified: busca o que `carregarPainel` não traz (a contagem de
 * eventos do diário — motores, manutenções, segurança e documentos já vêm em
 * `painel.equipamentos`/`painel.itens`) e entrega pronto ao domínio puro:
 * `avaliarVerified` nunca consulta o banco. Usado pelo card em `/barco`, pelo
 * hub `/barco/selos` e pela tela `/barco/selos/verified`; o `cache()` evita
 * repetir a consulta na mesma renderização.
 *
 * ONDA 44 — o prazo de regularização (PRD §15) precisa de memória: sem saber
 * DESDE QUANDO um pilar está caído, não existe "15 dias". As duas datas
 * moram em `verified_estado` (migration 045) e são atualizadas aqui, no
 * único lugar que já calcula o selo.
 *
 * Por que a gravação acontece durante a leitura, e não num cron: o relógio
 * só precisa estar correto quando alguém OLHA o selo — a situação
 * (regularização/suspenso) é derivada de `pendencia_desde` na hora, então
 * nenhuma tela mostra dado velho por falta de um job. O efeito colateral é
 * que a contagem começa na primeira visita depois da queda do pilar, não no
 * instante exato dela; na prática o dono abre o app bem antes dos 15 dias, e
 * o erro é sempre a favor dele.
 *
 * `podeEditar(..., "embarcacao")` guarda a escrita porque é o que a RLS de
 * `verified_estado` exige. Tripulação com acesso só de leitura vê o selo
 * calculado sobre o que já está gravado — nunca toma erro de permissão por
 * causa de um efeito colateral que não pediu.
 */
export const carregarVerified = cache(async (): Promise<
  (ResultadoVerified & { selo: SeloVerifiedAvaliado }) | null
> => {
  const painel = await carregarPainel()
  if (!painel) return null
  const supabase = await supabaseServer()
  const { embarcacao } = painel

  const [{ count: totalEventosDiario }, { data: estadoBruto }] = await Promise.all([
    // Pedidos de Commander Gold vivem em `gold_solicitacoes` desde a onda 35
    // (nao mais um evento marcador no diario) — entao a contagem de eventos
    // do Verified nunca precisou de exclusao: o pedido do Gold nao toca
    // `eventos`. Correcao 14 do PRD de Correcoes (Gold nao depende de
    // Verified) continua valendo por construcao, nao por filtro aqui.
    supabase.from("eventos").select("id", { count: "exact", head: true })
      .eq("embarcacao_id", embarcacao.id),
    supabase.from("verified_estado").select("conquistado_em, pendencia_desde")
      .eq("embarcacao_id", embarcacao.id).maybeSingle(),
  ])

  const resultado = avaliarVerified({
    equipamentos: painel.equipamentos,
    itens: painel.itens,
    hoje: hojeISO(),
    totalEventosDiario: totalEventosDiario ?? 0,
  })

  const estado = estadoBruto as Pick<VerifiedEstado, "conquistado_em" | "pendencia_desde"> | null
  const selo = avaliarSeloVerified(
    resultado,
    { conquistadoEm: estado?.conquistado_em ?? null, pendenciaDesde: estado?.pendencia_desde ?? null },
    new Date().toISOString(),
  )

  if (selo.estadoParaGravar && podeEditar(painel.permissoes, "embarcacao")) {
    await supabase.from("verified_estado").upsert(
      {
        embarcacao_id: embarcacao.id,
        conquistado_em: selo.estadoParaGravar.conquistadoEm,
        pendencia_desde: selo.estadoParaGravar.pendenciaDesde,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "embarcacao_id" },
    )
  }

  return { ...resultado, selo }
})

/**
 * A ASSINATURA DA PESSOA LOGADA, já avaliada pelo ciclo do §23 (onda 47).
 *
 * Devolve tudo que as telas e os portões precisam saber sobre cobrança num
 * lugar só: o plano, a linha crua (pra tela de assinatura), a situação
 * derivada (ativa / em tolerância / bloqueada / cancelada) e o aviso que o
 * §23 exige mostrar ANTES de bloquear.
 *
 * `assinaturas`/`premium_concessoes`/`assinatura_promocoes` só deixam cada
 * pessoa ler a PRÓPRIA linha via RLS — então isto é sempre sobre quem está
 * logado, nunca sobre outra pessoa.
 *
 * A tolerância vem de `assinatura_parametros` (§23: "configurável, não
 * hardcoded"). Se a leitura falhar, cai em `TOLERANCIA_PADRAO_DIAS` — sem
 * fallback, um erro de leitura viraria bloqueio geral ou liberação geral, e as
 * duas coisas são piores que um padrão conhecido.
 */
export const carregarAssinatura = cache(async (): Promise<{
  assinatura: Assinatura | null
  /** Plano vigente da pessoa: assinatura viva, concessão vigente, ou o Free. */
  plano: PlanoId
  ciclo: CicloAvaliado | null
  /**
   * Promoção vigente (§2.1/§2.2) — a MAIS RECENTE, quando há mais de uma.
   *
   * ONDA 96 — A FRASE ANTERIOR DIZIA "no máximo uma, o banco garante", E O
   * BANCO NÃO GARANTE. Medido: `assinatura_promocoes` tem só a chave primária
   * e um índice NÃO único. A garantia era folclore, e comentário que promete
   * invariante inexistente é pior que comentário nenhum — a próxima pessoa
   * escreve código confiando nele.
   *
   * E NÃO DÁ PRA SIMPLESMENTE CRIAR O ÍNDICE, o que torna a correção ser a
   * frase, não o esquema. Um índice único parcial precisaria de um predicado
   * como `where valido_ate >= current_date`, e o Postgres recusa: predicado de
   * índice exige expressão IMUTÁVEL, e `current_date` é apenas estável. Sem o
   * predicado, o índice seria pior que o problema — proibiria a pessoa de ter
   * uma segunda promoção PARA SEMPRE, quebrando a própria sequência que o
   * §2.1→§2.2 descreve (uma promoção termina, outra começa).
   *
   * Garantir de verdade pediria coluna de início, `btree_gist` e restrição de
   * exclusão por período. Não vale hoje: a tabela tem ZERO linhas e nenhum
   * caminho de escrita — não existe policy de INSERT nela, então nenhum código
   * autenticado grava ali (foi por isso que a onda 96 apagou as três funções
   * de conceder promoção). Erguer a estrutura antes do primeiro caso real
   * seria a mesma prateleira vazia que a migration 084 acabou de derrubar.
   *
   * Enquanto isso, a leitura abaixo ordena e pega a primeira — comportamento
   * definido mesmo com várias linhas, em vez de depender de uma promessa.
   */
  promocao: { promocao: PromocaoId; validoAte: string; valorCentavos: number; descontoGoldPercentual: number } | null
}> => {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { assinatura: null, plano: "proprietario_free", ciclo: null, promocao: null }

  const hoje = hojeISO()
  const [{ data: linha }, { data: concessoes }, { data: promocoes }, { data: parametros }] = await Promise.all([
    supabase.from("assinaturas").select("*")
      .eq("usuario_id", user.id).order("criado_em", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("premium_concessoes").select("plano_concedido, valido_ate")
      .eq("usuario_id", user.id).gte("valido_ate", hoje).order("valido_ate", { ascending: false }).limit(1),
    supabase.from("assinatura_promocoes").select("promocao, plano, valor_promocional_centavos, desconto_gold_percentual, valido_ate")
      .eq("usuario_id", user.id).gte("valido_ate", hoje).order("valido_ate", { ascending: false }).limit(1),
    supabase.from("assinatura_parametros").select("tolerancia_dias").limit(1).maybeSingle(),
  ])

  const assinatura = (linha as Assinatura | null) ?? null
  const ciclo = assinatura
    ? avaliarCiclo({
        status: assinatura.status,
        problemaDesde: assinatura.problema_desde?.slice(0, 10) ?? null,
        toleranciaDias: (parametros as { tolerancia_dias: number } | null)?.tolerancia_dias ?? TOLERANCIA_PADRAO_DIAS,
        hoje,
      })
    : null

  const concessao = (concessoes ?? [])[0] as { plano_concedido: PlanoId; valido_ate: string } | undefined
  const promo = (promocoes ?? [])[0] as
    | { promocao: PromocaoId; valor_promocional_centavos: number; desconto_gold_percentual: number; valido_ate: string }
    | undefined

  // §23: durante a tolerância os recursos do plano CONTINUAM liberados. Só
  // quando o ciclo diz que não há mais acesso pago é que a assinatura para de
  // contar pro plano vigente.
  const planoDaAssinatura = assinatura != null && ciclo?.acessoPago ? assinatura.plano : null
  const plano: PlanoId = planoDaAssinatura ?? concessao?.plano_concedido ?? "proprietario_free"

  return {
    assinatura,
    plano,
    ciclo,
    promocao: promo
      ? {
          promocao: promo.promocao,
          validoAte: promo.valido_ate,
          valorCentavos: promo.valor_promocional_centavos,
          descontoGoldPercentual: promo.desconto_gold_percentual,
        }
      : null,
  }
})

/**
 * O DEGRAU DA EMBARCAÇÃO ATIVA (onda 38, reescrito na onda 47) — Free,
 * Commander ou Commander Pro. É a régua que os portões do §2.3 usam.
 *
 * A decisão é sobre a assinatura do PROPRIETÁRIO da embarcação, e
 * `assinaturas`/`premium_concessoes` só deixam cada dono ler a PRÓPRIA linha
 * via RLS. Em vez de abrir uma trinca nova nessas tabelas só pra um
 * CMDT/tripulação conseguir contar o limite do barco, esta função aplica a
 * MESMA isenção que já existe pro gate de cobrança (`app/(app)/layout.tsx`:
 * "só o PROP paga; CMDT/tripulação nunca vê paywall") — quem não é PROP nunca
 * é bloqueado por causa do plano.
 *
 * Isso não amplia poder nenhum: um CMDT já tem `editar:true` em Diário/Fotos
 * nos presets de permissão independente do plano, e o limite de EMBARCAÇÕES
 * dele é decidido por `carregarAssinatura` (a assinatura dele, não a do dono
 * deste barco) — então ele não ganha 4 barcos por tabela. `commander` e não
 * `commander_pro` de propósito: é o degrau mínimo que libera a operação, sem
 * fingir capacidade que ninguém pagou.
 */
export const carregarNivelPlano = cache(async (): Promise<NivelPlano> => {
  const painel = await carregarPainel()
  if (!painel) return "proprietario_free"
  if (painel.papel !== "PROP") return "commander"

  const { plano } = await carregarAssinatura()
  return nivelPlano(
    { planoAssinatura: plano, concessao: null },
    hojeISO(),
  )
})

/**
 * §23, downgrade Commander Pro → Commander: "não apagar embarcações
 * excedentes; bloquear gestão das excedentes e exigir seleção da embarcação
 * ativa até regularização".
 *
 * Só olha as embarcações onde a pessoa é PROP — barco de terceiro em que ela é
 * tripulação nunca conta pro limite dela nem é bloqueado pelo plano dela.
 */
export const carregarAcessoEmbarcacoes = cache(async (): Promise<{
  divisao: DivisaoEmbarcacoes
  limite: number
  /** A embarcação ativa está com a gestão bloqueada pelo plano? */
  ativaBloqueada: boolean
}> => {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  const vazio = { divisao: { liberadas: [], bloqueadas: [], precisaEscolher: false }, limite: 1, ativaBloqueada: false }
  if (!user) return vazio

  const [{ data: meus }, { plano }, ativa] = await Promise.all([
    supabase.from("vinculos").select("embarcacao_id")
      .eq("usuario_id", user.id).eq("papel", "PROP").order("created_at"),
    carregarAssinatura(),
    lerEmbarcacaoAtiva(),
  ])
  const ids = (meus ?? []).map((v: { embarcacao_id: string }) => v.embarcacao_id)
  if (ids.length === 0) return vazio

  const limite = PLANOS[plano].limiteEmbarcacoes ?? limiteEmbarcacoes(await carregarNivelPlano())
  const divisao = dividirEmbarcacoesPorPlano(ids, ativa, limite)
  return { divisao, limite, ativaBloqueada: ativa != null && divisao.bloqueadas.includes(ativa) }
})

/** Vagas de tripulação da embarcação ativa (§19) — vínculos CMDT + convites
 *  pendentes, os dois ocupando vaga. Mesma conta que o trigger do banco faz
 *  (migration 048, `acessos_ocupados`); aqui é pra tela poder AVISAR antes de
 *  a pessoa clicar e tomar erro. */
export const carregarUsoTripulacao = cache(async (): Promise<{ vinculos: number; convites: number }> => {
  const painel = await carregarPainel()
  if (!painel) return { vinculos: 0, convites: 0 }
  const supabase = await supabaseServer()
  const [{ count: vinculos }, { count: convites }] = await Promise.all([
    supabase.from("vinculos").select("id", { count: "exact", head: true })
      .eq("embarcacao_id", painel.embarcacao.id).eq("papel", "CMDT"),
    supabase.from("convites").select("id", { count: "exact", head: true })
      .eq("embarcacao_id", painel.embarcacao.id).is("usado_em", null).gt("expira_em", new Date().toISOString()),
  ])
  return { vinculos: vinculos ?? 0, convites: convites ?? 0 }
})

/** Total de registros já criados no Diário de Bordo desta embarcação — o
 *  contador que `recursoLiberado("diario_registros", ...)` compara contra
 *  `LIMITES_FREE.diarioRegistros`. */
export const carregarUsoDiario = cache(async (): Promise<number> => {
  const painel = await carregarPainel()
  if (!painel) return 0
  const supabase = await supabaseServer()
  const { count } = await supabase.from("eventos")
    .select("id", { count: "exact", head: true }).eq("embarcacao_id", painel.embarcacao.id)
  return count ?? 0
})

/** Total de fotos já enviadas ao acervo desta embarcação — o contador que
 *  `recursoLiberado("fotos", ...)` compara contra `LIMITES_FREE.fotos`.
 *  Independente da cota de ESPAÇO em MB (`lib/domain/cota.ts`, que vale
 *  igual pra todo mundo): este é o teto de QUANTIDADE só do Free. */
export const carregarUsoFotos = cache(async (): Promise<number> => {
  const painel = await carregarPainel()
  if (!painel) return 0
  const supabase = await supabaseServer()
  const { count } = await supabase.from("fotos")
    .select("id", { count: "exact", head: true }).eq("embarcacao_id", painel.embarcacao.id)
  return count ?? 0
})

/**
 * CENTRAL DE NOTIFICAÇÕES (onda 44, PRD §5.2) — monta a lista viva de avisos
 * desta pessoa, neste barco.
 *
 * Uma função só, com `cache()`, porque tanto a tela `/notificacoes` quanto o
 * contador do sino precisam do MESMO número: um badge dizendo "3" que abre
 * numa lista de 5 é pior que não ter badge. Como layout e página renderizam
 * na mesma request, o `cache()` faz a consulta acontecer uma vez.
 *
 * Duas travas de permissão, de propósito (PRD §5.2: "Notificações sempre
 * respeitam permissões do usuário"):
 *   1. a RLS já corta o que a pessoa não pode ver no banco (ocorrências);
 *   2. `filtrarPorPermissao` corta de novo aqui, porque os itens monitorados
 *      chegam pelo `carregarPainel` e a aba de cada um é decidida no front
 *      (`abaDoItem`) — sem esta segunda passada, um tripulante sem acesso a
 *      Documentos veria "Seguro vencido" na lista de avisos.
 *
 * ONDA 53 — as outras três categorias ganharam fonte. A onda 44 as deixou
 * declaradas com estado vazio honesto porque Agenda (§8), Financeiro (§9) e
 * Marketplace (§11) ainda não existiam; agora existem (migrations 042, 044 e
 * 046) e cada uma entra abaixo num bloco próprio. O contrato não mudou: tudo
 * vira `Notificacao`, tudo passa por `filtrarPorPermissao`, tudo é agrupado
 * por `grupo`.
 *
 * O que ficou de fora, dito em voz alta: o PUSH das três categorias novas.
 * Quem dispara push é o cron `app/api/alertas/disparar/route.ts`, que dedupe
 * por `alertas_enviados` (embarcação + janela + ciclo) — e proposta recebida
 * no Marketplace não é evento de embarcação nenhuma. Fazer isso direito pede
 * chave de dedupe própria, que é trabalho de outra onda; fabricar uma agora
 * arriscaria mandar o mesmo push todo dia, exatamente o spam que o §5.2
 * manda evitar. In-app, que é o canal que o §5.2 garante pras informativas,
 * está completo.
 */

/** Pra onde o aviso de item leva quem clica — sempre um destino de LEITURA,
 *  nunca `/barco/itens/[id]/editar` (esse formulário checa `podeEditar` e
 *  expulsa com toast quem só tem `podeVer`; achado Importante da revisão da
 *  onda 59). Item COM equipamento tem ficha própria (`/barco/equipamento`,
 *  Tarefa 3 da onda 60); sem equipamento, o hub da aba — mesmo mapa
 *  aba→rota de `rotaDoHub` em `app/(app)/agenda/page.tsx` ("pra onde a linha
 *  derivada leva quem só pode VER"), pra não duplicar dois hubs diferentes
 *  pro mesmo aviso. */
function hrefDoItem(equipamentoId: string | null, aba: Aba): string {
  if (equipamentoId) return `/barco/equipamento/${equipamentoId}`
  if (aba === "documentos") return "/barco/documentos"
  if (aba === "hidraulica") return "/barco/hidraulica"
  if (aba === "seguranca") return "/barco/seguranca"
  if (aba === "eletrica") return "/barco/eletrica"
  if (aba === "equipamentos") return "/barco/equipamentos"
  return "/barco"
}

export const carregarNotificacoes = cache(async (): Promise<Notificacao[]> => {
  const painel = await carregarPainel()
  if (!painel) return []
  const { embarcacao, equipamentos, itens, permissoes } = painel
  const hoje = hojeISO()
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  const usuarioId = user?.id ?? ""

  const { data: ocorrenciasBrutas } = await supabase
    .from("ocorrencias").select("id, titulo, aba, estado, gravidade, created_at")
    .eq("embarcacao_id", embarcacao.id)
    .in("estado", [...ESTADOS_QUE_PESAM_NA_SAUDE])
    .order("created_at", { ascending: false })

  const deItens: Notificacao[] = itens
    .map((i) => {
      const eq = equipamentos.find((e) => e.id === i.equipamento_id) ?? null
      const r = calcularSemaforo(itemMonitoradoToItemCalcInterno(i), eq?.horas_atuais ?? null, hoje)
      const aba = abaDoItem(i, equipamentos)
      return { i, eq, r, aba }
    })
    .filter(({ r }) => r.status !== "ok")
    .map(({ i, eq, r, aba }) => ({
      id: `item:${i.id}`,
      titulo: eq ? `${i.nome} — ${nomeDoEquipamento(eq)}` : i.nome,
      detalhe: textoRestante(r),
      categoria: "embarcacao" as const,
      nivel: nivelDoStatusItem(r.status),
      aba,
      // ONDA 60 (Tarefa 4) — o aviso leva pro destino de LEITURA, não pro
      // formulário de editar (que expulsa quem só tem `podeVer`, achado
      // Importante da revisão da onda 59). Item COM equipamento tem ficha
      // própria (Tarefa 3); sem equipamento, o hub da aba — mesmo mapa
      // aba→rota de `rotaDoHub` em `app/(app)/agenda/page.tsx`. Quem pode
      // editar, edita DA ficha/hub — o botão está lá.
      href: hrefDoItem(i.equipamento_id, aba),
      // O verbo da tela de destino: documento renova (o botão fica na
      // ficha, quem só vê lê), o resto vê a manutenção.
      acao: aba === "documentos" ? "Ver documento" : "Ver manutenção",
      quando: null,
      // Agrupa por hub + severidade: "3 documentos vencidos" numa linha em
      // vez de três linhas quase iguais (PRD §5.2, evitar spam).
      grupo: `item:${aba}:${r.status}`,
    }))

  const deOcorrencias: Notificacao[] = ((ocorrenciasBrutas ?? []) as OcorrenciaParaNotificacao[]).map((o) => ({
    id: `ocorrencia:${o.id}`,
    titulo: o.titulo,
    detalhe: `${ROTULO_ESTADO[o.estado]}${o.gravidade ? ` · gravidade ${ROTULO_GRAVIDADE[o.gravidade]}` : ""}`,
    categoria: "embarcacao" as const,
    nivel: nivelDaOcorrencia(o.estado, o.gravidade),
    aba: o.aba,
    href: `/barco/ocorrencias/${o.id}`,
    acao: "Ver ocorrência",
    quando: o.created_at,
    grupo: `ocorrencia:${o.aba}`,
  }))

  const [deAgenda, deFinanceiro, deMarketplace] = await Promise.all([
    notificacoesDaAgenda(embarcacao.id, usuarioId, hoje),
    notificacoesDoFinanceiro(embarcacao.id, hoje),
    notificacoesDoMarketplace(usuarioId),
  ])

  return ordenarNotificacoes(
    filtrarPorPermissao([...deItens, ...deOcorrencias, ...deAgenda, ...deFinanceiro, ...deMarketplace], permissoes),
  )
})

/**
 * AGENDA (PRD §8 + §5.2): "compromisso próximo" e "compromisso compartilhado
 * com você".
 *
 * A RLS da migration 044 já devolve só os MEUS e os que compartilharam
 * comigo — por isso não existe filtro de dono na consulta. "Compartilhado
 * comigo" é, então, simplesmente `criado_por !== eu`.
 *
 * `aba: "agenda"` faz `filtrarPorPermissao` cortar de novo, pra quem tem
 * vínculo mas não tem a área Agenda liberada (§19).
 */
async function notificacoesDaAgenda(
  embarcacaoId: string,
  usuarioId: string,
  hoje: string,
): Promise<Notificacao[]> {
  const supabase = await supabaseServer()
  const limite = somarDiasISO(hoje, DIAS_AVISO_AGENDA)
  const { data } = await supabase
    .from("agenda_eventos")
    .select("id, titulo, data, hora, criado_por")
    // Concluído é histórico e "não polui a Agenda normal" (§8) — muito menos
    // a lista de avisos.
    .is("concluido_em", null)
    .eq("embarcacao_id", embarcacaoId)
    .gte("data", hoje).lte("data", limite)
    .order("data")

  return ((data ?? []) as CompromissoParaNotificacao[]).map((c) => {
    const dias = diasAteData(c.data, hoje)
    const deOutraPessoa = c.criado_por != null && c.criado_por !== usuarioId
    const hora = c.hora ? ` às ${c.hora.slice(0, 5)}` : ""
    return {
      id: `agenda:${c.id}`,
      titulo: c.titulo,
      detalhe: deOutraPessoa
        ? `Compartilhado com você · ${rotuloDeProximidade(dias)}${hora}`
        : `${rotuloDeProximidade(dias)}${hora}`,
      categoria: "agenda" as const,
      // Compromisso que outra pessoa colocou na sua agenda "envolve outra
      // pessoa" (§5.2) e por isso sobe pra importante mesmo estando longe:
      // você ainda não sabia que ele existia.
      nivel: deOutraPessoa ? ("importante" as const) : nivelDoCompromisso(dias),
      aba: "agenda" as const,
      href: `/agenda/${c.id}`,
      // O href aponta pro compromisso, não pra lista da Agenda — o verbo
      // segue o destino.
      acao: "Ver compromisso",
      quando: c.data,
      // Agrupa por natureza, não por dia: "3 compromissos compartilhados"
      // numa linha, em vez de três linhas quase iguais (§5.2).
      grupo: deOutraPessoa ? "agenda:compartilhado" : "agenda:proximo",
    }
  })
}

/**
 * FINANCEIRO (PRD §9.2 + §5.2): "recorrente vencendo" e "lançamento
 * pendente".
 *
 * Os dois avisos são o mesmo fato visto de dois lados, e por isso saem
 * juntos daqui: a série recorrente que ainda não virou linha (o §9.2 proíbe
 * considerar pago o que ninguém confirmou, então o vencimento só existe
 * calculado) e a linha que já existe e continua pendente.
 *
 * O vencimento calculado some da lista assim que vira lançamento — mesma
 * regra da tela de Recorrentes (índice único `recorrencia_id + data`), senão
 * a mesma conta apareceria duas vezes no sino.
 */
async function notificacoesDoFinanceiro(embarcacaoId: string, hoje: string): Promise<Notificacao[]> {
  const supabase = await supabaseServer()
  const limite = somarDiasISO(hoje, DIAS_AVISO_FINANCEIRO)
  // 90 dias pra trás: conta vencida há três meses ainda é pendência real, e
  // um corte em "hoje" esconderia justamente o que mais precisa de ação.
  const inicio = somarDiasISO(hoje, -90)

  const [{ data: pendentes }, { data: series }, { data: jaLancados }] = await Promise.all([
    supabase.from("lancamentos_financeiros")
      .select("id, descricao, tipo, valor_centavos, data")
      .eq("embarcacao_id", embarcacaoId).eq("status", "pendente")
      .gte("data", inicio).lte("data", limite),
    supabase.from("recorrencias_financeiras").select("*")
      .eq("embarcacao_id", embarcacaoId).eq("ativa", true),
    supabase.from("lancamentos_financeiros").select("recorrencia_id, data")
      .eq("embarcacao_id", embarcacaoId).not("recorrencia_id", "is", null)
      .gte("data", inicio).lte("data", limite),
  ])

  const lancados = new Set(
    ((jaLancados ?? []) as { recorrencia_id: string | null; data: string }[])
      .map((l) => `${l.recorrencia_id}|${l.data}`),
  )

  const dePendentes: Notificacao[] = ((pendentes ?? []) as LancamentoParaNotificacao[]).map((l) => {
    const dias = diasAteData(l.data, hoje)
    return {
      id: `lancamento:${l.id}`,
      titulo: l.descricao,
      detalhe: `${l.tipo === "entrada" ? "A receber" : "A pagar"} ${formatarReais(l.valor_centavos)} · ${rotuloDeProximidade(dias)}`,
      categoria: "financeiro" as const,
      nivel: nivelDoVencimentoFinanceiro(dias),
      aba: "gastos" as const,
      href: `/financeiro/lancamentos/${l.id}`,
      // "Confirmar pagamento" prometeria um botão que quem tem acesso de
      // leitura não vê na tela de destino — "Ver lançamento" vale pra todos.
      acao: "Ver lançamento",
      quando: l.data,
      grupo: dias <= 0 ? "financeiro:vencido" : "financeiro:a-vencer",
    }
  })

  const deRecorrentes: Notificacao[] = []
  for (const bruta of (series ?? []) as RecorrenciaFinanceira[]) {
    for (const data of vencimentosNoIntervalo(
      { inicio: bruta.inicio, fim: bruta.fim, frequencia: bruta.frequencia },
      inicio,
      limite,
    )) {
      if (lancados.has(`${bruta.id}|${data}`)) continue
      const dias = diasAteData(data, hoje)
      deRecorrentes.push({
        id: `recorrente:${bruta.id}:${data}`,
        titulo: bruta.descricao,
        detalhe: `Recorrente ${ROTULO_FREQUENCIA[bruta.frequencia].toLowerCase()} · ${formatarReais(bruta.valor_centavos)} · ${rotuloDeProximidade(dias)}`,
        categoria: "financeiro",
        nivel: nivelDoVencimentoFinanceiro(dias),
        aba: "gastos",
        href: `/financeiro/recorrentes/${bruta.id}`,
        // A tela de destino é a ficha da série (o "Paguei" mora na lista de
        // Recorrentes) — sem verbo de ação honesto, vale o nome da tela.
        acao: "Ver recorrente",
        quando: data,
        grupo: dias <= 0 ? "financeiro:recorrente-vencida" : "financeiro:recorrente-a-vencer",
      })
    }
  }

  return [...dePendentes, ...deRecorrentes]
}

/**
 * MARKETPLACE (PRD §11.5 e §11.6): "proposta recebida", "proposta
 * aceita/recusada" e "negócio aguardando sua confirmação".
 *
 * `aba: null` de propósito — Marketplace não pertence a hub nenhum e nem
 * sequer a uma embarcação: o Captain Pro e o Partner recebem estes avisos
 * sem ter barco. Quem restringe é a RLS da migration 046, que só devolve
 * demanda/proposta de quem é parte — por isso a consulta filtra por
 * `autor_id` e não confia só nela: as duas travas, como no resto da função.
 */
async function notificacoesDoMarketplace(usuarioId: string): Promise<Notificacao[]> {
  if (usuarioId === "") return []
  const supabase = await supabaseServer()

  const { data: minhasDemandas } = await supabase
    .from("demandas").select("id").eq("autor_id", usuarioId).in("status", ["aberta", "em_negociacao"])
  const idsMinhasDemandas = ((minhasDemandas ?? []) as { id: string }[]).map((d) => d.id)

  const [{ data: recebidas }, { data: minhasPropostas }] = await Promise.all([
    idsMinhasDemandas.length > 0
      ? supabase.from("propostas").select("id, demanda_id, autor_nome, criado_em")
          .in("demanda_id", idsMinhasDemandas).eq("status", "enviada")
      : Promise.resolve({ data: [] }),
    supabase.from("propostas").select("id, demanda_id, status, atualizado_em")
      .eq("autor_id", usuarioId).in("status", ["aceita", "recusada"]),
  ])

  const avisos: Notificacao[] = ((recebidas ?? []) as PropostaRecebidaParaNotificacao[]).map((p) => ({
    id: `proposta-recebida:${p.id}`,
    titulo: `${p.autor_nome} respondeu ao seu pedido`,
    detalhe: "Abra para ver a proposta e aceitar ou recusar.",
    categoria: "marketplace" as const,
    nivel: NIVEL_AVISO_MARKETPLACE.proposta_recebida,
    aba: null,
    href: `/marketplace/${p.demanda_id}`,
    // Na tela do pedido a proposta se aceita ou se recusa — responder é o verbo.
    acao: "Responder proposta",
    quando: p.criado_em,
    grupo: `marketplace:recebida:${p.demanda_id}`,
  }))

  for (const p of (minhasPropostas ?? []) as PropostaMinhaParaNotificacao[]) {
    const aceita = p.status === "aceita"
    avisos.push({
      id: `proposta-${p.status}:${p.id}`,
      titulo: aceita ? "Sua proposta foi aceita" : "Sua proposta não foi escolhida",
      detalhe: aceita ? "O contato de quem publicou já está liberado." : "O pedido seguiu com outra resposta.",
      categoria: "marketplace",
      nivel: aceita ? NIVEL_AVISO_MARKETPLACE.proposta_aceita : NIVEL_AVISO_MARKETPLACE.proposta_recusada,
      aba: null,
      href: `/marketplace/${p.demanda_id}`,
      // Aceita libera o contato de quem publicou; recusada só resta ler o
      // pedido — cada uma nomeia o que a tela de destino de fato entrega.
      acao: aceita ? "Ver contato" : "Ver pedido",
      quando: p.atualizado_em,
      grupo: `marketplace:proposta-${p.status}`,
    })
  }

  // §11.6 — "um lado marca como realizado; o outro confirma ou nega". O aviso
  // é pro lado que ainda não se manifestou; quem já respondeu não é
  // lembrado de novo (seria o spam que o §5.2 proíbe).
  const { data: negocios } = await supabase
    .from("negocios").select("id, demanda_id, cliente_id, fornecedor_id, criado_em")
    .or(`cliente_id.eq.${usuarioId},fornecedor_id.eq.${usuarioId}`)
  const idsNegocios = ((negocios ?? []) as NegocioParaNotificacao[]).map((n) => n.id)
  const { data: confirmacoes } = idsNegocios.length > 0
    ? await supabase.from("negocios_confirmacoes").select("negocio_id, usuario_id").in("negocio_id", idsNegocios)
    : { data: [] }
  const jaRespondi = new Set(
    ((confirmacoes ?? []) as { negocio_id: string; usuario_id: string }[])
      .filter((c) => c.usuario_id === usuarioId)
      .map((c) => c.negocio_id),
  )

  for (const n of (negocios ?? []) as NegocioParaNotificacao[]) {
    if (jaRespondi.has(n.id)) continue
    avisos.push({
      id: `negocio:${n.id}`,
      titulo: "Um negócio espera a sua confirmação",
      detalhe: "O outro lado marcou como realizado. Confirme ou diga que não reconhece.",
      categoria: "marketplace",
      nivel: NIVEL_AVISO_MARKETPLACE.negocio_aguardando,
      aba: null,
      href: `/marketplace/${n.demanda_id}`,
      acao: "Confirmar negócio",
      quando: n.criado_em,
      grupo: "marketplace:negocio-aguardando",
    })
  }

  return avisos
}

/** "hoje", "amanhã", "em 4 dias", "há 3 dias" — a frase que o cartão do aviso
 *  mostra. Aqui e não no domínio porque é cópia de tela, e o domínio já
 *  entrega o número. */
function rotuloDeProximidade(dias: number): string {
  if (dias === 0) return "hoje"
  if (dias === 1) return "amanhã"
  if (dias === -1) return "ontem"
  return dias > 0 ? `em ${dias} dias` : `há ${Math.abs(dias)} dias`
}

/** Soma dias a uma data civil em UTC — mesma aritmética de `diasAteData`,
 *  no sentido inverso. */
function somarDiasISO(iso: string, dias: number): string {
  const [a, m, d] = iso.split("-").map(Number)
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10)
}

interface OcorrenciaParaNotificacao {
  id: string
  titulo: string
  aba: Aba
  estado: EstadoOcorrencia
  gravidade: Gravidade | null
  created_at: string
}

interface CompromissoParaNotificacao {
  id: string
  titulo: string
  data: string
  hora: string | null
  criado_por: string | null
}

interface LancamentoParaNotificacao {
  id: string
  descricao: string
  tipo: "despesa" | "entrada"
  valor_centavos: number
  data: string
}

interface PropostaRecebidaParaNotificacao {
  id: string
  demanda_id: string
  autor_nome: string
  criado_em: string
}

interface PropostaMinhaParaNotificacao {
  id: string
  demanda_id: string
  status: "aceita" | "recusada"
  atualizado_em: string
}

interface NegocioParaNotificacao {
  id: string
  demanda_id: string
  cliente_id: string
  fornecedor_id: string
  criado_em: string
}

export { itemMonitoradoToItemCalc } from "@/lib/domain/conversores"
export { hojeISO } from "@/lib/domain/datas"
