import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { ehRotaPublica, temCookieDeSessao } from "@/lib/seguranca/rotas-publicas"

/**
 * ONDA 96 — O MIDDLEWARE PARAVA PARA PERGUNTAR AO SUPABASE EM TODA REQUISIÇÃO.
 *
 * Diagnóstico de 19/08/2026, com o dono relatando "todo app demora para
 * carregar a tela" e, em rajada, telas estourando em 504. Os dois sintomas
 * tinham a MESMA causa e ela estava aqui.
 *
 * O código anterior chamava `supabase.auth.getUser()` na PRIMEIRA linha, antes
 * de olhar o caminho. `getUser()` não lê cookie: ele faz uma ida à rede até o
 * servidor de autenticação para validar o token. Como o middleware roda em
 * TODA navegação — e o `matcher` abaixo cobre praticamente o app inteiro —,
 * cada tela, inclusive a landing, o login, os termos e a privacidade, ficava
 * esperando uma volta de rede antes de o Next sequer começar a renderizar.
 *
 * Duas consequências, e a segunda é a que derrubou o produto:
 *
 * 1. LENTIDÃO EM TUDO. Uma volta de rede a mais no caminho crítico de cada
 *    navegação, somada ao início frio da função. O visitante que nunca fez
 *    login pagava esse preço para ver uma página que não depende de sessão
 *    nenhuma.
 * 2. FRAGILIDADE. Quando essa chamada engasga, não é um pedaço da tela que
 *    falha: é a requisição inteira que morre antes de existir. Foi o que os
 *    logs mostraram — `504` com "function was stopped as it did not return an
 *    initial response within 25s", em `GET /login` e `GET /hoje`.
 *
 * A CORREÇÃO É DE ORDEM, NÃO DE MECANISMO. O middleware passa a decidir na
 * ordem mais barata primeiro:
 *
 *   1º  é rota pública?      → responde na hora, ZERO rede;
 *   2º  tem cookie de sessão? → não tendo, não há o que validar: manda para o
 *                               login sem perguntar a ninguém;
 *   3º  só então valida com o Supabase.
 *
 * O passo 2 é o que mais economiza sem afrouxar nada: cookie ausente é a única
 * hipótese em que a resposta já é certa antes da rede — sem token, não existe
 * sessão possível. E o passo 3 continua sendo uma validação de VERDADE: quem
 * tem cookie ainda é verificado no servidor de autenticação, então um cookie
 * forjado não entra. A segurança é idêntica; o que muda é quantas vezes ela
 * precisa ser paga.
 *
 * O QUE ESTA ORDEM CUSTA, e é aceitável: navegando só por páginas públicas, o
 * token deixa de ser renovado a cada passo (era efeito colateral do
 * `getUser()`). A renovação volta a acontecer na primeira tela protegida, que
 * é justamente quando ela importa.
 */
export async function middleware(request: NextRequest) {
  const caminho = request.nextUrl.pathname

  // 1º — rota pública não precisa saber quem é. Sai antes de qualquer rede.
  // Quem entra sem sessão está decidido em lib/seguranca/rotas-publicas.ts —
  // lá mora o motivo de cada rota estar (ou não) na lista, junto do teste que
  // prova a regra.
  if (ehRotaPublica(caminho)) return NextResponse.next({ request })

  const paraLogin = () => {
    const destino = new URL("/login", request.url)
    destino.searchParams.set("volta", caminho)
    return NextResponse.redirect(destino)
  }

  // 2º — sem cookie de sessão não há token para validar. A resposta já é
  // certa, e perguntar ao Supabase para ouvir "não tem ninguém" é pagar uma
  // volta de rede para saber o que o cookie ausente já disse.
  if (!temCookieDeSessao(request.cookies.getAll())) return paraLogin()

  // 3º — tem cookie: aí sim vale a validação no servidor de autenticação.
  // `getUser()` e não a leitura do cookie: cookie é dado do cliente, e
  // acreditar nele sem validar seria trocar desempenho por um buraco.
  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (todos) => {
          todos.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          todos.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return paraLogin()
  return response
}

export const config = {
  // Rotas /api/* ficam FORA da guarda de sessão deste middleware: cada route
  // handler faz a própria autenticação (ex.: Bearer ALERTAS_SEGREDO em
  // /api/alertas/disparar). Nunca crie uma rota /api que dependa de sessão
  // sem checar o usuário dentro do próprio handler.
  // `json` na lista: as mascaras/grades do mapa (public/mapa/*.json) sao dado
  // estatico publico; sem a exclusao, o middleware redirecionava o fetch do
  // Web Worker pra /login (Safari/PWA nem sempre manda cookie de worker) e a
  // rota "encolhia" pra mascara fina — visto no iPhone em producao, 12/08.
  // `opengraph-image`/`twitter-image`: rotas geradas (ImageResponse, onda 25)
  // sem extensao literal na URL — sem a exclusao aqui, o crawler do
  // WhatsApp/Twitter (que nunca manda cookie de sessao) era redirecionado
  // pra /login e o card de compartilhamento saia sem imagem nenhuma.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|sw\\.js|robots.txt|sitemap.xml|opengraph-image|twitter-image|.*\\.(?:svg|png|jpg|webmanifest|json)$).*)"],
}
