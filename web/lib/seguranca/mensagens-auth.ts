/**
 * AS FRASES DAS TELAS DE IDENTIDADE MORAM AQUI — E SÓ AQUI (onda 86, P2-11).
 *
 * Até a onda 85 as actions de `lib/acoes/auth.ts` mandavam o TEXTO da mensagem
 * na URL (`/login?erro=E-mail%20ou%20senha%20incorretos`) e as telas de
 * `(auth)` imprimiam o que chegasse. Não era XSS — o React escapa tudo que
 * interpola —, mas era pior do que parece por outro motivo: qualquer pessoa
 * podia montar
 *
 *     https://commander-tau.vercel.app/login?erro=Sua+conta+foi+bloqueada,
 *     +ligue+para+0800-000-0000
 *
 * e a frase saía com a nossa cara, na nossa tarja vermelha, no NOSSO domínio,
 * com o cadeado do certificado do lado. Phishing com a marca do produto e sem
 * precisar registrar domínio nenhum. Um leitor não tem como distinguir.
 *
 * A correção é tirar o texto da URL: o que viaja agora é um CÓDIGO curto, e a
 * tradução acontece aqui no servidor, contra esta lista fechada. Código que
 * não está na lista não é impresso — cai na frase genérica. O atacante volta a
 * poder trocar uma frase nossa por outra frase nossa, e nada além disso.
 *
 * REGRA HERDADA DO CABEÇALHO DE `lib/acoes/auth.ts`: nenhuma frase daqui pode
 * revelar se um e-mail tem conta no Commander. Por isso "reenvio enviado" e
 * "recuperação enviada" falam no condicional ("se houver conta...") — elas são
 * a MESMA resposta exista ou não a conta.
 */

/** Códigos de ERRO — vão para a tarja de alarme (borda `crit`). */
export const CODIGOS_ERRO = {
  credenciais: "credenciais",
  cadastroFalhou: "cadastro-falhou",
  senhaCurta: "senha-curta",
  senhaNaoTrocada: "senha-nao-trocada",
  linkInvalido: "link-invalido",
  linkExpirado: "link-expirado",
  muitasTentativas: "muitas-tentativas",
} as const

/** Códigos de AVISO — tarja neutra: informam, não acusam. */
export const CODIGOS_AVISO = {
  confirmeEmail: "confirme-email",
  cadastroRecebido: "cadastro-recebido",
  reenvioEnviado: "reenvio-enviado",
  recuperacaoEnviada: "recuperacao-enviada",
} as const

export type CodigoErro = (typeof CODIGOS_ERRO)[keyof typeof CODIGOS_ERRO]
export type CodigoAviso = (typeof CODIGOS_AVISO)[keyof typeof CODIGOS_AVISO]

/** A frase de quando o código não bate com nada conhecido. Deliberadamente
 *  vaga: ela é o que um link forjado consegue arrancar do produto, e não pode
 *  servir de veículo para instrução nenhuma (nem telefone, nem "ligue para",
 *  nem "clique aqui"). */
const GENERICA = "Não foi possível concluir a ação. Tente de novo."

const ERROS: Record<CodigoErro, string> = {
  [CODIGOS_ERRO.credenciais]: "E-mail ou senha incorretos",
  [CODIGOS_ERRO.cadastroFalhou]:
    "Não foi possível criar a conta. Confira os dados e tente novamente.",
  [CODIGOS_ERRO.senhaCurta]: "A senha precisa de pelo menos 8 caracteres.",
  [CODIGOS_ERRO.senhaNaoTrocada]:
    "Não deu para trocar a senha. Peça um link novo na tela de entrada.",
  [CODIGOS_ERRO.linkInvalido]: "Link inválido. Peça um novo e-mail de confirmação abaixo.",
  [CODIGOS_ERRO.linkExpirado]: "Esse link expirou ou já foi usado. Peça um novo e-mail abaixo.",
  // A frase do limite de tentativas (onda 86, P2-10) fala de TEMPO e nunca de
  // conta: ela é idêntica para e-mail que existe e e-mail que não existe,
  // porque o balde do limitador é por IP e nunca por e-mail.
  [CODIGOS_ERRO.muitasTentativas]:
    "Muitas tentativas em pouco tempo. Espere alguns minutos e tente de novo.",
}

const AVISOS: Record<CodigoAviso, string> = {
  [CODIGOS_AVISO.confirmeEmail]:
    "Sua conta ainda não foi confirmada. Confira seu e-mail — inclusive a caixa de spam — ou peça um novo link abaixo.",
  [CODIGOS_AVISO.cadastroRecebido]:
    "Enviamos um link de confirmação para o seu e-mail — confira também o spam. " +
    "Se você já tinha conta com esse endereço, é só entrar com sua senha ou usar “Esqueci minha senha”.",
  [CODIGOS_AVISO.reenvioEnviado]:
    "Se houver uma conta com esse e-mail aguardando confirmação, o novo link já saiu. Confira também o spam.",
  [CODIGOS_AVISO.recuperacaoEnviada]:
    "Se houver conta com esse e-mail, o link para criar uma nova senha já saiu. Confira também o spam.",
}

/**
 * `Object.hasOwn` E NÃO `?? GENERICA` — e a diferença NÃO é estilo.
 *
 * Com `TABELA[codigo] ?? GENERICA` num objeto literal, uma chave herdada de
 * `Object.prototype` NÃO cai na genérica: `__proto__` devolve um objeto, e
 * `constructor`, `toString`, `valueOf` e `hasOwnProperty` devolvem funções.
 * O tipo `string` não protege — o valor vem da URL, ou seja, de fora.
 *
 * O efeito, medido: `/login?erro=__proto__` faz esta função devolver um
 * OBJETO, o JSX tenta renderizar isso, e o React derruba a página inteira.
 * Vira uma forma de matar a tela de entrada do produto com um link forjado —
 * exatamente a família de defeito que este arquivo foi criado para fechar, só
 * que um degrau abaixo do que a auditoria tinha visto.
 *
 * `Object.hasOwn` só enxerga chave PRÓPRIA, então tudo que não está declarado
 * nos dois catálogos acima — inventado, herdado ou vazio — cai na frase
 * genérica. Alternativa equivalente e descartada: declarar as tabelas com
 * `Object.create(null)`, que resolve pela raiz mas esconde o motivo de quem
 * for ler depois; aqui a defesa fica visível no lugar onde ela importa.
 */
function traduzir(tabela: Record<string, string>, codigo: string | undefined | null): string | null {
  if (!codigo) return null
  return Object.hasOwn(tabela, codigo) ? tabela[codigo] : GENERICA
}

/** Traduz o `?erro=` da URL. `null` quando não há nada a mostrar (parâmetro
 *  ausente ou vazio) — a tela não deve renderizar a tarja nesse caso. */
export function mensagemErro(codigo: string | undefined | null): string | null {
  return traduzir(ERROS, codigo)
}

/** Traduz o `?aviso=` da URL. Mesma regra do `mensagemErro`. */
export function mensagemAviso(codigo: string | undefined | null): string | null {
  return traduzir(AVISOS, codigo)
}
