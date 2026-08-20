import Link from "next/link"
import { redirect } from "next/navigation"
import { CardEmbarcacao } from "@/components/card-embarcacao"
import { Farol } from "@/components/farol"
import { Icone, type NomeIcone } from "@/components/icone"
import { PatrocinioDashboard } from "@/components/publicidade/patrocinio-dashboard"
import { TituloTela } from "@/components/titulo-tela"
import { LinhaLista } from "@/components/ui/linha-lista"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import {
  abaDoEquipamento, CATEGORIA_SEGURANCA, CATEGORIAS_CASCO, CATEGORIAS_HIDRAULICA,
} from "@/lib/domain/diario"
import {
  calcularSemaforo, PESO, rotuloDoFarol, temInformacaoSuficiente, type StatusFarol,
} from "@/lib/domain/semaforo"
import {
  carregarAcessoEmbarcacoes, carregarCapaDoHeroi, carregarPainel, hojeISO, itemMonitoradoToItemCalc,
} from "@/lib/consultas"
import { mensagemDowngrade } from "@/lib/domain/assinatura-ciclo"
import { ABAS_OCORRENCIA } from "@/lib/domain/ocorrencias"
import { carregarPatrocinioDashboard } from "@/lib/consultas-publicidade"
import { podeEditar, podeVer, type Aba } from "@/lib/domain/permissoes"
import { TOQUE, TOQUE_AMPLO } from "@/lib/ui/acoes"
import { HUBS, type ChaveHub } from "@/lib/ui/hubs"
import type { ItemMonitorado } from "@/lib/db/types"

/**
 * ONDA 101 — A /barco DEIXA DE SER PÁGINA E VIRA CENTRAL TÉCNICA.
 * ===========================================================================
 * O dono navegou pelo app em 19/08 e escreveu o diagnóstico desta tela com
 * todas as letras (spec `2026-08-19-arquitetura-quatro-apps.md` §3):
 *
 *   "Ela colocou tudo numa página enorme: Motores, Elétrica, Equipamentos,
 *   Hidráulica, Segurança, Casco, Documentos, Manutenções, Ferramentas,
 *   Selos, Commander Connect, Dados cadastrais. Além disso, repete Diário,
 *   Financeiro, Documentos, Contatos e outras funções que já estão no menu.
 *   Por isso você sente que não sabe 'onde está' dentro do aplicativo."
 *
 *   "A tela Barco deveria ser apenas a central técnica, com cards grandes
 *   (…). A pessoa toca no card e entra naquele hub. Nada dessa página
 *   interminável."
 *
 * A medida do antes, tirada nesta mesma rodada em 390×844: **2879px de
 * rolagem (3,4 telas)**, 26 caixas com borda e raio, 30 SVGs, 40 links, e uma
 * fileira de oito abas com `scrollWidth 805` contra `clientWidth 358` — 55% da
 * navegação fora da tela, quatro delas anunciando "0".
 *
 * O QUE SAIU E POR QUÊ, item por item — nenhuma rota foi apagada:
 *
 * · AS OITO ABAS. Elas eram âncora de rolagem (`href="#seção"`), não recorte:
 *   prometiam trocar de assunto e entregavam rolar. Com o conteúdo virando
 *   destino, não sobra seção nenhuma nesta tela para abar — a dúvida "aba de
 *   verdade ou aba nenhuma" deixou de existir junto com as seções.
 *
 * · MOTORES, CASCO, MANUTENÇÕES. Eram seção empilhada aqui; viraram hub
 *   próprio (`/barco/motores`, `/barco/casco`, `/barco/manutencoes`), que é o
 *   que os outros cinco já eram. O Casco em particular GANHOU tela: as seis
 *   linhas de categoria daqui mostravam contagem e não abriam nada — os itens
 *   de casco só eram alcançáveis pelo Histórico ou pelo Diário.
 *
 * · FERRAMENTAS (a grade de nove). Diário, Financeiro, Carteira, Fotos e
 *   Ocorrências já estão no menu e na barra de baixo — é a repetição que o
 *   dono nomeou como causa de "não sei onde estou". Documentos virou um dos
 *   oito. Histórico, Relatórios e Contatos NÃO têm outra porta no app, então
 *   desceram para o rodapé em vez de sumir.
 *
 * · SELOS, COMMANDER CONNECT, DADOS CADASTRAIS. O dono não os pôs na lista dos
 *   oito. Connect está no menu (`menu/page.tsx`), então saiu daqui; Selos e
 *   Dados cadastrais não estão em lugar nenhum, e foram para o rodapé — Dados
 *   pela porta nova `/barco/dados`, que também guarda a Posição da marina.
 *
 * · MAPA DA EMBARCAÇÃO. Está no menu. Saiu daqui, e com ele saiu a consulta
 *   `carregarMapaDaEmbarcacao()`.
 *
 * A FILA DE CONSULTAS ENCOLHEU JUNTO, e não por acaso (ver `carregarPainel`,
 * onda 96, e o `Promise.all` da onda 100): tirar da tela o Mapa e o resumo dos
 * selos tirou três idas ao banco — `carregarMapaDaEmbarcacao`,
 * `carregarVerified` e `carregarSeloGold`. O `Promise.all` abaixo caiu de seis
 * para três. **Nenhuma consulta nova entrou**: os oito cards leem contagem e
 * farol de `painel.equipamentos`/`painel.itens`, que já estavam em mãos.
 */
export default async function BarcoPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>
}) {
  const { erro } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const { embarcacao, equipamentos, itens, permissoes } = painel
  const hoje = hojeISO()
  // As três que sobraram, em paralelo. Nenhuma depende do resultado da outra e
  // todas dependem só do que `carregarPainel` já devolveu — deixar qualquer uma
  // fora do `Promise.all` custaria uma volta inteira de rede (~150 ms até São
  // Paulo) por ordem de escrita de variável, que foi o defeito das ondas 96 e
  // 100.
  const [acesso, patrocinios, { urlCapa, temFotos }] = await Promise.all([
    carregarAcessoEmbarcacoes(),
    // §20 — a segmentação mínima é a REGIÃO, e ela vem da embarcação aberta.
    // Nula significa "não sei onde este barco está": nesse caso só entra
    // campanha sem segmentação regional (ver `segmentacaoAtende`).
    carregarPatrocinioDashboard(embarcacao.regiao_id),
    carregarCapaDoHeroi(),
  ])
  // Só avisa quando a embarcação ABERTA é uma das excedentes — um aviso
  // genérico em todo barco seria ruído pra quem está justamente no barco que
  // continua liberado.
  const avisoPlano = acesso.ativaBloqueada ? mensagemDowngrade(acesso.divisao, acesso.limite) : null

  /**
   * O PIOR FAROL DE UM CONJUNTO DE ITENS — a régua única desta tela.
   *
   * `temInformacaoSuficiente` é o MESMO filtro que /hoje, /barco/saude e o Mapa
   * da Embarcação usam pra decidir quem entra na conta; item sem intervalo nem
   * data não vota. Quando ninguém vota, o resultado é `null` — e `null` NÃO
   * pode virar `"ok"` em quem chama: verde por ausência de dado foi o defeito
   * que a onda 93 arrancou do escudo do herói e a onda 94 do mostrador do
   * motor. Aqui ele desenha o mesmo anel vazio que o `Horimetro` desenha.
   */
  const piorFarol = (dosItens: ItemMonitorado[]): StatusFarol | null =>
    dosItens
      .flatMap((i) => {
        const horas = equipamentos.find((e) => e.id === i.equipamento_id)?.horas_atuais ?? null
        const calc = itemMonitoradoToItemCalc(i)
        return temInformacaoSuficiente(calc, horas) ? [calcularSemaforo(calc, horas, hoje).status] : []
      })
      .sort((a, b) => PESO[b] - PESO[a])[0] ?? null

  // O escudo do herói: o pior farol do barco inteiro. Sem nenhum item com dado
  // real fica `null` e o escudo simplesmente NÃO é desenhado (`statusGeral` é
  // opcional em `CardEmbarcacao`) — ausência de farol lê como "ainda não sei",
  // verde lê como "está tudo bem", e só a primeira é verdade.
  const statusGeral = piorFarol(itens)

  const itensDe = (eqs: { id: string }[]) => itens.filter((i) => eqs.some((e) => e.id === i.equipamento_id))

  /**
   * OS OITO HUBS, na ordem que o dono escreveu.
   *
   * CADA FILTRO É, DÍGITO POR DÍGITO, O DA TELA DE DESTINO — é a regra que o
   * Mapa da Embarcação já documenta ("o filtro é o MESMO da tela de destino,
   * senão o número da porta discorda do que a sala mostra"). Elétrica e
   * Equipamentos leem `abaDoEquipamento` como `/barco/eletrica` e
   * `/barco/equipamentos`; Hidráulica e Segurança leem as mesmas constantes de
   * categoria que as telas delas; Casco, Documentos e Manutenções leem o mesmo
   * recorte que as três telas novas desta onda.
   *
   * A CONTAGEM ZERO APARECE, e ela é diferente de "não sei": um hub sem nada
   * cadastrado diz "Nada cadastrado" com o anel vazio, que é a confirmação
   * ativa de que não há o que mostrar. O que NUNCA aparece é farol verde num
   * hub vazio — ver `piorFarol` acima.
   *
   * ===========================================================================
   * ONDA 7 — A CONTAGEM DE INVENTÁRIO SAI; A DE ESTADO FICA.
   * ===========================================================================
   * O mockup de 19/08 desenha os oito cards **sem número nenhum**: ícone
   * grande, rótulo, e nada mais. A pergunta que ele deixa em aberto é se
   * "2 motores" e "Nada cadastrado" também caem — e a resposta não é a mesma
   * para os dois, porque eles não respondem a mesma pergunta.
   *
   * O CRITÉRIO, e ele é o do próprio princípio do sócio ("mascarando dados"):
   * **contagem que muda o que você faz hoje informa; contagem que é censo é
   * ruído.** Aplicado, dá três casos:
   *
   *   · "2 motores", "12 itens", "3 documentos" — SAEM. Ninguém abre a central
   *     técnica para descobrir quantos motores tem o próprio barco, e o número
   *     ocupava, nos oito cards, o mesmo lugar visual do único que importa.
   *   · o FAROL fica, e ganha a PALAVRA que faltava. Ele já estava lá em cor,
   *     com o estado só no `aria-label` — que é a violação literal do
   *     `docs/DESIGN.md` §6, regra 3 (*"todo estado precisa de palavra ou
   *     símbolo além da cor"*): daltônico não distinguia âmbar de vermelho. A
   *     palavra vem de `rotuloDoFarol`, do domínio, com teste — não é
   *     vocabulário novo, é o mesmo que a Saúde e o semáforo já falam.
   *   · "Nada cadastrado" fica. Hub vazio não é censo: é o único estado em que
   *     o card tem uma AÇÃO a oferecer, e a diferença entre "não tem nada" e
   *     "não sei" é a régua de honestidade que este arquivo já protege.
   *
   * E `ok` NÃO DESENHA LINHA NENHUMA. Oito "Em dia" verdes numa grade é o
   * "dashboard colorido" do §58 do HAULIX pela porta dos fundos — e a régua
   * desta casa é que o alerta é raro. O que não pede nada fica calado; o card
   * limpo É a informação de que está tudo certo ali.
   */
  const motores = equipamentos.filter((e) => e.tipo === "motor")
  const eletricos = equipamentos.filter((e) => abaDoEquipamento(e.tipo) === "eletrica")
  const outrosEquipamentos = equipamentos.filter((e) => abaDoEquipamento(e.tipo) === "equipamentos")
  const itensDoCasco = itens.filter((i) => (CATEGORIAS_CASCO as readonly string[]).includes(i.categoria ?? ""))
  const itensDaHidraulica = itens.filter((i) => (CATEGORIAS_HIDRAULICA as readonly string[]).includes(i.categoria ?? ""))
  const itensDaSeguranca = itens.filter((i) => i.categoria === CATEGORIA_SEGURANCA)
  const documentos = itens.filter((i) => i.categoria === "documento")
  const outrasManutencoes = itens.filter((i) => i.categoria === null && i.equipamento_id === null)

  /**
   * ONDA 102 — A IDENTIDADE VISUAL POR HUB, E ELA TEM DOIS CANAIS.
   * =========================================================================
   * Pedido do dono no §3 do spec de 19/08 ("cada card tem identidade visual
   * por hub"), com a régua que `docs/DESIGN.md` §5 deixou escrita e ninguém
   * tinha implementado. As três travas, e nenhuma é opcional:
   *
   *   1. O ÍCONE é o canal principal — já existia, e é o que funciona para
   *      daltônico. O tom é REFORÇO, não a informação.
   *   2. O TOM VIVE SÓ NO CARTUCHO. Nunca no fundo do card, nunca na borda do
   *      card, nunca no texto. É isso que mantém **a única cor do CORPO do
   *      card sendo a de ESTADO** — um hub violeta com farol vermelho tem que
   *      ler "vermelho" de longe, e leria "violeta" se o tom pintasse a borda.
   *   3. OS OITO SÃO DESSATURADOS (~22% medidos, contra 54–95% do ouro e dos
   *      três semânticos). Tom de hub saturado passaria a parecer estado, que
   *      é exatamente o "dashboard colorido" que o HAULIX §58 proíbe.
   *
   * O QUE EU MUDEI NA PROPOSTA ESCRITA, e por quê: ela dizia "o tom vive no
   * ícone e no cartucho dele" sem dizer que o CARTUCHO precisa existir. Não
   * existia: o ícone era um `size-6` solto no canto. Vinte e quatro pixels de
   * traço a 1,7px de espessura carregam ~90 pixels coloridos — a 390px isso
   * não registra como identidade, registra como um ícone levemente sujo. O
   * cartucho de 40px dá ao tom uma área de verdade (~1.600 px²) e, de quebra,
   * dá ao card uma âncora: a grade passa a ler como oito objetos distintos
   * antes de qualquer palavra.
   *
   * O tom sai de `--hub-*` (app/globals.css), onde estão as medições de
   * contraste e a explicação do arco de matiz. Aqui em cima só a amarração
   * hub→tom, escrita em classe LITERAL porque o Tailwind varre o código-fonte
   * atrás da classe escrita — `text-hub-${h.aba}` não geraria CSS nenhum.
   *
   * ONDA 7 — O CARTUCHO SAI E O TOM VAI DIRETO PARA O TRAÇO DO ÍCONE, e isso
   * responde à trava dos dois dourados de um jeito que o mockup sozinho não
   * responde. Ele desenha os oito ícones em OURO CHEIO: seriam oito usos de
   * dourado de conteúdo numa tela cujo orçamento é dois (`docs/DESIGN.md` §5,
   * e §07 do HAULIX — o acento é 1–3% da tela). Oito ícones de 40px em ouro
   * são, medidos, ~4% da área útil só neles, e o ouro deixaria de significar
   * "aqui se age".
   * O que entra no lugar é o que a §5 do DESIGN já tinha escrito e a onda 102
   * implementou: os oito tons dessaturados por hub. E o CARTUCHO, que existia
   * porque *"o ícone sozinho, a `size-6`, pinta ~90 pixels e não lê como
   * identidade"*, deixa de ser necessário — a 40px o mesmo traço pinta ~250
   * pixels, centrado, dominando um card de 171px. A justificativa do cartucho
   * era o tamanho do ícone; com o ícone grande do mockup, ela caduca.
   *
   * ===========================================================================
   * ONDA 104 — O TOM VOLTA A ENCOSTAR NA BORDA, E DESTA VEZ ESTÁ AUTORIZADO.
   * ===========================================================================
   * A trava nº 2 da onda 102 ("o tom NUNCA na borda do card") era uma regra da
   * casa, escrita quando os oito eram dessaturados e a única defesa contra
   * confundi-los com estado era mantê-los longe do corpo do card. O §5 do Guia
   * de Design v1 decide o contrário, e com uma condição que a trava não tinha:
   *
   *   "Bordas: 1 px, padrão [o valor que virou `--linha`]; **cor do hub apenas
   *    no estado ativo ou no card daquele sistema**."
   *
   * (O valor do padrão está escrito por extenso em `app/globals.css`, e não
   * aqui: o teto de `lib/ui/tokens.test.ts` conta cor literal por arquivo e
   * não distingue comentário de código — citar o hexadecimal numa tela subiria
   * o teto dela por causa de uma citação. A catraca está certa em ser burra;
   * quem cita é que muda.)
   *
   * A condição é o que faz funcionar. Não é "cor de hub pode aparecer no
   * corpo"; é "a cor do hub X só aparece no card do hub X". Um card de
   * Segurança com moldura verde é IDENTIDADE porque a moldura é dele; verde no
   * card de Motores seria estado, e continua proibido. Com esse recorte, o
   * corpo do card fica livre para o farol continuar sendo a única cor de
   * ESTADO — que é a coisa que a trava nº 2 existia para proteger, e ela segue
   * protegida por outro mecanismo.
   *
   * E É ASSIM QUE A GRADE DAS IMAGENS NORMATIVAS SE PARECE: oito cards com
   * moldura e halo próprios, que é o que o §1 declara normativo ("as imagens
   * conceituais são normativas para hierarquia, atmosfera, composição, cores e
   * comportamento").
   *
   * OS TRÊS CANAIS, do mais forte ao mais fraco, e nenhum deles é o texto:
   *   1. BORDA a 35% (60% ao apontar) — é a moldura do §5.
   *   2. HALO atrás do ícone a 10% — o "rim light na cor do hub" do §6, que nos
   *      renders 3D é luz e aqui, sem os assets, é um disco desfocado.
   *   3. TRAÇO DO ÍCONE na cor cheia.
   * O rótulo continua em `--texto` e o estado continua em ok/warn/crit. Tom de
   * hub não vira cor de texto — é elemento gráfico, régua de 3:1, e há teste.
   *
   * As classes são LITERAIS porque o Tailwind varre o código-fonte atrás da
   * classe escrita: `border-hub-${h.aba}/35` não geraria CSS nenhum.
   */
  /**
   * A TABELA MUDOU DE CASA NA ONDA 104, e o motivo é o §8 do guia.
   * Ela agora mora em `lib/ui/hubs.ts`, porque as OITO TELAS DE DESTINO passam
   * a ler a mesma amarração hub → ícone → tom para desenhar o cabeçalho delas
   * (`components/cabecalho-hub.tsx`). Com a tabela aqui dentro, "cada tela
   * mantém a mesma estrutura" viraria nove cópias de cinco classes literais —
   * e a nona vez que alguém escrevesse `text-hub-casco` à mão seria a vez em
   * que ele digitaria `text-hub-eletrica`. Há teste provando que cada entrada
   * só nomeia o próprio token (`lib/ui/hubs.test.ts`).
   *
   * O QUE FICA AQUI é o que só esta tela sabe: quantos itens cada hub tem e
   * qual o pior farol deles. Isso depende do que a consulta trouxe, e enfiá-lo
   * na tabela transformaria apresentação em segunda régua de domínio.
   */
  const CONTEUDO: Record<ChaveHub, { itens: ItemMonitorado[]; quantidade: number }> = {
    motores: { itens: itensDe(motores), quantidade: motores.length },
    casco: { itens: itensDoCasco, quantidade: itensDoCasco.length },
    eletrica: { itens: itensDe(eletricos), quantidade: eletricos.length },
    hidraulica: { itens: itensDaHidraulica, quantidade: itensDaHidraulica.length },
    seguranca: { itens: itensDaSeguranca, quantidade: itensDaSeguranca.length },
    equipamentos: { itens: itensDe(outrosEquipamentos), quantidade: outrosEquipamentos.length },
    documentos: { itens: documentos, quantidade: documentos.length },
    manutencoes: { itens: outrasManutencoes, quantidade: outrasManutencoes.length },
  }
  const hubs = HUBS.map((h) => ({
    ...h,
    quantidade: CONTEUDO[h.chave].quantidade,
    status: piorFarol(CONTEUDO[h.chave].itens),
  }))

  /**
   * O CAMINHO ÚNICO DE CADASTRO — a segunda queixa literal do dono: *"não sei
   * nem o que fazer, como cadastrar as coisas"*.
   *
   * Antes desta onda as entradas de cadastro estavam espalhadas por seis
   * lugares desta tela (a ação da seção Motores, a de Outras manutenções, as
   * seis pílulas "Adicionar" do Casco, o botão do estado vazio de Documentos)
   * e quatro tipos — foto, ocorrência, equipamento e contato — não tinham
   * entrada nenhuma aqui: só se chegava neles entrando primeiro na lista e
   * procurando o botão lá dentro, dois ou três toques.
   *
   * Agora é uma grade só, e todo tipo é UM toque a partir da /barco. Fica
   * DEPOIS dos oito cards de propósito: a anatomia de ficha do spec de
   * arquitetura põe as ações no fim, e quem abre a /barco no dia a dia vem
   * olhar estado, não cadastrar. Quem vem cadastrar acha uma tela abaixo, com
   * a lista inteira à vista em vez de espalhada.
   *
   * O alvo é `--altura-controle` (44px) na LINHA inteira, e não uma pílula de
   * 30px: aqui não há título competindo ao lado, então o desenho pode ser do
   * tamanho do alvo (a briga de dois números que `lib/ui/acoes.ts` descreve só
   * existe quando a ação acompanha um rótulo).
   *
   * O RECORTE É POR LISTA DE ÁREAS, e não por uma área só, porque dois destes
   * formulários aceitam VÁRIAS: "Manutenção" deixa pendurar o item em motor,
   * casco, hidráulica, segurança, equipamento ou na embarcação (é o seletor
   * "Pertence a"), e "Ocorrência" abre em qualquer setor de `ABAS_OCORRENCIA`
   * — que é a MESMA lista que o formulário filtra, não uma segunda régua.
   * Cobrar `embarcacao` nos dois esconderia a entrada de quem só edita o
   * casco, e a pessoa não veria caminho nenhum pra uma coisa que ela pode
   * fazer. Mostrar demais também não serve: quem não edita nada nenhum destes
   * setores não vê o bloco (ver a guarda no JSX).
   */
  const AREAS_DE_ITEM = [
    "embarcacao", "motores", "eletrica", "casco", "hidraulica", "seguranca", "equipamentos",
  ] as const satisfies readonly Aba[]
  const cadastros: { rotulo: string; icone: NomeIcone; href: string; abas: readonly Aba[] }[] = [
    { rotulo: "Motor", icone: "motor", href: "/barco/equipamento/novo?tipo=motor", abas: ["motores"] },
    { rotulo: "Equipamento", icone: "ferramenta", href: "/barco/equipamento/novo?tipo=outro", abas: ["equipamentos"] },
    { rotulo: "Manutenção", icone: "relogio", href: "/barco/itens/novo", abas: AREAS_DE_ITEM },
    { rotulo: "Documento", icone: "documento", href: "/barco/documentos", abas: ["documentos"] },
    { rotulo: "Foto", icone: "camera", href: "/barco/fotos", abas: ["fotos"] },
    { rotulo: "Ocorrência", icone: "alerta", href: "/barco/ocorrencias/nova", abas: ABAS_OCORRENCIA },
    { rotulo: "Contato", icone: "pessoas", href: "/barco/contatos", abas: ["contatos"] },
  ]
  const podeCadastrar = (c: { abas: readonly Aba[] }) => c.abas.some((a) => podeEditar(permissoes, a))

  return (
    <main>
      {/* O nome da área, com o filete do mockup. `/barco` abria direto na foto
          do barco: o app dizia QUAL barco antes de dizer ONDE a pessoa estava,
          e "não sei onde estou dentro do aplicativo" é a frase do dono que
          originou esta tela inteira (spec §3). "Meu Barco" é o rótulo do §2.1,
          por extenso — aqui há largura para ele, ao contrário da barra de
          baixo, que continua em "Barco" por medida física. */}
      {/* ONDA 105 — o nome da embarcação sobe para a plaqueta do título, como
          nas imagens 1, 6 e 7. Ele já existia na tela (dentro do
          `CardEmbarcacao`), então isto não acrescenta dado nenhum: muda de
          lugar, e o lugar novo é o que responde "de qual barco é esta central"
          antes de qualquer cartão. */}
      <TituloTela subtitulo={embarcacao.nome}>Meu Barco</TituloTela>

      {erro && <p className="corpo mt-3 rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      {/* §23, downgrade Commander Pro → Commander: "não apagar embarcações
          excedentes; BLOQUEAR GESTÃO das excedentes e exigir seleção da
          embarcação ativa até regularização".

          O aviso fica no topo da ficha do barco porque é aqui que a pessoa
          vem tentar gerenciar. Ele explica a pausa e diz, com todas as
          letras, que nada foi apagado — a leitura do dossiê continua inteira
          (por isso o bloqueio é um aviso, não uma parede: esconder a ficha
          seria exatamente o "apagar" que o PRD proíbe).

          Onda 102 — `raio-painel` + lustro, como todo bloco de primeiro nível
          desta tela depois desta onda. Ele estava em `--raio-cartao` (o degrau
          de "cartão ANINHADO") sobre o fundo da página. */}
      {avisoPlano && (
        <div className="painel-lustro raio-painel sombra-1 mt-3 border border-aten/40 bg-panel p-4">
          <p className="titulo-card">Gestão pausada pelo plano</p>
          <p className="apoio mt-1 text-dim">{avisoPlano}</p>
          <Link href="/menu/assinatura" className="apoio mt-3 inline-block font-semibold text-accent-forte">
            Ver planos
          </Link>
        </div>
      )}

      {/* O cabeçalho da ficha: identidade (foto real da embarcação, nome,
          marina) e estado (o escudo). O spec §5 diz que o cabeçalho de estado
          do barco só aparece em Início e Meu Barco — esta é a segunda. */}
      <CardEmbarcacao
        embarcacao={embarcacao}
        statusGeral={statusGeral ?? undefined}
        urlCapa={urlCapa}
        podeEditarFotos={podeEditar(permissoes, "fotos")}
        temFotos={temFotos}
        semNome
      />

      {/* OS OITO CARDS GRANDES.
          `grid-cols-2` é o padrão e `lg:grid-cols-4` é a exceção, nesta ordem
          e não na inversa: o defeito nº 8 da lista do dono é "a experiência
          está claramente feita primeiro para desktop, não como aplicativo
          mobile". A 390px cada card fica com 171px de largura e 120px de
          altura — grande de verdade, alvo inteiro, e os oito cabem em quatro
          fileiras sem rolagem lateral (que é o que as abas antigas pediam). */}
      <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {hubs.filter((h) => podeVer(permissoes, h.aba)).map((h) => (
          <Link
            key={h.href}
            href={h.href}
            /* ONDA 102 — O CARD DE HUB PASSA A SER PAINEL DE PRIMEIRO NÍVEL,
               COMO OS DA INÍCIO. Ele desenhava `--raio-cartao` (12px, "cartão
               ANINHADO") e nenhum lustro, enquanto todo `Cartao` de `/hoje` sai
               em `--raio-painel` (16px) + `.painel-lustro`. Os oito cards estão
               direto sobre o fundo da página — são primeiro nível pela
               definição do `docs/DESIGN.md` §5, e desenhavam o degrau de baixo.
               O lustro é os 2,8% de gradiente que o §3.1 do spec da onda 79
               mediu na referência: é ele que faz o card parecer superfície com
               luz em cima em vez de recorte de papel — metade da resposta a
               "cards cinza quase idênticos", com a outra metade no cartucho.
               `group` + `hover:bg-panel2` é o §49 ao pé da letra: apontar sobe
               UM nível de superfície (1 → 2), nunca desce.

               `.transicao-ui` e não `transition-colors`: `TOQUE_AMPLO` já pede
               `transition-transform`, e `transition-property` é UMA
               propriedade — as duas utilitárias brigam e quem ganha é a ordem
               do bundle, não quem escreveu a tela (o porquê medido está em
               `app/globals.css`, na definição da classe). A classe entrega as
               quatro propriedades, os 150ms e a curva do §49 de uma vez. */
            className={`painel-lustro raio-painel sombra-1 transicao-ui group flex min-h-30 flex-col items-center border bg-panel p-3 text-center hover:bg-panel2 ${h.borda} ${TOQUE_AMPLO}`}
          >
            {/* ONDA 7 — O ÍCONE É O ASSUNTO DO CARD: grande, centrado, no topo,
                com o rótulo embaixo. É a anatomia do mockup e é a metade que
                faltava para o card "ler como objeto" antes de qualquer palavra
                — o que o cartucho de 40px vinha fazendo por um ícone de 24.
                `flex-1 justify-center` num bloco PRÓPRIO, e não
                `justify-center` no card inteiro: assim o par ícone+rótulo cai
                no MESMO lugar nos oito, mesmo quando alguns têm linha de estado
                e outros não. Sem isso a fileira de ícones sobe e desce card a
                card, e oito quadrados deixam de ler como um painel.
                `<div>` e não `<span>`: `<a>` tem modelo de conteúdo
                transparente, e o `<h2>` aqui dentro é conteúdo de fluxo. */}
            <div className="flex flex-1 flex-col items-center justify-center gap-2">
              {/* O HALO — o "rim light na cor do hub" do §6 do guia. Nos renders
                  3D das imagens normativas ele é luz de recorte; sem os assets
                  3D (ver o desvio de biblioteca em `docs/DESIGN-SYSTEM.md`), o
                  equivalente honesto é um disco desfocado atrás do traço. É
                  `blur-md` e a 10% de propósito: ele precisa ler como luz, não
                  como um segundo cartucho — cartucho de borda dura ao lado de
                  uma moldura colorida daria DOIS retângulos por card.
                  O ícone vai num irmão `relative`, e não dentro do disco: filho
                  de elemento borrado herda o `filter`, e o traço sairia
                  desfocado junto. */}
              <span className="relative flex size-10 shrink-0 items-center justify-center">
                <span aria-hidden="true" className={`absolute inset-1 rounded-[var(--raio-pilula)] blur-md ${h.halo}`} />
                <Icone nome={h.icone} className={`relative size-10 shrink-0 ${h.tom}`} />
              </span>
              {/* `<h2>` E NÃO `<p>`, e isto é conserto de achado, não capricho: a
                  auditoria de 19/08 mediu "nenhum `<h2>` ou `<h3>` na tela
                  inteira — 23 blocos e um único `<h1>`. Para leitor de tela,
                  /barco é uma parede sem estrutura". Os oito hubs são a estrutura
                  desta tela, então são eles que viram cabeçalho de nível 2 —
                  debaixo do `<h1>` que é o título da área. Cabeçalho dentro de
                  link é válido (o modelo de conteúdo de `<a>` é transparente) e
                  `.titulo-card` já é usada em `<h2>` pelo `Cartao`. */}
              <h2 className="titulo-card">{h.rotulo}</h2>
            </div>
            {/* O RODAPÉ TEM ALTURA FIXA E FICA VAZIO NA MAIORIA DOS CARDS, e
                as duas coisas são de propósito: `h-4` reserva a linha para que
                os oito tenham a mesma geometria (senão o `flex-1` acima
                distribui folga diferente em cada um), e o silêncio é a resposta
                de um hub que não está pedindo nada. Só falam aqui os dois casos
                que mudam o que a pessoa faz hoje — o critério inteiro está na
                tabela `hubs`, lá em cima. */}
            <p className="apoio flex h-4 items-center gap-1.5 text-dim">
              {h.quantidade === 0 ? (
                <>
                  {/* Anel vazio, nunca farol: verde num hub sem nada dentro
                      diria "está tudo bem" sobre um dado que não existe. */}
                  <span
                    aria-hidden="true"
                    className="inline-block size-2 shrink-0 rounded-[var(--raio-pilula)] border border-line"
                  />
                  Nada cadastrado
                </>
              ) : h.status === "vencido" || h.status === "atencao" ? (
                <>
                  {/* Cor E palavra — a regra 3 do §6 do DESIGN. Até esta onda o
                      `Farol` vinha sozinho e o estado só existia no
                      `aria-label`: quem não distingue âmbar de vermelho lia
                      dois pontinhos iguais. */}
                  <Farol status={h.status} />
                  <span className={h.status === "vencido" ? "text-crit" : "text-warn"}>
                    {rotuloDoFarol(h.status)}
                  </span>
                </>
              ) : null}
            </p>
          </Link>
        ))}
      </div>

      {/* O cabeçalho não pode existir sem o conteúdo: um tripulante com acesso
          só de leitura filtra os sete e sobraria a palavra "Cadastrar" em cima
          do nada — que é a "porta pra sala vazia" que a regra de honestidade
          proíbe desde a onda 16. */}
      {cadastros.some(podeCadastrar) && (
        <>
          <SecaoPagina denso icone="mais">Cadastrar</SecaoPagina>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {cadastros.filter(podeCadastrar).map((c) => (
              <Link
                key={c.rotulo}
                href={c.href}
                /* Onda 102 (HAULIX §49) — a pastilha responde ao ponteiro, e
                   sobe UM nível: ela repousa em `bg-panel2` (nível 2) e vai pra
                   `bg-panel3` (nível 3). Era inerte no desktop — `TOQUE`
                   responde ao dedo, não ao mouse. */
                className={`transicao-ui flex min-h-[var(--altura-controle)] items-center gap-2 rounded-[var(--raio-controle)] border border-line bg-panel2 px-3 hover:bg-panel3 ${TOQUE}`}
              >
                <Icone nome={c.icone} className="size-4 shrink-0 text-dim" />
                <span className="corpo truncate">{c.rotulo}</span>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* O RODAPÉ DAS ROTAS QUE NÃO SÃO HUB TÉCNICO E NÃO TÊM OUTRA PORTA.
          Nenhuma delas está no menu (conferido em `menu/page.tsx`): apagá-las
          daqui as deixaria alcançáveis só digitando a URL. Linha de lista e não
          cartão, de propósito — foi a leitura da auditoria sobre os treze
          cartões idênticos ("um menu de navegação desenhado como treze cartões
          separados"), e aqui elas são exatamente isso: navegação secundária.
          Sem ícone à esquerda pelo mesmo motivo: cinco ícones cinza iguais numa
          coluna são textura, não hierarquia. */}
      {/* Sem ícone: `SecaoPagina` aceita, e aqui ele não teria trabalho nenhum
          — um símbolo cinza para "mais coisas" é decoração, e decoração em
          instrumento é o "ícone como textura" que a auditoria mediu. */}
      <SecaoPagina denso>Mais deste barco</SecaoPagina>
      {/* Onda 102 — mesmo degrau dos oito cards acima: painel de primeiro
          nível é `raio-painel` + lustro. Com os dois em 12px, a grade e o
          rodapé liam como o mesmo nível de profundidade que o cartucho de
          8px do hub — três raios a 4px um do outro é borrão, não escada. */}
      <div className="painel-lustro raio-painel sombra-1 border border-line bg-panel px-4">
        {podeVer(permissoes, "historico") && (
          <>
            <LinhaLista href="/barco/historico" titulo="Histórico" subtitulo="tudo, num lugar só" />
            <LinhaLista href="/barco/resumos" titulo="Relatórios" subtitulo="custo e uso do período, em PDF" />
          </>
        )}
        <LinhaLista
          href="/barco/selos"
          titulo="Selos Commander"
          subtitulo="Commander Verified e Commander Gold"
        />
        {podeVer(permissoes, "contatos") && (
          <LinhaLista href="/barco/contatos" titulo="Contatos" subtitulo="quem cuida do barco" />
        )}
        {podeVer(permissoes, "embarcacao") && (
          <LinhaLista
            href="/barco/dados"
            titulo="Dados cadastrais"
            subtitulo="Medidas, casco, TIE, capitania e a posição da marina"
          />
        )}
      </div>

      {/* §3.4, última linha do bloco do Dashboard: "Publicidade: no máximo
          uma unidade visível por vez, carrossel de até 5 patrocinadores,
          SEMPRE ABAIXO DA ÁREA OPERACIONAL PRIORITÁRIA."

          Continua sendo a última coisa da tela, agora com bem menos tela
          acima. O proprietário paga assinatura e ainda assim vê anúncio: é o
          que o §20 desenha, não uma liberdade tomada aqui. */}
      <PatrocinioDashboard anuncios={patrocinios} />
    </main>
  )
}
