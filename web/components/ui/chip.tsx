import Link from "next/link"
import type { ReactNode } from "react"

/**
 * Pílula de filtro de lista — a mesma em TODA tela que filtra alguma coisa.
 *
 * Por que virou componente (onda 56): o desenho já existia e era coerente na
 * intenção — dois níveis, o primeiro em dourado cheio ("o que estou vendo"), o
 * segundo em contorno ("recorte dentro disso") — mas estava copiado à mão em
 * doze telas e cada cópia foi derivando de tamanho: `px-3.5 py-1.5
 * text-[11.5px]`, `px-3 py-1 text-[11px]`, `px-3.5 py-2`, `px-3 py-1.5 apoio`,
 * `h-10 px-3.5 text-sm`. Seis alturas diferentes pro mesmo gesto. Telas irmãs
 * (Histórico, Lançamentos, Ocorrências, Resumos, Diário) pareciam produtos
 * diferentes lado a lado, e nenhuma dessas alturas alcançava o alvo de toque
 * que o resto do app já respeita.
 *
 * Duas decisões de acabamento embutidas aqui:
 *
 * 1. ALTURA `h-11` (44px), a MESMA de `RedeNav`/`FinanceiroNav`. O app passa a
 *    ter uma única altura de pílula, ponto. Escolher 40px "porque passa na
 *    régua da varredura" só criaria um terceiro tamanho ao lado dos 44px que
 *    a navegação já usa.
 *
 * 2. TIPOGRAFIA `text-sm` sans, não `font-mono-instr ... tracking-wide`. A
 *    fonte mono é o mostrador de instrumento — serve pra NÚMERO (horímetro,
 *    R$, coordenada), onde alinhar dígito em coluna é o que importa. Aplicada
 *    a palavra corrida com tracking ela vira soletração: "Em acompanhamento"
 *    ocupava ~160px e era o que empurrava o resto da fila pra fora da tela.
 *    Em sans o mesmo rótulo cabe, e a fila para de ser cortada no meio.
 */
export function Chip({
  href,
  ativo,
  nivel = "primario",
  children,
}: {
  href: string
  ativo: boolean
  /** `primario`: a pergunta principal da tela (dourado cheio quando ativo).
   *  `secundario`: recorte dentro da primeira (contorno, fundo transparente). */
  nivel?: "primario" | "secundario"
  children: ReactNode
}) {
  // O nível 2 não tem `bg-panel` de propósito: fica sobre o fundo da página e
  // recua um plano, que é o que diz "isto é um recorte do filtro de cima".
  // `text-dim-chip` (e não `text-dim`) porque o token existe exatamente pra
  // texto sobre fundo recolhido — `text-dim` reprova AA nessa combinação.
  const estilo = ativo
    ? nivel === "primario"
      ? "border-accent bg-accent font-semibold text-acao-texto"
      : "border-accent-forte font-semibold text-accent-forte"
    : nivel === "primario"
      ? "border-line bg-panel text-dim"
      : "border-line text-dim-chip"

  return (
    <Link
      href={href}
      aria-current={ativo ? "true" : undefined}
      className={`flex h-11 shrink-0 items-center whitespace-nowrap rounded-full border px-4 text-sm ${estilo}`}
    >
      {children}
    </Link>
  )
}

/**
 * A fila horizontal onde os `Chip` moram.
 *
 * Além de tirar `style={{ scrollbarWidth: "none" }}` de doze arquivos, resolve
 * um defeito visual que a varredura não mede: a fila rolável era cortada em
 * seco na borda direita, no meio de uma palavra ("Hidrá", "Manutenç"), e isso
 * lê como bug de layout, não como "tem mais coisa aqui do lado". A máscara
 * `rolagem-lateral` (app/globals.css) desvanece os últimos pixels — quando não
 * há transbordo, não há nada na borda pra desvanecer e ela é invisível.
 */
export function ChipLinha({
  children,
  quebra = false,
  className = "",
}: {
  children: ReactNode
  /** Deixa a fila quebrar em várias linhas em vez de rolar. Use quando a lista
   *  é curta e fechada (as camadas da Agenda, os tipos da taxonomia): rolagem
   *  esconde opção que caberia na tela, e opção escondida não é escolhida. */
  quebra?: boolean
  className?: string
}) {
  if (quebra) return <div className={`flex flex-wrap gap-1.5 ${className}`}>{children}</div>
  return (
    <div
      className={`rolagem-lateral flex gap-1.5 overflow-x-auto pb-1 ${className}`}
      style={{ scrollbarWidth: "none" }}
    >
      {children}
    </div>
  )
}
