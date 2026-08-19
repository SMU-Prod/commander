import { redirect } from "next/navigation"
import { Confirmar } from "@/components/confirmar"
import { Icone } from "@/components/icone"
import { BotaoEnviar } from "@/components/ui/botao-enviar"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { Campo, CampoTextarea } from "@/components/ui/campo"
import { CampoArquivo } from "@/components/ui/campo-arquivo"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { Selo, type EstadoSelo } from "@/components/ui/selo"
import { decidirMovimentoPatio, registrarRetorno, registrarSaida } from "@/lib/acoes/patio"
import { carregarPainel } from "@/lib/consultas"
import { carregarPatio } from "@/lib/consultas-patio"
import type { MovimentoPatio } from "@/lib/db/types"
import type { Papel } from "@/lib/domain/enterprise"
import {
  COMPONENTES_JET, componentesJetSemPlano, ehJet, estadoDaHomeDePatio,
  linhaDaComparacao, linhaDaDecisao, podeDecidirMovimentoPatio, ROTULO_APROVACAO,
  situacaoDaAprovacao, textoDuracao, duracaoHoras, type SituacaoAprovacao,
} from "@/lib/domain/patio"
import { podeEditar } from "@/lib/domain/permissoes"
import { ROTULO_TIPO_EMBARCACAO } from "@/lib/domain/tipo-embarcacao"
import { ALVO_ACAO, PILULA_ACAO } from "@/lib/ui/acoes"
import { supabaseServer } from "@/lib/supabase/server"

/**
 * AUDITORIA 19/08, A6 — O VESTIDO DE CADA SITUAÇÃO DE CONFERÊNCIA.
 *
 * `direta` não está aqui, e essa ausência é a regra: registro que entrou sem
 * régua de aprovação NÃO ganha selo. Ele não foi conferido nem deixou de ser —
 * ninguém precisava conferir. Pintar isso de qualquer cor seria afirmar um
 * estado que não existe, que é o vício que `lib/domain/patio.ts` combate desde
 * o cabeçalho.
 *
 * `pendente` é `atencao` e não `critico`: movimento esperando o ADM é rotina
 * do modo "tudo exige aprovação", não incidente. O vermelho fica pra recusa,
 * que é a única das quatro em que alguém disse que algo está errado.
 */
const SELO_APROVACAO: Partial<Record<SituacaoAprovacao, EstadoSelo>> = {
  conferida: "ok",
  pendente: "atencao",
  recusada: "critico",
}

function situacaoDe(m: MovimentoPatio): SituacaoAprovacao {
  return situacaoDaAprovacao({
    aprovado: m.aprovado,
    aprovadoPor: m.aprovado_por,
    aprovadoEm: m.aprovado_em,
  })
}

/** A pílula de conferência — `null` quando não há o que afirmar. */
function SeloDaConferencia({ situacao }: { situacao: SituacaoAprovacao }) {
  const estado = SELO_APROVACAO[situacao]
  const rotulo = ROTULO_APROVACAO[situacao]
  if (!estado || !rotulo) return null
  return <Selo estado={estado}>{rotulo}</Selo>
}

/**
 * A HOME DE CAMPO (onda 70b — PRD-UPGRADE-3-COTAS §6).
 *
 * O §6 abre com a régua que desenha esta tela inteira: *"Home de campo deve
 * ser rápida, com botões grandes e poucos passos."* Quem usa isto é o
 * funcionário do pátio, de pé, com a unidade na rampa e o cotista esperando.
 *
 * Daí as três decisões visíveis aqui:
 *
 *   1. A TELA TEM UM ESTADO SÓ POR VEZ. Ou a unidade está fora (e a tela
 *      inteira é o check-in) ou está no pátio (e a tela inteira é o
 *      check-out). Mostrar os dois formulários juntos criaria a chance de
 *      alguém preencher o errado com pressa.
 *
 *   2. NENHUM CAMPO É OBRIGATÓRIO além do gesto. Horas, combustível e estado
 *      entram se a pessoa souber. O que falta vira `null` e a comparação diz
 *      só o que dá pra dizer (`linhaDaComparacao`, com teste).
 *
 *   3. O PROBLEMA NO RETORNO É UMA CAIXA, NÃO UMA DEDUÇÃO. O §6 pede
 *      "transformar imediatamente em avaria" — e quem transforma é a marcação
 *      da pessoa. O app não deduz avaria de queda de combustível: deduzir
 *      abriria avaria fantasma toda vez que alguém navegasse bastante, e o
 *      pátio pararia de confiar no aviso.
 */
export default async function PatioPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  // Movimento de pátio é registro de saída e retorno — mesma natureza do
  // Diário, e é dessa área que ele tira a permissão (migration 060).
  const editavel = podeEditar(painel.permissoes, "diario")
  // A6 — quem confere não é quem registra (§3). A régua mora no domínio, e é
  // ela que decide se esta tela paga a consulta da fila de conferência.
  const podeDecidir = podeDecidirMovimentoPatio(painel.papel as Papel)
  const patio = await carregarPatio(8, podeDecidir)
  if (!patio) redirect("/onboarding")

  const { falhouLeitura, aberto, historico, pendentes, nomePorId } = patio
  const unidade = painel.embarcacao
  const nomeDe = (id: string | null) => (id ? nomePorId.get(id) ?? null : null)
  // AUDITORIA 19/08, B7 — a tela deixou de decidir por `aberto ? … : …`. Com
  // dois estados, a falha de leitura caía no `else` e virava CHECK-OUT: o app
  // convidava a registrar a saída de uma unidade que podia estar na água. A
  // régua tem três estados e mora no domínio, com teste.
  const estado = estadoDaHomeDePatio({
    falhou: falhouLeitura,
    aberto: aberto ? { retornoEm: aberto.retorno_em } : null,
  })

  // AUDITORIA 19/08, A13 — A FICHA QUE FALTAVA PRO JET.
  //
  // `COMPONENTES_JET` estava escrita, testada e sem tela; `ehJet` só trocava
  // uma frase de cabeçalho. O §5 pede impeller, wear ring, intake grate e jet
  // pump; o §1 proíbe tratar o Jet como "lancha apenas reduzida". A consulta
  // só sai quando a unidade é Jet — numa lancha isso seria trabalho jogado
  // fora em toda abertura da tela mais usada do dia.
  const unidadeEhJet = ehJet(painel.embarcacao.tipo)
  const supabase = await supabaseServer()
  let semPlano: string[] = []
  if (unidadeEhJet) {
    const { data: itens } = await supabase.from("itens_monitorados")
      .select("nome").eq("embarcacao_id", painel.embarcacao.id)
    semPlano = componentesJetSemPlano((itens ?? []).map((i: { nome: string }) => i.nome))
  }

  // AUDITORIA 19/08, A6 — as fotos do check-out e do check-in, agora que há
  // escrita que as grava. Uma chamada só para todos os caminhos da tela (a
  // saída aberta e o histórico), no mesmo padrão de `/barco/fotos`: uma
  // assinatura por linha faria oito idas ao storage na tela mais aberta do
  // dia. `createSignedUrls` devolve `signedUrl` vazio no path que não existe
  // mais, e aí o cartão simplesmente não desenha nada.
  const pathsDeFoto = [
    aberto?.saida_foto_path,
    ...historico.flatMap((m) => [m.saida_foto_path, m.retorno_foto_path]),
  ].filter((p): p is string => p != null)
  const urlPorPath = new Map<string, string>()
  if (pathsDeFoto.length > 0) {
    const { data: assinadas } = await supabase.storage.from("acervo")
      .createSignedUrls([...new Set(pathsDeFoto)], 3600)
    for (const a of assinadas ?? []) {
      if (a.signedUrl) urlPorPath.set(a.path ?? "", a.signedUrl)
    }
  }

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref="/hoje"
        voltarRotulo="Início"
        titulo="Pátio"
        descricao={
          unidadeEhJet
            ? "Saída e retorno do Jet — o que saiu, como voltou."
            : "Saída e retorno da unidade — o que saiu, como voltou."
        }
        selo={
          estado === "indisponivel"
            // "Não sei" tem selo próprio, e ele é neutro: pintar de verde
            // ("No pátio") seria afirmar o que a consulta não conseguiu ler.
            ? <Selo estado="neutro">Sem resposta</Selo>
            : estado === "check_in"
              ? <Selo estado="atencao">Fora</Selo>
              : <Selo estado="ok">No pátio</Selo>
        }
      />
      {/* Só `erro` aqui. O `?ok=` é do `Toast` global (components/toast.tsx),
          que toda tela do app já herda do layout — renderizar os dois fazia
          "Saída registrada" aparecer duas vezes na mesma tela (achado na
          prova visual desta onda). */}
      {erro && <p className="corpo mt-3 rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      {/* O cartão da unidade: nome, tipo e horímetro atual. É o que confirma
          pra pessoa do pátio que ela está no barco certo antes de tocar em
          qualquer botão. */}
      <div className="sombra-1 mt-4 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
        <p className="titulo-card">{unidade.nome}</p>
        <p className="apoio mt-0.5 text-dim">
          {unidade.tipo ? ROTULO_TIPO_EMBARCACAO[unidade.tipo] : "Unidade"}
          {aberto?.saida_em && (
            <>
              {" · fora há "}
              <span className="font-mono-instr tabular-nums">
                {textoDuracao(
                  duracaoHoras({ saidaEm: aberto.saida_em, retornoEm: new Date().toISOString() }),
                ) ?? "pouco"}
              </span>
            </>
          )}
        </p>
      </div>

      {estado === "indisponivel" ? (
        /* ---------------------------------------------------------------
           ESTADO 3 — NÃO SEI. A tela não oferece nem check-out nem
           check-in.

           Vem ANTES da permissão de propósito: quem não pode editar também
           não pode receber "está no pátio" como fato quando ninguém leu o
           banco. E a frase diz o que fazer (recarregar) porque falha de
           leitura costuma ser momentânea — sem isso a pessoa fica olhando
           uma tela que só diz "não".
           --------------------------------------------------------------- */
        <EstadoVazio
          icone="alerta"
          titulo="Não consegui ler a movimentação desta unidade"
          descricao="Enquanto eu não souber se ela está fora ou no pátio, não dá pra registrar saída nem retorno — o risco é registrar a saída de uma unidade que já está na água. Recarregue a página em instantes."
          className="mt-4"
        />
      ) : !editavel ? (
        <EstadoVazio
          icone="pessoas"
          titulo="Seu acesso não registra movimentação"
          descricao="Quem registra saída e retorno é quem tem permissão de editar o Diário desta unidade."
          className="mt-4"
        />
      ) : aberto ? (
        /* ---------------------------------------------------------------
           ESTADO 1 — a unidade está fora. A tela inteira é o check-in.
           --------------------------------------------------------------- */
        <>
          <SecaoPagina icone="ancora">Registrar retorno</SecaoPagina>
          <form action={registrarRetorno} className="space-y-4">
            <input type="hidden" name="movimento_id" value={aberto.id} />
            {/* `--raio-cartao` e não `--raio-painel`: este painel guarda o
                sub-bloco "Na saída" em `--raio-controle`, e o par 14/8 já diz
                a profundidade. Subir estes 14 pra 16 seria promoção de tela
                inteira — os cartões de fila mais abaixo teriam de vir junto —
                e isso está no relatório, não aqui pela metade. */}
            <div className="sombra-1 space-y-3 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
              {/* O que foi anotado na saída, à vista: o §6 chama isso de
                  "comparação com check-out", e comparar de cabeça com o
                  formulário aberto é como se erra o horímetro. */}
              <div className="rounded-[var(--raio-controle)] border border-line bg-panel2 p-3">
                {/* A6 — a conferência da SAÍDA aparece pra quem está recebendo
                    o barco. Não é enfeite: se o check-out desta unidade ainda
                    não passou pelo ADM, quem faz o check-in precisa saber que
                    está anotando em cima de um registro que ninguém validou. */}
                <div className="flex items-center gap-2">
                  <p className="rotulo min-w-0 flex-1 text-dim">Na saída</p>
                  <SeloDaConferencia situacao={situacaoDe(aberto)} />
                </div>
                <p className="apoio mt-1">
                  {[
                    aberto.saida_horas != null ? `${aberto.saida_horas.toLocaleString("pt-BR")} h` : null,
                    aberto.saida_combustivel_pct != null ? `${aberto.saida_combustivel_pct}% de combustível` : null,
                    nomeDe(aberto.responsavel_id),
                  ].filter(Boolean).join(" · ") || "Nada anotado além do horário"}
                </p>
                {/* A6 — a foto de como a unidade SAIU, aberta ao lado do
                    formulário de retorno. É exatamente aqui que ela vale:
                    quem está recebendo o barco compara a imagem com o que
                    tem na frente antes de escrever "tudo normal". */}
                {aberto.saida_foto_path && urlPorPath.get(aberto.saida_foto_path) && (
                  /* eslint-disable-next-line @next/next/no-img-element -- URL assinada e temporária do storage */
                  <img
                    src={urlPorPath.get(aberto.saida_foto_path)}
                    alt="Condição da unidade no momento da saída"
                    className="mt-2 h-48 w-full rounded-[var(--raio-controle)] border border-line object-cover"
                    loading="lazy"
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Campo
                  label="Horas na chegada"
                  id="retorno_horas"
                  name="retorno_horas"
                  inputMode="decimal"
                  className="font-mono-instr tabular-nums"
                />
                <Campo
                  label="Combustível (%)"
                  id="retorno_combustivel_pct"
                  name="retorno_combustivel_pct"
                  inputMode="numeric"
                  className="font-mono-instr tabular-nums"
                />
              </div>
              <CampoTextarea
                label="Como voltou"
                id="retorno_estado"
                name="retorno_estado"
                rows={3}
                placeholder="Ex.: tudo normal. Ou: barulho na turbina acima de 4.000 rpm."
              />
              {/* A6 — a foto do retorno. Opcional como todo o resto do §6, e
                  a dica diz o PORQUÊ: é o que decide a conversa sobre avaria
                  quando ela acontecer, semanas depois, com o barco já no
                  berço e ninguém lembrando de nada. */}
              <CampoArquivo
                label="Foto de como voltou — opcional"
                name="retorno_foto"
                accept="image/jpeg,image/png,image/webp"
                ajuda="Fica guardada com este retorno. É a prova dos dois lados numa discussão sobre avaria."
              />

              {/* Ver o cabeçalho, decisão 3: caixa, não dedução. */}
              <label className="flex min-h-11 cursor-pointer items-start gap-2.5 rounded-[var(--raio-controle)] border border-line bg-campo px-3.5 py-2.5">
                <input type="checkbox" name="houve_problema" className="mt-1 size-4 shrink-0 accent-[var(--crit)]" />
                <span className="min-w-0">
                  <span className="corpo block font-medium">Houve problema nesta saída</span>
                  <span className="apoio block text-dim">
                    Abre uma ocorrência com o que você escreveu acima, na hora.
                  </span>
                </span>
              </label>
            </div>
            {/* A6 — `BotaoEnviar` e não `<button>` cru: com a foto no
                formulário, o envio passou a demorar de verdade, e o silêncio
                da tela é o que faz a pessoa tocar de novo. O segundo toque
                aqui grava um retorno em cima do outro. É o caso que o próprio
                componente cita ("upload de foto de ocorrência"). */}
            <BotaoEnviar rotulo="Registrar retorno" />
          </form>
        </>
      ) : (
        /* ---------------------------------------------------------------
           ESTADO 2 — a unidade está no pátio. A tela inteira é o check-out.
           --------------------------------------------------------------- */
        <>
          <SecaoPagina icone="embarcacao">Registrar saída</SecaoPagina>
          <form action={registrarSaida} className="space-y-4">
            <div className="sombra-1 space-y-3 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
              <div className="grid grid-cols-2 gap-3">
                <Campo
                  label="Horas na saída"
                  id="saida_horas"
                  name="saida_horas"
                  inputMode="decimal"
                  className="font-mono-instr tabular-nums"
                />
                <Campo
                  label="Combustível (%)"
                  id="saida_combustivel_pct"
                  name="saida_combustivel_pct"
                  inputMode="numeric"
                  className="font-mono-instr tabular-nums"
                />
              </div>
              <CampoTextarea
                label="Condição antes de sair"
                id="saida_estado"
                name="saida_estado"
                rows={2}
                placeholder="Ex.: casco limpo, sem avaria aparente."
                dica="O horário e o seu nome entram sozinhos."
              />
              {/* A6 — a foto do check-out. O §6 pede as duas pontas, e é a de
                  SAÍDA que protege a marina: sem ela, "já estava riscado
                  quando saiu" não tem como ser mostrado. */}
              <CampoArquivo
                label="Foto de como saiu — opcional"
                name="saida_foto"
                accept="image/jpeg,image/png,image/webp"
                ajuda="Aparece no check-in, ao lado do formulário de retorno."
              />
            </div>
            <BotaoEnviar rotulo="Registrar saída" />
          </form>
        </>
      )}

      {/* ---------------------------------------------------------------
          AUDITORIA 19/08, A6 — A FILA QUE DAVA SENTIDO ÀS TRÊS COLUNAS.

          `movimentos_patio.aprovado/aprovado_por/aprovado_em` existem desde a
          migration 060 e nenhuma tela as mostrava, nenhuma escrita as tocava.
          O efeito prático: o ADM ligava "Tudo exige aprovação" na ficha do
          funcionário em /tripulacao, o app confirmava a mudança, e a
          movimentação de pátio dessa pessoa continuava entrando sem passar por
          ninguém — um controle que existia só na tela onde é configurado.

          A LISTA JUNTA PENDENTE E RECUSADO porque as duas são a mesma
          pergunta ("o que desta unidade não está conferido?"), e porque uma
          recusa que sumisse da tela deixaria o ADM sem memória da própria
          decisão. O selo de cada linha separa as duas, e só a pendente
          oferece botão.

          Vem ANTES do histórico e DEPOIS do gesto do dia: o §6 manda a home de
          campo abrir pelo check-out/check-in. Conferência é trabalho de ADM,
          que não está com o barco na rampa.
          --------------------------------------------------------------- */}
      {podeDecidir && estado !== "indisponivel" && pendentes.length > 0 && (
        <>
          <SecaoPagina icone="alerta">Movimentações a conferir</SecaoPagina>
          <div className="space-y-2">
            {pendentes.map((m) => {
              const situacao = situacaoDe(m)
              const decisao = linhaDaDecisao(nomeDe(m.aprovado_por), situacao, m.aprovado_em)
              const quem = nomeDe(m.responsavel_id)
              return (
                <div key={m.id} className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-3.5">
                  <div className="flex items-center gap-2">
                    <p className="titulo-card min-w-0 flex-1">
                      {new Date(m.saida_em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                      {/* "ainda fora" e não uma data de retorno em branco: o
                          ADM precisa saber que está conferindo meia história. */}
                      {m.retorno_em == null && <span className="apoio text-dim"> · ainda fora</span>}
                    </p>
                    <SeloDaConferencia situacao={situacao} />
                  </div>
                  {quem && <p className="apoio mt-1 text-dim">{quem}</p>}
                  {(() => {
                    const comparacao = linhaDaComparacao({
                      saidaEm: m.saida_em,
                      saidaHoras: m.saida_horas,
                      saidaCombustivelPct: m.saida_combustivel_pct,
                      retornoEm: m.retorno_em,
                      retornoHoras: m.retorno_horas,
                      retornoCombustivelPct: m.retorno_combustivel_pct,
                    })
                    return comparacao
                      ? <p className="apoio mt-1 font-mono-instr text-dim">{comparacao}</p>
                      : null
                  })()}
                  {(m.saida_estado || m.retorno_estado) && (
                    <div className="mt-2 space-y-1 border-t border-line pt-2">
                      {m.saida_estado && (
                        <p className="apoio text-dim"><span className="rotulo">Saiu:</span> {m.saida_estado}</p>
                      )}
                      {m.retorno_estado && (
                        <p className="apoio text-dim"><span className="rotulo">Voltou:</span> {m.retorno_estado}</p>
                      )}
                    </div>
                  )}
                  {decisao ? (
                    <p className="apoio mt-2 text-dim">{decisao}</p>
                  ) : (
                    /* Dois formulários e não um com dois submits: a recusa
                       passa pelo `Confirmar`, que já é um `<button
                       type="submit">` sem `name`/`value` — no mesmo `<form>`
                       as duas decisões chegariam indistinguíveis na action. O
                       `<input hidden>` de cada um resolve sem inventar
                       variante nova do componente. */
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <form action={decidirMovimentoPatio}>
                        <input type="hidden" name="movimento_id" value={m.id} />
                        <input type="hidden" name="decisao" value="aprovar" />
                        <BotaoEnviar rotulo="Conferir" variante="ok" />
                      </form>
                      <form action={decidirMovimentoPatio}>
                        <input type="hidden" name="movimento_id" value={m.id} />
                        <input type="hidden" name="decisao" value="recusar" />
                        {/* Recusa é carimbo que não se desfaz pela tela (a
                            tabela não tem policy de delete, migration 060) —
                            logo, pede confirmação. O vermelho fica no passo da
                            confirmação, que o `Confirmar` já desenha. */}
                        <Confirmar
                          mensagem="Recusar esta movimentação?"
                          rotulo="Recusar"
                          className={ALVO_ACAO}
                        >
                          <span className={PILULA_ACAO}>Recusar</span>
                        </Confirmar>
                      </form>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      <SecaoPagina icone="calendario">Últimas movimentações</SecaoPagina>
      {estado === "indisponivel" ? (
        /* B7, a segunda metade do mesmo defeito: com a leitura falhando, o
           histórico voltava vazio e a tela escrevia "Nenhuma movimentação
           registrada ainda" por cima de um histórico que existe. Lista vazia
           por falha e lista vazia por unidade nova são a mesma imagem e
           afirmações opostas. */
        <EstadoVazio
          variant="linha"
          icone="alerta"
          titulo="Histórico não carregou"
          descricao="Isto não quer dizer que não há movimentação — quer dizer que não consegui ler."
        />
      ) : historico.length === 0 ? (
        <EstadoVazio
          variant="linha"
          icone="calendario"
          titulo="Nenhuma movimentação registrada ainda"
          descricao={editavel ? "A primeira saída registrada abre o histórico desta unidade." : undefined}
        />
      ) : (
        <div className="space-y-2">
          {historico.map((m) => {
            const comparacao = linhaDaComparacao({
              saidaEm: m.saida_em,
              saidaHoras: m.saida_horas,
              saidaCombustivelPct: m.saida_combustivel_pct,
              retornoEm: m.retorno_em,
              retornoHoras: m.retorno_horas,
              retornoCombustivelPct: m.retorno_combustivel_pct,
            })
            const quem = [nomeDe(m.responsavel_id), nomeDe(m.retorno_responsavel_id)]
              .filter(Boolean)
            // Quem tirou pode não ser quem devolveu — quando forem dois, a
            // linha diz os dois; quando for um, não repete o nome.
            const linhaQuem = quem.length === 2 && quem[0] !== quem[1]
              ? `${quem[0]} → ${quem[1]}`
              : quem[0] ?? null

            return (
              <div key={m.id} className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-3.5">
                <div className="flex items-center gap-2">
                  <p className="titulo-card min-w-0 flex-1">
                    {new Date(m.saida_em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                  </p>
                  {m.ocorrencia_id && (
                    <span className="inline-flex shrink-0 items-center gap-1 text-crit">
                      <Icone nome="alerta" className="size-4" />
                      <span className="apoio">ocorrência</span>
                    </span>
                  )}
                  {/* A6 — o histórico passou a dizer o que foi conferido e o
                      que não foi. Sem isto, uma movimentação recusada pelo ADM
                      lia exatamente igual a uma aprovada. */}
                  <SeloDaConferencia situacao={situacaoDe(m)} />
                </div>
                {comparacao && <p className="apoio mt-1 font-mono-instr text-dim">{comparacao}</p>}
                {linhaQuem && <p className="apoio mt-1 text-dim">{linhaQuem}</p>}
                {/* Quem conferiu e quando — a procedência que o §22 pede. Só
                    aparece quando houve ato de gente: registro que entrou
                    direto não ganha frase nenhuma. */}
                {(() => {
                  const decisao = linhaDaDecisao(nomeDe(m.aprovado_por), situacaoDe(m), m.aprovado_em)
                  return decisao ? <p className="apoio mt-1 text-dim">{decisao}</p> : null
                })()}
                {/* AUDITORIA 19/08, B8 — o formulário sempre gravou
                    `saida_estado` e `retorno_estado` e nada os lia. O
                    funcionário anotava "casco limpo, sem avaria aparente" na
                    saída e "barulho na turbina" no retorno, e ninguém nunca
                    reabria. Os dois vêm rotulados e em ordem cronológica: a
                    graça é justamente comparar as duas frases, que é o que o
                    §6 chama de "comparação com check-out". */}
                {(m.saida_estado || m.retorno_estado) && (
                  <div className="mt-2 space-y-1 border-t border-line pt-2">
                    {m.saida_estado && (
                      <p className="apoio text-dim"><span className="rotulo">Saiu:</span> {m.saida_estado}</p>
                    )}
                    {m.retorno_estado && (
                      <p className="apoio text-dim"><span className="rotulo">Voltou:</span> {m.retorno_estado}</p>
                    )}
                  </div>
                )}
                {/* A6 — as duas fotos lado a lado, na ordem em que
                    aconteceram. É a comparação inteira do §6 numa imagem: o
                    que a frase "casco limpo" e a frase "risco na borda" nunca
                    conseguem resolver sozinhas. Uma grade de duas colunas
                    mesmo quando só há uma foto — a coluna vazia diz que a
                    outra ponta não foi fotografada, que é a informação certa. */}
                {(m.saida_foto_path || m.retorno_foto_path) && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {([
                      ["Saiu", m.saida_foto_path],
                      ["Voltou", m.retorno_foto_path],
                    ] as const).map(([rotulo, path]) => {
                      const url = path ? urlPorPath.get(path) : undefined
                      return (
                        <div key={rotulo}>
                          <p className="rotulo text-dim">{rotulo}</p>
                          {url ? (
                            /* eslint-disable-next-line @next/next/no-img-element -- URL assinada e temporária do storage */
                            <img
                              src={url}
                              alt={`Unidade no momento em que ${rotulo === "Saiu" ? "saiu" : "voltou"}`}
                              className="mt-1 h-28 w-full rounded-[var(--raio-controle)] border border-line object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <p className="apoio mt-1 text-dim">Sem foto</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* A13 — §5, "Propulsão Jet: impeller, wear ring, intake grate, jet pump
          e ocorrências". Vem no fim da tela de propósito: o §6 manda a home de
          campo abrir pelo gesto (check-out/check-in), e isto é consulta, não
          ação do momento. Os nomes ficam em inglês — é como a peça é pedida no
          balcão da revenda (ver `COMPONENTES_JET`). */}
      {unidadeEhJet && (
        <>
          <SecaoPagina icone="ferramenta">Propulsão do Jet</SecaoPagina>
          <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
            {COMPONENTES_JET.map((c) => {
              const monitorado = !semPlano.includes(c.slug)
              return (
                <div key={c.slug} className="flex items-center justify-between gap-3 border-b border-line py-3 last:border-0">
                  <span className="min-w-0">
                    <span className="corpo block">{c.nome}</span>
                    <span className="apoio block text-dim">{c.ajuda}</span>
                  </span>
                  {/* "Sem plano" e não "Em atraso": a tela não sabe se a peça
                      precisa de troca — sabe que não existe item monitorado
                      com esse nome nesta unidade. Afirmar mais que isso seria
                      inventar manutenção. */}
                  <Selo estado={monitorado ? "ok" : "neutro"}>
                    {monitorado ? "No plano" : "Sem plano"}
                  </Selo>
                </div>
              )
            })}
          </div>
          {semPlano.length > 0 && (
            <p className="apoio mt-2 text-dim">
              O que está “sem plano” é o que não achei em Motores desta unidade com esse nome — pode
              existir cadastrado de outro jeito. Cadastre em Barco › Motores para o semáforo de
              manutenção passar a acompanhar.
            </p>
          )}
        </>
      )}
    </main>
  )
}
