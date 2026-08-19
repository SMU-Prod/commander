import { redirect } from "next/navigation"
import { GuardaFormulario } from "@/components/guarda-formulario"
import { Icone } from "@/components/icone"
import { BotaoEnviar } from "@/components/ui/botao-enviar"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { CampoSelect, CampoTextarea } from "@/components/ui/campo"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { criarCarteira } from "@/lib/acoes/carteira"
import { carregarPainel } from "@/lib/consultas"
import { AVISO_NAO_MOVIMENTA, DESCRICAO_MODO, MODOS_CARTEIRA, ROTULO_MODO } from "@/lib/domain/carteira"
import { supabaseServer } from "@/lib/supabase/server"
import type { Carteira, Vinculo } from "@/lib/db/types"

/** Liberar uma Carteira. "Somente o proprietário cria/libera uma Carteira
 *  para um tripulante específico em uma embarcação específica" (PRD §9.4) —
 *  por isso a tela só existe pro PROP e a lista de destinatários sai da
 *  tripulação DESTA embarcação, não de uma busca por usuário. */
export default async function NovaCarteiraPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (painel.papel !== "PROP") {
    redirect(`/carteira?erro=${encodeURIComponent("Só o proprietário libera uma Carteira.")}`)
  }

  const supabase = await supabaseServer()
  const [{ data: vinculos }, { data: carteiras }, { data: perfis }] = await Promise.all([
    supabase.from("vinculos").select("*").eq("embarcacao_id", painel.embarcacao.id).eq("papel", "CMDT"),
    supabase.from("carteiras").select("tripulante_id").eq("embarcacao_id", painel.embarcacao.id),
    supabase.from("profiles").select("id, nome"),
  ])
  const nomePorId = new Map(((perfis ?? []) as { id: string; nome: string }[]).map((p) => [p.id, p.nome]))
  const jaTem = new Set(((carteiras ?? []) as Pick<Carteira, "tripulante_id">[]).map((c) => c.tripulante_id))
  const candidatos = ((vinculos ?? []) as Vinculo[]).filter((v) => !jaTem.has(v.usuario_id))

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref="/carteira"
        voltarRotulo="Carteira"
        titulo="Liberar carteira"
        descricao="Para um tripulante desta embarcação. Você decide as regras."
      />
      {erro && <p className="corpo mt-3 rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      <div className="mt-4 flex gap-3 rounded-[var(--raio-cartao)] border border-line bg-panel2 px-4 py-3">
        <Icone nome="escudo" className="mt-0.5 size-4 shrink-0 text-dim" />
        <p className="apoio text-dim">{AVISO_NAO_MOVIMENTA}</p>
      </div>

      {candidatos.length === 0 ? (
        <EstadoVazio
          className="mt-6"
          icone="pessoas"
          titulo="Ninguém disponível na tripulação"
          descricao="Todo mundo com acesso a esta embarcação já tem carteira, ou você ainda não convidou ninguém."
          acao={{ href: "/tripulacao", rotulo: "Ir para Tripulação" }}
        />
      ) : (
        <form action={criarCarteira} className="mt-6 space-y-4">
          <GuardaFormulario chave="carteira:nova" />
          <CampoSelect
            label="Para quem" id="tripulante_id" name="tripulante_id" required defaultValue=""
            dica="Só quem já está na tripulação desta embarcação aparece aqui."
          >
            <option value="" disabled>Escolha…</option>
            {candidatos.map((v) => (
              <option key={v.id} value={v.usuario_id}>{nomePorId.get(v.usuario_id) ?? "Comandante"}</option>
            ))}
          </CampoSelect>

          <CampoSelect label="Como o gasto entra" id="modo" name="modo" defaultValue="aprovacao">
            {MODOS_CARTEIRA.map((m) => (
              <option key={m} value={m}>{ROTULO_MODO[m]} — {DESCRICAO_MODO[m]}</option>
            ))}
          </CampoSelect>

          <label className="flex items-start gap-3 rounded-[var(--raio-cartao)] border border-line bg-panel px-3 py-3">
            <input type="checkbox" name="exige_comprovante" defaultChecked className="mt-0.5 size-5 accent-[var(--acao)]" />
            <span>
              <span className="corpo block font-medium">Exigir comprovante em todo gasto</span>
              <span className="apoio block text-dim">
                Sem nota ou recibo anexado, o gasto não é aceito. Desmarque para deixar opcional.
              </span>
            </span>
          </label>

          <CampoTextarea
            label="Observação (opcional)" id="observacao" name="observacao" rows={3}
            dica="Combinação que valha registrar — ex.: “vale só para combustível e taxas de marina”."
          />

          <BotaoEnviar rotulo="Liberar carteira" />
        </form>
      )}
    </main>
  )
}
