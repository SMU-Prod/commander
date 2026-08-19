import Link from "next/link"
import type { ReactNode } from "react"
import { Icone } from "@/components/icone"
import { hub as hubPorChave, type ChaveHub } from "@/lib/ui/hubs"

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
 *
 * ===========================================================================
 * ONDA 104 — A PROP `hub`, E POR QUE ELA MORA AQUI E NÃO NUM COMPONENTE NOVO.
 * ===========================================================================
 * §8 do Guia de Design v1: *"cada tela [de hub] mantém a MESMA estrutura e
 * muda só objeto, cor técnica, métricas e abas pertinentes"*. Antes desta onda
 * as oito telas de hub não tinham estrutura nenhuma em comum — QUATRO usavam
 * este componente (Motores, Casco, Documentos, Manutenções) e QUATRO
 * desenhavam o cabeçalho à mão (Elétrica, Hidráulica, Segurança,
 * Equipamentos), com `<h1>` solto, alvo de voltar de 16px e a ação numa pílula
 * escrita por extenso em cada arquivo. E nenhuma das oito dizia de que hub
 * era: a pessoa tocava num card ciano em `/barco` e caía numa tela cinza.
 *
 * A tentação era escrever um `CabecalhoHub` separado. Seria o terceiro
 * cabeçalho do app — exatamente a deriva que este sistema existe para parar.
 * `hub` é uma prop OPCIONAL: os ~46 consumidores atuais saem byte a byte como
 * saíam, e as oito telas de hub passam a compartilhar a mesma peça.
 *
 * O QUE ELA DESENHA — dois canais, e nenhum deles é o texto do título:
 *   · CARTUCHO: anel na cor do hub a 40%, ícone na cor cheia.
 *   · FILETE sob a primeira palavra, na cor do hub.
 * O `<h1>` fica em `--texto`. Nas imagens normativas ele aparece tingido, e é
 * o único ponto em que isto NÃO segue a imagem: tom de hub é elemento gráfico
 * (régua de 3:1) e hidráulica entrega 4,20:1 — passaria raspando num título
 * grande e reprovaria em texto normal. A identidade já está paga pelo cartucho
 * e pelo filete, que são grafismo.
 *
 * O FILETE DO HUB SUBSTITUI O DOURADO DE `TituloTela`, E NÃO SE SOMA A ELE. O
 * ouro é o indicador de "onde a pessoa está" nas telas de primeiro nível
 * (Início, Meu Barco, Serviços); dentro de um hub, quem responde "onde" é o
 * hub. Dois filetes seriam duas respostas para uma pergunta só — e gastariam
 * o orçamento de dourado do §3.4 com moldura.
 *
 * O TÍTULO VEM DA TABELA quando `hub` é passado. `titulo` continua podendo
 * sobrepor, mas nenhuma das oito faz isso: com o rótulo saindo de
 * `lib/ui/hubs.ts`, "Elétrica" não tem como virar "Eletrica" numa tela só.
 */
/**
 * O mesmo gesto de `components/titulo-tela.tsx`, na cor do hub em vez do ouro.
 * A primeira palavra e não a frase: com o título inteiro sublinhado o filete
 * viraria uma barra de 200px atravessando a tela — cor em ÁREA, não em
 * detalhe, e é a diferença entre identidade e "dashboard colorido".
 */
function PrimeiraPalavraComFilete({ texto, filete }: { texto: string; filete: string }) {
  const [primeira, ...resto] = texto.split(" ")
  return (
    <>
      {/* `inline-block` + `pb-1.5`: o filete precisa de uma caixa com a LARGURA
          DA PALAVRA pra se ancorar, e de folga pra não encostar na descida do
          "ç" de "Segurança". */}
      <span className="relative inline-block pb-1.5">
        {primeira}
        <span
          aria-hidden="true"
          className={`absolute inset-x-0 bottom-0 h-0.5 rounded-[var(--raio-pilula)] ${filete}`}
        />
      </span>
      {resto.length > 0 && ` ${resto.join(" ")}`}
    </>
  )
}

export function CabecalhoDetalhe({
  voltarHref,
  voltarRotulo = "Voltar",
  hub,
  titulo,
  descricao,
  selo,
  acao,
  acoes,
  className = "",
}: {
  voltarHref: string
  voltarRotulo?: string
  /** Um dos oito hubs técnicos. Traz cartucho, filete e o rótulo da tabela. */
  hub?: ChaveHub
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
  const h = hub ? hubPorChave(hub) : null
  const tituloFinal = titulo ?? h?.rotulo
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
      {tituloFinal && (
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
            {/* O CARTUCHO só existe no modo hub, e é irmão do `<h1>` e não pai:
                o título precisa continuar sendo o primeiro filho de bloco pra
                `line-clamp-2` e `min-w-0` seguirem valendo. `border` e não
                preenchimento porque o §5 dá a cor do hub à BORDA — um disco
                cheio na cor saturada seria a maior mancha de cor da tela, que
                é o "brilho neon sem significado" que o §2 proíbe. */}
            <div className={h || selo ? "flex min-w-0 items-center gap-2" : undefined}>
              {h && (
                <span
                  aria-hidden="true"
                  className={`flex size-11 shrink-0 items-center justify-center rounded-[var(--raio-pilula)] border bg-panel ${h.anel}`}
                >
                  <Icone nome={h.icone} className={`size-6 ${h.tom}`} />
                </span>
              )}
              <h1 className="titulo-pagina min-w-0 line-clamp-2">
                {h ? <PrimeiraPalavraComFilete texto={h.rotulo} filete={h.filete} /> : tituloFinal}
              </h1>
              {selo}
            </div>
            {descricao && <p className="apoio mt-1 text-dim">{descricao}</p>}
          </div>
          {acao}
          {acoes && <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-0 sm:shrink-0 sm:justify-end">{acoes}</div>}
        </div>
      )}
    </div>
  )
}
