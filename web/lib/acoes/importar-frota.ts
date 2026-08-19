"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { hojeISO } from "@/lib/domain/datas"
import { validarImportacao, type LinhaImportada } from "@/lib/domain/afazeres"
import { ehTipoEmbarcacao } from "@/lib/domain/tipo-embarcacao"
import { supabaseServer } from "@/lib/supabase/server"

/**
 * IMPORTAÇÃO DE FROTA (PRD-UPGRADE-3-COTAS §21) — AUDITORIA 19/08, A9.
 *
 * O §21 existe por um motivo só: *"evitar cadastro manual em empresas
 * grandes."* Uma administradora que chega com 40 unidades numa planilha
 * cadastrava as 40 na mão — e o validador que evitaria isso estava escrito,
 * testado em 11 casos, e sem porta nenhuma (nem página, nem upload, nem
 * action). Era o maior atrito de entrada do público que o Upgrade 3 mira.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ESTA ACTION RECEBE LINHA PRONTA, E NÃO O TEXTO COLADO
 * ---------------------------------------------------------------------------
 * `lerPlanilha` e `validarImportacao` são puras e rodam NO APARELHO, antes de
 * qualquer coisa sair dele — é o mesmo desenho da importação de GPX (onda 21):
 * a pessoa vê exatamente o que o app entendeu, corrige a planilha, confere de
 * novo, e só então confirma. Mandar o texto cru pro servidor pra ele devolver
 * a crítica faria a mesma conversa custar uma ida e volta por tentativa.
 *
 * O servidor NÃO confia nisso: revalida com a mesma função antes de gravar.
 * Cliente é conveniência, não autoridade — e a lista chega por parâmetro, o
 * que significa que qualquer um pode forjá-la.
 *
 * ---------------------------------------------------------------------------
 * O QUE ELA NÃO FAZ
 * ---------------------------------------------------------------------------
 * NÃO ABORTA TUDO NA PRIMEIRA FALHA. Importar 40 unidades e perder as 40
 * porque a de número 31 bateu no limite do plano seria o pior resultado
 * possível: a pessoa refaz o trabalho inteiro sem saber onde parou. Cada linha
 * é independente e o relatório final diz, nome por nome, o que não entrou.
 *
 * NÃO É TRANSAÇÃO. Não pode ser: `criar_embarcacao` é uma RPC por unidade (é
 * ela que aplica o limite de plano da migration 048) e não há como envolver as
 * 40 num `begin` pelo PostgREST. Assumido de propósito — ver o parágrafo
 * acima: parcial com relatório é melhor que tudo-ou-nada silencioso.
 */

/** Teto por importação. O §21 fala em "empresas grandes" e a conversa é de
 *  dezenas, não milhares — e são N idas ao banco em sequência, dentro de uma
 *  request. Acima disso a pessoa importa em duas levas, que é bem melhor que
 *  uma request que morre no meio sem dizer onde. */
const TETO_POR_IMPORTACAO = 60

export interface FalhaDaImportacao {
  nome: string
  motivo: string
}

export interface ResultadoDaImportacao {
  criadas: number
  falhas: FalhaDaImportacao[]
  /** Erro que impediu a importação inteira de começar. */
  recusa: string | null
}

export async function importarUnidades(
  linhas: LinhaImportada[],
): Promise<ResultadoDaImportacao> {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login?volta=/frota/importar")

  // A revalidação do servidor. A mesma função do domínio, sobre o mesmo dado:
  // o que o cliente disse ser válido não vale nada aqui.
  const { validas, erros } = validarImportacao(linhas)
  if (erros.length > 0) {
    return {
      criadas: 0,
      falhas: [],
      recusa: `${erros.length} ${erros.length === 1 ? "linha ainda tem" : "linhas ainda têm"} problema. ` +
        "Confira a planilha antes de importar.",
    }
  }
  if (validas.length === 0) {
    return { criadas: 0, falhas: [], recusa: "Não há nenhuma linha para importar." }
  }
  if (validas.length > TETO_POR_IMPORTACAO) {
    return {
      criadas: 0,
      falhas: [],
      recusa: `São ${validas.length} unidades de uma vez. Importe até ${TETO_POR_IMPORTACAO} por leva — ` +
        "cole a primeira parte da planilha, importe, e volte com o resto.",
    }
  }

  let criadas = 0
  const falhas: FalhaDaImportacao[] = []

  for (const l of validas) {
    const nome = l.nome as string
    const { data: embarcacaoId, error } = await supabase.rpc("criar_embarcacao", {
      p_nome: nome,
      // A planilha do §21 chama de "marca" o que o cadastro chama de
      // "estaleiro" — é a mesma coisa dita na língua de quem preenche a
      // planilha e na língua do formulário. Um conceito, dois nomes, e o
      // glossário da casa manda o nome do formulário ganhar no banco.
      p_estaleiro: l.marca,
      p_modelo: l.modelo,
      p_ano: l.ano,
      p_marina: null,
    })
    if (error || !embarcacaoId) {
      // O limite de plano vem do banco como `limite_embarcacoes_N` — traduzir
      // aqui é o que impede o relatório de cuspir erro de Postgres na cara de
      // quem só queria cadastrar a frota. Mesma tradução do onboarding.
      const limite = error?.message.match(/limite_embarcacoes_(\d+)/)?.[1]
      falhas.push({
        nome,
        motivo: limite
          ? `seu plano cadastra ${limite} ${limite === "1" ? "embarcação" : "embarcações"} — as seguintes não entraram`
          : "o banco recusou o cadastro",
      })
      // Bater no limite do plano derruba TODAS as próximas pelo mesmo motivo.
      // Continuar o laço encheria o relatório de 30 linhas idênticas.
      if (limite) break
      continue
    }
    criadas++

    // Tipo e número de casco não passam pela RPC (ela é a porta do LIMITE de
    // plano, e nem o tipo nem o casco participam dessa regra). Vão por update,
    // com `.select()`: sem ele, uma linha barrada pela RLS voltaria com
    // `error: null` e o dado sumiria em silêncio — lei da casa desde a onda 63.
    const remendo: { tipo?: string; casco_numero?: string } = {}
    if (l.tipo && ehTipoEmbarcacao(l.tipo.trim().toLowerCase())) {
      remendo.tipo = l.tipo.trim().toLowerCase()
    }
    if (l.serial) remendo.casco_numero = l.serial
    if (Object.keys(remendo).length > 0) {
      const { data: atualizada } = await supabase
        .from("embarcacoes").update(remendo).eq("id", embarcacaoId).select("id")
      if (!atualizada?.length) {
        falhas.push({ nome, motivo: "criada, mas tipo/nº de casco não gravaram" })
      }
    }

    // O horímetro da planilha vira MOTOR, não um número solto na ficha: é o
    // motor que o semáforo de manutenção acompanha. Sem horas na linha não se
    // cria motor nenhum — inventar um motor "0 h" faria 40 unidades nascerem
    // com plano de manutenção baseado num horímetro que ninguém leu.
    if (l.horas != null) {
      const { data: eq } = await supabase.from("equipamentos").insert({
        embarcacao_id: embarcacaoId,
        tipo: "motor",
        posicao: "central",
        horas_atuais: l.horas,
        ultima_leitura: new Date().toISOString(),
      }).select("id").maybeSingle()
      if (!eq) falhas.push({ nome, motivo: "criada, mas o horímetro não virou motor" })
      else {
        await supabase.from("itens_monitorados").insert([
          { embarcacao_id: embarcacaoId, equipamento_id: eq.id, nome: "Revisão geral", intervalo_horas: 500, ultimo_ciclo_horas: l.horas, ultimo_ciclo_data: hojeISO() },
          { embarcacao_id: embarcacaoId, equipamento_id: eq.id, nome: "Troca de óleo e filtros", intervalo_horas: 250, intervalo_meses: 12, ultimo_ciclo_horas: l.horas, ultimo_ciclo_data: hojeISO() },
        ])
      }
    }
  }

  revalidatePath("/frota")
  revalidatePath("/menu")
  return { criadas, falhas, recusa: null }
}
