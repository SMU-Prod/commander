import Link from "next/link"
import { redirect } from "next/navigation"
import { Farol } from "@/components/farol"
import { Icone } from "@/components/icone"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { LinhaLista } from "@/components/ui/linha-lista"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { carregarPainel, hojeISO, itemMonitoradoToItemCalc } from "@/lib/consultas"
import { CATEGORIAS_HIDRAULICA, ROTULO_HIDRAULICA } from "@/lib/domain/diario"
import { faroDoEstado, ROTULO_ESTADO } from "@/lib/domain/ocorrencias"
import { podeEditar, podeVer } from "@/lib/domain/permissoes"
import { calcularSemaforo, formatarDataCurta, vencimentoPorData } from "@/lib/domain/semaforo"
import { supabaseServer } from "@/lib/supabase/server"
import type { Ocorrencia } from "@/lib/db/types"

export default async function HidraulicaPage() {
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (!podeVer(painel.permissoes, "hidraulica")) {
    redirect(`/hoje?erro=${encodeURIComponent("Seu acesso não inclui a hidráulica.")}`)
  }
  const editavel = podeEditar(painel.permissoes, "hidraulica")
  const hoje = hojeISO()
  const itens = painel.itens.filter((i) => (CATEGORIAS_HIDRAULICA as readonly string[]).includes(i.categoria ?? ""))

  const supabase = await supabaseServer()
  const { data: ocorrenciasBrutas } = await supabase.from("ocorrencias")
    .select("*").eq("embarcacao_id", painel.embarcacao.id).eq("aba", "hidraulica")
    .neq("estado", "resolvida").order("created_at", { ascending: false })
  const ocorrencias = (ocorrenciasBrutas ?? []) as Ocorrencia[]

  return (
    <main>
      <Link href="/barco" className="inline-flex items-center gap-1 rotulo text-accent-forte">
        <Icone nome="voltar" className="size-4" /> Barco
      </Link>
      <h1 className="mt-3 titulo-pagina">Hidráulica</h1>
      <p className="apoio mt-1 text-dim">
        Água doce é o que a embarcação bebe/usa; Grey Water é o esgoto de pia e chuveiro; Black Water é o
        esgoto do banheiro — sistemas separados, com manutenção própria cada um.
      </p>

      {ocorrencias.length > 0 && (
        <>
          <SecaoPagina icone="alerta" acao={{ href: "/barco/ocorrencias?setor=hidraulica", rotulo: "Ver todas" }}>
            Ocorrências abertas
          </SecaoPagina>
          <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
            {ocorrencias.map((o) => (
              <LinhaLista
                key={o.id}
                href={`/barco/ocorrencias/${o.id}`}
                leading={<Farol status={faroDoEstado(o.estado)} />}
                titulo={o.titulo}
                valor={ROTULO_ESTADO[o.estado]}
              />
            ))}
          </div>
        </>
      )}

      {CATEGORIAS_HIDRAULICA.map((c) => {
        const doGrupo = itens.filter((i) => i.categoria === c)
        return (
          <div key={c}>
            <SecaoPagina
              acao={editavel ? { href: `/barco/itens/novo?alvo=${encodeURIComponent(`cat:${c}`)}`, rotulo: "Adicionar", icone: "mais" } : undefined}
            >
              {ROTULO_HIDRAULICA[c]}
            </SecaoPagina>
            <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
              {doGrupo.length === 0 && (
                <EstadoVazio variant="linha" icone="oleo" titulo="Nada cadastrado ainda" />
              )}
              {doGrupo.map((i) => {
                const r = calcularSemaforo(itemMonitoradoToItemCalc(i), null, hoje)
                const venc = vencimentoPorData(itemMonitoradoToItemCalc(i))
                const dias = r.diasRestantes != null
                  ? r.diasRestantes < 0 ? `vencido há ${-r.diasRestantes} d` : `${r.diasRestantes} dias`
                  : "—"
                return (
                  <LinhaLista
                    key={i.id}
                    href={editavel ? `/barco/itens/${i.id}/editar` : undefined}
                    leading={<Farol status={r.status} />}
                    titulo={i.nome}
                    valor={`${dias}${venc ? ` · ${formatarDataCurta(venc)}` : ""}`}
                    valorClassName={r.status === "vencido" ? "text-crit" : r.status === "atencao" ? "text-warn" : "text-dim"}
                  />
                )
              })}
            </div>
          </div>
        )
      })}
    </main>
  )
}
