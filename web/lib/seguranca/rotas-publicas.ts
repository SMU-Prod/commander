// Única fonte da verdade sobre quem o app serve SEM sessão. O gate do
// `middleware.ts` fecha por padrão — tudo que não estiver aqui exige login —,
// então esta lista é curta e cada entrada carrega o motivo de existir.
//
// Por que a regra mora em lib/ e não dentro do próprio `middleware.ts`: o
// `vitest.config.mts` só coleta `lib/**` e `components/**`, de modo que um
// `middleware.test.ts` na raiz de `web/` jamais rodaria em `npm test`. E o
// middleware importa `@supabase/ssr` — testá-lo lá viraria um exercício de
// mock do cliente Supabase em vez de prova da regra de rota. Extraída, a
// regra é função pura e o teste prova exatamente o que interessa.

// Rotas públicas por IGUALDADE. Cada uma é UMA página, sem filhos — e é
// justamente por serem páginas soltas que a comparação é `===`.
//
// Não está na lista, de propósito: /convite/[codigo]. A página chama a RPC
// info_convite, que só tem grant para "authenticated" (migration 008) — um
// visitante anônimo sempre veria "convite não encontrado". Reavaliar se um
// dia essa RPC ganhar grant para anon.
const ROTAS_PUBLICAS_EXATAS = new Set([
  // "/" é a vitrine: a landing que vende o app para quem ainda não tem conta.
  "/",
  // /parceiros (onda 25) é a página pública de vendas pro parceiro comercial
  // — sem login, é ela que o Pedro abre na marina pra fechar em 10 minutos.
  // Diferente de /parceiro (singular, formulário autoatendido, que continua
  // atrás do gate normal): a diferença entre público e privado aqui é UMA
  // letra, e é o `===` que garante que ela pese.
  "/parceiros",
  // /termos e /privacidade (onda 30) precisam ser lidas por qualquer
  // visitante ANTES de criar conta — sem login, como /parceiros.
  "/termos",
  "/privacidade",
  // /login era `caminho.startsWith("/login")` até o achado P2-13 da auditoria
  // de 19/08. Nada estava quebrado — mas o prefixo abria de graça qualquer
  // rota que por acaso começasse com essas seis letras: /loginfalso hoje, ou
  // um /login-admin que alguém criasse amanhã acreditando estar atrás do
  // gate. A tela de entrada é uma página só, então a regra dela é igualdade.
  "/login",
])

// A ÁRVORE pública. Aqui o prefixo é a decisão certa, não um descuido: /auth/
// não é uma rota, é o ramo inteiro por onde entram os links que saem por
// e-mail — confirmação de conta e recuperação de senha (onda 83). Esse ramo
// PRECISA rodar deslogado: a sessão é justamente o que /auth/callback vai
// criar, trocando o código PKCE por cookie. Trocar isto por igualdade faria o
// middleware ver o `user` nulo, redirecionar pro /login e matar o código — o
// cadastro inteiro voltaria a falhar, que é o defeito P0 que a onda 83
// consertou.
const ARVORE_AUTH = "/auth/"

/** Diz se `caminho` pode ser servido a um visitante sem sessão. */
export function ehRotaPublica(caminho: string): boolean {
  // Alternativa descartada: uma varredura genérica de prefixos (ou um regex
  // único) cobrindo os dois casos de uma vez. Ficaria mais curto e voltaria a
  // esconder a diferença que causou o P2-13 — foi exatamente colapsar "uma
  // rota" e "uma árvore" no mesmo mecanismo que fez /login virar prefixo. Os
  // dois casos são de naturezas diferentes e continuam escritos separados, de
  // forma que acrescentar uma página nova à lista NÃO abre a subárvore dela.
  return ROTAS_PUBLICAS_EXATAS.has(caminho) || caminho.startsWith(ARVORE_AUTH)
}
