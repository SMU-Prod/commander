"use client"
import { usePathname } from "next/navigation"
import { Icone } from "@/components/icone"
import { Chip, ChipLinha } from "@/components/ui/chip"
import type { ItemMenuPartner } from "@/lib/domain/partner"

/**
 * O MENU DO PARTNER — E A ÚNICA COISA QUE ELE PRECISA SER DE CLIENTE.
 *
 * O layout de `(parceiro)` monta o menu por TIPO (`menuDoPartner`, §13) e é
 * componente de SERVIDOR: ele carrega o cadastro do parceiro e decide QUAIS
 * itens existem. O que ele não tem é a rota atual — e por isso, até aqui,
 * todo item entrava com `ativo={false}`. Em toda tela do parceiro o menu
 * mostrava cinco pílulas iguais e nenhuma dizia "você está aqui", que é a
 * única informação que um menu tem obrigação de dar.
 *
 * A saída NÃO é transformar o layout inteiro em cliente: ele faz consulta ao
 * banco e é a casca de quatro telas. É esta peça pequena, no molde que o app
 * já usa duas vezes (`components/bottom-nav.tsx` e
 * `components/trilho-lateral.tsx`): `usePathname()` e mais nada. A lista
 * chega pronta do servidor porque `ItemMenuPartner` é objeto simples —
 * `{ href, rotulo, icone }`, com o ícone como NOME e não como elemento React
 * pronto, que é o que permite a lista atravessar a fronteira servidor→cliente
 * como prop serializável.
 *
 * A REGRA DE NEGÓCIO NÃO MUDA DE CASA. Quem responde "este tipo tem
 * Marketplace?" continua sendo `lib/domain/partner.ts`, puro e testável;
 * marcar qual item está aceso é apresentação — a rota atual não é regra de
 * produto, é onde o dedo parou.
 */
export function MenuParceiro({ itens }: { itens: readonly ItemMenuPartner[] }) {
  const caminho = usePathname()
  const atual = hrefAtual(itens, caminho)

  return (
    <nav aria-label="Menu do parceiro">
      <ChipLinha className="-mx-4 mb-5 px-4">
        {itens.map((i) => (
          // `Chip` já anuncia o item aceso pra leitor de tela (`aria-current`)
          // e já entrega os 44px de alvo — nada disso se reescreve aqui.
          <Chip key={i.href} href={i.href} ativo={i.href === atual}>
            <Icone nome={i.icone} className="size-4" />
            {i.rotulo}
          </Chip>
        ))}
      </ChipLinha>
    </nav>
  )
}

/**
 * QUAL ITEM ESTÁ ACESO — e por que a regra ingênua mente aqui.
 *
 * Os destinos reais de `menuDoPartner` são `/parceiro`, `/parceiro/marketplace`,
 * `/explorar`, `/parceiro/perfil` e `/parceiro/conta`. Repare no problema: o
 * item raiz, `/parceiro`, é PREFIXO dos outros três da área. Um `startsWith`
 * solto acende "Início" em todas as telas do parceiro — e como ele acende
 * junto com o item certo, a pessoa vê duas pílulas douradas e nenhuma das
 * duas responde à pergunta. Marcação que mente é pior que marcação nenhuma:
 * a de antes pelo menos não afirmava nada.
 *
 * A regra escolhida: casa quem for a rota EXATA ou o pai dela com a barra
 * junto (`/parceiro/` e não `/parceiro`, senão um futuro `/parceirosxyz`
 * acenderia por acaso — a mesma barra que `trilho-lateral.tsx` documenta), e
 * entre os que casam vence o href MAIS LONGO.
 *
 * "O mais longo" e não "exato pra raiz, prefixo pro resto" — as duas resolvem
 * o caso de hoje, mas só esta continua certa amanhã: no dia em que
 * `/parceiro/marketplace/[id]` ganhar tela dentro deste layout, a regra do
 * caso especial precisaria ser reescrita (a raiz deixaria de ser a única
 * exceção), e esta aqui já responde "Marketplace" sem tocar em nada. Uma
 * regra que só vale pra lista de hoje é a próxima marcação errada esperando
 * a lista mudar.
 *
 * Devolve `null` quando nada casa — e isso é resposta, não falha: `/explorar`
 * mora fora deste layout, então uma tela sem item correspondente deve mostrar
 * o menu inteiro apagado, não chutar o primeiro da fila.
 */
function hrefAtual(itens: readonly ItemMenuPartner[], caminho: string): string | null {
  let escolhido: string | null = null
  for (const i of itens) {
    if (caminho !== i.href && !caminho.startsWith(`${i.href}/`)) continue
    if (escolhido == null || i.href.length > escolhido.length) escolhido = i.href
  }
  return escolhido
}
