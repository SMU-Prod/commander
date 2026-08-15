import { Icone, type NomeIcone } from "@/components/icone"

/**
 * O bloco padrão da tela. Existe para que duas telas que fazem a mesma coisa
 * pareçam a mesma coisa — a varredura de 15/08 achou a mesma pílula escrita
 * à mão em 12 telas com 6 alturas, e a origem disso é não ter tido um
 * cartão único desde o começo.
 *
 * `plano` para o cartão que já está dentro de outro: sombra sobre sombra
 * empilha profundidade que não existe.
 */
export function Cartao({
  icone, titulo, selo, acao, plano = false, className = "", children,
}: {
  icone?: NomeIcone
  titulo?: string
  selo?: React.ReactNode
  acao?: React.ReactNode
  plano?: boolean
  className?: string
  children: React.ReactNode
}) {
  const temCabecalho = Boolean(titulo || selo || acao)
  return (
    <section
      className={`rounded-[var(--raio-cartao)] border border-line bg-panel p-4 ${plano ? "" : "sombra-1"} ${className}`}
    >
      {temCabecalho && (
        <header className="mb-3 flex items-center gap-2">
          {icone && <Icone nome={icone} className="size-4 shrink-0 text-dim" />}
          {titulo && <h2 className="rotulo min-w-0 flex-1 truncate text-dim">{titulo}</h2>}
          {selo}
          {acao}
        </header>
      )}
      {children}
    </section>
  )
}
