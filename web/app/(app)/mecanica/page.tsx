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
  ROTULO_ESTADO_SERVICO, ROTULO_SITUACAO_VOTACAO, servicoAberto, situacaoDaVotacao,
  tempoNaOficina, tomDoServico,
  type Voto,
} from "@/lib/domain/mecanica"
import {
  podePublicarParaCotistas, type ModoAprovacao, type Papel,
} from "@/lib/domain/enterprise"
import { podeEditar } from "@/lib/domain/permissoes"
import { avisoDeDuplicidade } from "@/lib/domain/financeiro-frota"
import { formatarReais } from "@/lib/domain/gastos"
import { supabaseServer } from "@/lib/supabase/server"
import { ACAO_NAO_ESTICA, TETO_FORMULARIO } from "@/lib/ui/superficies"
import type { Orcamento, ServicoMecanica, Votacao } from "@/lib/db/types"

// ONDA 99 (P2-5) â€” a forma da linha vem de `lib/db/types.ts`, derivada do
// banco vivo. A cÃ³pia que morava aqui declarava 8 das 15 colunas, e a mais
// grave das ausentes era `embarcacao_id`: esta tela filtra por ele em toda
// consulta e o tipo fingia que a coluna nÃ£o existia.
//
// A nota do A15 sobre `entrada_em` foi junto para o tipo promovido â€” "Entrada
// na oficina" era pedida no formulÃ¡rio, gravada por `abrirServico` e ausente
// deste tipo, entÃ£o a data que responde "hÃ¡ quanto tempo esse motor estÃ¡
// parado lÃ¡" ficava sÃ³ no banco. Quem a transforma em resposta Ã©
// `tempoNaOficina`: a coluna Ã© uma data, mas a pergunta Ã© um intervalo.

/*
 * A15, A METADE QUE FICA EM ABERTO DE PROPÃ“SITO â€” E QUEM LER ISTO NÃƒO ESTÃ
 * OLHANDO PARA DADO PERDIDO.
 *
 * `servicos_mecanica.anexo_path` e `orcamentos.anexo_path` existem desde a
 * migration 063 (linhas 64 e 91) e estÃ£o VAZIAS EM 100% DAS LINHAS, porque
 * nenhuma tela pede o arquivo e nenhuma action o grava: nÃ£o hÃ¡ caminho de
 * escrita, em lugar nenhum do app. Isso Ã© diferente do resto do A15 â€” ali o
 * dado era coletado e engolido; aqui ele nunca chegou a existir.
 *
 * NÃƒO Ã‰ PARA "CORRIGIR" ISTO MOSTRANDO A COLUNA. Renderizar um campo que
 * ninguÃ©m preenche nÃ£o devolve anexo nenhum a ninguÃ©m; devolve um rÃ³tulo
 * "Anexo: â€”" em toda linha da tela. O que fecha de verdade Ã© o upload
 * completo â€” seletor de arquivo, validaÃ§Ã£o de MIME, bucket `acervo`, URL
 * assinada na leitura â€”, que Ã© o padrÃ£o jÃ¡ escrito em
 * `lib/acoes/ocorrencias.ts` e `app/(app)/barco/equipamento/[id]`. Ã‰ trabalho
 * de onda prÃ³pria, e foi deixado FORA desta por escolha declarada, nÃ£o por
 * esquecimento.
 *
 * O caso do orÃ§amento Ã© o que mais dÃ³i e Ã© o que justifica a nota: o
 * fornecedor manda o orÃ§amento em PDF, e hoje ele vive no WhatsApp de alguÃ©m.
 * Ã‰ o mesmo defeito que a auditoria de 08/08 jÃ¡ corrigiu no DiÃ¡rio.
 */

/**
 * O custo unitÃ¡rio do item embutido no movimento de estoque.
 *
 * O relacionamento Ã© muitos-para-um, entÃ£o em runtime vem um objeto â€” mas os
 * tipos gerados do PostgREST descrevem toda relaÃ§Ã£o embutida como lista.
 * Aceitar as duas formas aqui Ã© mais barato (e mais seguro) que um
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
 * MECÃ‚NICA (onda 78 â€” PRD Â§7 e Â§9).
 *
 * TrÃªs blocos, na ordem em que a oficina acontece: o que estÃ¡ na bancada, os
 * orÃ§amentos, e as votaÃ§Ãµes abertas.
 *
 * A barreira do Â§7 aparece na tela como o botÃ£o "Publicar para os cotistas",
 * e ele sÃ³ existe para o proprietÃ¡rio â€” mas a trava de verdade estÃ¡ no banco
 * (migration 063): mesmo sem o botÃ£o, um cotista nÃ£o enxerga laudo nÃ£o
 * publicado.
 *
 * ONDA 64 â€” "NA BANCADA" VIROU A PROVA DO `PainelDuplo`. Escolhida entre as
 * seis telas do Enterprise porque jÃ¡ tinha o par lista+detalhe pronto: cada
 * serviÃ§o jÃ¡ era um cartÃ£o com estado, diagnÃ³stico e forma de agir â€” sÃ³
 * faltava a casca de duas colunas pra mostrar lista e detalhe ao mesmo
 * tempo no desktop, em vez de um cartÃ£o gigante embaixo do outro. `?servico`
 * escolhe o item; ver `CartaoServico`/`LinhaServico` embaixo pra como o
 * mesmo cartÃ£o serve tanto o celular (inline, `lg:hidden`) quanto o painel
 * de detalhe (`lg`+) sem duas fontes de verdade pro que um serviÃ§o mostra.
 * OrÃ§amentos e os formulÃ¡rios de abrir serviÃ§o/orÃ§amento ficaram FORA da
 * prova de propÃ³sito â€” o pedido era uma tela como prova, nÃ£o redesenhar a
 * pÃ¡gina inteira.
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
      // A rÃ©gua de confianÃ§a de quem abriu a tela (Â§3) â€” Ã© ela, e nÃ£o o
      // `ehDono` do JSX, que decide quem publica laudo. Ver B6 abaixo.
      supabase.from("vinculos").select("modo_aprovacao")
        .eq("embarcacao_id", painel.embarcacao.id).eq("papel", painel.papel).maybeSingle(),
    ])

  // AUDITORIA 19/08, B6 â€” A TRAVA DO Â§7 SAIU DO JSX.
  //
  // O botÃ£o "Publicar para os cotistas" era gated por `ehDono &&`, e a rÃ©gua
  // que conhece os sete papÃ©is e a exceÃ§Ã£o sem exceÃ§Ã£o do Â§7 ("MecÃ¢nica nunca
  // publica direto, nem com a confianÃ§a no mÃ¡ximo") nÃ£o era chamada por
  // ninguÃ©m. Quem for "ADM" ou "OperaÃ§Ãµes" caÃ­a no `else` por acidente. Sem
  // vÃ­nculo legÃ­vel o padrÃ£o Ã© `tudo`, a rÃ©gua mais apertada â€” falhar fechado
  // Ã© o certo num gesto que fala com dez cotistas de uma vez.
  const publicacao = podePublicarParaCotistas(
    painel.papel as Papel,
    (meuVinculo?.modo_aprovacao as ModoAprovacao | null) ?? "tudo",
  )

  // AUDITORIA 19/08, A1 â€” `motor_componentes` tinha ZERO referÃªncias no app.
  // A tela mora aqui, e nÃ£o na ficha do equipamento, porque a pergunta Ã© da
  // oficina: "que peÃ§as este motor tem, e o que eu peÃ§o no balcÃ£o". Vazia
  // quando o motor da unidade nÃ£o estÃ¡ ligado ao catÃ¡logo â€” que Ã© o caso da
  // maioria, e por isso a seÃ§Ã£o sÃ³ aparece quando hÃ¡ o que mostrar.
  const componentes = await carregarComponentesDoMotor(painel.embarcacao.id)
  const porSistema = SISTEMAS_MOTOR
    .map((s) => ({ sistema: s as SistemaMotor, itens: componentes.filter((c) => c.sistema === s) }))
    .filter((g) => g.itens.length > 0)

  // ONDA 99 (P2-5) â€” `Orcamento` e `Votacao` tambÃ©m saem de `types.ts` agora.
  // A votaÃ§Ã£o continua declarada AQUI, e de propÃ³sito: ela nÃ£o Ã© a linha da
  // tabela, Ã© a linha MAIS o join `votos(voto)` que a consulta acima pede.
  // Isso Ã© projeÃ§Ã£o, nÃ£o duplicata â€” e a diferenÃ§a importa, porque promover
  // uma projeÃ§Ã£o pra `types.ts` faria o arquivo do banco prometer uma coluna
  // que a tabela nÃ£o tem.
  type VotacaoComVotos = Votacao & { votos: { voto: Voto }[] }

  const lista = (servicos ?? []) as ServicoMecanica[]
  const orcs = (orcamentos ?? []) as Orcamento[]
  const vots = (votacoes ?? []) as VotacaoComVotos[]

  // Â§12, a armadilha da duplicidade (A11) â€” quanto jÃ¡ saiu do estoque PARA
  // cada serviÃ§o. Sem este nÃºmero o app nÃ£o tem por que perguntar nada; com
  // ele, a pergunta aparece sÃ³ onde hÃ¡ risco real de contar duas vezes.
  // `["-"]` quando nÃ£o hÃ¡ serviÃ§o: `.in()` com lista vazia devolve tudo no
  // PostgREST, e "tudo" aqui seria a retirada de todas as unidades da conta.
  const { data: retiradas } = await supabase
    .from("estoque_movimentos")
    .select("servico_id, quantidade, estoque_itens(custo_unitario_centavos)")
    .eq("tipo", "retirada")
    .in("servico_id", lista.length > 0 ? lista.map((s) => s.id) : ["-"])
  const pecasPorServico = new Map<string, number>()
  for (const m of (retiradas ?? []) as { servico_id: string | null; quantidade: number }[]) {
    // Item sem custo unitÃ¡rio fica de fora: o nÃºmero Ã© um PISO do que jÃ¡ foi
    // lanÃ§ado, e estimar o resto viraria uma afirmaÃ§Ã£o sobre o que nÃ£o se sabe.
    const unitario = custoUnitarioDoItem(m)
    if (m.servico_id == null || unitario == null) continue
    pecasPorServico.set(
      m.servico_id,
      (pecasPorServico.get(m.servico_id) ?? 0) + Math.round(Number(m.quantidade) * unitario),
    )
  }
  // O total de votantes Ã© o de cotistas ATIVOS â€” suspenso nÃ£o vota (Â§13), e
  // contÃ¡-lo faria a votaÃ§Ã£o nunca fechar em unanimidade.
  const totalCotistas = (cotistas ?? []).length
  const votacaoPorOrcamento = new Map(vots.map((v) => [v.orcamento_id, v]))

  // B10 â€” `servicoAberto` em vez de `s.estado !== "concluido"` reescrito aqui
  // e no cartÃ£o. A rÃ©gua de "aberto" tem dono no domÃ­nio, com teste.
  const abertos = lista.filter((s) => servicoAberto(s.estado))
  // Item escolhido pra o painel de detalhe (`?servico=<id>`). `undefined`
  // quando nÃ£o hÃ¡ query (ninguÃ©m escolheu ainda) ou quando o id nÃ£o bate
  // com nenhum serviÃ§o desta embarcaÃ§Ã£o (item apagado, id de outro barco) â€”
  // os dois casos caem no mesmo estado vazio discreto do `PainelDuplo`.
  const selecionado = lista.find((s) => s.id === servico)

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref="/barco"
        voltarRotulo="Barco"
        titulo="MecÃ¢nica"
        descricao="DiagnÃ³stico, conserto e orÃ§amento â€” o que a oficina estÃ¡ fazendo."
        selo={abertos.length > 0 ? <Selo estado="atencao">{`${abertos.length} em aberto`}</Selo> : undefined}
      />
      {erro && <p className="corpo mt-3 rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      <SecaoPagina icone="ferramenta">Na bancada</SecaoPagina>
      {lista.length === 0 ? (
        <EstadoVazio
          variant="linha"
          icone="ferramenta"
          titulo="Nenhum serviÃ§o registrado"
          descricao={editavel ? "Abra um serviÃ§o abaixo quando algo entrar na oficina." : undefined}
        />
      ) : (
        <PainelDuplo
          vazioIcone="ferramenta"
          vazioTitulo="Selecione um serviÃ§o"
          vazioDescricao="Clique num item da lista para ver o diagnÃ³stico, o conserto e as aÃ§Ãµes."
          lista={
            <div className="space-y-2">
              {lista.map((s) => (
                <LinhaServico
                  key={s.id} s={s} ativo={s.id === servico} publicacao={publicacao}
                  editavel={editavel} pecasCentavos={pecasPorServico.get(s.id) ?? 0} hoje={hoje}
                />
              ))}
            </div>
          }
          detalhe={selecionado && (
            <CartaoServico
              s={selecionado} publicacao={publicacao} editavel={editavel} prefixoId="d"
              pecasCentavos={pecasPorServico.get(selecionado.id) ?? 0} hoje={hoje}
            />
          )}
        />
      )}

      {editavel && (
        <>
          <SecaoPagina icone="mais">Abrir serviÃ§o</SecaoPagina>
          {/* ONDA 64 â€” `TETO_FORMULARIO` (era ausente): sem `<main>` limitando
              a pÃ¡gina inteira (a "Na bancada" precisa da largura de painel
              pro `PainelDuplo`), este formulÃ¡rio esticava atÃ© 1296px de
              conteÃºdo â€” o "linha de leitura de 1300px" que docs/DESIGN.md
              Â§5 aponta como defeito. O teto vai no `<form>`, nÃ£o no `<main>`. */}
          {/* `--raio-cartao` e nÃ£o `--raio-painel`: os 14px cravados aqui e nos
              outros dois painÃ©is desta tela eram o mesmo desenho dos cartÃµes
              de orÃ§amento e dos painÃ©is da bancada, que jÃ¡ vinham por token.
              Promover sÃ³ o que estava Ã  mÃ£o deixaria dois raios no mesmo nÃ­vel
              da mesma tela. Subir a tela inteira estÃ¡ no relatÃ³rio. */}
          <form action={abrirServico} className={`sombra-1 space-y-3 rounded-[var(--raio-cartao)] border border-line bg-panel p-4 ${TETO_FORMULARIO}`}>
            <Campo label="Problema informado" id="problema_informado" name="problema_informado" placeholder="Ex.: vibraÃ§Ã£o acima de 4.000 rpm" />
            <CampoTextarea label="DiagnÃ³stico â€” opcional" id="diagnostico" name="diagnostico" rows={2} />
            <Campo label="Entrada na oficina" id="entrada_em" name="entrada_em" type="date" className="font-mono-instr" />
            {/* Era `rounded-xl` â€” 12px, degrau que a escala nÃ£o tem. BotÃ£o se
                TOCA, entÃ£o `--raio-controle`; menos redondo que o painel de
                propÃ³sito, porque raio maior contÃ©m e raio menor aperta. Vale
                igual pro "Registrar orÃ§amento" mais abaixo. */}
            <button className={`${ACAO_NAO_ESTICA} rounded-[var(--raio-controle)] border border-line py-3 text-sm font-semibold`}>
              Abrir serviÃ§o
            </button>
          </form>
        </>
      )}

      <SecaoPagina icone="cifrao">OrÃ§amentos</SecaoPagina>
      {orcs.length === 0 ? (
        <EstadoVazio variant="linha" icone="cifrao" titulo="Nenhum orÃ§amento" />
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
                  {[o.fornecedor, o.pecas].filter(Boolean).join(" Â· ") || "Sem fornecedor informado"}
                  {o.valido_ate && (
                    <span className={vencido ? "text-crit" : ""}>
                      {" Â· "}{vencido ? "venceu em " : "vale atÃ© "}
                      <span className="font-mono-instr tabular-nums">
                        {o.valido_ate.split("-").reverse().join("/")}
                      </span>
                    </span>
                  )}
                </p>

                {apuracao ? (
                  <div className="mt-3 rounded-[var(--raio-controle)] border border-line bg-panel2 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="rotulo text-dim">VotaÃ§Ã£o</p>
                      <span className="font-mono-instr text-xs font-semibold tabular-nums">{apuracao.rotulo}</span>
                    </div>
                    <p className="apoio mt-1">{ROTULO_SITUACAO_VOTACAO[situacaoDaVotacao(apuracao)]}</p>
                    <p className="apoio mt-1 text-dim">{linhaDaApuracao(apuracao)}</p>
                    {/* O cotista vota daqui. Quem nÃ£o Ã© cotista vÃª o placar e
                        nÃ£o o botÃ£o â€” a policy recusaria de qualquer forma. */}
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
                              {v === "aprovar" ? "Aprovar" : "NÃ£o aprovar"}
                            </button>
                          </form>
                        ))}
                      </div>
                    )}

                    {/* AUDITORIA 19/08, A14 â€” O ESTADO QUE O CÃ“DIGO NUNCA
                        PRODUZIA. A tela jÃ¡ escondia os botÃµes de voto quando
                        `encerrada_em` tivesse valor, e nada no app escrevia
                        essa coluna: a urna ficava aberta para sempre e nunca
                        havia o "apurado, seguimos". A policy da migration 063
                        se chama "votacoes: so o dono encerra" â€” o gesto estava
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
                        <BotaoEnviar variante="contorno" larguraCheia rotulo="Encerrar votaÃ§Ã£o" />
                      </form>
                    ) : null}
                  </div>
                ) : ehDono && !vencido ? (
                  <form action={abrirVotacao} className="mt-3">
                    <input type="hidden" name="orcamento_id" value={o.id} />
                    <BotaoEnviar variante="contorno" larguraCheia rotulo="Abrir votaÃ§Ã£o dos cotistas" />
                  </form>
                ) : null}
              </div>
            )
          })}
        </div>
      )}

      {/* A1 â€” AS PEÃ‡AS DO MOTOR, PELO CATÃLOGO.
          Vem depois dos orÃ§amentos porque Ã© consulta de apoio: quem abre
          /mecanica vem ver o que estÃ¡ na bancada, nÃ£o estudar o motor. */}
      {porSistema.length > 0 && (
        <>
          <SecaoPagina icone="ferramenta">PeÃ§as do motor</SecaoPagina>
          <div className="space-y-3">
            {porSistema.map((g) => (
              <div key={g.sistema} className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
                <p className="rotulo border-b border-line py-3 text-dim">{ROTULO_SISTEMA[g.sistema]}</p>
                {g.itens.map((c) => {
                  // `planoSugerido` devolve `null` quando o componente nÃ£o tem
                  // nenhum intervalo â€” e hoje isso vale para o catÃ¡logo
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
                              {" Â· troca a cada "}
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
                          : <span className="text-dim">sem cÃ³digo no catÃ¡logo</span>}
                      </span>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
          {/* A CONFISSÃƒO QUE ESTA SEÃ‡ÃƒO DEVE. O catÃ¡logo tem os 144
              componentes e nenhum part number nem intervalo preenchido â€” e o
              motivo de ele existir Ã© justamente o cÃ³digo que o balconista
              pede. Dizer isso na tela Ã© o que impede o mecÃ¢nico de concluir
              que o app nÃ£o sabe da peÃ§a (ele sabe: falta o cÃ³digo) e Ã© o que
              coloca o buraco na frente de quem pode preenchÃª-lo. */}
          {componentes.every((c) => c.partNumberOem == null) && (
            <p className="apoio mt-2 text-dim">
              O catÃ¡logo conhece estas peÃ§as mas ainda nÃ£o traz o part number OEM de nenhuma delas.
              Quando vocÃª descobrir o cÃ³digo no balcÃ£o, guarde-o no item de manutenÃ§Ã£o da unidade
              (Barco â€º Motores) â€” lÃ¡ ele fica com a sua unidade e nÃ£o se perde.
            </p>
          )}
        </>
      )}

      {editavel && (
        <>
          <SecaoPagina icone="mais">Novo orÃ§amento</SecaoPagina>
          <form action={criarOrcamento} className={`sombra-1 space-y-3 rounded-[var(--raio-cartao)] border border-line bg-panel p-4 ${TETO_FORMULARIO}`}>
            <Campo label="ServiÃ§o proposto" id="servico_proposto" name="servico_proposto" />
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Fornecedor" id="fornecedor" name="fornecedor" />
              <Campo label="Valor (R$)" id="valor" name="valor" inputMode="decimal" className="font-mono-instr tabular-nums" />
            </div>
            <Campo label="PeÃ§as" id="pecas" name="pecas" placeholder="Ex.: impeller + wear ring" />
            <Campo label="VÃ¡lido atÃ©" id="valido_ate" name="valido_ate" type="date" className="font-mono-instr" dica="OrÃ§amento vencido nÃ£o vai a votaÃ§Ã£o." />
            <button className={`${ACAO_NAO_ESTICA} rounded-[var(--raio-controle)] border border-line py-3 text-sm font-semibold`}>
              Salvar orÃ§amento
            </button>
          </form>
        </>
      )}
    </main>
  )
}

/**
 * A LINHA DA LISTA (ONDA 64) â€” DOIS DESENHOS DO MESMO ITEM, UM SÃ“ ATIVO POR
 * VEZ CONFORME A LARGURA.
 *
 * No celular (`lg:hidden`) Ã© o `CartaoServico` inteiro, idÃªntico ao que a
 * tela sempre mostrou â€” o `PainelDuplo` nÃ£o desenha `detalhe` abaixo de
 * `lg` (ver o comentÃ¡rio do componente), entÃ£o o jeito de continuar
 * editando um serviÃ§o do celular Ã© o cartÃ£o jÃ¡ vir completo na lista, como
 * sempre veio. No desktop (`hidden lg:flex`) Ã© uma linha compacta que sÃ³
 * escolhe â€” o cartÃ£o completo migrou pro painel da direita.
 *
 * Os dois ficam SEMPRE os dois no DOM (sÃ³ a visibilidade muda por CSS): Ã© o
 * que permite ao mesmo componente servir os dois breakpoints sem depender
 * de JavaScript pra saber a largura da tela â€” o Server Component nem TEM
 * como saber isso em tempo de render.
 */
function LinhaServico({
  s, ativo, publicacao, editavel, pecasCentavos, hoje,
}: {
  s: ServicoMecanica
  /** O `id` bate com `?servico=` da URL â€” Ã© o item que o painel da direita mostra. */
  ativo: boolean
  /** A resposta do domÃ­nio pra "esta pessoa publica laudo?" â€” decisÃ£o e
   *  motivo juntos, ver `podePublicarParaCotistas`. */
  publicacao: { pode: boolean; motivo: string | null }
  editavel: boolean
  /** Quanto jÃ¡ saiu do estoque para este serviÃ§o (Â§12, duplicidade). */
  pecasCentavos: number
  /** A data de hoje vem de cima (`hojeISO()`) e nÃ£o de `new Date()` aqui: Ã© o
   *  mesmo dia civil que o resto da tela usa, e um Server Component que lÃª o
   *  relÃ³gio por conta prÃ³pria daria dois "hoje" na mesma pÃ¡gina. */
  hoje: string
}) {
  const tom = tomDoServico(s.estado)
  // A15 â€” o tempo de bancada entra TAMBÃ‰M na linha compacta do desktop, e Ã©
  // aqui que ele mais paga: esta Ã© a lista que o ADM varre atrÃ¡s de "qual
  // unidade estÃ¡ parada hÃ¡ mais tempo", e ler vinte datas para subtrair de
  // cabeÃ§a Ã© exatamente o trabalho que a coluna existia pra poupar.
  const oficina = tempoNaOficina(s.entrada_em, hoje, servicoAberto(s.estado))
  return (
    <>
      <div className="lg:hidden">
        <CartaoServico
          s={s} publicacao={publicacao} editavel={editavel} prefixoId="m"
          pecasCentavos={pecasCentavos} hoje={hoje}
        />
      </div>
      <Link
        href={`/mecanica?servico=${s.id}`}
        aria-current={ativo ? "true" : undefined}
        // Fundo tingido pra marcar o selecionado, nunca dourado: Ã© seleÃ§Ã£o de
        // CONTEÃšDO, nÃ£o navegaÃ§Ã£o (docs/DESIGN.md Â§5, "a regra dos dois") â€” e
        // Ã© o MESMO `bg-panel2` que o trilho lateral jÃ¡ usa pro hover do item
        // que nÃ£o estÃ¡ ativo, entÃ£o a linguagem de "isto Ã© interativo" bate
        // com o resto do app.
        className={`hidden items-center gap-3 rounded-[var(--raio-cartao)] border p-3.5 lg:flex ${
          ativo ? "border-line bg-panel2" : "border-line bg-panel hover:bg-panel2"
        }`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="titulo-card min-w-0 flex-1 truncate">{s.problema_informado ?? "ServiÃ§o"}</p>
            <Selo estado={tom === "fechado" ? "ok" : tom === "parado" ? "atencao" : "neutro"}>
              {ROTULO_ESTADO_SERVICO[s.estado]}
            </Selo>
          </div>
          <p className="apoio mt-1 truncate text-dim">
            {oficina && (
              <>
                <span className={oficina.demorado ? "font-medium text-warn" : undefined}>
                  {oficina.frase}
                </span>
                {" Â· "}
              </>
            )}
            {s.horas != null && (
              <span className="font-mono-instr tabular-nums">{s.horas.toLocaleString("pt-BR")} h Â· </span>
            )}
            {s.publicado_em ? "publicado aos cotistas" : "nÃ£o publicado"}
          </p>
        </div>
        <Icone nome="chevron" className="size-4 shrink-0 text-dim" />
      </Link>
    </>
  )
}

/**
 * O CARTÃƒO COMPLETO â€” a mesma marcaÃ§Ã£o que existia antes desta onda, agora
 * com um dono sÃ³ (era inline no `.map` da lista). Renderiza duas vezes por
 * serviÃ§o quando ele Ã© o selecionado (uma vez escondida no celular via
 * `LinhaServico`, uma vez visÃ­vel no painel de detalhe): `prefixoId`
 * distingue os `id`/`htmlFor` das duas cÃ³pias â€” sem isso as duas trariam
 * `id="estado-<id>"` igual, e o `<label>` do painel de detalhe associaria
 * com o campo ESCONDIDO da lista em vez do campo visÃ­vel ao lado dele.
 */
function CartaoServico({
  s, publicacao, editavel, prefixoId, pecasCentavos, hoje,
}: {
  s: ServicoMecanica
  publicacao: { pode: boolean; motivo: string | null }
  editavel: boolean
  /** "m" (dentro da lista, celular) ou "d" (painel de detalhe, desktop). */
  prefixoId: string
  pecasCentavos: number
  hoje: string
}) {
  const tom = tomDoServico(s.estado)
  // Â§12 (A11) â€” `null` quando nenhuma peÃ§a saiu do estoque para este serviÃ§o:
  // sem duplicidade possÃ­vel, a pergunta seria ruÃ­do.
  const duplicidade = avisoDeDuplicidade(pecasCentavos)
  const oficina = tempoNaOficina(s.entrada_em, hoje, servicoAberto(s.estado))
  return (
    <div
      className={`sombra-1 rounded-[var(--raio-cartao)] border bg-panel p-3.5 ${
        tom === "parado" ? "border-line border-l-2 border-l-warn" : "border-line"
      }`}
    >
      <div className="flex items-center gap-2">
        <p className="titulo-card min-w-0 flex-1">{s.problema_informado ?? "ServiÃ§o"}</p>
        <Selo estado={tom === "fechado" ? "ok" : tom === "parado" ? "atencao" : "neutro"}>
          {ROTULO_ESTADO_SERVICO[s.estado]}
        </Selo>
      </div>
      {s.diagnostico && <p className="apoio mt-1 text-dim">{s.diagnostico}</p>}
      {s.conserto && <p className="apoio mt-1">{s.conserto}</p>}
      <p className="apoio mt-1 text-dim">
        {/* A15 â€” a entrada na oficina, devolvida a quem a digitou COMO
            INTERVALO. A primeira correÃ§Ã£o deste achado escrevia a data crua
            ("entrou em 05/08"), o que fecha o achado pela letra e nÃ£o pelo
            espÃ­rito: o que essa coluna existe pra responder Ã© "hÃ¡ quanto tempo
            esse barco estÃ¡ parado lÃ¡", e uma data solta obriga a subtraÃ§Ã£o de
            cabeÃ§a em toda linha. `tempoNaOficina` decide a frase â€” inclusive a
            de nÃ£o escrever nada quando ninguÃ©m anotou a data, que Ã© o caso da
            maioria (medido: 0 de 2 no banco de hoje). */}
        {oficina && (
          <>
            <span className={oficina.demorado ? "font-medium text-warn" : undefined}>
              {oficina.frase}
            </span>
            {" Â· "}
          </>
        )}
        {s.horas != null && (
          <span className="font-mono-instr tabular-nums">{s.horas.toLocaleString("pt-BR")} h Â· </span>
        )}
        {/* Â§7: o cotista sÃ³ vÃª o que o ADM publicou. A etiqueta diz em que pÃ©
            estÃ¡, pro mecÃ¢nico nÃ£o achar que jÃ¡ foi. */}
        {s.publicado_em ? "publicado aos cotistas" : "nÃ£o publicado"}
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
          {/* Â§12 â€” "Origem â†’ Entrada automÃ¡tica no Financeiro". Era a Ãºnica
              das seis origens que nenhuma action produzia: o serviÃ§o da
              oficina nÃ£o virava custo da unidade, e por isso "MecÃ¢nica" nunca
              aparecia no grÃ¡fico "Em quÃª" de /frota. Opcional: serviÃ§o feito
              em casa nÃ£o tem nota. */}
          <Campo
            label="Valor da oficina (R$) â€” opcional"
            id={`valor-${prefixoId}-${s.id}`}
            name="valor"
            inputMode="decimal"
            className="font-mono-instr tabular-nums"
            dica="SÃ³ entra no Financeiro quando o estado virar ConcluÃ­do."
          />
          {duplicidade && (
            /* A ARMADILHA DA DUPLICIDADE, Â§12 Ãºltima linha. A pergunta e as
               duas respostas vÃªm do domÃ­nio (`avisoDeDuplicidade`) â€” a ordem
               das opÃ§Ãµes importa e estÃ¡ decidida lÃ¡: a primeira Ã© a que evita
               contar duas vezes, e Ã© a mais comum, porque a nota da oficina
               costuma vir com peÃ§a e mÃ£o de obra juntas. */
            <fieldset className="rounded-[var(--raio-controle)] border border-aten/40 bg-panel2 p-3">
              <legend className="rotulo px-1 text-warn">AtenÃ§Ã£o ao custo em dobro</legend>
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
          /* Antes, quem nÃ£o podia publicar simplesmente nÃ£o via botÃ£o nenhum
             e ficava sem entender por que o laudo concluÃ­do nÃ£o chegava aos
             cotistas. O motivo vem do domÃ­nio junto com a recusa: o mecÃ¢nico
             precisa ler que a trava Ã© o Â§7, nÃ£o um defeito. */
          publicacao.motivo && <p className="apoio mt-2 text-dim">{publicacao.motivo}</p>
        )
      )}
    </div>
  )
}
