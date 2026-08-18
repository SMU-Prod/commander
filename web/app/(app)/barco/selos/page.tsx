import Link from "next/link"
import { redirect } from "next/navigation"
import { ModalGold } from "@/components/gold/modal-gold"
import { Icone } from "@/components/icone"
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
 * Hub "Selos" — apresenta os dois selos diretamente, sem uma terceira marca
 * entre eles (Correção 04 do PRD de Correções: proibido chamar isso de
 * "Selos & Review"). Só existem dois:
 *
 *   COMMANDER VERIFIED — digital, conquistado por completude do app.
 *   COMMANDER GOLD — presencial, obtido por avaliação com o Protocolo Commander.
 *
 * Gold NÃO depende de Verified (Correção 14) — texto abaixo deixa isso
 * explícito pra não sugerir uma progressão linear entre os dois.
 *
 * ANATOMIA DA ONDA 62 (canvas tela-3m): o selo em curso mostra a lista de
 * requisitos DENTRO do cartão — check no atendido, círculo vazio no que
 * falta — e a contagem em mono embaixo. No canvas essa lista está no cartão
 * do Gold porque o Gold DELE é de requisitos; o NOSSO selo de requisitos é o
 * Verified (§15), então a lista mora no cartão do Verified — anatomia do
 * canvas, semântica do PRD. A barra de progresso do canvas NÃO veio:
 * §15 proíbe porcentagem no selo, e barra é porcentagem desenhada.
 */
export default async function SelosPage() {
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const [verified, relatorioGold] = await Promise.all([
    carregarVerified(),
    carregarRelatorioSeloGold(painel.embarcacao.id),
  ])
  const statusSelo = relatorioGold ? statusSeloGold(relatorioGold.selo.validade_ate, hojeISO()) : null
  const verifiedAtivo = verified?.selo.situacao === "ativo"

  return (
    <main>
      {/* Canvas tela-3m — eyebrow "Barco", título curto e a frase que diz o
          que esta tela vale pra quem um dia vai vender o barco. */}
      <CabecalhoDetalhe
        voltarHref="/barco"
        voltarRotulo="Barco"
        titulo="Selos"
        descricao="O que o histórico da embarcação comprova para um comprador."
      />
      <p className="apoio mt-1 text-dim">
        Duas formas de confiança, independentes uma da outra — o Gold não exige o Verified antes.
      </p>

      {/* COMMANDER VERIFIED — a borda ganha o verde só quando o selo está de
          pé (canvas: cartão do selo ativo com borda tingida). Cor E palavra:
          o chip de situação diz o estado por extenso. */}
      <Link
        href="/barco/selos/verified"
        className={`sombra-1 mt-5 block rounded-[var(--raio-cartao)] border bg-panel p-4 ${
          verifiedAtivo ? "border-ok/40" : "border-line"
        }`}
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
        {/* A lista de requisitos do canvas: check no que está de pé, círculo
            vazio no que falta. Contagem em mono, sem barra de progresso —
            barra é porcentagem desenhada, e o PRD §15 proíbe porcentagem. */}
        {verified && (
          <>
            <div className="mt-3 flex flex-col gap-2">
              {verified.itens.map((i) => (
                <div key={i.chave} className="flex items-center gap-2.5">
                  {i.ok ? (
                    <Icone nome="check" className="size-4 shrink-0 text-ok" />
                  ) : (
                    <span aria-hidden="true" className="size-4 shrink-0 rounded-full border border-dim" />
                  )}
                  <span className={`apoio flex-1 ${i.ok ? "text-dim" : ""}`}>{i.rotulo}</span>
                </div>
              ))}
            </div>
            <p className="apoio mt-3 font-mono-instr tabular-nums text-dim">
              {verified.completos} de {verified.total} requisitos atendidos
            </p>
          </>
        )}
      </Link>

      {relatorioGold && statusSelo ? (
        <ModalGold
          trigger={
            <div className="sombra-1 mt-3 rounded-[var(--raio-cartao)] border border-accent-forte/40 bg-panel p-4">
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
          className="sombra-1 mt-3 block rounded-[var(--raio-cartao)] border border-line bg-panel p-4"
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
