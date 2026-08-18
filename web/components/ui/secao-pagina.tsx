import Link from "next/link"
import type { ReactNode } from "react"
import { Icone, type NomeIcone } from "@/components/icone"

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
  children,
  className = "",
  id,
}: {
  /** Ícone à esquerda do rótulo — mesmo `NomeIcone` do resto do app. */
  icone?: NomeIcone
  /** Ação à direita, ex.: `{ href: "/barco/itens/novo", rotulo: "Manutenção", icone: "mais" }`. */
  acao?: { href: string; rotulo: string; icone?: NomeIcone }
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
    <div id={id} className={`mt-6 mb-2 flex items-center justify-between gap-2 ${className}`}>
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
        <Link
          href={acao.href}
          className="corpo -my-2.5 -mr-1 inline-flex min-h-11 shrink-0 items-center gap-1 px-1 text-dim"
        >
          {acao.icone && <Icone nome={acao.icone} className="size-4" />}
          {acao.rotulo}
        </Link>
      )}
    </div>
  )
}
