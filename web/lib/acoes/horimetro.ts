"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { atualizarLeituraEquipamento } from "@/lib/acoes/leituras"
import { carregarPainel } from "@/lib/consultas"
import { hojeISO } from "@/lib/domain/datas"
import { abaDoEquipamento } from "@/lib/domain/diario"
import { validarLeitura } from "@/lib/domain/leituras"
import { parseDecimalPtBr } from "@/lib/domain/numeros"
import { podeEditar } from "@/lib/domain/permissoes"
import { supabaseServer } from "@/lib/supabase/server"

/** O teto do PRD (FIX-002) para a observação da leitura. */
const OBSERVACAO_MAX = 300

/**
 * FIX-002 DO PRD DE CORREÇÃO — A LEITURA DO HORÍMETRO GANHA FLUXO PRÓPRIO.
 * ===========================================================================
 * A auditoria de 19/08 (achado C-02): *"o botão do motor abre
 * `/diario/novo?tipo=leitura_horas`, porém o formulário carregado é o registro
 * genérico do Diário. O campo oculto `tipo` fica vazio e não existe campo
 * estruturado de horímetro. O principal atalho do detalhe do motor não executa
 * sua função."*
 *
 * A CAUSA, medida no código: o formulário do Diário oferece seis cartões de
 * tipo e `leitura_horas` NÃO é um deles — o link chegava com um tipo que não
 * existe na lista, nada era pré-selecionado, e sobrava Data e Descrição.
 *
 * Esta action é o destino novo do botão, e cumpre os critérios de aceite do
 * FIX-002 um a um:
 *   · "informar 120,5 atualiza o motor e cria histórico" — grava o evento
 *     `leitura_horas` E `equipamentos.horas_atuais`;
 *   · "informar 119 após 120,5 é bloqueado" — `validarLeitura`, a MESMA régua
 *     de "Voltei ao mar" (horímetro não anda para trás, e salto de mais de
 *     500 h de uma vez pede conferência);
 *   · "falha na gravação do histórico desfaz a atualização do motor" — a ordem
 *     de escrita garante isso sem transação de banco: o EVENTO entra primeiro
 *     (se falhar, o motor nem foi tocado); se a atualização do motor falhar
 *     depois, o evento recém-criado é APAGADO antes de reportar o erro. Nunca
 *     sobra meio-registro.
 *
 * TODO `.select()` É CONFERIDO. É a regra da casa desde a onda 98: escrita
 * barrada pela RLS volta `error: null` com zero linhas, e uma action que não
 * conta linhas diz "salvo" para uma gravação que não aconteceu.
 *
 * O QUE O PRD PEDE E ESTA ACTION NÃO GRAVA: o campo `origem`
 * (manual/pos_saida/connect). A tabela `eventos` não tem essa coluna, e
 * inventá-la é migration — não entra escondida numa action. Na prática a
 * origem JÁ é derivável: o que nasce aqui é manual por definição, o que nasce
 * em `registro.ts` é pós-saída. Se o Connect chegar, a coluna vem com ele.
 */
export async function registrarLeituraHorimetro(formData: FormData) {
  const equipamentoId = String(formData.get("equipamento_id") ?? "")
  const voltarErro = (msg: string) =>
    redirect(`/barco/equipamento/${equipamentoId}/horimetro?erro=${encodeURIComponent(msg)}`)

  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const equipamento = painel.equipamentos.find((e) => e.id === equipamentoId)
  if (!equipamento) redirect(`/barco?erro=${encodeURIComponent("Equipamento não encontrado.")}`)

  // §27.2 do PRD master: permissão na interface E no backend. A aba é a do
  // equipamento (motor → motores; gerador/bateria → elétrica), a MESMA que a
  // ficha usa para decidir se mostra o botão.
  if (!podeEditar(painel.permissoes, abaDoEquipamento(equipamento.tipo))) {
    redirect(`/hoje?erro=${encodeURIComponent("Seu acesso não permite informar leituras deste equipamento.")}`)
  }

  // --- validar tudo antes de gravar qualquer coisa (padrão de registro.ts) ---
  const bruto = String(formData.get("leitura") ?? "").trim()
  const lida = parseDecimalPtBr(bruto)
  if (lida === null) voltarErro("Digite a leitura em horas (só números, ex.: 1250,5).")
  // "No máximo uma casa decimal" (FIX-002): o painel do motor mostra décimos;
  // centésimos digitados aqui seriam precisão que o instrumento não tem.
  const nova = Math.round((lida as number) * 10) / 10

  const v = validarLeitura(nova, equipamento.horas_atuais)
  if (!v.ok) voltarErro(v.erro)

  const dataBruta = String(formData.get("data") ?? "").trim()
  const data = /^\d{4}-\d{2}-\d{2}$/.test(dataBruta) ? dataBruta : hojeISO()
  if (data > hojeISO()) voltarErro("A data da leitura não pode estar no futuro.")

  const observacao = String(formData.get("observacao") ?? "").trim().slice(0, OBSERVACAO_MAX)

  // --- gravar: histórico primeiro, motor depois, compensação no meio --------
  const { data: evento, error: evErro } = await supabase.from("eventos").insert({
    embarcacao_id: painel.embarcacao.id,
    equipamento_id: equipamentoId,
    tipo: "leitura_horas",
    horas_no_momento: nova,
    descricao: observacao || null,
    criado_por: user!.id,
    data,
  }).select("id")
  if (evErro || !evento?.length) {
    voltarErro("A leitura não foi gravada. Tente de novo — nada foi alterado.")
  }

  const { data: atualizado, error: upErro } = await atualizarLeituraEquipamento(supabase, equipamentoId, nova)
  if (upErro || !atualizado?.length) {
    // O critério de aceite do FIX-002, ao pé da letra: sem a atualização do
    // motor, o histórico recém-criado sai junto — meio-registro é pior que
    // nenhum, porque a ficha e o histórico passariam a discordar.
    await supabase.from("eventos").delete().eq("id", evento![0].id)
    voltarErro("Não foi possível atualizar o horímetro. Nada foi gravado.")
  }

  revalidatePath(`/barco/equipamento/${equipamentoId}`)
  revalidatePath("/barco")
  revalidatePath("/hoje")
  redirect(`/barco/equipamento/${equipamentoId}?ok=${encodeURIComponent(`Leitura de ${nova.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} h registrada.`)}`)
}
