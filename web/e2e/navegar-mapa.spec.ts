import { existsSync } from "node:fs"
import { expect, test } from "@playwright/test"
import { ARQUIVO_SESSAO } from "./global-setup"

const temSessao = existsSync(ARQUIVO_SESSAO)
test.use(temSessao ? { storageState: ARQUIVO_SESSAO } : {})

// Este É o teste que teria pego o bug do dono (mapa branco no emulador,
// 09-11/08): a regra da casa em `components/mapa/mapa-nautico.tsx` é que
// falha de mapa NUNCA fica muda — ou o canvas do Mapbox monta de verdade,
// ou aparece uma mensagem honesta ("Mapa indisponível"/"precisa de
// configuração"/"Tentar de novo"). Tela branca sem nenhum dos dois é o
// único resultado que reprova este teste.
test.skip(
  !temSessao,
  "Sem SUPABASE_SERVICE_ROLE_KEY (+ URL/anon key) disponível pra criar uma sessão de teste — ver e2e/global-setup.ts. " +
    "Rode localmente com web/.env.local preenchido (é o caso hoje), ou cadastre os mesmos segredos como secret do GitHub Actions pra rodar no CI.",
)

test("o mapa monta: canvas do Mapbox ou mensagem honesta de falha", async ({ page }) => {
  await page.goto("/navegar")
  await expect(page).toHaveURL(/\/navegar/)

  const canvas = page.locator("canvas.mapboxgl-canvas")
  const mensagemHonesta = page.getByText(/Mapa indisponível no momento\.|precisa de configuração|Tentar de novo/i)

  await expect(canvas.or(mensagemHonesta).first()).toBeVisible({ timeout: 20_000 })

  // Nunca uma tela branca: o <body> tem conteúdo de verdade, mesmo no
  // caminho de falha (a mensagem honesta é conteúdo, não um DOM vazio).
  const temConteudo = await page.locator("body").evaluate((b) => (b.textContent ?? "").trim().length > 0)
  expect(temConteudo).toBe(true)
})
