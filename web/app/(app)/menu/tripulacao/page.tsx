import { redirect } from "next/navigation"
import { criarConvite, revogarConvite } from "@/lib/acoes/convites"
import { carregarPainel } from "@/lib/consultas"
import { supabaseServer } from "@/lib/supabase/server"
import { Confirmar } from "@/components/confirmar"
import { Icone } from "@/components/icone"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { CampoSelect } from "@/components/ui/campo"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { LinhaLista } from "@/components/ui/linha-lista"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import type { Convite, Vinculo } from "@/lib/db/types"

export default async function TripulacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; criado?: string }>
}) {
  const { erro, criado } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (painel.papel !== "PROP") redirect("/menu")

  const supabase = await supabaseServer()
  const [{ data: vinculos }, { data: convites }, { data: perfis }] = await Promise.all([
    supabase.from("vinculos").select("*").eq("embarcacao_id", painel.embarcacao.id).eq("papel", "CMDT"),
    supabase.from("convites").select("*").eq("embarcacao_id", painel.embarcacao.id)
      .is("usado_em", null).gt("expira_em", new Date().toISOString()).order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, nome"),
  ])
  const nomePorId = new Map((perfis ?? []).map((p: { id: string; nome: string }) => [p.id, p.nome]))

  const linkConvite = (codigo: string) => `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3010"}/convite/${codigo}`

  return (
    <main>
      <CabecalhoDetalhe voltarHref="/menu" voltarRotulo="Menu" titulo="Tripulação" />
      {erro && <p className="mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 text-sm">{erro}</p>}

      {criado && (
        <div className="mt-4 rounded-[14px] border border-ok/40 bg-panel p-4">
          <p className="text-sm font-semibold">Convite criado</p>
          <p className="mt-1 break-all font-mono-instr text-xs text-dim">{linkConvite(criado)}</p>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`Entre na tripulação da ${painel.embarcacao.nome} no Commander: ${linkConvite(criado)}`)}`}
            target="_blank" rel="noopener noreferrer"
            className="mt-3 inline-block rounded-lg border border-ok/40 px-3 py-2 text-sm text-ok"
          >
            Compartilhar no WhatsApp
          </a>
        </div>
      )}

      {/* PRD §6: "a interface deverá informar que não é recomendado conceder
          permissão de alteração dos dados da embarcação para toda a
          tripulação". Ícone neutro, não o "!" vermelho — a REGRA DE UX do
          PRD §16 reserva o vermelho pra alerta crítico, e isto é
          orientação, não alarme. */}
      <div className="mt-5 flex gap-2.5 rounded-[14px] border border-line bg-panel2 px-4 py-3">
        <Icone nome="escudo" className="mt-0.5 size-4 shrink-0 text-dim" />
        <p className="apoio text-dim">
          Dê acesso de edição só a quem realmente cuida do barco. Tripulante que só embarca não
          precisa poder alterar o cadastro, os documentos nem os custos — o acesso operacional
          já deixa registrar horas e serviços.
        </p>
      </div>

      <SecaoPagina>Comandantes com acesso</SecaoPagina>
      <div className="rounded-[14px] border border-line bg-panel px-4">
        {((vinculos ?? []) as Vinculo[]).length === 0 && (
          <EstadoVazio
            variant="linha"
            icone="pessoas"
            titulo="Ninguém além de você ainda"
            descricao="Crie um convite abaixo."
          />
        )}
        {((vinculos ?? []) as Vinculo[]).map((v) => (
          <LinhaLista
            key={v.id}
            href={`/menu/tripulacao/${v.id}`}
            titulo={nomePorId.get(v.usuario_id) || "Comandante"}
            subtitulo={
              v.nivel === "completo" ? "Acesso completo" : v.nivel === "operacional" ? "Acesso operacional" : "Acesso personalizado"
            }
          />
        ))}
      </div>

      <SecaoPagina>Convites pendentes</SecaoPagina>
      <div className="rounded-[14px] border border-line bg-panel px-4">
        {((convites ?? []) as Convite[]).length === 0 && (
          <EstadoVazio variant="linha" icone="pessoas" titulo="Nenhum convite aguardando" />
        )}
        {((convites ?? []) as Convite[]).map((c) => (
          <LinhaLista
            key={c.id}
            titulo={<span className="font-mono-instr tabular-nums">{c.codigo}</span>}
            subtitulo={`${c.nivel === "completo" ? "Completo" : "Operacional"} · expira ${new Date(c.expira_em).toLocaleDateString("pt-BR")}`}
            trailing={
              <form action={revogarConvite}>
                <input type="hidden" name="convite_id" value={c.id} />
                <Confirmar mensagem="Revogar convite?" rotulo="Revogar" className="flex h-11 items-center text-xs text-crit" />
              </form>
            }
          />
        ))}
      </div>

      <SecaoPagina>Novo convite</SecaoPagina>
      <form action={criarConvite} className="space-y-3 rounded-[14px] border border-line bg-panel p-4">
        <CampoSelect
          label="Acesso inicial"
          id="nivel"
          name="nivel"
          defaultValue="operacional"
          dica="Você ajusta o acesso em detalhe depois, área por área — o que ele pode ver e editar."
        >
          <option value="operacional">Operacional — registra horas e serviços, sem custos e documentos</option>
          <option value="completo">Completo — vê e edita tudo</option>
        </CampoSelect>
        <button className="w-full rounded-xl bg-accent py-3 font-semibold text-acao-texto">Criar convite</button>
      </form>
    </main>
  )
}
