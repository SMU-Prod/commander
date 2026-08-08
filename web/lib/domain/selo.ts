/** Marcador do pedido de avaliacao presencial, gravado como evento no diario
 *  (nao existe tabela dedicada). Vive aqui, no dominio, porque DOIS lados
 *  precisam dele: a action que grava e a contagem do proprio checklist, que
 *  tem de EXCLUIR esses eventos — senao pedir avaliacao aumentaria o
 *  percentual do criterio "eventos no diario", que e justamente o que o
 *  pedido deveria ser consequencia, nao causa. */
export const MARCADOR_SOLICITACAO_SELO = "Selo Ouro — avaliação presencial solicitada"

import { itemMonitoradoToItemCalc } from "@/lib/domain/conversores"
import { calcularSemaforo, vencimentoPorData } from "@/lib/domain/semaforo"
import type { Embarcacao, Equipamento, ItemMonitorado } from "@/lib/db/types"

/**
 * Entrada do Selo Ouro — funcao pura, no espirito de `semaforo.ts`: quem
 * chama busca os dados (painel + contagens que `carregarPainel` nao traz:
 * fotos, eventos do diario, contatos) e so entao chama `avaliarSelo`. O
 * dominio NUNCA consulta o banco.
 *
 * "Documentos com validade" NAO e uma contagem a parte: o onboarding grava
 * o vencimento do documento em `itens_monitorados` (categoria "documento"),
 * sem criar linha na tabela `documentos` — so o upload de arquivo passa por
 * la. Contar pela tabela `documentos` subestimaria (ficaria em 0) todo barco
 * que so passou pelo onboarding. Por isso o criterio usa `itens` + a MESMA
 * `vencimentoPorData` do farol.
 */
export interface DadosSelo {
  embarcacao: Pick<Embarcacao, "nome" | "estaleiro" | "modelo" | "ano" | "comprimento_m">
  equipamentos: Equipamento[]
  itens: ItemMonitorado[]
  hoje: string
  totalFotos: number
  totalEventosDiario: number
  totalContatos: number
}

export interface ItemSelo {
  chave: string
  rotulo: string
  ok: boolean
  /** só faz sentido ler quando `!ok` — é o "o que falta" */
  dica: string
  /** tela que resolve a pendência — todo item pendente precisa de um caminho, nunca só acusar */
  href: string
}

export interface ResultadoSelo {
  itens: ItemSelo[]
  completos: number
  total: number
  percentual: number
}

/**
 * Checklist de completude de documentação e histórico — NUNCA de vistoria
 * física. O texto de cada item precisa deixar isso claro na tela: o selo
 * reconhece o que está registrado no app; quem qualifica de fato é a
 * avaliação presencial da equipe Commander (ver `lib/acoes/selo.ts`).
 */
export function avaliarSelo(dados: DadosSelo): ResultadoSelo {
  const { embarcacao, equipamentos, itens, hoje } = dados

  const dadosGeraisOk = Boolean(
    embarcacao.nome &&
      embarcacao.estaleiro &&
      embarcacao.modelo &&
      embarcacao.ano != null &&
      embarcacao.comprimento_m != null,
  )

  const motorComHorasOk = equipamentos.some((e) => e.tipo === "motor" && e.horas_atuais != null)

  const documentosComValidadeFutura = itens.filter((i) => {
    if (i.categoria !== "documento") return false
    const vencimento = vencimentoPorData(itemMonitoradoToItemCalc(i))
    return vencimento != null && vencimento > hoje
  }).length
  const documentosOk = documentosComValidadeFutura >= 3

  // Vencido pela MESMA regra do farol (calcularSemaforo) — nunca diverge da
  // tela da ficha. Sem nenhum item cadastrado não há o que verificar, então
  // o critério não conta como cumprido (evita um barco vazio "passar" por
  // omissão).
  const nenhumVencidoOk =
    itens.length > 0 &&
    itens.every((i) => {
      const eq = equipamentos.find((e) => e.id === i.equipamento_id)
      return calcularSemaforo(itemMonitoradoToItemCalc(i), eq?.horas_atuais ?? null, hoje).status !== "vencido"
    })

  const fotosOk = dados.totalFotos >= 1
  const diarioOk = dados.totalEventosDiario >= 6
  const contatosOk = dados.totalContatos >= 1

  const itensSelo: ItemSelo[] = [
    {
      chave: "dados_gerais",
      rotulo: "Dados gerais completos",
      ok: dadosGeraisOk,
      dica: "Preencha estaleiro, modelo, ano e comprimento na ficha do barco.",
      href: "/barco/editar",
    },
    {
      chave: "motor_horas",
      rotulo: "Motor com horas registradas",
      ok: motorComHorasOk,
      dica: "Cadastre um motor com o horímetro (horas atuais) preenchido.",
      href: "/barco/equipamento/novo?tipo=motor",
    },
    {
      chave: "documentos",
      rotulo: "3 ou mais documentos com validade em dia",
      ok: documentosOk,
      dica: "Anexe ao menos 3 documentos com validade futura.",
      href: "/barco/documentos",
    },
    {
      chave: "nenhum_vencido",
      rotulo: "Nenhum item vencido",
      ok: nenhumVencidoOk,
      dica: "Cadastre itens para monitorar e mantenha tudo em dia — nenhum pode estar vencido.",
      href: "/barco",
    },
    {
      chave: "fotos",
      rotulo: "Ao menos 1 foto no acervo",
      ok: fotosOk,
      dica: "Envie ao menos uma foto do barco para o acervo.",
      href: "/barco/fotos",
    },
    {
      chave: "diario",
      rotulo: "6 ou mais eventos no diário",
      ok: diarioOk,
      dica: "Registre pelo menos 6 eventos no diário de bordo.",
      href: "/diario",
    },
    {
      chave: "contatos",
      rotulo: "Contato cadastrado",
      ok: contatosOk,
      dica: "Cadastre ao menos um contato — mecânico, marina, eletricista.",
      href: "/barco/contatos",
    },
  ]

  const completos = itensSelo.filter((i) => i.ok).length
  const total = itensSelo.length
  const percentual = Math.round((completos / total) * 100)

  return { itens: itensSelo, completos, total, percentual }
}
