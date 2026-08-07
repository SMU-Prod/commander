import { Logo } from "@/components/logo"

// Layout minimalista do parceiro comercial: só a marca e o conteúdo. O
// parceiro não é tripulante — não vê bottom-nav nem o resto do app do barco.
export default function ParceiroLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-[430px] px-4 pb-10 pt-6">
      <div className="mb-6 text-lg"><Logo /></div>
      {children}
    </div>
  )
}
