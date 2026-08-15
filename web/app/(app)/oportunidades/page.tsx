import { redirect } from "next/navigation"

// Onda 45 — alias de compatibilidade. "Oportunidades" foi o nome escolhido na
// onda 39 justamente para NÃO usar "Marketplace" (que na época era o nome da
// vitrine de perfis, ver docs/CONTRIBUTING.md, Glossário). O PRD FINAL de
// 15/08 desfez a ambiguidade na origem: a vitrine virou EXPLORAR PARCEIROS e
// "MARKETPLACE" passou a ser, oficialmente, a área de demandas (§0, §3.1,
// §11). Com o motivo do apelido resolvido, a rota volta ao nome do produto.
//
// Mesma família de /rede e /barco/selo: alias que redireciona, fora do
// robots.txt, mantido porque links antigos (inclusive push e e-mail já
// enviados) apontam pra cá.
export default function OportunidadesPage() {
  redirect("/marketplace")
}
