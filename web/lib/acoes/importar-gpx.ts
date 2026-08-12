"use server"
import { revalidatePath } from "next/cache"
import { registrarCorredorMelhorEsforco } from "@/lib/acoes/trilha"
import { carregarPainel } from "@/lib/consultas"
import { dataSP, horaSP } from "@/lib/domain/datas"
import { MAX_PONTOS_TRILHA, resumoTrilha, type PontoTrilha } from "@/lib/domain/geo"
import { supabaseServer } from "@/lib/supabase/server"

/** Uma trilha ja decidida pelo usuario na previa (onda 21) — pontos no
 *  formato de armazenamento (`t` sempre numero; quando `semHorario`, e o
 *  indice sintetico de `paraPontosArmazenaveis`, NUNCA um horario real). */
export interface TrilhaParaImportar {
  pontos: PontoTrilha[]
  nome: string | null
  semHorario: boolean
  hash: string
  /** obrigatorio quando `semHorario`: o GPX nao tem data nenhuma pra essa
   *  trilha, a pessoa escolhe uma antes de confirmar (ver roteiro §2). */
  dataManual: string | null
}

export interface ResultadoImportacao {
  ok: boolean
  importadas: number
  puladasDuplicadas: string[]
  erros: { nome: string | null; erro: string }[]
}

/** Consulta quais dos hashes informados ja existem no diario desta
 *  embarcacao — usada tanto pela previa (avisar ANTES de importar) quanto
 *  como checagem final dentro de `importarTrilhas` (fonte da verdade,
 *  nunca confia so no que o cliente calculou). */
export async function hashesJaImportados(hashes: string[]): Promise<string[]> {
  const validos = Array.isArray(hashes) ? hashes.filter((h) => typeof h === "string" && h.length > 0) : []
  if (validos.length === 0) return []
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const painel = await carregarPainel()
  if (!painel) return []

  const { data } = await supabase
    .from("eventos")
    .select("origem_hash")
    .eq("embarcacao_id", painel.embarcacao.id)
    .eq("tipo", "navegacao")
    .in("origem_hash", validos)
  return (data ?? [])
    .map((r: { origem_hash: string | null }) => r.origem_hash)
    .filter((h): h is string => typeof h === "string")
}

/**
 * Grava as trilhas escolhidas na previa como saidas do diario (Livro de
 * Bordo), marcadas `importado_do_plotter`. Reusa EXATAMENTE o caminho de
 * `salvarTrilha` (web/lib/acoes/trilha.ts) pra corredores — mesma RPC, mesmo
 * consentimento — e nunca chama `boletimDoMar`: a saida e de uma data
 * passada, e o boletim so tem o clima de AGORA (nao existe previsao
 * historica na API usada), entao gravar isso seria fabricar dado do tempo
 * pra um dia que ja passou. mar_onda_m/mar_vento_kt ficam null por
 * construcao nesta importacao.
 */
export async function importarTrilhas(
  trilhas: TrilhaParaImportar[],
  contribuirCorredor: boolean,
): Promise<ResultadoImportacao> {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, importadas: 0, puladasDuplicadas: [], erros: [{ nome: null, erro: "Sessão expirada — entre de novo." }] }
  }
  const painel = await carregarPainel()
  if (!painel) {
    return { ok: false, importadas: 0, puladasDuplicadas: [], erros: [{ nome: null, erro: "Cadastre a embarcação primeiro." }] }
  }
  if (!Array.isArray(trilhas) || trilhas.length === 0) {
    return { ok: false, importadas: 0, puladasDuplicadas: [], erros: [{ nome: null, erro: "Nenhuma trilha selecionada." }] }
  }

  // Revalida no servidor mesmo que a previa ja tenha avisado — a fonte da
  // verdade da idempotencia e aqui, nunca so o que o cliente calculou antes.
  const jaImportados = new Set(await hashesJaImportados(trilhas.map((t) => t.hash)))

  let importadas = 0
  const puladasDuplicadas: string[] = []
  const erros: { nome: string | null; erro: string }[] = []

  for (const t of trilhas) {
    const nome = t.nome?.trim() || "Saída importada"

    if (t.hash && jaImportados.has(t.hash)) {
      puladasDuplicadas.push(nome)
      continue
    }

    const validos = (Array.isArray(t.pontos) ? t.pontos : [])
      .filter(
        (p) =>
          typeof p?.t === "number" && typeof p?.la === "number" && typeof p?.lo === "number" &&
          p.la >= -90 && p.la <= 90 && p.lo >= -180 && p.lo <= 180,
      )
      .slice(0, MAX_PONTOS_TRILHA)
    if (validos.length < 2) {
      erros.push({ nome, erro: "Trilha curta demais para importar." })
      continue
    }

    let data: string
    if (t.semHorario) {
      if (!t.dataManual) {
        erros.push({ nome, erro: "Essa trilha não tem data no arquivo — informe uma data antes de importar." })
        continue
      }
      data = t.dataManual
    } else {
      data = dataSP(validos[0].t)
    }

    const r = t.semHorario ? null : resumoTrilha(validos)
    const descricao = [
      r ? `${r.distanciaNm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} nm em ${r.duracaoH.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h` : null,
      r ? `máx ${r.velMaxKt.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kt` : null,
      "Importada do plotter",
    ].filter(Boolean).join(" · ")

    const { data: inserido, error } = await supabase.from("eventos").insert({
      embarcacao_id: painel.embarcacao.id,
      tipo: "navegacao",
      data,
      descricao,
      trilha: validos,
      criado_por: user.id,
      hora_saida: t.semHorario ? null : horaSP(validos[0].t),
      hora_retorno: t.semHorario ? null : horaSP(validos[validos.length - 1].t),
      importado_do_plotter: true,
      trilha_sem_horario: t.semHorario,
      origem_hash: t.hash || null,
    }).select("id").single()

    if (error || !inserido) {
      erros.push({ nome, erro: "Não foi possível salvar esta saída." })
      continue
    }
    importadas++

    // Corredores (onda 17): mesmo consentimento, mesma porta de escrita —
    // best-effort, nunca desfaz a saida ja gravada acima.
    if (contribuirCorredor) {
      await registrarCorredorMelhorEsforco(supabase, validos)
    }
  }

  if (importadas > 0) {
    revalidatePath("/diario")
    revalidatePath("/hoje")
  }

  return {
    ok: importadas > 0 || (erros.length === 0 && puladasDuplicadas.length > 0),
    importadas,
    puladasDuplicadas,
    erros,
  }
}
