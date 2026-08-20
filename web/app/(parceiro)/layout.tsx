import Link from "next/link"
import { Icone } from "@/components/icone"
import { Logo } from "@/components/logo"
import { TOQUE } from "@/lib/ui/acoes"
import { carregarMeuPartner } from "@/lib/consultas-partner"
import { menuDoPartner, ROTULO_TIPO_PARTNER } from "@/lib/domain/partner"
import { MenuParceiro } from "./menu-parceiro"

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
        <div className="text-xl"><Logo /></div>
        {meu && <span className="apoio text-dim">{ROTULO_TIPO_PARTNER[meu.parceiro.categoria]}</span>}
      </div>

      {/* ONDA 54 — QUEM AINDA NÃO TEM CADASTRO ESTAVA PRESO AQUI.
          `menuDoPartner` só devolve itens depois que o cadastro existe, e
          este layout não tem a bottom-nav do barco (decisão do §13, mantida).
          Resultado: quem tocou em "Commander Partner" no /menu do app caía
          numa tela com o logo, um formulário e NENHUM caminho de volta — sem
          botão de voltar do navegador no app instalado, o único jeito de sair
          era fechar o aplicativo. A varredura marcou as 5 telas de /parceiro
          como "SEM SAÍDA" e estava certa.
          O link só aparece enquanto não há menu: com o cadastro feito, quem
          faz esse papel é o próprio menu (que tem "Explorar", já dentro do
          app). */}
      {itens.length === 0 && (
        <Link
          href="/menu"
          className={`-ml-1 mb-4 inline-flex min-h-11 items-center gap-1 px-1 rotulo text-accent-forte ${TOQUE}`}
        >
          <Icone nome="voltar" className="size-4" /> Voltar ao Commander
        </Link>
      )}

      {/* O menu era a pílula do app copiada à mão — mesma altura, mesmo raio,
          mesmas cores —, só que com `px-3.5` (14px, fora da escala) e sem a
          confirmação de toque nem a máscara de rolagem que corta a fila com
          desvanecimento em vez de no meio da palavra. `Chip`/`ChipLinha` são a
          peça.
          A MARCAÇÃO DO ITEM ATUAL MORA EM `menu-parceiro.tsx`, e por isto:
          este layout continua sendo de servidor (ele consulta o cadastro do
          parceiro e é a casca de quatro telas), então a rota atual não chega
          aqui. Em vez de virar cliente inteiro, ele entrega a lista JÁ
          decidida por `menuDoPartner` — objetos simples `{ href, rotulo,
          icone }`, serializáveis — a uma peça de cliente que só faz
          `usePathname()`. É o mesmo arranjo de `bottom-nav`/`trilho-lateral`,
          e a regra de qual tipo tem qual item continua onde sempre esteve, em
          `lib/domain/partner.ts`. */}
      {itens.length > 0 && <MenuParceiro itens={itens} />}

      {children}
    </div>
  )
}
