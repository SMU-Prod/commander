import { redirect } from "next/navigation"
import { Suspense } from "react"
import { BottomNav } from "@/components/bottom-nav"
import { RegistroRapido } from "@/components/registro-rapido"
import { RegistrarSw } from "@/components/registrar-sw"
import { Toast } from "@/components/toast"
import { carregarPainel } from "@/lib/consultas"
import { supabaseServer } from "@/lib/supabase/server"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const painel = await carregarPainel()

  // Gate de cobranca — so liga com a flag, para o deploy sair antes da cobranca
  // estar pronta. So o PROP paga; CMDT/tripulacao nunca ve paywall. Usuario sem
  // embarcacao (painel null) segue pro onboarding como hoje — o gate nao entra aqui.
  if (process.env.NEXT_PUBLIC_COBRANCA_ATIVA === "1" && painel?.papel === "PROP") {
    const supabase = await supabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      // pendente NAO libera: quem nunca pagou cai em /assinar, que reabre a
      // cobranca em aberto. Inadimplente entra (carencia — o Asaas cobra;
      // SUBSCRIPTION_DELETED encerra a carencia via webhook).
      const { data: viva } = await supabase
        .from("assinaturas").select("status")
        .eq("usuario_id", user.id).in("status", ["ativa", "inadimplente"])
        .maybeSingle()
      if (!viva) redirect("/assinar")
    }
  }

  const motores = (painel?.equipamentos ?? [])
    .filter((e) => e.tipo === "motor")
    .map((e) => ({ id: e.id, rotulo: e.posicao ?? "Motor", horas: e.horas_atuais }))
  // pb-36 e não pb-24: o botão "+ Registrar" flutua a 5rem do rodapé e tem
  // ~3rem de altura, então o conteúdo precisa de ~8rem de folga — com pb-24
  // (6rem) ele cobria o último item da tela.
  return (
    <div className="mx-auto min-h-dvh max-w-[430px] px-4 pb-36 pt-5">
      <RegistrarSw />
      <Suspense fallback={null}>
        <Toast />
      </Suspense>
      {children}
      {motores.length > 0 && <RegistroRapido motores={motores} />}
      <BottomNav />
    </div>
  )
}
