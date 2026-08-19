import Link from "next/link"
import { redirect } from "next/navigation"
import { SeloGold } from "@/components/selos/selo-gold"
import { SeloVerified } from "@/components/selos/selo-verified"
import { SituacaoVerified } from "@/components/selos/situacao-verified"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { LinhaLista } from "@/components/ui/linha-lista"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { carregarPainel, carregarVerified } from "@/lib/consultas"
import { formatarCarimbo } from "@/lib/domain/datas"
import { DIAS_REGULARIZACAO_VERIFIED, type ItemVerified } from "@/lib/domain/verified"
import { ALVO_ACAO, PILULA_ACAO } from "@/lib/ui/acoes"

/**
 * Checklist do Commander Verified — verificação DIGITAL (cadastro +
 * histórico + dados atualizados), nunca vistoria física (Correção 05 do PRD
 * de Correções). Por isso a identidade visual aqui usa tons neutros
 * (prata/navy — `text-dim`/`bg-dim`), sem o dourado que o app usa como
 * accent geral: esse dourado passa a ser reservado pro Commander Gold
 * (`/barco/selos/gold`), que é o selo presencial de verdade.
 *
 * Sem CTA de "solicitar avaliação" aqui — esse pedido é o primeiro passo do
 * fluxo do Gold, não do Verified (Correção 02), então mora na tela do Gold.
 *
 * Onda 44 (PRD §15): saiu a barra de "completude" e entraram as duas listas
 * que o PRD pede — o que está atendido e o que falta —, mais a situação do
 * selo e o prazo de regularização. Nenhuma porcentagem, nem escrita nem
 * desenhada: uma barra de progresso é uma porcentagem sem o símbolo.
 */
function LinhaPilar({ item }: { item: ItemVerified }) {
  return (
    <LinhaLista
      key={item.chave}
      leading={
        <span
          className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${
            item.ok ? "border-ok bg-ok/15" : "border-line"
          }`}
          aria-hidden="true"
        >
          {item.ok && <span className="size-2 rounded-full bg-ok" />}
        </span>
      }
      titulo={<span className={item.ok ? "" : "text-dim"}>{item.rotulo}</span>}
      subtitulo={!item.ok ? item.dica : undefined}
      trailing={
        !item.ok ? (
          // Onda 82 — pílula de contorno no lugar do sublinhado: "Resolver" é
          // a ação que esta tela inteira existe pra oferecer, repetida por
          // requisito. Ver `lib/ui/acoes.ts`.
          <Link href={item.href} className={ALVO_ACAO}>
            <span className={PILULA_ACAO}>Resolver</span>
          </Link>
        ) : undefined
      }
    />
  )
}

export default async function VerifiedPage() {
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const verified = await carregarVerified()
  if (!verified) redirect("/onboarding")
  const { selo } = verified

  return (
    <main>
      <CabecalhoDetalhe voltarHref="/barco/selos" voltarRotulo="Selos Commander" />
      <h1 className="titulo-pagina mt-3 inline-flex items-center gap-2">
        <SeloVerified size={32} /> Commander Verified
      </h1>
      <p className="apoio mt-1 text-dim">
        Verificação digital: reconhece documentação e histórico completos no app. Não é vistoria
        física — quem avalia presencialmente é o Commander Gold.
      </p>

      <div className="sombra-1 mt-4 rounded-[14px] border border-line bg-panel p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="rotulo text-dim">Situação do selo</p>
          <SituacaoVerified selo={selo} />
        </div>
        <p className="apoio mt-2 font-mono-instr tabular-nums text-dim">
          {verified.completos} de {verified.total} requisitos atendidos
        </p>

        {selo.situacao === "regularizacao" && (
          <p className="corpo mt-2">
            Um requisito deixou de ser atendido. Você tem {DIAS_REGULARIZACAO_VERIFIED} dias pra
            regularizar — até {selo.prazoAte && formatarCarimbo(selo.prazoAte)} — e o selo continua
            valendo nesse período. Passando disso, ele fica suspenso.
          </p>
        )}
        {selo.situacao === "suspenso" && (
          <p className="corpo mt-2">
            O prazo de {DIAS_REGULARIZACAO_VERIFIED} dias terminou
            {selo.prazoAte ? ` em ${formatarCarimbo(selo.prazoAte)}` : ""} e o selo está suspenso.
            Resolva o que falta abaixo: a reavaliação é automática e o selo volta sozinho.
          </p>
        )}
        {selo.situacao === "nao_conquistado" && (
          <p className="corpo mt-2">
            Faltam requisitos pro selo. Não há prazo correndo — o relógio dos{" "}
            {DIAS_REGULARIZACAO_VERIFIED} dias só existe pra quem já conquistou e deixou algo cair.
          </p>
        )}
        {selo.situacao === "ativo" && (
          <p className="corpo mt-2">
            Os cinco pilares estão de pé. Se algum deixar de ser atendido, você recebe o aviso e tem{" "}
            {DIAS_REGULARIZACAO_VERIFIED} dias pra regularizar antes de qualquer suspensão.
          </p>
        )}

        {/* A regra que não pode escapar (PRD §15) — precisa estar escrita na
            tela, não só no código: o dono que abre uma ocorrência não pode
            temer perder o selo por ter sido honesto. */}
        <p className="apoio mt-3 text-dim">
          Ter ocorrência aberta não remove o Verified. O selo mede acompanhamento, não ausência de
          defeitos.
        </p>
      </div>

      {verified.pendentes.length > 0 && (
        <>
          <SecaoPagina icone="alerta">O que falta — {verified.pendentes.length}</SecaoPagina>
          <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
            {verified.pendentes.map((item) => <LinhaPilar key={item.chave} item={item} />)}
          </div>
        </>
      )}

      {verified.atendidos.length > 0 && (
        <>
          <SecaoPagina icone="escudo">Requisitos atendidos — {verified.atendidos.length}</SecaoPagina>
          <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
            {verified.atendidos.map((item) => <LinhaPilar key={item.chave} item={item} />)}
          </div>
        </>
      )}

      <Link
        href="/barco/selos/gold"
        className="sombra-1 mt-6 block rounded-[14px] border border-line bg-panel p-3.5"
      >
        <p className="titulo-card inline-flex items-center gap-1.5">
          <SeloGold size={18} variant="convite" /> Quer avaliação presencial?
        </p>
        <p className="apoio mt-0.5 text-dim">
          Conheça o Commander Gold — não depende de completar o Verified.
        </p>
      </Link>
    </main>
  )
}
