import Link from "next/link"
import { Icone } from "@/components/icone"
import { Logo } from "@/components/logo"
import { carregarMeuPartner } from "@/lib/consultas-partner"
import { menuDoPartner, ROTULO_TIPO_PARTNER } from "@/lib/domain/partner"

/**
 * Layout do Commander Partner (PRD §13).
 *
 * O parceiro não é tripulante: continua sem a bottom-nav do barco. O que
 * entra aqui é o menu do §13 — e ele é POR TIPO, montado por
 * `menuDoPartner`, não uma lista fixa: §13.1 dá cinco itens ao Prestador,
 * §13.2 troca "Meu Perfil" por "Minha Loja", §13.4 chama a aba do Posto de
 * "Solicitações" e Restaurante/Pousada não têm Marketplace nenhum.
 *
 * O subtítulo mostra o TIPO REAL ("Marina", "Loja Náutica") porque é o que o
 * §13 manda: "Commander Partner" é o nome do plano, não o rótulo da tela.
 *
 * Quem ainda não tem cadastro vê o layout sem menu — o único caminho é a
 * própria tela de perfil, que é onde o cadastro nasce.
 */
export default async function ParceiroLayout({ children }: { children: React.ReactNode }) {
  const meu = await carregarMeuPartner()
  const itens = meu ? menuDoPartner(meu.parceiro.categoria) : []

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[430px] px-4 pb-10 pt-6">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div className="text-lg"><Logo /></div>
        {meu && <span className="apoio text-dim">{ROTULO_TIPO_PARTNER[meu.parceiro.categoria]}</span>}
      </div>

      {itens.length > 0 && (
        <nav
          aria-label="Menu do parceiro"
          className="-mx-4 mb-5 flex gap-1.5 overflow-x-auto px-4 pb-1"
          style={{ scrollbarWidth: "none" }}
        >
          {itens.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              className="corpo flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-panel px-3.5 text-dim"
            >
              <Icone nome={i.icone} className="size-4" />
              {i.rotulo}
            </Link>
          ))}
        </nav>
      )}

      {children}
    </div>
  )
}
