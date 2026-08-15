import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  // Onda 57 — selo.test.ts é o primeiro teste fora de lib/; sem esta linha
  // "npm test" nunca o executa e a garantia de "estado nunca só por cor"
  // vira letra morta.
  test: { include: ["lib/**/*.test.ts", "components/**/*.test.ts"] },
})
