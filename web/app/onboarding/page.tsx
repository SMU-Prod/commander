import { concluirOnboarding } from "@/lib/acoes/onboarding"

const campo = "w-full rounded-[10px] border border-line bg-[#0a1521] px-3 py-3 text-base"
const rotulo = "mb-1.5 block font-mono-instr text-[10.5px] uppercase tracking-[.14em] text-dim"

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams
  return (
    <main className="mx-auto max-w-[430px] px-5 py-8">
      <h1 className="text-2xl font-semibold">Vamos cadastrar seu barco</h1>
      <p className="mt-1 text-sm text-dim">3 passos rápidos. O resto você completa depois, aos poucos.</p>
      {erro && <p className="mt-4 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 text-sm">{erro}</p>}

      <form action={concluirOnboarding} className="mt-6 space-y-8">
        <section>
          <h2 className="font-mono-instr text-[11px] uppercase tracking-[.18em] text-accent">1 · O barco</h2>
          <div className="mt-3 space-y-3">
            <div><label className={rotulo} htmlFor="nome">Nome</label><input id="nome" name="nome" required className={campo} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={rotulo} htmlFor="estaleiro">Estaleiro</label><input id="estaleiro" name="estaleiro" className={campo} /></div>
              <div><label className={rotulo} htmlFor="modelo">Modelo</label><input id="modelo" name="modelo" className={campo} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={rotulo} htmlFor="ano">Ano</label><input id="ano" name="ano" inputMode="numeric" className={campo} /></div>
              <div><label className={rotulo} htmlFor="marina">Marina</label><input id="marina" name="marina" className={campo} /></div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="font-mono-instr text-[11px] uppercase tracking-[.18em] text-accent">2 · Motores</h2>
          <div className="mt-3 space-y-3">
            <div>
              <label className={rotulo} htmlFor="qtd_motores">Quantos motores?</label>
              <select id="qtd_motores" name="qtd_motores" defaultValue="2" className={campo}>
                <option value="1">1 motor</option>
                <option value="2">2 motores (BB e BE)</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={rotulo} htmlFor="motor_marca">Marca</label><input id="motor_marca" name="motor_marca" className={campo} /></div>
              <div><label className={rotulo} htmlFor="motor_modelo">Modelo</label><input id="motor_modelo" name="motor_modelo" className={campo} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={rotulo} htmlFor="horas_bb">Horas BB (ou único)</label><input id="horas_bb" name="horas_bb" inputMode="decimal" className={campo} /></div>
              <div><label className={rotulo} htmlFor="horas_be">Horas BE</label><input id="horas_be" name="horas_be" inputMode="decimal" className={campo} /></div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="font-mono-instr text-[11px] uppercase tracking-[.18em] text-accent">3 · Vencimentos críticos</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div><label className={rotulo} htmlFor="seguro_validade">Seguro vence em</label><input id="seguro_validade" name="seguro_validade" type="date" className={campo} /></div>
            <div><label className={rotulo} htmlFor="tie_validade">TIE vence em</label><input id="tie_validade" name="tie_validade" type="date" className={campo} /></div>
          </div>
        </section>

        <button className="w-full rounded-xl bg-accent py-3.5 font-semibold text-[#04121d]">
          Criar meu painel de bordo
        </button>
      </form>
    </main>
  )
}
