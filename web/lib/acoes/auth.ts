"use server"
import { redirect } from "next/navigation"
import { destinoSeguro } from "@/lib/seguranca/destino"
import { supabaseServer } from "@/lib/supabase/server"

/**
 * IDENTIDADE — entrar, cadastrar, confirmar, recuperar.
 *
 * ONDA 83 — O CADASTRO ESTAVA QUEBRADO E NINGUÉM TINHA COMO SABER.
 *
 * A auditoria de 19/08/2026 (docs/auditoria/2026-08-19-auth-e-email.md) mediu
 * o estrago: das quatro contas reais criadas até aqui, TRÊS têm
 * `email_confirmed_at` preenchido e `last_sign_in_at` NULO. Ou seja: as
 * pessoas receberam o e-mail, clicaram no link, confirmaram a conta — e nunca
 * entraram no app uma única vez. Não é entrega de e-mail: é o CLIQUE que não
 * chegava a lugar nenhum.
 *
 * Duas causas somadas, e as duas moravam aqui:
 *
 * 1. `signUp` não dizia PARA ONDE o link deveria voltar. Sem
 *    `emailRedirectTo`, o GoTrue usa o "Site URL" do painel do Supabase — um
 *    campo global, único, que estava apontando para `http://localhost:3000`.
 *    O dono do barco clicava no link e o celular dele tentava abrir um
 *    endereço da máquina dele mesmo.
 * 2. Mesmo com o destino certo, não havia NADA no destino. O GoTrue devolve
 *    `?code=` (PKCE), e esse código só vira sessão se alguém chamar
 *    `exchangeCodeForSession`. Sem a rota `/auth/callback` o código morre na
 *    landing e a pessoa fica confirmada, deslogada, e sem explicação.
 *
 * E não havia saída nenhuma: sem reenvio de confirmação, sem recuperação de
 * senha, e com a MESMA frase ("E-mail ou senha incorretos") para senha errada
 * e para conta não confirmada — a pessoa trocava uma senha que estava certa.
 *
 * A REGRA QUE GOVERNA AS RESPOSTAS DESTE ARQUIVO: nenhuma delas pode revelar
 * se um e-mail tem conta aqui. Reenvio e recuperação respondem a MESMA frase
 * exista ou não a conta — senão o formulário vira um detector de clientes, e
 * a lista de quem tem barco de 50 pés no Rio tem valor para quem não deveria
 * tê-la.
 */

/** Origem absoluta para os links de e-mail. O GoTrue precisa de URL completa;
 *  o fallback só vale em desenvolvimento (em produção `NEXT_PUBLIC_APP_URL`
 *  existe — conferido na Vercel). */
function origemDoApp(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
}

export async function entrar(formData: FormData) {
  const volta = formData.get("volta")
  const email = String(formData.get("email") ?? "")
  const supabase = await supabaseServer()
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: String(formData.get("senha") ?? ""),
  })
  if (error) {
    // O GoTrue distingue os dois casos e até a onda 83 a gente jogava a
    // distinção fora, colapsando tudo em "senha incorreta". Quem estava só
    // sem confirmar ficava trocando uma senha que estava certa.
    //
    // Contar que a conta existe mas não foi confirmada NÃO é enumeração
    // relevante aqui: para chegar nesta mensagem a pessoa já acertou o par
    // e-mail+senha, ou seja, já é dona da conta.
    if (error.code === "email_not_confirmed") {
      redirect(
        `/login?aviso=${encodeURIComponent(
          "Sua conta ainda não foi confirmada. Confira seu e-mail — inclusive a caixa de spam — ou peça um novo link abaixo.",
        )}&reenviar=1&email=${encodeURIComponent(email)}`,
      )
    }
    redirect(`/login?erro=${encodeURIComponent("E-mail ou senha incorretos")}&volta=${encodeURIComponent(String(volta ?? ""))}`)
  }
  redirect(destinoSeguro(volta, "/hoje"))
}

export async function cadastrar(formData: FormData) {
  const volta = formData.get("volta")
  const supabase = await supabaseServer()
  // O link do e-mail volta para o CALLBACK, não para a raiz: é lá que o
  // código PKCE vira sessão. `proximo` viaja na URL porque o callback roda
  // deslogado e não tem outro jeito de lembrar para onde a pessoa ia.
  const proximo = destinoSeguro(volta, "/onboarding")
  const { data, error } = await supabase.auth.signUp({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("senha") ?? ""),
    options: {
      data: { nome: String(formData.get("nome") ?? "") },
      emailRedirectTo: `${origemDoApp()}/auth/callback?proximo=${encodeURIComponent(proximo)}`,
    },
  })
  if (error) {
    redirect(`/login?modo=cadastro&erro=${encodeURIComponent("Não foi possível criar a conta. Confira os dados e tente novamente.")}&volta=${encodeURIComponent(String(volta ?? ""))}`)
  }
  // Confirm email ligado: signUp cria o usuário mas NÃO abre sessão — sem
  // este aviso a pessoa seria devolvida ao login sem explicação nenhuma.
  //
  // O texto serve a DOIS casos de propósito. Com anti-enumeração ligada, o
  // Supabase responde exatamente igual quando o e-mail JÁ TEM conta
  // confirmada — `data.user` preenchido, `identities: []`, nenhuma sessão —
  // e nesse caso não envia e-mail nenhum. Dizer "já existe conta com esse
  // e-mail" resolveria o beco, mas transformaria o cadastro num verificador
  // de quem é cliente nosso. A saída é a frase abaixo: ela não revela qual
  // dos dois casos é, e ainda assim entrega as duas portas de saída.
  if (!data.session) {
    redirect(
      `/login?aviso=${encodeURIComponent(
        "Enviamos um link de confirmação para o seu e-mail — confira também o spam. " +
          "Se você já tinha conta com esse endereço, é só entrar com sua senha ou usar “Esqueci minha senha”.",
      )}`,
    )
  }
  redirect(destinoSeguro(volta, "/onboarding"))
}

/**
 * Reenviar a confirmação — a saída que não existia.
 *
 * O caminho mais comum que leva aqui não é "o e-mail não chegou": é o link
 * aberto num aparelho diferente do que fez o cadastro. O *code verifier* do
 * PKCE mora num cookie do navegador que iniciou o fluxo, então cadastrar no
 * notebook e clicar no link pelo celular falha por desenho. `/auth/callback`
 * manda essa pessoa para cá.
 */
export async function reenviarConfirmacao(formData: FormData) {
  const email = String(formData.get("email") ?? "")
  const supabase = await supabaseServer()
  // Sem checar o resultado de propósito: erro e sucesso levam à MESMA
  // resposta (ver a regra no cabeçalho do arquivo).
  await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${origemDoApp()}/auth/callback?proximo=/onboarding` },
  })
  redirect(
    `/login?aviso=${encodeURIComponent(
      "Se houver uma conta com esse e-mail aguardando confirmação, o novo link já saiu. Confira também o spam.",
    )}`,
  )
}

/** Pedir link de nova senha. Mesma regra de resposta uniforme do reenvio. */
export async function pedirNovaSenha(formData: FormData) {
  const supabase = await supabaseServer()
  await supabase.auth.resetPasswordForEmail(String(formData.get("email") ?? ""), {
    redirectTo: `${origemDoApp()}/auth/callback?proximo=/nova-senha`,
  })
  redirect(
    `/login?aviso=${encodeURIComponent(
      "Se houver conta com esse e-mail, o link para criar uma nova senha já saiu. Confira também o spam.",
    )}`,
  )
}

/**
 * Trocar a senha. Só funciona com a sessão de recuperação que
 * `/auth/callback` acabou de criar — por isso `/nova-senha` fica atrás do
 * gate normal do middleware: sem o link, não há nada a fazer lá.
 */
export async function definirNovaSenha(formData: FormData) {
  const senha = String(formData.get("senha") ?? "")
  // Mesmo mínimo que o cadastro promete na tela ("Mínimo de 8 caracteres").
  // Até a onda 83 esse mínimo só existia no atributo do input, ou seja, só
  // no cliente — aqui ele passa a valer no servidor também.
  if (senha.length < 8) {
    redirect(`/nova-senha?erro=${encodeURIComponent("A senha precisa de pelo menos 8 caracteres.")}`)
  }
  const supabase = await supabaseServer()
  const { error } = await supabase.auth.updateUser({ password: senha })
  if (error) {
    redirect(`/nova-senha?erro=${encodeURIComponent("Não deu para trocar a senha. Peça um link novo na tela de entrada.")}`)
  }
  redirect(`/hoje?ok=${encodeURIComponent("Senha alterada")}`)
}

export async function sair() {
  const supabase = await supabaseServer()
  await supabase.auth.signOut()
  redirect("/login")
}
