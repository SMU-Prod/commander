import Link from "next/link"
import { redirect } from "next/navigation"
import { Confirmar } from "@/components/confirmar"
import { Icone } from "@/components/icone"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { Campo } from "@/components/ui/campo"
import { carregarPainel } from "@/lib/consultas"
import { cancelarTransferencia, iniciarTransferencia } from "@/lib/acoes/transferencia"
import { supabaseServer } from "@/lib/supabase/server"
import { urlPublica } from "@/lib/url-publica"
import type { Transferencia } from "@/lib/db/types"

export default async function TransferirPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; criado?: string }>
}) {
  const { erro, criado } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (painel.papel !== "PROP") redirect(`/barco?erro=${encodeURIComponent("Só o proprietário transfere a embarcação.")}`)

  const supabase = await supabaseServer()
  // Expirada mas ainda "pendente" (nada zera o status sozinho) não deve
  // travar um novo pedido na tela — só o card com um link que já não
  // funciona mais. `iniciarTransferencia` cancela qualquer pendente antes
  // de criar a próxima, expirada ou não; aqui é só a exibição.
  const { data: pendente } = await supabase
    .from("transferencias")
    .select("*")
    .eq("embarcacao_id", painel.embarcacao.id)
    .eq("status", "pendente")
    .gt("expira_em", new Date().toISOString())
    .maybeSingle()
  const transferencia = pendente as Transferencia | null
  // O link só existe quando há transferência pendente; `urlPublica()` lê o
  // pedido HTTP e não tem por que rodar quando não há link para montar.
  const link = transferencia ? `${await urlPublica()}/convite/${transferencia.codigo}` : null

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref="/barco/editar"
        voltarRotulo="Gerenciar embarcação"
        titulo="Transferir propriedade"
        descricao={`${painel.embarcacao.nome} passa a ter outro proprietário.`}
      />

      {erro && <p className="mt-3 rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2 corpo">{erro}</p>}

      <div className="mt-4 rounded-[var(--raio-cartao)] border border-warn/35 bg-warn/10 p-3">
        <p className="corpo font-semibold">O que acontece quando for aceito</p>
        <ul className="mt-2 space-y-1.5 corpo text-dim">
          <li>· Você perde o acesso a esta embarcação — não dá pra desfazer depois de aceito.</li>
          <li>· A tripulação atual também perde o acesso; o novo dono reconvida quem quiser.</li>
          <li>· Motores, horas, manutenções, ocorrências, fotos e documentos continuam com o barco.</li>
        </ul>
      </div>

      {/* O QUARTO MARCADOR QUE FALTAVA — auditoria de produto de 19/08/2026,
          achado 1.1, o mais caro do app.
          A caixa acima existia com três marcadores e todos falavam do que
          CONTINUA. A RPC `aceitar_transferencia` (lida da definição viva do
          banco, não do arquivo de migration) faz cinco escritas que nenhum dos
          três menciona: `delete` em `lancamentos_financeiros`,
          `recorrencias_financeiras`, `carteiras` e `contatos`, e um `update`
          que zera `custo_centavos`, `passageiros` e `tripulacao` de TODA linha
          de `eventos` daquele barco. O dono autorizava a destruição do próprio
          histórico financeiro lendo uma tela que só falava do que sobrevive.
          Bloco separado e em `crit`, não um quarto item na lista de cima, por
          decisão: o que continua e o que é destruído não são a mesma classe de
          consequência, e enfileirar os dois faz o segundo ser lido no ritmo do
          primeiro.
          Isto NÃO conserta o comportamento — conserta a mentira. A correção do
          comportamento (preservar em vez de apagar, conforme o PRD §17, que
          manda "não transferir" e nunca "apagar") está escrita e NÃO aplicada
          em `supabase/migrations/091_transferencia_preserva_o_financeiro.sql`,
          porque aplicar muda o que o produto promete e é decisão do dono. */}
      <div className="mt-3 rounded-[var(--raio-cartao)] border border-crit/40 bg-crit/10 p-3">
        <p className="corpo font-semibold">O que é apagado no aceite — e não volta</p>
        <ul className="mt-2 space-y-1.5 corpo text-dim">
          <li>· Todo o Financeiro deste barco: cada despesa e cada receita lançada.</li>
          <li>· As contas recorrentes.</li>
          <li>· As Carteiras da tripulação, com saldo e histórico.</li>
          <li>· A agenda de contatos de confiança (mecânico, marina, fornecedores).</li>
          <li>
            · De cada saída do Diário: o custo, os passageiros e a tripulação. A saída em si
            continua no histórico do barco; o dinheiro e as pessoas dela, não.
          </li>
        </ul>
        <p className="corpo mt-2">
          Isso não fica com você nem vai para o novo dono — some para os dois, no instante do
          aceite. Se você precisa desse histórico (imposto de renda, provar o custo na
          negociação),{" "}
          <Link href="/barco/resumos" className="text-accent-forte">
            exporte os Relatórios em PDF
          </Link>{" "}
          antes de gerar o link.
        </p>
      </div>

      {criado && transferencia && (
        <p className="mt-4 rounded-[var(--raio-controle)] border border-ok/40 bg-panel px-3 py-2 corpo">
          Link de transferência criado — compartilhe com quem vai assumir o barco.
        </p>
      )}

      {transferencia ? (
        <div className="sombra-1 mt-4 rounded-[var(--raio-cartao)] border border-line bg-panel p-3">
          <p className="corpo font-semibold">Transferência aguardando aceite</p>
          <p className="apoio mt-1 text-dim">
            Para <span className="text-texto">{transferencia.destinatario_email}</span> · expira em{" "}
            {new Date(transferencia.expira_em).toLocaleDateString("pt-BR")}
          </p>
          {/* A janela em que ainda dá para voltar atrás, dita em voz alta. O
              apagamento do financeiro acontece no aceite, não aqui — e quem
              gerou o link sem ter lido a caixa vermelha precisa saber que
              cancelar ainda resolve. */}
          <p className="apoio mt-1 text-dim">
            Nada foi apagado ainda. O Financeiro some no instante do aceite — até lá, cancelar
            desfaz tudo.
          </p>
          <p className="mt-3 break-all rounded-[var(--raio-controle)] border border-line bg-campo px-3 py-2 tabular-nums text-xs text-dim">
            {link}
          </p>
          {/* A fileira do canvas (tela-4d): compartilhar em contorno ocupando a
              linha, cancelar em vermelho ao lado — e cancelar SEMPRE pede
              confirmação (fluxo sensível; o link para de funcionar na hora). */}
          <div className="mt-3 flex items-center gap-2">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Você vai assumir a propriedade da ${painel.embarcacao.nome} no Commander: ${link}`)}`}
              target="_blank" rel="noopener noreferrer"
              className="flex h-11 flex-1 items-center justify-center rounded-[var(--raio-controle)] border border-line text-sm font-medium"
            >
              Compartilhar no WhatsApp
            </a>
            <form action={cancelarTransferencia} className="shrink-0">
              <input type="hidden" name="transferencia_id" value={transferencia.id} />
              <Confirmar rotulo="Cancelar" mensagem="Cancelar? O link para de funcionar." className="flex h-11 items-center px-3 text-sm font-medium text-crit" />
            </form>
          </div>
        </div>
      ) : (
        <form action={iniciarTransferencia} className="mt-4 space-y-3 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
          <Campo
            label="E-mail de quem vai assumir"
            id="email"
            name="email"
            type="email"
            required
            placeholder="novo.dono@email.com"
            dica="O Commander não envia nada: você recebe um link pra mandar por WhatsApp ou como preferir. Só quem entrar com esse e-mail consegue aceitar — se ainda não tiver conta, cria na hora."
          />
          {/* Achado 1.2 da auditoria de 19/08: o botão dizia "Enviar convite de
              transferência" e `iniciarTransferencia` não envia e-mail, push nem
              notificação — faz um `insert` em `transferencias` e redireciona. O
              destinatário só descobre se o dono copiar o link na mão, que é o
              que a tela oferece DEPOIS, quando a pessoa já foi embora achando
              que enviou. `/tripulacao`, que é o mesmo mecanismo, já era honesta
              ("Convidar comandante" → "Convite criado" → WhatsApp); esta era a
              única tela do app que usava o verbo enviar sem enviar. */}
          <button className="w-full rounded-[var(--raio-controle)] bg-accent py-3 font-semibold text-acao-texto">
            Gerar link de transferência
          </button>
        </form>
      )}

      <p className="apoio mt-4 text-dim">
        <Icone nome="transferir" className="mr-1 inline size-3.5 align-text-bottom" />
        Prefere só dar acesso, sem trocar de dono?{" "}
        <Link href="/tripulacao" className="text-accent-forte">Convide como tripulação</Link>.
      </p>
    </main>
  )
}
