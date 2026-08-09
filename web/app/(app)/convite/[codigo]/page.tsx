import { aceitarConvite } from "@/lib/acoes/convites"
import { Logo } from "@/components/logo"
import { supabaseServer } from "@/lib/supabase/server"

export default async function ConvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ codigo: string }>
  searchParams: Promise<{ erro?: string }>
}) {
  const { codigo } = await params
  const { erro } = await searchParams
  const supabase = await supabaseServer()
  const { data } = await supabase.rpc("info_convite", { p_codigo: codigo }).maybeSingle()
  const info = data as { nome_embarcacao: string; valido: boolean } | null

  return (
    <main className="pt-8 text-center">
      <div className="text-base"><Logo /></div>
      {erro && (
        <p className="mx-auto mt-5 max-w-[320px] rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 text-sm">{erro}</p>
      )}
      {!info ? (
        <p className="mx-auto mt-6 max-w-[300px] text-sm text-dim">
          Convite não encontrado. Confira o link com o proprietário.
        </p>
      ) : !info.valido ? (
        <p className="mx-auto mt-6 max-w-[300px] text-sm text-dim">
          Este convite expirou ou já foi usado. Peça um novo ao proprietário.
        </p>
      ) : (
        <>
          <h1 className="titulo-pagina mt-6">Você foi convidado para a tripulação</h1>
          <p className="mt-2 text-sm text-dim">
            Embarcação <span className="font-semibold text-texto">{info.nome_embarcacao}</span>
          </p>
          <form action={aceitarConvite} className="mx-auto mt-6 max-w-[320px]">
            <input type="hidden" name="codigo" value={codigo} />
            <button className="w-full rounded-xl bg-accent py-3.5 font-semibold text-acao-texto">
              Entrar na tripulação
            </button>
          </form>
        </>
      )}
    </main>
  )
}
