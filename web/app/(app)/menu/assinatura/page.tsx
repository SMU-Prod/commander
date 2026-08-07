import Link from "next/link"
import { redirect } from "next/navigation"
import { Confirmar } from "@/components/confirmar"
import { Icone } from "@/components/icone"
import { cancelarAssinatura } from "@/lib/acoes/assinatura"
import { formatarPreco, PLANOS } from "@/lib/domain/planos"
import { supabaseServer } from "@/lib/supabase/server"
import type { Assinatura } from "@/lib/db/types"

const ROTULO_STATUS: Record<Assinatura["status"], string> = {
  pendente: "Aguardando o primeiro pagamento",
  ativa: "Ativa",
  inadimplente: "Pagamento em atraso",
  cancelada: "Cancelada",
}

export default async function AssinaturaPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data } = await supabase
    .from("assinaturas").select("*")
    .eq("usuario_id", user.id)
    .order("criado_em", { ascending: false })
    .limit(1).maybeSingle()
  const assinatura = data as Assinatura | null

  return (
    <main>
      <Link href="/menu" className="inline-flex items-center gap-1 rotulo text-accent-forte">
        <Icone nome="voltar" className="size-4" /> Menu
      </Link>
      <h1 className="titulo-pagina mt-3">Assinatura</h1>
      {erro && <p className="corpo mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      {!assinatura || assinatura.status === "cancelada" ? (
        <div className="sombra-1 mt-5 rounded-[14px] border border-line bg-panel p-4">
          <p className="titulo-card">Você ainda não é assinante</p>
          <p className="apoio mt-1 text-dim">A promo de fundador trava o preço enquanto a assinatura durar.</p>
          <Link href="/assinar" className="mt-3 block w-full rounded-xl bg-accent py-3.5 text-center font-semibold text-acao-texto">
            Ver planos
          </Link>
        </div>
      ) : (
        <div className="sombra-1 mt-5 rounded-[14px] border border-line bg-panel p-4">
          <div className="flex items-baseline justify-between">
            <p className="titulo-card">{PLANOS[assinatura.plano].rotulo}</p>
            <p className="apoio text-dim">{ROTULO_STATUS[assinatura.status]}</p>
          </div>
          <p className="corpo mt-1">
            <span className="font-semibold">{formatarPreco(assinatura.valor_centavos)}</span>
            <span className="text-dim">{assinatura.plano === "fundador_anual" ? " /ano" : " /mês"}</span>
          </p>
          {assinatura.fundador_numero !== null && (
            <p className="apoio mt-2 inline-flex items-center gap-1.5 rounded-full border border-line bg-panel2 px-3 py-1.5 text-dim">
              <Icone nome="estrela" className="size-3.5" /> Fundador #{assinatura.fundador_numero}
            </p>
          )}
          {assinatura.status === "pendente" && (
            <p className="apoio mt-3 text-dim">
              O link de pagamento foi aberto na hora da assinatura e também chega por e-mail. Pagou agora? O status atualiza sozinho em instantes.
            </p>
          )}
          <form action={cancelarAssinatura} className="mt-4">
            <Confirmar
              rotulo="Cancelar assinatura"
              mensagem="Cancelar a assinatura? O dossiê do barco fica congelado."
              className="text-sm text-crit"
            />
          </form>
        </div>
      )}
    </main>
  )
}
