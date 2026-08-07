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
  const rotaPublica = caminho === "/" || caminho.startsWith("/login")
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
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|sw\\.js|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|webmanifest)$).*)"],
}
