import Link from "next/link"
import { redirect } from "next/navigation"
import { Icone, type NomeIcone } from "@/components/icone"
import { TituloTela } from "@/components/titulo-tela"
import { LinhaLista } from "@/components/ui/linha-lista"
import { contarConversasComNaoLidas } from "@/lib/consultas-mensagens"
import { ESPECIALIDADES_PRESTADOR } from "@/lib/domain/prestadores"
import { TOQUE_AMPLO } from "@/lib/ui/acoes"

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

/**
 * ONDA 7 — O CARTÃO DE ÁREA DA REDE NÁUTICA, E O QUE FALTA PARA ELE FICAR
 * IGUAL AO MOCKUP.
 * ===========================================================================
 * O mockup de 19/08 desenha Explorar, Marketplace e Prestadores como cartões
 * **com fotografia de fundo**: imagem sangrando na largura toda, título em
 * branco sobre a foto e um botão circular dourado com seta no canto inferior
 * direito. A anatomia entra inteira; **a fotografia não existe.**
 *
 * O QUE FOI CONFERIDO: `web/public/imagens/` tem exatamente dois arquivos —
 * `logoazulescuro.svg` e `novodesignmodelo.png` (o próprio mockup). Não há
 * banco de imagem no projeto, não há campo de imagem para estas três áreas em
 * lugar nenhum do domínio, e as fotos que existem no app são as do ÁLBUM DA
 * EMBARCAÇÃO, que pertencem ao dono do barco e não a um índice de serviços.
 *
 * O QUE NÃO FOI FEITO, e por quê: não inventei imagem, não usei foto de
 * terceiro e não gerei gradiente/ruído fingindo de fotografia. Um placeholder
 * que finge foto é pior que a ausência dela — ele parece pronto, ninguém manda
 * o arquivo, e o app sobe com três retângulos genéricos onde deveria haver
 * marina, barco e mecânico. As três imagens estão listadas no relatório desta
 * onda para o dono mandar.
 *
 * O QUE FICOU NO LUGAR: a MESMA anatomia com o tratamento que o app sabe
 * fazer — painel navy de primeiro nível, ícone de traço grande no topo (que é
 * o "assunto" do card, do mesmo jeito que nos oito hubs de `/barco`), título e
 * subtítulo embaixo, botão circular com a seta no canto. Trocar a área do
 * ícone por uma `<img>` no dia em que os arquivos chegarem é uma linha.
 *
 * A SETA NÃO É DOURADA, e isso não é economia — é régua. `docs/DESIGN.md` §5:
 * *"se a mesma ação aparece mais de uma vez na tela, ela não pode ser dourada
 * — por definição, a ação principal é uma só"*. São três setas idênticas; no
 * mockup, três círculos de ouro. Três usos de ouro de conteúdo numa tela cujo
 * orçamento é dois é a mesma conta que reprovou a "ação de cabeçalho de seção"
 * na onda 63. O contorno neutro que sobra é a forma que `lib/ui/acoes.ts`
 * declara para ação secundária: quem diz "aqui se toca" é a FORMA.
 */
function CartaoArea({
  href, titulo, descricao, icone,
}: {
  href: string
  titulo: string
  descricao: string
  icone: NomeIcone
}) {
  return (
    <Link
      href={href}
      /* `group` para a seta responder ao ponteiro junto com o card, e
         `hover:bg-panel2` porque apontar sobe UM nível de superfície (§49). */
      className={`painel-lustro raio-painel sombra-1 transicao-ui group flex min-h-30 flex-col justify-between gap-3 border border-line bg-panel p-4 hover:bg-panel2 ${TOQUE_AMPLO}`}
    >
      {/* A ÁREA DA ARTE — é aqui que a fotografia entra quando chegar.
          `text-dim` e não um tom por área: sem as imagens, três matizes
          inventados só para diferenciar seriam decoração escolhida no olho, e
          os oito tons `--hub-*` que existem pertencem aos hubs do BARCO —
          reusá-los aqui faria "Elétrica" e "Marketplace" dividirem uma cor.
          Neutro é o formato mais honesto enquanto o PRD de design não chega. */}
      <Icone nome={icone} className="size-10 shrink-0 text-dim" />
      <div className="flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="titulo-card">{titulo}</h2>
          <p className="apoio mt-0.5 text-dim">{descricao}</p>
        </div>
        {/* O botão circular do mockup. Não é um alvo próprio — o alvo é o card
            inteiro —, então ele pode ter os 36px do desenho: a mesma separação
            que `lib/ui/acoes.ts` documenta entre o alvo de 44 e a pílula de 30.
            `aria-hidden` porque o nome do link já é o título ao lado; uma seta
            anunciada seria "link, seta" depois de "link, Explorar". */}
        <span
          aria-hidden="true"
          className="transicao-ui flex size-9 shrink-0 items-center justify-center rounded-[var(--raio-pilula)] border border-line bg-panel2 text-dim group-hover:border-accent/40 group-hover:bg-panel3"
        >
          <Icone nome="chevron" className="size-4" />
        </span>
      </div>
    </Link>
  )
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
      {/* ONDA 7 — O "VOLTAR → MENU" SAIU, e é consequência direta da troca na
          barra de baixo: Serviços deixou de ser uma tela de detalhe alcançada
          por dentro do Menu e virou um dos cinco destinos primários. Um link de
          volta para o Menu numa aba de primeiro nível aponta para o lugar
          errado — as outras quatro abas também não têm. O caminho pelo Menu
          continua existindo (a linha "Serviços" segue lá), e o botão de voltar
          do aparelho faz o resto. */}
      <TituloTela>Serviços</TituloTela>

      {/* NENHUMA LINHA ESTÁ ATRÁS DE `painel != null`, e isso é o desenho.
          Este é o segundo dos quatro aplicativos do §1 — a rede náutica — e é
          o único bloco que não depende de embarcação: um prestador ou um
          comandante sem barco nenhum vive aqui. Condicionar a rede a ter barco
          deixaria esse público com um índice vazio.

          A ordem é a do dono, no §2.2.

          ONDA 7 — AS TRÊS PRIMEIRAS VIRAM CARTÃO; AS DUAS ÚLTIMAS FICAM LINHA.
          O recorte é o do mockup, e ele tem lógica: Explorar, Marketplace e
          Prestadores são DESTINOS — lugares onde se passa tempo procurando —,
          e o mockup os desenha com foto porque é a fotografia que vende entrar.
          Mensagens é uma caixa de entrada: o que decide abri-la é o número de
          conversas por ler, não uma imagem.
          Comandantes NÃO está no mockup, e mesmo assim fica: é uma das cinco
          áreas que o §2.2 da spec lista por escrito, e esta tela é a única
          porta dela desde que o cartão "Comandantes disponíveis" da Início
          passou a depender de haver comandante publicado. Apagá-la para copiar
          o desenho seria perder uma função por causa de uma imagem que faltou.
          Ela entra como linha, junto de Mensagens, e vai para cartão no dia em
          que houver foto — está no relatório. */}
      <div className="grid gap-3">
        <CartaoArea
          href="/explorar"
          titulo="Explorar"
          descricao="Marinas, postos, pousadas, restaurantes e lojas"
          icone="mapa"
        />
        <CartaoArea
          href="/marketplace"
          titulo="Marketplace"
          descricao="Peça profissional, tripulação, peça, vaga ou caminhão"
          icone="marketplace"
        />
        <CartaoArea
          href="/prestadores"
          titulo="Prestadores"
          descricao="Quem resolve, por especialidade"
          icone="ferramenta"
        />
      </div>

      <div className="mt-3">
        <PainelMenu>
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
      </div>
    </main>
  )
}
