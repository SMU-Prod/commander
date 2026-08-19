import Link from "next/link"
import { Logo } from "@/components/logo"
import {
  MENSAGEM_SUSPENSO, mensagemDeRecusa, podeEntrarComLink, vagasDeCotista,
} from "@/lib/domain/cotistas"
import { supabaseServer } from "@/lib/supabase/server"

/**
 * CONVITE DE COTISTA — a sala que faltava no fim do corredor.
 * PRD-UPGRADE-3-COTAS §13. Auditoria de 19/08, achados B3 e C2.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ESTA PÁGINA EXISTE, E POR QUE ELA AINDA NÃO CONCLUI A ENTRADA
 * ---------------------------------------------------------------------------
 * `/cotistas` gera `…/convite-cotista/<codigo>`, mostra a URL, e oferece um
 * botão que a manda no WhatsApp — e a rota nunca existiu. Quem recebia o link
 * do dono da unidade caía num 404, sem nem saber o que era aquilo. Era o
 * ÚNICO caminho de entrada do módulo de cotas inteiro.
 *
 * O 404 acabou. O resgate, não — e é importante que este arquivo diga por quê,
 * em vez de fingir. O lado do banco não tem o par que o convite de tripulação
 * tem (`info_convite` / `aceitar_convite`, duas funções `security definer` da
 * migration 008):
 *
 *   · `convites_cotista` só é legível por `eh_prop(embarcacao_id)` — quem
 *     ainda não faz parte da unidade não consegue nem ler o nome dela;
 *   · não há policy de INSERT em `vinculos` que permita alguém criar o
 *     próprio vínculo de COTISTA a partir de um código.
 *
 * Portanto, com código e só código, o máximo honesto é: reconhecer o link,
 * dizer o que ele é, resolver o que a conta de quem abriu permite resolver, e
 * apontar o próximo passo real (falar com a administradora). Nenhum botão
 * "Entrar" aparece aqui — botão que a policy vai recusar é pior que ausência
 * de botão, porque gasta a confiança de quem clicou.
 *
 * O que falta do lado do esquema está descrito no relatório da rodada.
 *
 * ---------------------------------------------------------------------------
 * A DISCIPLINA DA TELA
 * ---------------------------------------------------------------------------
 * "Não consegui abrir este convite" NÃO É "este convite é inválido". Os dois
 * casos são indistinguíveis daqui (a RLS devolve linha nenhuma nos dois), e
 * escolher o segundo faria a tela acusar de link velho um convite que está
 * perfeitamente vivo — a mesma classe de erro que a auditoria apontou em
 * `/patio` (B7), onde falha de leitura vira "não há saída aberta".
 */

interface Convite {
  id: string
  embarcacao_id: string
  ativo: boolean
}

export default async function ConviteCotistaPage({
  params,
}: {
  params: Promise<{ codigo: string }>
}) {
  const { codigo } = await params
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  // A URL de volta pra cá, pra pessoa não perder o convite ao entrar na conta.
  const voltarPraCa = `/convite-cotista/${encodeURIComponent(codigo)}`

  // Só resolve quando a policy deixa (hoje: o próprio dono da unidade, que é
  // quem costuma abrir o link pra conferir se ele funciona). Para todo mundo
  // mais isto volta vazio — e vazio aqui significa "não sei", não "não vale".
  const { data: bruto } = user
    ? await supabase.from("convites_cotista")
        .select("id, embarcacao_id, ativo").eq("codigo", codigo).maybeSingle()
    : { data: null }
  const convite = bruto as Convite | null

  let nomeDaUnidade: string | null = null
  let recusa: ReturnType<typeof podeEntrarComLink> = null
  let suspenso = false

  if (convite && user) {
    const [{ data: unidade }, { data: meuVinculo }, { data: cotistas }] = await Promise.all([
      supabase.from("embarcacoes").select("nome, cotas_total").eq("id", convite.embarcacao_id).maybeSingle(),
      supabase.from("vinculos").select("id, suspenso_em")
        .eq("embarcacao_id", convite.embarcacao_id).eq("usuario_id", user.id).maybeSingle(),
      supabase.from("vinculos").select("id")
        .eq("embarcacao_id", convite.embarcacao_id).eq("papel", "COTISTA"),
    ])
    nomeDaUnidade = (unidade?.nome as string | undefined) ?? null
    suspenso = meuVinculo?.suspenso_em != null

    // As três recusas do §13 saem do domínio (`podeEntrarComLink`), com teste
    // — a tela não reimplementa nenhuma delas. `cotas_total` ausente cai em 0
    // e o resultado é "sem vaga", que é a leitura certa: unidade sem cota
    // definida não é unidade de cotas.
    recusa = podeEntrarComLink(
      convite.ativo,
      vagasDeCotista(Number(unidade?.cotas_total ?? 0), (cotistas ?? []).length),
      meuVinculo != null,
    )
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[430px] px-4 pb-10 pt-8 text-center">
      <div className="text-base"><Logo /></div>

      <h1 className="titulo-pagina mt-6">Convite de cotista</h1>
      {nomeDaUnidade && (
        <p className="corpo mt-2 text-dim">
          Unidade <span className="font-semibold text-texto">{nomeDaUnidade}</span>
        </p>
      )}

      {/* Suspensão vem antes de tudo: é o único caso em que a pessoa JÁ tem
          vínculo e mesmo assim não entra, e a frase que explica isso é a que
          o §13 escreveu (`MENSAGEM_SUSPENSO`) — sem falar em dívida, valor ou
          prazo, porque a cobrança acontece fora do Commander. */}
      {suspenso ? (
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
            Entre na sua conta para que a administradora possa liberar seu acesso a esta unidade.
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
          {/* O caso comum, e o mais delicado de escrever: conta logada, link
              que não resolve daqui. Nada aqui afirma que o convite é ruim. */}
          <p className="corpo mx-auto mt-6 max-w-[330px] text-dim">
            Sua conta ainda não tem acesso a esta unidade, e a entrada por link ainda precisa passar
            pela administradora. Mande o código abaixo para ela liberar seu acesso.
          </p>
          <p className="mt-4 break-all font-mono-instr text-sm">{codigo}</p>
        </>
      )}

      <p className="apoio mx-auto mt-8 max-w-[320px] text-dim">
        O acesso de cotista é fornecido pela administradora da unidade. O Commander não cobra nada
        de você por ele.
      </p>
    </main>
  )
}
