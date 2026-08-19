import { aceitarConvite } from "@/lib/acoes/convites"
import { aceitarTransferencia } from "@/lib/acoes/transferencia"
import { Confirmar } from "@/components/confirmar"
import { Logo } from "@/components/logo"
import { supabaseServer } from "@/lib/supabase/server"

interface InfoConvite {
  nome_embarcacao: string
  valido: boolean
}

interface InfoTransferencia {
  nome_embarcacao: string
  valido: boolean
  destinatario_email: string
}

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
  const { data: { user } } = await supabase.auth.getUser()

  // Convite de tripulação (migration 008) e convite de transferência de
  // propriedade (migration 038) vivem em tabelas diferentes mas
  // reaproveitam a MESMA rota/tela — o código de um nunca deveria bater com
  // o de outro (gerados de forma independente), então checar as duas RPCs
  // é seguro. Tripulação tem prioridade só nesse caso hipotético de colisão:
  // é a das duas o convite menos destrutivo.
  const [{ data: convite }, { data: transferencia }] = await Promise.all([
    supabase.rpc("info_convite", { p_codigo: codigo }).maybeSingle(),
    supabase.rpc("info_transferencia", { p_codigo: codigo }).maybeSingle(),
  ])
  const infoConvite = convite as InfoConvite | null
  const infoTransferencia = transferencia as InfoTransferencia | null

  if (!infoConvite?.valido && infoTransferencia) {
    return (
      <main className="pt-8 text-center">
        <div className="text-base"><Logo /></div>
        {erro && (
          <p className="mx-auto mt-6 max-w-[320px] rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2 text-sm">{erro}</p>
        )}
        {!infoTransferencia.valido ? (
          <p className="mx-auto mt-6 max-w-[300px] text-sm text-dim">
            Esta transferência expirou ou já foi usada. Peça um novo link ao proprietário.
          </p>
        ) : (
          <>
            <h1 className="titulo-pagina mt-6">Você foi convidado a assumir este barco</h1>
            <p className="mt-2 text-sm text-dim">
              Embarcação <span className="font-semibold text-texto">{infoTransferencia.nome_embarcacao}</span>
            </p>
            {user && user.email?.toLowerCase() !== infoTransferencia.destinatario_email.toLowerCase() ? (
              <p className="mx-auto mt-6 max-w-[300px] text-sm text-dim">
                Este convite foi enviado para {infoTransferencia.destinatario_email}. Entre com essa conta pra aceitar.
              </p>
            ) : (
              <div className="mx-auto mt-6 max-w-[320px] rounded-[var(--raio-cartao)] border border-warn/40 bg-warn/10 p-4 text-left">
                <p className="text-sm font-semibold">Ao aceitar:</p>
                <ul className="mt-1.5 space-y-1 text-sm text-dim">
                  <li>· Você vira o proprietário — o dono anterior perde o acesso.</li>
                  <li>· A tripulação atual perde o acesso; você reconvida quem quiser.</li>
                  <li>· Motores, horas, manutenções, ocorrências, fotos e documentos continuam com o barco.</li>
                </ul>
                <form action={aceitarTransferencia} className="mt-4">
                  <input type="hidden" name="codigo" value={codigo} />
                  <Confirmar
                    rotulo="Aceitar e virar proprietário"
                    mensagem="Confirma? Não dá pra desfazer depois."
                    className="w-full rounded-[var(--raio-controle)] bg-accent py-3.5 text-center font-semibold text-acao-texto"
                  />
                </form>
              </div>
            )}
          </>
        )}
      </main>
    )
  }

  return (
    <main className="pt-8 text-center">
      <div className="text-base"><Logo /></div>
      {erro && (
        <p className="mx-auto mt-6 max-w-[320px] rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2 text-sm">{erro}</p>
      )}
      {!infoConvite ? (
        <p className="mx-auto mt-6 max-w-[300px] text-sm text-dim">
          Convite não encontrado. Confira o link com o proprietário.
        </p>
      ) : !infoConvite.valido ? (
        <p className="mx-auto mt-6 max-w-[300px] text-sm text-dim">
          Este convite expirou ou já foi usado. Peça um novo ao proprietário.
        </p>
      ) : (
        <>
          <h1 className="titulo-pagina mt-6">Você foi convidado para a tripulação</h1>
          <p className="mt-2 text-sm text-dim">
            Embarcação <span className="font-semibold text-texto">{infoConvite.nome_embarcacao}</span>
          </p>
          <form action={aceitarConvite} className="mx-auto mt-6 max-w-[320px]">
            <input type="hidden" name="codigo" value={codigo} />
            <button className="w-full rounded-[var(--raio-controle)] bg-accent py-3.5 font-semibold text-acao-texto">
              Entrar na tripulação
            </button>
          </form>
        </>
      )}
    </main>
  )
}
