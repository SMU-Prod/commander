import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { criarSistema } from "@/lib/acoes/sistemas"
import { carregarPainel } from "@/lib/consultas"
import { abaDoEquipamento } from "@/lib/domain/diario"
import { podeEditar, ROTULO_ABA } from "@/lib/domain/permissoes"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { Campo, CampoSelect } from "@/components/ui/campo"
import { supabaseServer } from "@/lib/supabase/server"
import type { Documento } from "@/lib/db/types"
import { ACAO_NAO_ESTICA, TETO_FORMULARIO } from "@/lib/ui/superficies"

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
  const aba = abaDoEquipamento(equipamento.tipo)
  if (!podeEditar(painel.permissoes, aba)) {
    redirect(`/barco/equipamento/${id}?erro=${encodeURIComponent(`Seu acesso não permite editar ${ROTULO_ABA[aba]}.`)}`)
  }

  const supabase = await supabaseServer()
  const { data: documentos } = await supabase.from("documentos")
    .select("id, nome").eq("embarcacao_id", painel.embarcacao.id)
    .not("arquivo_path", "is", null).order("nome")

  return (
    <main className={TETO_FORMULARIO}>
      <CabecalhoDetalhe
        voltarHref={`/barco/equipamento/${id}`}
        titulo="Novo sistema"
        descricao="Um sistema é uma parte do equipamento — Arrefecimento, Injeção, Elétrica do motor, Transmissão... o nome é livre."
      />
      {erro && <p className="corpo mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      <form action={criarSistema} className="mt-5 space-y-4">
        <input type="hidden" name="equipamento_id" value={id} />
        <Campo label="Nome do sistema" id="nome" name="nome" required list="sistemas-sugestoes" placeholder="Ex.: Arrefecimento">
          <datalist id="sistemas-sugestoes">
            <option value="Arrefecimento" /><option value="Injeção" />
            <option value="Elétrica do motor" /><option value="Transmissão" />
          </datalist>
        </Campo>
        {(documentos ?? []).length === 0 ? (
          <p className="apoio rounded-lg border border-line bg-panel px-3 py-2 text-dim">
            Sem documentos no acervo ainda. <Link href="/barco/documentos" className="text-accent-forte">Adicione o manual em Documentos</Link> e volte aqui pra vincular.
          </p>
        ) : (
          <CampoSelect label="Manual do acervo — opcional" id="documento_id" name="documento_id" defaultValue="">
            <option value="">Sem manual vinculado por enquanto</option>
            {(documentos as Pick<Documento, "id" | "nome">[]).map((d) => (
              <option key={d.id} value={d.id}>{d.nome}</option>
            ))}
          </CampoSelect>
        )}
        <Campo label="Página do manual — opcional" id="pagina" name="pagina" inputMode="numeric" placeholder="Ex.: 42" className="font-mono-instr tabular-nums" />
        <Campo label="Observação — opcional" id="observacao" name="observacao" placeholder="Ex.: trocar o termostato a cada 2 anos" />
        <button className={`${ACAO_NAO_ESTICA} rounded-xl bg-accent py-3.5 font-semibold text-acao-texto`}>Salvar sistema</button>
      </form>
    </main>
  )
}
