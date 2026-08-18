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
 *
 * REGRA: o slot `filtros` é UMA linha — um `ChipLinha` só, que esta função
 * já fornece por fora. Se a tela tem um segundo grupo de chip (refinamento
 * secundário, ex.: setor dentro de estado), ele NÃO entra aqui empilhado
 * (`flex-col`) — isso reintroduz a variação de altura que este componente
 * existe pra eliminar. Ele mora fora da barra, numa `ChipLinha` solta logo
 * abaixo (ver Ocorrências e Lançamentos).
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
    // AUDITORIA VISUAL 18/08 — NO CELULAR A AÇÃO SAI DE CIMA DA FILA.
    //
    // A primeira versão punha chips e ação na MESMA linha em toda largura, e
    // no celular isso não fecha em aritmética: 390px menos ~135px do botão
    // "+ Registrar" menos o padding deixam ~230px pros filtros — dois chips.
    // O terceiro era cortado no meio da palavra ("Elétric") rente ao botão
    // dourado, e o que se lia não era "role pra ver mais", era tela
    // quebrada. A máscara de desvanecimento do `.rolagem-lateral` não salva:
    // ela suaviza a borda de um corte que não deveria estar ali.
    //
    // Então a régua tem breakpoint: no celular a ação fica ACIMA, alinhada à
    // direita, e a fila de chips usa a largura inteira (aí o corte só
    // acontece quando há filtro demais MESMO, e aí a máscara faz sentido).
    // A partir de `lg` volta o desenho da referência — chips à esquerda,
    // ação à direita, uma linha só — porque lá a largura existe.
    <div className={`flex flex-col gap-2 lg:flex-row lg:items-center ${className}`}>
      {acao && (
        <Link
          href={acao.href}
          className="flex min-h-11 shrink-0 items-center gap-1 self-end rounded-[var(--raio-pilula)] bg-accent px-4 text-sm font-semibold text-acao-texto lg:order-2 lg:self-auto"
        >
          <Icone nome="mais" className="size-4" />
          {acao.rotulo}
        </Link>
      )}
      {/* `min-w-0` mantém o scroll contido quando a fila divide a linha no
          desktop; sem ele o flex deixaria a fila empurrar a ação pra fora. */}
      <ChipLinha className="lg:order-1 lg:min-w-0 lg:flex-1">{filtros}</ChipLinha>
    </div>
  )
}
