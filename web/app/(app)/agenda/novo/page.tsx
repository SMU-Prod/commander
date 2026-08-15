import { redirect } from "next/navigation"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { Campo, CampoSelect, CampoTextarea } from "@/components/ui/campo"
import { criarCompromisso } from "@/lib/acoes/agenda"
import { carregarPainel, hojeISO } from "@/lib/consultas"
import {
  EXPLICACAO_VISIBILIDADE,
  podeGerenciarEventos,
  ROTULO_VISIBILIDADE,
  VISIBILIDADES,
} from "@/lib/domain/agenda"
import { nomeDoEquipamento } from "@/lib/domain/diario"
import { rot } from "@/lib/ui/form"
import { supabaseServer } from "@/lib/supabase/server"

/**
 * "Marcar compromisso" — o caso de uso literal do PRD §8: o proprietário
 * cria "Saída sábado — 08:00" e compartilha com Captain/tripulação, e o
 * mesmo compromisso aparece nas agendas escolhidas.
 *
 * A lista de "com quem" vem dos vínculos REAIS da embarcação. Não existe
 * campo livre de usuário: compartilhar com alguém de fora do barco não é
 * uma coisa que a Agenda faça (e a RLS barraria de qualquer jeito,
 * `agenda_pode_compartilhar` na migration 044).
 */
export default async function NovoCompromissoPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; d?: string }>
}) {
  const { erro, d } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (!podeGerenciarEventos(painel.permissoes)) {
    redirect(`/agenda?erro=${encodeURIComponent("Seu acesso não permite criar compromissos desta embarcação.")}`)
  }

  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: vinculos } = await supabase
    .from("vinculos").select("usuario_id, papel").eq("embarcacao_id", painel.embarcacao.id)
  const outros = (vinculos ?? []).filter((v: { usuario_id: string }) => v.usuario_id !== user?.id)
  const { data: perfis } = outros.length > 0
    ? await supabase.from("profiles").select("id, nome").in("id", outros.map((v: { usuario_id: string }) => v.usuario_id))
    : { data: [] as { id: string; nome: string }[] }
  const tripulacao = outros.map((v: { usuario_id: string; papel: string }) => ({
    id: v.usuario_id,
    nome: (perfis ?? []).find((p: { id: string }) => p.id === v.usuario_id)?.nome?.trim() || "Comandante",
    papel: v.papel === "PROP" ? "Proprietário" : "Comandante",
  }))

  const dataInicial = /^\d{4}-\d{2}-\d{2}$/.test(d ?? "") ? (d as string) : hojeISO()

  return (
    <main>
      <CabecalhoDetalhe voltarHref="/agenda" voltarRotulo="Agenda" titulo="Marcar compromisso" />
      {erro && <p className="corpo mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      <form action={criarCompromisso} className="mt-5 space-y-4">
        <Campo label="O quê" id="titulo" name="titulo" required placeholder="Ex.: Saída sábado" />
        <div className="flex gap-3">
          <Campo label="Dia" id="data" name="data" type="date" required defaultValue={dataInicial} wrapperClassName="flex-1" />
          <Campo
            label="Hora — opcional"
            id="hora"
            name="hora"
            type="time"
            wrapperClassName="flex-1"
            dica="Em branco = dia inteiro"
          />
        </div>
        <CampoTextarea label="Observação — opcional" id="descricao" name="descricao" rows={3} />

        <CampoSelect
          label="Quem vê"
          id="visibilidade"
          name="visibilidade"
          defaultValue="particular"
          dica={EXPLICACAO_VISIBILIDADE.compartilhado}
        >
          {VISIBILIDADES.map((v) => (
            <option key={v} value={v}>{ROTULO_VISIBILIDADE[v]}</option>
          ))}
        </CampoSelect>

        {tripulacao.length > 0 ? (
          <div>
            <p className={rot}>Compartilhar com</p>
            <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
              {tripulacao.map((t) => (
                <label key={t.id} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
                  <input type="checkbox" name="participantes" value={t.id} className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="titulo-card block truncate">{t.nome}</span>
                    <span className="apoio block text-dim">{t.papel}</span>
                  </span>
                </label>
              ))}
            </div>
            <p className="apoio mt-1 text-dim">
              O mesmo compromisso aparece na agenda de quem você marcar. Ver o compromisso não dá
              acesso a nenhuma outra área do barco.
            </p>
          </div>
        ) : (
          <p className="apoio text-dim">
            Ninguém mais tem acesso a esta embarcação ainda — por enquanto todo compromisso é só seu.
          </p>
        )}

        {painel.itens.length > 0 && (
          <CampoSelect
            label="Ligar a uma manutenção ou documento — opcional"
            id="item_monitorado_id"
            name="item_monitorado_id"
            defaultValue=""
            dica="Serve de referência. Quem receber o compromisso continua sem acesso ao hub."
          >
            <option value="">Nenhum</option>
            {painel.itens.map((i) => {
              const eq = painel.equipamentos.find((e) => e.id === i.equipamento_id)
              return (
                <option key={i.id} value={i.id}>
                  {i.nome}{eq ? ` — ${nomeDoEquipamento(eq)}` : ""}
                </option>
              )
            })}
          </CampoSelect>
        )}

        <button className="w-full rounded-xl bg-accent py-3.5 font-semibold text-acao-texto">Marcar compromisso</button>
      </form>
    </main>
  )
}
