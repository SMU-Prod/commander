import { redirect } from "next/navigation"
import { Confirmar } from "@/components/confirmar"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { Campo, CampoTextarea } from "@/components/ui/campo"
import { atualizarStatusOportunidade, responderOportunidade, retirarResposta } from "@/lib/acoes/oportunidades"
import { supabaseServer } from "@/lib/supabase/server"
import type { Oportunidade, RespostaOportunidade, StatusOportunidade, TipoOportunidade } from "@/lib/db/types"

const ROTULO_TIPO: Record<TipoOportunidade, string> = { vaga: "Vaga", diaria: "Diária", peca_servico: "Peça/serviço" }
const ROTULO_STATUS: Record<StatusOportunidade, string> = { aberta: "Aberta", atendida: "Atendida", encerrada: "Encerrada" }

export default async function OportunidadePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ erro?: string; ok?: string }>
}) {
  const { id } = await params
  const { erro, ok } = await searchParams
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data } = await supabase.from("oportunidades").select("*").eq("id", id).maybeSingle()
  const oportunidade = data as Oportunidade | null
  // RLS só devolve linha se está aberta OU se é do próprio autor — "não
  // encontrada" cobre tanto "id errado" quanto "fechada e não é sua", sem
  // distinguir (não vaza pra quem não pode ver que ela existiu).
  if (!oportunidade) {
    redirect(`/oportunidades?erro=${encodeURIComponent("Essa oportunidade não existe mais ou não está mais aberta.")}`)
  }

  const ehAutor = oportunidade.autor_id === user.id
  const { data: respostasBrutas } = await supabase
    .from("respostas_oportunidade").select("*").eq("oportunidade_id", id).order("created_at")
  const respostas = (respostasBrutas ?? []) as RespostaOportunidade[]
  const minhaResposta = respostas.find((r) => r.respondente_id === user.id) ?? null

  return (
    <main>
      <CabecalhoDetalhe voltarHref="/oportunidades" voltarRotulo="Oportunidades" />
      {erro && <p className="mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 text-sm">{erro}</p>}
      {ok && <p className="mt-3 rounded-lg border border-ok/40 bg-ok/10 px-3 py-2 text-sm">{ok}</p>}

      <div className="sombra-1 mt-3 rounded-[14px] border border-line bg-panel p-4">
        <div className="flex items-start justify-between gap-2">
          <h1 className="titulo-pagina">{oportunidade.titulo}</h1>
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 font-mono-instr text-[11px] uppercase tracking-[.1em] ${
              oportunidade.status === "aberta" ? "border-ok/40 text-ok" : "border-line text-dim"
            }`}
          >
            {ROTULO_STATUS[oportunidade.status]}
          </span>
        </div>
        <p className="apoio mt-1 text-dim">
          {[ROTULO_TIPO[oportunidade.tipo], oportunidade.categoria, oportunidade.local].filter(Boolean).join(" · ")}
        </p>
        <p className="apoio mt-1 text-dim">Publicado por {oportunidade.autor_nome}</p>
        {oportunidade.descricao && <p className="corpo mt-3">{oportunidade.descricao}</p>}
      </div>

      {ehAutor && oportunidade.status === "aberta" && (
        <div className="mt-3 flex gap-2">
          <form action={atualizarStatusOportunidade} className="flex-1">
            <input type="hidden" name="oportunidade_id" value={oportunidade.id} />
            <input type="hidden" name="status" value="atendida" />
            <button className="h-11 w-full rounded-lg border border-ok/40 text-sm font-medium text-ok">Marcar atendida</button>
          </form>
          <form action={atualizarStatusOportunidade} className="flex-1">
            <input type="hidden" name="oportunidade_id" value={oportunidade.id} />
            <input type="hidden" name="status" value="encerrada" />
            <button className="h-11 w-full rounded-lg border border-line text-sm font-medium text-dim">Encerrar</button>
          </form>
        </div>
      )}

      {ehAutor ? (
        <>
          <p className="rotulo mt-6 mb-2 text-dim">
            {respostas.length} {respostas.length === 1 ? "resposta" : "respostas"}
          </p>
          {respostas.length === 0 ? (
            <p className="apoio rounded-[14px] border border-line bg-panel p-4 text-center text-dim">
              Ninguém respondeu ainda.
            </p>
          ) : (
            <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
              {respostas.map((r) => (
                <div key={r.id} className="border-b border-line py-3.5 last:border-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="titulo-card">{r.nome}</p>
                    {r.telefone && (
                      <a
                        href={`https://wa.me/55${r.telefone.replace(/\D/g, "")}`}
                        target="_blank" rel="noopener noreferrer"
                        className="rounded-lg border border-ok/40 px-2.5 py-1.5 text-xs text-ok"
                      >
                        WhatsApp
                      </a>
                    )}
                  </div>
                  <p className="corpo mt-1">{r.mensagem}</p>
                </div>
              ))}
            </div>
          )}
        </>
      ) : oportunidade.status !== "aberta" ? (
        <p className="apoio mt-6 rounded-[14px] border border-line bg-panel p-4 text-center text-dim">
          Esta oportunidade não está mais aberta.
        </p>
      ) : minhaResposta ? (
        <div className="mt-6 rounded-[14px] border border-line bg-panel p-4">
          <p className="titulo-card">Você já respondeu</p>
          <p className="corpo mt-1 text-dim">{minhaResposta.mensagem}</p>
          <form action={retirarResposta} className="mt-3">
            <input type="hidden" name="oportunidade_id" value={oportunidade.id} />
            <Confirmar mensagem="Retirar sua resposta?" rotulo="Retirar resposta" className="apoio text-crit" />
          </form>
        </div>
      ) : (
        <form action={responderOportunidade} className="mt-6 space-y-3">
          <input type="hidden" name="oportunidade_id" value={oportunidade.id} />
          <p className="rotulo text-dim">Responder</p>
          <CampoTextarea
            label="Mensagem" id="mensagem" name="mensagem" rows={3} required
            placeholder="Posso ajudar com isso — disponível a partir de…"
          />
          <Campo label="Telefone / WhatsApp (opcional)" id="telefone" name="telefone" inputMode="tel" placeholder="21 99999-0000" />
          <button className="w-full rounded-xl bg-accent py-3.5 font-semibold text-acao-texto">Enviar resposta</button>
        </form>
      )}
    </main>
  )
}
