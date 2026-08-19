import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { exigirAreaAdmin } from "@/lib/admin"
import { carregarLogsAdmin } from "@/lib/consultas-admin"
import { ehCeo, ROTULO_PAPEL, type PapelAdmin } from "@/lib/domain/admin-papeis"

/**
 * §21.3 — "Toda ação administrativa relevante registra quem, quando, função,
 * ação, entidade afetada e mudança de status. Logs não são apagáveis por
 * administradores comuns."
 *
 * O "não apagáveis" não é uma promessa desta tela: na migration 049 a tabela
 * `admin_logs` não tem policy de UPDATE nem de DELETE, e os privilégios estão
 * revogados de `authenticated`. Nem o CEO apaga. Aqui só se lê.
 *
 * O CEO enxerga todas as ações; os demais papéis enxergam as próprias — é a
 * RLS que decide isso, esta tela não filtra nada.
 */
export default async function AdminLogsPage() {
  const papeis = await exigirAreaAdmin("logs")
  const logs = await carregarLogsAdmin()
  const tudo = ehCeo(papeis)

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref="/admin"
        voltarRotulo="Admin Commander"
        titulo="Logs administrativos"
        descricao={
          tudo
            ? "Todas as ações administrativas registradas. O registro não é editável nem apagável — nem por você."
            : "As suas ações administrativas. O registro não é editável nem apagável."
        }
      />

      <div className="mt-6">
        {logs.length === 0 ? (
          <EstadoVazio
            icone="documento"
            titulo="Nenhuma ação registrada ainda"
            descricao="Conceder função, editar taxonomia e decidir um pedido aparecem aqui assim que acontecerem."
          />
        ) : (
          <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
            {/* POR QUE ESTA LINHA CONTINUA ESCRITA À MÃO.
                O slot `chips` de `LinhaLista` (components/ui/linha-lista.tsx)
                nasceu justamente pra fechar o buraco que fez esta tela desenhar
                a própria linha de três níveis, e a migração óbvia seria:
                `titulo` = a ação, `subtitulo` = quem · função, `chips` = os
                `ChipDado` de entidade / id / transição. Foi medido antes de
                descartar, e não fecha por duas razões — nenhuma delas estética.

                1. O QUE O LOG GRAVA EM `status` NÃO É UM STATUS, É FRASE. O
                   campo é texto livre e as actions escrevem nele o que couber:
                   "sob consulta" → "R$ 199,90" (lib/acoes/publicidade.ts),
                   "— → com região" (gold-admin), "— → commander_pro até
                   2026-12-31" (suporte). `ChipDado` é pílula
                   `whitespace-nowrap shrink-0`: não quebra, não encolhe, não
                   trunca — ela VAZA. A 390px a coluna de texto de uma linha de
                   lista tem ~220px e a última dessas frases pede mais de 330,
                   com o nome da tabela (`taxonomia_solicitacoes`) pedindo
                   quase o mesmo no chip de entidade. O `<p>` de hoje quebra em
                   duas linhas e continua dentro do cartão.

                2. O HORÁRIO NÃO TEM ONDE MORAR SEM MENTIR. Em `valor` ele sai
                   14px branco semibold — mais alto que o rótulo da própria
                   ação, e num registro o assunto é O QUE aconteceu; a hora é
                   contexto. Em `trailing` ele preserva os 12px cinza, mas
                   `LinhaLista` alinha pelo centro: a hora flutuaria no meio do
                   bloco de três linhas em vez de ficar na base da primeira, que
                   é a linha à qual ela pertence (por isso o `items-baseline`
                   abaixo).

                Não é defeito do slot: ele resolve chip CURTO ao lado de título
                curto, que é o caso do Diário pra onde foi desenhado. Aqui o
                dado é frase, e frase quer parágrafo. No dia em que as actions
                gravarem código de status em vez de texto corrido, esta linha
                vira `LinhaLista` em cinco minutos. */}
            {logs.map((l) => (
              <div key={l.id} className="border-b border-line py-3 last:border-0">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="corpo min-w-0 truncate font-medium">{rotuloDaAcao(l.acao)}</p>
                  <p className="apoio shrink-0 text-dim">{quando(l.criado_em)}</p>
                </div>
                <p className="apoio text-dim">
                  {l.nome} · {rotuloDoPapel(l.papel)}
                </p>
                <p className="apoio text-dim">
                  {l.entidade}
                  {l.entidade_id ? ` · ${l.entidade_id.slice(0, 8)}` : ""}
                  {l.status_antes || l.status_depois
                    ? ` · ${l.status_antes ?? "—"} → ${l.status_depois ?? "—"}`
                    : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

const ROTULOS_ACAO: Record<string, string> = {
  "admin.papel.conceder": "Função concedida",
  "admin.papel.suspender": "Função suspensa",
  "admin.papel.reativar": "Função reativada",
  "taxonomia.criar": "Item de taxonomia criado",
  "taxonomia.editar": "Item de taxonomia editado",
  "taxonomia.solicitacao.aprovar": "Pedido de inclusão aprovado",
  "taxonomia.solicitacao.recusar": "Pedido de inclusão recusado",
  // Onda 52 — Comercial (§20/§21) e Suporte (§21).
  "publicidade.preco.atualizar": "Preço de publicidade alterado",
  "publicidade.campanha.criar": "Campanha criada",
  "publicidade.campanha.status": "Campanha mudou de estado",
  "publicidade.campanha.editar": "Veiculação da campanha ajustada",
  "parceiro.suspender": "Partner suspenso do Explorar",
  "parceiro.reativar": "Partner reativado no Explorar",
  "suporte.atendimento": "Atendimento registrado",
  "suporte.cortesia.conceder": "Acesso de cortesia concedido",
}

/** Ação desconhecida cai no código cru de propósito: um log é registro, e
 *  esconder o que não sabemos traduzir seria perder informação. */
function rotuloDaAcao(acao: string): string {
  return ROTULOS_ACAO[acao] ?? acao
}

/** `papel` é o texto congelado no momento da ação e pode trazer mais de um
 *  papel somado ("comercial+suporte"). */
function rotuloDoPapel(papel: string): string {
  return papel
    .split("+")
    .map((p) => ROTULO_PAPEL[p as PapelAdmin] ?? p)
    .join(" e ")
}

function quando(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
}
