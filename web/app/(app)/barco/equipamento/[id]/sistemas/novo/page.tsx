import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { Icone } from "@/components/icone"
import { criarSistema } from "@/lib/acoes/sistemas"
import { carregarPainel } from "@/lib/consultas"
import { podeEditar, ROTULO_ABA } from "@/lib/domain/permissoes"
import { campo, rot } from "@/lib/ui/form"
import { supabaseServer } from "@/lib/supabase/server"
import type { Documento } from "@/lib/db/types"

export default async function NovoSistemaPage({
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
  const equipamento = painel.equipamentos.find((e) => e.id === id)
  if (!equipamento) notFound()
  const aba = equipamento.tipo === "motor" ? "motores" : "eletrica"
  if (!podeEditar(painel.permissoes, aba)) {
    redirect(`/barco/equipamento/${id}?erro=${encodeURIComponent(`Seu acesso não permite editar ${ROTULO_ABA[aba]}.`)}`)
  }

  const supabase = await supabaseServer()
  const { data: documentos } = await supabase.from("documentos")
    .select("id, nome").eq("embarcacao_id", painel.embarcacao.id)
    .not("arquivo_path", "is", null).order("nome")

  return (
    <main>
      <Link href={`/barco/equipamento/${id}`} className="inline-flex items-center gap-1 rotulo text-accent-forte">
        <Icone nome="voltar" className="size-4" /> Voltar
      </Link>
      <h1 className="titulo-pagina mt-3">Novo sistema</h1>
      <p className="mt-1 corpo text-dim">
        Um sistema é uma parte do equipamento — Arrefecimento, Injeção, Elétrica do motor, Transmissão... o nome é livre.
      </p>
      {erro && <p className="corpo mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      <form action={criarSistema} className="mt-5 space-y-4">
        <input type="hidden" name="equipamento_id" value={id} />
        <div>
          <label className={rot} htmlFor="nome">Nome do sistema</label>
          <input id="nome" name="nome" required list="sistemas-sugestoes" placeholder="Ex.: Arrefecimento" className={campo} />
          <datalist id="sistemas-sugestoes">
            <option value="Arrefecimento" /><option value="Injeção" />
            <option value="Elétrica do motor" /><option value="Transmissão" />
          </datalist>
        </div>
        {(documentos ?? []).length === 0 ? (
          <p className="apoio rounded-lg border border-line bg-panel px-3 py-2 text-dim">
            Sem documentos no acervo ainda. <Link href="/barco/documentos" className="text-accent-forte">Adicione o manual em Documentos</Link> e volte aqui pra vincular.
          </p>
        ) : (
          <div>
            <label className={rot} htmlFor="documento_id">Manual do acervo — opcional</label>
            <select id="documento_id" name="documento_id" defaultValue="" className={campo}>
              <option value="">Sem manual vinculado por enquanto</option>
              {(documentos as Pick<Documento, "id" | "nome">[]).map((d) => (
                <option key={d.id} value={d.id}>{d.nome}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className={rot} htmlFor="pagina">Página do manual — opcional</label>
          <input id="pagina" name="pagina" inputMode="numeric" placeholder="Ex.: 42" className={`${campo} font-mono-instr tabular-nums`} />
        </div>
        <div>
          <label className={rot} htmlFor="observacao">Observação — opcional</label>
          <input id="observacao" name="observacao" placeholder="Ex.: trocar o termostato a cada 2 anos" className={campo} />
        </div>
        <button className="w-full rounded-xl bg-accent py-3.5 font-semibold text-acao-texto">Salvar sistema</button>
      </form>
    </main>
  )
}
