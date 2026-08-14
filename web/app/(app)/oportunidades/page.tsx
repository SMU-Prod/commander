import Link from "next/link"
import { Icone } from "@/components/icone"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { LinhaLista } from "@/components/ui/linha-lista"
import { RedeNav } from "@/components/ui/rede-nav"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { tempoDesde } from "@/lib/domain/navegacao"
import { supabaseServer } from "@/lib/supabase/server"
import type { Oportunidade, StatusOportunidade, TipoOportunidade } from "@/lib/db/types"

const ROTULO_TIPO: Record<TipoOportunidade, string> = {
  vaga: "Vaga",
  diaria: "Diária",
  peca_servico: "Peça/serviço",
}
const ROTULO_STATUS: Record<StatusOportunidade, string> = {
  aberta: "Aberta",
  atendida: "Atendida",
  encerrada: "Encerrada",
}

/** Onda 39 (PRD upgrade2-master §49, §53-54) — o Marketplace de verdade do
 *  PRD: mural de oportunidades (vaga, diária, "COMPRO — Rádio VHF"),
 *  prestadores/comandantes respondem. Nome final "Oportunidades", não
 *  "Marketplace" — ver docs/CONTRIBUTING.md, Glossário, pra não reabrir a
 *  ambiguidade que a auditoria de usabilidade de 08/08 já tinha fechado
 *  (Marketplace → Comandantes). Sem comissão nem preço-piso nesta fase. */
export default async function OportunidadesPage() {
  const supabase = await supabaseServer()
  const agoraIso = new Date().toISOString()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: abertas, error } = await supabase
    .from("oportunidades").select("*").eq("status", "aberta").order("created_at", { ascending: false })
  if (error) throw new Error("Não foi possível carregar as oportunidades. Recarregue a página.")

  const { data: minhas } = user
    ? await supabase.from("oportunidades").select("*").eq("autor_id", user.id).order("created_at", { ascending: false })
    : { data: [] as Oportunidade[] }

  return (
    <main>
      <h1 className="titulo-pagina">Oportunidades</h1>
      <p className="apoio mt-1 text-dim">
        Publique o que precisa — vaga de comandante, diária, peça ou serviço — e prestadores respondem por aqui.
      </p>
      <p className="apoio mt-1 text-dim">
        Mural de contato: sem comissão nem intermediação de pagamento nesta fase — combine direto com quem responder.
      </p>
      <RedeNav atual="oportunidades" className="mt-4" />

      <Link
        href="/oportunidades/nova"
        className="sombra-1 mt-4 flex h-11 items-center justify-center gap-1.5 rounded-xl bg-accent px-4 text-sm font-semibold text-acao-texto"
      >
        <Icone nome="mais" className="size-4" /> Publicar oportunidade
      </Link>

      {(minhas ?? []).length > 0 && (
        <>
          <SecaoPagina icone="pessoas">Suas publicações</SecaoPagina>
          <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
            {(minhas as Oportunidade[]).map((o) => (
              <LinhaLista
                key={o.id}
                href={`/oportunidades/${o.id}`}
                variant="grupo"
                titulo={o.titulo}
                subtitulo={`${ROTULO_TIPO[o.tipo]} · ${ROTULO_STATUS[o.status]} · ${tempoDesde(o.created_at, agoraIso)}`}
              />
            ))}
          </div>
        </>
      )}

      <SecaoPagina icone="marketplace">Abertas agora</SecaoPagina>
      <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
        {(abertas ?? []).length === 0 && (
          <EstadoVazio
            variant="linha"
            icone="marketplace"
            titulo="Nenhuma oportunidade aberta agora"
            descricao="Seja o primeiro a publicar."
            acao={{ href: "/oportunidades/nova", rotulo: "Publicar oportunidade" }}
          />
        )}
        {(abertas as Oportunidade[]).map((o) => (
          <LinhaLista
            key={o.id}
            href={`/oportunidades/${o.id}`}
            variant="grupo"
            titulo={o.titulo}
            subtitulo={[ROTULO_TIPO[o.tipo], o.categoria, o.local].filter(Boolean).join(" · ")}
            valor={tempoDesde(o.created_at, agoraIso)}
          />
        ))}
      </div>
    </main>
  )
}
