import Link from "next/link"

export type DestinoRede = "comandantes" | "prestadores" | "servicos" | "oportunidades" | "explorar"

const DESTINOS: { valor: DestinoRede; href: string; rotulo: string }[] = [
  { valor: "comandantes", href: "/comandantes", rotulo: "Comandantes" },
  { valor: "prestadores", href: "/prestadores", rotulo: "Prestadores" },
  { valor: "servicos", href: "/servicos", rotulo: "Serviços" },
  { valor: "oportunidades", href: "/oportunidades", rotulo: "Oportunidades" },
  { valor: "explorar", href: "/explorar", rotulo: "Explorar" },
]

/**
 * Navegação entre as 5 telas da rede profissional do Commander (onda 39) —
 * cinco conceitos do PRD que o nome sozinho não deixa óbvio serem
 * diferentes (ver docs/CONTRIBUTING.md, Glossário):
 * - Comandantes: vitrine de perfis pra contratar via WhatsApp (§47).
 * - Prestadores: mecânico/eletricista/fibra... perfil por especialidade (§50).
 * - Serviços: achar quem resolve um problema — categorias + prestadores (§51).
 * - Oportunidades: mural de vagas/diárias/"COMPRO X", com resposta (§49, §53-54).
 * - Explorar: mapa de marina/posto/pousada/restaurante (§52).
 *
 * Fica no topo de cada uma das 5 telas — a distinção fica visível na
 * própria interface, não só documentada. Satisfaz também o gate de
 * descoberta (nenhuma das 5 fica a mais de 1 toque das outras 4).
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
            className={`flex h-11 shrink-0 items-center whitespace-nowrap rounded-full border px-4 text-sm font-medium ${
              ativo
                ? "border-accent bg-accent text-acao-texto"
                : variant === "mapa"
                  ? "border-mapa-instrumento-borda bg-mapa-instrumento text-meter-texto"
                  : "border-line bg-panel text-dim"
            }`}
          >
            {d.rotulo}
          </Link>
        )
      })}
    </nav>
  )
}
