import { supabaseServer } from "@/lib/supabase/server"
import type { ModeloCatalogo } from "@/lib/domain/catalogo-motor"

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
