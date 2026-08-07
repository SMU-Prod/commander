import { Suspense } from "react"
import { BottomNav } from "@/components/bottom-nav"
import { RegistroRapido } from "@/components/registro-rapido"
import { RegistrarSw } from "@/components/registrar-sw"
import { Toast } from "@/components/toast"
import { carregarPainel } from "@/lib/consultas"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const painel = await carregarPainel()
  const motores = (painel?.equipamentos ?? [])
    .filter((e) => e.tipo === "motor")
    .map((e) => ({ id: e.id, rotulo: e.posicao ?? "Motor", horas: e.horas_atuais }))
  return (
    <div className="mx-auto min-h-dvh max-w-[430px] px-4 pb-24 pt-5">
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
