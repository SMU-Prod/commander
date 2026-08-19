import { Farol } from "@/components/farol"
import type { StatusFarol } from "@/lib/domain/semaforo"

/**
 * ONDA 94 — O FAROL DO MOTOR PARA DE MENTIR VERDE.
 *
 * O mostrador já era honesto com o NÚMERO desde sempre (ver o comentário
 * abaixo: `null` vira "—", nunca "0,0 h"). O farol ao lado não era: `status`
 * era obrigatório, e quem chamava resolvia a ausência com `?? "ok"` — então
 * um motor SEM NENHUM item monitorado acendia verde, afirmando "em dia" sobre
 * um motor de que o app não sabe absolutamente nada.
 *
 * É o mesmo defeito que a onda 7 consertou na Início ("Tudo em dia" mentia
 * com manutenções recém-criadas) e que o passe de densidade acabou de
 * consertar no escudo do herói de `/barco`. Aqui ele estava um nível abaixo,
 * no mostrador de cada motor — o lugar onde o dono realmente olha.
 *
 * `null` agora é um estado de primeira classe e desenha o ANEL VAZIO que o
 * Casco e o Mapa da Embarcação (`FarolZona`) já usam para "sem dados": ponto
 * presente, contorno só, sem brilho. Presente na leitura, visivelmente fora
 * de jogo — que é a verdade.
 */
/**
 * ONDA 102 — O NÚMERO DO INSTRUMENTO ENTRA NA ESCADA, E A PROP MORTA SAI.
 *
 * Dois achados do passe de refino de 19/08, os dois medidos:
 *
 * · O CORPO ERA `text-4xl`/`text-2xl` (36 e 24px). A escala da casa tem seis
 *   degraus — 11 · 12 · 14 · 16 · 20 · 24 — mais o 28 do número que É o
 *   assunto, e o número do horímetro é literalmente esse (`.valor-instrumento`
 *   se descreve assim em `app/globals.css`). Trinta e seis não é degrau de
 *   nada: era o maior texto do app saindo de um tamanho que ninguém declarou.
 *   Vai para 28 — o degrau declarado — e o número CRESCE em `/barco/motores`,
 *   que é onde ele realmente mora (24 → 28), respondendo pelo caminho certo à
 *   queixa de "fontes pequenas". A classe traz junto o peso 600 e o `tnum` que
 *   o §11 do HAULIX exige do dado operacional.
 *
 * · A PROP `grande` TINHA ZERO CONSUMIDORES em todo o `web/` — os dois únicos
 *   lugares que montam um `Horimetro` (`/barco/motores` e o mock da landing)
 *   nunca a passaram. É o vício que esta casa passou as ondas 87–98 apagando
 *   (`.valor` sem uso, `--raio-painel` sem uso, `PILULA_ACAO_LARGA` sem uso):
 *   prop sem consumidor não é neutra, ela responde "é assim que se faz" a quem
 *   procura no grep. Se um dia existir um horímetro de tela cheia, ele volta
 *   com o consumidor no mesmo commit.
 */
export function Horimetro({
  rotulo,
  horas,
  status,
}: {
  rotulo: string
  horas: number | null
  /** `null` = não há item monitorado com informação suficiente. Nunca troque
   *  por `"ok"` em quem chama: é exatamente isso que o farol existe pra não
   *  dizer. */
  status: StatusFarol | null
}) {
  // horas null (equipamento sem leitura) é bem diferente de 0,0 h (motor
  // zerado de verdade) — mostrar "0,0 h" pra quem nunca informou nada
  // destrói a confiança na primeira olhada.
  const texto = horas != null
    ? horas.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    : "—"
  return (
    <div className="rounded-[var(--raio-cartao)] border border-line bg-meter text-meter-texto px-3 py-2 font-mono-instr tabular-nums">
      <div className="rotulo mb-1 flex items-center justify-between text-meter-dim">
        {rotulo}{" "}
        {status ? (
          <Farol status={status} />
        ) : (
          <span
            aria-label="Sem dados de manutenção"
            className="inline-block size-2 shrink-0 rounded-[var(--raio-pilula)] border border-meter-dim"
          />
        )}
      </div>
      {/* A unidade fica em `.apoio` (12px) e não em `text-sm` (14): ela é
          legenda do número, não um segundo número, e 14 ao lado de 28 pesava
          o suficiente pra disputar. "sem leitura" continua na mesma voz —
          é a mesma posição sintática, e trocá-la faria a ausência de dado
          parecer outra coisa que a leitura. */}
      {/* `text-meter-texto` REPETIDO AQUI, e não herdado do cartucho: a classe
          `.valor-instrumento` traz `color: var(--texto)` num `:where()`
          (especificidade 0) — e declaração de especificidade 0 no PRÓPRIO
          elemento ainda vence herança. Sem esta utilitária, no tema CLARO o
          número sairia em `--texto`, que lá é o navy da marca, sobre o navy
          fixo do cartucho: navy sobre navy. `leading-8` mantém a caixa nos 32px que o
          `text-4xl` anterior desenhava — a classe não declara entrelinha de
          propósito (ver globals.css), e sem isto o cartão crescia 10px. */}
      <div className="valor-instrumento leading-8 text-meter-texto">
        {texto} <small className="apoio text-meter-dim">{horas != null ? "h" : "sem leitura"}</small>
      </div>
    </div>
  )
}
