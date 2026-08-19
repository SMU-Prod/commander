import { redirect } from "next/navigation"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { LinhaLista } from "@/components/ui/linha-lista"
import { contarConversasComNaoLidas } from "@/lib/consultas-mensagens"
import { ESPECIALIDADES_PRESTADOR } from "@/lib/domain/prestadores"

/**
 * ONDA 103 — O ALIAS VIRA DESTINO, E ESSE FOI O JULGAMENTO MAIS DIFÍCIL DA
 * RODADA.
 * ===========================================================================
 * O §2.1 da spec `2026-08-19-arquitetura-quatro-apps.md` fixa o menu do
 * proprietário em seis itens e o quinto é **Serviços**; o §2.2 diz o que ele
 * contém: *"Explorar · Marketplace · Prestadores · Comandantes · Mensagens"*.
 * Precisava de um endereço, e havia um `/servicos` no app — mas ele era um
 * ALIAS de compatibilidade, declarado como tal em `lib/ui/menu-destinos.test.ts`
 * numa lista cujo teste reprova qualquer alias que ganhe link.
 *
 * ---------------------------------------------------------------------------
 * A OBJEÇÃO SÉRIA, E POR QUE ELA NÃO SE APLICA
 * ---------------------------------------------------------------------------
 * O PRD consolidado §10 escreve *"Não existe aba 'Serviços'"* e o §27.2 cobra
 * como critério de aceite *"Nenhum menu principal usa a antiga aba
 * 'Serviços'"*. Foi por isso que a onda 46 esvaziou esta rota.
 *
 * A palavra que decide é **antiga**. A aba que o PRD proibiu era um SEGUNDO
 * diretório de prestadores por especialidade — a mesma lista de `/prestadores`
 * com outro nome, e é essa duplicação que o §10 desfaz ao mandar procurar
 * prestador em Explorar Parceiros. O que nasce aqui não tem uma linha daquela
 * tela: é um AGRUPADOR de navegação, com cinco portas para cinco áreas que já
 * existem e continuam sendo as donas do próprio conteúdo. Nenhum cartão de
 * especialidade, nenhuma busca, nenhuma publicação — `/prestadores` segue
 * sendo o diretório, e é uma das cinco linhas.
 *
 * E o pedido é do dono, com data e por escrito: a spec de 19/08 nomeia
 * "Serviços" como um dos seis itens do menu. Entre a nomenclatura de um PRD de
 * julho e o desenho que ele fez em agosto olhando o app pronto, vale o de
 * agosto — que é o que a própria spec declara ao substituir a anterior na
 * parte de navegação.
 *
 * ---------------------------------------------------------------------------
 * OS DOIS ENDEREÇOS QUE FORAM DESCARTADOS
 * ---------------------------------------------------------------------------
 *  · `/rede` — também é alias (redireciona pra `/comandantes`), e "Rede
 *    náutica" é como o §1 chama este aplicativo. Perde por uma razão prática:
 *    o rótulo que a pessoa lê no Menu é "Serviços", e URL que discorda do
 *    rótulo é a próxima pergunta de suporte. Além disso trocaria um alias vivo
 *    por outro — o problema não sairia do lugar.
 *  · `/ecossistema`, `/servicos-nauticos` e afins — endereço novo deixaria
 *    `/servicos` vivo como redirect órfão, ou seja, duas rotas para a mesma
 *    ideia. Pior estado do que o de hoje.
 *
 * ---------------------------------------------------------------------------
 * O QUE O ALIAS FAZIA CONTINUA FUNCIONANDO — ESSA É A CONDIÇÃO DA PROMOÇÃO
 * ---------------------------------------------------------------------------
 * O único comportamento que a onda 46 preservava era `?categoria=`: link
 * salvo, link em conversa de WhatsApp e push já enviado apontando pra
 * `/servicos?categoria=Elétrica` tinham que cair em Elétrica dentro de
 * `/prestadores`. O `redirect` abaixo continua fazendo exatamente isso, com a
 * MESMA lista curada de `lib/domain/prestadores.ts` — categoria inválida cai
 * no diretório completo em vez de propagar lixo na URL.
 *
 * O que muda é o caso SEM parâmetro: antes ele empurrava pra `/prestadores`,
 * agora abre este índice. Quem chegou por link velho continua a um toque dos
 * prestadores — e ganha as outras quatro áreas de graça. Nenhum 404, nenhuma
 * função perdida.
 *
 * A linha de `/servicos` em `SEM_PORTA_POR_DECISAO` saiu no mesmo commit: o
 * teste reprova exceção que virou mentira, e essa é a metade do guardião que
 * impede a lista de apodrecer em silêncio.
 */

/** Mesmo painel de lista do Menu e de `/meu-barco`. Escrito nas três telas em
 *  vez de virar componente porque `components/ui/` está com outro agente nesta
 *  rodada — é uma classe, não uma abstração perdida. */
function PainelMenu({ children }: { children: React.ReactNode }) {
  return <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">{children}</div>
}

export default async function ServicosPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string }>
}) {
  const { categoria } = await searchParams
  if (categoria != null) {
    const valida = (ESPECIALIDADES_PRESTADOR as readonly string[]).includes(categoria)
    redirect(valida ? `/prestadores?categoria=${encodeURIComponent(categoria)}` : "/prestadores")
  }

  // A ÚNICA CONSULTA DESTA TELA, e ela é a mesma que o Menu já faz um nível
  // acima: `contarConversasComNaoLidas` é `cache()` e reusa
  // `carregarCaixaDeEntrada`. Aqui ela alimenta a linha Mensagens; lá, a
  // linha Serviços. O número é o mesmo por construção, não por coincidência —
  // que é a regra da onda 101 aplicada entre dois níveis do índice.
  const conversasComNaoLidas = await contarConversasComNaoLidas()

  return (
    <main>
      <CabecalhoDetalhe voltarHref="/menu" voltarRotulo="Menu" titulo="Serviços" />

      {/* NENHUMA LINHA ESTÁ ATRÁS DE `painel != null`, e isso é o desenho.
          Este é o segundo dos quatro aplicativos do §1 — a rede náutica — e é
          o único bloco que não depende de embarcação: um prestador ou um
          comandante sem barco nenhum vive aqui. Condicionar a rede a ter barco
          deixaria esse público com um índice vazio.

          A ordem é a do dono, no §2.2. */}
      <PainelMenu>
        <LinhaLista href="/explorar" titulo="Explorar" subtitulo="Marinas, postos, pousadas, restaurantes e lojas" />
        <LinhaLista href="/marketplace" titulo="Marketplace" subtitulo="Peça profissional, tripulação, peça, vaga ou caminhão" />
        <LinhaLista href="/prestadores" titulo="Prestadores" subtitulo="Quem resolve, por especialidade" />
        <LinhaLista href="/comandantes" titulo="Comandantes" subtitulo="Disponíveis para contratar direto pelo WhatsApp" />
        {/* A PORTA DA CONVERSA MORA AQUI, E NÃO NA BARRA DE BAIXO. A barra tem
            cinco posições por motivo FÍSICO (71px por coluna, ver
            `components/bottom-nav.tsx`), e a decisão de 15/08 sobre a Agenda
            fechou a regra: uma sexta aba não encolhe o rótulo, encolhe todas
            as seis até nenhuma ser legível. Mensagens fica colada ao
            Marketplace porque é de lá que toda conversa nasce — a porta ao lado
            da sala que a produz.
            O número é de CONVERSAS com mensagem por ler, não de mensagens:
            "3" quer dizer "três pessoas esperando você", que é o que decide se
            vale abrir agora. Zero não desenha nada. */}
        <LinhaLista
          href="/mensagens"
          titulo="Mensagens"
          subtitulo="Conversas do Marketplace — o combinado fica registrado"
          valor={conversasComNaoLidas > 0 ? String(conversasComNaoLidas) : undefined}
          valorSecundario={conversasComNaoLidas > 0 ? "por ler" : undefined}
        />
      </PainelMenu>
    </main>
  )
}
