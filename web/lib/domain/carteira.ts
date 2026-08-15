import type { CategoriaFinanceira } from "@/lib/domain/financeiro"

/**
 * Carteira da Tripulação (onda 42, PRD FINAL §9.4).
 *
 * A frase que define o módulo inteiro, do PRD: **"A Carteira é um controle
 * contábil de valores informados. O Commander não guarda, transfere ou
 * movimenta dinheiro."** Nenhuma função aqui fala com meio de pagamento,
 * nenhum campo guarda dado bancário, e `AVISO_NAO_MOVIMENTA` é exibido na
 * tela — a regra não pode viver só no código, quem usa precisa saber que o
 * app é o caderno, não o cofre.
 *
 * O saldo é sempre DERIVADO dos movimentos (`saldoCarteira`), nunca uma
 * coluna guardada. Saldo materializado é a fonte clássica de divergência:
 * um movimento estornado ou recusado deixaria o número errado pra sempre, e
 * aqui o número é a palavra de duas pessoas sobre dinheiro real.
 */

export const TIPOS_MOVIMENTO = ["repasse", "gasto", "devolucao"] as const
export type TipoMovimento = (typeof TIPOS_MOVIMENTO)[number]

export const ROTULO_MOVIMENTO: Record<TipoMovimento, string> = {
  repasse: "Repasse",
  gasto: "Gasto",
  devolucao: "Devolução",
}

export const STATUS_MOVIMENTO = ["pendente", "aprovado", "recusado"] as const
export type StatusMovimento = (typeof STATUS_MOVIMENTO)[number]

export const ROTULO_STATUS_MOVIMENTO: Record<StatusMovimento, string> = {
  pendente: "Aguardando o proprietário",
  aprovado: "Confirmado",
  recusado: "Recusado",
}

export const MODOS_CARTEIRA = ["direto", "aprovacao"] as const
export type ModoCarteira = (typeof MODOS_CARTEIRA)[number]

export const ROTULO_MODO: Record<ModoCarteira, string> = {
  direto: "Registro direto",
  aprovacao: "Aprovação do proprietário",
}

export const DESCRICAO_MODO: Record<ModoCarteira, string> = {
  direto: "O gasto entra na hora, sem esperar você confirmar.",
  aprovacao: "Todo gasto fica esperando o seu OK antes de contar.",
}

/** Texto obrigatório na tela da Carteira (PRD §9.4, primeira linha). Fica
 *  aqui e não solto no JSX pra existir UM texto, usado em toda tela do
 *  módulo — se o dono quiser mudar a redação, muda num lugar só. */
export const AVISO_NAO_MOVIMENTA =
  "O Commander não guarda, não transfere e não movimenta dinheiro. A Carteira é um controle contábil dos valores que vocês informam aqui — o dinheiro em si circula fora do app."

/** Sinal de cada tipo no saldo. Repasse soma (dinheiro sob a
 *  responsabilidade do tripulante), gasto e devolução tiram — o gasto
 *  porque virou despesa do barco, a devolução porque voltou pro dono. */
export function sinalDoMovimento(tipo: TipoMovimento): 1 | -1 {
  return tipo === "repasse" ? 1 : -1
}

export interface MovimentoParaSaldo {
  tipo: TipoMovimento
  valorCentavos: number
  status: StatusMovimento
}

export interface SaldoCarteira {
  repassadoCentavos: number
  gastoCentavos: number
  devolvidoCentavos: number
  /** repassado − gasto − devolvido, contando SÓ o que foi confirmado. */
  saldoCentavos: number
  /** Gastos e devoluções esperando decisão do proprietário. Não entram no
   *  saldo (nada foi confirmado ainda) mas aparecem na tela, senão o
   *  tripulante acha que o registro dele sumiu. */
  aguardandoCentavos: number
  aguardandoQtd: number
}

export function saldoCarteira(movimentos: MovimentoParaSaldo[]): SaldoCarteira {
  let repassado = 0, gasto = 0, devolvido = 0, aguardando = 0, aguardandoQtd = 0
  for (const m of movimentos) {
    if (m.status === "pendente") {
      aguardando += m.valorCentavos
      aguardandoQtd += 1
      continue
    }
    // Recusado não conta em lugar nenhum — fica no extrato como registro de
    // que houve a tentativa e ela foi negada, mas não move dinheiro.
    if (m.status !== "aprovado") continue
    if (m.tipo === "repasse") repassado += m.valorCentavos
    else if (m.tipo === "gasto") gasto += m.valorCentavos
    else devolvido += m.valorCentavos
  }
  return {
    repassadoCentavos: repassado,
    gastoCentavos: gasto,
    devolvidoCentavos: devolvido,
    saldoCentavos: repassado - gasto - devolvido,
    aguardandoCentavos: aguardando,
    aguardandoQtd,
  }
}

/** Com que status o movimento nasce. O cliente NUNCA escolhe isso — a
 *  função do banco (`carteira_registrar_gasto`) decide igual; esta cópia
 *  existe pra tela poder avisar antes ("vai ficar aguardando seu OK"), não
 *  pra ser a autoridade. Proprietário lançando não espera aprovação de si
 *  mesmo. */
export function statusInicialMovimento(p: {
  tipo: TipoMovimento
  modo: ModoCarteira
  ehProprietario: boolean
}): StatusMovimento {
  if (p.ehProprietario) return "aprovado"
  return p.tipo === "gasto" && p.modo === "direto" ? "aprovado" : "pendente"
}

export type ValidacaoMovimento = { ok: true } | { ok: false; erro: string }

export function validarMovimento(p: {
  tipo: TipoMovimento
  valorCentavos: number | null
  descricao: string | null
  categoria: CategoriaFinanceira | string | null
  temComprovante: boolean
  exigeComprovante: boolean
  saldoCentavos: number
}): ValidacaoMovimento {
  if (p.valorCentavos == null || p.valorCentavos <= 0) {
    return { ok: false, erro: "Informe um valor maior que zero (ex.: 350,00)." }
  }
  if (!p.descricao || p.descricao.trim() === "") {
    return { ok: false, erro: "Diga em uma linha do que se trata — ex.: “Diesel no posto da marina”." }
  }
  if (p.tipo === "gasto" && !p.categoria) {
    return { ok: false, erro: "Escolha a categoria — é por ela que o gasto entra no Financeiro do barco." }
  }
  // O comprovante só é cobrado no gasto: é o documento do que foi comprado.
  // Repasse e devolução são acerto direto entre as duas pessoas.
  if (p.tipo === "gasto" && p.exigeComprovante && !p.temComprovante) {
    return { ok: false, erro: "Esta carteira exige comprovante em todo gasto. Anexe a nota ou o recibo." }
  }
  // Devolver mais do que tem em mãos não é possível no mundo real, então
  // também não é aqui. Já GASTAR acima do saldo é permitido de propósito: o
  // tripulante que completou do próprio bolso precisa registrar isso, e o
  // saldo negativo é justamente a dívida do barco com ele.
  if (p.tipo === "devolucao" && p.valorCentavos > p.saldoCentavos) {
    return { ok: false, erro: "A devolução não pode ser maior que o saldo em mãos." }
  }
  return { ok: true }
}

/** Frase do saldo pra tela — muda de sentido quando fica negativo, e isso
 *  precisa estar escrito, não deduzido de um sinal de menos. */
export function leituraDoSaldo(saldoCentavos: number): { rotulo: string; critico: boolean } {
  if (saldoCentavos < 0) return { rotulo: "O barco deve ao tripulante", critico: true }
  if (saldoCentavos === 0) return { rotulo: "Sem saldo em mãos", critico: false }
  return { rotulo: "Saldo sob responsabilidade do tripulante", critico: false }
}
