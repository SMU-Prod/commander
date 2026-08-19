import { redirect } from "next/navigation"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { LinhaLista } from "@/components/ui/linha-lista"
import { carregarCaixaDeEntrada } from "@/lib/consultas-mensagens"
import { RELACAO_DO_OUTRO, rotuloNaoLidas } from "@/lib/domain/mensagens"
import { supabaseServer } from "@/lib/supabase/server"

/**
 * MENSAGENS — a caixa de entrada das conversas do Marketplace.
 *
 * O pedido do dono: *"as mensagens devem ser trocadas no próprio app"*. Até
 * aqui o fluxo ia da proposta ao WhatsApp, e o Commander perdia o registro do
 * combinado — que é o que ele vende e o que protege os dois lados numa
 * discussão depois.
 *
 * NÃO É SUPORTE. O §65 do PRD ("CHAT COMMANDER") fala de falar com a EQUIPE
 * Commander e admite WhatsApp/Intercom. Esta tela é outra coisa: conversa
 * entre PESSOAS do app, sempre ancorada num pedido concreto.
 *
 * A LISTA NÃO TEM FILTRO, E É DECISÃO. As telas irmãs (Avisos, Marketplace,
 * Financeiro) filtram porque têm dezenas de linhas de naturezas diferentes.
 * Aqui as linhas são todas a mesma coisa — uma pessoa esperando resposta — e a
 * ordem por atividade já responde a única pergunta que se faz abrindo esta
 * tela ("o que mexeu?"). Um chip "Não lidas" com duas conversas na lista seria
 * mobília.
 *
 * NENHUM FILTRO DE VISIBILIDADE AQUI: a RLS da migration 090 devolve só as
 * conversas de que a pessoa é parte. Se esta tela esquecesse alguma coisa, o
 * banco continuaria não entregando o que não pode.
 */
export default async function MensagensPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; ok?: string }>
}) {
  const { erro, ok } = await searchParams
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const caixa = await carregarCaixaDeEntrada()

  return (
    <main>
      <h1 className="titulo-pagina">Mensagens</h1>
      <p className="apoio mt-1 text-dim">
        Suas conversas com quem publicou um pedido ou respondeu ao seu. Fica tudo registrado aqui.
      </p>
      {erro && <p className="corpo mt-3 rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}
      {ok && <p className="corpo mt-3 rounded-[var(--raio-controle)] border border-ok/40 bg-ok/10 px-3 py-2">{ok}</p>}

      {caixa.length === 0 ? (
        // A frase diz COMO a conversa nasce, não só que não há nenhuma: esta é
        // a única tela do app onde a pessoa não pode criar o item a partir
        // dali, e um estado vazio sem caminho é a lápide que o §6 regra 4
        // proíbe. A ação leva ao Marketplace, que é de onde a conversa vem.
        <EstadoVazio
          className="mt-6"
          icone="chat"
          titulo="Nenhuma conversa ainda"
          descricao="A conversa nasce no Marketplace: abra um pedido seu e toque em “Conversar aqui” na resposta de alguém — ou responda a um pedido e fale com quem publicou. O que for combinado fica gravado nesta tela."
          acao={{ href: "/marketplace", rotulo: "Ir ao Marketplace" }}
        />
      ) : (
        <div className="sombra-1 mt-4 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
          {caixa.map((linha) => (
            <LinhaLista
              key={linha.conversa.id}
              href={`/mensagens/${linha.conversa.id}`}
              titulo={linha.nomeDoOutro}
              // A prévia É o subtítulo, e o "Você: " na frente dela responde,
              // sem abrir nada, a pergunta que esta lista existe pra responder:
              // a bola está comigo ou com o outro? Sem mensagem, a frase do
              // estado — nunca uma linha em branco, que pareceria carregamento
              // travado.
              subtitulo={
                <>
                  {linha.previa ?? "Conversa aberta — ninguém escreveu ainda"}
                  {/* O assunto embaixo, menor: numa lista de dez conversas o
                      nome da pessoa não basta pra lembrar de qual pedido se
                      trata, e é o pedido que dá o contexto do que foi
                      combinado. */}
                  <span className="mt-0.5 block">
                    {RELACAO_DO_OUTRO[linha.papel]} · {linha.conversa.assunto}
                  </span>
                </>
              }
              // `rotuloNaoLidas` devolve `null` em zero, e `undefined` aqui é
              // a ausência do elemento: nenhuma conversa em dia ganha um "0"
              // cinza do lado. Com o valor presente, a linha vira o par
              // número + palavra do resto do app ("2 / não lidas").
              valor={rotuloNaoLidas(linha.naoLidas) ?? undefined}
              valorSecundario={
                linha.naoLidas > 0 ? (linha.naoLidas === 1 ? "não lida" : "não lidas") : undefined
              }
              valorClassName={linha.naoLidas > 0 ? "text-crit" : ""}
            />
          ))}
        </div>
      )}
    </main>
  )
}
