import Link from "next/link"
import { Logo } from "@/components/logo"
import { entrarComoCotista } from "@/lib/acoes/cotistas"
import {
  MENSAGEM_SUSPENSO, mensagemDeRecusa, podeEntrarComLink, vagasDeCotista,
} from "@/lib/domain/cotistas"
import { supabaseServer } from "@/lib/supabase/server"

/**
 * CONVITE DE COTISTA — a sala que faltava no fim do corredor.
 * PRD-UPGRADE-3-COTAS §13. Auditoria de 19/08, achados B3, C2 e P1-6.
 *
 * ---------------------------------------------------------------------------
 * O CICLO AGORA FECHA — ONDA 84
 * ---------------------------------------------------------------------------
 * Esta página nasceu meia: `/cotistas` gerava `…/convite-cotista/<codigo>` e
 * quem clicava caía num 404. A onda anterior matou o 404, mas o RESGATE
 * continuou impossível, e o arquivo dizia isso em voz alta — faltavam do lado
 * do banco as duas funções que o convite de tripulação tem desde a migration
 * 008. Elas existem agora (migration 077):
 *
 *   · `info_convite_cotista(codigo)` — nome da unidade, se o link vale, o
 *     estado da vaga, e se QUEM ESTÁ OLHANDO já faz parte. Legível por
 *     anônimo, de propósito: sem isso a tela teria de exigir conta antes de
 *     dizer do que se trata, e ninguém cria conta às cegas.
 *   · `aceitar_convite_cotista(codigo)` — cria o vínculo COTISTA, com a vaga
 *     e a matriz decididas no SQL. `vinculos` continua SEM policy de INSERT;
 *     nada aqui afrouxou o isolamento entre contas.
 *
 * ---------------------------------------------------------------------------
 * A DISCIPLINA DA TELA
 * ---------------------------------------------------------------------------
 * "Não encontrei este convite" NÃO É "este convite é inválido". Agora os dois
 * casos são DISTINGUÍVEIS — a RPC devolve zero linhas para código inexistente
 * e `valido = false` para link que o ADM redefiniu — e cada um tem sua frase.
 * Continua valendo a regra que veio da auditoria de `/patio` (B7): falha de
 * leitura nunca vira acusação contra quem chegou.
 *
 * O botão "Entrar" só aparece quando as três recusas do §13 passaram
 * (`podeEntrarComLink`, com teste). Botão que a RPC vai recusar é pior que
 * ausência de botão, porque gasta a confiança de quem clicou — e a RPC repete
 * a checagem de qualquer jeito, porque a vaga pode acabar entre desenhar e
 * clicar.
 */

interface InfoConviteCotista {
  nome_embarcacao: string
  valido: boolean
  vagas_total: number
  vagas_ocupadas: number
  ja_faz_parte: boolean
  suspenso: boolean
}

export default async function ConviteCotistaPage({
  params,
  searchParams,
}: {
  params: Promise<{ codigo: string }>
  searchParams: Promise<{ erro?: string }>
}) {
  const { codigo } = await params
  const { erro } = await searchParams
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  // A URL de volta pra cá, pra pessoa não perder o convite ao entrar na conta.
  const voltarPraCa = `/convite-cotista/${encodeURIComponent(codigo)}`

  const { data: bruto } = await supabase
    .rpc("info_convite_cotista", { p_codigo: codigo })
    .maybeSingle()
  const info = bruto as InfoConviteCotista | null

  // As três recusas do §13 saem do domínio (`podeEntrarComLink`), com teste —
  // a tela não reimplementa nenhuma delas. `vagas_total = 0` (o default de
  // `cotas_total`) cai em "sem vaga", que é a leitura certa: unidade sem cota
  // definida não é unidade de cotas, e a administradora precisa definir a
  // cota em /cotistas antes de o link valer.
  const recusa = info
    ? podeEntrarComLink(
        info.valido,
        vagasDeCotista(info.vagas_total, info.vagas_ocupadas),
        info.ja_faz_parte,
      )
    : null

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[430px] px-4 pb-10 pt-8 text-center">
      <div className="text-base"><Logo /></div>

      <h1 className="titulo-pagina mt-6">Convite de cotista</h1>
      {info && (
        <p className="corpo mt-2 text-dim">
          Unidade <span className="font-semibold text-texto">{info.nome_embarcacao}</span>
        </p>
      )}

      {/* O erro devolvido pela action vem antes de tudo: é a resposta ao
          último gesto da pessoa, e ela precisa lê-lo sem procurar. */}
      {erro && (
        <p className="mx-auto mt-6 max-w-[320px] rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2 text-sm">
          {erro}
        </p>
      )}

      {!info ? (
        <p className="corpo mx-auto mt-6 max-w-[320px] text-dim">
          Não encontramos este convite. Confira o link com a administradora da unidade.
        </p>
      ) : info.suspenso ? (
        /* Suspensão vem antes das recusas: é o único caso em que a pessoa JÁ
           tem vínculo e mesmo assim não entra, e a frase que explica isso é a
           que o §13 escreveu (`MENSAGEM_SUSPENSO`) — sem falar em dívida,
           valor ou prazo, porque a cobrança acontece fora do Commander. */
        <p className="corpo mx-auto mt-6 max-w-[320px] text-dim">{MENSAGEM_SUSPENSO}</p>
      ) : recusa ? (
        <>
          <p className="corpo mx-auto mt-6 max-w-[320px] text-dim">{mensagemDeRecusa(recusa)}</p>
          {recusa === "ja_e_cotista" && (
            <Link
              href="/hoje"
              className="mt-6 inline-flex h-11 items-center rounded-[var(--raio-controle)] bg-accent px-5 text-sm font-semibold text-acao-texto"
            >
              Abrir a unidade
            </Link>
          )}
        </>
      ) : !user ? (
        <>
          <p className="corpo mx-auto mt-6 max-w-[320px] text-dim">
            Entre na sua conta para receber o acesso de cotista desta unidade.
          </p>
          {/* `volta` é o parâmetro que `/login` já conhece e que passa pelo
              `destinoSeguro` antes de virar redirect — não invento um segundo
              canal de retorno. */}
          <Link
            href={`/login?volta=${encodeURIComponent(voltarPraCa)}`}
            className="mt-6 inline-flex h-11 items-center rounded-[var(--raio-controle)] bg-accent px-5 text-sm font-semibold text-acao-texto"
          >
            Entrar ou criar conta
          </Link>
        </>
      ) : (
        <>
          <p className="corpo mx-auto mt-6 max-w-[330px] text-dim">
            Você vai receber acesso de cotista a esta unidade: vê a ficha, os motores, os
            documentos, as fotos e o histórico. Nada que você enviar altera o registro oficial
            sozinho — quem incorpora é a administradora.
          </p>
          <p className="apoio mt-3 text-dim">
            Vaga <span className="tabular-nums">{vagasDeCotista(info.vagas_total, info.vagas_ocupadas).rotulo}</span>
          </p>
          <form action={entrarComoCotista} className="mx-auto mt-6 max-w-[320px]">
            <input type="hidden" name="codigo" value={codigo} />
            <button className="w-full rounded-[var(--raio-controle)] bg-accent py-3.5 font-semibold text-acao-texto">
              Entrar como cotista
            </button>
          </form>
        </>
      )}

      <p className="apoio mx-auto mt-8 max-w-[320px] text-dim">
        O acesso de cotista é fornecido pela administradora da unidade. O Commander não cobra nada
        de você por ele.
      </p>
    </main>
  )
}
