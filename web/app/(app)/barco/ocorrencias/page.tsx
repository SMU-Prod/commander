import Link from "next/link"
import { redirect } from "next/navigation"
import { FarolOcorrencia } from "@/components/farol"
import { BarraFerramentas } from "@/components/ui/barra-ferramentas"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { Chip, ChipLinha } from "@/components/ui/chip"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { LinhaLista } from "@/components/ui/linha-lista"
import { Selo, type EstadoSelo } from "@/components/ui/selo"
import { carregarPainel, hojeISO } from "@/lib/consultas"
import {
  ABAS_OCORRENCIA,
  chipsDaAtiva,
  ESTADOS_OCORRENCIA,
  linhaDaAtiva,
  tomDaGravidade,
  type TomGravidade,
  linhaDaFinalizada,
  pesaNaSaude,
  ROTULO_ESTADO,
  ROTULO_GRAVIDADE,
  tituloDasFinalizadas,
  type EstadoOcorrencia,
  type EstadoQuePesaNaSaude,
} from "@/lib/domain/ocorrencias"
import { ROTULO_ABA, type Aba } from "@/lib/domain/permissoes"
import { supabaseServer } from "@/lib/supabase/server"
import type { Ocorrencia } from "@/lib/db/types"

const ESTADO_FILTROS: { valor: EstadoOcorrencia | "tudo"; rotulo: string }[] = [
  { valor: "tudo", rotulo: "Tudo" },
  ...ESTADOS_OCORRENCIA.map((e) => ({ valor: e, rotulo: ROTULO_ESTADO[e] })),
]

// A luz da severidade no cartão de uma ativa (canvas tela-3f): borda lateral
// E selo com a palavra — cor e palavra, nunca só cor (DESIGN §6, regra 3).
//
// ONDA 63 — quem decide a cor passa a ser `tomDaGravidade`, e não
// `farolDaGravidade`: aquela responde "isto pesa na Saúde?" (duas respostas,
// e está certa assim), esta responde "que tom isto tem na tela" (três, uma
// por gravidade). Com a primeira fazendo os dois trabalhos, "Média" e
// "Baixa" saíam no mesmo âmbar — três níveis, duas cores (auditoria 18/08).
const BORDA_GRAVIDADE: Record<TomGravidade, string> = {
  critico: "border-l-2 border-l-crit",
  atencao: "border-l-2 border-l-warn",
  // Baixa não acende: é problema conhecido e anotado, não alarme. A borda
  // fica na linha comum do cartão e a palavra "Baixa" segue no selo.
  neutro: "",
}
const SELO_GRAVIDADE: Record<TomGravidade, EstadoSelo> = {
  critico: "critico",
  atencao: "atencao",
  neutro: "neutro",
}

export default async function OcorrenciasPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; setor?: string; erro?: string; ok?: string }>
}) {
  const { estado: estadoBruto, setor: setorBruto, erro, ok } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")

  const estado = (ESTADOS_OCORRENCIA as readonly string[]).includes(estadoBruto ?? "")
    ? (estadoBruto as EstadoOcorrencia)
    : "tudo"
  const setor = (ABAS_OCORRENCIA as readonly string[]).includes(setorBruto ?? "") ? (setorBruto as Aba) : "tudo"

  const supabase = await supabaseServer()
  let query = supabase.from("ocorrencias").select("*").eq("embarcacao_id", painel.embarcacao.id)
  if (estado !== "tudo") query = query.eq("estado", estado)
  if (setor !== "tudo") query = query.eq("aba", setor)
  const { data, error } = await query.order("created_at", { ascending: false })
  if (error) throw new Error("Não foi possível carregar as ocorrências. Recarregue a página.")
  const ocorrencias = (data ?? []) as Ocorrencia[]

  // Canvas tela-3f: "ativa é cartão com severidade na borda; resolvida volta
  // a ser linha". A régua de quem é "viva" é a MESMA da Saúde (`pesaNaSaude`)
  // — nenhuma lista nova de estados nasce aqui.
  const ativas = ocorrencias.filter(
    (o): o is Ocorrencia & { estado: EstadoQuePesaNaSaude } => pesaNaSaude(o.estado),
  )
  const finalizadas = ocorrencias.filter((o) => !pesaNaSaude(o.estado))

  // O "por Marcos Jordão" da linha de contexto — só das ativas (as linhas
  // finalizadas falam de quem FECHOU, via observação/motivo, não de quem
  // abriu). Autor sem perfil fica de fora da frase (`linhaDaAtiva` omite):
  // nunca um "por Alguém".
  const idsAutores = [...new Set(ativas.map((o) => o.criado_por).filter((v): v is string => v != null))]
  const { data: perfis } = idsAutores.length
    ? await supabase.from("profiles").select("id, nome").in("id", idsAutores)
    : { data: [] as { id: string; nome: string }[] }
  const nomeDe = (userId: string | null) => (perfis ?? []).find((p) => p.id === userId)?.nome || null

  // A nota da linha resolvida ("· troca de impelidor") é a observação escrita
  // na transição PARA resolvida — o dado já existe em `ocorrencias_transicoes`
  // (PRD §7: cada mudança fica registrada), só não era mostrado. A mais
  // recente vale: reaberta e resolvida de novo, a história atual é a última.
  const idsResolvidas = finalizadas.filter((o) => o.estado === "resolvida").map((o) => o.id)
  const { data: fechamentosBrutos } = idsResolvidas.length
    ? await supabase
        .from("ocorrencias_transicoes")
        .select("ocorrencia_id, observacao, created_at")
        .in("ocorrencia_id", idsResolvidas)
        .eq("estado_novo", "resolvida")
        .order("created_at", { ascending: false })
    : { data: [] as { ocorrencia_id: string; observacao: string | null; created_at: string }[] }
  const fechamentoDe = new Map<string, { observacao: string | null; created_at: string }>()
  for (const t of fechamentosBrutos ?? []) {
    if (!fechamentoDe.has(t.ocorrencia_id)) fechamentoDe.set(t.ocorrencia_id, t)
  }

  const hoje = hojeISO()
  const temAnulada = finalizadas.some((o) => o.estado === "anulada")
  const tituloFinalizadas = tituloDasFinalizadas(
    finalizadas.some((o) => o.estado === "resolvida"),
    temAnulada,
  )

  const comFiltro = (novo: Partial<{ estado: string; setor: string }>) => {
    const params = new URLSearchParams()
    const e = novo.estado ?? estado
    const s = novo.setor ?? setor
    if (e !== "tudo") params.set("estado", e)
    if (s !== "tudo") params.set("setor", s)
    const qs = params.toString()
    return qs ? `/barco/ocorrencias?${qs}` : "/barco/ocorrencias"
  }

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref="/barco"
        voltarRotulo="Barco"
        titulo="Ocorrências"
        descricao="O que apareceu de errado e o que já foi resolvido."
      />

      {erro && <p className="mt-3 rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2 corpo">{erro}</p>}
      {ok && <p className="mt-3 rounded-[var(--raio-controle)] border border-ok/40 bg-panel px-3 py-2 corpo">{ok}</p>}

      {/* ONDA 59 — a barra recebe só o filtro PRIMÁRIO (estado), ao lado da
          ação de abrir — o slot `filtros` da barra é UMA linha (regra em
          barra-ferramentas.tsx). O setor é refinamento SECUNDÁRIO dentro do
          estado, então mora fora da barra, numa `ChipLinha` solta logo
          abaixo, com `nivel="secundario"` (contorno, sem preenchimento) —
          por isso não soma ao orçamento de dourados: só a ação "Abrir" e o
          chip de estado ativo (nivel primário, preenchido) contam — 2 no
          total, dentro do limite. O rótulo é o do canvas tela-3f ("+ Abrir"):
          curto, porque o título da tela já diz abrir O QUÊ. */}
      <BarraFerramentas
        className="mt-4"
        filtros={
          <>
            {ESTADO_FILTROS.map((f) => (
              <Chip key={f.valor} href={comFiltro({ estado: f.valor })} ativo={estado === f.valor}>
                {f.rotulo}
              </Chip>
            ))}
          </>
        }
        acao={{ href: "/barco/ocorrencias/nova", rotulo: "Abrir" }}
      />
      <ChipLinha className="mt-2">
        <Chip href={comFiltro({ setor: "tudo" })} ativo={setor === "tudo"} nivel="secundario">
          Todos os setores
        </Chip>
        {ABAS_OCORRENCIA.map((aba) => (
          <Chip key={aba} href={comFiltro({ setor: aba })} ativo={setor === aba} nivel="secundario">
            {ROTULO_ABA[aba]}
          </Chip>
        ))}
      </ChipLinha>

      {ocorrencias.length === 0 && (
        <EstadoVazio
          icone="alerta"
          titulo="Nenhuma ocorrência por aqui"
          descricao="Toque em “Abrir” pra registrar uma, ou aponte um problema num setor ao registrar uma saída no Diário."
          acao={{ href: "/barco/ocorrencias/nova", rotulo: "Abrir ocorrência" }}
          className="mt-6"
        />
      )}

      {/* As VIVAS viram cartão (canvas tela-3f): severidade na borda e no
          selo — a que a pessoa declarou, não o estado —, a linha de contexto
          diz setor, abertura, autor e se alguém já está cuidando, e os chips
          de rodapé só dizem o que existe (anexo, dias em aberto). */}
      {ativas.length > 0 && (
        <div className="mt-4 space-y-2">
          {ativas.map((o) => {
            const luz = tomDaGravidade(o.gravidade)
            return (
              <Link
                key={o.id}
                href={`/barco/ocorrencias/${o.id}`}
                className={`sombra-1 block rounded-[var(--raio-cartao)] border border-line bg-panel p-3.5 ${luz ? BORDA_GRAVIDADE[luz] : ""}`}
              >
                <div className="flex items-center gap-2">
                  <p className="titulo-card min-w-0 flex-1">{o.titulo}</p>
                  {o.gravidade && luz && <Selo estado={SELO_GRAVIDADE[luz]}>{ROTULO_GRAVIDADE[o.gravidade]}</Selo>}
                </div>
                <p className="apoio mt-1 text-dim">
                  {linhaDaAtiva({
                    rotuloAba: ROTULO_ABA[o.aba],
                    aberturaISO: o.created_at,
                    autor: nomeDe(o.criado_por),
                    estado: o.estado,
                  })}
                </p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {chipsDaAtiva(o.anexo_path != null, o.created_at, hoje).map((c) => (
                    /* Onda 93 (achado 5.12) — o `tracking-[.06em]` que estava
                       aqui era resíduo da cópia à mão: `.rotulo-dado` já é a
                       legenda em caixa de frase, e caixa de frase não leva
                       tracking (quem leva é `.rotulo`, que é caixa alta). */
                    <span
                      key={c}
                      className="rounded-[var(--raio-controle)] border border-line px-2 py-1 tabular-nums rotulo-dado text-dim-chip"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* As finalizadas VOLTAM a ser linha (canvas tela-3f): resolvida com
          ponto verde, anulada com o ponto neutro do `FarolOcorrencia` — e a
          distinção dita em palavra no subtítulo, não só na cor. Anuladas
          continuam na lista ("registros finalizados relevantes não são
          apagados silenciosamente", PRD §7). */}
      {finalizadas.length > 0 && (
        <>
          {tituloFinalizadas && <p className="rotulo mt-6 mb-2 text-dim">{tituloFinalizadas}</p>}
          <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
            {finalizadas.map((o) => (
              <LinhaLista
                key={o.id}
                href={`/barco/ocorrencias/${o.id}`}
                leading={<FarolOcorrencia estado={o.estado} />}
                titulo={o.titulo}
                subtitulo={linhaDaFinalizada(
                  o.estado === "anulada"
                    ? { estado: "anulada", quandoISO: o.anulada_em, nota: o.motivo_anulacao }
                    : {
                        estado: "resolvida",
                        quandoISO: o.resolvida_em ?? fechamentoDe.get(o.id)?.created_at ?? null,
                        nota: fechamentoDe.get(o.id)?.observacao ?? null,
                      },
                )}
              />
            ))}
          </div>
          {temAnulada && (
            <p className="apoio mt-2 text-dim">
              Anulada tem ponto neutro, não verde: ninguém consertou nada — o registro é que não valia.
            </p>
          )}
        </>
      )}
    </main>
  )
}
