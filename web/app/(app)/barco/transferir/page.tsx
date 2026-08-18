import Link from "next/link"
import { redirect } from "next/navigation"
import { Confirmar } from "@/components/confirmar"
import { Icone } from "@/components/icone"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { Campo } from "@/components/ui/campo"
import { carregarPainel } from "@/lib/consultas"
import { cancelarTransferencia, iniciarTransferencia } from "@/lib/acoes/transferencia"
import { supabaseServer } from "@/lib/supabase/server"
import type { Transferencia } from "@/lib/db/types"

function linkTransferencia(codigo: string): string {
  return `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3010"}/convite/${codigo}`
}

export default async function TransferirPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; criado?: string }>
}) {
  const { erro, criado } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (painel.papel !== "PROP") redirect(`/barco?erro=${encodeURIComponent("Só o proprietário transfere a embarcação.")}`)

  const supabase = await supabaseServer()
  // Expirada mas ainda "pendente" (nada zera o status sozinho) não deve
  // travar um novo pedido na tela — só o card com um link que já não
  // funciona mais. `iniciarTransferencia` cancela qualquer pendente antes
  // de criar a próxima, expirada ou não; aqui é só a exibição.
  const { data: pendente } = await supabase
    .from("transferencias")
    .select("*")
    .eq("embarcacao_id", painel.embarcacao.id)
    .eq("status", "pendente")
    .gt("expira_em", new Date().toISOString())
    .maybeSingle()
  const transferencia = pendente as Transferencia | null

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref="/barco/editar"
        voltarRotulo="Gerenciar embarcação"
        titulo="Transferir propriedade"
        descricao={`${painel.embarcacao.nome} passa a ter outro proprietário.`}
      />

      {erro && <p className="mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 corpo">{erro}</p>}

      <div className="mt-4 rounded-[var(--raio-cartao)] border border-warn/35 bg-warn/10 p-3">
        <p className="corpo font-semibold">O que acontece quando for aceito</p>
        <ul className="mt-2 space-y-1.5 corpo text-dim">
          <li>· Você perde o acesso a esta embarcação — não dá pra desfazer depois de aceito.</li>
          <li>· A tripulação atual também perde o acesso; o novo dono reconvida quem quiser.</li>
          <li>· Motores, horas, manutenções, ocorrências, fotos e documentos continuam com o barco.</li>
        </ul>
      </div>

      {criado && transferencia && (
        <p className="mt-4 rounded-lg border border-ok/40 bg-panel px-3 py-2 corpo">
          Link de transferência criado — compartilhe com quem vai assumir o barco.
        </p>
      )}

      {transferencia ? (
        <div className="sombra-1 mt-4 rounded-[var(--raio-cartao)] border border-line bg-panel p-3">
          <p className="corpo font-semibold">Transferência aguardando aceite</p>
          <p className="apoio mt-1 text-dim">
            Para <span className="text-texto">{transferencia.destinatario_email}</span> · expira em{" "}
            {new Date(transferencia.expira_em).toLocaleDateString("pt-BR")}
          </p>
          <p className="mt-3 break-all rounded-lg border border-line bg-campo px-3 py-2 font-mono-instr text-xs text-dim">
            {linkTransferencia(transferencia.codigo)}
          </p>
          {/* A fileira do canvas (tela-4d): compartilhar em contorno ocupando a
              linha, cancelar em vermelho ao lado — e cancelar SEMPRE pede
              confirmação (fluxo sensível; o link para de funcionar na hora). */}
          <div className="mt-3 flex items-center gap-2">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Você vai assumir a propriedade da ${painel.embarcacao.nome} no Commander: ${linkTransferencia(transferencia.codigo)}`)}`}
              target="_blank" rel="noopener noreferrer"
              className="flex h-11 flex-1 items-center justify-center rounded-[var(--raio-controle)] border border-line text-sm font-medium"
            >
              Compartilhar no WhatsApp
            </a>
            <form action={cancelarTransferencia} className="shrink-0">
              <input type="hidden" name="transferencia_id" value={transferencia.id} />
              <Confirmar rotulo="Cancelar" mensagem="Cancelar? O link para de funcionar." className="flex h-11 items-center px-3 text-sm font-medium text-crit" />
            </form>
          </div>
        </div>
      ) : (
        <form action={iniciarTransferencia} className="mt-4 space-y-3 rounded-[14px] border border-line bg-panel p-4">
          <Campo
            label="E-mail de quem vai assumir"
            id="email"
            name="email"
            type="email"
            required
            placeholder="novo.dono@email.com"
            dica="Ele(a) confirma pelo próprio Commander — se ainda não tiver conta, cria na hora."
          />
          <button className="w-full rounded-xl bg-accent py-3 font-semibold text-acao-texto">
            Enviar convite de transferência
          </button>
        </form>
      )}

      <p className="apoio mt-4 text-dim">
        <Icone nome="transferir" className="mr-1 inline size-3.5 align-text-bottom" />
        Prefere só dar acesso, sem trocar de dono?{" "}
        <Link href="/tripulacao" className="text-accent-forte">Convide como tripulação</Link>.
      </p>
    </main>
  )
}
