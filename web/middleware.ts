import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
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

  const caminho = request.nextUrl.pathname
  // /convite/[codigo] ficou de fora da lista: a página chama a RPC
  // info_convite, que só tem grant para "authenticated" (migration 008) —
  // um visitante anônimo sempre veria "convite não encontrado". Reavaliar
  // se um dia essa RPC ganhar grant para anon.
  // /parceiros (onda 25) é a página pública de vendas pro parceiro
  // comercial — sem login, é ela que o Pedro abre na marina pra fechar em
  // 10 minutos. Diferente de /parceiro (singular, formulário autoatendido,
  // continua atrás do gate normal).
  // /termos e /privacidade (onda 30) precisam ser lidas por qualquer
  // visitante ANTES de criar conta — sem login, como /parceiros.
  const rotaPublica =
    caminho === "/" ||
    caminho === "/parceiros" ||
    caminho === "/termos" ||
    caminho === "/privacidade" ||
    caminho.startsWith("/login")
  if (!user && !rotaPublica) {
    const destino = new URL("/login", request.url)
    destino.searchParams.set("volta", request.nextUrl.pathname)
    return NextResponse.redirect(destino)
  }
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
