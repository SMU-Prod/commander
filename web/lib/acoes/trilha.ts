"use server"
import { revalidatePath } from "next/cache"
import { carregarPainel, hojeISO } from "@/lib/consultas"
import { MAX_PONTOS_TRILHA, resumoTrilha, type PontoTrilha } from "@/lib/domain/geo"
import { supabaseServer } from "@/lib/supabase/server"

export async function salvarTrilha(
  pontos: PontoTrilha[],
  observacao: string,
): Promise<{ ok: true } | { ok: false; erro: string }> {
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

  const { error } = await supabase.from("eventos").insert({
    embarcacao_id: painel.embarcacao.id,
    tipo: "navegacao",
    data: hojeISO(),
    descricao,
    trilha: validos,
    criado_por: user.id,
  })
  if (error) return { ok: false, erro: "Não foi possível salvar a trilha. Ela continua na tela — tente de novo." }

  revalidatePath("/diario")
  revalidatePath("/hoje")
  return { ok: true }
}
