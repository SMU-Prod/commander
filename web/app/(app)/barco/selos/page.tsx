import Link from "next/link"
import { redirect } from "next/navigation"
import { ModalGold } from "@/components/gold/modal-gold"
import { SeloGold } from "@/components/selos/selo-gold"
import { SeloVerified } from "@/components/selos/selo-verified"
import { SituacaoVerified } from "@/components/selos/situacao-verified"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { carregarPainel, carregarVerified } from "@/lib/consultas"
import { carregarRelatorioSeloGold, hojeISO } from "@/lib/consultas-gold"
import {
  HUBS_PROTOCOLO_GOLD, ROTULO_ESTADO_ITEM, ROTULO_HUB_GOLD, ROTULO_STATUS_SELO,
  statusSeloGold, TEXTO_MODAL_GOLD,
} from "@/lib/domain/gold"

/**
 * Hub "Selos Commander" — apresenta os dois selos diretamente, sem uma
 * terceira marca entre eles (Correção 04 do PRD de Correções: proibido
 * chamar isso de "Selos & Review"). Só existem dois:
 *
 *   COMMANDER VERIFIED — digital, conquistado por completude do app.
 *   COMMANDER GOLD — presencial, obtido por avaliação com o Protocolo Commander.
 *
 * Gold NÃO depende de Verified (Correção 14) — texto abaixo deixa isso
 * explícito pra não sugerir uma progressão linear entre os dois.
 */
export default async function SelosPage() {
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const [verified, relatorioGold] = await Promise.all([
    carregarVerified(),
    carregarRelatorioSeloGold(painel.embarcacao.id),
  ])
  const statusSelo = relatorioGold ? statusSeloGold(relatorioGold.selo.validade_ate, hojeISO()) : null

  return (
    <main>
      <CabecalhoDetalhe voltarHref="/barco" voltarRotulo="Barco" titulo="Selos Commander" />
      <p className="apoio mt-1 text-dim">
        Duas formas de confiança, independentes uma da outra — o Gold não exige o Verified antes.
      </p>

      <Link
        href="/barco/selos/verified"
        className="sombra-1 mt-5 block rounded-[14px] border border-line bg-panel p-4"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="titulo-card inline-flex min-w-0 items-center gap-1.5">
            <SeloVerified size={20} /> Commander Verified
          </p>
          {verified && <SituacaoVerified selo={verified.selo} />}
        </div>
        <p className="apoio mt-1 text-dim">
          Verificação digital — cadastro, histórico e dados atualizados no app. Sem vistoria física.
        </p>
        {/* Contagem de requisitos, sem barra de progresso: barra é
            porcentagem desenhada, e o PRD §15 proíbe porcentagem no selo. */}
        {verified && (
          <p className="apoio mt-2 font-mono-instr tabular-nums text-dim">
            {verified.completos} de {verified.total} requisitos atendidos
          </p>
        )}
      </Link>

      {relatorioGold && statusSelo ? (
        <ModalGold
          trigger={
            <div className="sombra-1 mt-3 rounded-[14px] border border-accent-forte/40 bg-panel p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="titulo-card inline-flex items-center gap-1.5">
                  <SeloGold size={20} variant="ativo" /> Commander Gold
                </p>
                <span className="font-mono-instr text-xs uppercase tracking-[.08em] text-dim">
                  {ROTULO_STATUS_SELO[statusSelo]}
                </span>
              </div>
              <p className="apoio mt-1 text-dim">
                Avaliação presencial de um consultor náutico, seguindo o Protocolo Commander. Toque para ver o relatório.
              </p>
            </div>
          }
        >
          <div className="flex justify-center">
            <SeloGold
              size={72} variant="ativo"
              dataAvaliacao={relatorioGold.selo.data_avaliacao}
              validadeAte={relatorioGold.selo.validade_ate}
            />
          </div>
          <p className="mt-3 apoio text-dim">{TEXTO_MODAL_GOLD}</p>
          <div className="mt-3 divide-y divide-line">
            {HUBS_PROTOCOLO_GOLD.map((hub) => {
              const item = relatorioGold.itens.find((i) => i.hub === hub)
              const estado = item?.estado ?? "na"
              return (
                <div key={hub} className="flex items-center justify-between py-2">
                  <p className="corpo">{ROTULO_HUB_GOLD[hub]}</p>
                  <p className={`apoio font-medium ${estado === "avaliado" ? "text-ok" : estado === "atencao" ? "text-warn" : "text-dim"}`}>
                    {ROTULO_ESTADO_ITEM[estado]}
                  </p>
                </div>
              )
            })}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 apoio text-dim">
            <p>Protocolo: v{relatorioGold.selo.versao_protocolo}</p>
            {relatorioGold.consultor && <p>Consultor: {relatorioGold.consultor.nome}</p>}
          </div>
          <Link
            href={`/barco/selos/gold/${relatorioGold.selo.solicitacao_id}`}
            className="mt-4 block rounded-xl bg-accent py-3 text-center font-semibold text-acao-texto"
          >
            Ver relatório
          </Link>
        </ModalGold>
      ) : (
        <Link
          href="/barco/selos/gold"
          className="sombra-1 mt-3 block rounded-[14px] border border-line bg-panel p-4"
        >
          <p className="titulo-card inline-flex items-center gap-1.5">
            <SeloGold size={20} variant="convite" /> Commander Gold
          </p>
          <p className="apoio mt-1 text-dim">
            Avaliação presencial de um consultor náutico, seguindo o Protocolo Commander.
          </p>
        </Link>
      )}
    </main>
  )
}
