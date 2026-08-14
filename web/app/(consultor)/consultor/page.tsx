import Link from "next/link"
import { redirect } from "next/navigation"
import { Icone } from "@/components/icone"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { reivindicarConsultor } from "@/lib/acoes/gold-consultor"
import { carregarMeuPerfilConsultor } from "@/lib/consultas-gold"
import { ROTULO_ESTADO_SOLICITACAO, ROTULO_FAIXA_PORTE } from "@/lib/domain/gold"
import { supabaseServer } from "@/lib/supabase/server"
import type { GoldAgendamento, GoldSolicitacao } from "@/lib/db/types"

/** Agenda do consultor náutico (onda 35, PRD §19 — "Consultor: sua agenda e
 *  o formulário do Protocolo"). Enquanto não houver consultor cadastrado
 *  pra este login, a tela diz isso — nunca finge uma agenda vazia como se
 *  fosse "sem compromissos hoje" (regra de honestidade da casa). */
export default async function ConsultorAgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>
}) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login?volta=/consultor")

  const { ok, erro } = await searchParams
  const meuConsultor = await carregarMeuPerfilConsultor()

  if (!meuConsultor) {
    return (
      <main>
        <h1 className="titulo-pagina inline-flex items-center gap-2">
          <Icone nome="pessoas" className="size-5 text-accent-forte" /> Área do consultor
        </h1>
        {erro && <p className="corpo mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}
        <p className="apoio mt-3 text-dim">
          Não encontramos um cadastro de consultor vinculado a esta conta ainda. Se a equipe
          Commander já te cadastrou, confirme abaixo — o vínculo usa o e-mail desta conta.
        </p>
        <form action={reivindicarConsultor} className="mt-4">
          <button className="w-full rounded-xl bg-accent py-3 font-semibold text-acao-texto">
            Confirmar acesso de consultor
          </button>
        </form>
      </main>
    )
  }

  if (!meuConsultor.ativo) {
    return (
      <main>
        <h1 className="titulo-pagina">Área do consultor</h1>
        <p className="apoio mt-3 text-dim">Seu acesso de consultor está desativado. Fale com a equipe Commander.</p>
      </main>
    )
  }

  const { data: agendamentosBrutos } = await supabase
    .from("gold_agendamentos").select("*").eq("consultor_id", meuConsultor.id).order("data_hora", { ascending: false })
  const agendamentos = (agendamentosBrutos as GoldAgendamento[] | null) ?? []

  const { data: solicitacoesBrutas } = agendamentos.length
    ? await supabase.from("gold_solicitacoes").select("*").in("id", agendamentos.map((a) => a.solicitacao_id))
    : { data: [] }
  const solicitacoes = (solicitacoesBrutas as GoldSolicitacao[] | null) ?? []
  const solicitacoesPorId = new Map(solicitacoes.map((s) => [s.id, s]))

  const idsEmbarcacoes = solicitacoes.map((s) => s.embarcacao_id).filter((id): id is string => Boolean(id))
  const { data: embarcacoesBrutas } = idsEmbarcacoes.length
    ? await supabase.from("embarcacoes").select("id, nome").in("id", idsEmbarcacoes)
    : { data: [] }
  const nomesEmbarcacoes = new Map((embarcacoesBrutas ?? []).map((e) => [e.id as string, e.nome as string]))

  return (
    <main>
      <h1 className="titulo-pagina inline-flex items-center gap-2">
        <Icone nome="calendario" className="size-5 text-accent-forte" /> Sua agenda
      </h1>
      <p className="apoio mt-1 text-dim">{meuConsultor.nome}{meuConsultor.regiao ? ` — ${meuConsultor.regiao}` : ""}</p>

      {ok && <p className="corpo mt-3 rounded-lg border border-ok/40 bg-ok/10 px-3 py-2">{ok}</p>}
      {erro && <p className="corpo mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      {agendamentos.length === 0 ? (
        <EstadoVazio className="mt-4" icone="calendario" titulo="Nenhuma avaliação agendada ainda" />
      ) : (
        <div className="sombra-1 mt-4 rounded-[14px] border border-line bg-panel px-4">
          {agendamentos.map((a) => {
            const s = solicitacoesPorId.get(a.solicitacao_id)
            const nome = s?.embarcacao_id ? nomesEmbarcacoes.get(s.embarcacao_id) ?? "Embarcação" : s?.embarcacao_externa_nome ?? "Embarcação"
            return (
              <Link
                key={a.id} href={`/consultor/${a.solicitacao_id}`}
                className="flex items-center justify-between gap-2 border-b border-line py-3 last:border-0"
              >
                <div className="min-w-0">
                  <p className="corpo truncate">{nome}</p>
                  <p className="apoio text-dim">
                    {new Date(a.data_hora).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} · {a.status}
                    {s && ` · ${ROTULO_FAIXA_PORTE[s.faixa_porte]}`}
                  </p>
                  {s && <p className="apoio text-dim">{ROTULO_ESTADO_SOLICITACAO[s.estado]}</p>}
                </div>
                <Icone nome="chevron" className="size-4 shrink-0 text-dim" />
              </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}
