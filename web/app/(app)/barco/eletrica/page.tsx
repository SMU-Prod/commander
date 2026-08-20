import Link from "next/link"
import { redirect } from "next/navigation"
import { Farol } from "@/components/farol"
import { Icone } from "@/components/icone"
import { ROTULO_TIPO_BATERIA } from "@/components/campos-tipo-equipamento"
import { Abas } from "@/components/ui/abas"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { HeroiTecnico } from "@/components/ui/heroi-tecnico"
import { NumerosDoHub } from "@/components/ui/numeros-do-hub"
import { carregarPainel, hojeISO, itemMonitoradoToItemCalc } from "@/lib/consultas"
import { abaDoEquipamento, TIPO_ROTULO } from "@/lib/domain/diario"
import { formatarReais } from "@/lib/domain/gastos"
import { calcularSemaforo, formatarDataCurta, PESO, type StatusFarol } from "@/lib/domain/semaforo"
import { podeEditar, podeVer } from "@/lib/domain/permissoes"
import { supabaseServer } from "@/lib/supabase/server"
import type { Contato, Evento } from "@/lib/db/types"

/** Sem acento, minúsculo — "Elétrica"/"eletricista"/"ELETRICISTA" batem todos em "eletric". */
const semAcento = (s: string) =>
  s.toLowerCase()
    .replace(/[áàâã]/g, "a").replace(/[éèê]/g, "e").replace(/[íì]/g, "i")
    .replace(/[óòôõ]/g, "o").replace(/[úù]/g, "u").replace(/ç/g, "c")

/**
 * ONDA 135 — AS ABAS DO PILOTO (`/barco/motores`, onda 128) NESTE HUB.
 * Quatro abas, todas com dado real: Visão geral (equipamentos + contatos, o
 * que a tela já mostrava), Baterias (o recorte `tipo === "bateria"` — os
 * bancos existem como cadastro desde a onda 41, com o campo `tipo_bateria`
 * do PRD §14, então a aba abre com dado de verdade), Histórico (eventos do
 * Diário pendurados nos equipamentos desta área, consulta só quando a aba
 * abre) e Alertas (o que o semáforo acusa). "Circuitos" do mock fica de fora:
 * não existe a entidade — aba apontando pra nada é a mentira que o §6 proíbe.
 */
const ABAS_ELETRICA = ["geral", "baterias", "historico", "alertas"] as const
type AbaEletrica = (typeof ABAS_ELETRICA)[number]

export default async function EletricaPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string }>
}) {
  const { aba: abaBruta } = await searchParams
  const aba = (ABAS_ELETRICA.some((a) => a === abaBruta) ? abaBruta : "geral") as AbaEletrica

  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (!podeVer(painel.permissoes, "eletrica")) {
    redirect(`/hoje?erro=${encodeURIComponent("Seu acesso não inclui a elétrica.")}`)
  }
  const editavel = podeEditar(painel.permissoes, "eletrica")
  const hoje = hojeISO()
  // Só o que a matriz de permissões governa como "eletrica" (onda 32:
  // `abaDoEquipamento`). Antes era `tipo !== "motor"`, que arrastava os
  // equipamentos "outro" pra cá — e esses passaram a pertencer à área
  // Equipamentos, com RLS própria: quem só tinha Elétrica via na tela um
  // colete salva-vidas que o banco não deixava editar.
  const equipamentos = painel.equipamentos.filter((e) => abaDoEquipamento(e.tipo) === "eletrica")
  const baterias = equipamentos.filter((e) => e.tipo === "bateria")

  // ONDA 135 — os contatos de elétrica só descem do banco quando a Visão
  // geral está aberta: é lá que eles moram, e as outras abas não os leem.
  const podeVerContatos = podeVer(painel.permissoes, "contatos")
  let contatosEletrica: Contato[] = []
  if (aba === "geral" && podeVerContatos) {
    const supabase = await supabaseServer()
    const { data } = await supabase.from("contatos")
      .select("*").eq("embarcacao_id", painel.embarcacao.id).order("nome")
    contatosEletrica = ((data ?? []) as Contato[])
      .filter((c) => c.especialidade != null && semAcento(c.especialidade).includes("eletric"))
  }

  const statusDe = (eqId: string): StatusFarol =>
    painel.itens
      .filter((i) => i.equipamento_id === eqId)
      .map((i) => {
        const eq = painel.equipamentos.find((e) => e.id === eqId)
        return calcularSemaforo(itemMonitoradoToItemCalc(i), eq?.horas_atuais ?? null, hoje).status
      })
      .sort((a, b) => PESO[b] - PESO[a])[0] ?? "ok"

  // ONDA 109 — os números da trinca. Recorte por ITEM e não por equipamento,
  // porque "Atenção" tem que contar o que vence, não quantas máquinas existem.
  // ONDA 135 — o estado de cada item sobe pra cá, calculado uma vez e lido
  // pela trinca, pela contagem da aba e pela aba Alertas.
  const itensDaArea = painel.itens.filter((i) => equipamentos.some((e) => e.id === i.equipamento_id))
  const itensComEstado = itensDaArea.map((i) => {
    const eq = equipamentos.find((e) => e.id === i.equipamento_id)
    return { item: i, estado: calcularSemaforo(itemMonitoradoToItemCalc(i), eq?.horas_atuais ?? null, hoje).status }
  })
  const emAlerta = itensComEstado.filter((x) => x.estado !== "ok")
  const pedemAtencao = emAlerta.length

  const rotuloTipo: Record<string, string> = {
    gerador: "Gerador", bateria: "Baterias", painel: "Painel de bordo",
  }
  const nomeDo = (id: string | null) => {
    const e = equipamentos.find((x) => x.id === id)
    if (!e) return "Equipamento"
    return `${rotuloTipo[e.tipo] ?? "Equipamento"}${e.posicao ? ` ${e.posicao}` : ""}`
  }

  // O HISTÓRICO só desce do banco quando a aba dele está aberta — as outras
  // três respondem com o `painel` que já está em mãos (padrão do piloto).
  let historico: Pick<Evento, "id" | "tipo" | "data" | "descricao" | "custo_centavos" | "horas_no_momento" | "equipamento_id">[] = []
  if (aba === "historico" && equipamentos.length > 0) {
    const supabase = await supabaseServer()
    const { data } = await supabase
      .from("eventos")
      .select("id, tipo, data, descricao, custo_centavos, horas_no_momento, equipamento_id")
      .eq("embarcacao_id", painel.embarcacao.id)
      .in("equipamento_id", equipamentos.map((e) => e.id))
      .order("data", { ascending: false })
      .limit(30)
    historico = data ?? []
  }

  return (
    <main>
      {/* ONDA 104 (§8 do Guia) — passa a usar o cabeçalho padrão. O que se
          ganha, além da identidade do hub: o "Voltar" desenhado à mão aqui
          media 16px de alvo, menos da metade do piso da casa, e o componente
          entrega os 44px sem empurrar o título meia tela pra baixo. */}
      <CabecalhoDetalhe
        voltarHref="/barco"
        voltarRotulo="Barco"
        hub="eletrica"
        acao={editavel ? (
          <Link
            href="/barco/equipamento/novo?tipo=gerador"
            className="inline-flex min-h-[var(--altura-controle)] shrink-0 items-center gap-1 rounded-[var(--raio-pilula)] bg-accent px-4 corpo font-semibold text-acao-texto"
          >
            <Icone nome="mais" className="size-4" /> Equipamento
          </Link>
        ) : undefined}
      />

      {/* ONDA 105 — o objeto grande do topo, como nas oito imagens do guia.
          É ilustração técnica, não render 3D nem foto: ver o cabeçalho de
          `components/ui/heroi-tecnico.tsx` e o desvio de biblioteca de assets
          registrado em `docs/DESIGN-SYSTEM.md`. */}
      <HeroiTecnico chave="eletrica" className="mt-5 mb-4" />

      {/* ONDA 135 — as abas do piloto, com a pílula ativa na cor DESTE hub.
          Contagem em Baterias e Alertas porque as duas custam zero (saem do
          painel); Histórico não mostra número de propósito — contá-lo
          obrigaria a consulta que a aba fechada existe pra não pagar. */}
      <Abas
        className="mb-4"
        ativa={aba}
        pilula
        classeAtiva="border-transparent bg-hub-eletrica font-semibold text-acao-texto"
        abas={[
          { valor: "geral", rotulo: "Visão geral", href: "/barco/eletrica" },
          { valor: "baterias", rotulo: "Baterias", href: "/barco/eletrica?aba=baterias", contagem: baterias.length },
          { valor: "historico", rotulo: "Histórico", href: "/barco/eletrica?aba=historico" },
          { valor: "alertas", rotulo: "Alertas", href: "/barco/eletrica?aba=alertas", contagem: pedemAtencao },
        ]}
      />

      {aba === "geral" && (
        <>
          {/* ONDA 109 — a trinca da imagem 3. O universo aqui é EQUIPAMENTO (é o
              que a tela lista), e os itens dele entram como segunda coluna. */}
          <NumerosDoHub
            chave="eletrica"
            className="mb-4"
            numeros={[
              { rotulo: "Equipamentos", valor: String(equipamentos.length), icone: "raio" },
              { rotulo: "Manutenções", valor: String(itensDaArea.length), icone: "relogio" },
              {
                rotulo: "Atenção",
                valor: String(pedemAtencao),
                icone: "alerta",
                estado: pedemAtencao > 0 ? "atencao" : undefined,
              },
            ]}
          />

          <div className="sombra-1 mt-6 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
            {equipamentos.length === 0 && (
              <div className="py-6 text-center">
                <Icone nome="raio" className="mx-auto size-7 text-dim" />
                <p className="corpo mt-2 font-medium">Nada cadastrado ainda</p>
                <p className="apoio mt-1 text-dim">
                  Cadastre o gerador e as baterias para o app avisar das manutenções deles também.
                </p>
              </div>
            )}
            {equipamentos.map((e) => {
              const itens = painel.itens.filter((i) => i.equipamento_id === e.id)
              return (
                <Link key={e.id} href={`/barco/equipamento/${e.id}`}
                  className="flex items-center gap-3 border-b border-line py-3.5 last:border-0">
                  <Farol status={statusDe(e.id)} />
                  <div className="min-w-0 flex-1">
                    <p className="titulo-card">
                      {rotuloTipo[e.tipo] ?? "Equipamento"}
                      {e.posicao ? ` ${e.posicao}` : ""}
                      {e.quantidade != null ? ` · ${e.quantidade}×` : ""}
                    </p>
                    <p className="apoio mt-0.5 text-dim">
                      {[e.marca, e.modelo].filter(Boolean).join(" ") || "Sem marca informada"}
                      {e.horas_atuais != null ? ` · ${e.horas_atuais.toLocaleString("pt-BR")} h` : ""}
                      {` · ${itens.length} ${itens.length === 1 ? "item" : "itens"}`}
                    </p>
                  </div>
                  <Icone nome="chevron" className="size-4 text-dim" />
                </Link>
              )
            })}
          </div>

          {podeVerContatos && (
            <>
              {/* ONDA 92 (achado 5.2) — era um `SecaoPagina` reescrito à mão, com
                  a ação em texto dourado de 14px: um dos seis vestidos de "ação
                  secundária" que a auditoria mediu, e justamente o vestido que a
                  onda 82 baniu (texto pelado não diz "aqui se toca"; quem diz é a
                  forma). Passa a ser o componente, com a pílula de contorno e o
                  alvo de 44px que ele já garante nas outras ~35 telas. */}
              <SecaoPagina
                icone="pessoas"
                acao={{ href: "/barco/contatos", rotulo: "Cadastrar contato", icone: "mais" }}
              >
                Suporte e peças
              </SecaoPagina>
              <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
                {contatosEletrica.length === 0 && (
                  <p className="corpo py-4 text-dim">
                    Nenhum contato de elétrica cadastrado ainda. Salve o eletricista de confiança para
                    achar rápido na próxima vez.
                  </p>
                )}
                {contatosEletrica.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="titulo-card">{c.nome}</p>
                      <p className="apoio mt-0.5 text-dim">
                        {[c.especialidade, c.telefone].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {c.telefone && (
                      <a href={`https://wa.me/55${c.telefone.replace(/\D/g, "")}`} target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-[var(--raio-controle)] border border-ok/40 px-2.5 py-1.5 text-xs text-ok">
                        WhatsApp
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {aba === "baterias" && (
        baterias.length === 0 ? (
          <EstadoVazio
            className="mt-6"
            icone="bateria"
            titulo="Nenhuma bateria cadastrada ainda"
            descricao="Cadastre os bancos — serviço, partida, solar — com o tipo (AGM, lítio, chumbo-ácido) e o app passa a vigiar as manutenções deles."
            acao={editavel ? { href: "/barco/equipamento/novo?tipo=bateria", rotulo: "Cadastrar bateria" } : undefined}
          />
        ) : (
          <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
            {/* O recorte de banco de bateria, com o dado que só ele tem: o
                `tipo_bateria` do PRD §14. Sem tipo informado a linha DIZ isso
                — nunca um regime de carga inventado. */}
            {baterias.map((e) => {
              const itens = painel.itens.filter((i) => i.equipamento_id === e.id)
              return (
                <Link key={e.id} href={`/barco/equipamento/${e.id}`}
                  className="flex items-center gap-3 border-b border-line py-3.5 last:border-0">
                  <Farol status={statusDe(e.id)} />
                  <div className="min-w-0 flex-1">
                    <p className="titulo-card">
                      Baterias
                      {e.posicao ? ` ${e.posicao}` : ""}
                      {e.quantidade != null ? ` · ${e.quantidade}×` : ""}
                    </p>
                    <p className="apoio mt-0.5 text-dim">
                      {[
                        e.tipo_bateria ? ROTULO_TIPO_BATERIA[e.tipo_bateria] : "Sem tipo informado",
                        [e.marca, e.modelo].filter(Boolean).join(" ") || null,
                      ].filter(Boolean).join(" · ")}
                      {` · ${itens.length} ${itens.length === 1 ? "item" : "itens"}`}
                    </p>
                  </div>
                  <Icone nome="chevron" className="size-4 text-dim" />
                </Link>
              )
            })}
          </div>
        )
      )}

      {aba === "historico" && (
        historico.length === 0 ? (
          <EstadoVazio
            className="mt-6"
            icone="calendario"
            titulo="Nenhum registro da elétrica no Diário"
            descricao="Manutenção, leitura de horas e avaria registradas no Diário de Bordo com um equipamento da elétrica apontado aparecem aqui."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {historico.map((e) => (
              <div key={e.id} className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-3">
                <p className="rotulo-dado tabular-nums text-dim">
                  {formatarDataCurta(e.data)} · {TIPO_ROTULO[e.tipo] ?? e.tipo} · {nomeDo(e.equipamento_id)}
                </p>
                <p className="titulo-card mt-0.5">{e.descricao?.trim() || (TIPO_ROTULO[e.tipo] ?? e.tipo)}</p>
                {(e.horas_no_momento != null || e.custo_centavos != null) && (
                  <p className="apoio mt-1 text-dim">
                    {e.horas_no_momento != null && (
                      <>horímetro <span className="tabular-nums text-texto">{e.horas_no_momento.toLocaleString("pt-BR")} h</span></>
                    )}
                    {e.horas_no_momento != null && e.custo_centavos != null && " · "}
                    {e.custo_centavos != null && (
                      <span className="tabular-nums text-texto">{formatarReais(e.custo_centavos)}</span>
                    )}
                  </p>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {aba === "alertas" && (
        emAlerta.length === 0 ? (
          <EstadoVazio
            className="mt-6"
            icone="seguranca"
            titulo="Nenhum alerta na elétrica"
            descricao="Tudo que o semáforo vigia está em dia. Alerta aparece aqui quando uma manutenção vence ou encosta no prazo."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {/* ONDA 135 — vidro tintado pelo estado, na dose (a régua está em
                app/(app)/diario/page.tsx, no card de avaria): vencido tinge
                de crítico, atenção de âmbar — tinta 10→5% + borda 35%, e SÓ
                aqui, porque esta aba É o alarme. */}
            {emAlerta.map(({ item, estado }) => (
              <Link
                key={item.id}
                href={`/barco/equipamento/${item.equipamento_id}`}
                className={`sombra-1 flex items-center gap-3 rounded-[var(--raio-cartao)] border bg-panel p-3 ${
                  estado === "vencido"
                    ? "border-crit/35 bg-gradient-to-b from-crit/10 to-crit/5"
                    : "border-warn/35 bg-gradient-to-b from-warn/10 to-warn/5"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="titulo-card truncate">{item.nome}</p>
                  <p className="apoio mt-0.5 text-dim">{nomeDo(item.equipamento_id)}</p>
                </div>
                <Farol status={estado} />
                <Icone nome="chevron" className="size-4 shrink-0 text-dim" />
              </Link>
            ))}
          </div>
        )
      )}
    </main>
  )
}
