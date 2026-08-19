import Link from "next/link"
import { redirect } from "next/navigation"
import { criarConvite, revogarConvite } from "@/lib/acoes/convites"
import { carregarNivelPlano, carregarPainel, carregarUsoTripulacao } from "@/lib/consultas"
import { mensagemBloqueio, vagasTripulacao } from "@/lib/domain/plano-acesso"
import { horasNoMarCurto, usoPorTripulante, type SaidaParaTripulante } from "@/lib/domain/tripulacao"
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
import { ROTULO_MODO_APROVACAO } from "@/lib/domain/enterprise"
import type { Convite, Vinculo } from "@/lib/db/types"

/**
 * TRIPULAÇÃO (onda 62, canvas tela-1f) — o cartão de pessoa no lugar da
 * linha: avatar, credencial em chip mono, micro-KPIs em pílula (Saídas /
 * No mar / Acesso) e a ação de CONTATO à direita. Os KPIs saem do MESMO
 * Diário de Bordo que alimenta tudo (`usoPorTripulante` em
 * `lib/domain/tripulacao.ts`) — nenhuma segunda contagem pra divergir.
 *
 * O que o canvas tem e esta tela NÃO copia, de propósito:
 * - "A bordo" (pílula verde): o app não registra quem está fisicamente no
 *   barco agora — afirmar isso seria inventar presença.
 * - "CMDT · ARRAIS-AM": a habilitação não existe no vínculo — o chip fica
 *   só com o papel, que é o que o banco sabe.
 */

/** Só dígitos — telefone salvo com máscara vira link wa.me válido. */
function digitosTelefone(telefone: string | null): string | null {
  const d = (telefone ?? "").replace(/\D/g, "")
  return d.length >= 10 ? d : null
}

function PilulaKpi({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1.5">
      <span className="font-mono-instr text-[11px] uppercase tracking-[.12em] text-dim-chip">{rotulo}</span>
      <span className="font-mono-instr text-xs font-semibold tabular-nums">{valor}</span>
    </span>
  )
}

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
  const [{ data: vinculos }, { data: convites }, { data: perfis }, { data: saidas }] = await Promise.all([
    // ONDA 69b — era `.eq("papel", "CMDT")`, e isso virou um buraco no dia
    // em que os cinco papéis Enterprise entraram (onda 69): um vínculo
    // ADM/Operações/Mecânica/Cotista existia no banco e NÃO aparecia aqui,
    // que é a única tela do app que lista quem tem acesso ao barco. Acesso
    // que ninguém vê é acesso que ninguém revoga.
    //
    // `.neq("papel", "PROP")` no lugar: lista todo mundo que não é o dono,
    // qualquer que seja o papel — inclusive papéis que ainda não existem.
    // Filtro por lista fechada precisa ser lembrado a cada papel novo;
    // filtro por exclusão do dono, não.
    supabase.from("vinculos").select("*").eq("embarcacao_id", painel.embarcacao.id).neq("papel", "PROP"),
    supabase.from("convites").select("*").eq("embarcacao_id", painel.embarcacao.id)
      .is("usado_em", null).gt("expira_em", new Date().toISOString()).order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, nome, avatar_path, telefone"),
    // Os micro-KPIs do cartão (canvas tela-1f): as saídas do Diário, uma
    // consulta só pra tripulação inteira — o índice por pessoa é feito em
    // memória por `usoPorTripulante`.
    supabase.from("eventos").select("tipo, criado_por, hora_saida, hora_retorno")
      // `limit(300)` como /diario e /financeiro: sem teto, um barco com anos
      // de diário baixa tudo a cada render pra somar três chips.
      .eq("embarcacao_id", painel.embarcacao.id).eq("tipo", "navegacao")
      .order("data", { ascending: false }).limit(300),
  ])
  const nomePorId = new Map((perfis ?? []).map((p: { id: string; nome: string }) => [p.id, p.nome]))
  const telefonePorId = new Map(
    (perfis ?? []).map((p: { id: string; telefone: string | null }) => [p.id, p.telefone]),
  )
  const avatarPathPorId = new Map(
    (perfis ?? []).map((p: { id: string; avatar_path: string | null }) => [p.id, p.avatar_path]),
  )
  const usoPorId = usoPorTripulante((saidas ?? []) as SaidaParaTripulante[])
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

  const listaVinculos = (vinculos ?? []) as Vinculo[]
  const listaConvites = (convites ?? []) as Convite[]

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref="/menu"
        voltarRotulo="Menu"
        titulo="Tripulação"
        descricao="Quem tem acesso a esta embarcação, e com qual permissão."
      />
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
          orientação, não alarme. O texto encurtou pro do canvas (tela-1f):
          mesma orientação, metade das palavras. */}
      <div className="mt-4 flex gap-2.5 rounded-[14px] border border-line bg-panel2 px-4 py-3">
        <Icone nome="escudo" className="mt-0.5 size-4 shrink-0 text-dim" />
        <p className="apoio text-dim">
          Dê acesso de edição só a quem cuida do barco. Tripulante que só embarca não precisa
          alterar cadastro, documentos nem custos.
        </p>
      </div>

      {/* Onda 69b: era "Comandantes com acesso". A lista deixou de ser só de
          comandantes quando os papéis Enterprise entraram — e um título que
          diz "comandantes" sobre uma lista que tem Mecânica e Cotista é a
          mesma mentira do chip "CMDT" cravado, agora no cabeçalho. */}
      <SecaoPagina>
        Quem tem acesso{listaVinculos.length > 0 ? ` — ${listaVinculos.length}` : ""}
      </SecaoPagina>
      {listaVinculos.length === 0 && (
        <div className="rounded-[14px] border border-line bg-panel px-4">
          <EstadoVazio
            variant="linha"
            icone="pessoas"
            titulo="Ninguém além de você ainda"
            descricao="Crie um convite abaixo."
          />
        </div>
      )}
      <div className="space-y-2">
        {listaVinculos.map((v) => {
          const nome = nomePorId.get(v.usuario_id) || "Comandante"
          const preset = v.nivel === "completo" ? "Completo" : v.nivel === "operacional" ? "Operacional" : "Personalizado"
          const usoDele = usoPorId.get(v.usuario_id)
          const telefone = digitosTelefone(telefonePorId.get(v.usuario_id) ?? null)
          return (
            <div key={v.id} className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-3">
              <div className="flex items-center gap-3">
                {/* O bloco pessoa navega pro detalhe; o telefone é link
                    PRÓPRIO — nunca <a> dentro de <a> (a lição da onda 28). */}
                <Link href={`/tripulacao/${v.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar url={urlAvatarPorId.get(v.usuario_id) ?? null} nome={nome} />
                  <span className="min-w-0 flex-1">
                    <span className="titulo-card block truncate">{nome}</span>
                    {/* Credencial em chip mono (canvas): só o papel — a
                        habilitação não existe no vínculo pra ser escrita.
                        Onda 69b: era "CMDT" cravado no JSX, o que mentiria
                        pra qualquer papel Enterprise. Agora sai do dado. */}
                    <span className="mt-1 inline-flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex rounded-full border border-line px-2 py-0.5 font-mono-instr text-[11px] tracking-[.06em] text-dim-chip">
                        {v.papel}
                      </span>
                      {/* A régua de aprovação (§3) só aparece quando NÃO é a
                          padrão: "sem aprovação" é o normal e não merece
                          chip — chip em todo mundo vira ruído e some com a
                          exceção, que é justamente o que o ADM precisa ver. */}
                      {v.modo_aprovacao !== "sem_aprovacao" && (
                        <span className="inline-flex rounded-full border border-aten/40 px-2 py-0.5 text-[11px] text-warn">
                          {ROTULO_MODO_APROVACAO[v.modo_aprovacao]}
                        </span>
                      )}
                      {/* §13 — suspensão por inadimplência. Fica no lugar mais
                          visível possível: quem está suspenso não aparece
                          igual a quem tem acesso. */}
                      {v.suspenso_em && (
                        <span className="inline-flex rounded-full border border-crit/40 px-2 py-0.5 text-[11px] text-crit">
                          Acesso suspenso
                        </span>
                      )}
                    </span>
                  </span>
                </Link>
                {telefone && (
                  <a
                    href={`https://wa.me/${telefone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Chamar ${nome} no WhatsApp`}
                    className="flex size-11 shrink-0 items-center justify-center rounded-full border border-line"
                  >
                    <Icone nome="telefone" className="size-4" />
                  </a>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <PilulaKpi rotulo="Saídas" valor={String(usoDele?.saidas ?? 0)} />
                {usoDele != null && usoDele.saidas > 0 && (
                  <PilulaKpi rotulo="No mar" valor={horasNoMarCurto(usoDele)} />
                )}
                <PilulaKpi rotulo="Acesso" valor={preset} />
              </div>
            </div>
          )
        })}
      </div>

      <SecaoPagina>
        {listaConvites.length === 1 ? "Convite pendente — 1" : `Convites pendentes${listaConvites.length > 0 ? ` — ${listaConvites.length}` : ""}`}
      </SecaoPagina>
      <div className="rounded-[14px] border border-line bg-panel px-4">
        {listaConvites.length === 0 && (
          <EstadoVazio variant="linha" icone="pessoas" titulo="Nenhum convite aguardando" />
        )}
        {listaConvites.map((c) => (
          <LinhaLista
            key={c.id}
            titulo={<span className="font-mono-instr tracking-[.06em] tabular-nums">{c.codigo}</span>}
            subtitulo={`${c.nivel === "completo" ? "Completo" : "Operacional"} · expira ${new Date(c.expira_em).toLocaleDateString("pt-BR")}`}
            trailing={
              <form action={revogarConvite}>
                <input type="hidden" name="convite_id" value={c.id} />
                <Confirmar mensagem="Revogar convite?" rotulo="Revogar" className="flex h-11 items-center text-sm font-medium text-crit" />
              </form>
            }
          />
        ))}
      </div>

      {/* §19 — "até 2 acessos de tripulação por embarcação. Convite pendente
          ocupa vaga", e §2.3 — Free "não pode adicionar tripulação" (0 vagas).
          O formulário some quando não há vaga, mas o MOTIVO fica: §24 exige
          "explicar o limite e mostrar CTA de upgrade; nunca falhar
          silenciosamente". A mesma conta roda na action e no banco. */}
      {vagas.cabeMais ? (
        <>
          <p className="corpo mt-5 text-dim">
            {vagas.restantes === 1 ? (
              <>Resta <span className="font-mono-instr tabular-nums text-texto">1</span> vaga no seu plano.</>
            ) : (
              <>Restam <span className="font-mono-instr tabular-nums text-texto">{vagas.restantes}</span> vagas no seu plano.</>
            )}{" "}
            Convite aguardando resposta também ocupa vaga.
          </p>
          <form action={criarConvite} className="mt-3 space-y-3">
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
            {/* A ÚNICA dourada da tela (DESIGN §5) — e com o verbo do canvas:
                convidar é o que acontece, "criar convite" era o mecanismo. */}
            <button className="h-11 rounded-[var(--raio-controle)] bg-accent px-4 text-sm font-semibold text-acao-texto">
              Convidar comandante
            </button>
          </form>
        </>
      ) : vagas.total === 0 ? (
        <div className="mt-5">
          <BloqueioPremium {...mensagemBloqueio("tripulacao_adicionar")} />
        </div>
      ) : (
        <div className="mt-5 rounded-[14px] border border-line bg-panel p-4">
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
