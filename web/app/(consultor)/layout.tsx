import { Logo } from "@/components/logo"

// Layout minimalista do consultor náutico (onda 35) — mesma família visual
// de (parceiro)/(admin): sem bottom-nav, o consultor não é tripulante.
export default function ConsultorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-[430px] px-4 pb-10 pt-6">
      <div className="mb-6 text-lg"><Logo /></div>
      {children}
    </div>
  )
}
