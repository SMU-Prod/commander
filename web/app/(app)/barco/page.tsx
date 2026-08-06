import Link from "next/link"
import { redirect } from "next/navigation"
import { Farol } from "@/components/farol"
import { Horimetro } from "@/components/horimetro"
import { CATEGORIAS_CASCO, ROTULO_CASCO } from "@/lib/domain/diario"
import { calcularSemaforo, PESO, type StatusFarol } from "@/lib/domain/semaforo"
import { carregarPainel, hojeISO, itemMonitoradoToItemCalc } from "@/lib/consultas"

export default async function BarcoPage() {
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const { embarcacao, equipamentos, itens } = painel
  const hoje = hojeISO()

  const statusDoEquipamento = (eqId: string): StatusFarol =>
    itens
      .filter((i) => i.equipamento_id === eqId)
      .map((i) => {
        const eq = equipamentos.find((e) => e.id === eqId)
        return calcularSemaforo(itemMonitoradoToItemCalc(i), eq?.horas_atuais ?? null, hoje).status
      })
      .sort((a, b) => PESO[b] - PESO[a])[0] ?? "ok"

  const motores = equipamentos.filter((e) => e.tipo === "motor")
  const documentos = itens.filter(
    (i) => i.categoria === "documento" || (i.categoria === null && i.equipamento_id === null),
  )

  return (
    <main>
      <h1 className="text-xl font-semibold">{embarcacao.nome}</h1>
      <p className="text-sm text-dim">
        {[embarcacao.estaleiro, embarcacao.modelo, embarcacao.ano].filter(Boolean).join(" · ")}
      </p>

      <p className="mt-6 mb-2 font-mono-instr text-[10.5px] uppercase tracking-[.16em] text-dim">Motores</p>
      <div className="grid grid-cols-2 gap-2">
        {motores.map((m) => (
          <Link key={m.id} href={`/barco/equipamento/${m.id}`}>
            <Horimetro
              rotulo={m.posicao ?? "Motor"}
              horas={m.horas_atuais ?? 0}
              status={statusDoEquipamento(m.id)}
            />
          </Link>
        ))}
      </div>

      <p className="mt-6 mb-2 font-mono-instr text-[10.5px] uppercase tracking-[.16em] text-dim">Casco</p>
      <div className="rounded-[14px] border border-line bg-panel px-4">
        {CATEGORIAS_CASCO.map((c) => {
          const doGrupo = itens.filter((i) => i.categoria === c)
          const status = doGrupo
            .map((i) => calcularSemaforo(itemMonitoradoToItemCalc(i), null, hoje).status)
            .sort((a, b) => PESO[b] - PESO[a])[0]
          return (
            <div key={c} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
              {status ? <Farol status={status} /> : <span className="size-2 rounded-full border border-line" />}
              <span className="flex-1 text-sm">{ROTULO_CASCO[c]}</span>
              {doGrupo.length === 0 ? (
                <Link href={`/barco/itens/novo?alvo=${encodeURIComponent(`cat:${c}`)}`} className="text-xs text-accent-forte">
                  Monitorar
                </Link>
              ) : (
                <span className="font-mono-instr text-xs tabular-nums text-dim">{doGrupo.length} itens</span>
              )}
            </div>
          )
        })}
      </div>

      <p className="mt-6 mb-2 font-mono-instr text-[10.5px] uppercase tracking-[.16em] text-dim">Documentos e embarcação</p>
      <div className="rounded-[14px] border border-line bg-panel px-4">
        {documentos.length === 0 && (
          <p className="py-4 text-sm text-dim">Nenhum vencimento cadastrado ainda.</p>
        )}
        {documentos.map((i) => {
          const r = calcularSemaforo(itemMonitoradoToItemCalc(i), null, hoje)
          return (
            <div key={i.id} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
              <Farol status={r.status} />
              <span className="flex-1 text-sm">{i.nome}</span>
              <span className="font-mono-instr text-xs tabular-nums text-dim">
                {r.diasRestantes != null
                  ? r.diasRestantes < 0
                    ? `vencido há ${-r.diasRestantes} d`
                    : `${r.diasRestantes} dias`
                  : "—"}
              </span>
            </div>
          )
        })}
      </div>

      <p className="mt-6 mb-2 font-mono-instr text-[10.5px] uppercase tracking-[.16em] text-dim">Acervo do barco</p>
      <div className="grid grid-cols-2 gap-2">
        {[
          { href: "/diario", rotulo: "Diário de Bordo", desc: "todo o histórico" },
          { href: "/barco/documentos", rotulo: "Documentos", desc: "validade e arquivos" },
          { href: "/barco/contatos", rotulo: "Contatos", desc: "quem cuida do barco" },
          { href: "/barco/gastos", rotulo: "Gastos", desc: "custos por mês" },
        ].map((c) => (
          <Link key={c.href} href={c.href} className="rounded-[14px] border border-line bg-panel p-3.5">
            <p className="text-sm font-semibold">{c.rotulo}</p>
            <p className="mt-0.5 text-xs text-dim">{c.desc}</p>
          </Link>
        ))}
      </div>
    </main>
  )
}
