import Link from "next/link"
import { redirect } from "next/navigation"
import { Icone } from "@/components/icone"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { ModalGold } from "@/components/gold/modal-gold"
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
          <p className="titulo-card inline-flex items-center gap-1.5">
            <Icone nome="escudo" className="size-4 text-dim" /> Commander Verified
          </p>
          {verified && (
            <span className="font-mono-instr text-xs tabular-nums text-dim">
              {verified.completos} de {verified.total}
            </span>
          )}
        </div>
        <p className="apoio mt-1 text-dim">
          Verificação digital — cadastro, histórico e dados atualizados no app. Sem vistoria física.
        </p>
        {verified && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-panel2">
            <div
              className="h-full rounded-full bg-dim"
              style={{ width: `${Math.max(2, verified.percentual)}%` }}
            />
          </div>
        )}
      </Link>

      {relatorioGold && statusSelo ? (
        <ModalGold
          trigger={
            <div className="sombra-1 mt-3 rounded-[14px] border border-accent-forte/40 bg-panel p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="titulo-card inline-flex items-center gap-1.5">
                  <Icone nome="medalha" className="size-4 text-accent-forte" /> Commander Gold
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
          <p className="apoio text-dim">{TEXTO_MODAL_GOLD}</p>
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
            <p>Data: {new Date(`${relatorioGold.selo.data_avaliacao}T00:00:00`).toLocaleDateString("pt-BR")}</p>
            <p>Validade: até {new Date(`${relatorioGold.selo.validade_ate}T00:00:00`).toLocaleDateString("pt-BR")}</p>
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
            <Icone nome="ancora" className="size-4 text-accent-forte" /> Commander Gold
          </p>
          <p className="apoio mt-1 text-dim">
            Avaliação presencial de um consultor náutico, seguindo o Protocolo Commander.
          </p>
        </Link>
      )}
    </main>
  )
}
