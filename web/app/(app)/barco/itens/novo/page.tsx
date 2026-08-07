import Link from "next/link"
import { redirect } from "next/navigation"
import { Icone } from "@/components/icone"
import { criarItemMonitorado } from "@/lib/acoes/itens"
import { carregarPainel, hojeISO } from "@/lib/consultas"
import { CATEGORIAS_CASCO, ROTULO_CASCO } from "@/lib/domain/diario"

const campo = "w-full rounded-[10px] border border-line bg-campo px-3 py-3 text-base"
const rotulo = "mb-1.5 block font-mono-instr text-[11px] uppercase tracking-[.14em] text-dim"

export default async function NovoItemPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; alvo?: string }>
}) {
  const { erro, alvo } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")

  return (
    <main>
      <Link href="/barco" className="inline-flex items-center gap-1 rotulo text-accent-forte">
        <Icone nome="voltar" className="size-4" /> Embarcação
      </Link>
      <h1 className="mt-3 text-xl font-semibold">Novo item monitorado</h1>
      <p className="mt-1 text-sm text-dim">
        Tudo que vence por horas de uso e/ou por data — o semáforo cuida do resto.
      </p>
      {erro && <p className="mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 text-sm">{erro}</p>}

      <form action={criarItemMonitorado} className="mt-5 space-y-4">
        <div>
          <label className={rotulo} htmlFor="nome">Nome</label>
          <input id="nome" name="nome" required placeholder="Ex.: Antifouling" className={campo} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={rotulo} htmlFor="especificacao">Especificação</label>
            <input id="especificacao" name="especificacao" placeholder="Ex.: 15W40" className={campo} />
          </div>
          <div>
            <label className={rotulo} htmlFor="quantidade">Quantidade</label>
            <input id="quantidade" name="quantidade" placeholder="Ex.: 4 L" className={campo} />
          </div>
        </div>
        <div>
          <label className={rotulo} htmlFor="alvo">Pertence a</label>
          <select id="alvo" name="alvo" defaultValue={alvo ?? "emb"} className={campo}>
            <option value="emb">Embarcação (geral)</option>
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
            <label className={rotulo} htmlFor="intervalo_horas">A cada X horas</label>
            <input id="intervalo_horas" name="intervalo_horas" inputMode="decimal" placeholder="500" className={`${campo} font-mono-instr tabular-nums`} />
          </div>
          <div>
            <label className={rotulo} htmlFor="intervalo_meses">E/ou a cada X meses</label>
            <input id="intervalo_meses" name="intervalo_meses" inputMode="numeric" placeholder="18" className={`${campo} font-mono-instr tabular-nums`} />
          </div>
        </div>
        <div>
          <label className={rotulo} htmlFor="data_fixa">Ou vencimento em data fixa</label>
          <input id="data_fixa" name="data_fixa" type="date" className={campo} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={rotulo} htmlFor="ultimo_ciclo_data">Último serviço em</label>
            <input id="ultimo_ciclo_data" name="ultimo_ciclo_data" type="date" defaultValue={hojeISO()} className={campo} />
          </div>
          <div>
            <label className={rotulo} htmlFor="ultimo_ciclo_horas">Horas no último serviço</label>
            <input id="ultimo_ciclo_horas" name="ultimo_ciclo_horas" inputMode="decimal" className={`${campo} font-mono-instr tabular-nums`} />
          </div>
        </div>
        <button className="w-full rounded-xl bg-accent py-3.5 font-semibold text-acao-texto">Criar item</button>
      </form>
    </main>
  )
}
