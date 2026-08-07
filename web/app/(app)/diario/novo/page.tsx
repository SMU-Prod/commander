import { redirect } from "next/navigation"
import { Icone } from "@/components/icone"
import { criarEvento } from "@/lib/acoes/eventos"
import { carregarPainel, hojeISO } from "@/lib/consultas"
import { CATEGORIAS_CASCO, ROTULO_CASCO } from "@/lib/domain/diario"
import { supabaseServer } from "@/lib/supabase/server"

const campo = "w-full rounded-[10px] border border-line bg-campo px-3 py-3 text-base"
const rotulo = "mb-1.5 block font-mono-instr text-[11px] uppercase tracking-[.14em] text-dim"

const TIPOS = [
  ["manutencao", "Manutenção"], ["abastecimento", "Abastecimento"], ["navegacao", "Navegação"],
  ["avaria", "Avaria"], ["docagem", "Docagem"], ["outro", "Outro"],
] as const

export default async function NovoEventoPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; alvo?: string; item?: string; custo?: string }>
}) {
  const { erro, alvo, item, custo } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const supabase = await supabaseServer()
  const { data: contatos } = await supabase
    .from("contatos").select("id, nome, especialidade").order("nome")

  const nomeAlvo = (id: string | null) => {
    const eq = painel.equipamentos.find((e) => e.id === id)
    return eq ? `${eq.tipo === "motor" ? "Motor" : eq.tipo === "gerador" ? "Gerador" : "Equip."} ${eq.posicao ?? ""}`.trim() : ""
  }

  return (
    <main>
      <a href="/diario" className="inline-flex items-center gap-1 rotulo text-accent-forte">
        <Icone nome="voltar" className="size-4" /> Diário
      </a>
      <h1 className="mt-3 text-xl font-semibold">Novo evento</h1>
      {erro && <p className="mt-4 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 text-sm">{erro}</p>}

      <form action={criarEvento} className="mt-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={rotulo} htmlFor="tipo">Tipo</label>
            <select id="tipo" name="tipo" defaultValue="manutencao" className={campo}>
              {TIPOS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className={rotulo} htmlFor="data">Data</label>
            <input id="data" name="data" type="date" defaultValue={hojeISO()} className={campo} />
          </div>
        </div>

        <div>
          <label className={rotulo} htmlFor="alvo">Sistema</label>
          <select id="alvo" name="alvo" defaultValue={alvo ?? ""} className={campo}>
            <option value="">Embarcação (geral)</option>
            {painel.equipamentos.map((e) => (
              <option key={e.id} value={`eq:${e.id}`}>{nomeAlvo(e.id)}</option>
            ))}
            {CATEGORIAS_CASCO.map((c) => (
              <option key={c} value={`cat:${c}`}>Casco — {ROTULO_CASCO[c]}</option>
            ))}
            <option value="cat:documento">Documentos</option>
          </select>
        </div>

        <div>
          <label className={rotulo} htmlFor="item_id">Este serviço zera o ciclo de… (opcional)</label>
          <select id="item_id" name="item_id" defaultValue={item ?? ""} className={campo}>
            <option value="">Nenhum item</option>
            {painel.itens.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nome}{i.equipamento_id ? ` — ${nomeAlvo(i.equipamento_id)}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={rotulo} htmlFor="descricao">Descrição</label>
          <input id="descricao" name="descricao" placeholder="Ex.: troca de óleo e filtros" className={campo} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={rotulo} htmlFor="custo">Custo (R$) — opcional</label>
            <input id="custo" name="custo" inputMode="decimal" defaultValue={custo ?? undefined} placeholder="1.850,00" className={`${campo} font-mono-instr tabular-nums`} />
          </div>
          <div>
            <label className={rotulo} htmlFor="horas">Horas no momento — opcional</label>
            <input id="horas" name="horas" inputMode="decimal" className={`${campo} font-mono-instr tabular-nums`} />
          </div>
        </div>

        <div>
          <label className={rotulo} htmlFor="contato_id">Prestador (opcional)</label>
          <select id="contato_id" name="contato_id" defaultValue="" className={campo}>
            <option value="">Nenhum</option>
            {(contatos ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.nome}{c.especialidade ? ` — ${c.especialidade}` : ""}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={rotulo} htmlFor="anexo">Anexo (NF, relatório, foto) — opcional, até 10 MB</label>
          <input id="anexo" name="anexo" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className={`${campo} py-2.5 text-sm`} />
        </div>

        <button className="w-full rounded-xl bg-accent py-3.5 font-semibold text-acao-texto">
          Salvar no diário
        </button>
      </form>
    </main>
  )
}
