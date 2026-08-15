import { formatarReais } from "./gastos"

/**
 * DASHBOARD CEO (PRD §21.1) — regra pura de como um número chega na tela.
 *
 * A decisão central deste arquivo: **zero e "não existe" são coisas
 * diferentes**. Num painel executivo, "Receita: R$ 0,00" afirma que houve
 * medição e o resultado foi nada; "publicidade ativa: 0" afirma que a
 * publicidade existe e ninguém comprou. Se a fonte do dado ainda não foi
 * construída (planos da onda 47, publicidade do §20 que não tem nem tabela),
 * escrever 0 é inventar uma medição que nunca aconteceu — e é o tipo de
 * mentira que faz alguém tomar decisão errada olhando um gráfico.
 *
 * Por isso todo número passa por `Leitura<T>`: ou veio (`ok`), ou a fonte
 * ainda não existe (`sem_fonte`), ou existe e a leitura falhou (`erro`). Os
 * três viram textos diferentes na tela, nunca o mesmo "0".
 */

export type MotivoAusencia = "sem_fonte" | "erro"

export type Leitura<T> = { ok: true; dados: T } | { ok: false; motivo: MotivoAusencia; detalhe?: string }

export interface Metrica {
  rotulo: string
  /** Já formatado pra exibição. `null` quando não há dado — a tela mostra o
   *  `detalhe` no lugar, nunca um traço mudo. */
  valor: string | null
  apoio?: string
  estado: "ok" | MotivoAusencia
  detalhe?: string
}

export interface GrupoMetricas {
  titulo: string
  metricas: Metrica[]
}

export function metrica(rotulo: string, valor: string, apoio?: string): Metrica {
  return { rotulo, valor, apoio, estado: "ok" }
}

/** A fonte do dado ainda não foi construída. O texto explica QUAL peça falta,
 *  porque "sem dados" sozinho não diz se é falta de uso ou falta de código. */
export function metricaSemFonte(rotulo: string, detalhe: string): Metrica {
  return { rotulo, valor: null, estado: "sem_fonte", detalhe }
}

/** A fonte existe e não respondeu. Diferente de `sem_fonte`: aqui há algo pra
 *  consertar agora. */
export function metricaComErro(rotulo: string, detalhe = "Não foi possível ler esta fonte agora."): Metrica {
  return { rotulo, valor: null, estado: "erro", detalhe }
}

/** Aplica a leitura: `ok` vira número formatado, o resto vira ausência
 *  explicada. É por aqui que passa TODA métrica do painel. */
export function daLeitura<T>(
  rotulo: string,
  leitura: Leitura<T>,
  extrair: (dados: T) => { valor: string; apoio?: string },
  detalheSemFonte: string,
): Metrica {
  if (leitura.ok) {
    const { valor, apoio } = extrair(leitura.dados)
    return metrica(rotulo, valor, apoio)
  }
  if (leitura.motivo === "sem_fonte") return metricaSemFonte(rotulo, leitura.detalhe ?? detalheSemFonte)
  return metricaComErro(rotulo, leitura.detalhe)
}

/** Percentual honesto: sem denominador não há percentual — devolve `null` em
 *  vez de 0%. Zero por cento afirma que ninguém cancelou; nulo admite que
 *  não havia ninguém pra cancelar. */
export function percentual(parte: number, total: number): number | null {
  if (total <= 0) return null
  return Math.round((parte / total) * 1000) / 10
}

/** Churn do mês: cancelamentos sobre a base que existia (ativas de hoje +
 *  as que saíram no período). */
export function churnMensal(ativas: number, canceladas30d: number): number | null {
  return percentual(canceladas30d, ativas + canceladas30d)
}

export function formatarPercentual(n: number | null): string | null {
  return n == null ? null : `${n.toString().replace(".", ",")}%`
}

// --- Fontes -----------------------------------------------------------------

export interface FontePessoas {
  usuarios: number
  usuarios_30d: number
  embarcacoes: number
  embarcacoes_ativas_90d: number
}

export interface FonteAssinaturas {
  total: number
  ativas: number
  pendentes: number
  /** Nome espelhando o status real da tabela (§23). Era `inadimplentes`, que
   *  ficou órfão quando a onda 47 renomeou o status pra `problema_pagamento`:
   *  a função no banco contava um valor que o check já não aceitava e devolvia
   *  0 pra sempre — e zero num painel executivo lê-se como "ninguém está com
   *  problema de pagamento", que é o oposto de "não sei". */
  problema_pagamento: number
  canceladas: number
  novas_30d: number
  canceladas_30d: number
  mrr_centavos: number
}

export interface FonteGold {
  solicitados: number
  pagos: number
  agendados: number
  selos_ativos: number
  selos_expirados: number
}

export interface FonteParceiros {
  total: number
  visiveis: number
  cortesia: number
}

export interface FonteComercial {
  demandasPublicadas: number
  propostasEnviadas: number
  negociosConfirmados: number
  volumeInformadoCentavos: number
  ticketMedioCentavos: number | null
  negociosComValor: number
}

export interface FontesDashboard {
  pessoas: Leitura<FontePessoas>
  assinaturas: Leitura<FonteAssinaturas>
  gold: Leitura<FonteGold>
  parceiros: Leitura<FonteParceiros>
  comercial: Leitura<FonteComercial>
  /** Planos por status (Commander / Pro / Captain Pro / Partner) — §2 e
   *  §21.1. A modelagem dos sete planos é de outra onda; até lá isto é
   *  sempre `sem_fonte`. */
  planos: Leitura<FontePlanos>
  /** Publicidade ativa, impressões e cliques — §20/§21.1, "quando
   *  implementado". Implementado na onda 52 (migration 053): a fonte é a RPC
   *  `admin_metricas_publicidade`. Daqui em diante "0 impressões" é uma
   *  MEDIÇÃO — o produto existe e ninguém viu anúncio —, e não a ausência
   *  dela. É a diferença que este arquivo inteiro existe pra preservar. */
  publicidade: Leitura<FontePublicidade>
}

export interface FontePlanos {
  porStatus: { rotulo: string; total: number }[]
}

export interface FontePublicidade {
  ativos: number
  impressoes: number
  cliques: number
}

const NUM = (n: number) => n.toLocaleString("pt-BR")

/**
 * Monta o painel inteiro. Puro de propósito: dá pra testar que uma fonte
 * ausente NUNCA vira zero sem subir banco nenhum.
 */
export function montarDashboard(f: FontesDashboard): GrupoMetricas[] {
  return [
    {
      titulo: "Receita e assinantes",
      metricas: [
        daLeitura("MRR", f.assinaturas, (d) => ({ valor: formatarReais(d.mrr_centavos) }), SEM_ASSINATURA),
        daLeitura("Assinantes ativos", f.assinaturas, (d) => ({ valor: NUM(d.ativas) }), SEM_ASSINATURA),
        daLeitura("Novos (30 dias)", f.assinaturas, (d) => ({ valor: NUM(d.novas_30d) }), SEM_ASSINATURA),
        daLeitura(
          "Cancelamentos (30 dias)",
          f.assinaturas,
          (d) => {
            const churn = formatarPercentual(churnMensal(d.ativas, d.canceladas_30d))
            return { valor: NUM(d.canceladas_30d), apoio: churn ? `churn ${churn}` : "sem base para calcular churn" }
          },
          SEM_ASSINATURA,
        ),
        daLeitura(
          "Com problema de pagamento",
          f.assinaturas,
          (d) => ({ valor: NUM(d.problema_pagamento), apoio: `${NUM(d.pendentes)} aguardando 1º pagamento` }),
          SEM_ASSINATURA,
        ),
      ],
    },
    {
      titulo: "Base",
      metricas: [
        daLeitura("Usuários", f.pessoas, (d) => ({ valor: NUM(d.usuarios), apoio: `${NUM(d.usuarios_30d)} nos últimos 30 dias` }), SEM_PESSOAS),
        daLeitura(
          "Embarcações",
          f.pessoas,
          (d) => ({ valor: NUM(d.embarcacoes), apoio: `${NUM(d.embarcacoes_ativas_90d)} com registro nos últimos 90 dias` }),
          SEM_PESSOAS,
        ),
      ],
    },
    {
      titulo: "Planos por status",
      metricas: f.planos.ok
        ? f.planos.dados.porStatus.map((p) => metrica(p.rotulo, NUM(p.total)))
        : [daLeitura("Commander / Pro / Captain Pro / Partner", f.planos, () => ({ valor: "—" }), SEM_PLANOS)],
    },
    {
      titulo: "Partners",
      metricas: [
        daLeitura("Partners cadastrados", f.parceiros, (d) => ({ valor: NUM(d.total) }), SEM_PARCEIROS),
        daLeitura("Ativos na vitrine", f.parceiros, (d) => ({ valor: NUM(d.visiveis) }), SEM_PARCEIROS),
        daLeitura("Gratuitos (cortesia)", f.parceiros, (d) => ({ valor: NUM(d.cortesia) }), SEM_PARCEIROS),
      ],
    },
    {
      titulo: "Marketplace",
      metricas: [
        daLeitura("Pedidos publicados", f.comercial, (d) => ({ valor: NUM(d.demandasPublicadas) }), SEM_COMERCIAL),
        daLeitura("Propostas enviadas", f.comercial, (d) => ({ valor: NUM(d.propostasEnviadas) }), SEM_COMERCIAL),
        daLeitura("Negócios confirmados", f.comercial, (d) => ({ valor: NUM(d.negociosConfirmados) }), SEM_COMERCIAL),
        daLeitura("Volume informado", f.comercial, (d) => ({ valor: formatarReais(d.volumeInformadoCentavos) }), SEM_COMERCIAL),
        // Ticket médio some quando nenhum negócio teve valor informado: o
        // §11.6 diz que informar o valor é opcional, então uma média sobre
        // zero negócios com valor não é "R$ 0,00", é ausência de amostra.
        f.comercial.ok && f.comercial.dados.ticketMedioCentavos == null
          ? metricaSemFonte("Ticket médio", "Nenhum negócio confirmado teve valor informado ainda.")
          : daLeitura(
              "Ticket médio",
              f.comercial,
              (d) => ({
                valor: formatarReais(d.ticketMedioCentavos ?? 0),
                apoio: `${NUM(d.negociosComValor)} de ${NUM(d.negociosConfirmados)} com valor informado`,
              }),
              SEM_COMERCIAL,
            ),
      ],
    },
    {
      titulo: "Commander Gold",
      metricas: [
        daLeitura("Solicitados", f.gold, (d) => ({ valor: NUM(d.solicitados) }), SEM_GOLD),
        daLeitura("Pagos", f.gold, (d) => ({ valor: NUM(d.pagos) }), SEM_GOLD),
        daLeitura("Agendados", f.gold, (d) => ({ valor: NUM(d.agendados) }), SEM_GOLD),
        daLeitura("Selos ativos", f.gold, (d) => ({ valor: NUM(d.selos_ativos) }), SEM_GOLD),
        daLeitura("Selos expirados", f.gold, (d) => ({ valor: NUM(d.selos_expirados) }), SEM_GOLD),
      ],
    },
    {
      titulo: "Publicidade",
      metricas: [
        daLeitura("Anúncios ativos", f.publicidade, (d) => ({ valor: NUM(d.ativos) }), SEM_PUBLICIDADE),
        daLeitura("Impressões", f.publicidade, (d) => ({ valor: NUM(d.impressoes) }), SEM_PUBLICIDADE),
        daLeitura("Cliques", f.publicidade, (d) => ({ valor: NUM(d.cliques) }), SEM_PUBLICIDADE),
      ],
    },
  ]
}

const SEM_ASSINATURA = "Ainda não há assinatura registrada."
const SEM_PESSOAS = "Não foi possível ler a base de usuários."
const SEM_PLANOS = "Os sete planos do §2 ainda não estão modelados — não há status para contar."
const SEM_PARCEIROS = "Nenhum Partner cadastrado."
const SEM_COMERCIAL = "Não foi possível ler o histórico comercial."
const SEM_GOLD = "Não foi possível ler o Commander Gold."
// A fonte passou a existir na onda 52; este texto só aparece se a RPC
// `admin_metricas_publicidade` falhar ou for chamada por quem não é CEO.
const SEM_PUBLICIDADE = "Não foi possível ler as campanhas de publicidade."

/** `true` quando NENHUMA métrica do grupo tem dado — a tela troca o grupo
 *  inteiro por uma frase, em vez de repetir a mesma explicação cinco vezes. */
export function grupoVazio(g: GrupoMetricas): boolean {
  return g.metricas.every((m) => m.valor == null)
}
