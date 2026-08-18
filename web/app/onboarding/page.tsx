import Link from "next/link"
import { redirect } from "next/navigation"
import { GuardaFormulario } from "@/components/guarda-formulario"
import { Icone } from "@/components/icone"
import { Logo } from "@/components/logo"
import { Campo, CampoSelect } from "@/components/ui/campo"
import { concluirOnboarding } from "@/lib/acoes/onboarding"
import { carregarPainel } from "@/lib/consultas"
import { supabaseServer } from "@/lib/supabase/server"
import { linhaCampos } from "@/lib/ui/form"

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  // Esta tela serve pro PRIMEIRO barco e pra qualquer outro depois: antes ela
  // expulsava quem já tinha embarcação, e não existia caminho nenhum pra
  // cadastrar a segunda. Só exige estar logado.
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login?volta=/onboarding")
  const painel = await carregarPainel()
  const jaTemBarco = painel != null

  const { erro } = await searchParams
  return (
    <main className="mx-auto max-w-[430px] px-5 py-8">
      {jaTemBarco && (
        <Link href="/menu" className="rotulo inline-flex items-center gap-1 text-accent-forte">
          <Icone nome="voltar" className="size-4" /> Menu
        </Link>
      )}

      {/* Canvas tela-3j: a marca abre a tela — no cadastro não há barra
          inferior nem pra onde navegar, o wordmark é o que diz onde a pessoa
          está. O contador "2 de 4" do canvas não entra: lá o cadastro é um
          assunto por passo; aqui ele ainda é UMA página com três seções —
          divergência de FLUXO relatada, não reestruturada por conta. */}
      <div className={`text-[11px] ${jaTemBarco ? "mt-4" : ""}`}>
        <Logo />
      </div>

      <h1 className="titulo-pagina mt-7">
        {jaTemBarco ? "Cadastrar outra embarcação" : "Qual é a sua embarcação?"}
      </h1>
      <p className="corpo mt-2 text-dim">
        {jaTemBarco
          ? "Ela vira a embarcação ativa — você troca a qualquer momento pelo nome no topo da tela Início."
          : "Só o nome é obrigatório. O resto você completa quando quiser — e a Saúde só liga quando houver dado real."}
      </p>
      {erro && <p className="mt-4 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 text-sm">{erro}</p>}

      <form action={concluirOnboarding} className="mt-6 space-y-8">
        {/* O erro de limite do plano volta com `?erro=` e antes apagava tudo
            que a pessoa digitou — no PRIMEIRO contato com o app. A guarda
            restaura (PRD §24, mesma peça dos outros formulários). */}
        <GuardaFormulario chave="onboarding" />

        <section>
          <h2 className="font-mono-instr text-[11px] uppercase tracking-[.18em] text-accent-forte">1 · O barco</h2>
          <div className="mt-3 space-y-3">
            <Campo label="Nome" id="nome" name="nome" required />
            <div className={linhaCampos}>
              <Campo label="Estaleiro" id="estaleiro" name="estaleiro" />
              <Campo label="Modelo" id="modelo" name="modelo" />
            </div>
            <div className={linhaCampos}>
              <Campo label="Ano" id="ano" name="ano" inputMode="numeric" />
            </div>
            {/* "Onde ela fica" (canvas) em vez de "Marina" seco. A nota é a
                versão honesta da do canvas: aqui só o NOME é gravado — quem
                liga o boletim é a posição, marcada depois no mapa. */}
            <Campo
              label="Onde ela fica"
              id="marina"
              name="marina"
              placeholder="Ex.: Marina Verolme, Angra dos Reis"
              dica="Depois você marca a posição no mapa — é ela que liga o boletim de onda, vento e água na sua Início."
            />
          </div>
        </section>

        <section>
          <h2 className="font-mono-instr text-[11px] uppercase tracking-[.18em] text-accent-forte">2 · Motores</h2>
          <div className="mt-3 space-y-3">
            <CampoSelect label="Quantos motores?" id="qtd_motores" name="qtd_motores" defaultValue="2">
              <option value="1">1 motor</option>
              <option value="2">2 motores (BB e BE)</option>
            </CampoSelect>
            <div className={linhaCampos}>
              <Campo label="Marca" id="motor_marca" name="motor_marca" />
              <Campo label="Modelo" id="motor_modelo" name="motor_modelo" />
            </div>
            <div className={linhaCampos}>
              <Campo label="Horas BB (ou único)" id="horas_bb" name="horas_bb" inputMode="decimal" />
              <Campo label="Horas BE" id="horas_be" name="horas_be" inputMode="decimal" />
            </div>
          </div>
        </section>

        <section>
          <h2 className="font-mono-instr text-[11px] uppercase tracking-[.18em] text-accent-forte">3 · Vencimentos críticos</h2>
          <div className={`mt-3 ${linhaCampos}`}>
            <Campo label="Seguro vence em" id="seguro_validade" name="seguro_validade" type="date" />
            <Campo label="TIE vence em" id="tie_validade" name="tie_validade" type="date" />
          </div>
        </section>

        <button className="h-12 w-full rounded-[var(--raio-controle)] bg-accent font-semibold text-acao-texto">
          {jaTemBarco ? "Cadastrar embarcação" : "Criar meu painel de bordo"}
        </button>
      </form>
    </main>
  )
}
