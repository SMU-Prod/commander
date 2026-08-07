import { redirect } from "next/navigation"
import { Icone } from "@/components/icone"
import { assinar } from "@/lib/acoes/assinatura"
import { ANCORA_MENSAL_CENTAVOS, formatarPreco, PLANOS } from "@/lib/domain/planos"
import { campo, rot } from "@/lib/ui/form"
import { supabaseServer } from "@/lib/supabase/server"

export default async function AssinarPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login?volta=/assinar")

  const { data: vagas } = await supabase.rpc("vagas_fundador_restantes")
  const restantes = typeof vagas === "number" ? vagas : null

  return (
    <main>
      <p className="rotulo text-dim">Commander</p>
      <h1 className="titulo-pagina mt-2">Seja fundador</h1>
      <p className="corpo mt-2 text-dim">
        Preço travado enquanto a assinatura durar, prioridade no concierge de bordo
        e o número de fundador gravado no seu perfil.
      </p>
      {restantes !== null && (
        <p className="apoio mt-2 inline-flex items-center gap-1.5 rounded-full border border-line bg-panel px-3 py-1.5 text-dim">
          <Icone nome="estrela" className="size-3.5" /> Restam {restantes} de 100 vagas
        </p>
      )}

      {erro && <p className="corpo mt-4 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      <form action={assinar} className="mt-5 space-y-4">
        <div className="space-y-2.5">
          <label className="sombra-1 block cursor-pointer rounded-[14px] border border-line bg-panel p-4 has-[:checked]:border-accent">
            <div className="flex items-center justify-between">
              <span className="titulo-card">{PLANOS.fundador_anual.rotulo}</span>
              <input type="radio" name="plano" value="fundador_anual" defaultChecked className="size-5 accent-[var(--acao)]" />
            </div>
            <p className="corpo mt-1">
              <span className="font-semibold">{formatarPreco(PLANOS.fundador_anual.valorCentavos)}</span>
              <span className="text-dim"> /ano — 2 meses grátis</span>
            </p>
          </label>
          <label className="sombra-1 block cursor-pointer rounded-[14px] border border-line bg-panel p-4 has-[:checked]:border-accent">
            <div className="flex items-center justify-between">
              <span className="titulo-card">{PLANOS.fundador_mensal.rotulo}</span>
              <input type="radio" name="plano" value="fundador_mensal" className="size-5 accent-[var(--acao)]" />
            </div>
            <p className="corpo mt-1">
              <span className="apoio text-dim line-through">{formatarPreco(ANCORA_MENSAL_CENTAVOS)}</span>{" "}
              <span className="font-semibold">{formatarPreco(PLANOS.fundador_mensal.valorCentavos)}</span>
              <span className="text-dim"> /mês</span>
            </p>
          </label>
        </div>

        <div className="sombra-1 space-y-3 rounded-[14px] border border-line bg-panel p-4">
          <div>
            <label htmlFor="nome" className={rot}>Nome completo</label>
            <input id="nome" name="nome" required minLength={5} className={campo} autoComplete="name" />
          </div>
          <div>
            <label htmlFor="cpf" className={rot}>CPF</label>
            <input id="cpf" name="cpf" required inputMode="numeric" placeholder="000.000.000-00" className={campo} />
            <p className="apoio mt-1.5 text-dim">Exigido pelo sistema de pagamento para emitir a cobrança.</p>
          </div>
        </div>

        <button className="w-full rounded-xl bg-accent py-3.5 font-semibold text-acao-texto">
          Continuar para o pagamento
        </button>
        <p className="apoio text-center text-dim">
          Cartão ou Pix, direto na página segura do Asaas. Nada de cartão aqui no app.
        </p>
      </form>
    </main>
  )
}
