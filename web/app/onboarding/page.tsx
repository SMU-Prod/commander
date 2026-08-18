import { redirect } from "next/navigation"
import { carregarPainel } from "@/lib/consultas"
import { supabaseServer } from "@/lib/supabase/server"
import { WizardOnboarding } from "./wizard"

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

  const { erro } = await searchParams
  // O formulário virou o wizard de 4 passos do canvas tela-3j (onda 62,
  // aprovado pelo dono) — client component porque passo é estado de tela;
  // a action de submit continua sendo a `concluirOnboarding` de sempre.
  return <WizardOnboarding jaTemBarco={painel != null} erro={erro ?? null} />
}
