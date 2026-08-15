import { redirect } from "next/navigation"

// Onda 45 — alias de compatibilidade, par do `/oportunidades`. Existe por um
// motivo concreto: `/servicos` linka pra cá ("Publicar em Oportunidades", em
// app/(app)/servicos/page.tsx), e a aba Serviços está congelada aguardando
// decisão do dono (o PRD FINAL §10/§27.2 manda eliminá-la; a auditoria de
// 15/08 listou isso como decisão pendente). Sem este redirecionamento, aquele
// botão viraria 404 no dia em que a rota antiga saiu.
//
// Quando a decisão sobre Serviços sair, o texto de lá passa a dizer
// "Marketplace" e este arquivo pode ir junto com ele.
export default function NovaOportunidadePage() {
  redirect("/marketplace/nova")
}
