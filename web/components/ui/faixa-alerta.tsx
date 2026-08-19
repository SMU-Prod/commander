import type { ReactNode } from "react"
import { Icone, type NomeIcone } from "@/components/icone"

/**
 * FAIXA DE ALERTA — o retângulo âmbar "⚠ Fragile — Handle with care..." de
 * dentro do cartão de pacote na referência. Spec §3, item 7: fundo âmbar
 * suave, ícone, título em negrito, UMA linha de instrução — não é o mesmo
 * componente que `Selo` (aquilo é uma pílula de estado de uma palavra) nem
 * `EstadoVazio` (aquilo é "não há nada aqui"); isto é "há algo, e requer
 * atenção", com uma frase de instrução embutida.
 *
 * `role="status"` e não `role="alert"`: isto renderiza junto com o resto da
 * página (é conteúdo já sabido, não um evento que acabou de acontecer) — um
 * `role="alert"` interromperia leitor de tela toda vez que a ficha carrega,
 * pra informação que não é nova.
 */
export function FaixaAlerta({
  icone = "alerta",
  titulo,
  children,
  className = "",
}: {
  icone?: NomeIcone
  titulo: string
  /** A linha de instrução — "Handle with care. Shock-absorbing packaging
   *  required." na referência. */
  children: ReactNode
  className?: string
}) {
  return (
    <div
      role="status"
      className={`flex items-start gap-2.5 rounded-[var(--raio-controle)] border border-warn/30 bg-warn/10 p-3 ${className}`}
    >
      <Icone nome={icone} className="mt-0.5 size-4 shrink-0 text-warn" />
      <div className="min-w-0">
        <p className="corpo font-semibold text-warn">{titulo}</p>
        <p className="apoio mt-0.5 text-dim">{children}</p>
      </div>
    </div>
  )
}
