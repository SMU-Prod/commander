import Link from "next/link"
import { redirect } from "next/navigation"
import { Farol } from "@/components/farol"
import { Icone } from "@/components/icone"
import { Abas } from "@/components/ui/abas"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { LinhaLista } from "@/components/ui/linha-lista"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { HeroiTecnico } from "@/components/ui/heroi-tecnico"
import { NumerosDoHub } from "@/components/ui/numeros-do-hub"
import { carregarPainel, hojeISO, itemMonitoradoToItemCalc } from "@/lib/consultas"
import { CATEGORIAS_CASCO, ROTULO_CASCO, TIPO_ROTULO } from "@/lib/domain/diario"
import { formatarReais } from "@/lib/domain/gastos"
import { podeEditar, podeVer } from "@/lib/domain/permissoes"
import { calcularSemaforo, formatarDataCurta, vencimentoPorData } from "@/lib/domain/semaforo"
import { supabaseServer } from "@/lib/supabase/server"
import { ALVO_ACAO, PILULA_ACAO } from "@/lib/ui/acoes"
import type { Evento } from "@/lib/db/types"

/**
 * ONDA 101 — O CASCO GANHOU TELA, e não foi só mudança de endereço.
 *
 * Na /barco o Casco eram seis linhas com contagem e um "Adicionar" — e NENHUMA
 * delas abria coisa alguma. Quem cadastrava um item de deck ou de fibra só o
 * reencontrava pelo Histórico ou pelo Diário: a área tinha permissão própria na
 * matriz (`casco`), tinha categoria própria no banco e não tinha porta. Este
 * hub é a porta, e é o card "Casco" da central técnica (spec §3).
 *
 * POR QUE A ANATOMIA DIVERGE DA GÊMEA `/barco/hidraulica`, que é o outro hub
 * por categoria: lá cada categoria ganha seção + painel + estado vazio, sempre.
 * São três categorias, então o custo do vazio é três blocos. O Casco tem SEIS,
 * e num barco novo as seis estão vazias — seriam seis estados vazios seguidos,
 * ~820px de moldura dizendo "nada aqui" seis vezes. É o retrato de "informação
 * solta" que a auditoria de 19/08 mediu na Início ("cada estado vazio isolado é
 * bom; cinco empilhados são o retrato de informação solta").
 *
 * Então: categoria COM item vira seção com os itens à vista; categoria SEM item
 * vira uma linha só, num painel único no fim, com o mesmo "Adicionar" de antes
 * — que é o convite explícito de cadastro, pré-preenchido com a categoria
 * (`?alvo=cat:`). Nada perdeu entrada; o vazio parou de ocupar seis blocos.
 */
/**
 * ONDA 135 — AS ABAS DO PILOTO (`/barco/motores`, onda 128) NESTE HUB.
 * Entram as QUATRO que o produto responde com dado real: Visão geral (o que a
 * tela já mostrava), Inspeções (as docagens do Diário — o recorte que
 * `ehCasco` em `lib/domain/diario.ts` já considera casco), Histórico (todo
 * evento do recorte casco) e Alertas (o que o semáforo acusa). "Documentos"
 * do mock fica de fora de propósito: documentos são OUTRO hub, e uma aba que
 * manda pra outra tela é porta pintada na parede. O estado mora na URL
 * (`?aba=`) e a ativa veste a cor DESTE hub (§5).
 */
const ABAS_CASCO = ["geral", "inspecoes", "historico", "alertas"] as const
type AbaCasco = (typeof ABAS_CASCO)[number]

export default async function CascoPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string }>
}) {
  const { aba: abaBruta } = await searchParams
  const aba = (ABAS_CASCO.some((a) => a === abaBruta) ? abaBruta : "geral") as AbaCasco

  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (!podeVer(painel.permissoes, "casco")) {
    redirect(`/hoje?erro=${encodeURIComponent("Seu acesso não inclui o casco.")}`)
  }
  const editavel = podeEditar(painel.permissoes, "casco")
  const hoje = hojeISO()
  // O MESMO recorte que o card "Casco" da /barco conta — a porta não pode
  // discordar da sala no número.
  const itensDaCategoria = (c: string) => painel.itens.filter((i) => i.categoria === c)

  const comItens = CATEGORIAS_CASCO.filter((c) => itensDaCategoria(c).length > 0)
  const semItens = CATEGORIAS_CASCO.filter((c) => itensDaCategoria(c).length === 0)

  // ONDA 109 — a trinca da imagem 3. O universo é o MESMO que o card "Casco"
  // da central técnica conta: item cuja categoria está em CATEGORIAS_CASCO.
  // ONDA 135 — o estado de cada item sobe pra cá, calculado uma vez e lido
  // pela trinca, pela contagem da aba e pela aba Alertas.
  const doCasco = painel.itens.filter((i) => (CATEGORIAS_CASCO as readonly string[]).includes(i.categoria ?? ""))
  const avaliados = doCasco.map((i) => ({ item: i, r: calcularSemaforo(itemMonitoradoToItemCalc(i), null, hoje) }))
  const emDia = avaliados.filter((a) => a.r.status === "ok").length
  const emAlerta = avaliados.filter((a) => a.r.status !== "ok")
  const pedemAtencao = emAlerta.length

  // AS DUAS CONSULTAS DE EVENTO só descem do banco quando a aba delas abre —
  // o padrão do histórico do piloto: Visão geral e Alertas respondem com o
  // `painel` que já está em mãos, e pagar consulta em toda abertura do hub
  // seria custo sem leitor. Inspeções é o recorte "docagem" (subida, pintura,
  // anodos); Histórico é o recorte casco inteiro do Diário — o MESMO critério
  // de `ehCasco`: docagem OU categoria do casco.
  let inspecoes: Pick<Evento, "id" | "tipo" | "data" | "descricao" | "custo_centavos" | "categoria">[] = []
  let historico: Pick<Evento, "id" | "tipo" | "data" | "descricao" | "custo_centavos" | "categoria">[] = []
  if (aba === "inspecoes" || aba === "historico") {
    const supabase = await supabaseServer()
    const consulta = supabase
      .from("eventos")
      .select("id, tipo, data, descricao, custo_centavos, categoria")
      .eq("embarcacao_id", painel.embarcacao.id)
      .order("data", { ascending: false })
      .limit(30)
    if (aba === "inspecoes") {
      const { data } = await consulta.eq("tipo", "docagem")
      inspecoes = data ?? []
    } else {
      const { data } = await consulta.or(`tipo.eq.docagem,categoria.in.(${CATEGORIAS_CASCO.join(",")})`)
      historico = data ?? []
    }
  }

  // O card de evento das abas Inspeções e Histórico — a mesma anatomia do
  // histórico do piloto, com a categoria do casco no lugar do nome do motor.
  const cardDeEvento = (e: (typeof historico)[number]) => (
    <div key={e.id} className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-3">
      <p className="rotulo-dado tabular-nums text-dim">
        {formatarDataCurta(e.data)} · {TIPO_ROTULO[e.tipo] ?? e.tipo}
        {e.categoria != null && ROTULO_CASCO[e.categoria] ? ` · ${ROTULO_CASCO[e.categoria]}` : ""}
      </p>
      <p className="titulo-card mt-0.5">{e.descricao?.trim() || (TIPO_ROTULO[e.tipo] ?? e.tipo)}</p>
      {e.custo_centavos != null && (
        <p className="apoio mt-1 text-dim">
          <span className="tabular-nums text-texto">{formatarReais(e.custo_centavos)}</span>
        </p>
      )}
    </div>
  )

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref="/barco"
        voltarRotulo="Barco"
        hub="casco"
        acao={editavel ? (
          // `alvo=cat:casco_outros` e não `/barco/itens/novo` pelado: "Outros"
          // é o balde do Casco, então o formulário abre já na área certa (a
          // pessoa troca no seletor se for deck ou inox) e — o que importa
          // mais — o "Voltar" dele sabe voltar PRA CÁ, porque o destino sai do
          // `alvo` (ver `itens/novo`). Sem isso, adicionar do cabeçalho deste
          // hub devolvia a pessoa na central técnica.
          <Link
            href={`/barco/itens/novo?alvo=${encodeURIComponent("cat:casco_outros")}`}
            className="inline-flex min-h-[var(--altura-controle)] shrink-0 items-center gap-1 rounded-[var(--raio-pilula)] bg-accent px-4 corpo font-semibold text-acao-texto"
          >
            <Icone nome="mais" className="size-4" /> Item
          </Link>
        ) : undefined}
      />

      {/* ONDA 105 — o objeto grande do topo, como nas oito imagens do guia.
          É ilustração técnica, não render 3D nem foto: ver o cabeçalho de
          `components/ui/heroi-tecnico.tsx` e o desvio de biblioteca de assets
          registrado em `docs/DESIGN-SYSTEM.md`. */}
      <HeroiTecnico chave="casco" className="mt-5 mb-4" />

      {/* ONDA 135 — as abas do piloto, entre o objeto e os números. Contagem
          só em Alertas, que custa zero (sai do painel); Inspeções e Histórico
          não mostram número de propósito — contá-los obrigaria a consulta que
          a aba fechada existe pra não pagar. */}
      <Abas
        className="mb-4"
        ativa={aba}
        pilula
        classeAtiva="border-transparent bg-hub-casco font-semibold text-acao-texto"
        abas={[
          { valor: "geral", rotulo: "Visão geral", href: "/barco/casco" },
          { valor: "inspecoes", rotulo: "Inspeções", href: "/barco/casco?aba=inspecoes" },
          { valor: "historico", rotulo: "Histórico", href: "/barco/casco?aba=historico" },
          { valor: "alertas", rotulo: "Alertas", href: "/barco/casco?aba=alertas", contagem: pedemAtencao },
        ]}
      />

      {aba === "geral" && (
        <>
          <NumerosDoHub
            chave="casco"
            className="mb-4"
            numeros={[
              { rotulo: "Itens", valor: String(doCasco.length), icone: "embarcacao" },
              { rotulo: "Em dia", valor: String(emDia), icone: "check" },
              {
                rotulo: "Atenção",
                valor: String(pedemAtencao),
                icone: "alerta",
                estado: pedemAtencao > 0 ? "atencao" : undefined,
              },
            ]}
          />

          {comItens.map((c) => (
            <div key={c}>
              <SecaoPagina
                denso
                acao={editavel ? { href: `/barco/itens/novo?alvo=${encodeURIComponent(`cat:${c}`)}`, rotulo: "Adicionar", icone: "mais" } : undefined}
              >
                {ROTULO_CASCO[c]}
              </SecaoPagina>
              <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
                {itensDaCategoria(c).map((i) => {
                  const calc = itemMonitoradoToItemCalc(i)
                  const r = calcularSemaforo(calc, null, hoje)
                  const venc = vencimentoPorData(calc)
                  const dias = r.diasRestantes != null
                    ? r.diasRestantes < 0 ? `vencido há ${-r.diasRestantes} d` : `${r.diasRestantes} dias`
                    : "—"
                  return (
                    <LinhaLista
                      key={i.id}
                      href={editavel ? `/barco/itens/${i.id}/editar` : undefined}
                      leading={<Farol status={r.status} />}
                      titulo={i.nome}
                      valor={`${dias}${venc ? ` · ${formatarDataCurta(venc)}` : ""}`}
                      valorClassName={r.status === "vencido" ? "text-crit" : r.status === "atencao" ? "text-warn" : "text-dim"}
                    />
                  )
                })}
              </div>
            </div>
          ))}

          {semItens.length > 0 && (
            <>
              <SecaoPagina denso icone="escudo">
                {comItens.length === 0 ? "Categorias do casco" : "Ainda sem item"}
              </SecaoPagina>
              <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
                {semItens.map((c) => (
                  <LinhaLista
                    key={c}
                    // Anel vazio, nunca farol: categoria sem item é "não sei", e
                    // verde por omissão é o que a onda 93 arrancou desta tela.
                    leading={<span className="size-2 rounded-[var(--raio-pilula)] border border-line" />}
                    titulo={ROTULO_CASCO[c]}
                    trailing={editavel ? (
                      // Pílula de contorno e não texto: seis "Adicionar" dourados
                      // de uma vez estouravam o orçamento de cor da tela, e texto
                      // pelado é o que o dono chamou de "clicável que parece texto
                      // comum" (onda 82). Alvo 44px por fora, desenho 30px por
                      // dentro — `lib/ui/acoes.ts`.
                      <Link href={`/barco/itens/novo?alvo=${encodeURIComponent(`cat:${c}`)}`} className={ALVO_ACAO}>
                        <span className={PILULA_ACAO}>Adicionar</span>
                      </Link>
                    ) : undefined}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {aba === "inspecoes" && (
        inspecoes.length === 0 ? (
          <EstadoVazio
            className="mt-6"
            icone="embarcacao"
            titulo="Nenhuma docagem registrada ainda"
            descricao="Registre a subida do barco no Diário de Bordo — pintura, anodos, inspeção do casco — e a linha do tempo das docagens aparece aqui."
          />
        ) : (
          <div className="flex flex-col gap-2">{inspecoes.map(cardDeEvento)}</div>
        )
      )}

      {aba === "historico" && (
        historico.length === 0 ? (
          <EstadoVazio
            className="mt-6"
            icone="calendario"
            titulo="Nenhum registro do casco no Diário"
            descricao="Docagens e manutenções registradas no Diário de Bordo numa categoria do casco aparecem aqui."
          />
        ) : (
          <div className="flex flex-col gap-2">{historico.map(cardDeEvento)}</div>
        )
      )}

      {aba === "alertas" && (
        emAlerta.length === 0 ? (
          <EstadoVazio
            className="mt-6"
            icone="seguranca"
            titulo="Nenhum alerta no casco"
            descricao="Tudo que o semáforo vigia está em dia. Alerta aparece aqui quando um item do casco vence ou encosta no prazo."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {/* ONDA 135 — vidro tintado pelo estado, na dose (a régua está em
                app/(app)/diario/page.tsx, no card de avaria): vencido tinge de
                crítico, atenção de âmbar — tinta 10→5% + borda 35%, e SÓ aqui,
                porque esta aba É o alarme. Item de casco só tem tela de
                edição, então o card vira link apenas pra quem pode editar. */}
            {emAlerta.map(({ item, r }) => {
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
                      {ROTULO_CASCO[item.categoria ?? ""] ?? "Casco"}
                      {dias ? ` · ${dias}` : ""}
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
