import Link from "next/link"
import { redirect } from "next/navigation"
import { Icone } from "@/components/icone"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { LinhaLista } from "@/components/ui/linha-lista"
import { solicitarAvaliacao } from "@/lib/acoes/selo"
import { carregarPainel, carregarSelo } from "@/lib/consultas"

export default async function SeloPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>
}) {
  const { ok, erro } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const selo = await carregarSelo()
  if (!selo) redirect("/onboarding")

  return (
    <main>
      <CabecalhoDetalhe voltarHref="/barco" voltarRotulo="Barco" />
      <h1 className="titulo-pagina mt-3 inline-flex items-center gap-2">
        <Icone nome="selo" className="size-5" /> Selo Ouro
      </h1>
      <p className="apoio mt-1 text-dim">
        O selo reconhece documentação e histórico completos no app. Quem qualifica o selo de
        fato é a avaliação presencial da equipe Commander — este checklist só prepara o pedido.
      </p>

      {ok && <p className="corpo mt-3 rounded-lg border border-ok/40 bg-ok/10 px-3 py-2">{ok}</p>}
      {erro && <p className="corpo mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      <div className="sombra-1 mt-4 rounded-[14px] border border-line bg-panel p-4">
        <div className="flex items-baseline justify-between">
          <p className="rotulo text-dim">Completude</p>
          <p className="font-mono-instr text-xs tabular-nums text-dim">
            {selo.completos} de {selo.total}
          </p>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-panel2">
          <div
            className="h-full rounded-full bg-accent-forte"
            style={{ width: `${Math.max(2, selo.percentual)}%` }}
          />
        </div>
      </div>

      <div className="sombra-1 mt-4 rounded-[14px] border border-line bg-panel px-4">
        {selo.itens.map((item) => (
          <LinhaLista
            key={item.chave}
            leading={
              <span
                className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${
                  item.ok ? "border-ok bg-ok/15" : "border-line"
                }`}
                aria-hidden="true"
              >
                {item.ok && <span className="size-2 rounded-full bg-ok" />}
              </span>
            }
            titulo={<span className={item.ok ? "" : "text-dim"}>{item.rotulo}</span>}
            subtitulo={!item.ok ? item.dica : undefined}
            trailing={
              !item.ok ? (
                <Link href={item.href} className="shrink-0 text-sm text-accent-forte">
                  Resolver
                </Link>
              ) : undefined
            }
          />
        ))}
      </div>

      {painel.papel === "PROP" ? (
        <form action={solicitarAvaliacao} className="mt-6">
          <button className="w-full rounded-xl bg-accent py-3 font-semibold text-acao-texto">
            Solicitar avaliação presencial
          </button>
          <p className="apoio mt-2 text-dim">
            A equipe Commander entra em contato para agendar a visita e avaliar fisicamente a
            embarcação — é essa avaliação que qualifica o selo, não o checklist acima.
          </p>
        </form>
      ) : (
        <p className="apoio mt-6 text-dim">
          Só o proprietário pode solicitar a avaliação presencial.
        </p>
      )}
    </main>
  )
}
