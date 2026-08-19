import Link from "next/link"
import type { ReactNode } from "react"
import { Icone } from "@/components/icone"

/**
 * Topo de uma tela de detalhe: link "Voltar" (sempre), título opcional e
 * ação primária opcional à direita do título (ex.: "Editar").
 *
 * Quando usar: telas fora do fluxo de abas (criar/editar/detalhe de item,
 * documento, equipamento...). Quando a própria tela já tem um elemento que
 * funciona como título (ex.: o wordmark do Connect em /barco/connect), passe
 * só `voltarHref` e omita `titulo` — o componente cuida só da navegação.
 *
 * ONDA 60 — a anatomia de FICHA da imagem 2 do docs/DESIGN-SYSTEM.md
 * ("TX-9913-HX [Idle] · ações à direita"), por duas props NOVAS e opcionais
 * (nenhum dos ~46 consumidores existentes muda):
 *
 * - `selo`: o chip de estado COLADO ao título, na mesma linha (`<Selo>` com
 *   palavra e cor — quem passa decide o vocabulário).
 * - `acoes`: a barra de ações da ficha — contornos + no máximo UMA
 *   preenchida (docs/DESIGN.md §6.2: uma ação principal por tela; quem passa
 *   decide, aqui só se posiciona). No desktop ela fica à direita do título;
 *   no celular desce pra baixo dele, inteira, sem espremer alvo de 44px.
 *
 * `acoes` substitui `acao` nas fichas novas — `acao` continua existindo pros
 * consumidores atuais (fica à direita em toda largura); não passe as duas.
 * Os dois slots só aparecem junto de `titulo`: selo sem título não é ficha.
 */
export function CabecalhoDetalhe({
  voltarHref,
  voltarRotulo = "Voltar",
  titulo,
  descricao,
  selo,
  acao,
  acoes,
  className = "",
}: {
  voltarHref: string
  voltarRotulo?: string
  /** ONDA 91 — era `string`, e a ficha de uma ocorrência ANULADA precisa do
   *  título riscado: ao adotar o componente padrão, a tela perdia a única
   *  marca visual de que aquele registro não vale mais.
   *
   *  `ReactNode` e NÃO uma prop de classe (`tituloClassName`): este
   *  componente não tem por que saber o que é `line-through`, e uma prop de
   *  classe convida a próxima tela a mandar cor, peso e tamanho por aqui —
   *  que é como a escala tipográfica ganhou sete degraus (achado 5.3). Com
   *  `ReactNode` quem tem a informação ("está anulada") desenha a informação,
   *  e o cabeçalho continua cuidando só de posição.
   *
   *  PASSE CONTEÚDO EM LINHA (texto, `<s>`, `<span>`): o `truncate` do `<h1>`
   *  é `white-space: nowrap` mais reticências, e um filho de bloco escapa
   *  dos dois. */
  titulo?: ReactNode
  descricao?: string
  selo?: ReactNode
  acao?: ReactNode
  acoes?: ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      {/* ONDA 54 — este link é A SAÍDA de ~46 telas do app, e media 16px de
          altura: menos da metade do alvo de toque que o resto do app já
          respeita (`--altura-controle`). Dedo grande, barco balançando, tela
          molhada — errar o "Voltar" e cair na tela de trás é literalmente o
          "ficamos travados sem conseguir voltar" do relato.

          `-my-2.5` devolve ao layout 20 dos 28px que os 44px acrescentam:
          a área de TOQUE passa a 44px, mas a altura ocupada sobe só ~8px, e
          o título logo abaixo não desce meia tela em 46 arquivos. O
          `-ml-1 px-1` faz o mesmo na horizontal sem tirar o ícone do
          alinhamento com a margem da página. A folga de 10px que a margem
          negativa joga para baixo cabe dentro do `mt-3` do título — não
          encosta em nada. */}
      <Link
        href={voltarHref}
        className="-my-2.5 -ml-1 inline-flex min-h-[var(--altura-controle)] items-center gap-1 px-1 rotulo text-accent-forte"
      >
        <Icone nome="voltar" className="size-4" /> {voltarRotulo}
      </Link>
      {titulo && (
        // Com `acoes`, o wrapper só vira flex de `sm:` pra cima — abaixo disso
        // a barra desce pra baixo do título como bloco cheio. Sem `acoes`, o
        // layout é EXATAMENTE o de antes (flex em toda largura, `acao` à
        // direita) — é isso que segura os ~46 consumidores atuais no lugar.
        <div className={acoes ? "mt-3 sm:flex sm:items-start sm:justify-between sm:gap-3" : "mt-3 flex items-start justify-between gap-3"}>
          <div className="min-w-0">
            {/* ONDA 91 — `line-clamp-2` NO LUGAR DE `truncate`.
                O título da tela é a IDENTIFICAÇÃO dela, e a régua da casa
                (`linha-lista.tsx`, onda 56) é que reticência serve quando o
                resto é dispensável — um nome longo ao lado de um valor — e
                não quando o texto É a informação. Numa linha só, "Preços da
                avaliação Commander Gold" (34 caracteres) sai como "Preços da
                avaliação Comm…" a 390px, e `/admin/gold/precos` preferiu não
                usar o componente a exibir isso. O teto de duas linhas preserva
                o ritmo (nenhum título vira parágrafo) e a altura só cresce no
                caso que precisa: a maioria continua em uma linha.
                `.titulo-pagina` já traz `text-wrap: balance`, então a quebra
                sai com as duas linhas equilibradas em vez de uma órfã.

                `min-w-0` EXPLÍCITO além disso: com selo o título é item de uma
                fileira flex, e ali o mínimo automático de um item é o tamanho
                do conteúdo — um título longo empurraria o selo para fora em
                vez de quebrar. O `overflow: hidden` que vem dentro do
                `line-clamp` já zera esse mínimo por tabela; escrevê-lo deixa
                de depender disso, o que passa a importar agora que `titulo`
                aceita `ReactNode`. */}
            {selo ? (
              <div className="flex min-w-0 items-center gap-2">
                <h1 className="titulo-pagina min-w-0 line-clamp-2">{titulo}</h1>
                {selo}
              </div>
            ) : (
              <h1 className="titulo-pagina min-w-0 line-clamp-2">{titulo}</h1>
            )}
            {descricao && <p className="apoio mt-1 text-dim">{descricao}</p>}
          </div>
          {acao}
          {acoes && <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-0 sm:shrink-0 sm:justify-end">{acoes}</div>}
        </div>
      )}
    </div>
  )
}
