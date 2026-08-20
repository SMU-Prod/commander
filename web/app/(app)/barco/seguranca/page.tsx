import Link from "next/link"
import { redirect } from "next/navigation"
import { Farol, FarolOcorrencia } from "@/components/farol"
import { Icone } from "@/components/icone"
import { Abas } from "@/components/ui/abas"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { LinhaLista } from "@/components/ui/linha-lista"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { HeroiTecnico } from "@/components/ui/heroi-tecnico"
import { AcaoDoHub, NumerosDoHub } from "@/components/ui/numeros-do-hub"
import { carregarPainel, hojeISO, itemMonitoradoToItemCalc } from "@/lib/consultas"
import { CATEGORIA_SEGURANCA } from "@/lib/domain/diario"
import { ESTADOS_QUE_PESAM_NA_SAUDE, ROTULO_ESTADO } from "@/lib/domain/ocorrencias"
import { podeEditar, podeVer } from "@/lib/domain/permissoes"
import { calcularSemaforo, formatarDataCurta, vencimentoPorData } from "@/lib/domain/semaforo"
import { supabaseServer } from "@/lib/supabase/server"
import type { Ocorrencia } from "@/lib/db/types"

/**
 * ONDA 135 — AS ABAS DO PILOTO (`/barco/motores`, onda 128) NESTE HUB.
 * Quatro abas, todas com dado real: Visão geral (trinca + ação + ocorrências
 * abertas), Itens (a lista completa, que antes dividia a tela com tudo),
 * Validades (o recorte dos itens COM data — `vencimentoPorData` já existe e
 * é a mesma régua do farol, então a aba abre com dado de verdade, ordenada
 * pelo que vence primeiro) e Alertas (o que o semáforo acusa). Não há aba de
 * histórico: item de segurança não gera evento com categoria própria no
 * Diário de hoje — aba apontando pra consulta vazia por construção seria a
 * mentira que o §6 proíbe.
 */
const ABAS_SEGURANCA = ["geral", "itens", "validades", "alertas"] as const
type AbaSeguranca = (typeof ABAS_SEGURANCA)[number]

export default async function SegurancaPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string }>
}) {
  const { aba: abaBruta } = await searchParams
  const aba = (ABAS_SEGURANCA.some((a) => a === abaBruta) ? abaBruta : "geral") as AbaSeguranca

  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (!podeVer(painel.permissoes, "seguranca")) {
    redirect(`/hoje?erro=${encodeURIComponent("Seu acesso não inclui a segurança.")}`)
  }
  const editavel = podeEditar(painel.permissoes, "seguranca")
  const hoje = hojeISO()
  const itens = painel.itens.filter((i) => i.categoria === CATEGORIA_SEGURANCA)

  // ONDA 135 — as ocorrências só descem do banco quando a Visão geral está
  // aberta: é a única aba que as desenha (padrão do histórico do piloto —
  // consulta extra só quando a aba dela abre).
  let ocorrencias: Ocorrencia[] = []
  if (aba === "geral") {
    const supabase = await supabaseServer()
    const { data: ocorrenciasBrutas } = await supabase.from("ocorrencias")
      .select("*").eq("embarcacao_id", painel.embarcacao.id).eq("aba", "seguranca")
      .in("estado", [...ESTADOS_QUE_PESAM_NA_SAUDE]).order("created_at", { ascending: false })
    ocorrencias = (ocorrenciasBrutas ?? []) as Ocorrencia[]
  }

  /**
   * ONDA 106 — A TRINCA DE NÚMEROS DA IMAGEM 3, e ela é literalmente esta:
   * o cartão de Segurança do guia mostra "Itens 24 · Em dia 22 · Atenção 2".
   *
   * A régua de quem entra na conta é `calcularSemaforo`, a MESMA da lista
   * de itens — recontar por fora era como a faixa de Documentos e a frase de
   * resumo daquela tela chegaram a discordar (onda 92). Calculado uma vez e
   * lido pelas quatro abas — trinca, Itens, Validades e Alertas.
   */
  const avaliados = itens.map((i) => ({
    item: i,
    r: calcularSemaforo(itemMonitoradoToItemCalc(i), null, hoje),
    venc: vencimentoPorData(itemMonitoradoToItemCalc(i)),
  }))
  const emDia = avaliados.filter((a) => a.r.status === "ok").length
  const emAlerta = avaliados.filter((a) => a.r.status !== "ok")
  const pedemAtencao = emAlerta.length
  // O recorte da aba Validades: só quem TEM data — colete sem validade
  // informada não entra, porque ordenar o desconhecido seria inventá-lo.
  const comValidade = avaliados
    .filter((a) => a.venc != null)
    .sort((a, b) => (a.venc ?? "").localeCompare(b.venc ?? ""))

  const linhaDeItem = ({ item: i, r, venc }: (typeof avaliados)[number]) => {
    const dias = r.diasRestantes != null
      ? r.diasRestantes < 0 ? `vencido há ${-r.diasRestantes} d` : `${r.diasRestantes} dias`
      : "—"
    return (
      <LinhaLista
        key={i.id}
        href={editavel ? `/barco/itens/${i.id}/editar` : undefined}
        leading={<Farol status={r.status} />}
        titulo={i.nome}
        subtitulo={i.quantidade ? `${i.quantidade}` : undefined}
        valor={`${dias}${venc ? ` · ${formatarDataCurta(venc)}` : ""}`}
        valorClassName={r.status === "vencido" ? "text-crit" : r.status === "atencao" ? "text-warn" : "text-dim"}
      />
    )
  }

  return (
    <main>
      {/* ONDA 104 (§8 do Guia) — cabeçalho padrão, com a identidade do hub. */}
      <CabecalhoDetalhe
        voltarHref="/barco"
        voltarRotulo="Barco"
        hub="seguranca"
        /* ONDA 106 — A PÍLULA DOURADA DO CABEÇALHO SAIU. A ação desceu para o
           botão de largura cheia logo abaixo dos números, que é onde a imagem 3
           a desenha. Manter as duas seria a MESMA ação escrita duas vezes na
           mesma tela — e duas ações principais numa tela é o que o §6.2 do
           `docs/DESIGN.md` proíbe. */
      />

      {/* ONDA 105 — o objeto grande do topo, como nas oito imagens do guia.
          É ilustração técnica, não render 3D nem foto: ver o cabeçalho de
          `components/ui/heroi-tecnico.tsx` e o desvio de biblioteca de assets
          registrado em `docs/DESIGN-SYSTEM.md`. */}
      <HeroiTecnico chave="seguranca" className="mt-5 mb-4" />

      {/* ONDA 135 — as abas do piloto, com a pílula ativa na cor DESTE hub.
          As três contagens custam zero: saem todas do painel que já está em
          mãos. "Validades 0" e "Alertas 0" aparecem de propósito — zero é a
          confirmação ativa, não ausência de informação (onda 79). */}
      <Abas
        className="mb-4"
        ativa={aba}
        pilula
        classeAtiva="border-transparent bg-hub-seguranca font-semibold text-acao-texto"
        abas={[
          { valor: "geral", rotulo: "Visão geral", href: "/barco/seguranca" },
          { valor: "itens", rotulo: "Itens", href: "/barco/seguranca?aba=itens", contagem: itens.length },
          { valor: "validades", rotulo: "Validades", href: "/barco/seguranca?aba=validades", contagem: comValidade.length },
          { valor: "alertas", rotulo: "Alertas", href: "/barco/seguranca?aba=alertas", contagem: pedemAtencao },
        ]}
      />

      {aba === "geral" && (
        <>
          {/* Os três números da imagem 3. "Atenção" é o único que pode virar cor de
              ESTADO — e só quando é maior que zero: "Atenção 0" em âmbar diria o
              contrário do que o zero diz (ver `numeros-do-hub.tsx`). */}
          <NumerosDoHub
            chave="seguranca"
            className="mb-4"
            numeros={[
              { rotulo: "Itens", valor: String(itens.length), icone: "seguranca" },
              { rotulo: "Em dia", valor: String(emDia), icone: "check" },
              {
                rotulo: "Atenção",
                valor: String(pedemAtencao),
                icone: "alerta",
                estado: pedemAtencao > 0 ? "atencao" : undefined,
              },
            ]}
          />

          {editavel && (
            <AcaoDoHub
              chave="seguranca"
              href={`/barco/itens/novo?alvo=${encodeURIComponent(`cat:${CATEGORIA_SEGURANCA}`)}`}
              className="mb-6"
            >
              Cadastrar item
            </AcaoDoHub>
          )}

          {ocorrencias.length > 0 && (
            <>
              {/* ONDA 92 (achado 6.1) — rótulo único "Ver tudo", igual ao gêmeo
                  desta seção em `/barco/hidraulica`. */}
              <SecaoPagina icone="alerta" acao={{ href: "/barco/ocorrencias?setor=seguranca", rotulo: "Ver tudo" }}>
                Ocorrências abertas
              </SecaoPagina>
              <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
                {ocorrencias.map((o) => (
                  <LinhaLista
                    key={o.id}
                    href={`/barco/ocorrencias/${o.id}`}
                    leading={<FarolOcorrencia estado={o.estado} />}
                    titulo={o.titulo}
                    valor={ROTULO_ESTADO[o.estado]}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {aba === "itens" && (
        <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
          {itens.length === 0 && (
            <EstadoVazio
              variant="linha"
              icone="seguranca"
              titulo="Nenhum item de segurança cadastrado ainda"
              descricao="Cadastre coletes, extintores e balsas — o semáforo avisa antes de vencer o teste ou a validade."
              /* A ação entra AQUI porque o `AcaoDoHub` mora na Visão geral —
                 nesta aba ele não está na tela, então o vazio precisa do
                 próprio caminho (a régua do §6: o vazio diz o que fazer). */
              acao={editavel ? { href: `/barco/itens/novo?alvo=${encodeURIComponent(`cat:${CATEGORIA_SEGURANCA}`)}`, rotulo: "Cadastrar item" } : undefined}
            />
          )}
          {/* Lê o MESMO `avaliados` que alimenta a trinca: se a lista
              recalculasse por conta própria, o "Em dia 22" e as linhas
              poderiam discordar num item de borda. */}
          {avaliados.map(linhaDeItem)}
        </div>
      )}

      {aba === "validades" && (
        comValidade.length === 0 ? (
          <EstadoVazio
            className="mt-6"
            icone="calendario"
            titulo="Nenhum item com validade informada"
            descricao="Informe a validade ou a data do teste no cadastro do item — extintor, balsa, sinalizador — e as datas aparecem aqui em ordem de vencimento."
          />
        ) : (
          <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
            {/* Ordenado pelo que vence primeiro — é a pergunta que esta aba
                responde ("qual validade aperta antes?"), diferente da aba
                Itens, que lista na ordem do cadastro. */}
            {comValidade.map(linhaDeItem)}
          </div>
        )
      )}

      {aba === "alertas" && (
        emAlerta.length === 0 ? (
          <EstadoVazio
            className="mt-6"
            icone="seguranca"
            titulo="Nenhum alerta na segurança"
            descricao="Tudo que o semáforo vigia está em dia. Alerta aparece aqui quando um teste ou validade vence ou encosta no prazo."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {/* ONDA 135 — vidro tintado pelo estado, na dose (a régua está em
                app/(app)/diario/page.tsx, no card de avaria): vencido tinge de
                crítico, atenção de âmbar — tinta 10→5% + borda 35%, e SÓ aqui,
                porque esta aba É o alarme. Item de segurança só tem tela de
                edição, então o card vira link apenas pra quem pode editar. */}
            {emAlerta.map(({ item, r, venc }) => {
              const dias = r.diasRestantes != null
                ? r.diasRestantes < 0 ? `vencido há ${-r.diasRestantes} d` : `${r.diasRestantes} dias`
                : null
              const casca = `sombra-1 flex items-center gap-3 rounded-[var(--raio-cartao)] border bg-panel p-3 ${
                r.status === "vencido"
                  ? "border-crit/35 bg-gradient-to-b from-crit/10 to-crit/5"
                  : "border-warn/35 bg-gradient-to-b from-warn/10 to-warn/5"
              }`
              const miolo = (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="titulo-card truncate">{item.nome}</p>
                    <p className="apoio mt-0.5 text-dim">
                      {[dias, venc ? formatarDataCurta(venc) : null].filter(Boolean).join(" · ") || "Sem prazo informado"}
                    </p>
                  </div>
                  <Farol status={r.status} />
                  {editavel && <Icone nome="chevron" className="size-4 shrink-0 text-dim" />}
                </>
              )
              return editavel ? (
                <Link key={item.id} href={`/barco/itens/${item.id}/editar`} className={casca}>{miolo}</Link>
              ) : (
                <div key={item.id} className={casca}>{miolo}</div>
              )
            })}
          </div>
        )
      )}
    </main>
  )
}
