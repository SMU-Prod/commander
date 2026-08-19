import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { Avatar } from "@/components/avatar"
import { Icone } from "@/components/icone"
import { TrilhaMapa } from "@/components/mapa/trilha-mapa"
import { BloqueioPremium } from "@/components/ui/bloqueio-premium"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { carregarNivelPlano, carregarPainel } from "@/lib/consultas"
import { duracaoHoras, retornoNoDiaSeguinte, textoDuracao } from "@/lib/domain/bordo"
import { ROTULO_HUB_CHECKLIST } from "@/lib/domain/checklist-diario"
import { textoCompartilharSaida } from "@/lib/domain/compartilhar"
import { resumoTrilha } from "@/lib/domain/geo"
import { mensagemBloqueio, recursoLiberado } from "@/lib/domain/plano-acesso"
import { supabaseServer } from "@/lib/supabase/server"
import type { Evento } from "@/lib/db/types"
import { CompartilharBotao } from "./compartilhar-botao"

const instrumento = "rounded-[12px] border border-line bg-panel p-3"
// Onda 87 — era `font-mono-instr text-[11px] uppercase tracking-[.14em]`,
// que é `.rotulo` reescrito à mão com o tracking derivado (.14 contra .16).
const rotuloInstrumento = "rotulo text-dim"
const valorInstrumento = "mt-0.5 font-mono-instr text-lg tabular-nums"

/**
 * A saída como atividade (onda 18, Pilar Strava do Mar) — mapa da trilha,
 * painel de números no estilo instrumento, condições do mar congeladas no
 * registro, tripulação a bordo e compartilhar. Os dados já existiam
 * (migration 022 + `resumoTrilha`); esta tela só apresenta.
 *
 * Rota específica de saída (tipo "navegacao") — não confundir com
 * `/diario/[id]/horas` (sinergia pós-registro, aberta só uma vez via
 * redirect). Outro tipo de evento ou embarcação de outro dono: notFound(),
 * nunca revela nada.
 */
export default async function SaidaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  // Gate do plano Free (onda 38) pra "Compartilhar" — recurso tudo-ou-nada
  // (`recursoLiberado("compartilhar_saida", ...)`, sem contagem). Diferente
  // do Diário/Fotos, aqui NÃO existe uma segunda checagem "no servidor": o
  // botão só dispara a Web Share API do navegador (`compartilhar-botao.tsx`)
  // sem chamar nenhuma action — não há mutação nem rota pra proteger. A
  // decisão deste Server Component É o ponto de aplicação: ele decide se o
  // botão que funciona chega ao cliente, ou se só o cadeado chega.
  const nivel = await carregarNivelPlano()
  const compartilharLiberado = recursoLiberado("compartilhar_saida", nivel)

  const supabase = await supabaseServer()
  const { data: evento } = await supabase.from("eventos").select("*").eq("id", id).maybeSingle()
  const e = evento as Evento | null
  if (!e || e.embarcacao_id !== painel.embarcacao.id || e.tipo !== "navegacao") notFound()

  // Trilha valida so com >= 2 pontos (mesma regra de `resumoTrilha`) — sem
  // isso, nao ha linha pra desenhar nem velocidade pra calcular.
  const trilha = Array.isArray(e.trilha) && e.trilha.length >= 2 ? e.trilha : null
  const r = trilha ? resumoTrilha(trilha) : null

  // Trilha importada do plotter (onda 21) sem horario no GPX original: os
  // pontos gravados tem um `t` sintetico (indice, nao epoch real, ver
  // paraPontosArmazenaveis em lib/domain/gpx.ts) so pra manter a ordem —
  // duracao/tempo em movimento/velocidade calculados em cima disso seriam
  // fabricados. So a distancia continua honesta (nao depende de `t`).
  const semHorario = e.trilha_sem_horario === true
  const rHonesto = semHorario ? null : r

  // Duracao registrada (hora_saida/hora_retorno) manda; so cai pra duracao
  // derivada da trilha se por algum motivo os horarios nao foram gravados —
  // no caminho normal (lib/acoes/trilha.ts) eles sao praticamente iguais.
  // Trilha sem horario nunca cai nesse fallback (ver rHonesto acima).
  const duracaoH = duracaoHoras(e.hora_saida, e.hora_retorno) ?? rHonesto?.duracaoH ?? null

  // Tripulacao a bordo NESTA saida — lista congelada no momento do registro
  // (migration 022). So busca os perfis que de fato aparecem aqui.
  const { data: perfisTripulacao } = e.tripulacao.length > 0
    ? await supabase.from("profiles").select("id, nome, avatar_path").in("id", e.tripulacao)
    : { data: [] as { id: string; nome: string; avatar_path: string | null }[] }
  const tripulantes = e.tripulacao.map((uid) => {
    const p = (perfisTripulacao ?? []).find((pp) => pp.id === uid)
    return { id: uid, nome: p?.nome?.trim() || "Comandante", avatarPath: p?.avatar_path ?? null }
  })
  const urlsTripulacao = new Map(
    await Promise.all(
      tripulantes
        .filter((t): t is typeof t & { avatarPath: string } => t.avatarPath != null)
        .map(async (t) => {
          const { data } = await supabase.storage.from("acervo").createSignedUrl(t.avatarPath, 3600)
          return [t.id, data?.signedUrl ?? null] as const
        }),
    ),
  )

  const temMar = e.mar_onda_m != null || e.mar_vento_kt != null

  // Checklist rápido por hub (onda 40, PRD §23) — quando algum hub virou
  // ocorrência (checkbox "isso é um problema" marcada ao registrar), o link
  // "Ver ocorrência" reconstrói pela mesma dupla evento_id+aba, sem precisar
  // duplicar o id da ocorrência dentro do próprio array `checklist`.
  const checklist = Array.isArray(e.checklist) ? e.checklist : []
  const { data: ocorrenciasDaSaida } = checklist.length > 0
    ? await supabase.from("ocorrencias").select("id, aba").eq("evento_id", id)
    : { data: [] as { id: string; aba: string }[] }

  const texto = textoCompartilharSaida({
    distanciaNm: r?.distanciaNm ?? null,
    duracaoH,
    // O local de saída digitado na hora (onda 41) manda: a marina cadastrada
    // é onde o barco MORA, e essa saída pode ter partido de outro lugar.
    origem: e.local_saida ?? painel.embarcacao.marina,
    destino: e.destino,
  })

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref="/diario"
        voltarRotulo="Diário"
        titulo={
          e.local_saida && e.destino ? `${e.local_saida} → ${e.destino}`
            : e.destino ? `Saída — ${e.destino}`
            : e.local_saida ? `Saída de ${e.local_saida}`
            : "Saída"
        }
        descricao={`${e.data.split("-").reverse().join("/")}${duracaoH != null ? ` · ${textoDuracao(duracaoH)}` : ""}${retornoNoDiaSeguinte(e.hora_saida, e.hora_retorno) ? " · retorno no dia seguinte" : ""}`}
      />
      {/* Badge "importada do plotter" (onda 21) — a saida nao foi gravada ao
          vivo pelo app, e o dono precisa saber disso olhando a tela. */}
      {e.importado_do_plotter && (
        <p className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-line bg-panel px-2 py-0.5 font-mono-instr rotulo-dado text-dim">
          <Icone nome="guardado" className="size-3" /> Importada do plotter
        </p>
      )}
      {e.descricao && <p className="mt-2 corpo text-dim">{e.descricao}</p>}

      <div className="mt-4">
        {trilha ? (
          <TrilhaMapa pontos={trilha} className="h-56 w-full" />
        ) : (
          <EstadoVazio icone="mapa" titulo="Grave a trilha na próxima saída para ver o percurso aqui." />
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className={instrumento}>
          <p className={rotuloInstrumento}>Distância</p>
          <p className={valorInstrumento}>
            {r ? `${r.distanciaNm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MN` : "—"}
          </p>
        </div>
        <div className={instrumento}>
          <p className={rotuloInstrumento}>Duração</p>
          <p className={valorInstrumento}>{duracaoH != null ? textoDuracao(duracaoH) : "—"}</p>
        </div>
        <div className={instrumento}>
          <p className={rotuloInstrumento}>Em movimento</p>
          <p className={valorInstrumento}>{rHonesto ? textoDuracao(rHonesto.tempoMovimentoH) : "—"}</p>
        </div>
        <div className={instrumento}>
          <p className={rotuloInstrumento}>Vel. média</p>
          <p className={valorInstrumento}>
            {rHonesto ? `${rHonesto.velMediaKt.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kt` : "—"}
          </p>
        </div>
        <div className={instrumento}>
          <p className={rotuloInstrumento}>Vel. máxima</p>
          <p className={valorInstrumento}>
            {rHonesto ? `${rHonesto.velMaxKt.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kt` : "—"}
          </p>
        </div>
      </div>

      {semHorario && (
        <p className="mt-3 apoio text-dim">
          Essa trilha foi importada sem horário no arquivo original — duração, tempo em movimento e
          velocidade não puderam ser calculados. A distância continua real.
        </p>
      )}

      {temMar && (
        <div className="mt-4 rounded-[14px] border border-line bg-panel p-4">
          <p className="rotulo text-dim">Condições do mar no momento do registro</p>
          {/* ONDA 87 — altura de onda e vento são leitura de instrumento:
              `.valor` no lugar do `text-sm` solto, e os rótulos colados neles
              passam a ser `.rotulo` de verdade (era 11px com tracking .12em
              escrito à mão — uma cópia do `.rotulo` que derivou). */}
          <div className="mt-1.5 flex gap-4 font-mono-instr valor">
            <span>
              <span className="mr-1.5 rotulo text-dim">Onda</span>
              {e.mar_onda_m != null ? `${e.mar_onda_m.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} m` : "—"}
            </span>
            <span>
              <span className="mr-1.5 rotulo text-dim">Vento</span>
              {e.mar_vento_kt != null ? `${Math.round(e.mar_vento_kt)} kt` : "—"}
            </span>
          </div>
        </div>
      )}

      {checklist.length > 0 && (
        <div>
          <SecaoPagina icone="guardado">Checklist da saída</SecaoPagina>
          <div className="sombra-1 divide-y divide-line rounded-[14px] border border-line bg-panel px-4">
            {checklist.map((item) => {
              const ocorrencia = (ocorrenciasDaSaida ?? []).find((o) => o.aba === item.hub)
              return (
                <div key={item.hub} className="py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="corpo font-medium">{ROTULO_HUB_CHECKLIST[item.hub]}</p>
                    <span className={`apoio font-medium ${item.estado === "ok" ? "text-ok" : "text-warn"}`}>
                      {item.estado === "ok" ? "OK" : "Observação"}
                    </span>
                  </div>
                  {item.nota && <p className="apoio mt-0.5 text-dim">{item.nota}</p>}
                  {ocorrencia && (
                    <Link href={`/barco/ocorrencias/${ocorrencia.id}`} className="apoio mt-1 inline-block text-accent-forte">
                      Ver ocorrência
                    </Link>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {tripulantes.length > 0 && (
        <div>
          <SecaoPagina icone="pessoas">Tripulação da saída</SecaoPagina>
          <div className="flex flex-wrap gap-3">
            {tripulantes.map((t) => (
              <div key={t.id} className="flex items-center gap-2">
                <Avatar url={urlsTripulacao.get(t.id) ?? null} nome={t.nome} tamanho="size-8" />
                <span className="apoio">{t.nome}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Passageiros (onda 41, PRD §23) — seção separada da tripulação de
          propósito: aqui é só nome digitado, sem conta nem avatar. */}
      {e.passageiros.length > 0 && (
        <div>
          <SecaoPagina icone="pessoas">Passageiros</SecaoPagina>
          <p className="corpo text-dim">{e.passageiros.join(" · ")}</p>
        </div>
      )}

      <div className="mt-6">
        {compartilharLiberado ? (
          <CompartilharBotao texto={texto} />
        ) : (
          <BloqueioPremium {...mensagemBloqueio("compartilhar_saida")} />
        )}
      </div>
    </main>
  )
}
