"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { subirArquivo } from "@/lib/acervo"
import { atualizarLeituraEquipamento } from "@/lib/acoes/leituras"
import { inserirOcorrenciaDoDiario } from "@/lib/acoes/ocorrencias"
import { carregarNivelPlano, carregarPainel, carregarUsoDiario, hojeISO } from "@/lib/consultas"
import { duracaoHoras, horasSugeridas, lerPassageiros } from "@/lib/domain/bordo"
import { abaDoHubChecklist, itensQueViramOcorrencia, lerChecklistDoFormulario, ROTULO_HUB_CHECKLIST } from "@/lib/domain/checklist-diario"
import { TIPO_ROTULO, zerarCiclo } from "@/lib/domain/diario"
import { categoriaFinanceiraDoEvento } from "@/lib/domain/financeiro"
import { devePropagarLeitura } from "@/lib/domain/leituras"
import { parseDecimalPtBr } from "@/lib/domain/numeros"
import { podeEditar } from "@/lib/domain/permissoes"
import { mensagemBloqueio, recursoLiberado } from "@/lib/domain/plano-acesso"
import { boletimDoMar } from "@/lib/mar"
import { supabaseServer } from "@/lib/supabase/server"

export async function criarEvento(formData: FormData) {
  // O CAMINHO DE VOLTA DO ERRO PRECISA LEVAR O TIPO JUNTO (onda 55).
  //
  // `/diario/novo` abre num seletor ("o que aconteceu?") e só depois de
  // escolher Manutenção/Abastecimento/... é que os campos daquele tipo são
  // renderizados — `tipoInicial` sai de `searchParams.tipo`. Enquanto este
  // redirect mandava só `?erro=`, o retorno caía no seletor de novo: além de
  // parecer que a tela "voltou do zero", os campos preenchidos nem existiam
  // no HTML, então o `GuardaFormulario` não teria o que restaurar. Com
  // `&tipo=`, a pessoa volta no MESMO formulário, com a mensagem em cima.
  const tipoEscolhido = String(formData.get("tipo") ?? "")
  // A anotação `: (msg: string) => never` na CONST é obrigatória, não enfeite:
  // o TypeScript só usa uma função que nunca retorna pra estreitar tipo
  // (`reais` deixa de ser `number | null` depois da chamada) quando ela é
  // declarada com tipo explícito. Sem ela, o corpo abaixo volta a acusar
  // "'reais' is possibly 'null'".
  const erroNovo: (msg: string) => never = (msg) => {
    const qs = new URLSearchParams({ erro: msg })
    if (tipoEscolhido) qs.set("tipo", tipoEscolhido)
    redirect(`/diario/novo?${qs}`)
  }

  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")

  // §27.2: "Permissões devem ser aplicadas tanto na interface quanto no
  // backend/API". Até a onda 52 esta action só tinha o gate de PLANO — quem
  // barrava tripulante sem `diario:editar` era a RLS sozinha (migration 010),
  // e RLS sozinha recusa em silêncio: a tela dizia "salvo" pra um Diário que
  // não existiu. PERMISSÃO ANTES DE PLANO, de propósito: quem não pode
  // escrever no Diário não recebe convite pra assinar algo que não é dele.
  if (!podeEditar(painel.permissoes, "diario")) {
    erroNovo("Seu acesso não permite registrar no Diário de Bordo desta embarcação.")
  }

  // Gate do plano Free (onda 38, PRD §43) — checado de novo aqui mesmo já
  // bloqueado na tela (`/diario/novo`): bloqueio só na interface é
  // decorativo, um POST direto (ou uma aba antiga aberta) precisa cair na
  // mesma regra.
  const [nivel, usoDiario] = await Promise.all([carregarNivelPlano(), carregarUsoDiario()])
  if (!recursoLiberado("diario_registros", nivel, usoDiario)) {
    erroNovo(mensagemBloqueio("diario_registros", usoDiario).descricao)
  }

  const texto = (k: string) => {
    const v = String(formData.get(k) ?? "").trim()
    return v === "" ? null : v
  }
  const tipo = texto("tipo") ?? "manutencao"
  const data = texto("data") ?? hojeISO()
  const alvo = texto("alvo")
  const equipamentoId = alvo?.startsWith("eq:") ? alvo.slice(3) : null
  const categoria = alvo?.startsWith("cat:") ? alvo.slice(4) : null
  if (equipamentoId && !painel.equipamentos.some((e) => e.id === equipamentoId)) {
    erroNovo("Equipamento inválido.")
  }

  const custoBruto = texto("custo")
  let custoCentavos: number | null = null
  if (custoBruto != null) {
    const reais = parseDecimalPtBr(custoBruto)
    if (reais === null || reais < 0) erroNovo("Informe um custo válido (ex.: 1.850,00).")
    custoCentavos = Math.round(reais * 100)
  }

  const horasBruto = texto("horas")
  const horas = horasBruto != null ? parseDecimalPtBr(horasBruto) : null
  if (horasBruto != null && (horas === null || horas < 0)) erroNovo("Informe horas válidas.")

  const itemId = texto("item_id")
  const item = itemId ? (painel.itens.find((i) => i.id === itemId) ?? null) : null
  if (itemId && !item) erroNovo("Essa manutenção ou vencimento não existe mais. Atualize a página.")

  const contatoId = texto("contato_id")
  if (contatoId) {
    const { data: contato } = await supabase.from("contatos")
      .select("id").eq("id", contatoId).eq("embarcacao_id", painel.embarcacao.id).maybeSingle()
    if (!contato) erroNovo("Contato inválido.")
  }

  let anexoPath: string | null = null
  const anexo = formData.get("anexo")
  if (anexo instanceof File && anexo.size > 0) {
    const r = await subirArquivo(supabase, painel.embarcacao.id, "eventos", anexo)
    if ("erro" in r) erroNovo(r.erro)
    else anexoPath = r.path
  }

  // Campos da saida (Livro de Bordo) só valem pra navegacao — nos demais
  // tipos ficam null/vazio, exatamente como a tabela ja nasce.
  const horaSaida = tipo === "navegacao" ? texto("hora_saida") : null
  const horaRetorno = tipo === "navegacao" ? texto("hora_retorno") : null
  const localSaida = tipo === "navegacao" ? texto("local_saida") : null
  const destino = tipo === "navegacao" ? texto("destino") : null
  const passageiros = tipo === "navegacao" ? lerPassageiros(texto("passageiros")) : []

  let tripulacao: string[] = []
  if (tipo === "navegacao") {
    const bruta = formData.getAll("tripulacao").map(String)
    if (bruta.length > 0) {
      const { data: vinculos } = await supabase
        .from("vinculos").select("usuario_id").eq("embarcacao_id", painel.embarcacao.id)
      const validos = new Set((vinculos ?? []).map((v) => v.usuario_id))
      tripulacao = bruta.filter((id) => validos.has(id))
    }
  }

  // Condicao do mar CONGELADA no momento do registro — o passado nao muda.
  // Falha da API (ou marina sem posicao definida) nao pode impedir o
  // salvamento: grava null e segue.
  let marOndaM: number | null = null
  let marVentoKt: number | null = null
  if (tipo === "navegacao" && painel.embarcacao.marina_lat != null && painel.embarcacao.marina_lon != null) {
    const boletim = await boletimDoMar(painel.embarcacao.marina_lat, painel.embarcacao.marina_lon)
    marOndaM = boletim?.ondaM ?? null
    marVentoKt = boletim?.ventoKt ?? null
  }

  // Checklist rápido por hub (onda 40, PRD §23) — só existe em navegacao, e
  // só grava o que foi de fato tocado (hub sem estado reconhecido não entra,
  // ver `lerChecklistDoFormulario`). `null` quando ninguém tocou.
  const checklist = tipo === "navegacao" ? lerChecklistDoFormulario(texto) : []

  const { data: inserido, error } = await supabase.from("eventos").insert({
    embarcacao_id: painel.embarcacao.id,
    equipamento_id: equipamentoId,
    item_monitorado_id: item?.id ?? null,
    contato_id: contatoId,
    tipo,
    categoria,
    data,
    horas_no_momento: horas,
    descricao: texto("descricao"),
    custo_centavos: custoCentavos,
    anexo_path: anexoPath,
    criado_por: user.id,
    hora_saida: horaSaida,
    hora_retorno: horaRetorno,
    local_saida: localSaida,
    destino,
    tripulacao,
    passageiros,
    mar_onda_m: marOndaM,
    mar_vento_kt: marVentoKt,
    checklist: checklist.length > 0 ? checklist : null,
  }).select("id").single()
  if (error || !inserido) {
    if (anexoPath) await supabase.storage.from("acervo").remove([anexoPath])
    erroNovo("Não foi possível salvar o evento. Tente de novo.")
  }

  // Onda 42 (PRD FINAL §9.1) — o custo lançado no Diário nasce TAMBÉM como
  // lançamento central no Financeiro, ligado a este evento (`evento_id`), que
  // é o "cria o mesmo lançamento central, não uma cópia" do PRD. Sem isto, o
  // Financeiro (fonte do dinheiro desde a migration 042) ignoraria tudo que
  // entra pelo Diário e as duas telas discordariam sobre quanto o barco
  // gastou. `custo_centavos` continua gravado no evento como histórico DELE —
  // nenhuma tela soma as duas fontes.
  //
  // Falha aqui não desfaz a saída já registrada: mesmo padrão do item
  // monitorado e da leitura de horas logo abaixo — avisa, não perde o que já
  // foi salvo.
  if (custoCentavos != null && custoCentavos > 0) {
    // O `.select("id")` já estava aqui, sem leitor. `lancamentos: criar pela
    // matriz` exige `gastos:editar`, que é permissão DIFERENTE da que deixou
    // este evento entrar no Diário — quem registra serviço sem acesso a
    // Financeiro cai exatamente nesse buraco, e caía sem ver o aviso abaixo.
    const { data: lancamento, error: erroLancamento } = await supabase.from("lancamentos_financeiros").insert({
      embarcacao_id: painel.embarcacao.id,
      tipo: "despesa",
      categoria: categoriaFinanceiraDoEvento({ tipo, categoria }),
      descricao: texto("descricao") ?? TIPO_ROTULO[tipo] ?? "Gasto registrado no Diário",
      valor_centavos: custoCentavos,
      data,
      // Custo lançado no Diário é gasto que já aconteceu — o PRD só admite
      // no Financeiro o que foi efetivado.
      status: "pago",
      comprovante_path: anexoPath,
      evento_id: inserido!.id,
      criado_por: user.id,
    }).select("id")
    if (erroLancamento || !lancamento?.length) {
      revalidatePath("/diario")
      redirect(`/diario?erro=${encodeURIComponent("Registro salvo, mas o custo não entrou no Financeiro. Lance por lá para não perder o valor.")}`)
    }
  }

  if (item) {
    const eq = painel.equipamentos.find((e) => e.id === item.equipamento_id)
    const atualizacao = zerarCiclo(item, { data, horas: horas ?? eq?.horas_atuais ?? null })
    // O evento entrou por `eventos: criar pela matriz`, que aceita QUALQUER UMA
    // de duas permissões: Diário ou a aba do equipamento. Já `itens: atualizar
    // pela matriz` exige especificamente a aba do item — quem tem só Diário
    // grava o serviço no Diário e não zera o ciclo, e a recusa vinha com
    // `error` nulo e zero linha. O semáforo de manutenção continuava vermelho
    // depois da manutenção feita, sem uma palavra na tela.
    const { data: ciclo, error: erroItem } = await supabase
      .from("itens_monitorados").update(atualizacao).eq("id", item.id).select("id")
    if (erroItem || !ciclo?.length) {
      revalidatePath("/diario")
      redirect(`/diario?erro=${encodeURIComponent("Evento salvo, mas o ciclo da manutenção não foi zerado. Confira e ajuste se precisar.")}`)
    }
  }

  // "Horas do motor agora" tambem deve virar a leitura oficial do equipamento
  // — nao so o horimetro do item de manutencao escolhido acima. Mesma escrita
  // de "Voltei ao mar" (registro.ts), reusada via atualizarLeituraEquipamento.
  // So propaga se a leitura avancou (nunca regride): um valor menor aqui fica
  // salvo no evento como historico, mas so vira leitura oficial por correcao
  // explicita em Embarcacao — nao sobrescrevemos silenciosamente com o que
  // pode ser so um registro retroativo (servico de um mes anterior, por ex.).
  if (equipamentoId && horas != null) {
    const eqAlvo = painel.equipamentos.find((e) => e.id === equipamentoId)
    if (eqAlvo && devePropagarLeitura(horas, eqAlvo.horas_atuais)) {
      const { data: atualizado, error: erroLeitura } = await atualizarLeituraEquipamento(supabase, equipamentoId, horas)
      if (erroLeitura || !atualizado?.length) {
        revalidatePath("/diario")
        redirect(`/diario?erro=${encodeURIComponent("Evento salvo, mas a leitura do motor não foi atualizada. Confira em Embarcação.")}`)
      }
    }
  }

  // Checklist do Diário por hub (onda 40, PRD §23): um hub marcado
  // "Observação" + a caixa "isso é um problema" vira ocorrência já vinculada
  // ao setor certo ao finalizar o registro — mesma "REGRA FUNDAMENTAL" do
  // PRD §22/§23 de sempre, reusando `inserirOcorrenciaDoDiario` (onda 32),
  // agora podendo nascer mais de uma ocorrência por saída (uma por hub
  // marcado). Falha aqui não desfaz a saída já salva (mesmo padrão do item
  // monitorado e da leitura acima: avisa, não perde o que já foi gravado).
  if (tipo === "navegacao" && checklist.length > 0) {
    const paraOcorrencia = itensQueViramOcorrencia(
      checklist,
      (hub) => Boolean(formData.get(`checklist_${hub}_ocorrencia`)),
    )
    for (const oc of paraOcorrencia) {
      const r = await inserirOcorrenciaDoDiario({
        embarcacaoId: painel.embarcacao.id,
        aba: abaDoHubChecklist(oc.hub),
        titulo: oc.titulo,
        descricao: oc.descricao,
        eventoId: inserido!.id,
        criadoPor: user.id,
      })
      if (!r.ok) {
        revalidatePath("/diario")
        redirect(`/diario?erro=${encodeURIComponent(`Saída registrada, mas a ocorrência de ${ROTULO_HUB_CHECKLIST[oc.hub]} não foi criada. Abra manualmente em Ocorrências.`)}`)
      }
    }
  }

  revalidatePath("/diario")
  revalidatePath("/barco")
  revalidatePath("/hoje")
  // O custo do registro pode ter virado lançamento — as telas do Financeiro
  // mostram o mesmo dinheiro e precisam sair do cache junto.
  revalidatePath("/financeiro")
  revalidatePath("/financeiro/lancamentos")

  // A sinergia: saida de navegacao com duracao relevante manda pra tela de
  // sugestao de horas do motor, antes de voltar pro diario — essa tela ja
  // confirma visualmente ("Saída registrada"), entao nao precisa de "?ok=".
  if (tipo === "navegacao" && horasSugeridas(duracaoHoras(horaSaida, horaRetorno)) !== null) {
    redirect(`/diario/${inserido!.id}/horas`)
  }
  // Acao mais frequente do app redirecionava muda — nunca fica claro se salvou.
  redirect(`/diario?ok=${encodeURIComponent(`Registrado no diário: ${TIPO_ROTULO[tipo] ?? "evento"}`)}`)
}
