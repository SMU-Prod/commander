import Link from "next/link"
import type { ReactNode } from "react"
import { Icone, type NomeIcone } from "@/components/icone"
import { ALVO_ACAO, PILULA_ACAO } from "@/lib/ui/acoes"

/**
 * Cabeçalho de seção dentro de uma página (rótulo uppercase espaçado, ícone
 * opcional à esquerda, ação opcional à direita — "Ver tudo", "+ Motor",
 * "Editar"). É o padrão que /hoje já usava copiado à mão em cada tela;
 * aqui virou componente.
 *
 * Quando usar: todo título de bloco dentro de uma página (Motores, Casco,
 * Documentos, Histórico...). Não usar para o título da PÁGINA em si — esse
 * é o `<h1 className="titulo-pagina">`, ver `CabecalhoDetalhe`.
 */
export function SecaoPagina({
  icone,
  acao,
  denso = false,
  children,
  className = "",
  id,
}: {
  /** Ícone à esquerda do rótulo — mesmo `NomeIcone` do resto do app. */
  icone?: NomeIcone
  /** Ação à direita, ex.: `{ href: "/barco/itens/novo", rotulo: "Manutenção", icone: "mais" }`. */
  acao?: { href: string; rotulo: string; icone?: NomeIcone }
  /** ONDA 91 (achado 1.3) — A MOLDURA DE SEÇÃO PARA DE COMER A TELA.
   *
   *  `/barco` empilha OITO seções numa tela só, cinco delas com ação, e a
   *  conta da moldura fixa deste componente (24 + 8 = 32px por seção) mais as
   *  linhas dá **457px** — 61% de uma tela de 390×844 gasta em cabeçalho de
   *  seção, antes de qualquer conteúdo. `denso` desce para 16 + 4 = 20px e
   *  devolve ~96px, sem esconder nada e sem tocar no rótulo.
   *
   *  POR QUE É PROP E NÃO `className`: duas classes `mt-*` no mesmo elemento
   *  é loteria de ordem no CSS gerado — quem vence depende de como o Tailwind
   *  ordenou as utilitárias, não de quem escreveu por último. É o mesmo
   *  motivo que `botao-ficha.tsx` documenta para `border-*`/`text-*`.
   *
   *  Padrão `false`: nenhum dos ~35 consumidores atuais muda de aparência.
   *  E isto NÃO é a correção completa do achado — `/barco` ter oito seções é
   *  um índice fingindo de ficha, e o remédio de verdade é `Abas` (onda 92).
   *  Isto é o respiro até lá. */
  denso?: boolean
  children: ReactNode
  className?: string
  /** Âncora (`#id`) — pra ação no topo da tela apontar pra seção certa
   *  (ex.: o "+ Adicionar" de /barco/fotos). Junte `scroll-mt-*` no
   *  `className` pra âncora não colar no topo da viewport. */
  id?: string
}) {
  return (
    // ONDA 54 — `items-center` no lugar de `items-baseline`: a ação da
    // direita deixou de ser um texto e virou um alvo de toque de 44px (ver
    // abaixo), e alinhar pela BASE um texto de 14px com uma caixa de 44px
    // empurrava o rótulo da seção para o topo da linha.
    // Os dois pares são degraus da escala base-8 do `docs/DESIGN.md` §5
    // (24/8 e 16/4) — a versão densa aperta, não sai da régua.
    <div
      id={id}
      className={`${denso ? "mt-4 mb-1" : "mt-6 mb-2"} flex items-center justify-between gap-2 ${className}`}
    >
      <p className="rotulo inline-flex items-center gap-1.5 text-dim">
        {icone && <Icone nome={icone} className="size-3.5" />}
        {children}
      </p>
      {acao && (
        // Era a maior fonte de alvo de toque pequeno do app: SÓ em /barco são
        // seis ("Motor", "Manutenção", "Adicionar", "Adicionar documento",
        // "Editar", "Ver tudo"), todos com ~18px de altura, e este componente
        // é usado em 35 arquivos. Não é link no meio de parágrafo — é o botão
        // de "adicionar" de cada seção, o gesto mais repetido da tela.
        //
        // Mesma técnica do "Voltar" em `CabecalhoDetalhe`: `min-h-11` dá os
        // 44px de toque e `-my-2.5` devolve 20px ao layout, para o cabeçalho
        // de seção não engordar 28px em cada uma das ~35 telas. `-mr-1 px-1`
        // mantém o texto rente à margem direita e ainda assim alarga a área
        // tocável.
        //
        // ONDA 63 — ERA DOURADO, E ERA A MAIOR FONTE DE CONFETE DO APP.
        // O orçamento do §5 é de DOIS dourados por tela e este componente
        // aparece cinco vezes só em /barco ("Motor", "Ver tudo", "Ver tudo",
        // "Manutenção", "Editar"): sozinho ele estourava o orçamento em toda
        // tela de hub. E ele nunca foi a ação principal de tela nenhuma —
        // varrendo os ~35 usos, é sempre "Ver tudo" ou "+ Alguma coisa"
        // secundário; a ação principal mora no `acao` de `CabecalhoDetalhe`
        // e `BarraFerramentas`, que continuam pílulas douradas.
        //
        // A cor nova não é um chute: o cinza-azulado que o canvas do
        // proprietário usa no "Ver tudo" das seções é, dígito por dígito, o
        // valor de `--texto-dim` no tema escuro. `text-dim` é a referência
        // literal — não uma adaptação dela.
        //
        // ONDA 82 — TIRAR A COR FOI META CERTA COM MEIO ERRADO. O diagnóstico
        // do dono, olhando o app pronto: "os destaques têm muita coisa que é
        // clicável e não é perceptível, parecendo um texto comum". Ele está
        // certo, e a onda 63 é a causa: sem o dourado, o que sobrou foi
        // TEXTO CINZA — e texto cinza é exatamente o que o app usa para
        // rótulo e apoio, ou seja, para o que NÃO se toca. A ação virou a
        // coisa menos visível da linha.
        //
        // Na referência nenhuma ação é texto pelado: é pílula preenchida,
        // pílula de contorno, ou botão-círculo com ícone (spec §3, item 5).
        // Quem diz "aqui se toca" é a FORMA, não a cor — e é por isso que a
        // correção não desfaz a onda 63: o dourado continua reservado à ação
        // principal da tela, e esta ganha contorno, que custa zero do
        // orçamento de dois dourados.
        //
        // A forma mora em `lib/ui/acoes.ts` — ver lá a briga de dois números
        // (desenho de 30px, alvo de 44px) e por que ela é compartilhada.
        <Link href={acao.href} className={`${ALVO_ACAO} -mr-1 px-1`}>
          <span className={PILULA_ACAO}>
            {acao.icone && <Icone nome={acao.icone} className="size-3.5" />}
            {acao.rotulo}
          </span>
        </Link>
      )}
    </div>
  )
}
