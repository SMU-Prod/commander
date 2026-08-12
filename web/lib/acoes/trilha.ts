"use server"
import { revalidatePath } from "next/cache"
import { carregarPainel, hojeISO } from "@/lib/consultas"
import { horasSugeridas } from "@/lib/domain/bordo"
import { celulasUnicasDaTrilha } from "@/lib/domain/corredores"
import { horaSP } from "@/lib/domain/datas"
import { MAX_PONTOS_TRILHA, resumoTrilha, type PontoTrilha } from "@/lib/domain/geo"
import { boletimDoMar } from "@/lib/mar"
import { supabaseServer } from "@/lib/supabase/server"

/** Sobe as celulas unicas da trilha pro agregado de corredores — melhor
 *  esforco (nunca desfaz nem sinaliza erro pro chamador: uma trilha ja
 *  salva/importada com sucesso nao pode falhar por causa de um bonus
 *  colaborativo). Compartilhada entre `salvarTrilha` (trilha ao vivo) e a
 *  importacao de GPX (onda 21) — MESMA porta de escrita (RPC security
 *  definer `registrar_passagens_corredor`), nunca duas implementacoes. */
export async function registrarCorredorMelhorEsforco(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  pontos: PontoTrilha[],
): Promise<void> {
  const celulas = celulasUnicasDaTrilha(pontos)
  if (celulas.length === 0) return
  try {
    await supabase.rpc("registrar_passagens_corredor", { p_celulas: celulas })
  } catch {
    // best-effort — ver comentario acima
  }
}

export async function salvarTrilha(
  pontos: PontoTrilha[],
  observacao: string,
  /** Consentimento explicito (onda 17) pra contribuir com o mapa de
   *  corredores — sem isso, NADA sobe, a trilha salva normal do mesmo jeito.
   *  Default `false`: sem esse argumento (chamador antigo), o comportamento
   *  e exatamente o de antes desta onda. */
  contribuirCorredor: boolean = false,
): Promise<{ ok: true; redirecionarPara: string } | { ok: false; erro: string }> {
  const textoObs = typeof observacao === "string" ? observacao : ""
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, erro: "Sessão expirada — entre de novo." }
  const painel = await carregarPainel()
  if (!painel) return { ok: false, erro: "Cadastre a embarcação primeiro." }

  const validos = (Array.isArray(pontos) ? pontos : [])
    .filter(
      (p) =>
        typeof p?.t === "number" && typeof p?.la === "number" && typeof p?.lo === "number" &&
        p.la >= -90 && p.la <= 90 && p.lo >= -180 && p.lo <= 180,
    )
    .slice(0, MAX_PONTOS_TRILHA)
  if (validos.length < 2) return { ok: false, erro: "Trilha curta demais para salvar." }

  const r = resumoTrilha(validos)
  const descricao = [
    `${r.distanciaNm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} nm em ${r.duracaoH.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`,
    `máx ${r.velMaxKt.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kt`,
    textoObs.trim() || null,
  ]
    .filter(Boolean)
    .join(" · ")

  // Deriva hora de saida/retorno do primeiro e ultimo ponto da trilha — mesma
  // sinergia do formulario manual, so que pelo caminho do GPS.
  const horaSaida = horaSP(validos[0].t)
  const horaRetorno = horaSP(validos[validos.length - 1].t)

  // Condicao do mar CONGELADA no momento do registro — o passado nao muda.
  // Falha da API (ou marina sem posicao definida) nao pode impedir o
  // salvamento: grava null e segue.
  let marOndaM: number | null = null
  let marVentoKt: number | null = null
  if (painel.embarcacao.marina_lat != null && painel.embarcacao.marina_lon != null) {
    const boletim = await boletimDoMar(painel.embarcacao.marina_lat, painel.embarcacao.marina_lon)
    marOndaM = boletim?.ondaM ?? null
    marVentoKt = boletim?.ventoKt ?? null
  }

  const { data: inserido, error } = await supabase.from("eventos").insert({
    embarcacao_id: painel.embarcacao.id,
    tipo: "navegacao",
    data: hojeISO(),
    descricao,
    trilha: validos,
    criado_por: user.id,
    hora_saida: horaSaida,
    hora_retorno: horaRetorno,
    mar_onda_m: marOndaM,
    mar_vento_kt: marVentoKt,
  }).select("id").single()
  if (error || !inserido) return { ok: false, erro: "Não foi possível salvar a trilha. Ela continua na tela — tente de novo." }

  // Corredores (onda 17): SO com consentimento explicito, e SO depois da
  // trilha ja estar gravada acima — e um bonus colaborativo pro mapa, nunca
  // um requisito pra salvar. Melhor esforco: uma falha aqui NUNCA desfaz o
  // salvamento (ja concluido) nem aparece como erro pro usuario — o dono ve
  // a trilha salva normalmente, so o corredor que nao subiu desta vez.
  if (contribuirCorredor) {
    await registrarCorredorMelhorEsforco(supabase, validos)
  }

  revalidatePath("/diario")
  revalidatePath("/hoje")

  // A sinergia: trilha com duracao relevante manda pra tela de sugestao de
  // horas do motor — mesmo destino do caminho manual (criarEvento).
  const redirecionarPara = horasSugeridas(r.duracaoH) !== null ? `/diario/${inserido.id}/horas` : "/diario"
  return { ok: true, redirecionarPara }
}
