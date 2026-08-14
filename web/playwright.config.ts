import path from "node:path"
import { defineConfig, devices } from "@playwright/test"

// `next dev` (chamado pelo `webServer` abaixo) carrega `.env.local` sozinho
// — mas ESTE processo (Playwright, incluindo `e2e/global-setup.ts`) não.
// Sem isso, rodar localmente não teria acesso a SUPABASE_SERVICE_ROLE_KEY
// pra criar a sessão de teste (ver comentário grande em global-setup.ts).
// Silencioso se o arquivo não existir (caso do CI, que usa credenciais fake
// do workflow — ver .github/workflows/ci.yml).
try {
  process.loadEnvFile(path.resolve(__dirname, ".env.local"))
} catch {
  // sem .env.local — segue só com o que já estiver em process.env
}

const PORT = process.env.E2E_PORT ?? "3010"
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`

// Onda 31 (robustez) — Playwright cobre os caminhos onde os bugs REAIS
// apareceram nesta semana (mapa branco no emulador, rota cruzando terra,
// sessão caindo, chunk 403) — coisas que a suíte de unit/domain (vitest,
// 471+ testes) não pega porque nunca sobe um navegador de verdade. Ver
// "Testes ponta a ponta" em docs/OPERACAO.md.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["list"], ["github"], ["html", { open: "never" }]] : [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
