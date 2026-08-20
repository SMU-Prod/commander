"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import {
  AsaasRecusa, atualizarAssinaturaAsaas, cancelarAssinaturaAsaas, criarAssinaturaAsaas, criarClienteAsaas,
  urlPrimeiraCobranca,
} from "@/lib/asaas"
import { carregarAssinatura } from "@/lib/consultas"
import { hojeISO } from "@/lib/domain/datas"
import {
  ehCobravel, PLANOS, precoVigenteCentavos, proximoUpgrade, type PlanoId,
} from "@/lib/domain/planos"
import { supabaseServer } from "@/lib/supabase/server"
import { supabaseServico } from "@/lib/supabase/servico"
import { validar, type Esquema } from "@/lib/validacao"
import type { Assinatura } from "@/lib/db/types"

/**
 * Ações de assinatura (onda 47 — PRD FINAL §2 e §23).
 *
 * §23 manda modelar os estados INDEPENDENTEMENTE do gateway. Aqui isso
 * significa: este arquivo fala com o Asaas (que é quem cobra hoje) mas nunca
 * deixa vocabulário do Asaas vazar pro resto do app — o status que vira linha
 * em `assinaturas` é o do Commander (`pendente`/`ativa`/`problema_pagamento`/
 * `cancelada`), e quem decide o que isso significa pro cliente é
 * `lib/domain/assinatura-ciclo.ts`. Trocar de gateway amanhã é reescrever
 * `lib/asaas.ts`, o webhook e este arquivo — nada além.
 *
 * O preço NUNCA é lido de formulário. Sai de `PLANOS` (catálogo) e, quando há
 * promoção vigente, de `precoVigenteCentavos` — senão bastaria forjar um campo
 * escondido pra assinar o Commander por um centavo.
 */

function erroAssinar(msg: string): never {
  redirect(`/assinar?erro=${encodeURIComponent(msg)}`)
}

/** Para onde o Asaas devolve o assinante depois de pagar. */
function urlRetornoPosPagamento(): string {
  return `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/menu/assinatura`
}

/** CPF: 11 digitos apos limpar mascara. A validacao forte fica no Asaas. */
function cpfLimpo(bruto: string): string | null {
  const d = bruto.replace(/\D/g, "")
  return d.length === 11 ? d : null
}

/** O que a pessoa digita ao assinar (auditoria 360 de 20/08, recomendação
 *  nº 10). O preço NUNCA está aqui — sai do catálogo, ver o cabeçalho do
 *  arquivo. O schema cobre o que sobra: nome e CPF, que seguem direto pro
 *  gateway e por isso ganham o teto de tamanho. As regras finas (nome com
 *  sobrenome, CPF com 11 dígitos) continuam nas linhas seguintes da action —
 *  o schema é a porta, não o cadastro. */
const ESQUEMA_ASSINAR = {
  nome: { tipo: "texto", obrigatorio: true, erro: "Informe seu nome completo." },
  cpf: { tipo: "texto", obrigatorio: true, erro: "Informe um CPF válido (11 dígitos)." },
} as const satisfies Esquema

export async function assinar(formData: FormData) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) redirect("/login?volta=/assinar")

  const plano = String(formData.get("plano") ?? "") as PlanoId
  // Duas checagens diferentes de propósito: existir no catálogo é uma coisa,
  // ser vendável é outra. Enterprise existe e NÃO é vendável (§2: "Exibir
  // apenas como reservado/Em breve"), e plano grátis não gera cobrança.
  if (!(plano in PLANOS)) erroAssinar("Escolha um plano.")
  if (!ehCobravel(plano)) erroAssinar("Este plano ainda não está disponível para contratação.")

  const form = validar(formData, ESQUEMA_ASSINAR)
  if (!form.ok) erroAssinar(form.erro)
  const nome = form.dados.nome
  if (nome.length < 5 || !nome.includes(" ")) erroAssinar("Informe seu nome completo.")
  const cpf = cpfLimpo(form.dados.cpf)
  if (!cpf) erroAssinar("Informe um CPF válido (11 dígitos).")

  // ja tem assinatura viva? nao cria outra — reaproveita a cobranca aberta
  const { data: existente } = await supabase
    .from("assinaturas").select("*")
    .eq("usuario_id", user.id).neq("status", "cancelada")
    .maybeSingle()
  if (existente) {
    const viva = existente as Assinatura
    if (viva.status === "pendente") {
      const url = await urlPrimeiraCobranca(viva.asaas_subscription_id, urlRetornoPosPagamento()).catch(() => null)
      if (url) redirect(url)
    }
    redirect("/menu/assinatura")
  }

  // §2.1/§2.2 — promoção vigente derruba o preço do plano alvo pelo tempo
  // dela. Sai do banco (`assinatura_promocoes`, concedida pela operação), nunca
  // do formulário. O banco garante no máximo uma vigente: não acumulam.
  const { promocao } = await carregarAssinatura()
  const valorCentavos = precoVigenteCentavos(plano, promocao, hojeISO()) ?? PLANOS[plano].valorCentavos
  if (valorCentavos == null || valorCentavos <= 0) {
    // Promoção "incluída" (§2.2, 6 meses sem cobrança) não passa por aqui: ela
    // vira concessão em `premium_concessoes`, não assinatura no gateway.
    erroAssinar("Este plano já está incluído na sua conta — não há nada a cobrar agora.")
  }

  let customerId: string
  let subscriptionId: string
  try {
    customerId = await criarClienteAsaas({ nome, email: user.email, cpfCnpj: cpf })
    subscriptionId = await criarAssinaturaAsaas({
      customerId,
      valorCentavos,
      ciclo: PLANOS[plano].ciclo ?? "MONTHLY",
      descricao: PLANOS[plano].descricao,
      referenciaExterna: user.id,
    })
  } catch (e) {
    // recusa de validacao (ex.: CPF invalido) e corrigivel pelo usuario — mostra o motivo
    if (e instanceof AsaasRecusa) erroAssinar(`O sistema de pagamento recusou os dados: ${e.message}`)
    // ONDA 83 (achado A-08 da auditoria de 19/08/2026) — ISTO PRECISA DEIXAR
    // RASTRO. Até aqui o `catch` engolia a falha sem um `console.error`
    // sequer: gente tentava assinar, apanhava, e o dono não tinha como saber
    // que existiu a tentativa. Foi assim que o A-02 (checkout aberto sem
    // chave configurada) sobreviveu invisível — cada frustração sumia.
    // `console.error` num server component vai pro log da função na Vercel,
    // que é onde o dono procura quando alguém reclama.
    console.error("[assinar] falha ao criar cliente/assinatura no Asaas", e)
    erroAssinar("Não foi possível falar com o sistema de pagamento. Tente de novo em instantes.")
  }

  const { data: criada, error } = await supabase
    .from("assinaturas")
    .insert({
      usuario_id: user.id,
      asaas_customer_id: customerId,
      asaas_subscription_id: subscriptionId,
      plano,
      valor_centavos: valorCentavos,
    })
    .select("id")
  if (error || !criada?.length) {
    // Nunca deixa a assinatura orfa no Asaas: se a gravacao no banco falhou
    // (por QUALQUER motivo), desfaz o que ja foi criado la fora.
    await cancelarAssinaturaAsaas(subscriptionId).catch(() => {})
    // 23505 = violacao do indice unico `assinaturas_uma_viva_idx` (migration 019):
    // outra requisicao (duplo clique, ou retry de rede) venceu a corrida e ja
    // gravou a assinatura viva deste usuario primeiro. Nao e falha — e o duplo
    // clique sendo pego pelo banco.
    if (error?.code === "23505") {
      redirect("/menu/assinatura?ok=" + encodeURIComponent("Você já tem uma assinatura em andamento"))
    }
    erroAssinar("Não foi possível registrar a assinatura. Tente de novo.")
  }

  const url = await urlPrimeiraCobranca(subscriptionId, urlRetornoPosPagamento()).catch(() => null)
  revalidatePath("/menu/assinatura")
  if (url) redirect(url)
  redirect("/menu/assinatura?ok=" + encodeURIComponent("Assinatura criada — o link de pagamento chega por e-mail"))
}

/**
 * Cancelamento (§23). Não apaga NADA: a linha de assinatura vira `cancelada`,
 * o plano cai pro Free aplicável e todo o histórico da embarcação continua
 * onde está. "Reativação posterior restabelece o acesso aos dados existentes"
 * é consequência direta disso — não existe passo de restauração porque nunca
 * houve remoção.
 */
export async function cancelarAssinatura() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: viva } = await supabase
    .from("assinaturas").select("*")
    .eq("usuario_id", user.id).neq("status", "cancelada")
    .maybeSingle()
  if (!viva) redirect("/menu/assinatura")
  const assinatura = viva as Assinatura

  try {
    await cancelarAssinaturaAsaas(assinatura.asaas_subscription_id)
  } catch {
    redirect("/menu/assinatura?erro=" + encodeURIComponent("Não foi possível cancelar agora. Tente de novo."))
  }

  const { data: atualizada, error } = await supabase
    .from("assinaturas").update({ status: "cancelada" })
    .eq("id", assinatura.id).select("id")
  if (error || !atualizada?.length) {
    redirect("/menu/assinatura?erro=" + encodeURIComponent("Cancelada no pagamento, mas o app não atualizou. Recarregue."))
  }

  revalidatePath("/menu/assinatura")
  redirect(
    "/menu/assinatura?ok=" +
      encodeURIComponent("Assinatura cancelada. Tudo o que você registrou continua guardado."),
  )
}

/**
 * Troca de plano — sobe (Commander → Pro) ou desce (Pro → Commander).
 *
 * A coluna `plano` local TAMBÉM é atualizada agora, diferente da onda 38.
 * Naquela época o upgrade era só uma troca de ciclo e a tela lia o Asaas ao
 * vivo, então o dado local podia ficar para trás. Com sete planos isso deixou
 * de servir: o PLANO decide limite de embarcação e de tripulação, inclusive na
 * RLS (`plano_do_usuario`, migration 048) — plano defasado no banco viraria
 * limite errado no backend.
 *
 * A policy de UPDATE (migration 018) só deixa o próprio dono escrever
 * `status`, e isso está certo: uma RPC que aceitasse o plano como parâmetro
 * seria chamável direto pelo cliente, e alguém pediria `commander_pro` sem
 * pagar. Quem autoriza a troca é o GATEWAY ter aceitado a mudança de cobrança
 * — fato que só o servidor conhece. Por isso a escrita usa a chave de serviço
 * (`lib/supabase/servico.ts`), sempre restrita à linha de quem está logado, e
 * SÓ DEPOIS de o gateway confirmar.
 *
 * DOWNGRADE Pro → Commander (§23): "não apagar embarcações excedentes;
 * bloquear gestão das excedentes e exigir seleção da embarcação ativa". Este
 * arquivo não apaga nada — quem decide o que fica bloqueado é
 * `dividirEmbarcacoesPorPlano` (`lib/domain/assinatura-ciclo.ts`), lido em
 * `carregarAcessoEmbarcacoes`. O barco excedente continua inteiro no banco.
 */
export async function trocarPlano(formData: FormData) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: viva } = await supabase
    .from("assinaturas").select("*")
    .eq("usuario_id", user.id).in("status", ["ativa", "problema_pagamento"])
    .maybeSingle()
  if (!viva) redirect("/menu/assinatura")
  const assinatura = viva as Assinatura

  const pedido = String(formData.get("plano") ?? "") as PlanoId
  const destino: PlanoId | null =
    pedido in PLANOS && ehCobravel(pedido) ? pedido : proximoUpgrade(assinatura.plano)
  if (!destino || destino === assinatura.plano) redirect("/menu/assinatura")

  const valor = PLANOS[destino].valorCentavos
  if (valor == null || valor <= 0) redirect("/menu/assinatura")

  try {
    await atualizarAssinaturaAsaas(assinatura.asaas_subscription_id, {
      valorCentavos: valor,
      ciclo: PLANOS[destino].ciclo ?? "MONTHLY",
    })
  } catch {
    redirect("/menu/assinatura?erro=" + encodeURIComponent("Não foi possível trocar o plano agora. Tente de novo."))
  }

  const servico = supabaseServico()
  const { data: gravada, error } = servico
    ? await servico
        .from("assinaturas").update({ plano: destino, valor_centavos: valor })
        .eq("id", assinatura.id).eq("usuario_id", user.id).select("id")
    : { data: null, error: { message: "sem chave de serviço" } }
  if (error || !gravada?.length) {
    // O cliente já foi cobrado no valor novo lá fora. Esconder a falha aqui
    // deixaria o app com o plano antigo (e o limite antigo) enquanto a fatura
    // vem no valor novo — a pior combinação possível. Diz a verdade.
    redirect(
      "/menu/assinatura?erro=" +
        encodeURIComponent(
          "A cobrança foi atualizada, mas o app não conseguiu registrar o plano novo. Fale com a equipe antes de continuar.",
        ),
    )
  }

  revalidatePath("/menu/assinatura")
  redirect("/menu/assinatura?ok=" + encodeURIComponent(`Você passou para o ${PLANOS[destino].rotulo}`))
}
