"use server"
import { revalidatePath } from "next/cache"
import { carregarPainel } from "@/lib/consultas"
import type { ParadaDb } from "@/lib/db/types"
import { supabaseServer } from "@/lib/supabase/server"

/** Onda 19 (Pilar Strava do Mar) — planejar viagem com paradas. Mesma régua
 *  de escrita do diário (`criarEvento`/`salvarTrilha`, lib/acoes/eventos.ts
 *  e trilha.ts): NÃO checa `podeEditar(permissoes, "diario")` aqui — a
 *  aplicação hoje não gatilha essa permissão nem para eventos/trilha, só a
 *  usa pra decidir o que MOSTRAR (ver hoje/page.tsx); a RLS (vínculo com a
 *  embarcação, migration 030) é quem de fato protege a escrita. A tela
 *  (/navegar) esconde o botão "Planejar viagem" de quem não pode editar o
 *  diário — mas a ação em si segue o mesmo padrão do resto do app. */

function paradaValida(p: unknown): p is ParadaDb {
  if (typeof p !== "object" || p === null) return false
  const o = p as Record<string, unknown>
  return (
    typeof o.nome === "string" && o.nome.trim() !== "" &&
    typeof o.la === "number" && o.la >= -90 && o.la <= 90 &&
    typeof o.lo === "number" && o.lo >= -180 && o.lo <= 180
  )
}

export async function criarViagem(
  nome: string,
  dataPrevista: string,
  paradas: ParadaDb[],
): Promise<{ ok: true; id: string } | { ok: false; erro: string }> {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, erro: "Sessão expirada — entre de novo." }
  const painel = await carregarPainel()
  if (!painel) return { ok: false, erro: "Cadastre a embarcação primeiro." }

  const nomeLimpo = nome.trim()
  if (nomeLimpo === "") return { ok: false, erro: "Dê um nome pra viagem." }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataPrevista)) {
    return { ok: false, erro: "Informe a data prevista de saída." }
  }

  if (!Array.isArray(paradas) || paradas.length < 2) {
    return { ok: false, erro: "Marque pelo menos a origem e o destino no mapa." }
  }
  const paradasLimpas = paradas
    .filter(paradaValida)
    .map((p) => ({ nome: p.nome.trim(), la: p.la, lo: p.lo }))
  if (paradasLimpas.length < 2) {
    return { ok: false, erro: "Marque pelo menos a origem e o destino no mapa." }
  }

  const { data: inserida, error } = await supabase.from("viagens").insert({
    embarcacao_id: painel.embarcacao.id,
    nome: nomeLimpo,
    data_prevista: dataPrevista,
    paradas: paradasLimpas,
    criado_por: user.id,
  }).select("id").single()
  if (error || !inserida) return { ok: false, erro: "Não foi possível salvar a viagem. Tente de novo." }

  revalidatePath("/hoje")
  revalidatePath("/navegar")
  return { ok: true, id: inserida.id }
}
