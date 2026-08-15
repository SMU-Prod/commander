import Link from "next/link"
import { notFound } from "next/navigation"
import { Icone } from "@/components/icone"
import { Campo, CampoSelect, CampoTextarea } from "@/components/ui/campo"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { LinhaLista } from "@/components/ui/linha-lista"
import { concederCortesia, registrarAtendimento } from "@/lib/acoes/suporte"
import { exigirAreaAdmin } from "@/lib/admin"
import { carregarFichaUsuario } from "@/lib/consultas-suporte"
import { avaliarCiclo, ROTULO_SITUACAO, TOLERANCIA_PADRAO_DIAS } from "@/lib/domain/assinatura-ciclo"
import { hojeISO } from "@/lib/domain/datas"
import { formatarReais } from "@/lib/domain/gastos"
import { PLANOS, type PlanoId } from "@/lib/domain/planos"
import { supabaseServer } from "@/lib/supabase/server"

/**
 * Admin > Ficha do usuário (PRD §21, escopo Suporte).
 *
 * A ficha responde às três perguntas que abrem 90% dos chamados: em que
 * plano essa pessoa está, o pagamento está em dia, e quais barcos ela
 * alcança. Nada além.
 *
 * O QUE ESTA TELA NÃO MOSTRA, E POR QUÊ:
 *
 *   · nenhum dado do Diário, manutenção, foto, documento ou financeiro do
 *     barco. O §21 dá ao Suporte "embarcações", não "o dossiê da
 *     embarcação". E a garantia não é esta tela: a RLS da migration 053
 *     abre `embarcacoes`, `vinculos` e `assinaturas` pro papel `suporte` e
 *     mais nada — um `select` a mais aqui voltaria vazio;
 *   · nenhum meio de pagamento. `assinaturas` guarda o id do cliente no
 *     gateway, o plano e o valor do plano — nunca cartão, nunca conta. O
 *     §22 é explícito sobre dado financeiro pessoal, e o id do gateway não
 *     ajuda o atendimento a resolver nada, então também não aparece.
 *
 * A ÚNICA edição possível daqui é conceder cortesia — ação nomeada, com
 * motivo obrigatório e log. Editar dado técnico do barco do cliente não é
 * função do Suporte.
 */
export default async function AdminFichaUsuarioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ ok?: string; erro?: string }>
}) {
  await exigirAreaAdmin("usuarios")
  const { id } = await params
  const { ok, erro } = await searchParams

  const ficha = await carregarFichaUsuario(id)
  if (!ficha) notFound()

  const supabase = await supabaseServer()
  const { data: parametros } = await supabase
    .from("assinatura_parametros").select("tolerancia_dias").limit(1).maybeSingle()
  const toleranciaDias =
    (parametros as { tolerancia_dias: number } | null)?.tolerancia_dias ?? TOLERANCIA_PADRAO_DIAS
  const hoje = hojeISO()

  // Concessão ainda válida: o formulário de cortesia avisa que já existe uma,
  // pra o atendimento não empilhar duas sem perceber.
  const concessaoVigente = ficha.concessoes.find((c) => c.valido_ate >= hoje) ?? null

  return (
    <main>
      <Link href="/admin/usuarios" className="rotulo inline-flex items-center gap-1 text-accent-forte">
        <Icone nome="voltar" className="size-4" /> Usuários
      </Link>
      <h1 className="titulo-pagina mt-3">{ficha.perfil.nome}</h1>
      <p className="apoio mt-1 text-dim">
        Conta criada em {formatarData(ficha.perfil.created_at)}
        {ficha.perfil.telefone ? ` · ${ficha.perfil.telefone}` : ""}
      </p>

      {ok && <p className="corpo mt-3 rounded-lg border border-ok/40 bg-ok/10 px-3 py-2">{ok}</p>}
      {erro && <p className="corpo mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      {/* --- Plano e status (§21: "planos/status") ---------------------- */}
      <p className="rotulo mt-8 mb-2 text-dim">Plano e assinatura</p>
      {ficha.assinaturas.length === 0 ? (
        <div className="sombra-1 rounded-[14px] border border-line bg-panel p-4">
          <p className="corpo font-medium">Sem assinatura</p>
          <p className="apoio mt-1 text-dim">
            A conta está no nível gratuito. Nada foi cancelado — nunca houve cobrança.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {ficha.assinaturas.map((a) => {
            // A situação é DERIVADA, nunca gravada: status + data do problema
            // + tolerância configurável (§23). O Suporte lê aqui exatamente o
            // que o cliente lê na conta dele — se as duas telas contassem a
            // história de jeitos diferentes, o atendimento discutiria com o
            // cliente sobre qual das duas está certa.
            const ciclo = avaliarCiclo({
              status: a.status,
              problemaDesde: a.problema_desde ? a.problema_desde.slice(0, 10) : null,
              toleranciaDias,
              hoje,
            })
            return (
              <div key={a.id} className="sombra-1 rounded-[14px] border border-line bg-panel p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="corpo truncate font-medium">{rotuloPlano(a.plano)}</p>
                    <p className="apoio text-dim">
                      {formatarReais(a.valor_centavos)} · desde {formatarData(a.criado_em)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-line bg-panel2 px-2 py-0.5 font-mono-instr text-[10px] uppercase tracking-[.1em]">
                    {ROTULO_SITUACAO[ciclo.situacao]}
                  </span>
                </div>
                {ciclo.aviso && <p className="apoio mt-2 text-dim">{ciclo.aviso}</p>}
              </div>
            )
          })}
        </div>
      )}

      {/* --- Concessões (cortesia, Gold, migração) --------------------- */}
      <p className="rotulo mt-8 mb-2 text-dim">Acessos concedidos</p>
      {ficha.concessoes.length === 0 ? (
        <p className="apoio text-dim">Nenhum acesso de cortesia, Gold ou promoção nesta conta.</p>
      ) : (
        <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
          {ficha.concessoes.map((c) => (
            <LinhaLista
              key={c.id}
              titulo={rotuloPlano(c.plano_concedido)}
              subtitulo={`${ROTULO_ORIGEM[c.origem] ?? c.origem} · vale até ${formatarData(c.valido_ate)}`}
              valor={c.valido_ate >= hoje ? "Vigente" : "Vencida"}
              valorClassName={c.valido_ate >= hoje ? "text-ok" : "text-dim"}
            />
          ))}
        </div>
      )}

      {/* --- Embarcações vinculadas ------------------------------------ */}
      <p className="rotulo mt-8 mb-2 text-dim">Embarcações vinculadas</p>
      {ficha.embarcacoes.length === 0 ? (
        <EstadoVazio
          icone="embarcacao"
          titulo="Nenhuma embarcação"
          descricao="Esta conta não é proprietária nem tem acesso de tripulação a nenhum barco."
        />
      ) : (
        <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
          {ficha.embarcacoes.map((e) => (
            <LinhaLista
              key={e.id}
              href={`/admin/embarcacoes/${e.id}`}
              leading={<Icone nome="embarcacao" className="size-5 shrink-0 text-dim" />}
              titulo={e.nome}
              subtitulo={e.papel === "PROP" ? "Proprietário" : "Comandante / tripulação"}
            />
          ))}
        </div>
      )}

      {/* --- Cortesia (§21) -------------------------------------------- */}
      <p className="rotulo mt-8 mb-2 text-dim">Conceder cortesia</p>
      <form action={concederCortesia} className="sombra-1 space-y-3 rounded-[14px] border border-line bg-panel p-4">
        <input type="hidden" name="usuario_id" value={ficha.perfil.id} />
        <p className="apoio text-dim">
          Libera os recursos de um plano até a data escolhida, sem criar cobrança nenhuma. Quando vence, a
          conta volta ao nível dela sozinha.
          {concessaoVigente &&
            ` Já existe uma concessão vigente até ${formatarData(concessaoVigente.valido_ate)}.`}
        </p>
        <CampoSelect label="Plano" id="plano" name="plano" required defaultValue="commander">
          {CONCEDIVEIS.map((p) => (
            <option key={p} value={p}>{rotuloPlano(p)}</option>
          ))}
        </CampoSelect>
        <Campo label="Vale até" id="valido_ate" name="valido_ate" type="date" required />
        <Campo
          label="Motivo"
          id="motivo"
          name="motivo"
          required
          maxLength={200}
          placeholder="Compensação por indisponibilidade de 3 dias"
          dica="Fica gravado no log administrativo, junto de quem concedeu."
        />
        <button className="w-full rounded-xl border border-line bg-panel2 py-2.5 font-semibold">
          Conceder cortesia
        </button>
      </form>

      {/* --- Atendimento ------------------------------------------------ */}
      <p className="rotulo mt-8 mb-2 text-dim">Registrar atendimento</p>
      <form action={registrarAtendimento} className="sombra-1 space-y-3 rounded-[14px] border border-line bg-panel p-4">
        <input type="hidden" name="usuario_id" value={ficha.perfil.id} />
        <Campo label="Assunto" id="assunto" name="assunto" maxLength={120} placeholder="Dúvida sobre cobrança" />
        <CampoTextarea
          label="O que foi feito"
          id="nota"
          name="nota"
          required
          rows={4}
          maxLength={1000}
          dica="Vai pro log administrativo, que não é editável nem apagável — nem pelo CEO."
        />
        <button className="w-full rounded-xl border border-line bg-panel2 py-2.5 font-semibold">
          Registrar no log
        </button>
      </form>

      <p className="apoio mt-6 text-dim">
        Dado técnico do barco (motor, manutenção, documento, diário, financeiro) não é editável nem visível
        por aqui, e não é por falta de botão: o Suporte não tem permissão de leitura dessas tabelas no banco.
      </p>
    </main>
  )
}

const CONCEDIVEIS: PlanoId[] = ["commander", "commander_pro", "captain_pro"]

const ROTULO_ORIGEM: Record<string, string> = {
  gold: "Entrada pelo Commander Gold",
  migracao: "Promoção de migração",
  cortesia: "Cortesia do Suporte",
}

/** Plano fora do catálogo (id antigo em linha histórica) cai no código cru —
 *  esconder o que não sabemos traduzir seria perder informação numa tela de
 *  atendimento. */
function rotuloPlano(id: PlanoId): string {
  return PLANOS[id]?.rotulo ?? id
}

function formatarData(iso: string): string {
  return new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}
