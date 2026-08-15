import Link from "next/link"
import { Icone } from "@/components/icone"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { definirVisibilidadeParceiro } from "@/lib/acoes/publicidade"
import { exigirAreaAdmin } from "@/lib/admin"
import { carregarCampanhas } from "@/lib/consultas-publicidade"
import { carregarMapaTaxonomia, nomeDe } from "@/lib/consultas-marketplace"
import { hojeISO } from "@/lib/domain/datas"
import { campanhaVigente, ROTULO_PRODUTO, type CampanhaParaExibicao } from "@/lib/domain/publicidade"
import { supabaseServer } from "@/lib/supabase/server"

/**
 * Admin > Partners (PRD §21, escopo Comercial: "Partners, destaques,
 * campanhas, publicidade e métricas comerciais").
 *
 * TRÊS DECISÕES QUE VALE EXPLICAR:
 *
 * 1) O Comercial VÊ o plano do Partner e não o edita. O §21 escreve "ver
 *    plano"; mudar plano é cobrança, e cobrança é o §23 — outra conversa,
 *    com outro dono. Por isso não há formulário de plano aqui, e a RLS não
 *    dá update de `parceiros` ao Comercial.
 *
 * 2) Suspender passa por RPC de uma coluna só. RLS não filtra COLUNA: uma
 *    policy `for update` deixaria o Comercial reescrever telefone, preço da
 *    diária e descrição do perfil inteiro. Ver o item 8 do cabeçalho da
 *    migration 053.
 *
 * 3) NÃO aparece nada do dono da conta — nem nome, nem e-mail, nem
 *    telefone pessoal. O §22 diz que "Partner não recebe telefone/dados
 *    sensíveis do proprietário antes do ponto de liberação previsto no
 *    fluxo", e o mesmo princípio vale pra dentro de casa. O que se lê aqui é
 *    o perfil COMERCIAL, que já é vitrine pública no Explorar. A garantia
 *    real não é esta tela: é a RLS, que não abre `profiles` pro papel
 *    comercial.
 *
 * A lista seleciona colunas nominalmente (não `select("*")`) porque
 * `parceiros` está sendo reescrito noutra onda — pedir só o que se usa
 * mantém esta tela de pé independente do formato final do perfil.
 */

interface ParceiroNaCarteira {
  id: string
  nome: string
  plano: string
  visivel: boolean
  regiao_id: string | null
  criado_em: string
}

const ROTULO_PLANO: Record<string, string> = {
  cortesia: "Cortesia",
  basico: "Básico",
  destaque: "Destaque",
}

export default async function AdminParceirosPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>
}) {
  await exigirAreaAdmin("parceiros")
  const { ok, erro } = await searchParams
  const supabase = await supabaseServer()

  const [{ data: brutos }, campanhas, mapa] = await Promise.all([
    supabase
      .from("parceiros")
      .select("id, nome, plano, visivel, regiao_id, criado_em")
      .order("nome"),
    carregarCampanhas(),
    carregarMapaTaxonomia(),
  ])
  const parceiros = (brutos as ParceiroNaCarteira[] | null) ?? []
  const hoje = hojeISO()

  const campanhasDe = (id: string) =>
    campanhas.filter((c) => c.campanha.parceiro_id === id)

  return (
    <main>
      <Link href="/admin" className="rotulo inline-flex items-center gap-1 text-accent-forte">
        <Icone nome="voltar" className="size-4" /> Admin Commander
      </Link>
      <h1 className="titulo-pagina mt-3">Partners</h1>
      <p className="apoio mt-1 text-dim">
        Carteira comercial. Suspender tira o perfil do Explorar na hora e não apaga nada — o cadastro, as
        fotos e o histórico continuam do Partner.
      </p>

      {ok && <p className="corpo mt-3 rounded-lg border border-ok/40 bg-ok/10 px-3 py-2">{ok}</p>}
      {erro && <p className="corpo mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      <div className="mt-5 space-y-3">
        {parceiros.length === 0 ? (
          <EstadoVazio
            icone="ancora"
            titulo="Nenhum Partner cadastrado ainda"
            descricao="Marinas, postos, lojas e prestadores aparecem aqui assim que criarem o perfil."
          />
        ) : (
          parceiros.map((p) => {
            const doParceiro = campanhasDe(p.id)
            const noAr = doParceiro.filter((c) => campanhaVigente(c.campanha as CampanhaParaExibicao, hoje))
            return (
              <div key={p.id} className="sombra-1 rounded-[14px] border border-line bg-panel p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="corpo truncate font-medium">{p.nome}</p>
                    <p className="apoio text-dim">
                      {nomeDe(mapa, p.regiao_id) ?? "Região não informada"} ·{" "}
                      {ROTULO_PLANO[p.plano] ?? p.plano}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 font-mono-instr text-[10px] uppercase tracking-[.1em] ${
                      p.visivel ? "border-ok/40 bg-ok/10" : "border-line bg-panel2"
                    }`}
                  >
                    {p.visivel ? "No Explorar" : "Suspenso"}
                  </span>
                </div>

                {/* Destaques vigentes — é o que o §21 chama de "destaques".
                    Mostrado aqui pra que suspender um Partner com campanha no
                    ar seja uma decisão informada, não uma surpresa no fim do
                    mês. */}
                {noAr.length > 0 && (
                  <p className="apoio mt-2 text-dim">
                    No ar: {noAr.map((c) => ROTULO_PRODUTO[c.campanha.produto]).join(", ")}
                  </p>
                )}
                {doParceiro.length > 0 && noAr.length === 0 && (
                  <p className="apoio mt-2 text-dim">
                    {doParceiro.length} campanha{doParceiro.length > 1 ? "s" : ""} registrada
                    {doParceiro.length > 1 ? "s" : ""}, nenhuma no ar.
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <form action={definirVisibilidadeParceiro}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="visivel" value={p.visivel ? "nao" : "sim"} />
                    <button className="apoio rounded-lg border border-line bg-panel2 px-3 py-1.5 font-medium">
                      {p.visivel ? "Suspender do Explorar" : "Reativar no Explorar"}
                    </button>
                  </form>
                  <Link href="/admin/publicidade" className="apoio text-accent-forte">
                    Campanhas e destaques
                  </Link>
                </div>

                {p.visivel && noAr.length > 0 && (
                  <p className="apoio mt-2 text-dim">
                    Suspender tira também o anúncio do ar — a campanha continua registrada, mas deixa de ser
                    exibida.
                  </p>
                )}
              </div>
            )
          })
        )}
      </div>
    </main>
  )
}
