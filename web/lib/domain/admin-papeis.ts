/**
 * PAPÉIS ADMINISTRATIVOS (PRD §21, §22) — regra pura.
 *
 * O §22 é explícito: "Admin deve operar por permissões de função, não por
 * simples 'admin=true'". Este arquivo é a versão TypeScript da mesma verdade
 * que a migration 049 grava na RLS — a tela usa isto pra decidir o que
 * mostrar, o banco usa a RLS pra decidir o que ENTREGAR. Se os dois
 * divergirem, quem manda é o banco; a tela só evita mostrar um botão que vai
 * dar erro.
 *
 * ATENÇÃO — isto NÃO é `lib/domain/permissoes.ts`.
 * São dois sistemas de permissão diferentes que nunca se encostam:
 *
 *   · `permissoes.ts` (PROP / COMANDANTE / TRIPULANTE) responde "o que esta
 *     pessoa pode fazer NAQUELA EMBARCAÇÃO". É uma relação entre uma pessoa e
 *     um barco, criada por convite do dono.
 *   · este arquivo (CEO / Suporte / Comercial / Vistoriador) responde "o que
 *     esta pessoa pode fazer NO COMMANDER COMO EMPRESA". É um cargo interno,
 *     concedido pelo CEO.
 *
 * Um CEO não enxerga o Diário de Bordo de um cliente por ser CEO — pra isso
 * ele precisaria de um vínculo com a embarcação, que é o outro sistema. O
 * §22 ("isolamento entre embarcações e contas deve ser obrigatório no
 * backend") depende exatamente dessa separação.
 */

export type PapelAdmin = "ceo" | "suporte" | "comercial" | "vistoriador"

export const PAPEIS_ADMIN: readonly PapelAdmin[] = ["ceo", "suporte", "comercial", "vistoriador"]

export const ROTULO_PAPEL: Record<PapelAdmin, string> = {
  ceo: "CEO / Super Admin",
  suporte: "Suporte",
  comercial: "Comercial",
  vistoriador: "Gold / Vistoriador",
}

/** A frase do §21, palavra por palavra — é o que a tela mostra ao lado de
 *  cada papel, pra que quem concede saiba o que está concedendo. */
export const ESCOPO_PAPEL: Record<PapelAdmin, string> = {
  ceo: "Acesso total; cria/edita/suspende administradores; métricas executivas; configurações críticas.",
  suporte: "Usuários, embarcações, planos/status, chamados e operação de suporte; sem configurações estratégicas críticas.",
  comercial: "Partners, destaques, campanhas, publicidade e métricas comerciais.",
  vistoriador: "Vistorias atribuídas somente às regiões autorizadas; agenda e registros de visita. Não concede acesso nacional irrestrito.",
}

/** Áreas do Admin Commander. Uma por tela — é o que a navegação usa pra
 *  montar o menu de cada pessoa em vez de mostrar tudo e dar erro depois. */
export type AreaAdmin =
  | "dashboard"
  | "administradores"
  | "logs"
  | "taxonomia"
  | "gold"
  | "gold_precos"
  | "marketplace"
  | "parceiros"
  | "avaliacoes"

/**
 * Quem alcança cada área. O CEO não aparece em nenhuma lista porque ele é
 * tratado à parte (`temPapelAdmin` abaixo) — "Acesso total" no §21 significa
 * que qualquer lista que precisasse citá-lo estaria incompleta um dia.
 *
 * `dashboard` é só do CEO de propósito: o §21.1 se chama "Dashboard CEO", e
 * receita/MRR/churn são as "métricas executivas" que o §21 reserva a ele.
 */
const ALCANCE: Record<AreaAdmin, readonly PapelAdmin[]> = {
  dashboard: [],
  administradores: [],
  logs: ["suporte", "comercial", "vistoriador"], // cada um vê as próprias ações; o CEO vê todas
  taxonomia: ["suporte", "comercial"],
  gold: ["suporte", "vistoriador"],
  gold_precos: ["comercial"],
  marketplace: ["comercial"],
  parceiros: ["comercial"],
  // Moderar avaliação é atendimento a cliente, não gestão comercial: o §21
  // dá ao Suporte "chamados e operação de suporte", e uma contestação é
  // exatamente isso. Fora do Comercial de propósito — quem vende destaque
  // pro parceiro não deveria decidir se a nota ruim dele fica no ar.
  avaliacoes: ["suporte"],
}

/** CEO implica todo papel — "Acesso total" (§21). Sem isso a conta-mãe
 *  precisaria se conceder os quatro papéis pra trabalhar, e deixaria de ser
 *  conta-mãe. Espelha `tem_papel_admin()` da migration 049. */
export function temPapelAdmin(papeis: readonly PapelAdmin[], papel: PapelAdmin): boolean {
  return papeis.includes("ceo") || papeis.includes(papel)
}

export function ehCeo(papeis: readonly PapelAdmin[]): boolean {
  return papeis.includes("ceo")
}

/** Alguém com qualquer papel ativo — a porta do painel. Não libera dado
 *  nenhum sozinho; só diz "esta pessoa trabalha aqui". */
export function ehAdminQualquer(papeis: readonly PapelAdmin[]): boolean {
  return papeis.length > 0
}

/** Papel de alcance NACIONAL. O vistoriador fica de fora por definição do
 *  §21 ("Não concede acesso nacional irrestrito") — a mesma linha que a
 *  função `eh_admin()` do banco passou a traçar na onda 48. */
export function ehAdminNacional(papeis: readonly PapelAdmin[]): boolean {
  return papeis.some((p) => p === "ceo" || p === "suporte" || p === "comercial")
}

export function podeAcessar(papeis: readonly PapelAdmin[], area: AreaAdmin): boolean {
  if (ehCeo(papeis)) return true
  return papeis.some((p) => ALCANCE[area].includes(p))
}

/** "O CEO/Super Admin é a conta-mãe que cria e gerencia os demais
 *  administradores" (§21) — ninguém mais concede papel a ninguém. */
export function podeGerenciarAdministradores(papeis: readonly PapelAdmin[]): boolean {
  return ehCeo(papeis)
}

/** Só o vistoriador tem escopo regional; conceder o papel sem nenhuma região
 *  entrega um acesso que não serve pra nada (e a RLS nega tudo). A tela usa
 *  isto pra exigir ao menos uma região no formulário. */
export function exigeRegioes(papel: PapelAdmin): boolean {
  return papel === "vistoriador"
}

/** Texto curto pro cabeçalho ("Você entrou como Suporte e Comercial"). */
export function resumoPapeis(papeis: readonly PapelAdmin[]): string {
  if (papeis.length === 0) return "Sem papel administrativo"
  const ordenados = PAPEIS_ADMIN.filter((p) => papeis.includes(p))
  const nomes = ordenados.map((p) => ROTULO_PAPEL[p])
  if (nomes.length === 1) return nomes[0]
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`
}

/** Converte o que veio do banco em papéis válidos, jogando fora qualquer
 *  string desconhecida — um papel que o app não entende não pode virar
 *  acesso por acidente. */
export function papeisValidos(brutos: readonly string[]): PapelAdmin[] {
  return PAPEIS_ADMIN.filter((p) => brutos.includes(p))
}
