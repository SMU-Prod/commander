"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { carregarPainel } from "@/lib/consultas"
import {
  MODOS_APROVACAO,
  ROTULO_MODO_APROVACAO,
  type ModoAprovacao,
} from "@/lib/domain/enterprise"
import { supabaseServer } from "@/lib/supabase/server"

/**
 * A RÉGUA DE CONFIANÇA DEIXA DE SER SÓ LEITURA (auditoria de 19/08/2026).
 *
 * `vinculos.modo_aprovacao` existe desde a migration 059 e era lida em quatro
 * lugares — a lista de `/tripulacao`, esta ficha, `/afazeres` e o
 * `modoAprovacaoDe` de `lib/acoes/enterprise.ts` — e escrita por NENHUM. O
 * §3 do PRD-UPGRADE-3 descreve a régua como um controle do ADM ("horas de
 * funcionário experiente entram direto; funcionário novo pode exigir
 * conferência 1 a 1") e o app mostrava o estado sem deixar mudar: todo mundo
 * nasce em `sem_aprovacao` (o default da coluna) e morre em `sem_aprovacao`.
 *
 * Um controle que exibe estado e não permite alterá-lo é pior do que não
 * existir — quem lê "Somente críticos" na tela acredita que alguém escolheu
 * aquilo, quando na verdade ninguém podia escolher.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ESTA ACTION MORA NA PASTA DA ROTA, E NÃO EM `lib/acoes/vinculos.ts`
 * ---------------------------------------------------------------------------
 * Porque ela serve UMA tela e só ela. `lib/acoes/vinculos.ts` guarda os gestos
 * que a matriz de acesso compartilha (`salvarMatriz`, `aplicarPreset`,
 * `removerCmdt`), todos sobre permissão de ÁREA; a régua de aprovação é outra
 * pergunta ("o que esta pessoa lança entra direto?") e não se mistura com a
 * matriz nem no formulário nem no `nivel`.
 *
 * ---------------------------------------------------------------------------
 * O QUE FOI CONFERIDO NO BANCO REMOTO ANTES DE ESCREVER UMA LINHA
 * ---------------------------------------------------------------------------
 * A policy de UPDATE existe e permite exatamente este gesto:
 *
 *     "vinculos: prop atualiza quem nao e dono"
 *     USING / WITH CHECK: eh_prop(embarcacao_id) AND papel <> 'PROP'
 *
 * Duas consequências que estão codificadas abaixo, e não deduzidas:
 *
 *   1. Só o PROP da embarcação muda a régua de alguém — o que casa com a
 *      barreira que a página já aplica (`painel.papel !== "PROP"` → /menu).
 *   2. A régua do PRÓPRIO PROP não é alterável, por policy. É coerente: o dono
 *      não pede aprovação a ninguém. A tela nunca oferece o controle para ele
 *      porque a lista e a ficha já filtram `.neq("papel", "PROP")`.
 *
 * A policy de INSERT da `auditoria` também foi conferida — `autor_id =
 * auth.uid() AND pode_ver_embarcacao(embarcacao_id)` —, então o rastro abaixo
 * passa. NENHUM SQL NOVO FOI PRECISO.
 */

function falhar(vinculoId: string, msg: string): never {
  redirect(`/tripulacao/${vinculoId}?erro=${encodeURIComponent(msg)}`)
}

export async function mudarModoAprovacao(formData: FormData) {
  const vinculoId = String(formData.get("vinculo_id") ?? "")
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  // A MESMA BARREIRA DA PÁGINA, REPETIDA AQUI DE PROPÓSITO. Esconder o
  // formulário não protege nada: uma action é uma rota, e o §22 do PRD é
  // explícito ("permissões devem ser aplicadas no backend, não apenas
  // escondendo botões"). A policy é a terceira camada, não a primeira.
  if (painel.papel !== "PROP") {
    falhar(vinculoId, "Só o proprietário muda a régua de aprovação da tripulação.")
  }

  // O valor vem de um `<select>`, ou seja, de fora. `MODOS_APROVACAO` é o
  // vocabulário do domínio e o `check` da migration 059 — conferir aqui é o
  // que transforma "Estado de tarefa desconhecido" (a lição de
  // `mudarEstadoAfazer`) numa recusa que diz o que houve, em vez de deixar o
  // banco recusar com uma mensagem que ninguém entende.
  const bruto = String(formData.get("modo_aprovacao") ?? "")
  if (!(MODOS_APROVACAO as readonly string[]).includes(bruto)) {
    falhar(vinculoId, "Régua de aprovação desconhecida.")
  }
  const modo = bruto as ModoAprovacao

  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  // O ESTADO ANTES, LIDO ANTES DE ESCREVER — sem isto a linha de auditoria
  // perde metade do valor numa disputa (é o achado A3 desta mesma auditoria,
  // e o padrão que `lib/acoes/cotistas.ts` já segue no bloqueio de cotista).
  // A leitura também é a checagem de escopo: o vínculo tem que ser da unidade
  // aberta, senão o id da URL viraria uma porta para a tripulação de outro
  // barco.
  const { data: antes } = await supabase
    .from("vinculos")
    .select("id, usuario_id, papel, modo_aprovacao, embarcacao_id")
    .eq("id", vinculoId)
    .maybeSingle()
  if (!antes || antes.embarcacao_id !== painel.embarcacao.id) {
    falhar(vinculoId, "Vínculo não encontrado nesta embarcação.")
  }
  const modoAnterior = antes.modo_aprovacao as ModoAprovacao

  // Trocar por igual não é erro nem é mudança: sem esta saída, a trilha de
  // auditoria encheria de linhas "alterou de X para X" toda vez que alguém
  // salvasse a ficha sem mexer no seletor — e trilha com ruído é trilha que
  // ninguém lê.
  if (modoAnterior === modo) {
    redirect(`/tripulacao/${vinculoId}?salvo=${encodeURIComponent("A régua já era essa. Nada mudou.")}`)
  }

  // `.select()` CONFERINDO LINHAS — o padrão da casa, e aqui ele é obrigatório
  // pelo mesmo motivo do `removerCmdt`: quando a RLS barra o UPDATE, o
  // PostgREST devolve `error: null` com ZERO linhas afetadas. Sem esta
  // checagem a tela diria "salvo", voltaria para a ficha, e a régua continuaria
  // a mesma — um controle mentindo sobre o único trabalho que ele tem.
  //
  // Os filtros repetem as duas condições da policy em vez de confiar nela: o
  // `.neq("papel", "PROP")` deixa a recusa explícita no app, não como um
  // efeito colateral de zero linhas voltarem.
  const { data: atualizados, error } = await supabase
    .from("vinculos")
    .update({ modo_aprovacao: modo })
    .eq("id", vinculoId)
    .eq("embarcacao_id", painel.embarcacao.id)
    .neq("papel", "PROP")
    .select("id")
  if (error || (atualizados ?? []).length === 0) {
    falhar(vinculoId, "Não deu para mudar a régua de aprovação. Recarregue a página e tente de novo.")
  }

  // §22 — MUDAR A RÉGUA DE APROVAÇÃO É EXATAMENTE O ATO QUE A TRILHA EXISTE
  // PARA REGISTRAR: ela decide se o que uma pessoa lança entra direto no
  // registro oficial da embarcação. `antes`/`depois` guardam os dois valores;
  // `alvo` guarda o NOME de quem teve a régua mudada, porque é assim que a
  // linha continua legível meses depois, quando ninguém lembra do uuid.
  //
  // O rastro não derruba a mudança se falhar: a régua já está gravada e é fato
  // do banco. O `insert` é `append-only` por construção (a tabela não tem
  // policy de update nem de delete).
  const { data: perfil } = await supabase
    .from("profiles").select("nome").eq("id", antes.usuario_id).maybeSingle()

  await supabase.from("auditoria").insert({
    embarcacao_id: painel.embarcacao.id,
    autor_id: user?.id ?? null,
    evento: "alterou",
    entidade: "vinculos",
    entidade_id: vinculoId,
    alvo: ((perfil as { nome: string } | null)?.nome ?? "").trim() || null,
    antes: { modo_aprovacao: modoAnterior },
    depois: { modo_aprovacao: modo },
  })

  revalidatePath(`/tripulacao/${vinculoId}`)
  revalidatePath("/tripulacao")
  // A confirmação diz o NOVO estado por extenso em vez de "salvo": a régua é
  // um controle de três posições, e quem acabou de mexer precisa ler qual
  // ficou valendo sem ter de conferir o seletor de novo.
  redirect(
    `/tripulacao/${vinculoId}?salvo=${encodeURIComponent(
      `Régua de aprovação: ${ROTULO_MODO_APROVACAO[modo]}.`,
    )}`,
  )
}
