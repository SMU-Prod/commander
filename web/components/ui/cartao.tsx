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
  icone, titulo, subtitulo, valor, selo, acao, peso = "secao", nivel = "painel", plano = false, className = "", children,
}: {
  icone?: NomeIcone
  titulo?: string
  /** ONDA 91 (spec haulix §3, item 3) — A LINHA QUE EXPLICA O CARTÃO.
   *  Na referência a anatomia é `ícone + título + subtítulo explicativo +
   *  ação`, e o spec nomeia o subtítulo como a peça que separa "instrumento
   *  documentado" de "caixa com rótulo": "Gastos do mês" vira "Gastos do mês
   *  / Despesas pagas nos últimos 6 meses" e o cartão passa a explicar o
   *  gráfico que já está dentro dele. Opcional, e por isso nenhum dos
   *  cartões de hoje muda de aparência sem pedir. */
  subtitulo?: string
  /** ONDA 96 (achado 3.1 da auditoria de 19/08) — A LINHA QUE É O ASSUNTO.
   *  A voz de 28px (`.valor-instrumento`) existe no CSS desde a onda 87
   *  descrita como "o número que É o assunto da tela", e tinha TRÊS usos no
   *  app inteiro, todos em Financeiro. O comentário dela avisa, por escrito,
   *  que classe declarada sem consumidor deve ser APAGADA e não deixada de
   *  enfeite. Este é o consumidor que faltava: o cartão de grau `assunto` pode
   *  dizer, em 28px, a única coisa que muda a decisão do dia — "1 vencido · 2
   *  na margem", "Tudo em dia".
   *  `ReactNode` e não `string` porque a linha é composta (o numeral vai em
   *  mono tabular e a palavra em `text-dim`, como a Saúde já escreve hoje em
   *  12px); quem monta a frase é a tela, quem decide o TAMANHO é esta prop.
   *  Renderiza fora do `<header>` de propósito — ver o comentário no corpo. */
  valor?: React.ReactNode
  selo?: React.ReactNode
  acao?: React.ReactNode
  /** ONDA 96 (achado 3.1 da auditoria de 19/08) — O GRAU DO CARTÃO, QUE É A
   *  CAUSA RAIZ DE "INFORMAÇÃO SOLTA".
   *  --------------------------------------------------------------------
   *  A auditoria mediu os OITO `<h2>` da Início — de "PRECISA DA SUA ATENÇÃO"
   *  a "ACESSO RÁPIDO" — saindo com exatamente 11px, peso 400 e o mesmo cinza
   *  (o `--texto-dim` do tema escuro). Os oito, sem exceção. Não
   *  era deriva de tela: era esta API, que escrevia `rotulo text-dim` fixo e
   *  não aceitava grau. Com o título cravado, o assunto mais crítico do
   *  produto e o atalho mais descartável vestem a mesma roupa — e "não existe
   *  o assunto da tela" é exatamente o que o dono chama de informação solta.
   *
   *  POR QUE UMA PROP E NÃO DOIS COMPONENTES (`Cartao` / `CartaoAssunto`).
   *  Duas casas para o mesmo bloco é como o app ganhou doze pílulas escritas
   *  à mão com seis alturas — a origem declarada deste componente, no topo
   *  deste arquivo. Grau é ADJETIVO do cartão, não outro objeto: muda a voz
   *  do título, não a moldura, a borda, o raio nem o comportamento. Um
   *  segundo componente teria que reexportar `icone`, `subtitulo`, `selo`,
   *  `acao`, `nivel` e `plano` e ficaria fora de sincronia na primeira prop
   *  nova — e é `nivel`/`plano`, ali embaixo, o precedente da casa: o cartão
   *  já descreve o que ele É por props ortogonais.
   *
   *  DOIS GRAUS, E NÃO TRÊS. Os dois saem da escala declarada de
   *  `docs/DESIGN.md §5` — nenhum tamanho novo:
   *    `secao`   (padrão) `.rotulo` + `text-dim` — 11px mono, caixa alta,
   *              cinza. O cartão é UMA ÁREA da tela e o título dele é
   *              etiqueta. É o que os 26 cartões de hoje já são, byte a byte,
   *              e por isso nenhuma tela muda sozinha ao ganhar esta prop.
   *    `assunto` `.titulo-card` — 15px/600 na cor do texto (a classe já
   *              carrega `color: var(--texto)`, então o grau não escreve
   *              utilitária de cor nenhuma). O cartão É o assunto da tela.
   *  O degrau do meio que faltaria seria `.corpo` (14px), e o próprio
   *  `globals.css` registra por que ele não serve: "com `.corpo` em 14 o
   *  degrau de 1px não se via… um pixel não é degrau de hierarquia, é ruído".
   *  Quem precisa de mais degrau usa o `valor` (28px), que é o terceiro nível
   *  de verdade — 11 → 15 → 28 é escada; 11 → 14 → 15 é tremor.
   *
   *  A REGRA QUE O COMPONENTE NÃO CONSEGUE COBRAR: **um `assunto` por tela.**
   *  Não há contexto de tela aqui pra checar isso, e inventar um só pra
   *  proibir seria caro pelo que compra. É a mesma natureza da regra dos dois
   *  dourados (`docs/DESIGN.md §5`), que também vive em revisão: dois assuntos
   *  na mesma tela é zero assunto, e aí a Início volta a ter oito iguais — só
   *  que em 15px. */
  peso?: "secao" | "assunto"
  /** ONDA 91 (spec haulix §3.2, achado 2.3) — O RAIO PASSA A SIGNIFICAR
   *  PROFUNDIDADE. `--raio-painel` (16px) e `.painel-lustro` foram escritos
   *  na onda 79 com o porquê e ficaram SETE ondas sem um consumidor: o app
   *  desenhava painel e sub-painel nos mesmos 14px, que é exatamente o que o
   *  spec diz que achata a hierarquia.
   *
   *  O padrão é `painel` de propósito, e não é uma escolha neutra: os
   *  consumidores atuais de `Cartao` são as bandas da Início, todas direto no
   *  fundo da página — ou seja, o padrão descreve o que elas JÁ são. Um
   *  padrão `aninhado` deixaria os dois tokens sem consumidor de novo, que é
   *  o vício que a onda 87 acabou de consertar em `.valor`.
   *
   *  Quem está DENTRO de outro painel pede `aninhado` e volta aos 14px —
   *  mesmo raciocínio de `plano`, que trata a sombra. São props separadas
   *  porque as duas coisas não andam sempre juntas: um cartão de primeiro
   *  nível pode ser chapado (é o tema escuro inteiro, ver `--sombra-1`). */
  nivel?: "painel" | "aninhado"
  plano?: boolean
  className?: string
  children: React.ReactNode
}) {
  const temCabecalho = Boolean(titulo || subtitulo || selo || acao)
  // `.raio-painel` + `.painel-lustro`, e não `rounded-[var(--raio-painel)]`
  // com o gradiente escrito aqui: as duas classes existem em globals.css com
  // a justificativa medida da referência, e passar por elas é o que impede o
  // 16 e o gradiente de 2,8% de virarem número solto neste arquivo.
  const forma = nivel === "painel"
    ? "raio-painel painel-lustro"
    : "rounded-[var(--raio-cartao)]"
  // As duas vozes de título, e nada entre elas. `.titulo-card` traz a cor
  // junto (ver `:where(...)` em globals.css) — por isso o grau de assunto NÃO
  // escreve `text-texto`: escrever seria repetir na tela uma decisão que já
  // mora na classe, que é o vício que a onda 87 fechou em `.valor`.
  const vozDoTitulo = peso === "assunto" ? "titulo-card" : "rotulo text-dim"
  return (
    <section
      // Acabamento Haulix (16/08): p-3 (12px, degrau da escala) no lugar de
      // p-4 — a referência é densa; padding folgado era metade da "cara de
      // template" que sobrava no escuro.
      className={`${forma} border border-line bg-panel p-3 ${plano ? "" : "sombra-1"} ${className}`}
    >
      {temCabecalho && (
        <header className="mb-3 flex items-center gap-2">
          {icone && <Icone nome={icone} className="size-4 shrink-0 text-dim" />}
          {/* Título e subtítulo numa coluna só, e não o subtítulo numa linha
              própria abaixo do cabeçalho inteiro: assim ele começa alinhado
              ao título mesmo quando há ícone, sem ninguém precisar repetir a
              largura do ícone como recuo. `items-center` continua na fileira
              — com duas linhas o ícone centra contra o bloco em vez da linha
              do título, e a diferença é menor que 3px nas duas tipografias;
              a alternativa (`items-start` mais uma margem no ícone) pediria
              um número diferente pra cada voz e nenhum deles seria medido. */}
          {(titulo || subtitulo) && (
            <div className="min-w-0 flex-1">
              {titulo && <h2 className={`${vozDoTitulo} truncate`}>{titulo}</h2>}
              {subtitulo && <p className="rotulo-dado mt-0.5 line-clamp-2">{subtitulo}</p>}
            </div>
          )}
          {selo}
          {acao}
        </header>
      )}
      {/* O VALOR MORA FORA DO `<header>`, e isso é decisão, não descuido.
          O cabeçalho é uma FILEIRA `items-center` com o selo e a ação na
          ponta: uma linha de 28px dentro da coluna do título esticaria a
          fileira para ~70px e a ação passaria a flutuar no meio da altura, em
          vez de alinhar com o título — o comentário logo acima já mediu que
          esse alinhamento tolera 3px de folga, não 40. Fora do cabeçalho, a
          geometria dos 26 cartões existentes continua idêntica e o número cai
          onde a auditoria pediu que ele caísse: a primeira coisa dentro do
          cartão. `mb-2` é o degrau de 8px da escala de espaçamento. */}
      {valor != null && <p className="valor-instrumento mb-2">{valor}</p>}
      {children}
    </section>
  )
}
