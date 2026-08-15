import Link from "next/link"
import { Farol } from "@/components/farol"
import { Icone, type NomeIcone } from "@/components/icone"
import { ROTULO_ESTADO_SAUDE, type EstadoSaude, type SaudeEmbarcacao } from "@/lib/domain/saude"

/**
 * ANEL DE STATUS — onda 46: deixou de ser medidor e virou INDICADOR.
 *
 * Até a onda 45 este componente desenhava um arco preenchido proporcional à
 * nota e escrevia "82%" no centro. O PRD FINAL proíbe porcentagem na Saúde
 * em três lugares (§1.1, §27.2, §28) e o dono autorizou a troca em
 * 15/08/2026 — ver o histórico completo em `lib/domain/saude.ts`.
 *
 * Barra de progresso e arco parcial estão fora junto com o número: barra é
 * porcentagem desenhada, e um arco em 3/4 de volta é lido como "75%" mesmo
 * sem legenda. Por isso o círculo aqui é SEMPRE completo — ele é moldura, não
 * medida. O que muda é a COR e o RÓTULO, exatamente o que o §5 define.
 *
 * As cores são as de farol que o app inteiro já usa (`components/farol.tsx`,
 * `lib/domain/semaforo.ts`): verde/amarelo/vermelho. Nenhuma cor nova, e o
 * mapeamento estado -> farol mora no domínio (`FAROL_ESTADO_SAUDE`), não
 * aqui — a tela não decide o que é grave.
 */
const CLASSE_COR: Record<EstadoSaude, string> = {
  saudavel: "text-ok",
  atencao: "text-warn",
  acao_necessaria: "text-crit",
}

// "escudo" pra saudável (o barco está protegido) e "alerta" pros dois estados
// que pedem alguma coisa da pessoa. Ícones existentes, sem desenho novo.
const ICONE: Record<EstadoSaude, NomeIcone> = {
  saudavel: "escudo",
  atencao: "alerta",
  acao_necessaria: "alerta",
}

const TAMANHO = 116
const ESPESSURA = 11
const RAIO = (TAMANHO - ESPESSURA) / 2

export function AnelStatus({ saude }: { saude: SaudeEmbarcacao }) {
  if (saude.estado == null) {
    return (
      <div className="sombra-1 rounded-[14px] border border-line bg-panel p-4 text-center">
        <Icone nome="escudo" className="mx-auto size-7 text-dim" />
        <p className="corpo mt-2 font-medium">Ainda sem dados pro status geral</p>
        <p className="apoio mt-1 text-dim">
          Cadastre motores com horas ou vencimentos com data pra saber como está a embarcação.
        </p>
        {/* ONDA 54 — mesma correção do estado vazio de /hoje: única ação do
            card, precisa dos 44px de alvo de toque. */}
        <Link href="/barco" className="apoio mt-1 inline-flex min-h-11 items-center px-2 text-accent-forte">Completar em Embarcação</Link>
      </div>
    )
  }

  const cor = CLASSE_COR[saude.estado]
  const rotulo = ROTULO_ESTADO_SAUDE[saude.estado]

  return (
    <div className="sombra-1 flex items-center gap-4 rounded-[14px] border border-line bg-panel p-4">
      <div
        className="relative shrink-0"
        style={{ width: TAMANHO, height: TAMANHO }}
        role="img"
        aria-label={`Status geral da embarcação: ${rotulo}`}
      >
        <svg viewBox={`0 0 ${TAMANHO} ${TAMANHO}`} width={TAMANHO} height={TAMANHO} aria-hidden="true">
          {/* Disco de fundo levíssimo: dá corpo ao medalhão sem virar
              "quanto está preenchido" — a opacidade é fixa, não varia com
              nada. */}
          <circle cx={TAMANHO / 2} cy={TAMANHO / 2} r={RAIO} className={`${cor} opacity-[0.08]`} fill="currentColor" />
          {/* Círculo COMPLETO, sempre. Sem strokeDasharray/strokeDashoffset:
              não existe fração pra desenhar. */}
          <circle
            cx={TAMANHO / 2} cy={TAMANHO / 2} r={RAIO} fill="none"
            strokeWidth={ESPESSURA} stroke="currentColor"
            className={`${cor} transition-colors duration-500 ease-out`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-4 text-center">
          <Icone nome={ICONE[saude.estado]} className={`size-6 ${cor}`} />
          <span className={`text-[11px] font-semibold leading-tight ${cor}`}>{rotulo}</span>
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="corpo flex items-center gap-2">
          <Farol status="ok" /> Em dia
          <span className="ml-auto font-mono-instr tabular-nums">{String(saude.emDia).padStart(2, "0")}</span>
        </p>
        <p className="corpo flex items-center gap-2">
          <Farol status="atencao" /> Atenção
          <span className="ml-auto font-mono-instr tabular-nums">{String(saude.atencao).padStart(2, "0")}</span>
        </p>
        <p className="corpo flex items-center gap-2">
          <Farol status="vencido" /> Vencidos
          <span className="ml-auto font-mono-instr tabular-nums">{String(saude.vencido).padStart(2, "0")}</span>
        </p>
        <Link href="/barco/saude" className="apoio mt-2 inline-block text-accent-forte">Ver detalhes</Link>
      </div>
    </div>
  )
}
