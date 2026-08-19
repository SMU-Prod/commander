/**
 * ESQUELETO — o desenho da espera, por NATUREZA DE TELA.
 *
 * ONDA 86, achados 3.2/3.5/6.4 da auditoria de 19/08. O app tinha UM
 * `loading.tsx` (`app/(app)/loading.tsx`) para 92 telas, e o desenho dele era
 * a silhueta da Início: uma foto de 176px, um título, dois cartões, dois KPIs.
 * Em `/diario`, `/financeiro`, `/agenda`, `/menu` e mais 88 telas essa foto não
 * chega nunca — então a primeira transição do app é um SALTO de layout, e é na
 * primeira meia-tela que se decide se o app parece caro. Esqueleto que não bate
 * com o conteúdo é pior que esqueleto nenhum: ele promete uma coisa e entrega
 * outra, e é a promessa quebrada que produz o salto.
 *
 * AS TRÊS FORMAS SÃO AS NATUREZAS DE TELA do spec de arquitetura
 * (`docs/superpowers/specs/2026-08-15-arquitetura-informacao-design.md` §2), não
 * um vocabulário novo:
 *
 * - `lista` (§2.2) — "quais existem?": título → barra de ferramentas →
 *   `LinhaLista` repetida. Diário, Financeiro, Agenda, Explorar, Prestadores,
 *   Marketplace, Avisos, Tripulação... é a natureza mais comum do app, e por
 *   isso é a que o `loading.tsx` raiz usa.
 * - `ficha` (§2.3) — "conta tudo sobre este": `CabecalhoDetalhe` → `Cartao` por
 *   bloco com pares rótulo/valor. Equipamento, saída do diário, ocorrência,
 *   lançamento, Mapa da Embarcação.
 * - `painel` (§2.1) — "como está?": o assunto (a foto do barco) → cartões →
 *   instrumentos. O spec diz que painel é UMA tela só, a Início; na prática
 *   `/barco` tem a mesma silhueta a partir da foto (ver `saudacao`).
 *
 * A quarta natureza do spec, **formulário** (§2.4), não ganhou forma de
 * propósito — não é economia, é honestidade: tela de criar não espera dado
 * nenhum (renderiza na hora, esqueleto ali seria pisca-pisca), e tela de editar
 * carrega exatamente os blocos que `ficha` já desenha. Inventar uma quarta
 * forma para cobrir zero caso real é o mesmo erro do esqueleto genérico, só
 * que ao contrário.
 *
 * POR QUE UM COMPONENTE COM `forma`, E NÃO TRÊS COMPONENTES EXPORTADOS: o que
 * este arquivo garante de verdade não é o desenho — é o `role="status"`, o
 * `aria-busy` e o comportamento de quem pediu menos movimento. Com três
 * exports, essa garantia vira três lugares de onde esquecer; com um, ela é
 * estrutural e o `forma` só escolhe o miolo.
 *
 * SOBRE O RAIO: tudo vem de token (`--raio-painel`, `--raio-cartao`,
 * `--raio-controle`, `--raio-pilula`) — o `loading.tsx` antigo misturava
 * `rounded-[16px]`, `rounded`, `rounded-[14px]` e `rounded-[10px]`, e dois
 * deles não eram token nenhum.
 *
 * ONDA 91 — `--raio-painel` ENTROU, exatamente como a onda 86 escreveu aqui
 * que entraria ("quando os painéis de primeiro nível subirem para
 * `--raio-painel`, este arquivo sobe junto"). Quem subiu foi `Cartao`, via o
 * `nivel` novo. E por isso o raio aqui virou DOIS e não um: um esqueleto que
 * arredonda diferente do que chega é a mesma mentira da foto de 176px, só que
 * com 2px de largura — então cada bloco copia o raio da peça REAL que ele
 * promete, e não um raio "de esqueleto".
 */

/** Barra de texto — a unidade de tudo que é palavra num esqueleto.
 *  `--raio-controle` (8px) e não `rounded` (4px): o token de "chip, campo,
 *  botão pequeno" é o parente mais próximo de uma linha de texto curta. */
const TEXTO = "rounded-[var(--raio-controle)] bg-panel2"

/** A moldura do wrapper de lista que as telas escrevem à mão (`sombra-1
 *  rounded-[var(--raio-cartao)] border border-line bg-panel`). A borda e a
 *  sombra são REAIS no esqueleto — elas também chegam com o conteúdo, e
 *  desenhá-las agora é o que faz o bloco parecer o mesmo bloco depois. */
const PAINEL = "sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel"

/** A moldura de `Cartao`, que desde a onda 91 desenha em `--raio-painel`
 *  (16px) e ganha o lustro do §3.1 do spec. São dois tokens diferentes de
 *  propósito: `PAINEL` acima copia um painel escrito à mão nas telas, que
 *  continua em 14px, e este copia o componente. Quando as telas adotarem
 *  `Cartao`, os dois viram um — enquanto forem duas coisas, mentir que são
 *  uma reintroduz o salto que este arquivo existe pra matar. */
const PAINEL_PRIMEIRO_NIVEL = "sombra-1 raio-painel painel-lustro border border-line bg-panel"

function repetir(quantos: number) {
  return Array.from({ length: Math.max(1, quantos) }, (_, i) => i)
}

export function Esqueleto({
  forma,
  itens = 4,
  saudacao = true,
  className = "",
}: {
  forma: "lista" | "ficha" | "painel"
  /** Repetições da unidade da forma: linhas na `lista`, blocos na `ficha`,
   *  cartões no `painel`. Vale a pena acertar por rota — uma lista que sempre
   *  chega com seis linhas e desenha três na espera encolhe e depois cresce,
   *  que é o mesmo salto de sempre em escala menor. */
  itens?: number
  /** Só no `painel`: a fileira "avatar + olá, fulano + nome do barco" que abre
   *  a Início. `/barco` é a mesma silhueta SEM ela (lá a foto é a primeira
   *  coisa da tela), e 40px de saudação que não chega empurrariam a foto para
   *  baixo — o salto que este componente existe para matar. */
  saudacao?: boolean
  className?: string
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      // QUEM PEDIU MENOS MOVIMENTO NÃO PODE FICAR OLHANDO TELA MORTA (achado
      // 3.5). Hoje `globals.css` zera `animation-duration` de QUALQUER seletor
      // (`*` + `!important`) sob `prefers-reduced-motion: reduce`, então o
      // `animate-pulse` dos dois esqueletos existentes simplesmente CONGELA:
      // quem ligou "reduzir movimento" recebe um bloco cinza parado, que lê
      // como tela travada, não como carregando.
      //
      // Das duas saídas possíveis — variação suave de opacidade sem
      // transformação, ou nenhum movimento mais um rótulo textual — a primeira
      // está DESCARTADA por impossibilidade, não por gosto: qualquer
      // `@keyframes` que eu declarasse aqui cairia na mesma regra wildcard e
      // congelaria igual, e `globals.css` não é deste componente para afrouxar
      // a regra (nem deveria ser — a regra wildcard está certa como piso).
      // Então: `motion-safe:` para o pulso (ele nem chega a ser declarado para
      // quem não quer movimento) e uma frase de verdade no lugar dele, lá
      // embaixo. Texto nunca congela.
      //
      // O pulso mora aqui na raiz e não em cada bloco: é uma animação só em vez
      // de N, e o painel inteiro respira junto — bloco por bloco, cada um com
      // seu próprio ciclo, vira cintilação.
      className={`motion-safe:animate-pulse ${className}`}
    >
      {forma === "lista" && <FormaLista itens={itens} />}
      {forma === "ficha" && <FormaFicha itens={itens} />}
      {forma === "painel" && <FormaPainel itens={itens} saudacao={saudacao} />}

      {/* O leitor de tela sempre ouve (o `role="status"` anuncia o conteúdo
          sozinho, sem precisar de `aria-label`). */}
      <p className="sr-only">Carregando…</p>
      {/* E quem pediu menos movimento LÊ, porque para essa pessoa é a única
          coisa na tela que se mexeu. Fica no fim, não no topo: no topo ele
          empurraria o esqueleto inteiro para baixo e a forma prometida
          começaria numa altura diferente da que o conteúdo vai ocupar —
          consertar o salto com um rótulo que causa outro salto não é conserto.
          `aria-hidden` porque o `sr-only` acima já diz a mesma frase. */}
      <p aria-hidden="true" className="apoio hidden text-dim motion-reduce:mt-3 motion-reduce:block">
        Carregando…
      </p>
    </div>
  )
}

/**
 * LISTA (§2.2) — título → `BarraFerramentas` → `LinhaLista` repetida.
 *
 * A barra de ferramentas entra SEMPRE, mesmo nas listas que ainda não a
 * adotaram: o spec §2.2 declara que a ação de criar e os filtros moram nela, e
 * as telas herdadas convergem para lá onda a onda. Desenhar a anatomia
 * declarada é o que faz a espera prometer o app que estamos construindo, em vez
 * de fossilizar o que sobrou.
 */
function FormaLista({ itens }: { itens: number }) {
  return (
    <>
      {/* ONDA 98 — as duas barras acompanham a escala nova (HAULIX §08–11):
          `.titulo-pagina` virou 24px × 1.25 = 30px (era 24 × 1.15 = 27,6, que
          é de onde vinha o `h-7`), e `.apoio` virou 12px × 1.33 = 16px (era
          12 × 1.5 = 18). Esqueleto que promete a altura antiga entrega o salto
          de layout que ele existe pra evitar. */}
      <div className={`h-[30px] w-1/2 ${TEXTO}`} />
      <div className={`mt-1 h-4 w-4/5 ${TEXTO}`} />

      {/* Medidas de `BarraFerramentas`: no celular a ação fica ACIMA e alinhada
          à direita, a fila de chips usa a largura inteira, e a partir de `lg`
          os dois trocam de lugar numa linha só.
          ONDA 98 — a fila de chips passa a copiar a NOVA anatomia do `Chip`:
          a caixa continua ocupando `--altura-controle` (o alvo de 44px, que é
          o espaço que a fila reserva no layout) e a pastilha VISÍVEL desenha
          34px centrada dentro dela. O esqueleto promete o que vai chegar — se
          ele continuasse pintando 44px de pastilha, a troca pelo conteúdo real
          produziria exatamente o salto de 10px que este componente existe pra
          matar. A ação da direita fica em 44: ela é botão, não filtro, e o §21
          põe botão large em 40–44. */}
      <div className="mt-4 flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="h-[var(--altura-controle)] w-32 shrink-0 self-end rounded-[var(--raio-pilula)] bg-panel2 lg:order-2 lg:self-auto" />
        <div className="flex gap-1.5 pb-1 lg:order-1 lg:min-w-0 lg:flex-1">
          {/* Larguras LITERAIS e não interpoladas (`w-${n}`): o Tailwind varre
              o código-fonte atrás da classe escrita, e uma classe montada em
              tempo de execução não gera CSS nenhum — mesma armadilha que
              `lib/ui/acoes.ts` e `superficies.ts` documentam. */}
          {["w-20", "w-28", "w-16"].map((w) => (
            <div key={w} className="flex h-[var(--altura-controle)] shrink-0 items-center">
              <div className={`h-[34px] ${w} rounded-[var(--raio-pilula)] bg-panel2`} />
            </div>
          ))}
        </div>
      </div>

      {/* O painel-mãe com `px-4` e as linhas separadas por `border-b`, que é a
          variante `grupo` de `LinhaLista` — a mais comum do app (Agenda,
          Tripulação, Financeiro). As listas que empilham cartões soltos
          (`/diario`) diferem por 1px de separador e alguns pixels de respiro:
          é diferença de acabamento, não de altura de linha, e nenhuma delas
          produz salto. */}
      <div className={`mt-3 px-4 ${PAINEL}`}>
        {repetir(itens).map((i) => (
          // `flex items-center gap-3 border-b border-line py-3 last:border-0`,
          // copiado de `linha-lista.tsx` sem tirar nem pôr: 12px em cima e
          // embaixo, título de 20px (`.titulo-card`, 15px × 1.35) e subtítulo
          // de 18px com `mt-0.5`. É essa soma — 74px por linha — que precisa
          // bater, porque é ela que multiplica por seis e vira o salto.
          <div key={i} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
            <div className="size-5 shrink-0 rounded-[var(--raio-pilula)] bg-panel2" />
            <div className="min-w-0 flex-1">
              <div className={`h-5 w-2/5 ${TEXTO}`} />
              <div className={`mt-0.5 h-[18px] w-3/5 ${TEXTO}`} />
            </div>
            <div className={`h-5 w-12 shrink-0 ${TEXTO}`} />
          </div>
        ))}
      </div>
    </>
  )
}

/**
 * FICHA (§2.3) — `CabecalhoDetalhe` → `Cartao` por bloco com pares
 * rótulo/valor.
 *
 * A régua de altura do cabeçalho não é óbvia e por isso está escrita: o link
 * "Voltar" tem `--altura-controle` (alvo de 44px) com `-my-2.5`, ou seja
 * devolve 20px ao layout e OCUPA 24px. Copiar o 44 aqui empurraria o título
 * 20px para baixo em toda ficha do app.
 */
function FormaFicha({ itens }: { itens: number }) {
  return (
    <>
      <div className={`h-6 w-24 ${TEXTO}`} />
      <div className={`mt-3 h-7 w-3/5 ${TEXTO}`} />
      <div className={`mt-1 h-[18px] w-4/5 ${TEXTO}`} />

      <div className="mt-4 space-y-3">
        {repetir(itens).map((i) => (
          // `Cartao`: `p-3` (12px, o degrau da escala), cabeçalho com `mb-3` e
          // — desde a onda 91 — raio de primeiro nível com lustro.
          <div key={i} className={`p-3 ${PAINEL_PRIMEIRO_NIVEL}`}>
            <div className={`mb-3 h-4 w-28 ${TEXTO}`} />
            {/* `GradeRotuloValor`: duas colunas, `gap-x-4 gap-y-3`, rótulo de
                16px (`.rotulo-dado`, 11px × 1.4) e valor de 21px (`.corpo`,
                14px × 1.5) com `mt-0.5`. */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {repetir(4).map((j) => (
                <div key={j} className="min-w-0">
                  <div className={`h-4 w-2/3 ${TEXTO}`} />
                  <div className={`mt-0.5 h-[21px] w-1/2 ${TEXTO}`} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

/**
 * PAINEL (§2.1) — assunto (a foto do barco) → cartões → instrumentos.
 *
 * É a ÚNICA forma que desenha a foto de 176px, e essa exclusividade é o
 * conserto inteiro do achado 3.2: a foto passa a aparecer só onde ela chega
 * mesmo (`/hoje` e `/barco`, os dois consumidores de `CardEmbarcacao`).
 *
 * Os instrumentos ficam no FIM, não numa faixa de KPI no topo, porque é a ordem
 * que o §2.1 declara e que a Início executa — estado e pendências primeiro, os
 * números depois. Faixa de KPI em cima é a anatomia de FICHA (`FaixaKpi`, onda
 * 79); trocar as duas seria desenhar a espera de uma tela que não é esta.
 */
function FormaPainel({ itens, saudacao }: { itens: number; saudacao: boolean }) {
  return (
    // `grid gap-3` é literalmente a `<main>` de /hoje — o respiro entre bandas
    // vem da grade, não de `mt-*` em cada bloco, senão o esqueleto e a tela
    // discordam em 12px por banda.
    <div className="grid gap-3">
      {saudacao && (
        <div className="flex items-center gap-3">
          {/* `Avatar` é `size-10` e redondo. */}
          <div className="size-10 shrink-0 rounded-[var(--raio-pilula)] bg-panel2" />
          <div className="min-w-0 flex-1">
            <div className={`h-[18px] w-20 ${TEXTO}`} />
            <div className={`mt-0.5 h-5 w-2/5 ${TEXTO}`} />
          </div>
        </div>
      )}

      {/* `CardEmbarcacao`: `h-44` no celular, `lg:h-64` no desktop, cantos em
          `--raio-cartao`. Sem borda: lá a foto sangra até a moldura
          (`overflow-hidden`), não tem linha em volta. */}
      <div className="h-44 rounded-[var(--raio-cartao)] bg-panel2 lg:h-64" />

      {/* As bandas da Início são `Cartao`, e por isso é o raio de PRIMEIRO
          NÍVEL que entra aqui — elas moram direto no fundo da página. */}
      {repetir(itens).map((i) => (
        <div key={i} className={`p-3 ${PAINEL_PRIMEIRO_NIVEL}`}>
          <div className={`mb-3 h-4 w-28 ${TEXTO}`} />
          <div className={`h-5 w-3/5 ${TEXTO}`} />
          <div className={`mt-2 h-[18px] w-2/5 ${TEXTO}`} />
        </div>
      ))}

      {/* Os instrumentos da Início: grade de dois, `gap-2`, cartões baixos. */}
      <div className="grid grid-cols-2 gap-2">
        <div className={`h-16 ${PAINEL_PRIMEIRO_NIVEL}`} />
        <div className={`h-16 ${PAINEL_PRIMEIRO_NIVEL}`} />
      </div>
    </div>
  )
}
