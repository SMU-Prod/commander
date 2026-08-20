"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { Icone } from "@/components/icone"
import { registrarClique, registrarImpressao } from "@/lib/acoes/publicidade-medicao"
import {
  MAX_PATROCINADORES_DASHBOARD,
  permitePublicidade,
  ROTULO_PATROCINADO,
} from "@/lib/domain/publicidade"

/**
 * Carrossel de patrocínio do Dashboard (PRD §3.4 e §20).
 *
 * O §3.4 é específico e cada palavra virou uma linha de código aqui:
 *
 *   "no máximo uma unidade visível por vez"  → renderiza UM item; os outros
 *                                              não estão escondidos com CSS,
 *                                              simplesmente não existem no
 *                                              DOM;
 *   "carrossel de até 5 patrocinadores"      → `slice` defensivo, mesmo com
 *                                              `selecionarPatrocinios` já
 *                                              cortando no servidor;
 *   "identificado como 'Patrocinado'"        → `ROTULO_PATROCINADO`, sempre
 *                                              visível, nunca escondido em
 *                                              hover ou em fonte 8px;
 *   "abaixo da área operacional prioritária" → decidido em `barco/page.tsx`,
 *                                              onde este componente é o
 *                                              último bloco da página.
 *
 * SOBRE A HONESTIDADE DISSO AQUI: o proprietário paga assinatura e ainda
 * assim vê anúncio — é o que o §20 desenha, não uma liberdade que eu tomei.
 * O que dá pra fazer sem contrariar o PRD é o que está feito: o anúncio não
 * se disfarça de recomendação do Commander, não pisca, não abre sozinho, não
 * empurra a informação operacional pra baixo, não aparece em tela de
 * segurança/ocorrência (`TELAS_SEM_PUBLICIDADE`) e leva a um perfil dentro
 * do app, nunca pra fora. Se um dia o plano pago passar a remover
 * publicidade, o lugar de decidir isso é o §2 — não este componente.
 *
 * A rotação é MANUAL. Um carrossel que gira sozinho embaixo do painel de um
 * barco rouba atenção de quem está lendo "próxima manutenção" logo acima, e
 * infla impressão sem ninguém ter olhado. Quem quiser ver o próximo,
 * aperta.
 */

/**
 * Pra onde o clique leva: o perfil público do Partner no Explorar
 * (`/explorar/[id]`, criado na onda do "Partner por tipo").
 *
 * NUNCA uma URL externa — `publicidade_campanhas` não tem coluna de destino,
 * de propósito. Ver o item 3 do cabeçalho da migration 053: campo de link
 * livre num anúncio é superfície de phishing e um salto pra fora que ninguém
 * audita, dentro de um app de gestão que o cliente paga.
 *
 * Uma função de uma linha porque é o único ponto que precisa mudar se o
 * perfil público do Partner mudar de endereço.
 */
function hrefDoAnunciante(parceiroId: string): string {
  return `/explorar/${parceiroId}`
}

export interface AnuncioPatrocinado {
  campanhaId: string
  parceiroId: string
  nome: string
  chamada: string | null
}

export function PatrocinioDashboard({ anuncios }: { anuncios: AnuncioPatrocinado[] }) {
  // A regra "aqui não entra publicidade" mora no domínio e se aplica SOZINHA,
  // onde quer que alguém coloque este componente. Deixá-la só como comentário
  // ou como cuidado de quem monta a tela seria confiar que ninguém, um dia,
  // vai querer "só um cartãozinho" ao lado de um alerta de colete vencido.
  const caminho = usePathname()
  const permitido = permitePublicidade(caminho ?? "")

  const lista = permitido ? anuncios.slice(0, MAX_PATROCINADORES_DASHBOARD) : []
  const [i, setI] = useState(0)
  // Uma impressão por campanha por render de página. Sem isso, trocar de
  // slide e voltar contaria de novo o mesmo anúncio pra mesma pessoa, e o
  // relatório do Comercial viraria função de quem mexe no botão.
  const contadas = useRef(new Set<string>())
  const atual = lista[i]

  useEffect(() => {
    if (!atual || contadas.current.has(atual.campanhaId)) return
    contadas.current.add(atual.campanhaId)
    void registrarImpressao(atual.campanhaId)
  }, [atual])

  if (lista.length === 0) return null

  return (
    <section className="mt-8" aria-label="Patrocínio">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="rotulo text-dim">{ROTULO_PATROCINADO}</p>
        {lista.length > 1 && (
          <span className="tabular-nums text-xs tabular-nums text-dim">
            {i + 1} de {lista.length}
          </span>
        )}
      </div>

      <div className="sombra-1 flex items-center gap-2 rounded-[var(--raio-cartao)] border border-dashed border-line bg-panel p-3.5">
        {lista.length > 1 && (
          <BotaoPasso
            rotulo="Patrocinador anterior"
            icone="voltar"
            onClick={() => setI((n) => (n - 1 + lista.length) % lista.length)}
          />
        )}

        <Link
          href={hrefDoAnunciante(atual.parceiroId)}
          onClick={() => void registrarClique(atual.campanhaId)}
          className="min-w-0 flex-1"
        >
          <p className="titulo-card truncate">{atual.nome}</p>
          <p className="apoio mt-0.5 truncate text-dim">
            {atual.chamada ?? "Ver o perfil no Explorar"}
          </p>
        </Link>

        {lista.length > 1 && (
          <BotaoPasso
            rotulo="Próximo patrocinador"
            icone="chevron"
            onClick={() => setI((n) => (n + 1) % lista.length)}
          />
        )}
      </div>
    </section>
  )
}

function BotaoPasso({
  rotulo,
  icone,
  onClick,
}: {
  rotulo: string
  icone: "voltar" | "chevron"
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      onClick={onClick}
      className="shrink-0 rounded-[var(--raio-controle)] border border-line bg-panel2 p-1.5"
    >
      <Icone nome={icone} className="size-4 text-dim" />
    </button>
  )
}
