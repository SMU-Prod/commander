import Link from "next/link"

export type DestinoRede = "comandantes" | "prestadores" | "marketplace" | "explorar"

const DESTINOS: { valor: DestinoRede; href: string; rotulo: string }[] = [
  { valor: "comandantes", href: "/comandantes", rotulo: "Comandantes" },
  { valor: "prestadores", href: "/prestadores", rotulo: "Prestadores" },
  // Onda 45 — "Oportunidades" virou "Marketplace": o PRD FINAL (§0, §3.1,
  // §11) nomeia oficialmente a área de demandas assim, e o motivo do apelido
  // da onda 39 (evitar confusão com a vitrine de perfis) caiu quando o mesmo
  // PRD mandou a vitrine para EXPLORAR PARCEIROS.
  { valor: "marketplace", href: "/marketplace", rotulo: "Marketplace" },
  { valor: "explorar", href: "/explorar", rotulo: "Explorar" },
]

/**
 * Navegação entre as 4 telas da rede profissional do Commander (onda 39) —
 * conceitos do PRD que o nome sozinho não deixa óbvio serem diferentes
 * (ver docs/CONTRIBUTING.md, Glossário):
 * - Comandantes: vitrine de perfis pra contratar via WhatsApp (§47).
 * - Prestadores: mecânico/eletricista/fibra... perfil por especialidade,
 *   com busca por especialidade (§50).
 * - Marketplace: pedidos estruturados (profissional, tripulação, produto,
 *   vaga, caminhão) com proposta e fechamento bilateral (PRD FINAL §11).
 * - Explorar: mapa de marina/posto/pousada/restaurante (§52).
 *
 * Eram CINCO até a onda 45: "Serviços" ocupava o segundo lugar e mostrava a
 * mesma consulta de Prestadores filtrada por categoria. O PRD FINAL eliminou
 * a aba (§10, cobrado em §27.2) e o filtro foi absorvido por Prestadores —
 * ver o cabeçalho de `app/(app)/prestadores/page.tsx`. Não recrie o destino.
 *
 * Fica no topo de cada uma das 4 telas — a distinção fica visível na
 * própria interface, não só documentada. Satisfaz também o gate de
 * descoberta (nenhuma das 4 fica a mais de 1 toque das outras 3).
 *
 * `variant="mapa"` usa a paleta de instrumento (navy translúcido) pro uso
 * dentro de ExplorarMapa, flutuando por cima do canvas do Mapbox.
 */
export function RedeNav({
  atual,
  variant = "padrao",
  className = "",
}: {
  atual: DestinoRede
  variant?: "padrao" | "mapa"
  className?: string
}) {
  return (
    <nav
      aria-label="Rede de comandantes e prestadores"
      className={`flex gap-1.5 overflow-x-auto pb-1 ${className}`}
      style={{ scrollbarWidth: "none" }}
    >
      {DESTINOS.map((d) => {
        const ativo = d.valor === atual
        return (
          <Link
            key={d.valor}
            href={d.href}
            aria-current={ativo ? "page" : undefined}
            // ONDA 98 — MESMA ANATOMIA DO `Chip`: alvo de 44px no `<Link>`,
            // desenho de 34 no `<span>` (HAULIX §21, controle médio 34–36 com
            // padding 0 14). O dono nomeou "muitos filtros em formato de
            // cápsula" olhando a fila de pílulas do app, e esta é uma delas —
            // deixar só o `Chip` encolher daria duas anatomias de pílula em
            // telas vizinhas, que é a deriva que estes componentes existem pra
            // matar. A régua de toque não se move: quem a carrega é o link.
            className="flex h-[var(--altura-controle)] shrink-0 items-center"
          >
            <span
              className={`flex h-[34px] items-center whitespace-nowrap rounded-[var(--raio-pilula)] border px-3.5 text-sm font-medium ${
                ativo
                  ? "border-accent bg-accent text-acao-texto"
                  : variant === "mapa"
                    ? "border-mapa-instrumento-borda bg-mapa-instrumento text-meter-texto"
                    : "border-line bg-panel text-dim"
              }`}
            >
              {d.rotulo}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
