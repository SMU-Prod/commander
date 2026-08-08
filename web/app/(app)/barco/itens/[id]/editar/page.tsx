import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { Confirmar } from "@/components/confirmar"
import { Icone } from "@/components/icone"
import { excluirItemMonitorado, salvarItemMonitorado } from "@/lib/acoes/itens"
import { carregarPainel } from "@/lib/consultas"
import { abaDoItem, CATEGORIAS_CASCO, ROTULO_CASCO } from "@/lib/domain/diario"
import { podeEditar, ROTULO_ABA } from "@/lib/domain/permissoes"
import { campo, numeroParaCampoPtBr, rot } from "@/lib/ui/form"

export default async function EditarItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ erro?: string }>
}) {
  const { id } = await params
  const { erro } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const item = painel.itens.find((i) => i.id === id)
  if (!item) notFound()

  const aba = abaDoItem(item, painel.equipamentos)
  if (!podeEditar(painel.permissoes, aba)) {
    redirect(`/barco?erro=${encodeURIComponent(`Seu acesso não permite editar ${ROTULO_ABA[aba]}.`)}`)
  }
  const ehDocumento = item.categoria === "documento"

  const alvoAtual = item.equipamento_id
    ? `eq:${item.equipamento_id}`
    : item.categoria
      ? `cat:${item.categoria}`
      : "emb"

  const voltarPara = item.equipamento_id
    ? `/barco/equipamento/${item.equipamento_id}`
    : item.categoria === "documento"
      ? "/barco/documentos"
      : "/barco"

  return (
    <main>
      <Link href={voltarPara} className="inline-flex items-center gap-1 rotulo text-accent-forte">
        <Icone nome="voltar" className="size-4" /> Voltar
      </Link>
      <h1 className="titulo-pagina mt-3">{ehDocumento ? "Editar vencimento" : "Editar manutenção"}</h1>
      {erro && <p className="corpo mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      <form action={salvarItemMonitorado} className="mt-5 space-y-4">
        <input type="hidden" name="item_id" value={id} />
        <div>
          <label className={rot} htmlFor="nome">Nome</label>
          <input id="nome" name="nome" required defaultValue={item.nome} placeholder="Ex.: Antifouling" className={campo} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={rot} htmlFor="especificacao">Especificação</label>
            <input id="especificacao" name="especificacao" defaultValue={item.especificacao ?? ""} placeholder="Ex.: 15W40" className={campo} />
          </div>
          <div>
            <label className={rot} htmlFor="quantidade">Quantidade</label>
            <input id="quantidade" name="quantidade" defaultValue={item.quantidade ?? ""} placeholder="Ex.: 4 L" className={campo} />
          </div>
        </div>
        <div>
          <label className={rot} htmlFor="alvo">Pertence a</label>
          <select id="alvo" name="alvo" defaultValue={alvoAtual} className={campo}>
            <option value="emb">Embarcação (geral)</option>
            {item.categoria === "documento" && <option value="cat:documento">Documento (vencimento)</option>}
            {painel.equipamentos.map((e) => (
              <option key={e.id} value={`eq:${e.id}`}>
                {(e.tipo === "motor" ? "Motor" : e.tipo === "gerador" ? "Gerador" : "Equipamento")} {e.posicao ?? ""}
              </option>
            ))}
            {CATEGORIAS_CASCO.map((c) => (
              <option key={c} value={`cat:${c}`}>Casco — {ROTULO_CASCO[c]}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={rot} htmlFor="intervalo_horas">A cada X horas</label>
            <input id="intervalo_horas" name="intervalo_horas" inputMode="decimal"
              defaultValue={numeroParaCampoPtBr(item.intervalo_horas)} placeholder="500"
              className={`${campo} font-mono-instr tabular-nums`} />
          </div>
          <div>
            <label className={rot} htmlFor="intervalo_meses">E/ou a cada X meses</label>
            <input id="intervalo_meses" name="intervalo_meses" inputMode="numeric"
              defaultValue={numeroParaCampoPtBr(item.intervalo_meses)} placeholder="18"
              className={`${campo} font-mono-instr tabular-nums`} />
          </div>
        </div>
        <div>
          <label className={rot} htmlFor="data_fixa">Ou vencimento em data fixa</label>
          <input id="data_fixa" name="data_fixa" type="date" defaultValue={item.data_fixa ?? ""} className={campo} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={rot} htmlFor="ultimo_ciclo_data">Último serviço em</label>
            <input id="ultimo_ciclo_data" name="ultimo_ciclo_data" type="date"
              defaultValue={item.ultimo_ciclo_data ?? ""} className={campo} />
          </div>
          <div>
            <label className={rot} htmlFor="ultimo_ciclo_horas">Horas no último serviço</label>
            <input id="ultimo_ciclo_horas" name="ultimo_ciclo_horas" inputMode="decimal"
              defaultValue={numeroParaCampoPtBr(item.ultimo_ciclo_horas)} className={`${campo} font-mono-instr tabular-nums`} />
          </div>
        </div>
        <button className="w-full rounded-xl bg-accent py-3.5 font-semibold text-acao-texto">
          {ehDocumento ? "Salvar vencimento" : "Salvar manutenção"}
        </button>
      </form>

      <form action={excluirItemMonitorado} className="mt-8 flex justify-center">
        <input type="hidden" name="item_id" value={id} />
        <Confirmar
          mensagem={ehDocumento ? "Excluir esse vencimento e seu histórico?" : "Excluir essa manutenção e seu histórico?"}
          rotulo={ehDocumento ? "Excluir vencimento" : "Excluir manutenção"}
          className="flex h-11 items-center corpo text-crit"
        />
      </form>
    </main>
  )
}
