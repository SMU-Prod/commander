import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { Confirmar } from "@/components/confirmar"
import { excluirSistema, salvarSistema } from "@/lib/acoes/sistemas"
import { carregarPainel } from "@/lib/consultas"
import { abaDoEquipamento } from "@/lib/domain/diario"
import { podeEditar, ROTULO_ABA } from "@/lib/domain/permissoes"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { Campo, CampoSelect } from "@/components/ui/campo"
import { supabaseServer } from "@/lib/supabase/server"
import type { Documento, EquipamentoSistema } from "@/lib/db/types"
import { ACAO_NAO_ESTICA, TETO_FORMULARIO } from "@/lib/ui/superficies"

export default async function EditarSistemaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; sistemaId: string }>
  searchParams: Promise<{ erro?: string }>
}) {
  const { id, sistemaId } = await params
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
  const [{ data: sistema }, { data: documentos }] = await Promise.all([
    supabase.from("equipamento_sistemas").select("*").eq("id", sistemaId).eq("equipamento_id", id).maybeSingle(),
    supabase.from("documentos").select("id, nome").eq("embarcacao_id", painel.embarcacao.id)
      .not("arquivo_path", "is", null).order("nome"),
  ])
  if (!sistema) notFound()
  const s = sistema as EquipamentoSistema

  return (
    <main className={TETO_FORMULARIO}>
      <CabecalhoDetalhe voltarHref={`/barco/equipamento/${id}`} titulo="Editar sistema" />
      {erro && <p className="corpo mt-3 rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      <form action={salvarSistema} className="mt-6 space-y-4">
        <input type="hidden" name="equipamento_id" value={id} />
        <input type="hidden" name="sistema_id" value={sistemaId} />
        <Campo label="Nome do sistema" id="nome" name="nome" required defaultValue={s.nome} />
        {(documentos ?? []).length === 0 ? (
          <p className="apoio rounded-[var(--raio-controle)] border border-line bg-panel px-3 py-2 text-dim">
            Sem documentos no acervo ainda. <Link href="/barco/documentos" className="text-accent-forte">Adicione o manual em Documentos</Link> e volte aqui pra vincular.
          </p>
        ) : (
          <CampoSelect label="Manual do acervo — opcional" id="documento_id" name="documento_id" defaultValue={s.documento_id ?? ""}>
            <option value="">Sem manual vinculado</option>
            {(documentos as Pick<Documento, "id" | "nome">[]).map((d) => (
              <option key={d.id} value={d.id}>{d.nome}</option>
            ))}
          </CampoSelect>
        )}
        <Campo
          label="Página do manual — opcional"
          id="pagina"
          name="pagina"
          inputMode="numeric"
          defaultValue={s.pagina ?? ""}
          className="font-mono-instr tabular-nums"
        />
        <Campo label="Observação — opcional" id="observacao" name="observacao" defaultValue={s.observacao ?? ""} />
        <button className={`${ACAO_NAO_ESTICA} rounded-[var(--raio-controle)] bg-accent py-3.5 font-semibold text-acao-texto`}>Salvar sistema</button>
      </form>

      <form action={excluirSistema} className="mt-8 flex justify-center">
        <input type="hidden" name="equipamento_id" value={id} />
        <input type="hidden" name="sistema_id" value={sistemaId} />
        <Confirmar mensagem="Excluir sistema?" rotulo="Excluir sistema" className="flex h-11 items-center corpo text-crit" />
      </form>
    </main>
  )
}
