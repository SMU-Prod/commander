import { Confirmar } from "@/components/confirmar"
import { apagarMensagem } from "@/lib/acoes/mensagens"
import { diaCivilSP, formatarCarimbo } from "@/lib/domain/datas"
import {
  agruparPorDia,
  podeApagar,
  TEXTO_MENSAGEM_APAGADA,
  type Mensagem,
} from "@/lib/domain/mensagens"

/**
 * A thread: as mensagens em ordem, divididas por dia, com a divisória de onde
 * a pessoa parou de ler.
 *
 * TRÊS DECISÕES DE DESENHO, E NENHUMA DELAS USA COR PARA DIZER DE QUEM É A
 * MENSAGEM:
 *
 * 1. O LADO E O NOME, não a cor. Minha mensagem encosta à direita e é
 *    assinada "Você"; a do outro encosta à esquerda com o nome dele. São dois
 *    canais independentes, que é a regra 3 do docs/DESIGN.md ("estado é forma,
 *    não só cor") aplicada a autoria. A alternativa óbvia — pintar a minha de
 *    dourado — gastaria o orçamento de dois acentos por tela numa informação
 *    que a posição já dá, e numa conversa de vinte mensagens isso é vinte
 *    dourados.
 *
 * 2. O CABEÇALHO SÓ APARECE QUANDO O AUTOR MUDA. Repetir "Você · 14:32" em
 *    cinco linhas seguidas transforma a coluna num carimbo vertical e empurra
 *    o texto — que é o assunto — para metade da tela. O horário de cada
 *    mensagem continua existindo no `title` do balão, para quem precisar do
 *    minuto exato de uma linha do meio.
 *
 * 3. A MENSAGEM APAGADA CONTINUA OCUPANDO A LINHA DELA. É o ponto do modelo
 *    (migration 090): quem apaga tira o texto, não o fato. Sem a linha, a
 *    conversa mudaria de forma nas costas do outro lado — que é a diferença
 *    entre "apagou o que disse" e "reescreveu a história".
 */
export function ThreadConversa({
  conversaId,
  mensagens,
  usuarioId,
  nomeDoOutro,
  lidoAte,
}: {
  conversaId: string
  /** Já em ordem crescente de `criado_em` (a consulta ordena). */
  mensagens: readonly Mensagem[]
  usuarioId: string
  nomeDoOutro: string
  /** `null` = nunca abri esta conversa; tudo do outro lado é novo. */
  lidoAte: string | null
}) {
  // Onde entra a divisória "novas": a PRIMEIRA mensagem do outro que chegou
  // depois da minha marca. É a mesma régua de `contarNaoLidas` — se as duas
  // discordassem, o badge diria "3" e a divisória apareceria em outro lugar.
  const corte = lidoAte == null ? null : Date.parse(lidoAte)
  const idPrimeiraNova = mensagens.find((m) => {
    if (m.autor_id === usuarioId) return false
    if (corte == null) return true
    const quando = Date.parse(m.criado_em)
    return Number.isFinite(quando) && quando > corte
  })?.id ?? null

  const dias = agruparPorDia(mensagens, diaCivilSP)
  const comCabecalho = idsComCabecalho(dias)

  return (
    <div className="mt-4 space-y-4">
      {dias.map((dia) => {
        return (
          <section key={dia.dia} className="space-y-2">
            {/* A divisória de data existe porque uma negociação atravessa
                dias: "14:32" sozinho não diz se foi hoje ou na terça, e é
                justamente isso que decide se a pessoa está atrasada em
                responder. `formatarCarimbo` com uma data civil devolve
                "Hoje"/"Ontem"/"18/08" — a mesma régua do resto do app. */}
            <p className="rotulo text-center text-dim">{formatarCarimbo(dia.dia)}</p>

            {dia.mensagens.map((m) => {
              const minha = m.autor_id === usuarioId
              const mostrarAutor = comCabecalho.has(m.id)
              return (
                <div key={m.id}>
                  {m.id === idPrimeiraNova && (
                    <p className="rotulo my-3 flex items-center gap-2 text-accent-forte before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">
                      Novas
                    </p>
                  )}
                  <div className={`max-w-[85%] ${minha ? "ml-auto" : "mr-auto"}`}>
                    {mostrarAutor && (
                      <p className={`rotulo mb-1 text-dim ${minha ? "text-right" : ""}`}>
                        {minha ? "Você" : nomeDoOutro}
                      </p>
                    )}
                    <div
                      // `title` com o carimbo completo: o cabeçalho só sai a
                      // cada troca de autor, então esta é a única forma de
                      // recuperar o minuto de uma linha do meio sem encher a
                      // coluna de horários.
                      title={formatarCarimbo(m.criado_em)}
                      className={`sombra-1 rounded-[var(--raio-cartao)] border border-line p-3 ${
                        minha ? "bg-panel2" : "bg-panel"
                      }`}
                    >
                      {m.apagada_em != null ? (
                        <p className="apoio italic text-dim">{TEXTO_MENSAGEM_APAGADA}</p>
                      ) : (
                        // `whitespace-pre-line`: quem manda três medidas em
                        // três linhas quer três linhas (`corpoValido` preserva
                        // a quebra simples de propósito). `break-words` porque
                        // um link colado sem espaço estouraria o balão.
                        <p className="corpo whitespace-pre-line break-words">{m.corpo}</p>
                      )}
                    </div>
                    <div className={`mt-0.5 flex items-center gap-2 ${minha ? "justify-end" : ""}`}>
                      <span className="apoio text-dim">{horaDe(m.criado_em)}</span>
                      {podeApagar(m, usuarioId) && (
                        <form action={apagarMensagem}>
                          <input type="hidden" name="conversa_id" value={conversaId} />
                          <input type="hidden" name="mensagem_id" value={m.id} />
                          {/* `Confirmar` é o padrão da casa para ação
                              destrutiva. O `className` dá o alvo de 44px que o
                              padrão dele (texto de 12px) não alcança — é a
                              mesma correção que `CabecalhoDetalhe` faz no
                              "Voltar", com a margem negativa devolvendo ao
                              layout a folga que sobra. */}
                          <Confirmar
                            mensagem="Apagar? O texto sai e fica registrado que você apagou."
                            rotulo="Apagar"
                            className="apoio -my-2.5 inline-flex min-h-[var(--altura-controle)] items-center text-crit"
                          />
                        </form>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </section>
        )
      })}
    </div>
  )
}

/**
 * Quais mensagens levam o cabeçalho com o nome do autor: a primeira de cada
 * sequência do mesmo autor, e sempre a primeira de cada DIA — depois de uma
 * divisória de data o contexto visual já foi quebrado, e retomar sem assinar
 * obrigaria a pessoa a rolar pra cima pra saber quem falou.
 *
 * Calculado ANTES do JSX, num passe puro, e não com uma variável mutada dentro
 * do `map`: o compilador do React reprova reatribuição durante a renderização
 * (`react-hooks/immutability`), e ele tem razão — numa re-renderização parcial
 * a variável carregaria o valor da passada anterior e os cabeçalhos apareceriam
 * nas linhas erradas.
 */
function idsComCabecalho(dias: readonly { mensagens: readonly Mensagem[] }[]): Set<string> {
  const ids = new Set<string>()
  for (const dia of dias) {
    let anterior: string | null = null
    for (const m of dia.mensagens) {
      if (anterior !== m.autor_id) ids.add(m.id)
      anterior = m.autor_id
    }
  }
  return ids
}

/** Só a hora, porque a data já está na divisória do dia. Mesmo fuso de
 *  `formatarCarimbo` (`lib/domain/datas.ts`) — o app inteiro conta hora na
 *  marina, não em UTC, e uma segunda régua aqui produziria mensagens três
 *  horas no futuro. */
function horaDe(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Sao_Paulo",
  }).format(new Date(iso))
}
