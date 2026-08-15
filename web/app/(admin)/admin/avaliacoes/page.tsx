import Link from "next/link"
import { Estrelas } from "@/components/avaliacoes/estrelas"
import { Icone } from "@/components/icone"
import { moderarAvaliacao } from "@/lib/acoes/avaliacoes-admin"
import { exigirAdmin } from "@/lib/admin"
import { carregarContestacoesPendentes } from "@/lib/consultas-avaliacoes"
import { textoDoMotivo } from "@/lib/domain/avaliacoes"

/**
 * Admin > Contestações (PRD §14: "Admin analisa e pode Manter ou Ocultar por
 * violação. Admin nunca altera a nota").
 *
 * Repare no que esta tela NÃO tem: campo de nota. Não é disciplina — o banco
 * não concede update na coluna `nota` a ninguém além do autor, e a RPC de
 * moderação não a menciona (migration 050). Aqui só existem os dois botões
 * que o §14 autoriza.
 *
 * TODO (§21): quando o modelo de papéis do Admin assentar, esta é uma tela do
 * Suporte, e o link deve entrar no índice de /admin. Hoje ela usa
 * `exigirAdmin()`/`eh_admin()`, que é o conceito de admin que existe.
 */
export default async function AdminAvaliacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>
}) {
  await exigirAdmin()
  const { ok, erro } = await searchParams
  const fila = await carregarContestacoesPendentes()

  return (
    <main>
      <Link href="/admin" className="inline-flex items-center gap-1 rotulo text-accent-forte">
        <Icone nome="voltar" className="size-4" /> Admin
      </Link>
      <h1 className="titulo-pagina mt-3">Contestações de avaliação</h1>
      <p className="apoio mt-1 text-dim">
        Manter ou ocultar por violação. A nota que o cliente deu nunca é alterada — nem aqui, nem no banco.
      </p>

      {ok && <p className="corpo mt-3 rounded-lg border border-ok/40 bg-ok/10 px-3 py-2">{ok}</p>}
      {erro && <p className="corpo mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      {fila.length === 0 ? (
        <p className="apoio mt-6 rounded-[14px] border border-line bg-panel p-4 text-center text-dim">
          Nenhuma contestação aguardando análise.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {fila.map(({ contestacao, avaliacao }) => (
            <div key={contestacao.id} className="sombra-1 rounded-[14px] border border-line bg-panel p-4">
              <div className="flex items-center justify-between gap-2">
                <Estrelas nota={avaliacao.nota} />
                <span className="apoio text-dim">
                  {new Date(avaliacao.criado_em).toLocaleDateString("pt-BR")}
                </span>
              </div>
              <p className="apoio mt-1 text-dim">
                {avaliacao.avaliador_nome} avaliou {avaliacao.avaliado_nome}
              </p>
              {avaliacao.comentario && (
                <p className="corpo mt-2 whitespace-pre-line rounded-lg border border-line bg-panel2 px-3 py-2">
                  {avaliacao.comentario}
                </p>
              )}

              <p className="rotulo mt-3 text-dim">Contestação</p>
              <p className="corpo">{textoDoMotivo(contestacao.motivo_codigo)}</p>
              {contestacao.detalhe && <p className="apoio mt-1 text-dim">{contestacao.detalhe}</p>}

              <form action={moderarAvaliacao} className="mt-3 space-y-2">
                <input type="hidden" name="avaliacao_id" value={avaliacao.id} />
                <textarea
                  name="nota_admin" rows={2} maxLength={600}
                  placeholder="Motivo da decisão (obrigatório para ocultar)"
                  className="w-full rounded-[10px] border border-line bg-campo px-3 py-2 text-base"
                />
                <div className="flex gap-2">
                  <button
                    name="decisao" value="manter"
                    className="h-11 flex-1 rounded-lg border border-line text-sm font-medium"
                  >
                    Manter
                  </button>
                  <button
                    name="decisao" value="ocultar"
                    className="h-11 flex-1 rounded-lg border border-crit/40 text-sm font-medium text-crit"
                  >
                    Ocultar por violação
                  </button>
                </div>
              </form>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
