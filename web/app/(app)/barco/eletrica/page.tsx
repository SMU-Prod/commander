import Link from "next/link"
import { redirect } from "next/navigation"
import { Farol } from "@/components/farol"
import { Icone } from "@/components/icone"
import { carregarPainel, hojeISO, itemMonitoradoToItemCalc } from "@/lib/consultas"
import { calcularSemaforo, PESO, type StatusFarol } from "@/lib/domain/semaforo"
import { podeEditar, podeVer } from "@/lib/domain/permissoes"

export default async function EletricaPage() {
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (!podeVer(painel.permissoes, "eletrica")) {
    redirect(`/hoje?erro=${encodeURIComponent("Seu acesso não inclui a elétrica.")}`)
  }
  const editavel = podeEditar(painel.permissoes, "eletrica")
  const hoje = hojeISO()
  const equipamentos = painel.equipamentos.filter((e) => e.tipo !== "motor")

  const statusDe = (eqId: string): StatusFarol =>
    painel.itens
      .filter((i) => i.equipamento_id === eqId)
      .map((i) => {
        const eq = painel.equipamentos.find((e) => e.id === eqId)
        return calcularSemaforo(itemMonitoradoToItemCalc(i), eq?.horas_atuais ?? null, hoje).status
      })
      .sort((a, b) => PESO[b] - PESO[a])[0] ?? "ok"

  const rotuloTipo: Record<string, string> = {
    gerador: "Gerador", bateria: "Baterias", outro: "Equipamento", motor: "Motor",
  }

  return (
    <main>
      <Link href="/barco" className="inline-flex items-center gap-1 rotulo text-accent-forte">
        <Icone nome="voltar" className="size-4" /> Embarcação
      </Link>
      <div className="mt-3 flex items-baseline justify-between">
        <h1 className="titulo-pagina">Elétrica</h1>
        {editavel && (
          <Link href="/barco/equipamento/novo?tipo=gerador"
            className="inline-flex items-center gap-1 rounded-full bg-accent px-4 py-2 corpo font-semibold text-acao-texto">
            <Icone nome="mais" className="size-4" /> Equipamento
          </Link>
        )}
      </div>
      <p className="apoio mt-1 text-dim">Gerador, baterias e o que mais tiver manutenção própria a bordo.</p>

      <div className="sombra-1 mt-5 rounded-[14px] border border-line bg-panel px-4">
        {equipamentos.length === 0 && (
          <div className="py-6 text-center">
            <Icone nome="raio" className="mx-auto size-7 text-dim" />
            <p className="corpo mt-2 font-medium">Nada cadastrado ainda</p>
            <p className="apoio mt-1 text-dim">
              Cadastre o gerador e as baterias para o app avisar das manutenções deles também.
            </p>
          </div>
        )}
        {equipamentos.map((e) => {
          const itens = painel.itens.filter((i) => i.equipamento_id === e.id)
          return (
            <Link key={e.id} href={`/barco/equipamento/${e.id}`}
              className="flex items-center gap-3 border-b border-line py-3.5 last:border-0">
              <Farol status={statusDe(e.id)} />
              <div className="min-w-0 flex-1">
                <p className="titulo-card">
                  {rotuloTipo[e.tipo] ?? "Equipamento"}
                  {e.posicao ? ` ${e.posicao}` : ""}
                  {e.quantidade != null ? ` · ${e.quantidade}×` : ""}
                </p>
                <p className="apoio mt-0.5 text-dim">
                  {[e.marca, e.modelo].filter(Boolean).join(" ") || "Sem marca informada"}
                  {e.horas_atuais != null ? ` · ${e.horas_atuais.toLocaleString("pt-BR")} h` : ""}
                  {` · ${itens.length} ${itens.length === 1 ? "item" : "itens"}`}
                </p>
              </div>
              <Icone nome="chevron" className="size-4 text-dim" />
            </Link>
          )
        })}
      </div>
    </main>
  )
}
