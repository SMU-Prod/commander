import Link from "next/link"
import { Icone, type NomeIcone } from "@/components/icone"

/**
 * Estado vazio: ícone + frase na voz do app + caminho. Um cartão vazio sem
 * ação é uma lápide ("nenhum item cadastrado") — este componente sempre
 * tem espaço para dizer o que fazer a seguir, mesmo quando a ação é opcional.
 *
 * Quando usar: qualquer lista/seção sem dado ainda.
 * - `variant="cartao"` (padrão): sozinho na tela, com sombra e borda próprias
 *   (ex.: "Nenhum motor ainda" sem um painel ao redor).
 * - `variant="linha"`: dentro de um painel que já tem borda (mesmo painel
 *   onde `LinhaLista variant="grupo"` mora) — sem sombra/borda repetida.
 */
export function EstadoVazio({
  icone,
  titulo,
  descricao,
  acao,
  variant = "cartao",
  className = "",
}: {
  icone: NomeIcone
  titulo: string
  descricao?: string
  acao?: { href: string; rotulo: string }
  variant?: "cartao" | "linha"
  className?: string
}) {
  const base = variant === "cartao" ? "sombra-1 rounded-[14px] border border-line bg-panel p-4" : "py-6"
  return (
    <div className={`${base} text-center ${className}`}>
      <Icone nome={icone} className="mx-auto size-6 text-dim" />
      <p className="corpo mt-2 font-medium">{titulo}</p>
      {descricao && <p className="apoio mt-1 text-dim">{descricao}</p>}
      {acao && <Link href={acao.href} className="apoio mt-3 inline-block text-accent-forte">{acao.rotulo}</Link>}
    </div>
  )
}
