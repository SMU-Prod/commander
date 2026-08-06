export interface SeloMar {
  nivel: "ok" | "atencao" | "crit"
  rotulo: string
}

const ONDA_OK_M = 1.0
const ONDA_ATENCAO_M = 1.8
const VENTO_OK_KT = 15
const VENTO_ATENCAO_KT = 22

export function avaliarMar(ondaM: number | null, ventoKt: number | null): SeloMar {
  if (ondaM === null && ventoKt === null) return { nivel: "atencao", rotulo: "Sem dados do mar" }
  const ondaCrit = ondaM !== null && ondaM > ONDA_ATENCAO_M
  const ventoCrit = ventoKt !== null && ventoKt > VENTO_ATENCAO_KT
  if (ondaCrit || ventoCrit) return { nivel: "crit", rotulo: "Mar pesado" }
  const ondaAtencao = ondaM !== null && ondaM > ONDA_OK_M
  const ventoAtencao = ventoKt !== null && ventoKt > VENTO_OK_KT
  if (ondaAtencao || ventoAtencao) return { nivel: "atencao", rotulo: "Atenção no mar" }
  return { nivel: "ok", rotulo: "Bom pra sair" }
}
