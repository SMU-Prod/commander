import { redirect } from "next/navigation"
import { ESPECIALIDADES_PRESTADOR } from "@/lib/domain/prestadores"

/**
 * Onda 46 — a aba Serviços FOI ELIMINADA (PRD FINAL §10, cobrado como
 * critério de aceite em §27.2: "Nenhum menu principal deve usar a antiga aba
 * 'Serviços'"). O dono autorizou em 15/08/2026.
 *
 * O que sobrou aqui é só alias, pelo mesmo motivo de `/rede`, `/barco/selo` e
 * `/oportunidades`: existe link salvo, link em conversa de WhatsApp e link em
 * push já enviado apontando pra cá. Remover o arquivo transformaria todos
 * eles em 404 — que é exatamente o que a tarefa proíbe. Alias fica fora do
 * robots.txt (mesma regra dos outros três).
 *
 * PRA ONDE FOI CADA FUNÇÃO DA TELA ANTIGA:
 *  - buscar prestador por especialidade  -> `/prestadores` (os cartões de
 *    categoria mudaram de tela, não sumiram; o `?categoria=` é preservado
 *    abaixo, então um link antigo pra "Elétrica" continua caindo em Elétrica);
 *  - publicar o que você precisa         -> `/marketplace/nova` (o PRD põe
 *    demanda no Marketplace, §10/§11) — o botão "Publicar em Oportunidades"
 *    que existia aqui virou "Publicar no Marketplace" lá em `/prestadores`.
 *
 * `?categoria=` inválida cai no diretório completo em vez de propagar lixo na
 * URL — a validação é a mesma lista curada de `lib/domain/prestadores.ts`.
 */
export default async function ServicosPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string }>
}) {
  const { categoria } = await searchParams
  const valida = (ESPECIALIDADES_PRESTADOR as readonly string[]).includes(categoria ?? "")
  redirect(valida ? `/prestadores?categoria=${encodeURIComponent(categoria!)}` : "/prestadores")
}
