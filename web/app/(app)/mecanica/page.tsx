import Link from "next/link"
import { redirect } from "next/navigation"
import { Icone } from "@/components/icone"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { Campo, CampoSelect, CampoTextarea } from "@/components/ui/campo"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { PainelDuplo } from "@/components/ui/painel-duplo"
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
import { ACAO_NAO_ESTICA, TETO_FORMULARIO } from "@/lib/ui/superficies"

type Servico = {
  id: string; problema_informado: string | null; diagnostico: string | null
  conserto: string | null; horas: number | null; estado: EstadoServico
  publicado_em: string | null; criado_em: string
}

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
 *
 * ONDA 64 — "NA BANCADA" VIROU A PROVA DO `PainelDuplo`. Escolhida entre as
 * seis telas do Enterprise porque já tinha o par lista+detalhe pronto: cada
 * serviço já era um cartão com estado, diagnóstico e forma de agir — só
 * faltava a casca de duas colunas pra mostrar lista e detalhe ao mesmo
 * tempo no desktop, em vez de um cartão gigante embaixo do outro. `?servico`
 * escolhe o item; ver `CartaoServico`/`LinhaServico` embaixo pra como o
 * mesmo cartão serve tanto o celular (inline, `lg:hidden`) quanto o painel
 * de detalhe (`lg`+) sem duas fontes de verdade pro que um serviço mostra.
 * Orçamentos e os formulários de abrir serviço/orçamento ficaram FORA da
 * prova de propósito — o pedido era uma tela como prova, não redesenhar a
 * página inteira.
 */
export default async function MecanicaPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; servico?: string }>
}) {
  const { erro, servico } = await searchParams
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
  // Item escolhido pra o painel de detalhe (`?servico=<id>`). `undefined`
  // quando não há query (ninguém escolheu ainda) ou quando o id não bate
  // com nenhum serviço desta embarcação (item apagado, id de outro barco) —
  // os dois casos caem no mesmo estado vazio discreto do `PainelDuplo`.
  const selecionado = lista.find((s) => s.id === servico)

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
        <PainelDuplo
          vazioIcone="ferramenta"
          vazioTitulo="Selecione um serviço"
          vazioDescricao="Clique num item da lista para ver o diagnóstico, o conserto e as ações."
          lista={
            <div className="space-y-2">
              {lista.map((s) => (
                <LinhaServico key={s.id} s={s} ativo={s.id === servico} ehDono={ehDono} editavel={editavel} />
              ))}
            </div>
          }
          detalhe={selecionado && (
            <CartaoServico s={selecionado} ehDono={ehDono} editavel={editavel} prefixoId="d" />
          )}
        />
      )}

      {editavel && (
        <>
          <SecaoPagina icone="mais">Abrir serviço</SecaoPagina>
          {/* ONDA 64 — `TETO_FORMULARIO` (era ausente): sem `<main>` limitando
              a página inteira (a "Na bancada" precisa da largura de painel
              pro `PainelDuplo`), este formulário esticava até 1296px de
              conteúdo — o "linha de leitura de 1300px" que docs/DESIGN.md
              §5 aponta como defeito. O teto vai no `<form>`, não no `<main>`. */}
          <form action={abrirServico} className={`sombra-1 space-y-3 rounded-[14px] border border-line bg-panel p-4 ${TETO_FORMULARIO}`}>
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
          <form action={criarOrcamento} className={`sombra-1 space-y-3 rounded-[14px] border border-line bg-panel p-4 ${TETO_FORMULARIO}`}>
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

/**
 * A LINHA DA LISTA (ONDA 64) — DOIS DESENHOS DO MESMO ITEM, UM SÓ ATIVO POR
 * VEZ CONFORME A LARGURA.
 *
 * No celular (`lg:hidden`) é o `CartaoServico` inteiro, idêntico ao que a
 * tela sempre mostrou — o `PainelDuplo` não desenha `detalhe` abaixo de
 * `lg` (ver o comentário do componente), então o jeito de continuar
 * editando um serviço do celular é o cartão já vir completo na lista, como
 * sempre veio. No desktop (`hidden lg:flex`) é uma linha compacta que só
 * escolhe — o cartão completo migrou pro painel da direita.
 *
 * Os dois ficam SEMPRE os dois no DOM (só a visibilidade muda por CSS): é o
 * que permite ao mesmo componente servir os dois breakpoints sem depender
 * de JavaScript pra saber a largura da tela — o Server Component nem TEM
 * como saber isso em tempo de render.
 */
function LinhaServico({
  s, ativo, ehDono, editavel,
}: {
  s: Servico
  /** O `id` bate com `?servico=` da URL — é o item que o painel da direita mostra. */
  ativo: boolean
  ehDono: boolean
  editavel: boolean
}) {
  const tom = tomDoServico(s.estado)
  return (
    <>
      <div className="lg:hidden">
        <CartaoServico s={s} ehDono={ehDono} editavel={editavel} prefixoId="m" />
      </div>
      <Link
        href={`/mecanica?servico=${s.id}`}
        aria-current={ativo ? "true" : undefined}
        // Fundo tingido pra marcar o selecionado, nunca dourado: é seleção de
        // CONTEÚDO, não navegação (docs/DESIGN.md §5, "a regra dos dois") — e
        // é o MESMO `bg-panel2` que o trilho lateral já usa pro hover do item
        // que não está ativo, então a linguagem de "isto é interativo" bate
        // com o resto do app.
        className={`hidden items-center gap-3 rounded-[var(--raio-cartao)] border p-3.5 lg:flex ${
          ativo ? "border-line bg-panel2" : "border-line bg-panel hover:bg-panel2"
        }`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="titulo-card min-w-0 flex-1 truncate">{s.problema_informado ?? "Serviço"}</p>
            <Selo estado={tom === "fechado" ? "ok" : tom === "parado" ? "atencao" : "neutro"}>
              {ROTULO_ESTADO_SERVICO[s.estado]}
            </Selo>
          </div>
          <p className="apoio mt-1 truncate text-dim">
            {s.horas != null && (
              <span className="font-mono-instr tabular-nums">{s.horas.toLocaleString("pt-BR")} h · </span>
            )}
            {s.publicado_em ? "publicado aos cotistas" : "não publicado"}
          </p>
        </div>
        <Icone nome="chevron" className="size-4 shrink-0 text-dim" />
      </Link>
    </>
  )
}

/**
 * O CARTÃO COMPLETO — a mesma marcação que existia antes desta onda, agora
 * com um dono só (era inline no `.map` da lista). Renderiza duas vezes por
 * serviço quando ele é o selecionado (uma vez escondida no celular via
 * `LinhaServico`, uma vez visível no painel de detalhe): `prefixoId`
 * distingue os `id`/`htmlFor` das duas cópias — sem isso as duas trariam
 * `id="estado-<id>"` igual, e o `<label>` do painel de detalhe associaria
 * com o campo ESCONDIDO da lista em vez do campo visível ao lado dele.
 */
function CartaoServico({
  s, ehDono, editavel, prefixoId,
}: {
  s: Servico
  ehDono: boolean
  editavel: boolean
  /** "m" (dentro da lista, celular) ou "d" (painel de detalhe, desktop). */
  prefixoId: string
}) {
  const tom = tomDoServico(s.estado)
  return (
    <div
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
        {/* §7: o cotista só vê o que o ADM publicou. A etiqueta diz em que pé
            está, pro mecânico não achar que já foi. */}
        {s.publicado_em ? "publicado aos cotistas" : "não publicado"}
      </p>

      {editavel && s.estado !== "concluido" && (
        <form action={atualizarServico} className={`mt-3 space-y-2 ${TETO_FORMULARIO}`}>
          <input type="hidden" name="servico_id" value={s.id} />
          <div className="grid grid-cols-2 gap-2">
            <CampoSelect label="Estado" id={`estado-${prefixoId}-${s.id}`} name="estado" defaultValue={s.estado}>
              {ESTADOS_SERVICO.map((e) => (
                <option key={e} value={e}>{ROTULO_ESTADO_SERVICO[e]}</option>
              ))}
            </CampoSelect>
            <Campo
              label="Horas" id={`horas-${prefixoId}-${s.id}`} name="horas" inputMode="decimal"
              className="font-mono-instr tabular-nums"
            />
          </div>
          <Campo
            label="Conserto feito" id={`conserto-${prefixoId}-${s.id}`} name="conserto"
            defaultValue={s.conserto ?? ""}
          />
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
}
