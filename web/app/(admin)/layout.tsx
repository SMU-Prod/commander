import { Logo } from "@/components/logo"

// Layout minimalista do Admin Commander (onda 35, Correção 19): só a marca e
// o conteúdo — não é tela de tripulante, não mostra bottom-nav. Cada página
// confirma `exigirAdmin()` por conta própria (defesa em profundidade, além
// da RLS/RPC do banco).
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-[560px] px-4 pb-10 pt-6">
      <div className="mb-6 text-xl"><Logo /></div>
      {children}
    </div>
  )
}
