import Link from "next/link"
import { Icone } from "@/components/icone"
import type { StatusFarol } from "@/lib/domain/semaforo"
import type { Embarcacao } from "@/lib/db/types"
import { Logo } from "@/components/logo"
import { ObjetoHub } from "@/components/ui/objeto-hub"

const ROTULO: Record<StatusFarol, string> = {
  ok: "Tudo em dia",
  atencao: "Precisa de atenção",
  vencido: "Item vencido",
}

const COR: Record<StatusFarol, string> = {
  ok: "text-[#2fd07a]",
  atencao: "text-[#ffb020]",
  vencido: "text-[#ff5c5c]",
}

/**
 * O QUE O ANEL DE SAÚDE MOSTRA — e por que NÃO é a porcentagem do mockup.
 * ===========================================================================
 * O mockup de 19/08 desenha, ao lado do nome do barco, um anel dourado com
 * "86%" dentro e a linha "Saúde 86%" embaixo. A anatomia é boa e entra; **o
 * número não pode entrar, e não é opinião minha**: o PRD FINAL proíbe
 * porcentagem na Saúde em TRÊS lugares (§1.1 *"Nunca usar porcentagem para
 * 'Saúde da Embarcação'"*, §27.2, §28), `docs/DESIGN.md` §6 regra 7 repete, e
 * `lib/domain/saude.ts` conta no topo do arquivo as duas vezes em que essa
 * nota já existiu e foi arrancada. A régua de hoje é declarativa — Saudável /
 * Atenção / Ação necessária, o pior estado prevalece — e não tem denominador
 * de onde tirar 86%: `emDia / total` ignora ocorrência aberta, e itens sem
 * informação suficiente ficam fora da conta de propósito.
 *
 * O QUE ENTRA NO LUGAR: o **número de pendências**, que é o tamanho exato da
 * lista que a própria tela enumera logo abaixo, linha por linha
 * (`saude.fatores`). É contagem, nunca nota; nunca é derivado de uma divisão;
 * e `0` desenha, porque zero é uma resposta (`docs/DESIGN.md` §5, contagem,
 * regra 2). Sem dado nenhum vira "—" e o anel fica neutro — jamais verde por
 * omissão, que é a regra de honestidade que `estadoExibidoDaSaude` já protege.
 *
 * O ANEL É BEZEL, NÃO MEDIDOR — E ESSA DISTINÇÃO É O PONTO. Ele fecha os 360°
 * sempre: um arco parcial ENCODIFICA uma fração, ou seja, seria a porcentagem
 * proibida entrando pela porta do desenho depois de ser barrada na do texto.
 * O que informa é a COR (farol) e o número dentro.
 *
 * POR QUE NÃO `DonutNivel` NEM `Medidor`, que já existem. Os dois foram lidos
 * antes: o `DonutNivel` é um TANQUE — o docblock dele diz, com todas as
 * letras, que copiá-lo para um "% de conclusão" é usar a peça errada, e ele
 * exige `percentual`. O `Medidor` é um velocímetro com escala, zonas e
 * ponteiro, e exige `valor`/`max`. Nenhum dos dois desenha "estado + contagem"
 * sem que se invente o denominador que o PRD proíbe. Aqui é um `<div>` com
 * `border` e `rounded-full`: sem SVG, sem geometria, sem componente novo na
 * prateleira.
 */
export interface SaudeNoHeroi {
  /** Cor de farol do estado (`seloDaSaude`→`FAROL_ESTADO_SAUDE`). `null` = sem dados. */
  farol: StatusFarol | null
  /** A palavra do PRD §5, ou "Sem dados" — vem de `rotuloDaSaude`. */
  rotulo: string
  /** Quantas coisas pedem ação. `null` quando não há estado nenhum. */
  pendencias: number | null
  /**
   * A leitura por extenso — "1 vencido · 2 na margem · 1 ocorrência aberta",
   * exatamente as partes que `contagemDaSaude` devolve.
   *
   * ELA VEM JUNTO PORQUE O MOCKUP TEM ESSA LINHA ("Saúde 86%", embaixo do nome
   * do barco) e porque sem ela a mudança tiraria informação da tela: era o
   * corpo do cartão "Saúde" que saiu de `/hoje` nesta onda. Palavra por
   * palavra, número por número, o mesmo texto — só o chão mudou, de cartão
   * para plaqueta sobre a foto.
   */
  partes: { numero: number; rotulo: string }[] | null
  /** Para onde o toque leva: o detalhe da Saúde, ou o caminho de preenchê-la. */
  href: string
}

/** A leitura por extenso, na voz que o cartão da Saúde já usava: a fonte de
 *  instrumento é do NÚMERO, não da frase (`docs/DESIGN.md` §5). */
function LeituraDaSaude({ partes }: { partes: { numero: number; rotulo: string }[] }) {
  return (
    <p className="apoio mt-1 text-meter-dim">
      {partes.map((parte, i) => (
        <span key={parte.rotulo}>
          {i > 0 && " · "}
          <span className="tabular-nums font-semibold tabular-nums text-meter-texto">{parte.numero}</span>{" "}
          {parte.rotulo}
        </span>
      ))}
    </p>
  )
}

function AnelSaude({ farol, rotulo, pendencias, href }: SaudeNoHeroi) {
  const cor = farol ? COR[farol] : "text-meter-dim"
  return (
    /* O alvo é a coluna inteira (56 de anel + 4 + 15 de palavra = 75px de
       altura, acima dos 44 da régua) e o desenho de 56px mora dentro dele —
       a mesma separação de `lib/ui/acoes.ts`.
       `foco-por-dentro` porque o herói tem `overflow-hidden` e o anel de foco
       global é desenhado 2px PRA FORA da caixa: encostado na borda da foto ele
       cairia na faixa recortada, que é o defeito já pago no convite de foto
       trinta linhas abaixo. */
    <Link
      href={href}
      aria-label={`Saúde: ${rotulo}${pendencias != null ? ` — ${pendencias} ${pendencias === 1 ? "pendência" : "pendências"}` : ""}`}
      className="foco-por-dentro transicao-ui flex shrink-0 flex-col items-center gap-1 rounded-[var(--raio-controle)]"
    >
      {/* `border-[3px]` e não um `<svg>`: o anel fecha a volta inteira (ver o
          docblock — arco parcial seria porcentagem desenhada), e uma volta
          inteira é literalmente uma borda. `currentColor` vem do `cor` acima,
          que reusa o MESMO `COR` do escudo — as três luzes vivas do semáforo,
          já contadas no teto de cor literal deste arquivo, calibradas para
          este navy que não segue o tema do app. */}
      <span
        className={`flex size-14 items-center justify-center rounded-[var(--raio-pilula)] border-[3px] border-current ${cor}`}
      >
        <span className="tabular-nums text-lg font-semibold leading-none tabular-nums text-meter-texto">
          {pendencias ?? "—"}
        </span>
      </span>
      {/* A PALAVRA TEM LARGURA FIXA, e o motivo é medido: o vocabulário do PRD
          §5 vai de "Saudável" (9 caracteres) a "Ação necessária" (15). Solta,
          a coluna do instrumento oscilaria de ~70 a ~120px conforme o estado
          do barco — e a 390px os 50px de diferença saem do nome do barco, que
          passaria a quebrar em duas linhas só quando as coisas vão mal. Com
          `w-20` a coluna é sempre 80px e é a PALAVRA que quebra em duas
          linhas, dentro do espaço dela. `leading-tight` para as duas linhas
          caberem sob o anel sem empurrar o rodapé da foto. */}
      <span className={`rotulo block w-20 text-center leading-tight ${cor}`}>{rotulo}</span>
    </Link>
  )
}

/**
 * O HERO: a foto do barco do dono, e mais nada.
 *
 * ONDA 57 — este componente carregava, ao mesmo tempo: monograma, selo de
 * status, nome, legenda, três mini-métricas e um botão dourado. Seis
 * decisões num bloco só, que é literalmente o defeito que o dono chamou de
 * "cara de IA" (docs/DESIGN.md §1). A foto é a ÚNICA decisão assumida do
 * redesenho (§4) — ela não divide o palco com um painel de instrumentos
 * colado embaixo.
 *
 * O que saiu, e pra onde foi:
 * - as três métricas (horas de motor / próxima revisão / documentos): viraram
 *   os cartões "Motores" e "Saúde" da Início, onde cabem inteiras;
 * - o botão "Ver embarcação": o cartão "Motores" tem "Ver ficha", e o trilho
 *   e a barra de baixo têm "Barco" — eram três caminhos pro mesmo lugar.
 *
 * `statusGeral` ficou OPCIONAL: em `/hoje` o estado tem cartão próprio, com o
 * vocabulário do PRD §5 ("Saudável / Atenção / Ação necessária"). Mostrar o
 * selo aqui junto significaria duas palavras diferentes pro mesmo estado na
 * mesma tela. Em `/barco`, onde não existe esse cartão, ele continua.
 */
export function CardEmbarcacao({
  embarcacao,
  statusGeral,
  saude,
  urlCapa,
  podeEditarFotos,
  temFotos = false,
  semNome = false,
  className = "",
}: {
  embarcacao: Embarcacao
  /** ONDA 105 — some com o nome do barco no herói porque o título da tela já
   *  o diz (a plaqueta dourada de `TituloTela`). Só `/barco` passa. */
  semNome?: boolean
  /** Só onde não há um cartão de Saúde na mesma tela — ver o cabeçalho. */
  statusGeral?: StatusFarol
  /**
   * ONDA 7 (mockup de 19/08) — A SAÚDE PASSA A MORAR AO LADO DO NOME.
   *
   * Só a Início passa isto, e o motivo é o mesmo que faz `statusGeral` ser
   * opcional: dois indicadores de estado do barco na mesma tela, com
   * vocabulários diferentes, é o defeito que a onda 57 tirou daqui. Em `/hoje`
   * o anel É o estado (e o cartão "Saúde" saiu da tela junto); em `/barco`,
   * onde não existe a régua da Saúde carregada, continua valendo o escudo do
   * `piorFarol`. Passar os dois juntos é erro de chamada, não de desenho — e
   * é por isso que o JSX abaixo mostra o escudo apenas quando não há anel.
   */
  saude?: SaudeNoHeroi
  urlCapa: string | null
  podeEditarFotos: boolean
  /**
   * ONDA 97 — O CONVITE MANDAVA SUBIR FOTO PRA QUEM JÁ TINHA SUBIDO.
   *
   * Print do dono, 19/08: o álbum com uma foto dentro e o herói de /barco
   * dizendo "Adicionar foto da embarcação". O relato veio junto — "temos
   * fotos cadastradas que não aparecem na capa". O herói não estava
   * quebrado: `foto_capa_path` era NULL mesmo (conferido no banco), porque
   * subir foto NÃO define capa — são duas decisões, e a segunda nunca foi
   * pedida. Só que a tela não sabia disso e chutava a primeira, mandando
   * fazer de novo o que já estava feito.
   *
   * Com este sinal o convite passa a dizer a frase certa: sem foto nenhuma,
   * "Adicionar foto da embarcação"; com álbum cheio e capa em branco,
   * "Escolher a foto de capa" — que é o passo que de fato falta e leva ao
   * mesmo lugar. Um `boolean` e não a lista: o herói não desenha foto
   * nenhuma do álbum, só precisa saber se existe alguma.
   */
  temFotos?: boolean
  className?: string
}) {
  const legenda = [embarcacao.estaleiro, embarcacao.modelo, embarcacao.ano].filter(Boolean).join(" · ")
  /**
   * O NOME DO BARCO — a maior voz das duas telas, e ela estava fora da escada.
   *
   * ONDA 102, duas correções e as duas são de régua, não de gosto:
   *
   * · O CORPO ERA 22px. A escala tem seis degraus — 11 · 12 · 14 · 16 · 20 ·
   *   24 (mais o 28 do número) — e 22 não é nenhum deles: a sonda de 19/08
   *   mediu `22px×1` em `/hoje` e em `/barco`, o único tamanho de texto das
   *   duas telas que não sai de uma classe declarada. Vira 24 (o H1 do
   *   HAULIX §08–11), com o peso 650 que o §11 reserva a título.
   *
   * · O RASTREIO ERA `.16em`, E ESSE VALOR NÃO EXISTE MAIS. A onda 98 mediu
   *   `.16em` como a metade objetiva de *"fontes pequenas e espaçadas
   *   demais"* e baixou o degrau único da casa para `.06em` — e deixou
   *   escrito, em `app/globals.css`, que "os três lugares que escrevem
   *   `tracking-[.16em]` à mão (logo, mock da landing, HERÓI DA EMBARCAÇÃO)
   *   estão FORA desta camada e vão no relatório". Este é o herói, e este é o
   *   relatório sendo pago: em 24px, `.16em` abria 3,8px entre letras — o
   *   nome do barco deixava de ser uma palavra e virava uma fila de letras,
   *   no lugar mais visível do app. A regra da isenção (`components/logo.tsx`)
   *   sempre foi "escreve-se o MESMO valor na mão, nunca um novo"; o mesmo
   *   valor, hoje, é `.06em`.
   *
   * Continua escrito à mão, e não em `.rotulo`, pelo motivo de sempre: a
   * classe CRAVA `font-size: 11px` e a Mono junto, e aqui o corpo é o título
   * do herói em Inter.
   */
  const NOME_DO_BARCO = "text-2xl font-[650] uppercase tracking-[.06em] text-meter-texto"
  const legendaDoBarco = [embarcacao.marina, legenda].filter(Boolean).join(" · ")
  /**
   * ONDA 111 — O SELO DO HERÓI TINHA DOIS DEFEITOS NA MESMA LINHA.
   * ==========================================================================
   * 1. Era o MONOGRAMA ANTIGO, escrito à mão em `<path>` — o mesmo que estava
   *    no topo do trilho, e o motivo do *"ainda tem lugar usando o logo
   *    antigo"* do dono. A identidade aprovada é `public/logo-commander.svg`.
   * 2. E cravava o DOURADO ANTERIOR em hexadecimal. O ouro da marca mudou de
   *    valor na onda 104 (§4 do guia) — então o selo do herói vinha saindo num
   *    ouro que nenhum outro pixel do app usa, na peça de identidade mais
   *    visível da Início. Duas cores de marca lado a lado é pior do que uma
   *    errada: lê como erro de renderização.
   * O `<img>` do `Logo` resolve os dois: símbolo certo, e a cor vem de dentro
   * do arquivo da marca em vez de ser recopiada aqui.
   * (Os dois valores NÃO estão escritos neste comentário de propósito: o teto
   * de `lib/ui/tokens.test.ts` conta cor literal por arquivo e não distingue
   * comentário de código — citar o hexadecimal subiria o teto por causa de uma
   * citação. A catraca está certa em ser burra; quem cita é que muda.)
   */
  const burgee = (
    <span className="flex items-center gap-1.5 text-[14px]">
      <Logo compacto />
      <span className="rounded-[var(--raio-pilula)] bg-[#0b1d2d]/75 px-2 py-0.5 rotulo text-meter-texto backdrop-blur">
        Commander
      </span>
    </span>
  )
  const selo = statusGeral && (
    <div className="flex items-center gap-1.5 rounded-[var(--raio-pilula)] bg-[#0b1d2d]/80 px-2.5 py-1.5 backdrop-blur">
      <Icone nome="escudo" className={`size-3.5 ${COR[statusGeral]}`} />
      <span className={`rotulo ${COR[statusGeral]}`}>{ROTULO[statusGeral]}</span>
    </div>
  )
  return (
    /* `sombra-1` e não `sombra-2`: a elevação flutuante é reservada ao que de
       fato paira sobre outra coisa — bottom sheet, menu, pastilha sobre o
       mapa (docs/DESIGN.md §5). A foto está encostada na página como
       qualquer cartão. Sombra funda em elemento que não flutua é, ao pé da
       letra, um dos sintomas que o §1 lista como "cara de IA".
       ONDA 102 — `raio-painel` (16px) e não `--raio-cartao` (12px): o herói
       está direto sobre o fundo da página, e o §5 é explícito — 12 é "cartão
       ANINHADO", 16 é "quem contém e está no primeiro nível". Em `/hoje` ele
       desenhava 12px encostado em nove `Cartao` de 16, e o raio, que existe
       pra significar profundidade, dizia que o herói estava DENTRO de algo. */
    <div className={`sombra-1 raio-painel overflow-hidden ${className}`}>
      {urlCapa ? (
        /* COM FOTO, A FOTO CRESCE. Era `h-44 lg:h-64` — a MESMA altura do
           convite vazio, ou seja, o barco do dono valia exatamente o que vale
           um botão. O dono escreveu "fotos reais da embarcação" na lista do
           que o app precisa ter (spec §4) e "quase nenhuma fotografia náutica"
           na lista do que está errado. A proporção agora diz isso: 192px de
           foto contra ~148px de convite no celular, 288 contra ~176 em `lg`. */
        <div className="relative bg-[#0b1d2d]">
          {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada e temporária do storage */}
          <img src={urlCapa} alt={`Foto de ${embarcacao.nome}`} className="h-48 w-full object-cover lg:h-72" />
          {/* Véu do topo: garante leitura do selo e do monograma sobre foto clara */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-16"
            style={{ backgroundImage: "linear-gradient(to bottom, rgb(11 29 45 / .55), rgb(11 29 45 / 0))" }}
          />
          {/* Véu de baixo — as paradas do canvas (tela-1b): 120px, denso na
              base pro nome ler sobre casco branco no sol, esvaziando mais cedo
              que a versão anterior pra foto respirar no meio do herói. */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[120px]"
            style={{
              backgroundImage:
                "linear-gradient(to top, rgb(11 29 45 / .96) 0%, rgb(11 29 45 / .86) 34%, rgb(11 29 45 / .45) 66%, rgb(11 29 45 / 0) 100%)",
            }}
          />
          <span className="absolute left-3 top-3">{burgee}</span>
          {/* ONDA 7 — NOME E ANEL NA MESMA LINHA, que é a anatomia do mockup.
              `items-end` alinha a base do anel com a base da legenda: o nome
              cresce pra cima quando quebra em duas linhas, e o instrumento
              continua ancorado no rodapé da foto. */}
          <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 p-4">
            <div className="min-w-0 flex-1">
              {/* ONDA 7 — `<h2>` E NÃO `<h1>`. As duas telas que desenham o
                  herói (`/hoje` e `/barco`) ganharam nesta onda o título de
                  tela do mockup ("Início", "Meu Barco"), que é o `<h1>` delas.
                  Dois `<h1>` na mesma página deixam o leitor de tela sem saber
                  qual é o assunto — e o nome do barco é, de fato, um nível
                  abaixo do nome da área. */}
              <h2 className={NOME_DO_BARCO} style={{ textShadow: "0 1px 8px rgb(11 29 45 / .8)" }}>
                {embarcacao.nome}
              </h2>
              {legendaDoBarco && <p className="apoio mt-1 text-meter-dim">{legendaDoBarco}</p>}
              {saude?.partes && <LeituraDaSaude partes={saude.partes} />}
            </div>
            {saude && <AnelSaude {...saude} />}
          </div>
          {statusGeral && !saude && <div className="absolute right-3 top-3">{selo}</div>}
        </div>
      ) : (
        /* SEM FOTO, O HERÓI DEIXA DE SER UMA MOLDURA VAZIA E VIRA A PLAQUETA.
           ---------------------------------------------------------------
           O que estava errado, medido a 390px: o convite ocupava 176px — a
           MESMA altura da foto — para dizer uma frase e oferecer um botão.
           Dentro desses 176px, 104 eram padding (`pt-10 pb-16`) existindo só
           para o bloco ter forma de fotografia. O dono nomeou isto duas vezes
           na mesma lista: "grandes áreas vazias" e "quase nenhuma fotografia
           náutica" — e a moldura vazia é o oposto das duas.
           A altura agora é a do CONTEÚDO (~148px), o alinhamento é à esquerda
           como o de uma plaqueta, e a hierarquia do herói passa a ser a certa:
           primeiro quem é o barco (nome, marina, modelo), depois o convite.
           O CONVITE CONTINUA SEM DOURADO. O orçamento da Início é dois
           (docs/DESIGN.md §5) e já tem dono: o burgee (marca) e "Registrar
           saída" (a ação principal). Ele veste os tokens do cartucho escuro
           (`--meter-texto` sobre véu translúcido, os mesmos nos dois temas
           porque esta área é navy fixo): legível e clicável, sem gritar. */
        /* `px-4 py-3` e não `p-4`: 16px na horizontal porque é a margem que faz
           a coluna do nome ler como plaqueta, 12px na vertical porque é o
           degrau que `Cartao` usa e porque cada 4px aqui é 4px que o barco
           vazio rouba do primeiro cartão de conteúdo. Medido a 390px: o herói
           sem foto sai em ~153px contra os 176 de antes (-13%), e contra os
           192 da versão COM foto — que é a proporção que o dono pediu para
           rever, e ela agora aponta para o lado certo. */
        <div
          className="relative bg-[#0b1d2d] px-4 py-3"
          style={{ backgroundImage: "radial-gradient(ellipse 120% 80% at 15% 0%, #16324a 0%, #0b1d2d 72%)" }}
        >
          {/* ONDA 119 — O IATE HOLOGRÁFICO ATRÁS DA PLAQUETA. É o estado "sem
              foto" que a IMAGEM 1 do guia desenha: o render estilizado no
              lugar onde a foto real vai entrar — a "ilustração técnica neutra"
              do §3.5 do PRD, nunca uma foto fingindo ser o barco da pessoa.
              O véu `from-meter/85` garante a leitura da plaqueta por cima; os
              filhos seguintes ganham `relative` pela ordem de pintura (irmão
              `absolute` anterior fica atrás). Quando a pessoa sobe a foto
              real, este ramo inteiro dá lugar ao ramo com foto — render e
              foto nunca aparecem juntos (§10 do guia). */}
          <ObjetoHub chave="iate" className="absolute inset-0 h-full w-full !rounded-none opacity-80" />
          <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-meter/90 via-meter/40 to-meter/10" />
          <div className="relative flex items-start gap-2">
            {burgee}
            {statusGeral && !saude && <span className="ml-auto">{selo}</span>}
          </div>
          {/* Sem foto o anel fica na MESMA linha do nome, e não no canto de
              cima: aqui não há fotografia para o instrumento pousar em cima —
              ele é parte da plaqueta, colado ao que ele descreve. */}
          <div className="relative flex items-end gap-3">
            <div className="min-w-0 flex-1">
              {/* `leading-tight` (1.25 = os 30px que o §08–11 declara para o H1):
                  o `text-2xl` do Tailwind traz 32px de caixa, e 2px por herói é o
                  tipo de folga que ninguém escolheu.
                  `<h2>` pelo mesmo motivo do ramo com foto, trinta linhas
                  acima: o `<h1>` da tela agora é o título da área. */}
              {/* ONDA 105 — O NOME SAI DAQUI QUANDO O TÍTULO DA TELA JÁ O DIZ.
                  Nas imagens 1, 6 e 7 o nome da embarcação aparece UMA vez, na
                  plaqueta dourada abaixo de "Meu Barco", e o herói é só a foto.
                  Em `/barco` o `TituloTela` passou a desenhar essa plaqueta —
                  manter o `<h2>` aqui deixava "Barco de Teste" duas vezes em
                  120px de tela, que é ruído com cara de bug. Em `/hoje` o
                  título da área é "Início" e não diz barco nenhum, então lá o
                  nome continua aqui, que é onde ele responde "qual barco". */}
              {!semNome && <h2 className={`${NOME_DO_BARCO} mt-2 leading-tight`}>{embarcacao.nome}</h2>}
              {legendaDoBarco && <p className={`apoio text-meter-dim ${semNome ? "mt-2" : "mt-1"}`}>{legendaDoBarco}</p>}
              {saude?.partes && <LeituraDaSaude partes={saude.partes} />}
            </div>
            {saude && <AnelSaude {...saude} />}
          </div>
          {podeEditarFotos ? (
            <Link
              href="/barco/fotos"
              /* `foco-por-dentro` (app/globals.css) porque o cartão em volta
                 tem `overflow-hidden` e o anel global é desenhado 2px PRA FORA
                 da caixa: nas bordas do herói ele caía na faixa recortada e
                 não pintava um pixel (medido: 0 de 74.088 mudavam). Continua
                 valendo aqui — o padding de 16px daria folga, mas a régua é do
                 CARTÃO, não deste elemento, e um `mt` diferente amanhã traria
                 o defeito de volta sem ninguém perceber.
                 O ALVO É A LINHA INTEIRA (48px de altura útil, acima dos 44 da
                 régua) e o desenho é o cartucho de 32px por dentro — a mesma
                 separação de `lib/ui/acoes.ts`. */
              /* O VÉU SAI DE TOKEN, E NÃO É DETALHE DE CONTABILIDADE. Ele era
                 escrito à mão em notação funcional, com os três canais do
                 claro-azulado — que são, dígito por dígito, os do
                 `--meter-texto` do tema CLARO. Ou seja: a peça já pedia o
                 token e escrevia o valor dele. Com `bg-meter-texto/8`, o véu
                 passa a acompanhar o branco QUENTE do tema escuro em vez de
                 ficar preso ao azulado do claro — a mesma correção que a onda
                 98 fez no resto do app. Quatro cores literais a menos aqui. */
              className="foco-por-dentro transicao-ui relative mt-2 flex min-h-[var(--altura-controle)] items-center gap-3 rounded-[var(--raio-controle)] border border-meter-texto/20 bg-meter-texto/8 px-3 hover:bg-meter-texto/14"
            >
              <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-[var(--raio-controle)] bg-meter-texto/12 text-meter-texto">
                <Icone nome="camera" className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="corpo block font-semibold text-meter-texto">
                  {temFotos ? "Escolher a foto de capa" : "Adicionar foto da embarcação"}
                </span>
                {/* A frase de motivo fica: ela é o que faz alguém sair do sofá,
                    e o custo dela agora são 16px numa linha de duas, não uma
                    terceira fileira centralizada dentro de uma moldura vazia. */}
                <span className="apoio block text-meter-dim">
                  {temFotos ? "Você já tem fotos — falta dizer qual abre o app" : "É ela que abre o seu Commander"}
                </span>
              </span>
              <Icone nome="chevron" className="ml-auto size-4 shrink-0 text-meter-dim" />
            </Link>
          ) : (
            <p className="apoio mt-2 flex items-center gap-2 text-meter-dim">
              <Icone nome="camera" className="size-4 shrink-0" />
              Sem foto de capa
            </p>
          )}
        </div>
      )}
    </div>
  )
}
