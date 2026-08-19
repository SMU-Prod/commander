import { redirect } from "next/navigation"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { Campo, CampoSelect, CampoTextarea } from "@/components/ui/campo"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { Selo } from "@/components/ui/selo"
import {
  abrirServico, abrirVotacao, atualizarServico, criarOrcamento, publicarServico, votar,
} from "@/lib/acoes/enterprise"
import { carregarPainel, hojeISO } from "@/lib/consultas"
import {
  apurarVotacao, ESTADOS_SERVICO, linhaDaApuracao, orcamentoVencido,
  ROTULO_ESTADO_SERVICO, ROTULO_SITUACAO_VOTACAO, situacaoDaVotacao, tomDoServico,
  type EstadoServico, type Voto,
} from "@/lib/domain/mecanica"
import { podeEditar } from "@/lib/domain/permissoes"
import { formatarReais } from "@/lib/domain/gastos"
import { supabaseServer } from "@/lib/supabase/server"
import { ACAO_NAO_ESTICA } from "@/lib/ui/superficies"

/**
 * MECÂNICA (onda 78 — PRD §7 e §9).
 *
 * Três blocos, na ordem em que a oficina acontece: o que está na bancada, os
 * orçamentos, e as votações abertas.
 *
 * A barreira do §7 aparece na tela como o botão "Publicar para os cotistas",
 * e ele só existe para o proprietário — mas a trava de verdade está no banco
 * (migration 063): mesmo sem o botão, um cotista não enxerga laudo não
 * publicado.
 */
export default async function MecanicaPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const editavel = podeEditar(painel.permissoes, "motores")
  const ehDono = painel.papel === "PROP"
  const hoje = hojeISO()

  const supabase = await supabaseServer()
  const [{ data: servicos }, { data: orcamentos }, { data: votacoes }, { data: cotistas }] =
    await Promise.all([
      supabase.from("servicos_mecanica").select("*")
        .eq("embarcacao_id", painel.embarcacao.id).order("criado_em", { ascending: false }).limit(30),
      supabase.from("orcamentos").select("*")
        .eq("embarcacao_id", painel.embarcacao.id).order("criado_em", { ascending: false }).limit(20),
      supabase.from("votacoes").select("*, votos(voto)")
        .eq("embarcacao_id", painel.embarcacao.id).order("aberta_em", { ascending: false }).limit(10),
      supabase.from("vinculos").select("id")
        .eq("embarcacao_id", painel.embarcacao.id).eq("papel", "COTISTA").is("suspenso_em", null),
    ])

  type Servico = {
    id: string; problema_informado: string | null; diagnostico: string | null
    conserto: string | null; horas: number | null; estado: EstadoServico
    publicado_em: string | null; criado_em: string
  }
  type Orcamento = {
    id: string; servico_proposto: string; fornecedor: string | null; pecas: string | null
    valor_centavos: number | null; valido_ate: string | null
  }
  type Votacao = { id: string; orcamento_id: string; encerrada_em: string | null; votos: { voto: Voto }[] }

  const lista = (servicos ?? []) as Servico[]
  const orcs = (orcamentos ?? []) as Orcamento[]
  const vots = (votacoes ?? []) as Votacao[]
  // O total de votantes é o de cotistas ATIVOS — suspenso não vota (§13), e
  // contá-lo faria a votação nunca fechar em unanimidade.
  const totalCotistas = (cotistas ?? []).length
  const votacaoPorOrcamento = new Map(vots.map((v) => [v.orcamento_id, v]))

  const abertos = lista.filter((s) => s.estado !== "concluido")

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref="/barco"
        voltarRotulo="Barco"
        titulo="Mecânica"
        descricao="Diagnóstico, conserto e orçamento — o que a oficina está fazendo."
        selo={abertos.length > 0 ? <Selo estado="atencao">{`${abertos.length} em aberto`}</Selo> : undefined}
      />
      {erro && <p className="corpo mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      <SecaoPagina icone="ferramenta">Na bancada</SecaoPagina>
      {lista.length === 0 ? (
        <EstadoVazio
          variant="linha"
          icone="ferramenta"
          titulo="Nenhum serviço registrado"
          descricao={editavel ? "Abra um serviço abaixo quando algo entrar na oficina." : undefined}
        />
      ) : (
        <div className="space-y-2">
          {lista.map((s) => {
            const tom = tomDoServico(s.estado)
            return (
              <div
                key={s.id}
                className={`sombra-1 rounded-[var(--raio-cartao)] border bg-panel p-3.5 ${
                  tom === "parado" ? "border-line border-l-2 border-l-warn" : "border-line"
                }`}
              >
                <div className="flex items-center gap-2">
                  <p className="titulo-card min-w-0 flex-1">{s.problema_informado ?? "Serviço"}</p>
                  <Selo estado={tom === "fechado" ? "ok" : tom === "parado" ? "atencao" : "neutro"}>
                    {ROTULO_ESTADO_SERVICO[s.estado]}
                  </Selo>
                </div>
                {s.diagnostico && <p className="apoio mt-1 text-dim">{s.diagnostico}</p>}
                {s.conserto && <p className="apoio mt-1">{s.conserto}</p>}
                <p className="apoio mt-1 text-dim">
                  {s.horas != null && (
                    <span className="font-mono-instr tabular-nums">{s.horas.toLocaleString("pt-BR")} h · </span>
                  )}
                  {/* §7: o cotista só vê o que o ADM publicou. A etiqueta diz
                      em que pé está, pro mecânico não achar que já foi. */}
                  {s.publicado_em ? "publicado aos cotistas" : "não publicado"}
                </p>

                {editavel && s.estado !== "concluido" && (
                  <form action={atualizarServico} className="mt-3 space-y-2">
                    <input type="hidden" name="servico_id" value={s.id} />
                    <div className="grid grid-cols-2 gap-2">
                      <CampoSelect label="Estado" id={`estado-${s.id}`} name="estado" defaultValue={s.estado}>
                        {ESTADOS_SERVICO.map((e) => (
                          <option key={e} value={e}>{ROTULO_ESTADO_SERVICO[e]}</option>
                        ))}
                      </CampoSelect>
                      <Campo label="Horas" id={`horas-${s.id}`} name="horas" inputMode="decimal" className="font-mono-instr tabular-nums" />
                    </div>
                    <Campo label="Conserto feito" id={`conserto-${s.id}`} name="conserto" defaultValue={s.conserto ?? ""} />
                    <button className="h-11 w-full rounded-[var(--raio-controle)] border border-line text-sm font-medium">
                      Salvar
                    </button>
                  </form>
                )}

                {ehDono && !s.publicado_em && s.estado === "concluido" && (
                  <form action={publicarServico} className="mt-2">
                    <input type="hidden" name="servico_id" value={s.id} />
                    <button className="h-11 w-full rounded-[var(--raio-controle)] bg-accent text-sm font-semibold text-acao-texto">
                      Publicar para os cotistas
                    </button>
                  </form>
                )}
              </div>
            )
          })}
        </div>
      )}

      {editavel && (
        <>
          <SecaoPagina icone="mais">Abrir serviço</SecaoPagina>
          <form action={abrirServico} className="sombra-1 space-y-3 rounded-[14px] border border-line bg-panel p-4">
            <Campo label="Problema informado" id="problema_informado" name="problema_informado" placeholder="Ex.: vibração acima de 4.000 rpm" />
            <CampoTextarea label="Diagnóstico — opcional" id="diagnostico" name="diagnostico" rows={2} />
            <Campo label="Entrada na oficina" id="entrada_em" name="entrada_em" type="date" className="font-mono-instr" />
            <button className={`${ACAO_NAO_ESTICA} rounded-xl border border-line py-3 text-sm font-semibold`}>
              Abrir serviço
            </button>
          </form>
        </>
      )}

      <SecaoPagina icone="cifrao">Orçamentos</SecaoPagina>
      {orcs.length === 0 ? (
        <EstadoVazio variant="linha" icone="cifrao" titulo="Nenhum orçamento" />
      ) : (
        <div className="space-y-2">
          {orcs.map((o) => {
            const vencido = orcamentoVencido(o.valido_ate, hoje)
            const votacao = votacaoPorOrcamento.get(o.id)
            const apuracao = votacao
              ? apurarVotacao(totalCotistas, votacao.votos.map((v) => v.voto))
              : null
            return (
              <div key={o.id} className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-3.5">
                <div className="flex items-center gap-2">
                  <p className="titulo-card min-w-0 flex-1">{o.servico_proposto}</p>
                  {o.valor_centavos != null && (
                    <span className="shrink-0 font-mono-instr text-sm font-semibold tabular-nums">
                      {formatarReais(o.valor_centavos)}
                    </span>
                  )}
                </div>
                <p className="apoio mt-1 text-dim">
                  {[o.fornecedor, o.pecas].filter(Boolean).join(" · ") || "Sem fornecedor informado"}
                  {o.valido_ate && (
                    <span className={vencido ? "text-crit" : ""}>
                      {" · "}{vencido ? "venceu em " : "vale até "}
                      <span className="font-mono-instr tabular-nums">
                        {o.valido_ate.split("-").reverse().join("/")}
                      </span>
                    </span>
                  )}
                </p>

                {apuracao ? (
                  <div className="mt-3 rounded-[var(--raio-controle)] border border-line bg-panel2 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="rotulo text-dim">Votação</p>
                      <span className="font-mono-instr text-xs font-semibold tabular-nums">{apuracao.rotulo}</span>
                    </div>
                    <p className="apoio mt-1">{ROTULO_SITUACAO_VOTACAO[situacaoDaVotacao(apuracao)]}</p>
                    <p className="apoio mt-1 text-dim">{linhaDaApuracao(apuracao)}</p>
                    {/* O cotista vota daqui. Quem não é cotista vê o placar e
                        não o botão — a policy recusaria de qualquer forma. */}
                    {painel.papel === "COTISTA" && votacao && !votacao.encerrada_em && (
                      <div className="mt-3 flex gap-2">
                        {(["aprovar", "nao_aprovar"] as const).map((v) => (
                          <form key={v} action={votar} className="flex-1">
                            <input type="hidden" name="votacao_id" value={votacao.id} />
                            <input type="hidden" name="voto" value={v} />
                            <button
                              className={`h-11 w-full rounded-[var(--raio-controle)] border text-sm font-medium ${
                                v === "aprovar" ? "border-ok/40 text-ok" : "border-line text-dim"
                              }`}
                            >
                              {v === "aprovar" ? "Aprovar" : "Não aprovar"}
                            </button>
                          </form>
                        ))}
                      </div>
                    )}
                  </div>
                ) : ehDono && !vencido ? (
                  <form action={abrirVotacao} className="mt-3">
                    <input type="hidden" name="orcamento_id" value={o.id} />
                    <button className="h-11 w-full rounded-[var(--raio-controle)] border border-line text-sm font-medium">
                      Abrir votação dos cotistas
                    </button>
                  </form>
                ) : null}
              </div>
            )
          })}
        </div>
      )}

      {editavel && (
        <>
          <SecaoPagina icone="mais">Novo orçamento</SecaoPagina>
          <form action={criarOrcamento} className="sombra-1 space-y-3 rounded-[14px] border border-line bg-panel p-4">
            <Campo label="Serviço proposto" id="servico_proposto" name="servico_proposto" />
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Fornecedor" id="fornecedor" name="fornecedor" />
              <Campo label="Valor (R$)" id="valor" name="valor" inputMode="decimal" className="font-mono-instr tabular-nums" />
            </div>
            <Campo label="Peças" id="pecas" name="pecas" placeholder="Ex.: impeller + wear ring" />
            <Campo label="Válido até" id="valido_ate" name="valido_ate" type="date" className="font-mono-instr" dica="Orçamento vencido não vai a votação." />
            <button className={`${ACAO_NAO_ESTICA} rounded-xl border border-line py-3 text-sm font-semibold`}>
              Salvar orçamento
            </button>
          </form>
        </>
      )}
    </main>
  )
}
