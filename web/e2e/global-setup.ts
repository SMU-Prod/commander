import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { chromium, type FullConfig } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"

export const ARQUIVO_SESSAO = path.join(__dirname, ".auth", "usuario-teste.json")
export const ARQUIVO_ID_USUARIO = path.join(__dirname, ".auth", "usuario-teste-id.txt")

// E-mail ÚNICO por execução, não fixo. Com um e-mail compartilhado, duas
// rodadas simultâneas (CI + local, ou dois agentes) derrubam a sessão uma da
// outra no meio do caminho: a segunda falha em `createUser` com "already
// registered", não grava `storageState`, e a suíte inteira passa a fotografar
// a tela de login achando que está medindo o app. Três frentes perderam
// varredura assim em 15/08/2026 antes de alguém perceber que o problema não
// era o app — era o teste.
//
// `E2E_TEST_EMAIL` continua tendo prioridade pra quem quiser fixar de
// propósito (depurar uma conta específica, por exemplo).
const EMAIL_TESTE =
  process.env.E2E_TEST_EMAIL ??
  `e2e-${process.pid}-${Date.now().toString(36)}@soumardivers.com`

/**
 * `/navegar` é rota protegida (ver middleware.ts) — pra testar de verdade
 * que o mapa monta (o teste que teria pego o bug do dono no emulador),
 * precisamos de uma sessão real.
 *
 * Em vez de pedir credenciais ou cadastrar uma conta interativamente (o que
 * a tarefa explicitamente pede pra NÃO fazer), este setup cria um usuário
 * de teste EFÊMERO via Admin API do Supabase (precisa de
 * `SUPABASE_SERVICE_ROLE_KEY`), loga de verdade pela tela `/login` (não
 * fabrica cookie na mão — usa o fluxo real de `lib/acoes/auth.ts`) e salva
 * a sessão resultante em `usuario-teste.json`. `global-teardown.ts` apaga
 * esse usuário no final da rodada — o Commander não tem banco de staging
 * separado (mesmo projeto Supabase de produção, ver docs/OPERACAO.md), então
 * não deixar rastro é o mínimo.
 *
 * SEM as três env vars de Supabase — é o caso do job de CI hoje, que builda
 * com credenciais fake (ver .github/workflows/ci.yml e o comentário sobre
 * isso em docs/OPERACAO.md) — este setup não tenta nada e não escreve o
 * arquivo de sessão. `e2e/navegar-mapa.spec.ts` detecta a ausência e pula,
 * com o motivo explícito (nunca um "vermelho" confuso). Localmente, com
 * `web/.env.local` preenchido (é o caso hoje), a sessão é criada de
 * verdade e o teste roda por completo.
 */
export default async function globalSetup(config: FullConfig) {
  mkdirSync(path.dirname(ARQUIVO_SESSAO), { recursive: true })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !anonKey || !serviceKey) {
    console.log("[e2e] SUPABASE_SERVICE_ROLE_KEY (ou URL/anon key) ausente — pulando criação de sessão de teste; specs autenticados vão skip.")
    return
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  // Senha gerada a cada rodada, usada só pra logar imediatamente em
  // seguida — nunca precisa ser lembrada nem persistida entre execuções.
  const senha = randomUUID()

  const { data: criado, error: erroCriar } = await admin.auth.admin.createUser({
    email: EMAIL_TESTE,
    password: senha,
    email_confirm: true, // funciona independente do "Confirm email" do projeto estar ligado ou não
    user_metadata: { nome: "E2E Commander" },
  })
  if (erroCriar || !criado.user) {
    console.log(`[e2e] não foi possível criar usuário de teste efêmero (${erroCriar?.message ?? "sem detalhe"}) — pulando sessão autenticada.`)
    return
  }
  writeFileSync(ARQUIVO_ID_USUARIO, criado.user.id, "utf8")

  // Embarcação de teste (onda 54). Sem ela, TODA tela do dossiê redireciona
  // pra /onboarding e a varredura de layout mede a mesma tela 35 vezes em vez
  // do app. É semeada pelo service role porque o objetivo aqui é ter o app
  // POVOADO pra medir; o fluxo de onboarding em si tem spec próprio.
  // Some junto com o usuário no teardown (cascade em embarcacoes/vinculos).
  const { data: barco } = await admin
    .from("embarcacoes")
    .insert({
      nome: "Barco de Teste",
      estaleiro: "Azimut", modelo: "55", ano: 2020,
      comprimento_m: 16.7, boca_m: 4.8, calado_m: 1.35,
      marina: "Marina da Glória", marina_lat: -22.9186, marina_lon: -43.1686,
    })
    .select("id")
    .single()
  if (barco) {
    await admin.from("vinculos").insert({
      usuario_id: criado.user.id, embarcacao_id: barco.id, papel: "PROP", nivel: "completo",
    })
    await admin.from("equipamentos").insert([
      { embarcacao_id: barco.id, tipo: "motor", posicao: "BB", marca: "Volvo Penta", modelo: "D6-400", horas_atuais: 612 },
      { embarcacao_id: barco.id, tipo: "motor", posicao: "BE", marca: "Volvo Penta", modelo: "D6-400", horas_atuais: 608 },
    ])
    console.log("[e2e] embarcação de teste semeada.")
  }

  const baseURL = config.projects[0]?.use?.baseURL as string | undefined
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    await page.goto(`${baseURL ?? "http://localhost:3010"}/login`)
    await page.getByLabel("E-mail").fill(EMAIL_TESTE)
    await page.getByLabel("Senha").fill(senha)
    await page.getByRole("button", { name: "Entrar" }).click()
    // "/hoje" no caso comum; "/onboarding" se o gate de onboarding pegar
    // uma conta nova sem embarcação — os dois contam como "logou de verdade".
    await page.waitForURL(/\/(hoje|onboarding)/, { timeout: 15_000 })
    await page.context().storageState({ path: ARQUIVO_SESSAO })
    console.log("[e2e] sessão de teste criada com sucesso.")
  } catch (e) {
    console.log(`[e2e] login do usuário de teste efêmero falhou (${(e as Error).message}) — specs autenticados vão skip.`)
  } finally {
    await browser.close()
  }
}
