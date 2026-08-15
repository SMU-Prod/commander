import { redirect } from "next/navigation"

// Onda 45 — alias de compatibilidade, par do `/oportunidades`.
//
// Onda 46: o motivo original acabou. Ele existia porque `/servicos` linkava
// pra cá com o texto "Publicar em Oportunidades", e a aba Serviços estava
// congelada aguardando decisão do dono. A decisão saiu em 15/08/2026: a aba
// foi eliminada (PRD FINAL §10/§27.2) e o botão, agora em `/prestadores`,
// aponta direto pra `/marketplace/nova` com o nome certo. Nenhuma tela do app
// chega mais aqui.
//
// O arquivo FICA assim mesmo, e de propósito: o nome velho circulou fora do
// app (push, e-mail, conversa) e apagar três linhas transformaria esses links
// em 404 sem ganhar nada. É o mesmo raciocínio de `/oportunidades`, `/rede` e
// `/barco/selo`. Se um dia sair, sai junto com o pai.
export default function NovaOportunidadePage() {
  redirect("/marketplace/nova")
}
