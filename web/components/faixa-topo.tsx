import Link from "next/link"
import type { Equipamento, ItemMonitorado } from "@/lib/db/types"
import { itemMonitoradoToItemCalc } from "@/lib/domain/conversores"
import { nomeDoEquipamento } from "@/lib/domain/diario"
import { apoioDaRevisao, horasDoMotor } from "@/lib/domain/inicio"
import {
  calcularSemaforo, PESO, temInformacaoSuficiente,
  type ResultadoCalc, type StatusFarol,
} from "@/lib/domain/semaforo"
import { Avatar } from "./avatar"
import { Icone } from "./icone"
import { ContadorAvisos } from "./ui/contador-avisos"

/**
 * ONDA 60 — A FAIXA DE TOPO DO DESKTOP (spec fundação §3.3, imagem 1 do
 * catálogo `docs/DESIGN-SYSTEM.md`).
 *
 * A peça que faltava da casca da onda 57: fora da Início, o desktop não
 * tinha nem o nome do barco nem o sino — o trilho carrega o contador, mas
 * contexto ("de QUAL barco esta tela fala") não existia em lugar nenhum a
 * partir de 1024px. A faixa põe, em toda tela: nome da embarcação, KPIs de
 * motor, sino e avatar.
 *
 * A RESTRIÇÃO QUE DECIDE TUDO AQUI: a faixa deriva CADA pedaço de dado do
 * que o layout de `(app)` JÁ carrega (`carregarPainel` + `avisos`) — zero
 * consulta nova por página. É por isso que Saúde e Documentos, que a imagem
 * 1 também mostra na fileira de KPIs, ficam DE FORA: os dois exigiriam a
 * consulta de ocorrências (saúde) em TODA página, um preço por navegação que
 * um enfeite de topo não paga. O ⚠️ parcial está anotado no catálogo.
 *
 * ELA MORA DENTRO DA `[data-moldura]` (via prop `faixa` da `MolduraApp`),
 * não em `fixed`: primeiro filho da caixa de conteúdo, herda o
 * `lg:pl-[88px]` do trilho e a largura máxima de graça — alinha com o
 * conteúdo, nunca passa por baixo do trilho — e, por estar NO FLUXO, o
 * conteúdo desce a altura dela sozinho: nada sobrepõe nada (a varredura a
 * 1440 continua limpa por construção).
 *
 * `hidden lg:flex`: no celular nada muda — lá o contexto é a própria Início
 * e o sino mora na bottom-nav.
 *
 * DOURADO: zero. A regra refinada desta onda diz que o dourado de MOLDURA é
 * só o de navegação (onde-estou + FAB); a faixa nem disso precisa.
 */

/** O que a faixa precisa saber de um equipamento — subconjunto estrutural de
 *  `painel.equipamentos`, pra o teste não ter que fabricar a linha inteira. */
export type EquipamentoFaixa = Pick<Equipamento, "id" | "tipo" | "posicao" | "horas_atuais">

/** Idem para itens monitorados: os campos que `itemMonitoradoToItemCalc` lê,
 *  mais o vínculo com o equipamento. `painel.itens` satisfaz por estrutura. */
export type ItemFaixa = Pick<
  ItemMonitorado,
  "equipamento_id" | "intervalo_horas" | "intervalo_meses" | "data_fixa" | "ultimo_ciclo_data" | "ultimo_ciclo_horas"
>

/**
 * O nome que alimenta as iniciais do avatar, a partir do e-mail da conta.
 * "joao.silva@x.com" → "joao silva" → o `Avatar` tira "JS". O layout não
 * carrega o profile (nome/foto) — carregar seria uma consulta nova por
 * página, exatamente o que a faixa não pode custar. O e-mail já vem de graça
 * no `getUser()` que `carregarPainel` sempre fez.
 */
export function nomeDoEmail(email: string | null): string {
  if (!email) return ""
  return email.split("@")[0].split(/[._\-+]+/).filter(Boolean).join(" ")
}

/**
 * A cor da pílula de revisão segue o estado do semáforo — cor E palavra
 * (a palavra "vencida"/"em" já está na frase de `apoioDaRevisao`), o mesmo
 * par do `Kpi` da Início. `ok` fica `text-dim`: revisão longe não é
 * informação que precise gritar no topo de toda tela.
 */
const COR_REVISAO: Record<StatusFarol, string> = {
  ok: "text-dim", atencao: "text-warn", vencido: "text-crit",
}

/**
 * "Mais apertada" de verdade, não "a primeira do array": estado pior vence
 * (o mesmo `PESO` da Início); no empate de estado, menos horas restantes
 * vence, e horas mandam sobre dias — pelo mesmo motivo de `apoioDaRevisao`:
 * é o prazo mais preciso que um motor tem. A Início nunca precisou deste
 * desempate porque mostra UM KPI por motor; a faixa reduz tudo a uma pílula.
 */
function maisApertada(a: ResultadoCalc, b: ResultadoCalc): number {
  const porEstado = PESO[b.status] - PESO[a.status]
  if (porEstado !== 0) return porEstado
  if (a.horasRestantes != null && b.horasRestantes != null) return a.horasRestantes - b.horasRestantes
  if (a.horasRestantes != null) return -1
  if (b.horasRestantes != null) return 1
  return (a.diasRestantes ?? Infinity) - (b.diasRestantes ?? Infinity)
}

export function FaixaTopo({
  nomeEmbarcacao,
  equipamentos,
  itens,
  hoje,
  avisos,
  email,
}: {
  /** `painel.embarcacao.nome` — o link leva à ficha (`/barco`). */
  nomeEmbarcacao: string
  /** `painel.equipamentos` — daqui saem os motores e as horas. */
  equipamentos: EquipamentoFaixa[]
  /** `painel.itens` — daqui sai a revisão mais apertada dos motores. */
  itens: ItemFaixa[]
  /** `hojeISO()` do layout — `calcularSemaforo` é puro, a data entra por fora. */
  hoje: string
  /** O MESMO contador do trilho e da bottom-nav, já filtrado por permissão. */
  avisos: number
  /** E-mail da conta (`painel.emailUsuario`) — só pras iniciais do avatar. */
  email: string | null
}) {
  const motores = equipamentos.filter((e) => e.tipo === "motor")

  // KPI de motor SÓ com leitura real: horímetro é sempre informado à mão
  // (PRD §11), então motor sem leitura não vira "—" decorativo na faixa —
  // simplesmente não vira pílula. Mesma régua de honestidade da Início.
  const pilulasMotor = motores
    .filter((m) => m.horas_atuais != null)
    .map((m) => ({ id: m.id, rotulo: nomeDoEquipamento(m), valor: horasDoMotor(m) }))

  // A revisão mais apertada ENTRE OS MOTORES: mesmo cálculo do KPI da Início
  // (`calcularSemaforo` + só itens com informação de verdade), reduzido ao
  // pior resultado por `maisApertada`. Sem nenhum item com informação, a
  // pílula não existe — "Sem revisão programada" no topo de toda tela seria
  // ruído, não aviso.
  const revisao = itens
    .map((i) => {
      const motor = i.equipamento_id != null ? motores.find((m) => m.id === i.equipamento_id) : undefined
      if (!motor) return null
      const calc = itemMonitoradoToItemCalc(i)
      if (!temInformacaoSuficiente(calc, motor.horas_atuais)) return null
      return calcularSemaforo(calc, motor.horas_atuais, hoje)
    })
    .filter((r): r is ResultadoCalc => r != null)
    .sort(maisApertada)[0] ?? null

  return (
    <header className="mb-5 hidden h-14 items-center gap-4 border-b border-line lg:flex">
      {/* O nome é link pra ficha — no desktop a faixa é o caminho mais curto
          pro barco em qualquer tela. `min-h-11` mantém o alvo no piso de
          44px mesmo com a faixa medindo pela altura dos filhos. Hover por
          sublinhado, não por cor: a faixa não gasta dourado nenhum. */}
      <Link
        href="/barco"
        className="flex min-h-11 min-w-0 items-center text-sm font-semibold text-texto underline-offset-4 hover:underline"
      >
        <span className="truncate">{nomeEmbarcacao}</span>
      </Link>

      {/* As pílulas da imagem 1: contorno, rótulo curto + número mono.
          Não são alvos (nada clicável), então podem ter 32px de altura. */}
      <div className="flex min-w-0 items-center gap-2 overflow-hidden">
        {pilulasMotor.map((p) => (
          <span
            key={p.id}
            className="flex shrink-0 items-center gap-2 rounded-[var(--raio-pilula)] border border-line px-3 py-1.5"
          >
            <span className="rotulo text-dim">{p.rotulo}</span>
            <span className="font-mono-instr text-xs font-semibold tabular-nums text-texto">{p.valor}</span>
          </span>
        ))}
        {revisao && (
          /* A frase inteira de `apoioDaRevisao`, sem rótulo "Próxima
             revisão" ao lado: a frase já carrega o assunto ("Revisão em
             37h"), e rótulo + frase diriam "revisão" duas vezes. Sem mono:
             é frase, não número de instrumento (docs/DESIGN.md §5). */
          <span
            className={`shrink-0 rounded-[var(--raio-pilula)] border border-line px-3 py-1.5 text-xs font-medium ${COR_REVISAO[revisao.status]}`}
          >
            {apoioDaRevisao(revisao)}
          </span>
        )}
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        {/* O sino — mesma anatomia do trilho: alvo de 44px, badge ancorado
            no ícone (o `ContadorAvisos` compartilhado, não uma cópia). */}
        <Link
          href="/notificacoes"
          aria-label="Avisos"
          className="flex size-11 items-center justify-center rounded-[var(--raio-controle)] text-dim hover:bg-panel2"
        >
          <span className="relative flex">
            <Icone nome="alerta" className="size-5" />
            <ContadorAvisos avisos={avisos} />
          </span>
        </Link>
        {/* O avatar reusa o `Avatar` de sempre (url null = iniciais em tom
            NEUTRO — o dourado saiu das iniciais na onda 57 e não volta). */}
        <Link
          href="/menu/ajustes"
          aria-label="Sua conta e ajustes"
          className="flex size-11 items-center justify-center rounded-full"
        >
          <Avatar url={null} nome={nomeDoEmail(email)} tamanho="size-9" />
        </Link>
      </div>
    </header>
  )
}
