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
   *    `secao`   (padrão) `.titulo-card` — 16px/600 (H3 do HAULIX) na cor do
   *              texto. O cartão é UMA ÁREA da tela.
   *    `assunto` `.titulo-secao` — 20px/650 (H2). O cartão É o assunto da
   *              tela.
   *  As duas classes carregam `color: var(--texto)`, então nenhum dos graus
   *  escreve utilitária de cor.
   *
   *  ONDA 98 — OS DOIS SUBIRAM UM DEGRAU, E É AÍ QUE ESTE COMENTÁRIO ESTAVA
   *  DESCREVENDO O DEFEITO COMO SE FOSSE O DESENHO. Ele dizia que `secao`
   *  entrega "`.rotulo` + `text-dim`, 11px mono caixa alta — o que os 26
   *  cartões de hoje já são, byte a byte", e tratava isso como a virtude de
   *  não mexer em tela nenhuma. Só que "os 26 cartões já são assim" É o
   *  achado: com o título do cartão vestindo etiqueta de instrumento, a tela
   *  inteira sai em 11px rastreado e o dono descreve o resultado como
   *  "informação solta", "fontes pequenas e espaçadas demais" e "tudo com o
   *  mesmo peso visual" — três frases para o mesmo pixel. Etiqueta de
   *  instrumento continua existindo e continua sendo `.rotulo`: é o overline
   *  de `SecaoPagina`, que não mudou.
   *  A escada de verdade agora é 16 → 20 → 28 (com o `valor`), e os degraus
   *  distam 4px e 8px. A anterior era 11 → 15 → 28, com o primeiro salto
   *  fazendo o trabalho de dois.
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
   *  Quem está DENTRO de outro painel pede `aninhado` e desce para os 12px do
   *  `--raio-cartao` — mesmo raciocínio de `plano`, que trata a sombra. São
   *  props separadas porque as duas coisas não andam sempre juntas: um cartão
   *  de primeiro nível pode ser chapado (é o tema escuro inteiro, ver
   *  `--sombra-1`).
   *
   *  ONDA 98 — `aninhado` PASSA A MUDAR TAMBÉM A SUPERFÍCIE (`bg-panel2`, o
   *  nível 2 do §22 do HAULIX), e não só o raio. Ver o comentário no corpo do
   *  componente: era o degrau que declarava profundidade e desenhava plano. */
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
  //
  // ONDA 98 (HAULIX §22, hierarquia de superfície) — O NÍVEL PASSA A MUDAR A
  // SUPERFÍCIE, E NÃO SÓ O RAIO. Era o buraco no meio desta camada: `nivel`
  // nasceu na onda 91 trocando raio e lustro, e os dois níveis pintavam o
  // MESMO `bg-panel`. Ou seja, o app declarava uma hierarquia de profundidade
  // e desenhava um plano só — que é exatamente o "cards cinza quase
  // idênticos" que o dono nomeou em 19/08. O §22 é literal: canvas → cartão →
  // cartão aninhado → interativo, cada um um degrau ACIMA do anterior, e "a
  // profundidade principal vem da diferença de superfície, não de sombra".
  // Custo em telas: ZERO — `nivel="aninhado"` tem hoje zero consumidores em
  // todo o `web/` (medido antes de mexer), então esta correção não muda um
  // pixel de tela nenhuma. Ela conserta o degrau para quem for usá-lo.
  const forma = nivel === "painel"
    ? "raio-painel painel-lustro bg-panel"
    : "rounded-[var(--raio-cartao)] bg-panel2"
  // ONDA 98 — AS DUAS VOZES SOBEM UM DEGRAU CADA, E É A CORREÇÃO DO DEFEITO
  // QUE O DONO NOMEOU DUAS VEZES.
  // Medido em 19/08 na Início: dos onze títulos de `Cartao` da tela, NOVE
  // saíam em `.rotulo` — 11px, mono, caixa alta, rastreada — e exatamente um
  // em `.titulo-card`. O diagnóstico do dono tem as duas metades disso:
  // "fontes pequenas e espaçadas demais" (11px + rastreio) e "tudo com o
  // mesmo peso visual" (nove iguais). Um título de cartão não é etiqueta de
  // instrumento; etiqueta de instrumento é o overline de `SecaoPagina`, que
  // continua em `.rotulo` e não muda.
  //   `secao`   → `.titulo-card`  (16/600, H3 do HAULIX) — o cartão é uma ÁREA
  //   `assunto` → `.titulo-secao` (20/650, H2)           — o cartão É o assunto
  // Quatro pixels e meio degrau de peso entre os dois: é escada, e era o que
  // faltava para "o assunto da tela" existir. As duas classes trazem a cor
  // junto (ver `:where(...)` em globals.css), por isso nenhum dos dois graus
  // escreve utilitária de cor.
  const vozDoTitulo = peso === "assunto" ? "titulo-secao" : "titulo-card"
  return (
    <section
      // Acabamento Haulix (16/08): p-3 (12px, degrau da escala) no lugar de
      // p-4 — a referência é densa; padding folgado era metade da "cara de
      // template" que sobrava no escuro.
      className={`${forma} border border-line p-3 ${plano ? "" : "sombra-1"} ${className}`}
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
