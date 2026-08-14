import { redirect } from "next/navigation"
import { Icone } from "@/components/icone"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { solicitarCommanderGold } from "@/lib/acoes/gold"
import { PASSOS_GOLD } from "@/lib/domain/gold"
import { carregarPainel } from "@/lib/consultas"

/**
 * Vitrine HONESTA do Commander Gold (esta onda constrói só isto — ver
 * `docs/prd/upgrade2-correcoes.txt` Correções 02/06/08/09/15/19 pra tudo que
 * ainda NÃO está aqui de propósito: pagamento, agendamento, escolha de
 * consultor, protocolo em si e admin dependem de decisão comercial do dono
 * (preços e operação de campo) e de uma onda futura dedicada).
 *
 * Regras de honestidade desta tela:
 * - não promete prazo ("a equipe entra em contato", nunca "em até X dias");
 * - não mostra preço (a tabela do PRD é referência interna, não está
 *   confirmada como preço final nem é decisão de engenharia);
 * - o botão só registra manifestação de interesse (`solicitarCommanderGold`,
 *   mesma mecânica que já existia em `lib/acoes/selo.ts` antes desta onda —
 *   grava evento + tenta avisar a equipe por e-mail), nunca finge que abriu
 *   pagamento ou agendamento.
 */
export default async function GoldPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>
}) {
  const { ok, erro } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")

  return (
    <main>
      <CabecalhoDetalhe voltarHref="/barco/selos" voltarRotulo="Selos Commander" />
      <h1 className="titulo-pagina mt-3 inline-flex items-center gap-2">
        <Icone nome="ancora" className="size-5 text-accent-forte" /> Commander Gold
      </h1>
      <p className="apoio mt-1 text-dim">
        O nível de confiança presencial do Commander: avaliação de um consultor náutico
        autorizado, seguindo o Protocolo Commander. Não depende de completar o Commander
        Verified — os dois são independentes.
      </p>

      {ok && <p className="corpo mt-3 rounded-lg border border-ok/40 bg-ok/10 px-3 py-2">{ok}</p>}
      {erro && <p className="corpo mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      <p className="rotulo mt-6 mb-2 text-dim">Como funciona</p>
      <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
        {PASSOS_GOLD.map((passo, i) => (
          <div key={passo} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-line font-mono-instr text-xs text-dim">
              {i + 1}
            </span>
            <p className={`corpo ${i === 0 ? "font-medium" : "text-dim"}`}>{passo}</p>
          </div>
        ))}
      </div>
      <p className="apoio mt-2 text-dim">
        Hoje, só o passo 1 está disponível por aqui — pagamento, agendamento e avaliação
        presencial dependem da operação de campo, que a equipe Commander ainda está
        estruturando. Ao solicitar, é a equipe quem explica o que vem a seguir.
      </p>

      <p className="rotulo mt-6 mb-2 text-dim">O que é avaliado</p>
      <p className="apoio text-dim">
        Motores, casco, elétrica, hidráulica, segurança, equipamentos aplicáveis, documentação e
        histórico — cada item marcado como avaliado, em atenção ou não aplicável pelo consultor,
        com data da avaliação, validade e a versão do Protocolo Commander usada.
      </p>

      {painel.papel === "PROP" ? (
        <form action={solicitarCommanderGold} className="mt-6">
          <button className="w-full rounded-xl bg-accent py-3 font-semibold text-acao-texto">
            Quero o Commander Gold
          </button>
          <p className="apoio mt-2 text-dim">
            Registra seu interesse — a equipe Commander entra em contato para explicar pagamento,
            agendamento e a avaliação presencial. Nenhuma cobrança acontece aqui.
          </p>
        </form>
      ) : (
        <p className="apoio mt-6 text-dim">Só o proprietário pode solicitar o Commander Gold.</p>
      )}
    </main>
  )
}
