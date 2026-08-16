import Link from "next/link"
import { ChipLinha } from "./chip"
import { Icone } from "../icone"
import type { ReactNode } from "react"

/**
 * ONDA 59 — a barra de uma tela de LISTA (spec de arquitetura §2.2;
 * referência: imagem 1 do docs/DESIGN-SYSTEM.md — chips à esquerda, ação
 * à direita, UMA altura). Antes dela, cada lista punha o botão de criar
 * num canto diferente e a varredura de 15/08 achou a mesma pílula de
 * filtro em 12 telas com 6 alturas. A ação de criar MORA aqui — não
 * flutuando, não no cabeçalho.
 */
export function BarraFerramentas({
  filtros,
  acao,
  className = "",
}: {
  filtros: ReactNode
  acao?: { href: string; rotulo: string }
  className?: string
}) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* min-w-0 pro scroll dos chips não empurrar a ação pra fora */}
      <ChipLinha className="min-w-0 flex-1">{filtros}</ChipLinha>
      {acao && (
        <Link
          href={acao.href}
          className="flex min-h-11 shrink-0 items-center gap-1 rounded-[var(--raio-pilula)] bg-accent px-4 text-sm font-semibold text-acao-texto"
        >
          <Icone nome="mais" className="size-4" aria-hidden />
          {acao.rotulo}
        </Link>
      )}
    </div>
  )
}
