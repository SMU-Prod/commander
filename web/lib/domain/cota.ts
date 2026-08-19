import { ehPago, LIMITES_FREE, type NivelPlano } from "./plano-acesso"

const MB = 1024 * 1024

export const COTA_MB = 500

export interface UsoCota {
  usadoBytes: number
  limiteBytes: number
  percentual: number
  restanteBytes: number
  cheio: boolean
}

export function usoDaCota(bytesUsados: number): UsoCota {
  const limiteBytes = COTA_MB * MB
  const usadoBytes = Math.max(0, bytesUsados)
  const percentual = Math.min(100, Math.round((usadoBytes / limiteBytes) * 100))
  return {
    usadoBytes,
    limiteBytes,
    percentual,
    restanteBytes: Math.max(0, limiteBytes - usadoBytes),
    cheio: usadoBytes >= limiteBytes,
  }
}

/**
 * O "18 / 40" do cartão "Cota do plano" (canvas tela-4a) — o número mono é
 * sempre a cota REAL que aperta primeiro, nunca um enfeite:
 *
 *  · No Free, o teto que barra é a CONTAGEM (`LIMITES_FREE.fotos`, o mesmo
 *    número que `recursoLiberado` usa pra fechar o envio) — é ela que o
 *    cartão mostra.
 *  · No plano pago não existe teto de contagem (§2.3); o que aperta é o
 *    espaço em bytes (`usoDaCota`), então o cartão mostra os MB.
 *
 * Uma função só pros dois casos pra tela nunca escolher errado qual cota
 * exibir — a escolha É a regra, então mora no domínio, com teste.
 */
export interface CotaDoPlano {
  /** "3 / 8" (Free, contagem) ou "320 MB / 500 MB" (pago, espaço). */
  valor: string
  /** 0–100, pro preenchimento da barra. */
  percentual: number
  /** Teto alcançado (Free) ou acima de 90% do espaço (pago) — a barra troca
   *  pra cor crítica. */
  critico: boolean
  /**
   * Onda 79 (instrumentos, wiring) — os MESMOS dois números por trás de
   * `valor`, crus, para quem desenha um instrumento (`BarraCapacidade`) em
   * vez de montar a frase à mão. `valor` continua existindo porque
   * `cota.test.ts` mede a frase pronta e ela é mais fácil de ler num teste.
   *
   * No plano pago, `usado`/`total` vêm em MB (não bytes) — o mesmo MB que
   * `valor` já mostra, porque `total` (COTA_MB) nunca passa de 1024, sempre
   * cabe em MB sem precisar da escala GB de `formatarBytes`. Só o `usado`
   * de um barco que ultrapassou muito o teto perde a troca fina pra GB que
   * `formatarBytes` faria — é a mesma trava de honestidade dos instrumentos:
   * o número cru continua certo, só não troca de unidade sozinho.
   */
  usado: number
  total: number
  unidade: string
}

export function cotaDoPlano(nivel: NivelPlano, usoFotos: number, bytesUsados: number): CotaDoPlano {
  if (!ehPago(nivel)) {
    const limite = LIMITES_FREE.fotos
    const uso = Math.max(0, usoFotos)
    return {
      // Acima do teto (§23, acervo herdado de um plano maior) o número REAL
      // aparece — "12 / 8" é verdade; "8 / 8" esconderia o excedente que o
      // aviso logo acima da tela está explicando.
      valor: `${uso} / ${limite}`,
      percentual: Math.min(100, Math.round((uso / limite) * 100)),
      critico: uso >= limite,
      usado: uso,
      total: limite,
      unidade: "fotos",
    }
  }
  const uso = usoDaCota(bytesUsados)
  return {
    valor: `${formatarBytes(uso.usadoBytes)} / ${formatarBytes(uso.limiteBytes)}`,
    percentual: uso.percentual,
    critico: uso.percentual > 90,
    usado: usadoEmMb(uso.usadoBytes),
    total: Math.round(uso.limiteBytes / MB),
    unidade: "MB",
  }
}

/**
 * ONDA 97 — UM ARQUIVO GRAVADO NÃO PODE SAIR COMO ZERO NO MOSTRADOR.
 *
 * Print do dono, 19/08: o álbum com uma foto dentro e o cartão de cota
 * dizendo "0 / 500 MB · 0%". A foto tem 87 KB reais no banco. `valor` já
 * acertava ("87 KB / 500 MB", via `formatarBytes`, que troca de unidade);
 * quem mentia era o par cru `usado`/`total`, que a `BarraCapacidade` desenha
 * — ele arredondava bytes→MB com `Math.round` e tudo abaixo de meio mega
 * virava 0. É a mesma regra da casa que `lib/domain/patio.ts` guarda: zero
 * desenhado quer dizer "não tem nada", e aqui tinha.
 *
 * O conserto é estreito de propósito. Acima de 1 MB nada muda — 250 MB
 * continua saindo "250", inteiro, como os testes cobram. Abaixo de 1 MB, e
 * só aí, entram duas casas, com piso em 0,01: quem gravou alguma coisa nunca
 * lê zero, e a menor fração exibível é a menor fração que a unidade tem.
 * Trocar a unidade da barra pra KB não serve: o teto viraria "512.000 KB" e
 * a régua ficaria ilegível pra ganhar precisão num canto do mostrador.
 */
function usadoEmMb(bytes: number): number {
  const mb = bytes / MB
  if (mb <= 0) return 0
  if (mb >= 1) return Math.round(mb)
  return Math.max(0.01, Math.round(mb * 100) / 100)
}

export function formatarBytes(bytes: number): string {
  if (bytes >= 1024 * MB) {
    return `${(bytes / (1024 * MB)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} GB`
  }
  if (bytes >= MB) {
    return `${Math.round(bytes / MB).toLocaleString("pt-BR")} MB`
  }
  return `${Math.round(bytes / 1024).toLocaleString("pt-BR")} KB`
}
