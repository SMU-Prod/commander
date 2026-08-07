import Link from "next/link"
import { redirect } from "next/navigation"
import { Farol } from "@/components/farol"
import { CardEmbarcacao } from "@/components/card-embarcacao"
import { Horimetro } from "@/components/horimetro"
import { Icone } from "@/components/icone"
import { CATEGORIAS_CASCO, ROTULO_CASCO } from "@/lib/domain/diario"
import { calcularSemaforo, PESO, type StatusFarol } from "@/lib/domain/semaforo"
import { carregarPainel, hojeISO, itemMonitoradoToItemCalc } from "@/lib/consultas"
import { podeVer, podeEditar, type Aba } from "@/lib/domain/permissoes"
import { supabaseServer } from "@/lib/supabase/server"

export default async function BarcoPage() {
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const { embarcacao, equipamentos, itens, papel, permissoes } = painel
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

  const statusGeral: StatusFarol =
    itens
      .map((i) => {
        const eq = equipamentos.find((e) => e.id === i.equipamento_id)
        return calcularSemaforo(itemMonitoradoToItemCalc(i), eq?.horas_atuais ?? null, hoje).status
      })
      .sort((a, b) => PESO[b] - PESO[a])[0] ?? "ok"

  const supabase = await supabaseServer()
  const urlCapa = embarcacao.foto_capa_path
    ? (await supabase.storage.from("acervo").createSignedUrl(embarcacao.foto_capa_path, 3600)).data?.signedUrl ?? null
    : null

  return (
    <main>
      <CardEmbarcacao
        embarcacao={embarcacao}
        statusGeral={statusGeral}
        urlCapa={urlCapa}
        podeEditarFotos={podeEditar(permissoes, "fotos")}
      />

      <p className="rotulo text-dim mt-6 mb-2 inline-flex items-center gap-1.5">
        <Icone nome="motor" className="size-3.5" /> Motores
      </p>
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

      <p className="rotulo text-dim mt-6 mb-2 inline-flex items-center gap-1.5">
        <Icone nome="escudo" className="size-3.5" /> Casco
      </p>
      <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
        {CATEGORIAS_CASCO.map((c) => {
          const doGrupo = itens.filter((i) => i.categoria === c)
          const status = doGrupo
            .map((i) => calcularSemaforo(itemMonitoradoToItemCalc(i), null, hoje).status)
            .sort((a, b) => PESO[b] - PESO[a])[0]
          return (
            <div key={c} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
              {status ? <Farol status={status} /> : <span className="size-2 rounded-full border border-line" />}
              <span className="corpo flex-1">{ROTULO_CASCO[c]}</span>
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

      <p className="rotulo text-dim mt-6 mb-2 inline-flex items-center gap-1.5">
        <Icone nome="documento" className="size-3.5" /> Documentos e embarcação
      </p>
      <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
        {documentos.length === 0 && (
          <p className="corpo py-4 text-dim">Nenhum vencimento cadastrado ainda.</p>
        )}
        {documentos.map((i) => {
          const r = calcularSemaforo(itemMonitoradoToItemCalc(i), null, hoje)
          return (
            <div key={i.id} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
              <Farol status={r.status} />
              <span className="corpo flex-1">{i.nome}</span>
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

      <p className="rotulo text-dim mt-6 mb-2 inline-flex items-center gap-1.5">
        <Icone nome="imagem" className="size-3.5" /> Acervo do barco
      </p>
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            { href: "/barco/fotos", rotulo: "Fotos", desc: "álbuns do barco", aba: "fotos" },
            { href: "/diario", rotulo: "Diário de Bordo", desc: "todo o histórico" },
            { href: "/barco/documentos", rotulo: "Documentos", desc: "validade e arquivos", aba: "documentos" },
            { href: "/barco/contatos", rotulo: "Contatos", desc: "quem cuida do barco", aba: "contatos" },
            { href: "/barco/gastos", rotulo: "Gastos", desc: "custos por mês", aba: "gastos" },
          ] as { href: string; rotulo: string; desc: string; aba?: Aba }[]
        )
          .filter((c) => !c.aba || podeVer(permissoes, c.aba))
          .map((c) => (
            <Link key={c.href} href={c.href} className="sombra-1 rounded-[14px] border border-line bg-panel p-3.5">
              <p className="titulo-card">{c.rotulo}</p>
              <p className="apoio mt-0.5 text-dim">{c.desc}</p>
            </Link>
          ))}
      </div>

      {papel === "PROP" && (
        <Link href="/barco/local" className="sombra-1 mt-2 block rounded-[14px] border border-line bg-panel p-3.5">
          <p className="titulo-card">Posição da marina</p>
          <p className="apoio mt-0.5 text-dim">
            {embarcacao.marina_lat != null && embarcacao.marina_lon != null
              ? `${embarcacao.marina_lat.toFixed(4)}, ${embarcacao.marina_lon.toFixed(4)}`
              : "Defina para ligar o boletim do mar"}
          </p>
        </Link>
      )}
    </main>
  )
}
