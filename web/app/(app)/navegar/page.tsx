import { NavegarMapa } from "@/components/mapa/navegar-mapa"
import { carregarPainel } from "@/lib/consultas"
import { podeEditar } from "@/lib/domain/permissoes"
import { supabaseServer } from "@/lib/supabase/server"
import type { Parceiro } from "@/lib/db/types"

export default async function NavegarPage() {
  const supabase = await supabaseServer()
  const { data, error } = await supabase.from("parceiros").select("*").eq("visivel", true)
  if (error) throw new Error("Não foi possível carregar o mapa. Recarregue a página.")

  // Onda 12 — calado da embarcacao ativa, pra rota respeitar profundidade.
  // `carregarPainel` e cacheado por request (React `cache()`), entao chamar
  // aqui de novo (o layout do grupo (app) ja chama) nao bate no banco outra
  // vez. Sem barco vinculado (painel null — usuario ainda nao onboardou),
  // o mapa segue funcionando normal, so sem calado (mesmo tratamento de
  // "nao cadastrado" que a tela ja da pro caso comum).
  const painel = await carregarPainel()
  const caladoM = painel?.embarcacao.calado_m ?? null
  // Onda 19 — mesma checagem que já vale pra registrar no diário. `null` em
  // `permissoes` significa PROP (acesso completo, ver lib/consultas.ts) —
  // só vale quando HÁ painel; sem painel (sem vínculo nenhum) não pode.
  const podePlanejarViagem = painel != null && podeEditar(painel.permissoes, "diario")

  return <NavegarMapa parceiros={(data ?? []) as Parceiro[]} caladoM={caladoM} podePlanejarViagem={podePlanejarViagem} />
}
