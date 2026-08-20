import { redirect } from "next/navigation"
import { Confirmar } from "@/components/confirmar"
import { Icone } from "@/components/icone"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { Campo } from "@/components/ui/campo"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { alternarSuspensao, definirCotas, redefinirLink } from "@/lib/acoes/cotistas"
import { carregarPainel } from "@/lib/consultas"
import { acimaDaCota, estaSuspenso, MENSAGEM_SUSPENSO, vagasDeCotista } from "@/lib/domain/cotistas"
import { linhaDeAuditoria, type EventoAuditado } from "@/lib/domain/enterprise"
import { supabaseServer } from "@/lib/supabase/server"
import { urlPublica } from "@/lib/url-publica"
import { ACAO_NAO_ESTICA } from "@/lib/ui/superficies"
import type { ConviteCotista, Vinculo } from "@/lib/db/types"

/**
 * COTISTAS DA UNIDADE (onda 69b — PRD-UPGRADE-3-COTAS §13).
 *
 * A tela responde três perguntas do ADM, nesta ordem, porque é a ordem em
 * que ele pergunta: quantas vagas existem e quantas estão ocupadas, qual é o
 * link pra mandar no grupo, e quem está dentro.
 *
 * O que ela NÃO faz, e é decisão do PRD, não omissão: não fala de cobrança.
 * O §13 diz que "cobrança acontece FORA do Commander" — aqui só existe o
 * fato operacional (acesso ativo ou suspenso), nunca valor, vencimento ou
 * situação financeira.
 */
export default async function CotistasPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  // Cota e link são atos de dono da conta, como o convite de tripulação —
  // as policies da migration 061 exigem `eh_prop` e a tela concorda.
  if (painel.papel !== "PROP") redirect("/menu")

  const supabase = await supabaseServer()
  const [{ data: vinculos }, { data: links }, { data: perfis }, { data: trilha }] = await Promise.all([
    supabase.from("vinculos").select("*")
      .eq("embarcacao_id", painel.embarcacao.id).eq("papel", "COTISTA"),
    supabase.from("convites_cotista").select("*")
      .eq("embarcacao_id", painel.embarcacao.id).eq("ativo", true).limit(1),
    supabase.from("profiles").select("id, nome"),
    // AUDITORIA 19/08, A3 — a tabela `auditoria` era write-only: o app
    // gravava quem bloqueou quem e ninguém nunca lia. Na hora em que o
    // cotista pergunta "por que perdi acesso em julho", a resposta estava no
    // banco e não tinha tela. Esta é a tela.
    supabase.from("auditoria").select("id, evento, alvo, motivo, autor_id, criado_em")
      .eq("embarcacao_id", painel.embarcacao.id)
      .in("evento", ["bloqueou_cotista", "desbloqueou_cotista"])
      .order("criado_em", { ascending: false }).limit(15),
  ])

  const lista = (vinculos ?? []) as Vinculo[]
  const link = ((links ?? []) as ConviteCotista[])[0] ?? null
  const nomePorId = new Map((perfis ?? []).map((p: { id: string; nome: string }) => [p.id, p.nome]))

  type LinhaTrilha = {
    id: string; evento: EventoAuditado; alvo: string | null
    motivo: string | null; autor_id: string | null; criado_em: string
  }
  const eventos = (trilha ?? []) as LinhaTrilha[]

  // A ocupação é DERIVADA (§13) — contagem de vínculos, não contador
  // guardado. É o que faz "remover acesso libera vaga" acontecer sozinho e
  // "redefinir o link" não zerar nada.
  const vagas = vagasDeCotista(painel.embarcacao.cotas_total, lista.length)
  // Achado 1.3 da auditoria de 19/08 — mesma correção das outras duas telas de
  // link compartilhado. Este é o link que o ADM manda no grupo dos cotistas:
  // sem `NEXT_PUBLIC_APP_URL` no ambiente ele saía apontando para localhost, e
  // ninguém do grupo abriria nada. Ver `lib/url-publica.ts`.
  const urlLink = link ? `${await urlPublica()}/convite-cotista/${link.codigo}` : null

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref="/menu"
        voltarRotulo="Menu"
        titulo="Cotistas"
        descricao="Quem divide esta unidade — e quantas vagas ainda cabem."
      />
      {erro && <p className="corpo mt-3 rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      {/* O contador do §13, no formato que ele escreve: "7/10". */}
      <div className="sombra-1 mt-4 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
        <div className="flex items-baseline justify-between">
          <p className="rotulo text-dim">Vagas ocupadas</p>
          <p className="font-mono-instr text-base font-semibold tabular-nums">{vagas.rotulo}</p>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-[var(--raio-pilula)] bg-panel2">
          <div
            className={`h-full rounded-[var(--raio-pilula)] ${vagas.cabeMais ? "bg-dim" : "bg-crit"}`}
            style={{ width: `${vagas.total === 0 ? 0 : Math.min(100, (vagas.ocupadas / vagas.total) * 100)}%` }}
          />
        </div>
        {/* §13 lido junto com o §23 do PRD anterior: reduzir a cota com gente
            dentro NÃO expulsa ninguém. O aviso existe pra o ADM entender por
            que o link parou de aceitar, em vez de achar que quebrou. */}
        {acimaDaCota(vagas) && (
          <p className="apoio mt-2 text-warn">
            Esta unidade tem {vagas.ocupadas} cotistas e a cota é de {vagas.total}. Ninguém perdeu
            acesso — só não entra mais ninguém até a cota subir ou alguém sair.
          </p>
        )}
      </div>

      <SecaoPagina icone="pessoas">Cota da unidade</SecaoPagina>
      {/* `--raio-cartao` e não `--raio-painel`: os 14px cravados aqui e nos
          dois painéis abaixo eram o MESMO desenho do cartão de vagas lá em
          cima, que já vinha por token. Promover só os que estavam à mão
          deixaria dois raios no mesmo nível da mesma tela — a hierarquia
          achatada que o degrau de 16px existe pra desfazer. Subir a tela
          inteira é decisão de tela, e está no relatório. */}
      <form action={definirCotas} className="sombra-1 space-y-3 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
        <Campo
          label="Quantos cotistas esta unidade tem"
          id="cotas_total"
          name="cotas_total"
          inputMode="numeric"
          defaultValue={String(painel.embarcacao.cotas_total)}
          className="font-mono-instr tabular-nums"
          dica="É o número de vagas do link de convite. Zero significa que a unidade não é de cotas."
        />
        {/* Era `rounded-xl` — 12px, degrau que a escala não tem. Botão é peça
            que se TOCA, então `--raio-controle`; é o desenho que os outros
            ~10 botões de formulário do app já usam com este mesmo par de
            classes. Fica menos redondo que o painel de propósito: raio maior
            é o que contém, raio menor é o que se aperta. */}
        <button className={`${ACAO_NAO_ESTICA} rounded-[var(--raio-controle)] border border-line py-3 text-sm font-semibold`}>
          Salvar cota
        </button>
      </form>

      <SecaoPagina icone="sinal">Link de convite</SecaoPagina>
      <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
        {urlLink ? (
          <>
            <p className="break-all font-mono-instr text-xs text-dim">{urlLink}</p>
            {/* AUDITORIA 19/08, B3 — A COPY DIZIA O QUE O BACKEND NÃO FAZ.
                Ela prometia "cada cadastro ocupa uma vaga; ao lotar, o link
                para de aceitar sozinho", e não existe resgate automático
                nenhum: `convites_cotista` só é legível pelo dono e não há
                policy que deixe alguém criar o próprio vínculo de COTISTA a
                partir do código. A rota `/convite-cotista/[codigo]` passou a
                existir nesta rodada (era 404), mas quem abre o link ainda
                termina falando com a administradora — e é isso que o ADM
                precisa saber ANTES de mandar o link no grupo, senão são dez
                pessoas travadas e ele sem entender por quê. */}
            <p className="apoio mt-2 text-dim">
              Mande no grupo da unidade. Quem abrir o link vai ver de qual unidade ele é e receber o
              código para te passar — a liberação do acesso ainda é sua, aqui embaixo. A cota é o
              teto: {vagas.rotulo} hoje.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Acesse a ${painel.embarcacao.nome} no Commander: ${urlLink}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-11 items-center rounded-[var(--raio-controle)] border border-line px-3.5 text-sm font-medium"
              >
                Compartilhar
              </a>
              {/* §13: redefinir o link NÃO remove usuários. A confirmação diz
                  isso com todas as letras — sem ela, o ADM hesitaria em
                  trocar um link vazado com medo de derrubar dez pessoas. */}
              <form action={redefinirLink}>
                <Confirmar
                  mensagem="O link atual para na hora. Ninguém que já entrou perde acesso."
                  rotulo="Gerar link novo"
                  className="flex h-11 items-center rounded-[var(--raio-controle)] border border-line px-3.5 text-sm font-medium"
                />
              </form>
            </div>
          </>
        ) : (
          <>
            <p className="corpo">Esta unidade ainda não tem link de convite.</p>
            <p className="apoio mt-1 text-dim">
              O link é um só, compartilhável, e vale até você trocá-lo.
            </p>
            <form action={redefinirLink} className="mt-3">
              <button className="flex h-11 items-center rounded-[var(--raio-controle)] bg-accent px-4 text-sm font-semibold text-acao-texto">
                Gerar link
              </button>
            </form>
          </>
        )}
      </div>

      <SecaoPagina icone="pessoas">
        Cotistas com acesso{lista.length > 0 ? ` — ${lista.length}` : ""}
      </SecaoPagina>
      {lista.length === 0 ? (
        <EstadoVazio
          variant="linha"
          icone="pessoas"
          titulo="Nenhum cotista ainda"
          descricao={urlLink ? "Compartilhe o link acima no grupo da unidade." : undefined}
        />
      ) : (
        <div className="space-y-2">
          {lista.map((v) => {
            const nome = nomePorId.get(v.usuario_id) || "Cotista"
            // B10 — a tela reimplementava `v.suspenso_em != null`. A regra tem
            // dono (`estaSuspenso`, com teste); duas cópias da mesma condição
            // não quebram hoje, só garantem que vão divergir amanhã.
            const suspenso = estaSuspenso({ suspensoEm: v.suspenso_em })
            return (
              <div
                key={v.id}
                className={`sombra-1 rounded-[var(--raio-cartao)] border bg-panel p-3.5 ${
                  suspenso ? "border-line border-l-2 border-l-crit" : "border-line"
                }`}
              >
                <div className="flex items-center gap-2">
                  <p className="titulo-card min-w-0 flex-1 truncate">{nome}</p>
                  {suspenso && (
                    <span className="shrink-0 rounded-[var(--raio-pilula)] border border-crit/40 px-2 py-0.5 text-xs text-crit">
                      Suspenso
                    </span>
                  )}
                </div>
                {/* Nada de dinheiro aqui: o §13 diz que a cobrança acontece
                    fora do Commander, então a única coisa que a tela afirma é
                    quando o acesso foi suspenso — que é fato do app. */}
                {suspenso && (
                  <>
                    <p className="apoio mt-1 text-dim">
                      Suspenso em{" "}
                      <span className="font-mono-instr tabular-nums">
                        {new Date(v.suspenso_em!).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                      </span>
                    </p>
                    {/* A frase que o cotista lê do outro lado, mostrada aqui
                        pro ADM saber exatamente o que ele está dizendo em nome
                        da administradora — e que o app não fala em dívida,
                        valor nem prazo (§13). */}
                    <p className="apoio mt-1 text-dim">“{MENSAGEM_SUSPENSO}”</p>
                  </>
                )}
                <form action={alternarSuspensao} className="mt-3 space-y-2">
                  <input type="hidden" name="vinculo_id" value={v.id} />
                  <input type="hidden" name="suspender" value={suspenso ? "0" : "1"} />
                  {/* §22 — o motivo é o campo que transforma a trilha de
                      auditoria em resposta. Opcional de propósito: exigi-lo
                      faria o ADM digitar "." pra passar da tela, e um motivo
                      inventado é pior que motivo nenhum. */}
                  <Campo
                    label={suspenso ? "Motivo da reativação — opcional" : "Motivo da suspensão — opcional"}
                    id={`motivo-${v.id}`}
                    name="motivo"
                    placeholder="Fica registrado com seu nome e a hora"
                  />
                  <button
                    className={`flex h-11 items-center gap-1.5 rounded-[var(--raio-controle)] border px-3.5 text-sm font-medium ${
                      suspenso ? "border-ok/40 text-ok" : "border-line text-dim"
                    }`}
                  >
                    <Icone nome={suspenso ? "escudo" : "alerta"} className="size-4" />
                    {suspenso ? "Reativar acesso" : "Suspender acesso"}
                  </button>
                </form>
              </div>
            )
          })}
        </div>
      )}

      {/* §22 — a trilha. Só bloqueio e desbloqueio: é o que esta tela produz,
          e uma lista com todo evento da unidade viraria log de sistema numa
          tela de gestão de pessoas. */}
      {eventos.length > 0 && (
        <>
          <SecaoPagina icone="escudo">Histórico de acesso</SecaoPagina>
          <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
            {eventos.map((e) => (
              <div key={e.id} className="border-b border-line py-3 last:border-0">
                <p className="corpo">
                  {/* A frase mora no domínio (`linhaDeAuditoria`, com teste).
                      Autor sem perfil legível vira "a administradora": o fato
                      é que a administradora bloqueou — o nome é que se perdeu,
                      e inventar um seria pior. */}
                  {linhaDeAuditoria(
                    (e.autor_id && nomePorId.get(e.autor_id)) || "A administradora",
                    e.evento,
                    e.criado_em,
                    e.alvo,
                  )}
                </p>
                {e.motivo && <p className="apoio mt-0.5 text-dim">Motivo: {e.motivo}</p>}
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  )
}
