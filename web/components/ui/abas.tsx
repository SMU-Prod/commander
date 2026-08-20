import Link from "next/link"

/**
 * ONDA 58 — navegação dentro de uma tela (spec de arquitetura §2.3).
 * Estado mora na URL, não em useState: RSC continua server, voltar do
 * navegador funciona, e link é compartilhável. Anatomia única — a régua
 * "duas telas que fazem a mesma coisa parecem a mesma coisa" só vale se
 * ninguém escrever abas à mão.
 *
 * Atenção pra quem consumir: o sublinhado dourado da aba ativa é indicador
 * de NAVEGAÇÃO — onde a pessoa está —, então é dourado de MOLDURA e fica
 * FORA do orçamento de dois usos por tela (regra refinada na onda 60, ver
 * `docs/DESIGN.md` §5). O orçamento continua valendo para o dourado do
 * CONTEÚDO da tela (ação principal, chip ativo).
 *
 * ONDA 79 — A CONTAGEM ZERO VOLTOU A APARECER.
 * Até aqui `contagem > 0` escondia o número — a intenção original era "não
 * poluir com zero". A anatomia de ficha da referência (`public/imagens/*.png`,
 * aba "Alerts 0") faz o oposto: mostra o zero. E faz sentido pela mesma regra
 * de honestidade que já rege o resto do app (`docs/DESIGN.md` §6, regra 7) —
 * "Alerts 0" é a confirmação ATIVA de que não há alerta, não a ausência de
 * informação. Uma aba sem número ao lado não diz "zero", diz "não sei
 * contar isto"; são leituras diferentes, e só a primeira é verdade aqui.
 * A condição vira `contagem != null` puro — zero passa a desenhar o mesmo
 * pill que qualquer outro número.
 *
 * ONDA 79 — ROLA NA HORIZONTAL, MESMO TRATAMENTO DO `ChipLinha`.
 * Até aqui os consumidores de `Abas` nunca passavam de 2-3 abas curtas —
 * a fileira sempre coube. A ficha de equipamento (navegação de salto,
 * spec §3 item 4) passou 5, uma com contagem, e a varredura em 390px
 * (`.varredura/prova-anatomia.mjs`) pegou a fileira empurrando a PÁGINA
 * INTEIRA pra largura maior (`document.documentElement.scrollWidth` >
 * viewport) — a régua do dono é clara: "toda fileira de chip precisa
 * rolar horizontalmente". `shrink-0` em cada aba (sem ele, o flex
 * comprimia o rótulo em vez de rolar) + `overflow-x-auto`/`rolagem-lateral`
 * no `<nav>` (a MESMA máscara de desvanecer borda que `ChipLinha` usa).
 * Aditivo: fileira que já cabia continua exatamente igual — só passa a
 * existir uma capacidade de rolar que, sem estouro, nunca aciona.
 */
export function Abas({
  abas,
  ativa,
  classeAtiva = "border-accent-forte",
  pilula = false,
  className = "",
}: {
  abas: { valor: string; rotulo: string; href: string; contagem?: number }[]
  ativa: string
  /**
   * ONDA 128 — o sublinhado da aba ativa na COR DO HUB, como as imagens do
   * guia desenham dentro de cada hub (§5: cor do hub no estado ativo daquele
   * sistema). Cada página de hub passa a PRÓPRIA borda ("border-hub-motores")
   * — nunca a de outro hub, que é a regra que `lib/ui/hubs.test.ts` cobra.
   * Só a BORDA muda de cor: o texto da ativa continua `text-texto`, porque
   * tom de hub não pode virar cor de texto (corolário do §3.2 do
   * DESIGN-SYSTEM — régua de 3:1 de grafismo, não os 4,5:1 de texto).
   * Fora dos hubs, o padrão dourado continua o de sempre.
   */
  classeAtiva?: string
  /**
   * ONDA 134 — a forma de PÍLULA do mock dos hubs: aba vira cápsula, e a
   * ativa é PREENCHIDA (a página do hub passa `abaAtiva` de lib/ui/hubs —
   * fundo na cor do hub, texto da cor do chão; o contraste vem do fundo
   * claro, não de texto colorido, então o corolário do §3.2 fica de pé).
   * O sublinhado continua sendo o padrão fora dos hubs.
   */
  pilula?: boolean
  className?: string
}) {
  return (
    <nav
      aria-label="Seções desta tela"
      className={`rolagem-lateral flex overflow-x-auto ${pilula ? "gap-2" : "gap-1 border-b border-line"} ${className}`}
      style={{ scrollbarWidth: "none" }}
    >
      {abas.map((a) => {
        const ehAtiva = a.valor === ativa
        const desenho = pilula
          ? // A cápsula: mesma régua do Chip — alvo de 44px, desenho de 34px.
            `rounded-[var(--raio-pilula)] border px-3.5 ${
              ehAtiva ? classeAtiva : "border-line bg-panel2 text-dim"
            }`
          : `border-b-2 px-3 ${ehAtiva ? `${classeAtiva} text-texto` : "border-transparent text-dim"}`
        return (
          <Link
            key={a.valor}
            href={a.href}
            aria-current={ehAtiva ? "page" : undefined}
            className={`flex min-h-[var(--altura-controle)] shrink-0 items-center gap-1 whitespace-nowrap text-sm font-medium ${desenho}`}
          >
            {a.rotulo}
            {a.contagem != null && (
              <span className={`tabular-nums text-xs tabular-nums ${pilula && ehAtiva ? "" : "text-dim"}`}>{a.contagem}</span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
