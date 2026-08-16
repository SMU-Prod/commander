import { redirect } from "next/navigation"
import { criarConvite, revogarConvite } from "@/lib/acoes/convites"
import { carregarNivelPlano, carregarPainel, carregarUsoTripulacao } from "@/lib/consultas"
import { mensagemBloqueio, vagasTripulacao } from "@/lib/domain/plano-acesso"
import { supabaseServer } from "@/lib/supabase/server"
import { Avatar } from "@/components/avatar"
import { Confirmar } from "@/components/confirmar"
import { Icone } from "@/components/icone"
import { BloqueioPremium } from "@/components/ui/bloqueio-premium"
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
    supabase.from("profiles").select("id, nome, avatar_path"),
  ])
  const nomePorId = new Map((perfis ?? []).map((p: { id: string; nome: string }) => [p.id, p.nome]))
  const avatarPathPorId = new Map(
    (perfis ?? []).map((p: { id: string; avatar_path: string | null }) => [p.id, p.avatar_path]),
  )
  // Mesmo padrão da Início (onda 57): assina só o que vai aparecer — a
  // Tripulação é curta por natureza (§19, no máximo poucas vagas por
  // embarcação), então dá pra assinar a foto de todo mundo sem paginar.
  const urlAvatarPorId = new Map(
    await Promise.all(
      [...new Set(((vinculos ?? []) as Vinculo[]).map((v) => v.usuario_id))]
        .map((id) => [id, avatarPathPorId.get(id) ?? null] as const)
        .filter((par): par is [string, string] => par[1] != null)
        .map(async ([id, path]) => {
          const { data } = await supabase.storage.from("acervo").createSignedUrl(path, 3600)
          return [id, data?.signedUrl ?? null] as const
        }),
    ),
  )

  const [nivel, uso] = await Promise.all([carregarNivelPlano(), carregarUsoTripulacao()])
  const vagas = vagasTripulacao(nivel, uso.vinculos, uso.convites)

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
        {((vinculos ?? []) as Vinculo[]).map((v) => {
          const nome = nomePorId.get(v.usuario_id) || "Comandante"
          const preset = v.nivel === "completo" ? "Acesso completo" : v.nivel === "operacional" ? "Acesso operacional" : "Acesso personalizado"
          return (
            <LinhaLista
              key={v.id}
              href={`/tripulacao/${v.id}`}
              leading={<Avatar url={urlAvatarPorId.get(v.usuario_id) ?? null} nome={nome} />}
              titulo={nome}
              subtitulo={`Comandante · ${preset}`}
            />
          )
        })}
      </div>

      <SecaoPagina>Convites pendentes</SecaoPagina>
      <div className="rounded-[14px] border border-line bg-panel px-4">
        {((convites ?? []) as Convite[]).length === 0 && (
          <EstadoVazio variant="linha" icone="pessoas" titulo="Nenhum convite aguardando" />
        )}
        {((convites ?? []) as Convite[]).map((c) => (
          <LinhaLista
            key={c.id}
            // Convite ainda não tem pessoa (ninguém aceitou) — mesma moldura
            // circular do Avatar, com o relógio no lugar da foto/iniciais,
            // pra manter a coluna alinhada com a lista de comandantes acima.
            leading={
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-line bg-panel2 text-dim">
                <Icone nome="relogio" className="size-5" />
              </span>
            }
            titulo={<span className="font-mono-instr tabular-nums">{c.codigo}</span>}
            subtitulo={`Aguardando · ${c.nivel === "completo" ? "Completo" : "Operacional"} · expira ${new Date(c.expira_em).toLocaleDateString("pt-BR")}`}
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
      {/* §19 — "até 2 acessos de tripulação por embarcação. Convite pendente
          ocupa vaga", e §2.3 — Free "não pode adicionar tripulação" (0 vagas).
          O formulário some quando não há vaga, mas o MOTIVO fica: §24 exige
          "explicar o limite e mostrar CTA de upgrade; nunca falhar
          silenciosamente". A mesma conta roda na action e no banco. */}
      {vagas.cabeMais ? (
        <form action={criarConvite} className="space-y-3 rounded-[14px] border border-line bg-panel p-4">
          <p className="apoio text-dim">
            {vagas.restantes === 1
              ? "Resta 1 vaga de tripulação nesta embarcação."
              : `Restam ${vagas.restantes} vagas de tripulação nesta embarcação.`}{" "}
            Convite aguardando resposta também ocupa vaga.
          </p>
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
      ) : vagas.total === 0 ? (
        <BloqueioPremium {...mensagemBloqueio("tripulacao_adicionar")} />
      ) : (
        <div className="rounded-[14px] border border-line bg-panel p-4">
          <p className="titulo-card">Vagas de tripulação preenchidas</p>
          <p className="apoio mt-1 text-dim">
            Esta embarcação já usa as {vagas.total} vagas do plano, somando comandantes com acesso e convites
            aguardando resposta. Revogue um convite pendente ou remova um acesso acima para abrir vaga.
          </p>
        </div>
      )}
    </main>
  )
}
