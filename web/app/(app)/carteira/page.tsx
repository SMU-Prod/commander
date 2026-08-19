import Link from "next/link"
import { redirect } from "next/navigation"
import { Icone } from "@/components/icone"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { LinhaLista } from "@/components/ui/linha-lista"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { carregarPainel } from "@/lib/consultas"
import { AVISO_NAO_MOVIMENTA, ROTULO_MODO, saldoCarteira } from "@/lib/domain/carteira"
import { formatarReais } from "@/lib/domain/gastos"
import { podeVer } from "@/lib/domain/permissoes"
import { supabaseServer } from "@/lib/supabase/server"
import type { Carteira, CarteiraMovimento } from "@/lib/db/types"

/**
 * Carteira da Tripulação (PRD FINAL §9.4) — a lista.
 *
 * A mesma rota serve duas pessoas diferentes: o proprietário vê as carteiras
 * que liberou (e cria novas); o tripulante vê a dele. Não são duas telas
 * porque não são dois conceitos — é a mesma carteira olhada dos dois lados,
 * e a RLS da migration 043 já garante que cada um só enxergue o que lhe cabe.
 */
export default async function CarteiraPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")

  const ehProprietario = painel.papel === "PROP"
  if (!ehProprietario && !podeVer(painel.permissoes, "carteira")) {
    redirect(`/hoje?erro=${encodeURIComponent("Seu acesso não inclui a Carteira.")}`)
  }

  const supabase = await supabaseServer()
  const { data: brutas, error } = await supabase.from("carteiras")
    .select("*").eq("embarcacao_id", painel.embarcacao.id).order("created_at")
  if (error) throw new Error("Não foi possível carregar as carteiras. Recarregue a página.")
  const carteiras = (brutas ?? []) as Carteira[]

  const [{ data: movs }, { data: perfis }] = await Promise.all([
    carteiras.length > 0
      ? supabase.from("carteira_movimentos").select("carteira_id, tipo, valor_centavos, status")
          .in("carteira_id", carteiras.map((c) => c.id))
      : Promise.resolve({ data: [] as unknown[] }),
    supabase.from("profiles").select("id, nome"),
  ])
  const nomePorId = new Map(((perfis ?? []) as { id: string; nome: string }[]).map((p) => [p.id, p.nome]))
  const porCarteira = new Map<string, CarteiraMovimento[]>()
  for (const m of (movs ?? []) as CarteiraMovimento[]) {
    porCarteira.set(m.carteira_id, [...(porCarteira.get(m.carteira_id) ?? []), m])
  }

  return (
    <main>
      <h1 className="titulo-pagina">Carteira da Tripulação</h1>
      <p className="apoio mt-1 text-dim">
        {ehProprietario
          ? "Quanto você repassou, no que foi gasto e quanto ainda está em mãos."
          : "O que você recebeu, no que gastou e quanto ainda está com você."}
      </p>

      {/* Texto obrigatório do PRD §9.4 — a primeira coisa que a tela diz. */}
      <div className="mt-4 flex gap-3 rounded-[var(--raio-cartao)] border border-line bg-panel2 px-4 py-3">
        <Icone nome="escudo" className="mt-0.5 size-4 shrink-0 text-dim" />
        <p className="apoio text-dim">{AVISO_NAO_MOVIMENTA}</p>
      </div>

      {erro && <p className="corpo mt-3 rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      <SecaoPagina
        icone="carteira"
        acao={ehProprietario ? { href: "/carteira/nova", rotulo: "Carteira", icone: "mais" } : undefined}
      >
        {ehProprietario ? "Carteiras liberadas" : "Sua carteira"}
      </SecaoPagina>
      <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
        {carteiras.length === 0 && (
          <EstadoVazio
            variant="linha"
            icone="carteira"
            titulo={ehProprietario ? "Nenhuma carteira liberada" : "Você ainda não tem carteira"}
            descricao={ehProprietario
              ? "Libere uma carteira para um tripulante e registre o que repassar."
              : "Só o proprietário libera a carteira. Fale com ele."}
            acao={ehProprietario ? { href: "/carteira/nova", rotulo: "Liberar carteira" } : undefined}
          />
        )}
        {carteiras.map((c) => {
          const s = saldoCarteira((porCarteira.get(c.id) ?? []).map((m) => ({
            tipo: m.tipo, valorCentavos: m.valor_centavos, status: m.status,
          })))
          return (
            <LinhaLista
              key={c.id}
              href={`/carteira/${c.id}`}
              leading={<Icone nome="carteira" className="size-4 shrink-0 text-dim" />}
              titulo={nomePorId.get(c.tripulante_id) ?? "Tripulante"}
              subtitulo={
                <>
                  {ROTULO_MODO[c.modo]}
                  {c.exige_comprovante ? " · comprovante obrigatório" : " · comprovante opcional"}
                  {!c.ativa && " · encerrada"}
                  {s.aguardandoQtd > 0 && (
                    <span className="text-warn">
                      {" · "}{s.aguardandoQtd} aguardando {ehProprietario ? "você" : "aprovação"}
                    </span>
                  )}
                </>
              }
              valor={formatarReais(s.saldoCentavos)}
              valorClassName={s.saldoCentavos < 0 ? "text-crit" : ""}
              valorSecundario="em mãos"
            />
          )
        })}
      </div>

      {ehProprietario && (
        <Link
          href="/carteira/nova"
          className="mt-6 flex h-12 items-center justify-center gap-1.5 rounded-[var(--raio-controle)] border border-line bg-panel text-sm font-semibold"
        >
          <Icone nome="mais" className="size-4" /> Liberar carteira
        </Link>
      )}
    </main>
  )
}
