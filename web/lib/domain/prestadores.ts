import type { NomeIcone } from "@/components/icone"

/** Especialidades de Prestadores (PRD upgrade2-master §50) — lista curada,
 *  fonte única pro datalist do formulário de perfil (PerfilProfissionalForm),
 *  os cartões de categoria de /servicos e a sugestão de categoria ao
 *  publicar uma peça/serviço em /oportunidades. `categoria` em
 *  perfis_comandante continua texto livre (mesmo campo que já guardava a
 *  habilitação do comandante) — isto é só a sugestão, não um enum no banco. */
export const ESPECIALIDADES_PRESTADOR = [
  "Mecânica",
  "Elétrica",
  "Fibra",
  "Estofamento",
  "Eletrônica",
  "Hidráulica",
  "Outros serviços náuticos",
] as const

export type EspecialidadePrestador = (typeof ESPECIALIDADES_PRESTADOR)[number]

/** Ícone por especialidade nos cartões de categoria de /servicos — subconjunto
 *  dos ícones de components/icone.tsx, sem inventar nenhum novo. */
export const ICONE_POR_ESPECIALIDADE: Record<EspecialidadePrestador, NomeIcone> = {
  "Mecânica": "motor",
  "Elétrica": "raio",
  "Fibra": "escudo",
  "Estofamento": "estrela",
  "Eletrônica": "sinal",
  "Hidráulica": "hidraulica",
  "Outros serviços náuticos": "ferramenta",
}
