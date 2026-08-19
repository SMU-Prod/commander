import { redirect } from "next/navigation"
import { BotaoEnviar } from "@/components/ui/botao-enviar"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { Campo, CampoSelect, CampoTextarea } from "@/components/ui/campo"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { Selo } from "@/components/ui/selo"
import { atribuirAfazer, criarAfazer, mudarEstadoAfazer } from "@/lib/acoes/enterprise"
import { carregarPainel } from "@/lib/consultas"
import {
  DESTINOS_AFAZER, podeCriarAfazerProprio, ROTULO_DESTINO_AFAZER, ROTULO_ESTADO_AFAZER,
} from "@/lib/domain/afazeres"
import { supabaseServer } from "@/lib/supabase/server"
import { ACAO_NAO_ESTICA } from "@/lib/ui/superficies"
import type { Afazer } from "@/lib/db/types"

/**
 * AFAZERES (onda 78 — PRD §20).
 *
 * Lista curta e honesta: o que está aberto primeiro, o concluído no fim.
 *
 * O que esta tela NÃO tem, e é o ponto do §20: nenhuma tarefa criada por
 * alerta. Uma frota de 40 unidades produz dezenas de alertas de manutenção
 * por semana — virassem tarefa sozinhos, esta lista abriria com trinta itens
 * que ninguém aceitou fazer, e lista que ninguém confia é lista que ninguém
 * abre. Alerta é aviso; afazer é compromisso.
 */
export default async function AfazeresPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")

  const supabase = await supabaseServer()
  // AUDITORIA 19/08, B2 — A CONSULTA NÃO FILTRAVA E A TELA AFIRMAVA MESMO
  // ASSIM.
  //
  // Era `.select("*")` sem recorte nenhum, e cada cartão escrevia
  // `painel.embarcacao.nome` em qualquer tarefa que tivesse `embarcacao_id`.
  // Para um ADM com mais de uma unidade — que é *o* público desta tela — uma
  // tarefa do Jet 3 aparecia escrita "Jet 1". Número inventado na acepção
  // mais literal: a tela afirmava um fato que não consultou.
  //
  // O recorte é o mesmo das telas vizinhas (/mecanica, /atualizacoes,
  // /patio): a unidade aberta. A diferença é o `is.null`, que precisa entrar
  // junto — tarefa "da base" não pertence a unidade nenhuma e sumiria com um
  // `.eq()` puro, e ela é justamente a que vale para a frota inteira.
  const [{ data }, { data: vinculo }, { data: equipeBruta }] = await Promise.all([
    supabase.from("afazeres").select("*")
      .or(`embarcacao_id.eq.${painel.embarcacao.id},embarcacao_id.is.null`)
      .order("criado_em", { ascending: false }).limit(60),
    supabase.from("vinculos").select("modo_aprovacao")
      .eq("embarcacao_id", painel.embarcacao.id).eq("papel", painel.papel).maybeSingle(),
    // AUDITORIA 19/08, A16 — quem pode receber a tarefa. É a MESMA lista que
    // a policy de INSERT confere (`vinculos` sem `suspenso_em`), lida aqui
    // para o formulário só oferecer o que o banco vai aceitar.
    supabase.from("vinculos").select("usuario_id")
      .eq("embarcacao_id", painel.embarcacao.id).is("suspenso_em", null),
  ])

  // O nome sai do id da própria tarefa, nunca da unidade ativa. Com o filtro
  // acima os dois coincidem hoje; escrever assim é o que impede a mentira de
  // voltar se um dia esta tela passar a listar a frota inteira.
  const nomeDaUnidade = new Map(painel.embarcacoes.map((e) => [e.id, e.nome]))

  // ONDA 99 (P2-5) — a forma da linha sai de `lib/db/types.ts`, derivada do
  // banco vivo. A cópia que morava aqui tipava `origem_tipo` como `string |
  // null`, e com isso o `switch` sobre origem parecia exaustivo sem ser: para
  // o compilador, qualquer texto cabia ali. O tipo do banco fecha a união em
  // "manutencao" | "avaria" | null, e agora um valor novo no `check` reprova
  // no `tsc` em vez de cair silenciosamente no ramo padrão.
  const lista = (data ?? []) as Afazer[]
  const abertos = lista.filter((a) => a.estado !== "concluido")
  const feitos = lista.filter((a) => a.estado === "concluido")

  // Um id por pessoa: a mesma conta pode ter mais de um vínculo na unidade, e
  // o select não pode listar o mesmo nome duas vezes.
  const idsDaEquipe = [...new Set(
    ((equipeBruta ?? []) as { usuario_id: string }[]).map((v) => v.usuario_id),
  )]
  // Os nomes saem numa consulta só, e ela cobre a UNIÃO de dois conjuntos que
  // não coincidem: quem pode receber tarefa HOJE (equipe ativa) e quem já
  // recebeu ALGUMA (responsáveis das tarefas na tela). Quem foi suspenso
  // depois de receber sai do primeiro e continua no segundo — sem a união, o
  // cartão dele passaria a dizer um nome errado ou nenhum.
  const idsParaNome = [...new Set([
    ...idsDaEquipe,
    ...lista.map((a) => a.responsavel_id).filter((id): id is string => id != null),
  ])]
  const { data: perfis } = idsParaNome.length > 0
    ? await supabase.from("profiles").select("id, nome").in("id", idsParaNome)
    : { data: [] as { id: string; nome: string | null }[] }
  // Conta sem nome cadastrado vira "Alguém da equipe" e NÃO some: sumir
  // tiraria da tela uma pessoa que existe e pode receber tarefa. Já a AUSÊNCIA
  // da chave quer dizer outra coisa — a policy de `profiles` só devolve quem
  // divide um vínculo com quem abriu a tela, então id sem linha é gente que
  // saiu da unidade. As duas leituras são diferentes e a tela diz cada uma.
  const nomeDaPessoa = new Map(
    (perfis ?? []).map((p: { id: string; nome: string | null }) =>
      [p.id, p.nome?.trim() || "Alguém da equipe"] as const),
  )
  const equipe = idsDaEquipe.map((id) => ({ id, nome: nomeDaPessoa.get(id) ?? "Alguém da equipe" }))

  /**
   * A16 — AS OPÇÕES DO SELETOR DE "PASSAR PARA".
   *
   * É a equipe ativa MAIS o responsável atual, quando ele já não está nela
   * (foi suspenso depois de receber a tarefa). Sem esse acréscimo o `<select>`
   * abriria com uma pessoa DIFERENTE da que está gravada — o `defaultValue`
   * não casaria com opção nenhuma e o navegador mostraria a primeira da lista.
   * Um controle que exibe um responsável que a tarefa não tem é pior que não
   * existir: quem só quisesse mudar o prazo trocaria o dono sem perceber.
   *
   * O rótulo diz o porquê em vez de esconder: a pessoa continua sendo a
   * responsável de fato, só não pode receber tarefa nova nesta unidade — e é
   * exatamente por isso que o cartão dela precisa de um caminho pra sair.
   */
  const opcoesDeResponsavel = (responsavelId: string | null) => {
    const ativos = equipe.map((p) => ({ id: p.id, nome: p.nome }))
    if (responsavelId != null && !ativos.some((p) => p.id === responsavelId)) {
      return [
        { id: responsavelId, nome: `${nomeDaPessoa.get(responsavelId) ?? "Quem saiu da unidade"} · sem acesso ativo` },
        ...ativos,
      ]
    }
    return ativos
  }

  // §20: "Operações pode criar tarefa própria somente se autorizado" — e a
  // autorização é a mesma régua de confiança do §3, não uma permissão nova.
  const podeCriar = podeCriarAfazerProprio(painel.papel, vinculo?.modo_aprovacao ?? "sem_aprovacao")

  const Cartao = ({ a }: { a: Afazer }) => (
    <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-3.5">
      <div className="flex items-center gap-2">
        <p className={`titulo-card min-w-0 flex-1 ${a.estado === "concluido" ? "text-dim line-through" : ""}`}>
          {a.titulo}
        </p>
        <Selo estado={a.estado === "concluido" ? "ok" : a.estado === "em_andamento" ? "atencao" : "neutro"}>
          {ROTULO_ESTADO_AFAZER[a.estado]}
        </Selo>
      </div>
      {a.detalhe && <p className="apoio mt-1 text-dim">{a.detalhe}</p>}
      <p className="apoio mt-1 text-dim">
        {/* A16 — de quem é. Quando alguém foi escolhido, o NOME substitui o
            destino genérico: "Operações" responde a que time a tarefa
            pertence, "Marcos" responde quem vai fazer — e a segunda pergunta
            é a que a lista precisa responder. Sem responsável, continua o
            destino, que é o que existe. */}
        {a.responsavel_id
          ? nomeDaPessoa.get(a.responsavel_id) ?? "alguém que não está mais na unidade"
          : ROTULO_DESTINO_AFAZER[a.destino]}
        {a.embarcacao_id
          ? ` · ${nomeDaUnidade.get(a.embarcacao_id) ?? "outra unidade"}`
          : " · da base"}
        {a.prazo && (
          <>
            {" · até "}
            <span className="font-mono-instr tabular-nums">{a.prazo.split("-").reverse().join("/")}</span>
          </>
        )}
        {/* Tarefa que veio de avaria ou manutenção diz de onde veio — é o
            que permite voltar pro registro original. */}
        {a.origem_tipo && ` · de ${a.origem_tipo === "avaria" ? "uma avaria" : "uma manutenção"}`}
      </p>

      {a.estado !== "concluido" && (
        <div className="mt-3 flex gap-2">
          {a.estado === "aberto" && (
            <form action={mudarEstadoAfazer} className="flex-1">
              <input type="hidden" name="afazer_id" value={a.id} />
              <input type="hidden" name="estado" value="em_andamento" />
              <BotaoEnviar variante="contorno" larguraCheia rotulo="Comecei" rotuloEnviando="Registrando…" />
            </form>
          )}
          <form action={mudarEstadoAfazer} className="flex-1">
            <input type="hidden" name="afazer_id" value={a.id} />
            <input type="hidden" name="estado" value="concluido" />
            <button className="h-11 w-full rounded-[var(--raio-controle)] border border-ok/40 text-sm font-medium text-ok">
              Concluir
            </button>
          </form>
        </div>
      )}

      {/* A16 — PASSAR A TAREFA ADIANTE.
          Escolher o responsável só na criação resolve o app de demonstração,
          não a vida da equipe: a tarefa nasce "para Operações", o Marcos entra
          de férias, e sem este seletor a única saída seria concluir a tarefa
          que ninguém fez e abrir outra igual — apagando o registro do que foi
          combinado.

          As três condições do `&&`, cada uma fechando uma porta que só
          produziria recusa:
          · concluída não se repassa (não há mais o que fazer);
          · tarefa DA BASE não tem responsável possível — `embarcacao_id` nulo
            faz o `EXISTS` da policy comparar com NULL e nunca casar, e
            `recusaDoResponsavel` explica isso na criação. Oferecer o controle
            aqui seria oferecer um botão que sempre recusa;
          · com uma pessoa só na unidade não há para quem passar — a menos que
            a tarefa já tenha dono, e aí o controle existe pra DESFAZER. */}
      {a.estado !== "concluido" && a.embarcacao_id != null
        && (equipe.length > 1 || a.responsavel_id != null) && (
        <form action={atribuirAfazer} className="mt-3 flex flex-wrap items-end gap-2">
          <input type="hidden" name="afazer_id" value={a.id} />
          <CampoSelect
            label="De quem é"
            id={`responsavel-${a.id}`}
            name="responsavel_id"
            defaultValue={a.responsavel_id ?? ""}
            wrapperClassName="min-w-[11rem] flex-1"
          >
            <option value="">Ninguém</option>
            {opcoesDeResponsavel(a.responsavel_id).map((p) => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </CampoSelect>
          <BotaoEnviar variante="contorno" rotulo="Passar" />
        </form>
      )}
    </div>
  )

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref="/menu"
        voltarRotulo="Menu"
        titulo="Afazeres"
        // A descrição diz o RECORTE, porque ele mudou: quem tem frota e
        // estranhar a lista mais curta precisa saber que ela ficou correta, e
        // não incompleta.
        descricao={`O que a equipe combinou de fazer em ${painel.embarcacao.nome} e na base.`}
        selo={abertos.length > 0 ? <Selo estado="atencao">{`${abertos.length} em aberto`}</Selo> : undefined}
      />
      {erro && <p className="corpo mt-3 rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      <SecaoPagina icone="ferramenta">Em aberto</SecaoPagina>
      {abertos.length === 0 ? (
        <EstadoVazio
          variant="linha"
          icone="ferramenta"
          titulo="Nada em aberto"
          descricao={podeCriar ? "Crie uma tarefa abaixo quando algo precisar ser feito." : undefined}
        />
      ) : (
        <div className="space-y-2">{abertos.map((a) => <Cartao key={a.id} a={a} />)}</div>
      )}

      {podeCriar && (
        <>
          <SecaoPagina icone="mais">Nova tarefa</SecaoPagina>
          {/* `--raio-cartao` e não `--raio-painel`: os 14px cravados aqui eram
              o mesmo desenho dos cartões de tarefa logo acima, que já vinham
              por token. Promover só o que estava à mão deixaria dois raios no
              mesmo nível da mesma tela. Subir a tela está no relatório. */}
          <form action={criarAfazer} className="sombra-1 space-y-3 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
            <Campo label="O que fazer" id="titulo" name="titulo" placeholder="Ex.: lavar o casco antes de sábado" />
            <CampoTextarea label="Detalhe — opcional" id="detalhe" name="detalhe" rows={2} />
            <div className="grid grid-cols-2 gap-3">
              <CampoSelect label="Para quem" id="destino" name="destino">
                {DESTINOS_AFAZER.map((d) => (
                  <option key={d} value={d}>{ROTULO_DESTINO_AFAZER[d]}</option>
                ))}
              </CampoSelect>
              <Campo label="Prazo" id="prazo" name="prazo" type="date" className="font-mono-instr" />
            </div>
            {/* AUDITORIA 19/08, A16 — O SELETOR QUE FALTAVA.
                `responsavel_id` era validado pela policy de INSERT e nenhuma
                tela o enviava; sem ele, a tarefa que o ADM abria "para
                Operações" ficava INVISÍVEL para Operações, porque a policy de
                SELECT enxerga por `dono_id` ou `responsavel_id`.
                Só aparece quando há mais de uma pessoa com vínculo ativo na
                unidade: com uma só, o único destinatário possível é quem está
                criando, e um select de um item é enfeite. */}
            {equipe.length > 1 && (
              <CampoSelect
                label="De quem é — opcional"
                id="responsavel_id"
                name="responsavel_id"
                defaultValue=""
                dica="Quem receber passa a ver a tarefa na lista dele e pode marcar como feita."
              >
                <option value="">Ninguém ainda</option>
                {equipe.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </CampoSelect>
            )}
            <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[var(--raio-controle)] border border-line bg-campo px-3.5">
              <input type="checkbox" name="da_unidade" defaultChecked className="size-4 shrink-0 accent-[var(--acao)]" />
              <span className="corpo">É desta unidade ({painel.embarcacao.nome})</span>
            </label>
            {/* Era `rounded-xl` — 12px, degrau que a escala não tem. Botão se
                TOCA, então `--raio-controle` — e é o mesmo raio da caixa de
                seleção logo acima, que também se toca. */}
            <button className={`${ACAO_NAO_ESTICA} rounded-[var(--raio-controle)] border border-line py-3 text-sm font-semibold`}>
              Criar tarefa
            </button>
          </form>
        </>
      )}

      {feitos.length > 0 && (
        <>
          <SecaoPagina icone="calendario">Concluídas</SecaoPagina>
          <div className="space-y-2">{feitos.slice(0, 10).map((a) => <Cartao key={a.id} a={a} />)}</div>
        </>
      )}
    </main>
  )
}
