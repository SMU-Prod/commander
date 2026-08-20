"use client"

import { useFormStatus } from "react-dom"
import { TOQUE, TOQUE_AMPLO } from "@/lib/ui/acoes"
import { ACAO_NAO_ESTICA } from "@/lib/ui/superficies"

/**
 * ONDA 85 — O APP AVISA QUE ESTÁ ENVIANDO.
 *
 * A auditoria de 19/08/2026 (§3.3) mediu o silêncio: `useTransition`,
 * `isPending` e `useFormStatus` aparecem **zero vezes** no repositório, e de
 * **73 arquivos com formulário só 2** mostram qualquer sinal de envio — os
 * dois com `useState` à mão, dentro de componente de mapa.
 *
 * O que isso significa na mão de quem usa: numa server action que demora de
 * verdade (upload de comprovante, foto de ocorrência, 15 campos do barco), a
 * pessoa toca em "Salvar", **nada muda na tela**, e ela toca de novo. Em
 * vários desses formulários o segundo toque grava duas vezes. O defeito não é
 * estético: é um registro duplicado no Diário e um lançamento duplicado no
 * Financeiro.
 *
 * ONDE ESTE COMPONENTE PODE MORAR — o detalhe que mata a peça se for ignorado:
 * `useFormStatus` lê o estado do `<form>` **ancestral**. Ele só enxerga o
 * formulário quando quem chama o hook está DENTRO do `<form>`, num componente
 * próprio. Chamado no MESMO componente que renderiza o `<form>`, o hook
 * devolve `pending: false` para sempre — o botão nunca muda, nada quebra, e o
 * bug só aparece na mão do dono. Por isso o vestido do envio é um COMPONENTE
 * e não um par de classes: `<BotaoEnviar>` entra como filho do `<form>`, e
 * quem escreve a tela não tem como errar o lugar.
 *
 * A ALTURA NÃO É NOVA, DE PROPÓSITO. O app já teve exatamente esse defeito
 * com a pílula de filtro — seis alturas para o mesmo gesto, documentado em
 * `chip.tsx`. Aqui a régua é a que já existia:
 *
 * - `principal` → **--altura-campo** (48px), o botão do canvas, já em
 *   `/login`, `/nova-senha`, `/barco/ocorrencias/nova` e no formulário do
 *   Diário — e é a MESMA altura do campo que está logo acima dele, que é o
 *   que faz a coluna do formulário parecer uma coluna;
 * - `contorno` → **--altura-controle** (44px), a ÚNICA altura de pílula do
 *   app (`Chip`, `RedeNav`, `FinanceiroNav`).
 *
 * ONDA 91 (achado 5.10) — os dois números viraram token em `globals.css`.
 * Eram `h-12`/`h-11` cravados; cravar a régua em cada arquivo é exatamente
 * como o app chegou a nove alturas de alvo.
 *
 * As duas passam com folga no alvo de toque de 44px, que não se negocia. O
 * que some junto é o `py-3.5` (52px) que `/barco/editar` e `/financeiro/novo`
 * escreviam à mão — era a sétima altura nascendo, e a auditoria já a tinha
 * flagrado no achado 5.10.
 *
 * O INDICADOR É UM PONTO QUE PULSA, e não um anel girando. Duas razões: o app
 * já diz "algo está acontecendo" com `animate-pulse` (o loading das listas, o
 * ponto de gravação do Navegar) e um segundo vocabulário para a mesma ideia é
 * drift; e a regra global de `prefers-reduced-motion` em `globals.css` zera
 * `animation-duration` de TUDO — um anel congelado no meio da volta lê como
 * forma quebrada, um ponto congelado continua sendo um ponto.
 *
 * ALTERNATIVA DESCARTADA: escurecer o botão inteiro enquanto envia
 * (`disabled:opacity-80`). Opacidade compõe a peça toda contra o fundo da
 * página, e é justamente o rótulo escuro sobre o dourado que passou a carregar
 * a informação ("Salvando dados…") — rebaixar o contraste dele para dizer a
 * mesma coisa uma terceira vez sai caro e não compra nada.
 */

/** `-ar` → `-ando`, `-er` → `-endo`, `-ir` → `-indo`. */
const GERUNDIO: Record<string, string> = { ar: "ando", er: "endo", ir: "indo" }

/**
 * O rótulo de envio derivado do rótulo normal: "Salvar dados" → "Salvando
 * dados…", "Abrir ocorrência" → "Abrindo ocorrência…".
 *
 * Existe para que ligar o aviso num formulário custe UMA prop, não duas — o
 * que decide se as outras ~66 telas de formulário vão ganhar isso também. O
 * gerúndio em português é regular, então a conjugação do primeiro verbo cobre
 * todos os rótulos do app; o resto da frase segue intacto, porque "Salvando
 * dados…" diz o que está acontecendo e "Salvando…" só diz que algo está.
 *
 * Rótulo que não comece por infinitivo cai no genérico em vez de inventar uma
 * palavra — preferimos um aviso sem graça a um aviso errado. Quando o padrão
 * não servir, `rotuloEnviando` manda.
 */
export function enviandoPadrao(rotulo: string): string {
  const [verbo, ...resto] = rotulo.trim().split(" ")
  const sufixo = GERUNDIO[verbo.slice(-2).toLowerCase()]
  if (!sufixo) return "Enviando…"
  return [verbo.slice(0, -2) + sufixo, ...resto].join(" ") + "…"
}

/**
 * `principal`: a ação dourada de largura cheia — o padrão dos formulários de
 * tela inteira, e a ÚNICA dourada da tela (DESIGN §5).
 * `contorno`: a pílula secundária, contida na própria largura. Quem diz "aqui
 * se toca" é a forma, não a cor (ver `lib/ui/acoes.ts`).
 *
 * ONDA 91 — `ok` E `critico`, AS DUAS GRAVAÇÕES MAIS SÉRIAS DO PRODUTO.
 * ---------------------------------------------------------------------
 * "Aprovar" um selo e "Reprovar" uma avaliação paga (Commander Gold) ficavam
 * sem aviso de envio porque o componente só oferecia dourado ou neutro, e
 * nenhum dos dois serve: pintar de dourado uma reprovação diria que ela é a
 * marca, e pintar de cinza diria que ela é secundária.
 *
 * A COR VEM DO SEMÁFORO, NÃO DO ACENTO. `--ok`/`--crit` são estado
 * (DESIGN §5), então estes botões NÃO gastam o orçamento de dois dourados por
 * tela — é o mesmo raciocínio que deixa o `Selo` colorido conviver com a ação
 * principal. E a cor ACOMPANHA, nunca substitui: quem não distingue verde de
 * vermelho lê "Aprovar" e "Reprovar", que é a regra 3 do DESIGN §6.
 *
 * O VOCABULÁRIO É O DO `Selo` (`ok`/`critico`) e não o do token (`--crit`):
 * quem escreve a tela pensa em estado, não em nome de variável CSS.
 *
 * MUDA SÓ A FAMÍLIA DE COR — a forma é a de `contorno`, letra por letra
 * (mesma altura, mesmo raio, mesmo peso, mesmo respiro). O caso fundador da
 * deriva neste app foi seis alturas para a mesma pílula; uma ação de estado
 * continua sendo uma ação, e inventar um desenho novo para ela seria abrir a
 * sétima.
 *
 * `bg-panel` E NÃO O `bg-panel2` DO `contorno`, e isto é medido, não gosto:
 * no tema CLARO o par `--ok` sobre `--superficie-2` dá 4,43:1 e `--crit` dá
 * 4,26:1 — os dois abaixo do 4,5:1 de AA. Sobre `--superficie` (branco) sobem
 * para 5,02:1 e 4,82:1. É a mesma armadilha que obrigou a criar
 * `--texto-dim-chip`, e aqui ela se resolve escolhendo a superfície certa em
 * vez de criar um sexto token de cor.
 */
const CONTORNO = `h-[var(--altura-controle)] rounded-[var(--raio-pilula)] border px-5 text-sm font-medium ${TOQUE}`

const DESENHO = {
  principal: `h-[var(--altura-campo)] rounded-[var(--raio-controle)] bg-accent text-base font-semibold text-acao-texto ${TOQUE_AMPLO}`,
  contorno: `${CONTORNO} border-line bg-panel2 text-texto`,
  // Borda a 60% e não os 40% do `Selo`: o selo é etiqueta e só precisa ser
  // lido, este precisa ser ACHADO pelo dedo — a forma visível é o que a onda
  // 82 identificou como o que separa "aqui se toca" de "isto é texto".
  ok: `${CONTORNO} border-ok/60 bg-panel text-ok`,
  critico: `${CONTORNO} border-crit/60 bg-panel text-crit`,
} as const

export type VarianteEnvio = keyof typeof DESENHO

export function BotaoEnviar({
  rotulo,
  rotuloEnviando,
  variante = "principal",
  name,
  value,
  larguraCheia = false,
  className = "",
}: {
  /** String, e não `children`: é dela que sai o rótulo de envio padrão. */
  rotulo: string
  /** Só quando o gerúndio automático não servir. */
  rotuloEnviando?: string
  variante?: VarianteEnvio
  /** ONDA 91 — O FORMULÁRIO DE DOIS BOTÕES.
   *
   *  Quando um `<form>` tem dois submits que se distinguem pelo par
   *  `name`/`value` — "Manter" e "Ocultar por violação" em `/admin/avaliacoes`,
   *  "Confirmar" em `/consultor/[id]` — a action lê qual foi tocado pelo
   *  `FormData`. Sem repassar esses dois atributos, essas telas simplesmente
   *  não podiam usar o componente, e ficavam sem aviso de envio: justo as que
   *  gravam decisão de moderação, onde o duplo-toque é mais caro.
   *
   *  O `disabled` que entra durante o envio NÃO come o valor: o navegador
   *  recolhe o `FormData` (e o submitter dentro dele) no instante do submit, e
   *  a re-renderização que desabilita o botão vem depois. */
  name?: string
  value?: string
  /**
   * O botão preenche a linha em QUALQUER largura, em vez de parar de esticar a
   * partir de `sm`.
   *
   * Serve para a coluna que já tem teto próprio e nunca cresce — as telas de
   * `(auth)`, travadas em 430px no monitor inteiro. `ACAO_NAO_ESTICA` (o
   * padrão) existe para o caso oposto, que é o do resto do app: coluna que
   * cresce até 640px e um botão dourado atravessando tudo lê como layout de
   * celular esticado (ver `lib/ui/superficies.ts`). Numa coluna que não cresce
   * ele só deixaria uma pílula de 240px encalhada sob campos de 382px.
   */
  larguraCheia?: boolean
  className?: string
}) {
  const { pending } = useFormStatus()
  // A pílula de contorno é uma ação CONTIDA por natureza (é assim que ela diz
  // "sou a secundária"), e as de estado também: "Aprovar"/"Reprovar" andam em
  // par na mesma linha, e duas ações de largura cheia empilhadas transformam
  // uma escolha entre duas coisas em duas decisões separadas.
  const largura = larguraCheia ? "w-full" : variante === "principal" ? ACAO_NAO_ESTICA : ""

  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      aria-busy={pending}
      // O `disabled` aqui não bloqueia o primeiro envio — ele só existe DEPOIS
      // que o formulário já saiu. É exatamente o segundo toque que ele come,
      // que é o que gravava duas vezes.
      className={`inline-flex items-center justify-center gap-2 ${DESENHO[variante]} ${largura} ${className}`}
    >
      {pending ? rotuloEnviando ?? enviandoPadrao(rotulo) : rotulo}
      {pending && (
        <span
          aria-hidden="true"
          className="size-1.5 shrink-0 animate-pulse rounded-[var(--raio-pilula)] bg-current"
        />
      )}
    </button>
  )
}
