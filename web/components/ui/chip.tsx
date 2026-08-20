import Link from "next/link"
import type { ReactNode } from "react"
import { TOQUE } from "@/lib/ui/acoes"

/**
 * Pílula de filtro de lista — a mesma em TODA tela que filtra alguma coisa.
 *
 * Por que virou componente (onda 56): o desenho já existia e era coerente na
 * intenção — dois níveis, o primeiro em dourado cheio ("o que estou vendo"), o
 * segundo em contorno ("recorte dentro disso") — mas estava copiado à mão em
 * doze telas e cada cópia foi derivando de tamanho: `px-3.5 py-1.5
 * text-xs`, `px-3 py-1 text-xs`, `px-3.5 py-2`, `px-3 py-1.5 apoio`,
 * `h-10 px-3.5 text-sm`. Seis alturas diferentes pro mesmo gesto. Telas irmãs
 * (Histórico, Lançamentos, Ocorrências, Resumos, Diário) pareciam produtos
 * diferentes lado a lado, e nenhuma dessas alturas alcançava o alvo de toque
 * que o resto do app já respeita.
 *
 * Duas decisões de acabamento embutidas aqui:
 *
 * 1. ALVO `--altura-controle` (44px), o MESMO de `RedeNav`/`FinanceiroNav`.
 *    O app passa a ter uma única altura de ALVO, ponto. Escolher 40px "porque
 *    passa na régua da varredura" só criaria um terceiro tamanho ao lado dos
 *    44px que a navegação já usa. (Onda 91, achado 5.10: era `h-11` cravado;
 *    o número virou token em `globals.css`, porque cravar a régua em cada
 *    arquivo é como o app chegou a nove alturas de alvo.)
 *    ONDA 98 — o alvo continua 44; o DESENHO desce para 34 (§21 do HAULIX).
 *    Ver o comentário no corpo, logo acima do `return`.
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
  contagem,
  children,
}: {
  href: string
  ativo: boolean
  /** `primario`: a pergunta principal da tela (dourado cheio quando ativo).
   *  `secundario`: recorte dentro da primeira (contorno, fundo transparente). */
  nivel?: "primario" | "secundario"
  /** ONDA 79 — "All 10 · Active 4 · Idle 2" da referência (spec §3, item
   *  10): o tamanho de cada recorte, junto do filtro. `undefined` continua
   *  sem número nenhum (os ~12 consumidores atuais não mudam). Zero também
   *  desenha — mesma régua de honestidade da contagem do `Abas` (onda 79):
   *  "Vencido 0" é resposta, não a ausência de uma. */
  contagem?: number
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

  // ONDA 98 — O ALVO TEM 44px, O DESENHO TEM 34. É a régua que `lib/ui/acoes.ts`
  // e `BotaoCirculo` já praticavam, aplicada ao controle que o dono nomeou.
  // ---------------------------------------------------------------------
  // Diagnóstico dele em 19/08, olhando o app rodando: *"muitos filtros em
  // formato de cápsula"*. A causa não é a quantidade de filtros — é o PESO de
  // cada um: a pílula desenhava os 44px inteiros do alvo de toque, então uma
  // fila de cinco filtros ocupava mais tinta que o conteúdo que ela filtra. O
  // §21 do HAULIX põe o controle médio em 34–36 de altura e 0 14 de padding;
  // a régua da casa põe o alvo em 44px e não negocia (mão molhada, barco
  // balançando). As duas convivem separando as coisas: o `<Link>` continua
  // sendo a caixa de 44px — é ele que o dedo acerta e é ele que a varredura
  // mede —, e o `<span>` de dentro é a cápsula que se vê.
  //
  // SEM MARGEM NEGATIVA, ao contrário de `ALVO_ACAO`. Lá os `-my-[7px]`
  // existem para o cabeçalho de seção não engordar 14px em ~35 telas; aqui a
  // fila já reserva a altura, e margem negativa dentro do `ChipLinha` seria
  // defeito: `overflow-x: auto` promove o eixo Y a `auto` também, então os
  // 5px que sobrassem de cada lado seriam RECORTADOS — junto com a área
  // clicável. O alvo voltaria a 34px sem ninguém perceber.
  return (
    <Link
      href={href}
      aria-current={ativo ? "true" : undefined}
      className={`flex h-[var(--altura-controle)] shrink-0 items-center ${TOQUE}`}
    >
      <span
        className={`flex h-[34px] items-center gap-1.5 whitespace-nowrap rounded-[var(--raio-pilula)] border px-3.5 text-sm ${estilo}`}
      >
        {children}
        {contagem != null && (
          <span className="font-mono-instr text-xs tabular-nums opacity-80">{contagem}</span>
        )}
      </span>
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

/**
 * CHIP DE DADO — rótulo colado no valor, dentro de uma pílula. É o terceiro
 * chip da referência ("2 linhas de texto + 3 chips em ~64px", spec §3 item 6)
 * e o formato único que o achado 5.7 cobra: a contagem/medida mora DENTRO do
 * chip, nunca como número mono solto ao lado de um título.
 *
 * ONDA 91 — promovido da mão do Diário (`app/(app)/diario/page.tsx`, os chips
 * "No mar", "Trilha" e "A bordo" do cartão de saída), que é onde este desenho
 * nasceu e onde ele já tinha derivado: `px-2.5` e `py-[5px]` são pixels
 * escolhidos no olho, fora da escala base-8 que o `docs/DESIGN.md` §5 declara.
 * Aqui viram `px-2`/`py-1`, os degraus vizinhos.
 *
 * NÃO É O `Chip` acima, e a diferença é funcional, não de tamanho: aquele é um
 * `<Link>` de filtro (44px de alvo, muda o que a tela mostra); este é LEITURA,
 * não se toca — mesma isenção declarada em `PastilhaKpi`, e pelo mesmo motivo.
 *
 * O valor sai em `.valor` (14px) e não nos 12px que o Diário escrevia: a onda
 * 87 declarou três degraus para o número e este é o de lista. Doze px ao lado
 * de um rótulo de 11px liam como a mesma voz, que é exatamente o achatamento
 * que a régua de hierarquia existe pra evitar.
 */
export function ChipDado({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[var(--raio-pilula)] border border-line px-2 py-1">
      <span className="rotulo text-dim">{rotulo}</span>
      <span className="font-mono-instr valor font-semibold tabular-nums">{children}</span>
    </span>
  )
}
