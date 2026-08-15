import { permanentRedirect } from "next/navigation"

/**
 * `/barco/gastos` virou `/financeiro` na onda 42 (PRD FINAL §9.1 — a aba
 * oficial chama-se Financeiro e faz muito mais do que a antiga lista de
 * custos). Alias de compatibilidade pelo mesmo motivo de `/rede` e
 * `/barco/selo` (ver docs/CONTRIBUTING.md, gate de descoberta): o link já
 * pode estar salvo no atalho de alguém ou no histórico do navegador.
 *
 * `permanentRedirect` e não `redirect`: a mudança é definitiva, e o 308 diz
 * isso pro navegador e pros buscadores.
 */
export default function GastosPage() {
  permanentRedirect("/financeiro")
}
