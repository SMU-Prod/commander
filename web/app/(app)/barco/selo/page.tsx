import { redirect } from "next/navigation"

// Alias de compatibilidade — a tela "Selo Ouro" virou "Selos Commander" e se
// separou em Verified/Gold nesta onda (mesmo padrão de `app/(app)/rede/page.tsx`,
// que redireciona de "Marketplace" pra "Comandantes"). Fica documentado na
// lista de exceções do gate de descoberta em `docs/CONTRIBUTING.md`.
export default function SeloAliasPage() {
  redirect("/barco/selos")
}
