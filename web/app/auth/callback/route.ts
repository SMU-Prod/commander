import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse, type NextRequest } from "next/server"
import { destinoSeguro } from "@/lib/seguranca/destino"

/**
 * O DESTINO DE TODO LINK QUE SAI POR E-MAIL (onda 83).
 *
 * O GoTrue confirma o e-mail (ou valida o pedido de nova senha) e devolve a
 * pessoa com `?code=` na URL — um código PKCE que só vira sessão se alguém
 * chamar `exchangeCodeForSession`. Até a onda 83 ninguém chamava, porque esta
 * rota não existia: o código morria na landing e a pessoa ficava confirmada,
 * deslogada e sem explicação nenhuma. Três das quatro contas reais do produto
 * pararam exatamente aqui (`email_confirmed_at` preenchido,
 * `last_sign_in_at` nulo — auditoria de 19/08/2026).
 *
 * ESTA ROTA PRECISA RODAR DESLOGADA, e é por isso que `/auth/` entrou na
 * lista de rotas públicas do `middleware.ts`. Sem isso o middleware
 * interceptaria o callback, veria `user` nulo — a sessão é justamente o que
 * esta rota ia criar — e redirecionaria para `/login`, matando o código.
 *
 * NÃO É UM HANDLER DE API: mora em `app/auth/`, e não em `app/api/`, porque
 * `/api/*` está fora do matcher do middleware por outro motivo (cada rota de
 * API faz a própria autenticação). Aqui o que importa é a sessão em COOKIE,
 * que é o que o `createServerClient` grava abaixo.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get("code")
  // `proximo` passa pelo mesmo validador de open redirect do `?volta=` do
  // login: ele vem da URL de um e-mail, ou seja, de fora.
  const proximo = destinoSeguro(searchParams.get("proximo"), "/onboarding")

  const paraLogin = (msg: string) =>
    NextResponse.redirect(`${origin}/login?erro=${encodeURIComponent(msg)}&reenviar=1`)

  if (!code) return paraLogin("Link inválido. Peça um novo e-mail de confirmação abaixo.")

  const store = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (todos) => todos.forEach(({ name, value, options }) => store.set(name, value, options)),
      },
    },
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    // Três causas reais, e a terceira é a mais comum de todas: link expirado,
    // link já usado, ou link aberto num APARELHO DIFERENTE do que fez o
    // cadastro — o *code verifier* do PKCE mora num cookie do navegador que
    // iniciou o fluxo, então cadastrar no notebook e clicar no celular falha
    // por desenho. A mensagem manda para o reenvio, que resolve os três.
    return paraLogin("Esse link expirou ou já foi usado. Peça um novo e-mail abaixo.")
  }
  return NextResponse.redirect(`${origin}${proximo}`)
}
