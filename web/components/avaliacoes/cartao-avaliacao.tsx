import type { ReactNode } from "react"
import { Avatar } from "@/components/avatar"
import { Icone } from "@/components/icone"
import type { AvaliacaoCompleta } from "@/lib/consultas-avaliacoes"
import {
  estadoDaSolucao, formatarMedia, ROTULO_ESTADO_SOLUCAO, SELO_NEGOCIO_CONFIRMADO,
  textoDaResposta, textoDoMotivo,
} from "@/lib/domain/avaliacoes"

/**
 * Uma avaliação como ela aparece no perfil (§14).
 *
 * Traz sempre a indicação "Negócio confirmado pelo Commander" porque toda
 * linha desta tabela nasce de um negócio confirmado pelos dois lados — a RLS
 * não deixa nascer de outro jeito (migration 050). O selo não é enfeite: é a
 * diferença entre esta avaliação e uma nota de site aberto.
 *
 * `children` é onde cada tela pendura as ações do momento (responder,
 * contestar, editar) — o cartão em si é só leitura.
 */
export function CartaoAvaliacao({
  item,
  cabecalho,
  children,
}: {
  item: AvaliacaoCompleta
  /** Texto da linha de cima. No perfil de alguém é quem escreveu; na tela
   *  "minhas avaliações feitas" é sobre quem você escreveu. */
  cabecalho?: string
  children?: ReactNode
}) {
  const { avaliacao, resposta, contestacao, solucao } = item
  const oculta = avaliacao.visibilidade === "oculta_violacao"
  const estadoSolucao = estadoDaSolucao(solucao)

  return (
    <div
      className={`sombra-1 rounded-[14px] border p-4 ${
        oculta ? "border-crit/40 bg-crit/5" : "border-line bg-panel"
      }`}
    >
      {/* ONDA 62 — cabeçalho do canvas (tela-4c): avatar de iniciais, nome,
          data em apoio, e a nota como NÚMERO mono + ★ à direita. As cinco
          estrelinhas desenhadas saíram — a nota que existe é a que aparece,
          escrita ("5,0 ★"), sem régua gráfica pra interpretar. */}
      <div className="flex items-center gap-2.5">
        <Avatar url={null} nome={cabecalho ?? avaliacao.avaliador_nome} tamanho="size-9" />
        <div className="min-w-0 flex-1">
          <p className="corpo truncate font-semibold">{cabecalho ?? avaliacao.avaliador_nome}</p>
          <p className="apoio mt-0.5 text-dim">
            {new Date(avaliacao.criado_em).toLocaleDateString("pt-BR")}
          </p>
        </div>
        <span
          className="shrink-0 font-mono-instr text-[13px] font-semibold tabular-nums"
          aria-label={`${avaliacao.nota} de 5 estrelas`}
        >
          {formatarMedia(avaliacao.nota)} ★
        </span>
      </div>

      {avaliacao.comentario && <p className="corpo mt-2.5 whitespace-pre-line text-dim-chip">{avaliacao.comentario}</p>}

      {/* §14 — o selo que separa isto de nota de site aberto continua no
          cartão, agora abaixo do cabeçalho (o canto direito é da nota). */}
      <p className="apoio mt-2.5 inline-flex items-center gap-1 rounded-full border border-ok/40 px-2 py-0.5 text-ok">
        <Icone nome="guardado" className="size-3.5" />
        {SELO_NEGOCIO_CONFIRMADO}
      </p>

      {oculta && (
        <p className="apoio mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">
          Ocultada por violação após análise da equipe Commander — não aparece para outras pessoas e não
          entra na média.
          {avaliacao.ocultacao_nota && <> Motivo registrado: {avaliacao.ocultacao_nota}</>}
        </p>
      )}

      {/* §14.1 — a resposta do avaliado, sempre uma das frases padronizadas. */}
      {resposta && (
        <div className="mt-3 rounded-lg border border-line bg-panel2 px-3 py-2">
          <p className="rotulo text-dim">Resposta de {avaliacao.avaliado_nome}</p>
          <p className="corpo mt-0.5">{textoDaResposta(resposta.resposta_codigo)}</p>
        </div>
      )}

      {/* §14 — "Problema solucionado": muda o selo, nunca a nota. */}
      {estadoSolucao !== "nenhuma" && (
        <p
          className={`apoio mt-3 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 ${
            estadoSolucao === "confirmada" ? "border-ok/40 text-ok" : "border-line text-dim"
          }`}
        >
          <Icone nome="ferramenta" className="size-3.5" />
          {ROTULO_ESTADO_SOLUCAO[estadoSolucao]}
        </p>
      )}
      {solucao?.descricao && <p className="apoio mt-1 text-dim">{solucao.descricao}</p>}

      {/* §14 — contestação em análise NÃO tira a avaliação do ar. A tela diz
          isso com todas as letras pra ninguém achar que sumiu. */}
      {contestacao && contestacao.status === "pendente" && (
        <p className="apoio mt-3 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2">
          Contestada — em análise pela equipe Commander. A avaliação continua publicada e contando na média
          até a decisão. Motivo: {textoDoMotivo(contestacao.motivo_codigo)}
        </p>
      )}
      {contestacao && contestacao.status === "analisada" && contestacao.decisao === "manter" && (
        <p className="apoio mt-3 rounded-lg border border-line px-3 py-2 text-dim">
          Contestada e analisada — a equipe Commander manteve a avaliação.
        </p>
      )}

      {children}
    </div>
  )
}
