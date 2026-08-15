import Link from "next/link"
import { Icone } from "@/components/icone"
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
      <Link href="/admin" className="rotulo inline-flex items-center gap-1 text-accent-forte">
        <Icone nome="voltar" className="size-4" /> Admin Commander
      </Link>
      <h1 className="titulo-pagina mt-3">Logs administrativos</h1>
      <p className="apoio mt-1 text-dim">
        {tudo
          ? "Todas as ações administrativas registradas. O registro não é editável nem apagável — nem por você."
          : "As suas ações administrativas. O registro não é editável nem apagável."}
      </p>

      <div className="mt-5">
        {logs.length === 0 ? (
          <EstadoVazio
            icone="documento"
            titulo="Nenhuma ação registrada ainda"
            descricao="Conceder função, editar taxonomia e decidir um pedido aparecem aqui assim que acontecerem."
          />
        ) : (
          <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
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
