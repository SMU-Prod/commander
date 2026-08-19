import Link from "next/link"

/**
 * ALTERNADOR DE VISÃO — "☰ List · ⊞ Board · ⊟ Workload" da referência: um
 * segmento só, pílula de fundo com a opção ativa destacada. Spec §3, item 9.
 * Diferente de `Abas` (que é NAVEGAÇÃO entre seções distintas, sublinhado,
 * texto de tamanho normal) — isto é a MESMA seção, olhada de outro jeito, e
 * por isso o desenho é de segmento fechado, não de aba.
 *
 * Estado mora na URL (mesmo padrão de `Abas`/`Chip`) — cada opção é um
 * `<Link>`, não `useState`: RSC continua servidor, voltar do navegador
 * funciona.
 *
 * ONDA 79 — sem consumidor na ficha de equipamento pelo mesmo motivo de
 * `ColunaQuadro`: alternar "lista vs. quadro" só faz sentido pra uma
 * coleção de itens (a lista de equipamentos, não a ficha de um só). Fica
 * pronto pra tela de lista que precisar dele.
 */
export function AlternadorVisao({
  opcoes,
  ativa,
  className = "",
}: {
  opcoes: { valor: string; rotulo: string; href: string }[]
  ativa: string
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label="Alternar visualização"
      className={`inline-flex shrink-0 items-center gap-0.5 rounded-[var(--raio-pilula)] border border-line bg-panel2 p-1 ${className}`}
    >
      {opcoes.map((o) => {
        const ehAtiva = o.valor === ativa
        return (
          <Link
            key={o.valor}
            href={o.href}
            aria-current={ehAtiva ? "true" : undefined}
            // ONDA 91 (achado 5.10) — era `h-8`: 32px, 27% abaixo da régua de
            // toque de 44px que o `docs/DESIGN.md` §5 escreve sem exceção, e a
            // auditoria listou esta linha nominalmente entre as nove alturas
            // do app. Um segmento fechado É alvo: cada opção é um `<Link>` que
            // troca o que a tela mostra.
            // Custou zero em revisão de tela porque o componente ainda não tem
            // consumidor (ver o cabeçalho) — a peça entra na régua ANTES de a
            // primeira tela herdar o defeito, que é a única hora barata.
            className={`flex h-[var(--altura-controle)] items-center rounded-[var(--raio-pilula)] px-3 text-sm font-medium ${
              ehAtiva ? "sombra-1 bg-panel text-texto" : "text-dim"
            }`}
          >
            {o.rotulo}
          </Link>
        )
      })}
    </div>
  )
}
