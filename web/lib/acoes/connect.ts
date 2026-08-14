"use server"
import { redirect } from "next/navigation"
import { subirArquivo } from "@/lib/acervo"
import { carregarPainel } from "@/lib/consultas"
import { classificarCompatibilidadeConnect, type RespostaSimNaoNaoSei } from "@/lib/domain/connect"
import { supabaseServer } from "@/lib/supabase/server"

/**
 * Onda 34 — Commander Connect: grava o questionário de triagem de
 * compatibilidade (ver `web/lib/domain/connect.ts` pro porquê das 3
 * classes e a régua de honestidade). Este arquivo é `"use server"` porque
 * `registrarInteresseConnect` é usado direto como `<form action={...}>` —
 * a ponte "Connect ligado ao Diário" (`sincronizarHorasMotorConnect`) mora
 * em `./connect-motor.ts`, SEM `"use server"`, pela mesma razão de
 * `./leituras.ts` (`atualizarLeituraEquipamento`): recebe um
 * `SupabaseClient` como argumento, que não é serializável — não pode ser
 * um Server Action de verdade, só uma função de servidor comum.
 */

const MAX_FOTOS = 3

function erroInteresse(msg: string): never {
  redirect(`/barco/connect/interesse?erro=${encodeURIComponent(msg)}`)
}

function comoResposta(valor: FormDataEntryValue | null): RespostaSimNaoNaoSei {
  const texto = String(valor ?? "").trim()
  // Nunca assume "sim" por omissão — campo vazio/inesperado é sempre
  // tratado como incerteza, igual a uma resposta explícita "não sei" (a
  // classificação cai pra "consultar", nunca otimista, ver connect.ts).
  return texto === "sim" || texto === "nao" ? texto : "nao_sei"
}

export async function registrarInteresseConnect(formData: FormData) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")

  const redeNmea2000 = comoResposta(formData.get("rede_nmea2000"))
  // Só perguntamos "os dados do motor já chegam na rede?" quando a rede
  // existe — fora desse caso o campo nem aparece na tela, então `null` é o
  // estado correto (não "não sei", que implicaria que a pergunta foi feita).
  const dadosMotorNaRedeBruto = formData.get("dados_motor_na_rede")
  const dadosMotorNaRede = redeNmea2000 === "sim" ? comoResposta(dadosMotorNaRedeBruto) : null
  const motorDigitalConhecido = comoResposta(formData.get("motor_digital_conhecido"))

  const classificacao = classificarCompatibilidadeConnect({ redeNmea2000, dadosMotorNaRede, motorDigitalConhecido })

  const texto = (k: string) => {
    const v = String(formData.get(k) ?? "").trim()
    return v === "" ? null : v
  }
  const motorMarca = texto("motor_marca")
  const motorModelo = texto("motor_modelo")
  const observacoes = texto("observacoes")

  const anoBruto = texto("motor_ano")
  let motorAno: number | null = null
  if (anoBruto != null) {
    const n = Number(anoBruto)
    if (!Number.isInteger(n) || n < 1960 || n > 2100) erroInteresse("Informe um ano válido pro motor.")
    motorAno = n
  }

  const arquivos = formData.getAll("fotos").filter((f): f is File => f instanceof File && f.size > 0).slice(0, MAX_FOTOS)
  const fotosPainel: string[] = []
  for (const arquivo of arquivos) {
    const r = await subirArquivo(supabase, painel.embarcacao.id, "connect", arquivo)
    if ("erro" in r) erroInteresse(r.erro)
    else fotosPainel.push(r.path)
  }

  const { data: inserido, error } = await supabase
    .from("connect_interesses")
    .insert({
      embarcacao_id: painel.embarcacao.id,
      criado_por: user.id,
      rede_nmea2000: redeNmea2000,
      dados_motor_na_rede: dadosMotorNaRede,
      motor_digital_conhecido: motorDigitalConhecido,
      classificacao,
      motor_marca: motorMarca,
      motor_modelo: motorModelo,
      motor_ano: motorAno,
      fotos_painel: fotosPainel,
      observacoes,
    })
    .select("id")
  if (error || !inserido?.length) {
    if (fotosPainel.length) await supabase.storage.from("acervo").remove(fotosPainel)
    erroInteresse("Não foi possível registrar seu interesse. Tente de novo.")
  }

  redirect(`/barco/connect/interesse?enviado=${classificacao}`)
}
