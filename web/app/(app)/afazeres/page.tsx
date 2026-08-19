import { redirect } from "next/navigation"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { Campo, CampoSelect, CampoTextarea } from "@/components/ui/campo"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { Selo } from "@/components/ui/selo"
import { criarAfazer, mudarEstadoAfazer } from "@/lib/acoes/enterprise"
import { carregarPainel } from "@/lib/consultas"
import {
  DESTINOS_AFAZER, podeCriarAfazerProprio, ROTULO_DESTINO_AFAZER, ROTULO_ESTADO_AFAZER,
  type DestinoAfazer, type EstadoAfazer,
} from "@/lib/domain/afazeres"
import { supabaseServer } from "@/lib/supabase/server"
import { ACAO_NAO_ESTICA } from "@/lib/ui/superficies"

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
  const [{ data }, { data: vinculo }] = await Promise.all([
    supabase.from("afazeres").select("*").order("criado_em", { ascending: false }).limit(60),
    supabase.from("vinculos").select("modo_aprovacao")
      .eq("embarcacao_id", painel.embarcacao.id).eq("papel", painel.papel).maybeSingle(),
  ])

  type Afazer = {
    id: string; titulo: string; detalhe: string | null; destino: DestinoAfazer
    prazo: string | null; estado: EstadoAfazer; origem_tipo: string | null
    embarcacao_id: string | null
  }
  const lista = (data ?? []) as Afazer[]
  const abertos = lista.filter((a) => a.estado !== "concluido")
  const feitos = lista.filter((a) => a.estado === "concluido")

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
        {ROTULO_DESTINO_AFAZER[a.destino]}
        {a.embarcacao_id ? ` · ${painel.embarcacao.nome}` : " · da base"}
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
              <button className="h-11 w-full rounded-[var(--raio-controle)] border border-line text-sm font-medium">
                Comecei
              </button>
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
    </div>
  )

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref="/menu"
        voltarRotulo="Menu"
        titulo="Afazeres"
        descricao="O que a equipe combinou de fazer — e quem ficou com o quê."
        selo={abertos.length > 0 ? <Selo estado="atencao">{`${abertos.length} em aberto`}</Selo> : undefined}
      />
      {erro && <p className="corpo mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

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
          <form action={criarAfazer} className="sombra-1 space-y-3 rounded-[14px] border border-line bg-panel p-4">
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
            <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[var(--raio-controle)] border border-line bg-campo px-3.5">
              <input type="checkbox" name="da_unidade" defaultChecked className="size-4 shrink-0 accent-[var(--acao)]" />
              <span className="corpo">É desta unidade ({painel.embarcacao.nome})</span>
            </label>
            <button className={`${ACAO_NAO_ESTICA} rounded-xl border border-line py-3 text-sm font-semibold`}>
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
