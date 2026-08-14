import { notFound, redirect } from "next/navigation"
import { Farol } from "@/components/farol"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { CampoTextarea } from "@/components/ui/campo"
import { transicionarOcorrencia } from "@/lib/acoes/ocorrencias"
import { carregarPainel } from "@/lib/consultas"
import { formatarCarimbo } from "@/lib/domain/datas"
import { faroDoEstado, ROTULO_ESTADO, ROTULO_GRAVIDADE, transicoesPossiveis, type EstadoOcorrencia, type Gravidade } from "@/lib/domain/ocorrencias"
import { podeEditar, ROTULO_ABA } from "@/lib/domain/permissoes"
import { supabaseServer } from "@/lib/supabase/server"
import type { Ocorrencia, OcorrenciaTransicao } from "@/lib/db/types"

/** Rótulo do botão de transição — verbo de ação, não o nome do estado
 *  (glossário: a voz do app pede "o que fazer", não só um rótulo neutro). */
const ROTULO_ACAO: Record<EstadoOcorrencia, string> = {
  aberta: "Reabrir",
  em_acompanhamento: "Marcar em acompanhamento",
  resolvida: "Marcar como resolvida",
}

export default async function OcorrenciaDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ erro?: string; ok?: string }>
}) {
  const { id } = await params
  const { erro, ok } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")

  const supabase = await supabaseServer()
  const [{ data: ocorrenciaBruta }, { data: transicoesBrutas }] = await Promise.all([
    supabase.from("ocorrencias").select("*").eq("id", id).maybeSingle(),
    supabase.from("ocorrencias_transicoes").select("*").eq("ocorrencia_id", id).order("created_at", { ascending: false }),
  ])
  const o = ocorrenciaBruta as Ocorrencia | null
  if (!o || o.embarcacao_id !== painel.embarcacao.id) notFound()
  const transicoes = (transicoesBrutas ?? []) as OcorrenciaTransicao[]

  const idsPessoas = [...new Set([o.criado_por, ...transicoes.map((t) => t.criado_por)].filter((v): v is string => v != null))]
  const { data: perfis } = idsPessoas.length
    ? await supabase.from("profiles").select("id, nome").in("id", idsPessoas)
    : { data: [] as { id: string; nome: string }[] }
  const nomeDe = (userId: string | null) => (perfis ?? []).find((p) => p.id === userId)?.nome || "Alguém"

  const urlAnexo = o.anexo_path
    ? (await supabase.storage.from("acervo").createSignedUrl(o.anexo_path, 3600)).data?.signedUrl ?? null
    : null

  const editavel = podeEditar(painel.permissoes, o.aba)
  const acoes = transicoesPossiveis(o.estado)

  return (
    <main>
      <CabecalhoDetalhe voltarHref="/barco/ocorrencias" voltarRotulo="Ocorrências" />
      {erro && <p className="mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 text-sm">{erro}</p>}
      {ok && <p className="mt-3 rounded-lg border border-ok/40 bg-panel px-3 py-2 text-sm">{ok}</p>}

      <div className="mt-3 flex items-start gap-3">
        <Farol status={faroDoEstado(o.estado)} />
        <div className="min-w-0 flex-1">
          <h1 className="titulo-pagina truncate">{o.titulo}</h1>
          <p className="apoio mt-1 text-dim">
            {ROTULO_ABA[o.aba]} · {ROTULO_ESTADO[o.estado]}
            {o.gravidade && ` · gravidade ${ROTULO_GRAVIDADE[o.gravidade as Gravidade]}`}
          </p>
        </div>
      </div>

      {o.descricao && <p className="corpo mt-4">{o.descricao}</p>}
      {urlAnexo && (
        <a href={urlAnexo} target="_blank" rel="noopener noreferrer" className="apoio mt-2 inline-block text-accent-forte">
          Abrir anexo
        </a>
      )}
      <p className="apoio mt-3 text-dim">
        Aberta por {nomeDe(o.criado_por)} em {formatarCarimbo(o.created_at)}
        {o.evento_id && " · a partir de uma saída do Diário"}
      </p>

      {editavel && acoes.length > 0 && (
        <form action={transicionarOcorrencia} className="sombra-1 mt-5 space-y-3 rounded-[14px] border border-line bg-panel p-4">
          <input type="hidden" name="ocorrencia_id" value={o.id} />
          <CampoTextarea label="Observação — opcional" id="observacao" name="observacao" rows={2} />
          <div className="flex flex-wrap gap-2">
            {acoes.map((estado) => (
              <button
                key={estado}
                type="submit"
                name="novo_estado"
                value={estado}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${
                  estado === "resolvida"
                    ? "bg-accent text-acao-texto"
                    : "border border-line text-texto"
                }`}
              >
                {ROTULO_ACAO[estado]}
              </button>
            ))}
          </div>
        </form>
      )}

      <p className="rotulo text-dim mt-6 mb-2">Histórico de mudanças</p>
      <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
        {transicoes.map((t) => (
          <div key={t.id} className="border-b border-line py-3 last:border-0">
            <p className="titulo-card">
              {t.estado_anterior ? `${ROTULO_ESTADO[t.estado_anterior]} → ${ROTULO_ESTADO[t.estado_novo]}` : `Aberta como ${ROTULO_ESTADO[t.estado_novo]}`}
            </p>
            <p className="apoio mt-0.5 text-dim">{nomeDe(t.criado_por)} · {formatarCarimbo(t.created_at)}</p>
            {t.observacao && <p className="corpo mt-1">{t.observacao}</p>}
          </div>
        ))}
      </div>
    </main>
  )
}
