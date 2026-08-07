export default function Carregando() {
  return (
    <div className="animate-pulse space-y-3" aria-busy="true" aria-label="Carregando">
      <div className="h-44 rounded-[16px] bg-panel2" />
      <div className="h-5 w-2/5 rounded bg-panel2" />
      <div className="h-20 rounded-[14px] bg-panel2" />
      <div className="h-20 rounded-[14px] bg-panel2" />
      <div className="grid grid-cols-2 gap-2">
        <div className="h-16 rounded-[10px] bg-panel2" />
        <div className="h-16 rounded-[10px] bg-panel2" />
      </div>
    </div>
  )
}
