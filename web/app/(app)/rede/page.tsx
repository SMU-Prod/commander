import { redirect } from "next/navigation"

// Onda 39 — alvo atualizado de /marketplace pra /comandantes (rota
// renomeada). Continua alias de compatibilidade, ver docs/CONTRIBUTING.md.
export default function RedePage() {
  redirect("/comandantes")
}
