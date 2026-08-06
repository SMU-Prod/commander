import { redirect } from "next/navigation"
import { Farol } from "@/components/farol"
import { anexarArquivo, criarDocumento, excluirDocumento } from "@/lib/acoes/documentos"
import { carregarPainel, hojeISO, itemMonitoradoToItemCalc } from "@/lib/consultas"
import { calcularSemaforo } from "@/lib/domain/semaforo"
import { supabaseServer } from "@/lib/supabase/server"
import type { Documento } from "@/lib/db/types"

const campo = "w-full rounded-[10px] border border-line bg-campo px-3 py-3 text-base"
const rotulo = "mb-1.5 block font-mono-instr text-[10.5px] uppercase tracking-[.14em] text-dim"

export default async function DocumentosPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const supabase = await supabaseServer()
  const { data: docs } = await supabase.from("documentos")
    .select("*").eq("embarcacao_id", painel.embarcacao.id).order("created_at")

  const hoje = hojeISO()
  const itensDocumento = painel.itens.filter((i) => i.categoria === "documento")
  const docPorItem = new Map(((docs ?? []) as Documento[]).filter((d) => d.item_monitorado_id)
    .map((d) => [d.item_monitorado_id as string, d]))
  const avulsos = ((docs ?? []) as Documento[]).filter((d) => !d.item_monitorado_id)

  const linkAssinado = async (path: string) => {
    const { data } = await supabase.storage.from("acervo").createSignedUrl(path, 3600)
    return data?.signedUrl ?? null
  }

  return (
    <main>
      <a href="/barco" className="font-mono-instr text-xs uppercase tracking-widest text-accent-forte">‹ Embarcação</a>
      <h1 className="mt-3 text-xl font-semibold">Documentos</h1>
      {erro && <p className="mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 text-sm">{erro}</p>}

      <p className="mt-5 mb-2 font-mono-instr text-[10.5px] uppercase tracking-[.16em] text-dim">Com vencimento</p>
      <div className="rounded-[14px] border border-line bg-panel px-4">
        {itensDocumento.length === 0 && (
          <p className="py-4 text-sm text-dim">Nenhum documento com vencimento cadastrado.</p>
        )}
        {await Promise.all(itensDocumento.map(async (i) => {
          const r = calcularSemaforo(itemMonitoradoToItemCalc(i), null, hoje)
          const doc = docPorItem.get(i.id)
          const url = doc?.arquivo_path ? await linkAssinado(doc.arquivo_path) : null
          return (
            <div key={i.id} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
              <Farol status={r.status} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{i.nome}</p>
                <p className="mt-0.5 font-mono-instr text-[11px] tabular-nums text-dim">
                  {i.data_fixa ? `vence ${i.data_fixa.split("-").reverse().join("/")}` : "sem data"}
                  {r.diasRestantes != null && r.diasRestantes >= 0 ? ` · ${r.diasRestantes} dias` : ""}
                  {r.diasRestantes != null && r.diasRestantes < 0 ? ` · vencido há ${-r.diasRestantes} dias` : ""}
                </p>
              </div>
              {url ? (
                <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-accent-forte">Abrir</a>
              ) : (
                <form action={anexarArquivo} className="flex items-center gap-2">
                  <input type="hidden" name="item_id" value={i.id} />
                  <label className="cursor-pointer text-sm text-accent-forte">
                    Anexar
                    <input type="file" name="arquivo" accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" />
                  </label>
                  <button className="rounded-lg border border-line px-2.5 py-1 text-xs text-dim">Enviar</button>
                </form>
              )}
            </div>
          )
        }))}
      </div>

      {avulsos.length > 0 && (
        <>
          <p className="mt-6 mb-2 font-mono-instr text-[10.5px] uppercase tracking-[.16em] text-dim">Arquivos sem vencimento</p>
          <div className="rounded-[14px] border border-line bg-panel px-4">
            {await Promise.all(avulsos.map(async (d) => {
              const url = d.arquivo_path ? await linkAssinado(d.arquivo_path) : null
              return (
                <div key={d.id} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
                  <p className="min-w-0 flex-1 text-sm font-medium">{d.nome}</p>
                  {url && <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-accent-forte">Abrir</a>}
                  <form action={excluirDocumento}>
                    <input type="hidden" name="documento_id" value={d.id} />
                    <button className="text-xs text-crit">Excluir</button>
                  </form>
                </div>
              )
            }))}
          </div>
        </>
      )}

      <p className="mt-6 mb-2 font-mono-instr text-[10.5px] uppercase tracking-[.16em] text-dim">Novo documento</p>
      <form action={criarDocumento} className="space-y-3 rounded-[14px] border border-line bg-panel p-4">
        <div>
          <label className={rotulo} htmlFor="nome">Nome</label>
          <input id="nome" name="nome" required list="tipos-doc" placeholder="Ex.: Seguro da embarcação" className={campo} />
          <datalist id="tipos-doc">
            <option value="Seguro da embarcação" /><option value="TIE" />
            <option value="Vistoria da Marinha" /><option value="Licença de navegação" />
            <option value="Certificado de segurança" /><option value="Documento de propriedade" />
          </datalist>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={rotulo} htmlFor="validade">Vence em — opcional</label>
            <input id="validade" name="validade" type="date" className={campo} />
          </div>
          <div>
            <label className={rotulo} htmlFor="arquivo">Arquivo — opcional</label>
            <input id="arquivo" name="arquivo" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className={`${campo} py-2.5 text-sm`} />
          </div>
        </div>
        <button className="w-full rounded-xl bg-accent py-3 font-semibold text-acao-texto">Salvar documento</button>
      </form>
    </main>
  )
}
