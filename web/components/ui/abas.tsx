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
  className = "",
}: {
  abas: { valor: string; rotulo: string; href: string; contagem?: number }[]
  ativa: string
  className?: string
}) {
  return (
    <nav
      aria-label="Seções desta tela"
      className={`rolagem-lateral flex gap-1 overflow-x-auto border-b border-line ${className}`}
      style={{ scrollbarWidth: "none" }}
    >
      {abas.map((a) => {
        const ehAtiva = a.valor === ativa
        return (
          <Link
            key={a.valor}
            href={a.href}
            aria-current={ehAtiva ? "page" : undefined}
            className={`flex min-h-[var(--altura-controle)] shrink-0 items-center gap-1 whitespace-nowrap border-b-2 px-3 text-sm font-medium ${
              ehAtiva ? "border-accent-forte text-texto" : "border-transparent text-dim"
            }`}
          >
            {a.rotulo}
            {a.contagem != null && (
              <span className="tabular-nums text-xs tabular-nums text-dim">{a.contagem}</span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
