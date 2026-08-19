import { notFound, redirect } from "next/navigation"
import { BotaoFicha } from "@/components/ui/botao-ficha"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { CampoTextarea } from "@/components/ui/campo"
import { FaixaKpi, PastilhaKpi } from "@/components/ui/faixa-kpi"
import { MigalhaPao } from "@/components/ui/migalha-pao"
import { Selo } from "@/components/ui/selo"
import { transicionarOcorrencia } from "@/lib/acoes/ocorrencias"
import { carregarPainel } from "@/lib/consultas"
import { formatarCarimbo } from "@/lib/domain/datas"
import {
  faroDoEstado, ROTULO_ESTADO, ROTULO_GRAVIDADE, transicoesPossiveis,
  type EstadoOcorrencia, type Gravidade,
} from "@/lib/domain/ocorrencias"
import { podeEditar, ROTULO_ABA } from "@/lib/domain/permissoes"
import { seloDoFarol } from "@/lib/domain/semaforo"
import { supabaseServer } from "@/lib/supabase/server"
import type { Ocorrencia, OcorrenciaTransicao } from "@/lib/db/types"

/** Rótulo do botão de transição — verbo de ação, não o nome do estado
 *  (glossário: a voz do app pede "o que fazer", não só um rótulo neutro).
 *  "Anular" leva o motivo junto no rótulo porque é a única ação aqui que
 *  exige texto escrito — o botão precisa avisar antes do erro. */
const ROTULO_ACAO: Record<EstadoOcorrencia, string> = {
  aberta: "Reabrir",
  em_acompanhamento: "Marcar em acompanhamento",
  resolvida: "Marcar como resolvida",
  anulada: "Anular — foi engano",
}

export default async function OcorrenciaDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ erro?: string; ok?: string }>
}) {
  const { id } = await params
  const { erro, ok } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")

  const supabase = await supabaseServer()
  const [{ data: ocorrenciaBruta }, { data: transicoesBrutas }] = await Promise.all([
    supabase.from("ocorrencias").select("*").eq("id", id).maybeSingle(),
    supabase.from("ocorrencias_transicoes").select("*").eq("ocorrencia_id", id).order("created_at", { ascending: false }),
  ])
  const o = ocorrenciaBruta as Ocorrencia | null
  if (!o || o.embarcacao_id !== painel.embarcacao.id) notFound()
  const transicoes = (transicoesBrutas ?? []) as OcorrenciaTransicao[]

  // `anulada_por` entra na lista mesmo já costumando estar entre os autores
  // das transições: se um dia a anulação vier de outro caminho, o nome de
  // quem anulou não pode virar "Alguém" — é o registro que o PRD §7 exige.
  const idsPessoas = [
    ...new Set(
      [o.criado_por, o.anulada_por, ...transicoes.map((t) => t.criado_por)].filter((v): v is string => v != null),
    ),
  ]
  const { data: perfis } = idsPessoas.length
    ? await supabase.from("profiles").select("id, nome").in("id", idsPessoas)
    : { data: [] as { id: string; nome: string }[] }
  const nomeDe = (userId: string | null) => (perfis ?? []).find((p) => p.id === userId)?.nome || "Alguém"

  const urlAnexo = o.anexo_path
    ? (await supabase.storage.from("acervo").createSignedUrl(o.anexo_path, 3600)).data?.signedUrl ?? null
    : null

  const editavel = podeEditar(painel.permissoes, o.aba)
  const acoes = transicoesPossiveis(o.estado)
  const anulada = o.estado === "anulada"
  const podeAnular = acoes.includes("anulada")

  return (
    <main>
      {/* ONDA 92 (eixo 2.2) — a anatomia da ficha de equipamento chega à
          ocorrência: migalha, faixa de KPI e barra de ações. */}
      <MigalhaPao
        itens={[
          { rotulo: "Barco", href: "/barco" },
          { rotulo: "Ocorrências", href: "/barco/ocorrencias" },
          { rotulo: o.titulo },
        ]}
      />

      {/* Gravidade só entra quando ALGUÉM A DECLAROU. Sem gravidade registrada
          não existe pastilha — nem "—" nem "Baixa" por omissão: é a mesma
          régua de `tomDaGravidade` ("dado ausente nunca vira mais alarme, e
          nem menos") aplicada à moldura. Estado não vira pastilha porque já é
          o selo colado ao título; dizer duas vezes é o que a barra de ações da
          ficha de equipamento evita. */}
      <FaixaKpi className="mt-2">
        <PastilhaKpi icone="escudo" rotulo="Setor" valor={ROTULO_ABA[o.aba]} />
        {o.gravidade && (
          <PastilhaKpi icone="alerta" rotulo="Gravidade" valor={ROTULO_GRAVIDADE[o.gravidade as Gravidade]} />
        )}
        <PastilhaKpi icone="repetir" rotulo="Mudanças" valor={String(transicoes.length)} />
      </FaixaKpi>

      <CabecalhoDetalhe
        className="mt-3"
        voltarHref="/barco/ocorrencias"
        voltarRotulo="Ocorrências"
        titulo={o.titulo}
        // O selo é a composição de duas réguas que JÁ existem no domínio —
        // `faroDoEstado` (que devolve null pra "anulada", porque anulada não
        // tem farol) e `seloDoFarol` (null → "neutro"). Nenhuma regra nova
        // nasceu aqui, e é por isso que a decisão continua testável onde ela
        // mora.
        selo={<Selo estado={seloDoFarol(faroDoEstado(o.estado))}>{ROTULO_ESTADO[o.estado]}</Selo>}
        descricao={`Aberta por ${nomeDe(o.criado_por)} em ${formatarCarimbo(o.created_at)}${o.evento_id ? " · a partir de uma saída do Diário" : ""}`}
        // Onda 42 (PRD FINAL §9.1: "Hubs onde fizer sentido mostram 'Adicionar
        // ao Financeiro'"). Ocorrência é o hub mais natural pra isso — o PRD
        // §7 já diz que ela "pode gerar manutenção/reparo, custo e resolução".
        // É um ATALHO com a descrição pronta, não um lançamento automático: o
        // PRD proíbe que orçamento vire despesa, e um reparo aberto ainda pode
        // nem ter preço fechado. Quem confirma o valor é a pessoa, no
        // formulário.
        // ONDA 92 — era um bloco de contorno de largura inteira no meio do
        // corpo, um dos seis vestidos à mão que a auditoria mediu (5.2). Vira
        // `BotaoFicha` de contorno na barra de ações, que é onde a referência
        // põe a ação de nível "ficha". Sem `preenchido`: a ação principal
        // desta tela é mudar o estado da ocorrência, e ela mora no formulário
        // logo abaixo.
        acoes={
          podeEditar(painel.permissoes, "gastos") ? (
            <BotaoFicha icone="cifrao" href={`/financeiro/novo?tipo=despesa&descricao=${encodeURIComponent(o.titulo)}`}>
              Adicionar ao Financeiro
            </BotaoFicha>
          ) : undefined
        }
      />
      {erro && <p className="mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 text-sm">{erro}</p>}
      {ok && <p className="mt-3 rounded-lg border border-ok/40 bg-panel px-3 py-2 text-sm">{ok}</p>}

      {/* Anulada COM REGISTRO (PRD §7) — o motivo, quem escreveu e quando
          ficam em destaque no topo, antes da descrição original: quem abre
          essa tela precisa saber que o que vem abaixo não vale mais, e por
          quê, sem caçar no histórico de mudanças. */}
      {anulada && (
        <div className="mt-4 rounded-[14px] border border-line bg-panel2 p-4">
          <p className="titulo-card">Ocorrência anulada</p>
          <p className="corpo mt-1">{o.motivo_anulacao}</p>
          <p className="apoio mt-2 text-dim">
            Anulada por {nomeDe(o.anulada_por)}
            {o.anulada_em && ` em ${formatarCarimbo(o.anulada_em)}`} · o registro continua no histórico, nada foi apagado.
          </p>
        </div>
      )}

      {o.descricao && <p className={`corpo mt-4 ${anulada ? "text-dim" : ""}`}>{o.descricao}</p>}
      {urlAnexo && (
        <a href={urlAnexo} target="_blank" rel="noopener noreferrer" className="apoio mt-2 inline-block text-accent-forte">
          Abrir anexo
        </a>
      )}
      {editavel && acoes.length > 0 && (
        <form action={transicionarOcorrencia} className="sombra-1 mt-5 space-y-3 rounded-[14px] border border-line bg-panel p-4">
          <input type="hidden" name="ocorrencia_id" value={o.id} />
          {/* Uma caixa só pros dois usos: observação livre nas transições
              normais e MOTIVO obrigatório ao anular (o servidor recusa a
              anulação sem texto — `validarMotivoAnulacao`). O rótulo muda de
              acordo com o que a pessoa pode fazer daqui, pra ninguém
              descobrir a obrigatoriedade só depois de tomar o erro. */}
          <CampoTextarea
            label={podeAnular ? "Observação — obrigatória para anular" : "Observação — opcional"}
            id="observacao"
            name="observacao"
            rows={2}
          />
          <div className="flex flex-wrap gap-2">
            {acoes.map((estado) => (
              <button
                key={estado}
                type="submit"
                name="novo_estado"
                value={estado}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${
                  estado === "resolvida"
                    ? "bg-accent text-acao-texto"
                    : estado === "anulada"
                      ? "border border-line text-dim"
                      : "border border-line text-texto"
                }`}
              >
                {ROTULO_ACAO[estado]}
              </button>
            ))}
          </div>
          {podeAnular && (
            <p className="apoio text-dim">
              Anular é pra ocorrência criada por engano. Ela não é apagada: fica no histórico com o motivo,
              seu nome e a data — e para de pesar na Saúde da embarcação.
            </p>
          )}
        </form>
      )}

      <p className="rotulo text-dim mt-6 mb-2">Histórico de mudanças</p>
      <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
        {transicoes.map((t) => (
          <div key={t.id} className="border-b border-line py-3 last:border-0">
            <p className="titulo-card">
              {t.estado_anterior ? `${ROTULO_ESTADO[t.estado_anterior]} → ${ROTULO_ESTADO[t.estado_novo]}` : `Aberta como ${ROTULO_ESTADO[t.estado_novo]}`}
            </p>
            <p className="apoio mt-0.5 text-dim">{nomeDe(t.criado_por)} · {formatarCarimbo(t.created_at)}</p>
            {t.observacao && <p className="corpo mt-1">{t.observacao}</p>}
          </div>
        ))}
      </div>
    </main>
  )
}
