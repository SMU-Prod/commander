import { BottomNav } from "@/components/bottom-nav"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh max-w-[430px] px-4 pb-24 pt-5">
      {children}
      <BottomNav />
    </div>
  )
}
