import Link from "next/link"
import { Icone } from "@/components/icone"
import type { StatusFarol } from "@/lib/domain/semaforo"
import type { Embarcacao } from "@/lib/db/types"

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
  urlCapa,
  podeEditarFotos,
  temFotos = false,
  className = "",
}: {
  embarcacao: Embarcacao
  /** Só onde não há um cartão de Saúde na mesma tela — ver o cabeçalho. */
  statusGeral?: StatusFarol
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
  const burgee = (
    <span className="flex items-center gap-1.5">
      <svg viewBox="0 0 48 34" className="h-3.5 w-auto" aria-hidden="true">
        <path d="M4 32 V10 L15 22 24 5 33 22 44 10 V32 H36 V24 L28 32 H20 L12 24 V32 Z" fill="#d4af37" />
      </svg>
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
          <div className="absolute inset-x-0 bottom-0 p-4">
            <h1 className={NOME_DO_BARCO} style={{ textShadow: "0 1px 8px rgb(11 29 45 / .8)" }}>
              {embarcacao.nome}
            </h1>
            {legendaDoBarco && <p className="apoio mt-1 text-meter-dim">{legendaDoBarco}</p>}
          </div>
          {statusGeral && <div className="absolute right-3 top-3">{selo}</div>}
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
          <div className="flex items-start gap-2">
            {burgee}
            {statusGeral && <span className="ml-auto">{selo}</span>}
          </div>
          {/* `leading-tight` (1.25 = os 30px que o §08–11 declara para o H1):
              o `text-2xl` do Tailwind traz 32px de caixa, e 2px por herói é o
              tipo de folga que ninguém escolheu. */}
          <h1 className={`${NOME_DO_BARCO} mt-2 leading-tight`}>{embarcacao.nome}</h1>
          {legendaDoBarco && <p className="apoio mt-1 text-meter-dim">{legendaDoBarco}</p>}
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
              className="foco-por-dentro transicao-ui mt-2 flex min-h-[var(--altura-controle)] items-center gap-3 rounded-[var(--raio-controle)] border border-meter-texto/20 bg-meter-texto/8 px-3 hover:bg-meter-texto/14"
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
