"use server"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { destinoSeguro } from "@/lib/seguranca/destino"
import { checarLimite, identificarIp } from "@/lib/seguranca/limitador"
import { CODIGOS_AVISO, CODIGOS_ERRO } from "@/lib/seguranca/mensagens-auth"
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
 *
 * A MESMA REGRA passou a mandar também no que SAI daqui: os redirects não
 * carregam mais a frase, carregam um CÓDIGO curto da lista fechada de
 * `lib/seguranca/mensagens-auth.ts` (P2-11); as quatro portas ganharam teto de
 * tentativas por IP (P2-10), e a resposta desse teto obedece à regra pelo
 * motivo explicado logo abaixo; e o mínimo de senha do cadastro deixou de ser
 * promessa de tela para virar checagem de servidor (P2-12).
 */

/** Origem absoluta para os links de e-mail. O GoTrue precisa de URL completa;
 *  o fallback só vale em desenvolvimento (em produção `NEXT_PUBLIC_APP_URL`
 *  existe — conferido na Vercel). */
function origemDoApp(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
}

/**
 * O TETO DE TENTATIVAS (P2-10).
 *
 * O limitador (`lib/seguranca/limitador.ts`) já existia e já rodava em três
 * lugares — `app/api/corredores`, `app/api/alertas/disparar` e
 * `lib/acoes/sondagem.ts:70` — e em nenhuma das portas de identidade. Quem
 * quisesse martelar senha aqui só encontrava pela frente o teto do próprio
 * Supabase.
 *
 * DUAS COISAS PRECISAM FICAR ESCRITAS, senão daqui a seis meses alguém lê
 * estes números e acha que o assunto está resolvido:
 *
 * 1. ISTO É MITIGAÇÃO, NÃO MURALHA. A contagem mora na memória da INSTÂNCIA
 *    da função. Em serverless (Vercel) não existe contador compartilhado entre
 *    instâncias nem entre regiões — o cabeçalho do próprio limitador diz isso
 *    por extenso. O que a gente freia de verdade é a rajada de um cliente que
 *    cai repetidas vezes na mesma instância quente, que é o caso comum e o
 *    barato de fazer. Ataque distribuído, espalhando as tentativas por
 *    instâncias diferentes, passa por cima disto sem sentir. Se o abuso real
 *    um dia justificar, a barreira de verdade é um contador compartilhado
 *    (Redis/Upstash) — adiado de propósito, não esquecido.
 *
 * 2. O TETO NÃO PODE VIRAR NEGAÇÃO DE SERVIÇO CONTRA O DONO DO BARCO. Cada
 *    número abaixo foi escolhido olhando PRIMEIRO para quem erra a senha três
 *    vezes e só depois para quem ataca. Trancar o dono legítimo do lado de
 *    fora é o mesmo estrago que a onda 83 acabou de consertar, só que vestido
 *    de segurança.
 *
 * A CHAVE É O IP E NUNCA O E-MAIL — decisão de projeto, não descuido.
 * (Alternativa descartada.) Contar por e-mail parece mais justo e é muito
 * pior: qualquer estranho tranca a conta de uma pessoa específica só
 * martelando o e-mail dela, sem precisar saber senha nenhuma. No reenvio e na
 * recuperação fica pior ainda, porque lá a resposta é uniforme por
 * anti-enumeração: a dona da conta leria "o link já saiu" e ficaria esperando
 * para sempre um e-mail que o limitador engoliu calado. Seria recriar, letra
 * por letra, o beco sem saída que a onda 83 fechou.
 *
 * E é justamente por a chave ser o IP que a resposta do teto obedece à regra
 * do cabeçalho: ela é IDÊNTICA exista ou não conta com aquele e-mail — fala de
 * tempo ("espere alguns minutos"), nunca de conta.
 *
 * TODA tentativa conta, inclusive a que dá certo, e a contagem roda ANTES da
 * chamada de rede: teto que só conta o que falhou não é teto, e teto conferido
 * depois do `signInWithPassword` não evita a tentativa que ele existe para
 * evitar.
 */

// 10 em 5 min. Cobre com folga os três erros honestos de quem tem a senha na
// ponta da língua e digitou errado, mais o segundo aparelho da mesma pessoa,
// mais a família inteira dividindo o Wi-Fi de casa ou o 4G da marina — tudo
// isso sai pelo MESMO IP. Do outro lado da conta, o teto é de ~120 palpites
// por hora por instância: não arranha uma senha de 8 caracteres, que é o
// mínimo que `cadastrar` passou a exigir de verdade logo abaixo.
const JANELA_ENTRAR_MS = 5 * 60_000
const LIMITE_ENTRAR = 10

// 5 por hora. Cadastro é evento raro — uma vez na vida, por dono de barco. O
// pior caso legítimo que a auditoria mediu é "dois barcos da mesma marina se
// cadastrando na mesma hora" (o mesmo cenário que P1-9 usa para falar do teto
// do SMTP), e 5 dá 2,5x de margem em cima disso. Para o outro lado, é o que
// trava criação de conta em massa — que não é só lixo no banco: cada cadastro
// dispara um e-mail pelo SMTP compartilhado do Supabase, e queimar aquela cota
// por hora deixa o próximo cadastro de verdade sem e-mail nenhum (P1-9).
const JANELA_CADASTRAR_MS = 60 * 60_000
const LIMITE_CADASTRAR = 5

// 3 por 15 min para os dois botões que disparam e-mail. Estes dois são um
// disparador apontado para a caixa de entrada de um endereço que quem aperta
// digitou — e que pode ser de outra pessoa. Três cobre o "não chegou, pedi de
// novo" com sobra, e 15 min é folga larga: a auditoria mediu a entrega real
// dos quatro cadastros entre 22 s e ~3 min, então ninguém esbarra nisso por
// impaciência razoável.
//
// Os BALDES são SEPARADOS (`reenvio:` e `recuperacao:`) mesmo tendo o mesmo
// número: quem estourou o reenvio de confirmação não pode ficar sem a
// recuperação de senha, que é exatamente a outra saída que a onda 83 abriu.
const JANELA_LINK_EMAIL_MS = 15 * 60_000
const LIMITE_LINK_EMAIL = 3

/** O IP do cliente visto de dentro de uma Server Action. `headers()` de
 *  `next/headers` vale aqui — é o mesmo request do POST —, e é o único
 *  caminho: uma action não recebe o `Request` na mão como uma route handler
 *  recebe. Foi por não ter isso à mão que `sondagem.ts` limitou por usuário;
 *  lá o usuário É a unidade certa, aqui ninguém está logado ainda e só sobra
 *  o IP. */
async function ipDoPedido(): Promise<string> {
  return identificarIp(await headers())
}

export async function entrar(formData: FormData) {
  const volta = formData.get("volta")
  const email = String(formData.get("email") ?? "")
  const limite = checarLimite(`entrar:${await ipDoPedido()}`, JANELA_ENTRAR_MS, LIMITE_ENTRAR)
  if (!limite.permitido) {
    redirect(`/login?erro=${CODIGOS_ERRO.muitasTentativas}&volta=${encodeURIComponent(String(volta ?? ""))}`)
  }
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
      // O `email` continua codificado porque ele é DADO — volta preenchido no
      // campo do reenvio. Quem virou código na URL foi a FRASE, não o dado.
      redirect(
        `/login?aviso=${CODIGOS_AVISO.confirmeEmail}&reenviar=1&email=${encodeURIComponent(email)}`,
      )
    }
    redirect(`/login?erro=${CODIGOS_ERRO.credenciais}&volta=${encodeURIComponent(String(volta ?? ""))}`)
  }
  redirect(destinoSeguro(volta, "/hoje"))
}

export async function cadastrar(formData: FormData) {
  const volta = formData.get("volta")
  const senha = String(formData.get("senha") ?? "")
  const limite = checarLimite(`cadastrar:${await ipDoPedido()}`, JANELA_CADASTRAR_MS, LIMITE_CADASTRAR)
  if (!limite.permitido) {
    redirect(
      `/login?modo=cadastro&erro=${CODIGOS_ERRO.muitasTentativas}&volta=${encodeURIComponent(String(volta ?? ""))}`,
    )
  }
  // P2-12 — até aqui o mínimo de 8 caracteres existia SÓ no `minLength` do
  // input (`components/campo-senha.tsx`), e atributo de tela é conselho, não
  // regra: uma requisição forjada direto na action passa por cima do atributo
  // e a conta nasce com o piso do Supabase, que é 6. `definirNovaSenha` já
  // checava no servidor desde a onda 83 — era a porta da FRENTE que aceitava
  // menos do que a própria tela promete ("Mínimo de 8 caracteres").
  if (senha.length < 8) {
    redirect(
      `/login?modo=cadastro&erro=${CODIGOS_ERRO.senhaCurta}&volta=${encodeURIComponent(String(volta ?? ""))}`,
    )
  }
  const supabase = await supabaseServer()
  // O link do e-mail volta para o CALLBACK, não para a raiz: é lá que o
  // código PKCE vira sessão. `proximo` viaja na URL porque o callback roda
  // deslogado e não tem outro jeito de lembrar para onde a pessoa ia.
  const proximo = destinoSeguro(volta, "/onboarding")
  const { data, error } = await supabase.auth.signUp({
    email: String(formData.get("email") ?? ""),
    password: senha,
    options: {
      data: { nome: String(formData.get("nome") ?? "") },
      emailRedirectTo: `${origemDoApp()}/auth/callback?proximo=${encodeURIComponent(proximo)}`,
    },
  })
  if (error) {
    redirect(`/login?modo=cadastro&erro=${CODIGOS_ERRO.cadastroFalhou}&volta=${encodeURIComponent(String(volta ?? ""))}`)
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
    redirect(`/login?aviso=${CODIGOS_AVISO.cadastroRecebido}`)
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
  const limite = checarLimite(`reenvio:${await ipDoPedido()}`, JANELA_LINK_EMAIL_MS, LIMITE_LINK_EMAIL)
  if (!limite.permitido) {
    redirect(`/login?erro=${CODIGOS_ERRO.muitasTentativas}`)
  }
  const supabase = await supabaseServer()
  // Sem checar o resultado de propósito: erro e sucesso levam à MESMA
  // resposta (ver a regra no cabeçalho do arquivo).
  await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${origemDoApp()}/auth/callback?proximo=/onboarding` },
  })
  redirect(`/login?aviso=${CODIGOS_AVISO.reenvioEnviado}`)
}

/** Pedir link de nova senha. Mesma regra de resposta uniforme do reenvio — e
 *  balde de teto PRÓPRIO, separado do reenvio: são duas saídas diferentes, e
 *  estourar uma não pode fechar a outra na cara de quem precisa dela. */
export async function pedirNovaSenha(formData: FormData) {
  const limite = checarLimite(`recuperacao:${await ipDoPedido()}`, JANELA_LINK_EMAIL_MS, LIMITE_LINK_EMAIL)
  if (!limite.permitido) {
    redirect(`/login?erro=${CODIGOS_ERRO.muitasTentativas}`)
  }
  const supabase = await supabaseServer()
  await supabase.auth.resetPasswordForEmail(String(formData.get("email") ?? ""), {
    redirectTo: `${origemDoApp()}/auth/callback?proximo=/nova-senha`,
  })
  redirect(`/login?aviso=${CODIGOS_AVISO.recuperacaoEnviada}`)
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
    redirect(`/nova-senha?erro=${CODIGOS_ERRO.senhaCurta}`)
  }
  const supabase = await supabaseServer()
  const { error } = await supabase.auth.updateUser({ password: senha })
  if (error) {
    redirect(`/nova-senha?erro=${CODIGOS_ERRO.senhaNaoTrocada}`)
  }
  redirect(`/hoje?ok=${encodeURIComponent("Senha alterada")}`)
}

export async function sair() {
  const supabase = await supabaseServer()
  await supabase.auth.signOut()
  redirect("/login")
}
