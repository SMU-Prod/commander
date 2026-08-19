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
  icone, titulo, subtitulo, selo, acao, nivel = "painel", plano = false, className = "", children,
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
  selo?: React.ReactNode
  acao?: React.ReactNode
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
              {titulo && <h2 className="rotulo truncate text-dim">{titulo}</h2>}
              {subtitulo && <p className="rotulo-dado mt-0.5 line-clamp-2">{subtitulo}</p>}
            </div>
          )}
          {selo}
          {acao}
        </header>
      )}
      {children}
    </section>
  )
}
