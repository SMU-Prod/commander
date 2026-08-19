import Link from "next/link"
import { redirect } from "next/navigation"
import { Icone } from "@/components/icone"
import { BotaoEnviar } from "@/components/ui/botao-enviar"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { Campo, CampoSelect, CampoTextarea } from "@/components/ui/campo"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { PainelDuplo } from "@/components/ui/painel-duplo"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { Selo } from "@/components/ui/selo"
import {
  abrirServico, abrirVotacao, atualizarServico, criarOrcamento, encerrarVotacao,
  publicarServico, votar,
} from "@/lib/acoes/enterprise"
import { carregarPainel, hojeISO } from "@/lib/consultas"
import { carregarComponentesDoMotor } from "@/lib/consultas-catalogo"
import {
  planoSugerido, ROTULO_SISTEMA, SISTEMAS_MOTOR, type SistemaMotor,
} from "@/lib/domain/catalogo-motor"
import {
  apurarVotacao, ESTADOS_SERVICO, linhaDaApuracao, orcamentoVencido,
  ROTULO_ESTADO_SERVICO, ROTULO_SITUACAO_VOTACAO, servicoAberto, situacaoDaVotacao, tomDoServico,
  type EstadoServico, type Voto,
} from "@/lib/domain/mecanica"
import {
  podePublicarParaCotistas, type ModoAprovacao, type Papel,
} from "@/lib/domain/enterprise"
import { podeEditar } from "@/lib/domain/permissoes"
import { avisoDeDuplicidade } from "@/lib/domain/financeiro-frota"
import { formatarReais } from "@/lib/domain/gastos"
import { supabaseServer } from "@/lib/supabase/server"
import { ACAO_NAO_ESTICA, TETO_FORMULARIO } from "@/lib/ui/superficies"

type Servico = {
  id: string; problema_informado: string | null; diagnostico: string | null
  conserto: string | null; horas: number | null; estado: EstadoServico
  publicado_em: string | null; criado_em: string
}

/**
 * O custo unitário do item embutido no movimento de estoque.
 *
 * O relacionamento é muitos-para-um, então em runtime vem um objeto — mas os
 * tipos gerados do PostgREST descrevem toda relação embutida como lista.
 * Aceitar as duas formas aqui é mais barato (e mais seguro) que um
 * `as unknown as` que passaria a mentir no dia em que a consulta mudar.
 */
function custoUnitarioDoItem(linha: unknown): number | null {
  const rel = (linha as { estoque_itens?: unknown }).estoque_itens
  const alvo = Array.isArray(rel) ? rel[0] : rel
  const v = (alvo as { custo_unitario_centavos?: number | null } | null | undefined)
    ?.custo_unitario_centavos
  return v ?? null
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
  const [
    { data: servicos }, { data: orcamentos }, { data: votacoes }, { data: cotistas },
    { data: meuVinculo },
  ] = await Promise.all([
      supabase.from("servicos_mecanica").select("*")
        .eq("embarcacao_id", painel.embarcacao.id).order("criado_em", { ascending: false }).limit(30),
      supabase.from("orcamentos").select("*")
        .eq("embarcacao_id", painel.embarcacao.id).order("criado_em", { ascending: false }).limit(20),
      supabase.from("votacoes").select("*, votos(voto)")
        .eq("embarcacao_id", painel.embarcacao.id).order("aberta_em", { ascending: false }).limit(10),
      supabase.from("vinculos").select("id")
        .eq("embarcacao_id", painel.embarcacao.id).eq("papel", "COTISTA").is("suspenso_em", null),
      // A régua de confiança de quem abriu a tela (§3) — é ela, e não o
      // `ehDono` do JSX, que decide quem publica laudo. Ver B6 abaixo.
      supabase.from("vinculos").select("modo_aprovacao")
        .eq("embarcacao_id", painel.embarcacao.id).eq("papel", painel.papel).maybeSingle(),
    ])

  // AUDITORIA 19/08, B6 — A TRAVA DO §7 SAIU DO JSX.
  //
  // O botão "Publicar para os cotistas" era gated por `ehDono &&`, e a régua
  // que conhece os sete papéis e a exceção sem exceção do §7 ("Mecânica nunca
  // publica direto, nem com a confiança no máximo") não era chamada por
  // ninguém. Quem for "ADM" ou "Operações" caía no `else` por acidente. Sem
  // vínculo legível o padrão é `tudo`, a régua mais apertada — falhar fechado
  // é o certo num gesto que fala com dez cotistas de uma vez.
  const publicacao = podePublicarParaCotistas(
    painel.papel as Papel,
    (meuVinculo?.modo_aprovacao as ModoAprovacao | null) ?? "tudo",
  )

  // AUDITORIA 19/08, A1 — `motor_componentes` tinha ZERO referências no app.
  // A tela mora aqui, e não na ficha do equipamento, porque a pergunta é da
  // oficina: "que peças este motor tem, e o que eu peço no balcão". Vazia
  // quando o motor da unidade não está ligado ao catálogo — que é o caso da
  // maioria, e por isso a seção só aparece quando há o que mostrar.
  const componentes = await carregarComponentesDoMotor(painel.embarcacao.id)
  const porSistema = SISTEMAS_MOTOR
    .map((s) => ({ sistema: s as SistemaMotor, itens: componentes.filter((c) => c.sistema === s) }))
    .filter((g) => g.itens.length > 0)

  type Orcamento = {
    id: string; servico_proposto: string; fornecedor: string | null; pecas: string | null
    valor_centavos: number | null; valido_ate: string | null
  }
  type Votacao = { id: string; orcamento_id: string; encerrada_em: string | null; votos: { voto: Voto }[] }

  const lista = (servicos ?? []) as Servico[]
  const orcs = (orcamentos ?? []) as Orcamento[]
  const vots = (votacoes ?? []) as Votacao[]

  // §12, a armadilha da duplicidade (A11) — quanto já saiu do estoque PARA
  // cada serviço. Sem este número o app não tem por que perguntar nada; com
  // ele, a pergunta aparece só onde há risco real de contar duas vezes.
  // `["-"]` quando não há serviço: `.in()` com lista vazia devolve tudo no
  // PostgREST, e "tudo" aqui seria a retirada de todas as unidades da conta.
  const { data: retiradas } = await supabase
    .from("estoque_movimentos")
    .select("servico_id, quantidade, estoque_itens(custo_unitario_centavos)")
    .eq("tipo", "retirada")
    .in("servico_id", lista.length > 0 ? lista.map((s) => s.id) : ["-"])
  const pecasPorServico = new Map<string, number>()
  for (const m of (retiradas ?? []) as { servico_id: string | null; quantidade: number }[]) {
    // Item sem custo unitário fica de fora: o número é um PISO do que já foi
    // lançado, e estimar o resto viraria uma afirmação sobre o que não se sabe.
    const unitario = custoUnitarioDoItem(m)
    if (m.servico_id == null || unitario == null) continue
    pecasPorServico.set(
      m.servico_id,
      (pecasPorServico.get(m.servico_id) ?? 0) + Math.round(Number(m.quantidade) * unitario),
    )
  }
  // O total de votantes é o de cotistas ATIVOS — suspenso não vota (§13), e
  // contá-lo faria a votação nunca fechar em unanimidade.
  const totalCotistas = (cotistas ?? []).length
  const votacaoPorOrcamento = new Map(vots.map((v) => [v.orcamento_id, v]))

  // B10 — `servicoAberto` em vez de `s.estado !== "concluido"` reescrito aqui
  // e no cartão. A régua de "aberto" tem dono no domínio, com teste.
  const abertos = lista.filter((s) => servicoAberto(s.estado))
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
                <LinhaServico
                  key={s.id} s={s} ativo={s.id === servico} publicacao={publicacao}
                  editavel={editavel} pecasCentavos={pecasPorServico.get(s.id) ?? 0}
                />
              ))}
            </div>
          }
          detalhe={selecionado && (
            <CartaoServico
              s={selecionado} publicacao={publicacao} editavel={editavel} prefixoId="d"
              pecasCentavos={pecasPorServico.get(selecionado.id) ?? 0}
            />
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

                    {/* AUDITORIA 19/08, A14 — O ESTADO QUE O CÓDIGO NUNCA
                        PRODUZIA. A tela já escondia os botões de voto quando
                        `encerrada_em` tivesse valor, e nada no app escrevia
                        essa coluna: a urna ficava aberta para sempre e nunca
                        havia o "apurado, seguimos". A policy da migration 063
                        se chama "votacoes: so o dono encerra" — o gesto estava
                        previsto no banco e faltava a porta. */}
                    {votacao?.encerrada_em ? (
                      <p className="apoio mt-2 text-dim">
                        Apurada em{" "}
                        <span className="font-mono-instr tabular-nums">
                          {new Date(votacao.encerrada_em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                        </span>
                      </p>
                    ) : ehDono && votacao ? (
                      <form action={encerrarVotacao} className="mt-3">
                        <input type="hidden" name="votacao_id" value={votacao.id} />
                        <BotaoEnviar variante="contorno" larguraCheia rotulo="Encerrar votação" />
                      </form>
                    ) : null}
                  </div>
                ) : ehDono && !vencido ? (
                  <form action={abrirVotacao} className="mt-3">
                    <input type="hidden" name="orcamento_id" value={o.id} />
                    <BotaoEnviar variante="contorno" larguraCheia rotulo="Abrir votação dos cotistas" />
                  </form>
                ) : null}
              </div>
            )
          })}
        </div>
      )}

      {/* A1 — AS PEÇAS DO MOTOR, PELO CATÁLOGO.
          Vem depois dos orçamentos porque é consulta de apoio: quem abre
          /mecanica vem ver o que está na bancada, não estudar o motor. */}
      {porSistema.length > 0 && (
        <>
          <SecaoPagina icone="ferramenta">Peças do motor</SecaoPagina>
          <div className="space-y-3">
            {porSistema.map((g) => (
              <div key={g.sistema} className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
                <p className="rotulo border-b border-line py-3 text-dim">{ROTULO_SISTEMA[g.sistema]}</p>
                {g.itens.map((c) => {
                  // `planoSugerido` devolve `null` quando o componente não tem
                  // nenhum intervalo — e hoje isso vale para o catálogo
                  // inteiro. A linha diz isso em vez de desenhar "0 h", que
                  // seria a mentira de sempre com outra roupa.
                  const plano = planoSugerido(c)
                  return (
                    <div key={c.id} className="flex items-start justify-between gap-3 border-b border-line py-3 last:border-0">
                      <span className="min-w-0">
                        <span className="corpo block">{c.nome}</span>
                        <span className="apoio block text-dim">
                          {c.motor}
                          {plano && (
                            <>
                              {" · troca a cada "}
                              <span className="font-mono-instr tabular-nums">
                                {[
                                  plano.intervaloHoras != null ? `${plano.intervaloHoras} h` : null,
                                  plano.intervaloMeses != null ? `${plano.intervaloMeses} meses` : null,
                                ].filter(Boolean).join(" ou ")}
                              </span>
                            </>
                          )}
                        </span>
                      </span>
                      <span className="apoio shrink-0 text-right">
                        {c.partNumberOem
                          ? <span className="font-mono-instr">{c.partNumberOem}</span>
                          : <span className="text-dim">sem código no catálogo</span>}
                      </span>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
          {/* A CONFISSÃO QUE ESTA SEÇÃO DEVE. O catálogo tem os 144
              componentes e nenhum part number nem intervalo preenchido — e o
              motivo de ele existir é justamente o código que o balconista
              pede. Dizer isso na tela é o que impede o mecânico de concluir
              que o app não sabe da peça (ele sabe: falta o código) e é o que
              coloca o buraco na frente de quem pode preenchê-lo. */}
          {componentes.every((c) => c.partNumberOem == null) && (
            <p className="apoio mt-2 text-dim">
              O catálogo conhece estas peças mas ainda não traz o part number OEM de nenhuma delas.
              Quando você descobrir o código no balcão, guarde-o no item de manutenção da unidade
              (Barco › Motores) — lá ele fica com a sua unidade e não se perde.
            </p>
          )}
        </>
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
  s, ativo, publicacao, editavel, pecasCentavos,
}: {
  s: Servico
  /** O `id` bate com `?servico=` da URL — é o item que o painel da direita mostra. */
  ativo: boolean
  /** A resposta do domínio pra "esta pessoa publica laudo?" — decisão e
   *  motivo juntos, ver `podePublicarParaCotistas`. */
  publicacao: { pode: boolean; motivo: string | null }
  editavel: boolean
  /** Quanto já saiu do estoque para este serviço (§12, duplicidade). */
  pecasCentavos: number
}) {
  const tom = tomDoServico(s.estado)
  return (
    <>
      <div className="lg:hidden">
        <CartaoServico s={s} publicacao={publicacao} editavel={editavel} prefixoId="m" pecasCentavos={pecasCentavos} />
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
  s, publicacao, editavel, prefixoId, pecasCentavos,
}: {
  s: Servico
  publicacao: { pode: boolean; motivo: string | null }
  editavel: boolean
  /** "m" (dentro da lista, celular) ou "d" (painel de detalhe, desktop). */
  prefixoId: string
  pecasCentavos: number
}) {
  const tom = tomDoServico(s.estado)
  // §12 (A11) — `null` quando nenhuma peça saiu do estoque para este serviço:
  // sem duplicidade possível, a pergunta seria ruído.
  const duplicidade = avisoDeDuplicidade(pecasCentavos)
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

      {editavel && servicoAberto(s.estado) && (
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
          {/* §12 — "Origem → Entrada automática no Financeiro". Era a única
              das seis origens que nenhuma action produzia: o serviço da
              oficina não virava custo da unidade, e por isso "Mecânica" nunca
              aparecia no gráfico "Em quê" de /frota. Opcional: serviço feito
              em casa não tem nota. */}
          <Campo
            label="Valor da oficina (R$) — opcional"
            id={`valor-${prefixoId}-${s.id}`}
            name="valor"
            inputMode="decimal"
            className="font-mono-instr tabular-nums"
            dica="Só entra no Financeiro quando o estado virar Concluído."
          />
          {duplicidade && (
            /* A ARMADILHA DA DUPLICIDADE, §12 última linha. A pergunta e as
               duas respostas vêm do domínio (`avisoDeDuplicidade`) — a ordem
               das opções importa e está decidida lá: a primeira é a que evita
               contar duas vezes, e é a mais comum, porque a nota da oficina
               costuma vir com peça e mão de obra juntas. */
            <fieldset className="rounded-[var(--raio-controle)] border border-aten/40 bg-panel2 p-3">
              <legend className="rotulo px-1 text-warn">Atenção ao custo em dobro</legend>
              <p className="apoio">{duplicidade.pergunta}</p>
              <div className="mt-2 space-y-1.5">
                {duplicidade.opcoes.map((rotulo, i) => (
                  <label key={rotulo} className="flex min-h-11 cursor-pointer items-center gap-2.5">
                    <input
                      type="radio"
                      name="ja_inclui"
                      value={i === 0 ? "1" : "0"}
                      defaultChecked={i === 0}
                      className="size-4 shrink-0 accent-[var(--acento)]"
                    />
                    <span className="corpo">{rotulo}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <BotaoEnviar variante="contorno" larguraCheia rotulo="Salvar" />
        </form>
      )}

      {!s.publicado_em && !servicoAberto(s.estado) && (
        publicacao.pode ? (
          <form action={publicarServico} className="mt-2">
            <input type="hidden" name="servico_id" value={s.id} />
            <button className="h-11 w-full rounded-[var(--raio-controle)] bg-accent text-sm font-semibold text-acao-texto">
              Publicar para os cotistas
            </button>
          </form>
        ) : (
          /* Antes, quem não podia publicar simplesmente não via botão nenhum
             e ficava sem entender por que o laudo concluído não chegava aos
             cotistas. O motivo vem do domínio junto com a recusa: o mecânico
             precisa ler que a trava é o §7, não um defeito. */
          publicacao.motivo && <p className="apoio mt-2 text-dim">{publicacao.motivo}</p>
        )
      )}
    </div>
  )
}
