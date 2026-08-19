import { supabaseServer } from "@/lib/supabase/server"
import type { ComponenteCatalogo, ModeloCatalogo, SistemaMotor } from "@/lib/domain/catalogo-motor"

/**
 * O CATÁLOGO DE MOTOR INTEIRO, numa consulta (onda 64).
 *
 * Carregar tudo de uma vez é escolha deliberada, não descuido: a semente da
 * migration 058 tem 23 modelos, e o §23 do PRD manda explicitamente NÃO
 * cadastrar centenas ("identificar primeiro as famílias de maior relevância").
 * Mesmo depois do levantamento da onda 65 isso é dezenas, não milhares.
 *
 * Com o catálogo inteiro na mão, a busca do formulário roda no navegador com
 * `buscarModelos` (função pura, testada) e responde a cada tecla sem ida ao
 * servidor. Uma rota de API por caractere digitado seria mais infraestrutura
 * pra um resultado pior. No dia em que o catálogo crescer a ponto de doer,
 * o lugar de mudar é aqui — a tela não sabe de onde a lista veio.
 *
 * Fora do catálogo: as tabelas são vocabulário do produto (leitura aberta a
 * quem está logado, migration 057), então esta consulta não filtra por
 * embarcação nem por dono — não há nada de ninguém aqui.
 */
export async function carregarModelosDoCatalogo(): Promise<ModeloCatalogo[]> {
  const supabase = await supabaseServer()
  const { data, error } = await supabase
    .from("motor_modelos")
    .select("id, nome, potencia_hp, ano_inicio, ano_fim, ativo, motor_familias!inner(nome, ativo, motor_fabricantes!inner(nome, ativo))")
    .eq("ativo", true)
    .order("ordem")

  // Catálogo é conveniência: se a consulta falhar, o formulário de motor
  // continua funcionando com marca/modelo em texto livre. Derrubar o cadastro
  // inteiro porque o catálogo não carregou seria trocar um campo opcional por
  // uma tela quebrada.
  if (error || !data) return []

  type Linha = {
    id: string
    nome: string
    potencia_hp: number | null
    ano_inicio: number | null
    ano_fim: number | null
    motor_familias: { nome: string; ativo: boolean; motor_fabricantes: { nome: string; ativo: boolean } }
  }

  return (data as unknown as Linha[])
    // `!inner` garante que família e fabricante existem, mas não que estejam
    // ativos — desativar um fabricante tem que sumir com os modelos dele da
    // busca, senão "desativar" não desativa nada.
    .filter((l) => l.motor_familias.ativo && l.motor_familias.motor_fabricantes.ativo)
    .map((l) => ({
      id: l.id,
      nome: l.nome,
      potenciaHp: l.potencia_hp,
      anoInicio: l.ano_inicio,
      anoFim: l.ano_fim,
      familia: l.motor_familias.nome,
      fabricante: l.motor_familias.motor_fabricantes.nome,
    }))
}

/** Um modelo só, pra ficha do motor mostrar a identidade do catálogo.
 *  `null` quando o equipamento não tem vínculo ou o modelo saiu do ar. */
export async function carregarModeloDoCatalogo(id: string | null): Promise<ModeloCatalogo | null> {
  if (!id) return null
  const todos = await carregarModelosDoCatalogo()
  return todos.find((m) => m.id === id) ?? null
}

/**
 * OS COMPONENTES QUE O CATÁLOGO CONHECE PARA OS MOTORES DESTA UNIDADE.
 *
 * AUDITORIA 19/08, A1 — `motor_componentes` foi criada na migration 057 e
 * tinha ZERO referências em todo o `web/`. Junto com ela, `SISTEMAS_MOTOR`,
 * `ROTULO_SISTEMA` e `planoSugerido` esperavam no domínio sem consumidor.
 *
 * ---------------------------------------------------------------------------
 * O QUE A CONFERÊNCIA NO BANCO REMOTO MOSTROU, E MUDA A CONCLUSÃO
 * ---------------------------------------------------------------------------
 * A tabela NÃO está vazia: são 144 componentes ativos, distribuídos em sete
 * sistemas. Mas `part_number_oem` está nulo nos 144, e `intervalo_horas` e
 * `intervalo_meses` também. Ou seja: a promessa que dava sentido ao elo —
 * "quem vai ao balcão da revenda sai daqui com o código da peça" — o catálogo
 * ainda não tem como cumprir.
 *
 * Isso decide como esta consulta é usada. Uma tela anunciando "part number
 * OEM" em cima de 144 nulos seria a repetição literal do defeito mais caro
 * desta auditoria (`/frota` desenhando origem que ninguém preenchia). Então o
 * que sobe pra tela é o que existe de verdade — QUAIS peças este motor tem,
 * por sistema — e cada linha diz, sem rodeio, quando o código e o intervalo
 * não estão no catálogo. O buraco fica visível para quem pode preenchê-lo em
 * vez de ficar escondido numa tabela que ninguém lê.
 */
export interface ComponenteDoMotor extends ComponenteCatalogo {
  /** O motor da unidade a que este componente pertence — uma frota pode ter
   *  dois modelos diferentes no mesmo casco. */
  motor: string
}

export async function carregarComponentesDoMotor(
  embarcacaoId: string,
): Promise<ComponenteDoMotor[]> {
  const supabase = await supabaseServer()

  const { data: motores } = await supabase
    .from("equipamentos")
    .select("motor_modelo_id")
    .eq("embarcacao_id", embarcacaoId)
    .eq("tipo", "motor")
    .not("motor_modelo_id", "is", null)
  const modeloIds = [...new Set((motores ?? [])
    .map((e: { motor_modelo_id: string | null }) => e.motor_modelo_id)
    .filter((id): id is string => Boolean(id)))]
  if (modeloIds.length === 0) return []

  // A família é quem tem os componentes (migration 057): o D6-440 e o D6-380
  // compartilham a lista de peças do D6. Duas unidades da mesma família não
  // duplicam a consulta porque o `Set` acima já colapsou os ids.
  const catalogo = await carregarModelosDoCatalogo()
  const { data: modelos } = await supabase
    .from("motor_modelos").select("id, familia_id").in("id", modeloIds)
  const familiaPorModelo = new Map(
    (modelos ?? []).map((m: { id: string; familia_id: string }) => [m.id, m.familia_id]),
  )
  const familiaIds = [...new Set([...familiaPorModelo.values()])]
  if (familiaIds.length === 0) return []

  const { data: componentes } = await supabase
    .from("motor_componentes")
    .select("id, familia_id, nome, sistema, part_number_oem, intervalo_horas, intervalo_meses")
    .in("familia_id", familiaIds)
    .eq("ativo", true)
    .order("ordem")
  if (!componentes) return []

  // O nome do motor sai do catálogo já carregado — é ele que a ficha mostra, e
  // repetir a montagem aqui daria dois nomes para a mesma coisa.
  const nomePorFamilia = new Map<string, string>()
  for (const id of modeloIds) {
    const familia = familiaPorModelo.get(id)
    const modelo = catalogo.find((m) => m.id === id)
    if (familia && modelo && !nomePorFamilia.has(familia)) {
      nomePorFamilia.set(familia, `${modelo.fabricante} ${modelo.familia}`)
    }
  }

  return (componentes as {
    id: string; familia_id: string; nome: string; sistema: SistemaMotor
    part_number_oem: string | null; intervalo_horas: number | null; intervalo_meses: number | null
  }[]).map((c) => ({
    id: c.id,
    nome: c.nome,
    sistema: c.sistema,
    partNumberOem: c.part_number_oem,
    intervaloHoras: c.intervalo_horas,
    intervaloMeses: c.intervalo_meses,
    motor: nomePorFamilia.get(c.familia_id) ?? "Motor",
  }))
}
