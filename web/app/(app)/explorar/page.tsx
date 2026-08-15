import { ExplorarMapa } from "@/components/mapa/explorar-mapa"
import { carregarNivelPlano } from "@/lib/consultas"
import { hojeISO } from "@/lib/domain/datas"
import { amostraExplorarFree, ehPago } from "@/lib/domain/plano-acesso"
import { supabaseServer } from "@/lib/supabase/server"
import type { Parceiro } from "@/lib/db/types"

/**
 * EXPLORAR PARCEIROS.
 *
 * Onda 39 — mesma consulta de /navegar (`.eq("visivel", true)`): só parceiro
 * que fechou com a Commander aparece, nunca POI de terceiro.
 *
 * Onda 47, §2.3 — "Explorar: alguns Partners aleatórios mostram somente foto +
 * nome; todo o restante do perfil e qualquer contato/ação ficam bloqueados."
 *
 * O corte acontece AQUI, no servidor, e não no componente: telefone, e-mail,
 * preço e o resto do perfil nunca chegam ao navegador de quem está no Free.
 * Filtrar no cliente seria teatro — bastaria abrir o HTML da página pra ler o
 * telefone que o §22 protege ("Partner não recebe telefone/dados sensíveis do
 * proprietário antes do ponto de liberação previsto"; a recíproca vale).
 *
 * A amostra é embaralhada por uma semente estável (dia + degrau de plano):
 * "aleatório" do PRD sem ficar piscando a cada refresh. Muda de um dia pro
 * outro, que é o suficiente pra não virar uma vitrine congelada de seis
 * parceiros.
 */
export default async function ExplorarPage() {
  const supabase = await supabaseServer()
  const { data, error } = await supabase.from("parceiros").select("*").eq("visivel", true)
  if (error) throw new Error("Não foi possível carregar o mapa. Recarregue a página.")

  const parceiros = (data ?? []) as Parceiro[]
  const nivel = await carregarNivelPlano()
  if (ehPago(nivel)) return <ExplorarMapa parceiros={parceiros} />

  const amostra = amostraExplorarFree(parceiros, `${hojeISO()}:${nivel}`).map((p) => ({
    ...p,
    // Foto + nome, e nada além disso (§2.3).
    sobre: null,
    telefone: null,
    email: null,
    horario: null,
    preco_diaria_centavos: null,
    preco_diesel_centavos: null,
    calado_max_m: null,
    qtd_poitas: null,
    traslado_incluso: null,
    vaga_cortesia: null,
    culinaria: null,
  }))

  return <ExplorarMapa parceiros={amostra} amostraFree />
}
