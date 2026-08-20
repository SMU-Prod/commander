import { escalaTopo, formatarNumero } from "./instrumento"

/**
 * GRÁFICO DE BARRAS COM TOOLTIP — o "Fleet Utilization Trend" da referência
 * (refino do `GraficoMesesGastos` que já existe). Spec §2, item 5.
 *
 * O TOOLTIP É CSS, NÃO JAVASCRIPT, e isso é decisão de arquitetura e não
 * economia: um `useState` aqui obrigaria `"use client"`, e o dia em que o
 * gráfico do Financeiro virar client component é o dia em que a página inteira
 * que o contém vira também. `group-hover` + `group-focus-within` cobrem mouse
 * E teclado; quem navega por toque não tem hover, e para essa pessoa o
 * `destaque` já deixa um tooltip aberto — que é como a própria referência
 * aparece na imagem.
 *
 * Cada barra é focável e carrega `aria-label` com as duas métricas: o gráfico
 * é uma imagem, mas os números dele não podem existir só como altura de div.
 */

export type PontoBarra = {
  rotulo: string
  valor: number
  /** A segunda métrica do tooltip ("Distância 1344,7 mi" na referência). */
  apoio?: string
  /** A barra acesa, com o tooltip já aberto. No máximo uma. */
  destaque?: boolean
}

export function GraficoBarras({
  pontos,
  cor = "var(--dado)",
  metrica = "Valor",
  sufixo = "",
  alturaClasse = "h-[140px] sm:h-[200px]",
  rotulo,
  className = "",
}: {
  pontos: PontoBarra[]
  /** ONDA 91 (achado 5.5) — O PADRÃO INVERTIDO: dourado é AÇÃO/MARCA, nunca
   *  dado (`docs/DESIGN.md` §5 reserva `--dado`/`--dado-2` para série).
   *  O componente nascia em `var(--acao)` e os QUATRO consumidores corrigiam
   *  à mão; dois deles escreveram comentário explicando que precisavam
   *  sobrescrever, citando que a onda 63 já tinha consertado esse mesmo erro
   *  no gráfico antigo. Quando 4 de 4 contornam o padrão, o errado é o
   *  padrão — e o próximo a usar herdava o defeito de graça. Nenhum pixel
   *  muda hoje: os quatro continuam passando o mesmo valor que já passavam. */
  cor?: string
  /** Nome da métrica principal dentro do tooltip. */
  metrica?: string
  /** Vai colado no número ("%", " h", " mi"). */
  sufixo?: string
  /** ONDA 91 (achado 5.4) — 200px no desktop, não 180. O spec §5 declara
   *  "altura fixa por breakpoint (140px celular / 200px desktop)";
   *  `GraficoArea`, o irmão deste, obedecia e documentava, e este usava 180
   *  sem justificativa nenhuma. Dois gráficos lado a lado com dois desktops
   *  diferentes é o achado 5.9 em outra medida. Três dos quatro consumidores
   *  passam altura própria (72px e 110px, contextos compactos justificados);
   *  quem herda o padrão é o gráfico de `/financeiro`. */
  alturaClasse?: string
  rotulo?: string
  className?: string
}) {
  const valores = pontos.map((p) => (Number.isFinite(p.valor) ? p.valor : 0))
  const topo = escalaTopo(Math.max(...valores, 0))

  return (
    <div className={`w-full ${className}`}>
      {/* `overflow-visible` não é decoração: o tooltip sai para fora da caixa
          das barras por definição, e um `overflow-hidden` herdado o cortaria
          pela metade sem erro nenhum no console. */}
      <ul
        className={`flex items-end gap-1 overflow-visible sm:gap-1.5 ${alturaClasse}`}
        aria-label={rotulo ?? "Gráfico de barras"}
      >
        {pontos.map((p, i) => {
          const altura = topo > 0 ? (Math.min(topo, Math.max(0, valores[i])) / topo) * 100 : 0
          const descricao = `${p.rotulo}: ${metrica} ${formatarNumero(valores[i])}${sufixo}${p.apoio ? `. ${p.apoio}` : ""}`
          return (
            <li
              key={`${p.rotulo}-${i}`}
              className="group flex h-full min-w-0 flex-1 items-end rounded-[var(--raio-controle)] outline-offset-4"
              tabIndex={0}
              aria-label={descricao}
            >
              {/* O `relative` mora na BARRA, não no `<li>`. No `<li>` (que tem
                  a altura inteira do gráfico) o `bottom-full` do tooltip mede
                  a partir do topo da ÁREA, e ele saía flutuando acima do
                  cartão inteiro, por cima do cartão de cima — foi o que a
                  captura v1 mostrou. Ancorado na barra, ele aparece onde a
                  referência põe: colado no topo da coluna que descreve. */}
              <div
                style={{ height: `${altura}%` }}
                className="relative mx-auto w-full max-w-[34px]"
              >
                {/* `--z-flutuante`, não um número solto (20/08, print do
                    dono): este tooltip fica sempre aberto na barra em
                    `destaque` e ROLA com a página — com `z-20` cravado ele
                    pintava por cima da bottom-nav (então `z-10`) ao rolar a
                    Início, valor flutuando sobre o menu. A escada que impede
                    a volta disso mora em `globals.css` ("CAMADAS DE
                    Z-INDEX"): flutuante de conteúdo é TETO em 20, chrome é
                    30 — tooltip nenhum tampa navegação. O z continua
                    existindo pelo motivo de sempre: sem ele, a barra vizinha
                    (posicionada) pintaria por cima do balão. */}
                <div
                  className={`pointer-events-none absolute bottom-full left-1/2 z-[var(--z-flutuante)] mb-2 min-w-max -translate-x-1/2 rounded-[var(--raio-cartao)] border border-line bg-ink px-2.5 py-2 sombra-2 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 ${p.destaque ? "opacity-100" : "opacity-0"}`}
                >
                  <p className="rotulo mb-1 text-dim">{p.rotulo}</p>
                  <p className="flex items-baseline gap-3 whitespace-nowrap">
                    <span className="apoio text-dim">{metrica}</span>
                    <span className="ml-auto tabular-nums text-sm font-semibold tabular-nums text-texto">
                      {formatarNumero(valores[i])}
                      {sufixo}
                    </span>
                  </p>
                  {p.apoio && <p className="apoio whitespace-nowrap text-dim">{p.apoio}</p>}
                </div>

                {/* ONDA 95 (achado 5.9) — OS 3px FICAM, E ISTO AQUI É A
                    EXCEÇÃO ESCRITA QUE A RÉGUA EXIGE.
                    A varredura de raio cobra token em todo arredondamento, e
                    com razão: os 12px do `xl` do Tailwind, os 8px do `lg` e os
                    10px cravados espalhados pelas telas são raios de facto que
                    ninguém declarou. (Escritos aqui por valor, e não pelo nome
                    da classe, de propósito: a contagem da auditoria é um grep,
                    e menção em comentário já inflou número neste projeto.)
                    Este não é um deles. A barra tem 34px de teto e, no celular a
                    390px, sai bem abaixo disso — `--raio-controle` (8px)
                    comeria perto de um terço da largura e a coluna deixaria de
                    ler como coluna: vira comprimido, e a comparação de altura
                    entre meses (que é o assunto inteiro do gráfico) passa a
                    disputar com a forma da ponta.
                    Os 3px também não são um quinto degrau tentando nascer: não
                    é a forma de um BLOCO, é o chanfro do topo de um traço —
                    mesma família do `strokeLinecap="round"` do `Medidor`, que
                    também não pede token de raio. Registrado em
                    `docs/DESIGN.md` §5 como a única exceção viva da escala. */}
                <div
                  style={{ backgroundColor: cor }}
                  className={`h-full w-full rounded-t-[3px] transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 ${p.destaque ? "opacity-100" : "opacity-70"}`}
                />
              </div>
            </li>
          )
        })}
      </ul>

      {/* ONDA 91 (achado 5.6) — 11px também no celular. Era `text-xs` com
          `sm:text-xs`, ou seja o rótulo de mês da Início saía UM pixel
          abaixo do piso que o `globals.css` declara ("nada abaixo de 11px") —
          e saía justamente na largura onde ler é mais difícil. Não aperta a
          fila: a 390px este eixo já esconde um rótulo sim, um não
          (`max-sm:invisible`), então cada rótulo visível tem duas fatias de
          largura pra ocupar. */}
      <div className="mt-2 flex gap-1 sm:gap-1.5" aria-hidden="true">
        {pontos.map((p, i) => (
          <span
            key={`${p.rotulo}-${i}`}
            className={`min-w-0 flex-1 truncate text-center tabular-nums text-xs leading-none tabular-nums text-dim ${i % 2 === 1 && i !== pontos.length - 1 ? "max-sm:invisible" : ""}`}
          >
            {p.rotulo}
          </span>
        ))}
      </div>
    </div>
  )
}
