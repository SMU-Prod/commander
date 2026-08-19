# Auditoria de identidade — cadastro, confirmação de e-mail e sessão

**Data:** 19/08/2026
**Pergunta:** procede a reclamação de que as pessoas não conseguem registrar conta por causa do e-mail de confirmação?
**Método:** leitura de código (`web/`), MCP Supabase somente leitura (`auth.users`, `auth.flow_state`, `pg_trigger`, logs do serviço de Auth das últimas 24 h), grep. Nenhum arquivo de aplicação alterado, nenhuma migration rodada, nenhuma configuração remota tocada. O único arquivo escrito é este.
**Alvo:** `C:\Users\erick\GEST-NAV` (app em `web/`), Supabase `khgjtxvmduizyooqaoox`, produção em https://commander-tau.vercel.app

---

## Veredito

A reclamação procede, mas o nome dela está errado — e é por isso que ela nunca foi resolvida. **O e-mail de confirmação está sendo entregue, e rápido.** Os quatro cadastros reais do banco confirmaram a conta entre 22 segundos e 3 minutos depois do envio; ninguém que recebeu ficou esperando. O que quebra vem *depois* do clique: o link de confirmação manda a pessoa para **`http://localhost:3000`**, um endereço que não existe na máquina dela. Ela clica, o navegador dá erro de conexão, e ela conclui — corretamente, do ponto de vista dela — que o cadastro não funcionou. A prova está no banco: **3 dos 4 usuários reais têm `email_confirmed_at` preenchido e `last_sign_in_at` nulo.** Clicaram, foram confirmados pelo servidor, e nunca entraram no aplicativo uma única vez. Confiança **alta** na cadeia causal (o dado de `last_sign_in_at` é direto e não admite outra leitura); confiança **alta, mas por inferência e não por leitura direta**, em que o Site URL do painel esteja literalmente em `http://localhost:3000` — o MCP do Supabase não expõe a configuração do Auth, então cheguei nisso pelos logs (detalhe em P0-1). Some-se a isso que, mesmo com o Site URL corrigido, **não existe rota que troque o código PKCE por sessão** — então o link continuaria não logando ninguém. São dois defeitos empilhados, e os dois precisam cair juntos.

---

## Achados

| # | Sev. | O que é | Onde | O que a pessoa vive |
|---|---|---|---|---|
| P0-1 | **P0** | O link de confirmação redireciona para `http://localhost:3000` (Site URL do Auth) | painel Supabase + `web/lib/acoes/auth.ts:22-26` | Clica no link do e-mail e vê "Não é possível acessar esse site". A conta foi confirmada no servidor, mas ela não tem como saber. Desiste. |
| P0-2 | **P0** | Não existe `/auth/callback` nem `exchangeCodeForSession` em lugar nenhum | ausente em `web/app/` (só 4 `route.ts`, todos em `app/api/`) | Mesmo com o Site URL certo, cairia na landing deslogada, com `?code=` ignorado e nenhuma mensagem. O código PKCE morre sem ser trocado. |
| P0-3 | **P0** | `signUp` não passa `options.emailRedirectTo` | `web/lib/acoes/auth.ts:22-26` | O app abdica de dizer para onde o link volta e fica refém de um campo de painel. Qualquer preview da Vercel e o app nativo quebram do mesmo jeito. |
| P1-4 | P1 | `entrar` devolve a mesma frase para senha errada e para conta não confirmada | `web/lib/acoes/auth.ts:13-15` | Conta existe, senha certa, e a tela diz "E-mail ou senha incorretos". Ela troca a senha na cabeça, tenta de novo, erra de novo. Não tem saída sozinha. |
| P1-5 | P1 | Não existe reenvio de confirmação (`auth.resend` ausente no repositório) | `web/lib/acoes/auth.ts` (só `entrar`, `cadastrar`, `sair`) | Se o e-mail caiu no spam, foi apagado ou o link expirou, acabou. Só o dono, na mão, pelo painel. |
| P1-6 | P1 | Não existe "esqueci minha senha" (`resetPasswordForEmail` ausente) | `web/lib/acoes/auth.ts`; `web/app/(auth)/login/page.tsx:12-15` documenta a omissão | `recovery_sent_at` é nulo nos 6 usuários — ninguém nunca conseguiu nem pedir. Quem esquecer a senha perde a conta. |
| P1-7 | P1 | Conta já existente cai no aviso "Enviamos um link de confirmação" | `web/lib/acoes/auth.ts:32-34` | O Supabase, com anti-enumeração ligada, devolve sucesso sem sessão e **não manda e-mail nenhum**. A pessoa espera um e-mail que nunca vai existir. |
| P1-8 | P1 | E-mail digitado errado não tem conserto | fluxo inteiro | A conta nasce presa a um endereço inalcançável e ocupa o e-mail. Sem reenvio e sem recuperação, não há como corrigir de dentro do produto. |
| P1-9 | P1 | Envio dos e-mails de auth depende do SMTP embutido do Supabase — **não verificado** se há SMTP customizado | configuração de painel (não legível pelo MCP) | Hoje entrega bem no volume atual, mas o serviço embutido é explicitamente "para testes", tem teto duro por hora e remetente compartilhado que cai em spam. No primeiro pico de cadastro, some. |
| P2-10 | P2 | `entrar` e `cadastrar` não têm rate limit | `web/lib/seguranca/limitador.ts` existe, mas só é usado em `app/api/corredores/route.ts:38`, `app/api/alertas/disparar/route.ts:32` e `lib/acoes/sondagem.ts:70` | Força bruta de senha sem freio do lado do app. Sobra só o limite do próprio Supabase. |
| P2-11 | P2 | `?erro=` e `?aviso=` renderizam texto arbitrário da URL | `web/app/(auth)/login/page.tsx:76-81` | Não é XSS (o React escapa), mas dá para mandar `.../login?erro=Sua conta foi bloqueada, ligue 0800...` no domínio real do produto. Vetor de phishing com a marca de vocês. |
| P2-12 | P2 | Força de senha só no cliente (`minLength={8}`) | `web/components/campo-senha.tsx:30`; `cadastrar` não valida nada | Um POST forjado cria conta com senha de 6 caracteres (o piso do Supabase). O `required`/`minLength` é conselho de tela, não regra. |
| P2-13 | P2 | `caminho.startsWith("/login")` abre qualquer rota com esse prefixo | `web/middleware.ts:38` | Nada quebrado hoje, mas uma rota futura tipo `/login-admin` nasceria pública sem ninguém perceber. |
| P2-14 | P2 | `.env.example` aponta `NEXT_PUBLIC_APP_URL` para `commander.soumardivers.com`, produção roda em `commander-tau.vercel.app` | `web/.env.example:18` | Provável origem da confusão que deixou o Site URL para trás. Dois domínios na cabeça, nenhum configurado no Auth. |

**Contagem:** 3 P0, 6 P1, 5 P2.

### O que está certo (e vale preservar)

- `web/lib/seguranca/destino.ts` — a validação de `?volta=` contra open redirect está **correta**. Canonicaliza com o parser WHATWG, barra host externo, barra `//host` e dot-segments. Tentei os caminhos óbvios e não passa. Não mexa.
- `entrar` já usa mensagem genérica ("E-mail ou senha incorretos"), que é o comportamento certo contra enumeração de usuário. O problema do P1-4 não é a mensagem ser genérica demais — é ela ser genérica no caso em que a pessoa acertou tudo.
- O middleware fecha por padrão: a lista de rotas públicas é curta, explícita e comentada. Só precisa ganhar `/auth` quando o callback existir (ver P0-2).

---

## As provas

Três medições, todas do banco e dos logs vivos.

**1. Os e-mails chegam, e chegam rápido.** Intervalo entre `confirmation_sent_at` e `email_confirmed_at` nos quatro cadastros reais: 22 s, 38 s, ~1 min 45 s, ~2 min 55 s. Não há aqui nenhum sintoma de fila, de teto por hora ou de spam. Dos 5 cadastros reais que chegaram a gerar um pedido de confirmação, 4 confirmaram — o quinto (`user_id` `cea028c3…`, de 16/08 01:27) nunca redimiu o código e a linha em `auth.users` já não existe. Um caso, insuficiente para culpar a entrega.

**2. Quem confirmou nunca entrou.** Em `auth.users`, `email_confirmed_at` preenchido e `last_sign_in_at` **nulo** para `prplshrmp@`, `piresfpedroh@` e `tostesspedro@`. O único usuário real com `last_sign_in_at` é a sua própria conta. Três pessoas atravessaram a confirmação inteira e nunca viram o aplicativo por dentro.

**3. O redirect vai para localhost.** `auth.flow_state` tem 5 linhas, todas `code_challenge_method = s256` e `authentication_method = 'email/signup'` — ou seja, todo cadastro abre um fluxo PKCE, exatamente como o `@supabase/ssr` faz por padrão. Nos logs do Auth das últimas 24 h, o campo `referer` vale `http://localhost:3000` em **todas** as 1.688 requisições registradas, incluindo as 1.545 chamadas `GET /user` que saem do middleware **no servidor** — e uma chamada servidor-a-servidor não tem header `Referer` nenhum para vazar. Um campo que é idêntico em requisição de servidor, de navegador e de e2e não é um header do cliente: é o fallback que o GoTrue registra quando não recebe `redirect_to`, e esse fallback **é o Site URL do projeto**. O único `GET /verify` do período (o clique de `prplshrmp@`, 303, às 03:54:05) carrega o mesmo valor. É daí que sai a inferência do P0-1.

O que faltou para fechar em 100%: o MCP do Supabase não expõe a configuração do serviço de Auth (Site URL, Redirect URLs, SMTP, tetos de e-mail). **Não verificado por leitura direta** — confirme em 30 segundos no passo D-1 abaixo.

---

## Correções

### P0-1 + P0-3 — o link precisa apontar para o produto, e quem manda nisso é o código

Deixar o destino do link a cargo de um campo de painel foi o que criou o problema. `emailRedirectTo` resolve na origem: o app passa a dizer explicitamente para onde o link volta, e preview/nativo param de depender de um valor global único.

Em `web/lib/acoes/auth.ts`, dentro de `cadastrar`:

```ts
// O link do e-mail volta para o CALLBACK, não para a raiz: é lá que o código
// PKCE vira sessão. Sem isto o GoTrue cai no Site URL do painel — foi o que
// mandou 3 pessoas para http://localhost:3000 (auditoria 19/08).
const origem = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
const proximo = destinoSeguro(volta, "/onboarding")

const { data, error } = await supabase.auth.signUp({
  email: String(formData.get("email") ?? ""),
  password: String(formData.get("senha") ?? ""),
  options: {
    data: { nome: String(formData.get("nome") ?? "") },
    emailRedirectTo: `${origem}/auth/callback?proximo=${encodeURIComponent(proximo)}`,
  },
})
```

**Isto só funciona depois do passo D-2** (cadastrar a URL na allowlist de Redirect URLs). O GoTrue descarta `emailRedirectTo` que não bata com a allowlist e volta silenciosamente para o Site URL — mesmo defeito, sem aviso.

### P0-2 — a rota que troca o código por sessão

Arquivo novo: **`web/app/auth/callback/route.ts`**

```ts
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse, type NextRequest } from "next/server"
import { destinoSeguro } from "@/lib/seguranca/destino"

/** O GoTrue confirma o e-mail e devolve `?code=` — um código PKCE que só vira
 *  sessão se alguém chamar `exchangeCodeForSession`. Sem esta rota o código
 *  morre na landing e a pessoa fica confirmada, deslogada e sem explicação. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get("code")
  const proximo = destinoSeguro(searchParams.get("proximo"), "/onboarding")

  const paraLogin = (msg: string) =>
    NextResponse.redirect(`${origin}/login?erro=${encodeURIComponent(msg)}`)

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
    // Expirado, já usado, ou aberto em outro aparelho (o verifier PKCE mora
    // num cookie do navegador que iniciou o cadastro).
    return paraLogin("Esse link expirou ou já foi usado. Peça um novo e-mail de confirmação abaixo.")
  }
  return NextResponse.redirect(`${origin}${proximo}`)
}
```

**Armadilha que vai morder se passar batido:** o matcher do middleware exclui `/api`, mas **não** `/auth`. Sem a linha abaixo, o middleware intercepta o callback, vê `user` nulo (a sessão ainda não foi criada — é justamente o que a rota vai fazer) e redireciona para `/login`, matando o código. Em `web/middleware.ts:33-38`:

```ts
  const rotaPublica =
    caminho === "/" ||
    caminho === "/parceiros" ||
    caminho === "/termos" ||
    caminho === "/privacidade" ||
    // O callback PRECISA rodar deslogado: é ele que cria a sessão.
    caminho.startsWith("/auth/") ||
    caminho === "/login"          // era startsWith — ver P2-13
```

Note também que o `exchangeCodeForSession` falha quando o link é aberto num aparelho diferente daquele que fez o cadastro (celular vs. notebook), porque o *code verifier* fica num cookie. É um caminho real e comum. A mensagem de erro acima já cobre isso mandando a pessoa para o reenvio — que é o P1-5.

### P1-4 — separar "senha errada" de "conta não confirmada"

O Supabase já devolve o motivo; o código está jogando fora. Em `web/lib/acoes/auth.ts`, dentro de `entrar`:

```ts
  if (error) {
    // O GoTrue distingue os dois casos; até aqui a gente colapsava tudo em
    // "senha incorreta" e a pessoa ficava trocando uma senha que estava certa.
    if (error.code === "email_not_confirmed") {
      redirect(
        `/login?aviso=${encodeURIComponent(
          "Sua conta ainda não foi confirmada. Confira seu e-mail — inclusive a caixa de spam — ou peça um novo link abaixo.",
        )}&reenviar=1&email=${encodeURIComponent(String(formData.get("email") ?? ""))}`,
      )
    }
    redirect(`/login?erro=${encodeURIComponent("E-mail ou senha incorretos")}&volta=${encodeURIComponent(String(volta ?? ""))}`)
  }
```

### P1-5 — reenviar a confirmação

Nova action em `web/lib/acoes/auth.ts`:

```ts
export async function reenviarConfirmacao(formData: FormData) {
  const email = String(formData.get("email") ?? "")
  const origem = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  const supabase = await supabaseServer()
  await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${origem}/auth/callback?proximo=/onboarding` },
  })
  // Resposta IGUAL exista ou não a conta — senão o formulário vira um
  // detector de "esse e-mail tem cadastro aqui".
  redirect(
    `/login?aviso=${encodeURIComponent(
      "Se houver uma conta com esse e-mail aguardando confirmação, o novo link já saiu. Confira também o spam.",
    )}`,
  )
}
```

Na tela (`web/app/(auth)/login/page.tsx`), um formulário curto que aparece quando `reenviar=1` — e um link discreto "Não recebeu o e-mail?" sempre visível abaixo do botão de cadastro. O comentário no topo do arquivo (linhas 12-15) diz que esses links ficaram de fora porque não havia backend; com a action acima, há.

### P1-6 — esqueci minha senha

Duas peças. A action, em `web/lib/acoes/auth.ts`:

```ts
export async function pedirNovaSenha(formData: FormData) {
  const origem = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  const supabase = await supabaseServer()
  await supabase.auth.resetPasswordForEmail(String(formData.get("email") ?? ""), {
    redirectTo: `${origem}/auth/callback?proximo=/nova-senha`,
  })
  redirect(`/login?aviso=${encodeURIComponent("Se houver conta com esse e-mail, o link de nova senha já saiu.")}`)
}

export async function definirNovaSenha(formData: FormData) {
  const senha = String(formData.get("senha") ?? "")
  if (senha.length < 8) redirect(`/nova-senha?erro=${encodeURIComponent("A senha precisa de pelo menos 8 caracteres.")}`)
  const supabase = await supabaseServer()
  const { error } = await supabase.auth.updateUser({ password: senha })
  if (error) redirect(`/nova-senha?erro=${encodeURIComponent("Não deu para trocar a senha. Peça um link novo.")}`)
  redirect(`/hoje?ok=${encodeURIComponent("Senha alterada")}`)
}
```

E a tela `web/app/(auth)/nova-senha/page.tsx`, que só pede a senha nova — o callback já criou a sessão de recuperação antes de mandar para cá. Ela fica dentro do gate normal do middleware, o que está certo: sem a sessão vinda do link, não há nada a fazer ali.

### P1-7 + P1-8 — conta que já existe e e-mail digitado errado

O Supabase, com anti-enumeração ligada, devolve `data.user` preenchido, `identities: []` e nenhuma sessão quando o e-mail já tem conta confirmada — e **não envia e-mail**. O código de hoje lê isso como "cadastro novo, avise para conferir a caixa de entrada", e a pessoa espera para sempre.

Há duas saídas, e eu recomendo a segunda:

**(a) Dizer na cara:** `if (data.user && data.user.identities?.length === 0)` → "Já existe conta com esse e-mail". Resolve o beco, mas transforma o cadastro num verificador de quem é cliente de vocês.

**(b) Manter a resposta uniforme e mudar o texto do aviso**, para que ele sirva aos dois casos sem revelar qual é:

```ts
  if (!data.session) {
    redirect(
      `/login?aviso=${encodeURIComponent(
        "Enviamos um link de confirmação para o seu e-mail — confira também o spam. " +
          "Se você já tinha conta com esse endereço, é só entrar com sua senha ou usar “Esqueci minha senha”.",
      )}`,
    )
  }
```

A (b) não vaza nada, e ainda assim entrega à pessoa as duas portas de saída. Ela depende de P1-5 e P1-6 existirem — sem elas, é só um texto mais bonito no mesmo beco.

Para o e-mail digitado errado, a saída é a mesma frase: ela não recebe nada, relê o aviso, e refaz o cadastro com o endereço certo. A conta órfã com o e-mail errado fica no banco não confirmada e é inofensiva.

### P1-9 — SMTP

Ver D-3. É configuração de painel, não de código.

---

## O que depende do dono

Nada abaixo está no repositório — nenhum desses valores pode ser corrigido por commit, e é por isso que o defeito sobreviveu a todas as ondas até agora. **Faça D-1 e D-2 antes de subir qualquer código**, senão a correção do P0-2 sobe e continua sem funcionar.

**D-1 — Corrigir o Site URL (é o P0-1).**
Painel Supabase → projeto `gestnav` → **Authentication** → **URL Configuration** → campo **Site URL**.
Se estiver `http://localhost:3000`, troque por `https://commander-tau.vercel.app` (ou o domínio definitivo, se for migrar para `commander.soumardivers.com` — decida agora, porque o `.env.example:18` já promete o segundo). Salve. Confirme aqui se a inferência do P0-1 estava certa — é o único item desta auditoria que eu não consegui ler diretamente.

**D-2 — Liberar as Redirect URLs.**
Mesma tela, bloco **Redirect URLs** → **Add URL**. Adicione, uma por linha:
- `https://commander-tau.vercel.app/auth/callback`
- `https://commander-tau.vercel.app/**` (cobre preview de path)
- `https://*-erick-russos-projects.vercel.app/**` — ajuste ao slug real do seu escopo na Vercel, para os deploys de preview
- `http://localhost:3000/**` — só para desenvolvimento

Sem isto, o `emailRedirectTo` do P0-3 é **descartado em silêncio** e tudo volta ao Site URL.

**D-3 — SMTP customizado (o P1-9).**
Painel Supabase → **Authentication** → **Emails** → aba **SMTP Settings** → ligar **Enable Custom SMTP**.
Hoje a entrega funciona porque o volume é de um cadastro a cada dois dias. O serviço embutido do Supabase é declaradamente para desenvolvimento: remetente compartilhado (péssima reputação, cai em spam) e teto rígido de poucos e-mails por hora — **não medi qual teto está valendo neste projeto**, é o campo *Rate limit for sending emails* em **Authentication → Rate Limits**. No dia em que dois barcos da mesma marina se cadastrarem na mesma hora, o segundo não recebe nada.
Como já existe conta na Resend (o app usa para alertas), o caminho curto é usar ela: Host `smtp.resend.com`, porta `465`, usuário `resend`, senha = a API key. **Exige domínio verificado na Resend** — o remetente tem que ser `@` de um domínio seu, e enquanto isso não existir o custom SMTP não sobe.

**D-4 — `RESEND_API_KEY` na Vercel.**
Não está configurada em produção. Isso **não** afeta a confirmação de conta (esse e-mail sai pelo Supabase, não pela Resend), mas mata os alertas de vencimento e o relatório mensal — `app/api/relatorio/mensal/route.ts:51-53` recusa a rodar sem ela. Vercel → projeto → Settings → Environment Variables → adicionar em Production.
Enquanto estiver nisso: `app/api/alertas/disparar/route.ts:183` e `app/api/relatorio/mensal/route.ts:144` mandam de `Commander <onboarding@resend.dev>`, que é o remetente de sandbox da Resend — **ele só entrega para o e-mail do dono da conta Resend**. Verificar o domínio (D-3) conserta os dois de uma vez.

**D-5 — Depois de tudo no ar, teste você mesmo o caminho inteiro.**
Cadastre um e-mail seu que não tenha conta, **abra o link no celular** (não no mesmo navegador do cadastro) e veja onde para. Esse é exatamente o caso que hoje falha duas vezes — no destino e no verifier PKCE — e é o único teste que prova que acabou.

**D-6 — As três pessoas que ficaram no meio do caminho.**
`prplshrmp@gmail.com`, `piresfpedroh@gmail.com` e `tostesspedro@gmail.com` têm conta confirmada e nunca entraram. Não é caso de suporte técnico: a conta delas **funciona** — basta ir em `/login` e entrar com a senha que cadastraram. Depois do D-5, vale uma mensagem pessoal dizendo isso. São os seus três primeiros interessados reais.
