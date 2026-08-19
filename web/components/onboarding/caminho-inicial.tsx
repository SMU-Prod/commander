import { Icone } from "@/components/icone"
import { Cartao } from "@/components/ui/cartao"
import { LinhaLista } from "@/components/ui/linha-lista"
import type { PassoInicial } from "@/lib/domain/inicio"

/**
 * O CAMINHO DO DIA 1 — o que a Início nunca disse.
 * ===========================================================================
 * A frase que originou este bloco é do dono: *"não sei nem o que fazer, como
 * cadastrar as coisas"*. A auditoria de produto de 19/08 mediu o porquê e o
 * achado é preciso: os cartões vazios da Início já têm título, motivo e ação
 * — o que falta é a SEQUÊNCIA. Dez portas abertas ao mesmo tempo, e nenhuma
 * dizendo "esta primeiro". Um barco recém-cadastrado chega a mostrar quatro a
 * cinco estados vazios de uma vez (`components/ui/estado-vazio.tsx` registra
 * isso no próprio arquivo), cada um convidando pra um lugar diferente.
 *
 * POR QUE UM CARTÃO E NÃO UM PASSO A PASSO EM TELA CHEIA. O wizard já existe
 * e já rodou: é `/onboarding`, e é ele que cria o barco. Um segundo wizard
 * depois dele tomaria a tela de quem só queria ver o barco, e o preço de
 * fechá-lo por engano é não achar o caminho nunca mais. Aqui o caminho vive
 * NA tela de casa, no lugar onde a dúvida acontece, e desaparece sozinho —
 * `precisaDoCaminhoInicial` é quem decide, a partir do estado do barco, e não
 * existe botão de dispensar justamente pra que o sumiço seja consequência de
 * ter feito, nunca de ter escondido.
 *
 * POR QUE LISTA COM DIVISÓRIA E NÃO TRÊS CARTÕES. Três cartões seriam três
 * objetos independentes — exatamente o "tudo zoneado" que o dono descreve, e
 * o defeito que a auditoria mediu em `/barco` (treze caixas para o que é um
 * menu). `LinhaLista` dá linha de 52–64px com borda inferior, que é a anatomia
 * de lista da referência (HAULIX §28) e a mesma de `/diario`, a tela mais bem
 * resolvida do app.
 *
 * A MARCA DO PASSO É NÚMERO OU SINAL DE FEITO, E NUNCA COR DE ESTADO. Verde,
 * âmbar e vermelho são estado do BARCO (docs/DESIGN.md §5, PRD §1.1) — pintar
 * de verde um passo concluído emprestaria a cor da saúde da embarcação para
 * dizer outra coisa. O contraste que guia o olho aqui é o oposto: o pendente
 * fica na cor do texto e o feito fica cinza, então o olho cai em quem ainda
 * pede alguma coisa.
 */
export function CaminhoInicial({
  passos,
  peso,
  className = "",
}: {
  passos: PassoInicial[]
  /**
   * O grau vem de FORA porque a regra que ele serve é da TELA, não deste
   * bloco: um `assunto` por tela (docs/DESIGN.md §5). Quem sabe se a Saúde já
   * tem o que dizer é a Início, e enquanto ela não tem, o assunto é este
   * caminho — os dois nunca são assunto ao mesmo tempo.
   */
  peso: "secao" | "assunto"
  className?: string
}) {
  const faltam = passos.filter((p) => !p.feito).length
  return (
    <Cartao
      icone="ancora"
      titulo="Comece por aqui"
      subtitulo="Nesta ordem — é o que acende a Saúde e liga os avisos deste barco."
      peso={peso}
      className={className}
      /* O 28px da tela quando o barco ainda não tem estado: no dia 1 a única
         coisa que muda a decisão do dia é QUANTOS passos faltam, e a lista
         logo abaixo diz quais. Numeral em 600 tabular (HAULIX §11 — dado
         operacional) e a palavra em 12px: a fonte de instrumento é do NÚMERO,
         não da frase (docs/DESIGN.md §5).
         E ELE SÓ SAI QUANDO ESTE CARTÃO É O ASSUNTO. A voz de 28px é a voz do
         assunto da tela — um cartão de seção que a usasse criaria o segundo
         28px, e dois assuntos numa tela é zero assunto (docs/DESIGN.md §5).
         Assim que a Saúde passa a ter o que dizer, ela fica com o número
         grande e este cartão encolhe para o que ele é: o que ainda falta. */
      valor={
        peso === "assunto" ? (
          <>
            <span className="font-mono-instr font-semibold tabular-nums">{faltam}</span>
            <span className="apoio text-dim"> {faltam === 1 ? "passo" : "passos"}</span>
          </>
        ) : undefined
      }
    >
      {passos.map((p, i) => (
        <LinhaLista
          key={p.id}
          /* Passo feito não navega: ele já é resposta, não convite. */
          href={p.feito ? undefined : p.href}
          leading={<MarcaDoPasso numero={i + 1} feito={p.feito} />}
          titulo={p.titulo}
          /* O motivo só aparece onde ele ainda é argumento pra agir. No passo
             concluído ele viraria peso morto numa lista que precisa ser lida
             de relance — "densidade é respeito" (docs/DESIGN.md §6.5). */
          subtitulo={p.feito ? undefined : p.destrava}
        />
      ))}
    </Cartao>
  )
}

/**
 * O número do passo, ou o sinal de que ele saiu.
 *
 * Os 24px são DESENHO e não alvo — a mesma separação de `ALVO_ACAO`/
 * `PILULA_ACAO` (`lib/ui/acoes.ts`): quem carrega os 44px é a linha inteira,
 * que é o elemento clicável. Escrito à mão aqui porque não existe componente
 * de "marcador de passo" no app e criar um sem um segundo consumidor seria a
 * prateleira vazia que `lib/ui/acoes.ts` documenta ter derrubado; o vestido é
 * o mesmo do contador "+N" de tripulantes que a Início já desenha (pílula,
 * `bg-panel2`, borda, mono), então não é forma nova, é a forma repetida.
 */
function MarcaDoPasso({ numero, feito }: { numero: number; feito: boolean }) {
  const forma = "flex size-6 shrink-0 items-center justify-center rounded-[var(--raio-pilula)] border border-line bg-panel2"
  return feito ? (
    <span className={forma}>
      {/* O `Icone` é `aria-hidden` por construção, e o número do passo pendente
          é lido em voz alta pelo próprio caractere — sem esta palavra, um passo
          concluído e um pendente soariam idênticos em leitor de tela. */}
      <span className="sr-only">Concluído:</span>
      <Icone nome="check" className="size-3.5 text-dim" />
    </span>
  ) : (
    <span className={`${forma} apoio font-mono-instr tabular-nums`}>{numero}</span>
  )
}
