/**
 * Free → Premium (onda 38, `docs/prd/upgrade2-master.txt` §43–44).
 *
 * Fonte única de duas decisões, ambas puras (nunca consultam o banco — quem
 * chama junta o sinal em `web/lib/consultas.ts` e entrega pronto aqui, mesmo
 * espírito de `semaforo.ts`/`verified.ts`/`gold.ts`):
 *
 *   1. `nivelPlano`      — a embarcação está no Free ou no Premium?
 *   2. `recursoLiberado` — um recurso específico está liberado pra ESTE nível?
 *
 * Filosofia do PRD §43, travada pelo dono — "a embarcação deve poder parecer
 * visualmente completa; recursos Premium aparecem, porém bloqueados" e
 * "mostrar o valor do produto antes do paywall". Por isso nenhum gate daqui
 * ESCONDE um botão ou uma tela — a UI que consulta `recursoLiberado` sempre
 * mostra o caminho (o quê e por quê), nunca some com ele. E nada que já era
 * gratuito é RETIRADO de quem usa: os limites abaixo só passam a valer pra
 * criação de registro NOVO a partir de agora — registros/fotos que uma
 * embarcação já tinham antes desta onda continuam 100% visíveis e editáveis
 * mesmo acima do teto.
 *
 * SEGURANÇA NUNCA ENTRA NO PAYWALL — decisão de produto, não just detalhe de
 * escopo. O alarme de âncora e o MOB vivem em
 * `web/components/mapa/navegar-mapa.tsx` (fora do escopo desta onda por
 * regra do orquestrador) e os avisos de vencimento de documento/manutenção
 * usam o farol de `web/lib/domain/semaforo.ts` + os pushes de
 * `web/lib/acoes/push.ts`/`web/lib/domain/alertas.ts` (também fora do
 * escopo). Nenhum desses três arquivos importa nada deste módulo — a
 * ausência de qualquer chamada a `nivelPlano`/`recursoLiberado` ali É a
 * garantia: colocar segurança atrás de assinatura tiraria justo de quem mais
 * precisa, na hora que mais importa.
 */

export type NivelPlano = "free" | "premium"

/** O que o `web/lib/consultas.ts` traz do banco pra decidir o nível — nunca
 *  mais que isso: o domínio não precisa saber COMO a assinatura ou a
 *  concessão foram lidas, só o resultado. */
export interface SinalPlano {
  /** Assinatura Asaas do PROPRIETÁRIO da embarcação com status "ativa" OU
   *  "inadimplente" — a MESMA carência que já vale no gate de cobrança do
   *  app (`web/app/(app)/layout.tsx`: inadimplente ainda entra, só
   *  `SUBSCRIPTION_DELETED`/cancelamento tira o acesso). Repetir a regra
   *  aqui em vez de importar de lá é proposital: aquele gate decide "pode
   *  usar o app", este decide "em que nível" — os dois podem divergir no
   *  futuro sem se acoplar. */
  assinaturaAtiva: boolean
  /** Maior `valido_ate` (AAAA-MM-DD) entre as concessões de
   *  `premium_concessoes` do PROPRIETÁRIO (onda 35 — hoje só `origem =
   *  'gold'`, Gold aprovado concede 6 ou 12 meses de Premium, PRD §40).
   *  `null` = nenhuma concessão. */
  concessaoValidoAte: string | null
}

/** Free ou Premium — assinatura paga E concessão do Gold contam igual: as
 *  duas são formas legítimas de ter Premium, o app nunca trata uma como
 *  "Premium de verdade" e a outra como "quase". `hoje` explícito (AAAA-MM-DD,
 *  mesmo formato de `hojeISO()`) pra ser testável sem mockar relógio. */
export function nivelPlano(sinal: SinalPlano, hoje: string): NivelPlano {
  if (sinal.assinaturaAtiva) return "premium"
  if (sinal.concessaoValidoAte != null && sinal.concessaoValidoAte >= hoje) return "premium"
  return "free"
}

/** Recursos com gate — cada um comentado com o PORQUÊ do limite escolhido.
 *  Adicionar um recurso novo aqui é o único lugar que precisa mudar (união
 *  do tipo obriga a tratar o caso novo em `recursoLiberado`/`mensagemBloqueio`
 *  — o TypeScript quebra a build se esquecer). */
export type RecursoControlado = "diario_registros" | "fotos" | "compartilhar_saida"

export const LIMITES_FREE = {
  // PRD §43 já cita este exemplo ("até 2 Diários") pra ilustrar a filosofia,
  // mas 2 registros mal dá tempo de mostrar valor de verdade — o dono deste
  // domínio escolheu um teto que cobre alguns MESES de uso normal (a maioria
  // dos barcos registra poucas saídas/manutenções por mês) antes do paywall
  // aparecer, sem abrir mão do "limite existe" que o PRD pede.
  diarioRegistros: 20,
  // Fotos completam o dossiê visual que o PRD quer "visualmente completo" no
  // Free — por isso o teto aqui é generoso o bastante pra um álbum inicial
  // real (fachada, convés, cabine, motor, documentação básica) sem forçar o
  // paywall na primeira sessão, mas baixo o bastante pra "álbum completo,
  // sem limite" ser um benefício de verdade do Premium.
  fotos: 8,
} as const

/** Recursos 100% Premium (sem contagem — bloqueado ou liberado, nunca "só
 *  mais um"). Compartilhar uma saída é extra de divulgação/orgulho do
 *  registro, não essencial pra operar o barco — bom candidato a cadeado
 *  direto, sem tirar nada de quem só quer registrar e consultar o diário. */
const RECURSOS_TUDO_OU_NADA: readonly RecursoControlado[] = ["compartilhar_saida"]

/**
 * A função pura central: decide se ESTE recurso está liberado pra este
 * nível de plano. `usoAtual` só importa pros recursos com contagem
 * (`diario_registros`/`fotos`) — omitido, conta como 0.
 */
export function recursoLiberado(recurso: RecursoControlado, nivel: NivelPlano, usoAtual = 0): boolean {
  if (nivel === "premium") return true
  if (RECURSOS_TUDO_OU_NADA.includes(recurso)) return false
  switch (recurso) {
    case "diario_registros":
      return usoAtual < LIMITES_FREE.diarioRegistros
    case "fotos":
      return usoAtual < LIMITES_FREE.fotos
    default:
      return false
  }
}

/** Texto honesto do cadeado — sempre diz o limite E, quando faz sentido, o
 *  quanto já foi usado (nunca um "bloqueado" seco sem explicar). Fonte única
 *  da cópia: usado tanto pelo componente de bloqueio quanto (resumido) na
 *  tela de assinatura, pra nunca divergir. */
export function mensagemBloqueio(recurso: RecursoControlado, usoAtual?: number): { titulo: string; descricao: string } {
  switch (recurso) {
    case "diario_registros":
      return {
        titulo: "Limite do Diário no plano Free",
        descricao: usoAtual != null
          ? `O plano Free permite até ${LIMITES_FREE.diarioRegistros} registros no Diário de Bordo — este barco já tem ${usoAtual}. Assine o Premium para registrar sem limite.`
          : `O plano Free permite até ${LIMITES_FREE.diarioRegistros} registros no Diário de Bordo. Assine o Premium para registrar sem limite.`,
      }
    case "fotos":
      return {
        titulo: "Limite de fotos no plano Free",
        descricao: usoAtual != null
          ? `O plano Free permite até ${LIMITES_FREE.fotos} fotos no acervo — este barco já tem ${usoAtual}. Assine o Premium para um álbum sem limite.`
          : `O plano Free permite até ${LIMITES_FREE.fotos} fotos no acervo. Assine o Premium para um álbum sem limite.`,
      }
    case "compartilhar_saida":
      return {
        titulo: "Recurso Premium",
        descricao: "Compartilhar uma saída do Diário como imagem ou link é um recurso do Premium.",
      }
  }
}

/** Lista curta pra tela de assinatura e pro convite de upgrade — sempre em
 *  sincronia com `LIMITES_FREE` (nada hardcoded duas vezes). */
export const BENEFICIOS_PREMIUM: readonly string[] = [
  "Diário de Bordo sem limite de registros",
  "Álbum de fotos sem limite",
  "Compartilhar saídas do Diário como imagem ou link",
]
