import Link from "next/link"
import { redirect } from "next/navigation"
import { Farol } from "@/components/farol"
import { Horimetro } from "@/components/horimetro"
import { Icone } from "@/components/icone"
import { Abas } from "@/components/ui/abas"
import { CartaoAoVivo } from "@/components/ui/ao-vivo"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { HeroiTecnico } from "@/components/ui/heroi-tecnico"
import { NumerosDoHub } from "@/components/ui/numeros-do-hub"
import { carregarPainel, hojeISO, itemMonitoradoToItemCalc } from "@/lib/consultas"
import { carregarTelemetriaRecente } from "@/lib/consultas-telemetria"
import { TIPO_ROTULO } from "@/lib/domain/diario"
import { carimboAoVivo, motoresAoVivo, type MotorAoVivo } from "@/lib/domain/telemetria"
import { formatarReais } from "@/lib/domain/gastos"
import { podeEditar, podeVer } from "@/lib/domain/permissoes"
import {
  calcularSemaforo, formatarDataCurta, PESO, temInformacaoSuficiente, type StatusFarol,
} from "@/lib/domain/semaforo"
import { supabaseServer } from "@/lib/supabase/server"
import type { Evento } from "@/lib/db/types"

/**
 * ONDA 101 — O HUB DOS MOTORES, que era uma seção da /barco.
 *
 * O dono pôs "Motores" na lista dos oito cards da central técnica (spec
 * `2026-08-19-arquitetura-quatro-apps.md` §3): *"A pessoa toca no card e entra
 * naquele hub"*. Elétrica, Hidráulica, Segurança, Equipamentos e Documentos já
 * tinham hub; Motores, Casco e Manutenções eram seção empilhada na porta.
 * Estas três telas fecham a simetria — nada aqui é conteúdo novo, é o mesmo
 * bloco no lugar onde ele passa a morar.
 *
 * Nenhuma consulta própria: `carregarPainel` já traz equipamentos e itens, e
 * tem `cache()` — entrar aqui vindo da /barco não paga segunda ida ao banco.
 *
 * A saída usa `CabecalhoDetalhe` e não o link "Barco" escrito à mão que os
 * hubs irmãos usam: a auditoria de 19/08 mediu esse link em 62×17px com
 * `min-height: 0` em oito arquivos, contra a régua de 44px. Tela nova nasce
 * certa; os oito herdados estão no relatório.
 */
/**
 * ONDA 128 — AS ABAS DA IMAGEM 1 DO GUIA, no hub piloto.
 * A tela normativa de Motores desenha cinco abas (Visão geral · Manutenções
 * · Sistemas · Histórico · Alertas) entre o objeto e os números. Entram as
 * QUATRO que o produto sabe responder com dado real — "Sistemas" fica de
 * fora até existir a entidade (aba apontando pra nada é a mentira que o §6
 * proíbe; quando subsistema virar cadastro, ela entra aqui). O estado mora
 * na URL (`?aba=`), como todo `Abas` da casa, e a ativa veste a borda do
 * PRÓPRIO hub (§5 — cor do hub no estado ativo dele).
 */
const ABAS_MOTORES = ["geral", "manutencoes", "historico", "alertas"] as const
type AbaMotores = (typeof ABAS_MOTORES)[number]

export default async function MotoresPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string }>
}) {
  const { aba: abaBruta } = await searchParams
  const aba = (ABAS_MOTORES.some((a) => a === abaBruta) ? abaBruta : "geral") as AbaMotores

  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (!podeVer(painel.permissoes, "motores")) {
    redirect(`/hoje?erro=${encodeURIComponent("Seu acesso não inclui os motores.")}`)
  }
  const editavel = podeEditar(painel.permissoes, "motores")
  const hoje = hojeISO()
  const motores = painel.equipamentos.filter((e) => e.tipo === "motor")

  // A MESMA função que vivia na /barco, byte por byte no critério: `null`
  // quando não há item monitorado com informação suficiente, nunca `"ok"`. O
  // `Horimetro` aceita `null` desde a onda 94 e desenha o anel vazio — um motor
  // sem nenhum item cadastrado não pode acender "em dia".
  const statusDoMotor = (eqId: string): StatusFarol | null =>
    painel.itens
      .filter((i) => i.equipamento_id === eqId)
      .flatMap((i) => {
        const horas = painel.equipamentos.find((e) => e.id === eqId)?.horas_atuais ?? null
        const calc = itemMonitoradoToItemCalc(i)
        return temInformacaoSuficiente(calc, horas) ? [calcularSemaforo(calc, horas, hoje).status] : []
      })
      .sort((a, b) => PESO[b] - PESO[a])[0] ?? null

  // ONDA 109 — os números da trinca. Recorte por ITEM, e a régua de quem vota
  // é `temInformacaoSuficiente`, a mesma de `statusDoMotor`: item sem
  // intervalo nem data não conta nem a favor nem contra.
  const itensDosMotores = painel.itens.filter((i) => motores.some((m) => m.id === i.equipamento_id))
  // O estado de cada item, calculado uma vez e consumido pelas três abas que
  // o leem (trinca, Manutenções, Alertas) — `null` quando o item não tem
  // informação suficiente pra votar.
  const estadoDoItem = (i: (typeof itensDosMotores)[number]): StatusFarol | null => {
    const horas = motores.find((m) => m.id === i.equipamento_id)?.horas_atuais ?? null
    const calc = itemMonitoradoToItemCalc(i)
    return temInformacaoSuficiente(calc, horas) ? calcularSemaforo(calc, horas, hoje).status : null
  }
  const itensComEstado = itensDosMotores.map((i) => ({ item: i, estado: estadoDoItem(i) }))
  const emAlerta = itensComEstado.filter((x) => x.estado != null && x.estado !== "ok")
  const pedemAtencao = emAlerta.length

  // O HISTÓRICO só desce do banco quando a aba dele está aberta — as outras
  // três respondem com o `painel` que já está em mãos, e pagar a consulta em
  // toda abertura do hub seria custo sem leitor.
  let historico: Pick<Evento, "id" | "tipo" | "data" | "descricao" | "custo_centavos" | "horas_no_momento" | "equipamento_id">[] = []
  if (aba === "historico" && motores.length > 0) {
    const supabase = await supabaseServer()
    const { data } = await supabase
      .from("eventos")
      .select("id, tipo, data, descricao, custo_centavos, horas_no_momento, equipamento_id")
      .eq("embarcacao_id", painel.embarcacao.id)
      .in("equipamento_id", motores.map((m) => m.id))
      .order("data", { ascending: false })
      .limit(30)
    historico = data ?? []
  }
  const nomeDoMotor = (id: string | null) => motores.find((m) => m.id === id)?.posicao ?? "Motor"

  // ONDA 141 — O CARTÃO "AO VIVO" DO COMMANDER CONNECTOR, só na Visão geral.
  // A consulta nem sai do lugar nas outras abas (mesma régua do histórico), e
  // a regra de ouro é do domínio: sem telemetria na janela de 48h não há
  // cartão — nem convite; o convite de conectar já mora em Ajustes e no guia.
  const aoVivo = aba === "geral" ? await carregarTelemetriaRecente() : null
  const { motores: motoresVivos, tsMaisNovo } = motoresAoVivo(aoVivo?.leituras ?? {}, motores)
  const carimboVivo = carimboAoVivo(tsMaisNovo)
  // Par com leitura `null` não entra — null nunca vira zero nem traço; o
  // domínio garante que todo motor listado tem ao menos um par de verdade.
  const dadosDoMotor = (m: MotorAoVivo) => [
    ...(m.rpm != null ? [{ rotulo: "Rotação", valor: `${Math.round(m.rpm).toLocaleString("pt-BR")} rpm` }] : []),
    ...(m.temperaturaC != null ? [{ rotulo: "Temperatura", valor: `${Math.round(m.temperaturaC).toLocaleString("pt-BR")} °C` }] : []),
    ...(m.horas != null ? [{ rotulo: "Horas", valor: `${Math.round(m.horas).toLocaleString("pt-BR")} h` }] : []),
  ]

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref="/barco"
        voltarRotulo="Barco"
        hub="motores"
        acao={editavel ? (
          <Link
            href="/barco/equipamento/novo?tipo=motor"
            className="inline-flex min-h-[var(--altura-controle)] shrink-0 items-center gap-1 rounded-[var(--raio-pilula)] bg-accent px-4 corpo font-semibold text-acao-texto"
          >
            <Icone nome="mais" className="size-4" /> Motor
          </Link>
        ) : undefined}
      />

      {/* ONDA 105 — o objeto grande do topo, como nas oito imagens do guia.
          É ilustração técnica, não render 3D nem foto: ver o cabeçalho de
          `components/ui/heroi-tecnico.tsx` e o desvio de biblioteca de assets
          registrado em `docs/DESIGN-SYSTEM.md`. */}
      <HeroiTecnico chave="motores" className="mt-5 mb-4" />

      {/* ONDA 128 — as abas da imagem 1, entre o objeto e os números, com a
          borda ativa na cor DESTE hub. Contagem em Manutenções e Alertas
          porque as duas custam zero (saem do painel); Histórico não mostra
          número de propósito — contá-lo obrigaria a consulta que a aba
          fechada existe pra não pagar. */}
      <Abas
        className="mb-4"
        ativa={aba}
        pilula
        classeAtiva="border-transparent bg-hub-motores font-semibold text-acao-texto"
        abas={[
          { valor: "geral", rotulo: "Visão geral", href: "/barco/motores" },
          { valor: "manutencoes", rotulo: "Manutenções", href: "/barco/motores?aba=manutencoes", contagem: itensDosMotores.length },
          { valor: "historico", rotulo: "Histórico", href: "/barco/motores?aba=historico" },
          { valor: "alertas", rotulo: "Alertas", href: "/barco/motores?aba=alertas", contagem: pedemAtencao },
        ]}
      />

      {aba === "geral" && (
        <>
          {/* ONDA 141 — os números do conector, com o carimbo de frescor
              honesto. O cartão SÓ existe quando o plugin falou na janela. */}
          {carimboVivo != null && motoresVivos.length > 0 && (
            <CartaoAoVivo
              chave="motores"
              carimbo={carimboVivo.texto}
              aoVivo={carimboVivo.aoVivo}
              className="mb-4"
              grupos={motoresVivos.map((m) => ({ rotulo: m.rotulo, dados: dadosDoMotor(m) }))}
            />
          )}

          {/* ONDA 109 — a trinca da imagem 3, com o vocabulário desta tela. */}
          <NumerosDoHub
            chave="motores"
            className="mb-4"
            numeros={[
              { rotulo: "Motores", valor: String(motores.length), icone: "motor" },
              { rotulo: "Manutenções", valor: String(itensDosMotores.length), icone: "relogio" },
              {
                rotulo: "Atenção",
                valor: String(pedemAtencao),
                icone: "alerta",
                estado: pedemAtencao > 0 ? "atencao" : undefined,
              },
            ]}
          />

          {motores.length === 0 ? (
            <EstadoVazio
              className="mt-6"
              icone="motor"
              titulo="Nenhum motor cadastrado ainda"
              descricao="Cadastre pra ganhar horímetro e checklist de manutenção automáticos."
              acao={editavel ? { href: "/barco/equipamento/novo?tipo=motor", rotulo: "Cadastrar motor" } : undefined}
            />
          ) : (
            <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
              {motores.map((m) => (
                <Link key={m.id} href={`/barco/equipamento/${m.id}`}>
                  <Horimetro
                    rotulo={m.posicao ?? "Motor"}
                    horas={m.horas_atuais}
                    status={statusDoMotor(m.id)}
                  />
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      {aba === "manutencoes" && (
        itensComEstado.length === 0 ? (
          <EstadoVazio
            className="mt-6"
            icone="ferramenta"
            titulo="Nenhuma manutenção pendurada nos motores"
            descricao="Cadastre os itens de manutenção na ficha de cada motor — troca de óleo, filtros, correias — e o semáforo passa a vigiar os prazos."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {itensComEstado.map(({ item, estado }) => (
              <Link
                key={item.id}
                href={`/barco/equipamento/${item.equipamento_id}`}
                className="sombra-1 flex items-center gap-3 rounded-[var(--raio-cartao)] border border-line bg-panel p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="titulo-card truncate">{item.nome}</p>
                  <p className="apoio mt-0.5 text-dim">{nomeDoMotor(item.equipamento_id)}</p>
                </div>
                {/* `estado === null` é "sem informação pra vigiar", e a tela
                    diz isso em palavra — nunca um farol verde de mentira. */}
                {estado ? <Farol status={estado} /> : <span className="apoio shrink-0 text-dim">sem prazo</span>}
                <Icone nome="chevron" className="size-4 shrink-0 text-dim" />
              </Link>
            ))}
          </div>
        )
      )}

      {aba === "historico" && (
        historico.length === 0 ? (
          <EstadoVazio
            className="mt-6"
            icone="calendario"
            titulo="Nenhum registro dos motores no Diário"
            descricao="Manutenção, leitura de horas e avaria registradas no Diário de Bordo com um motor apontado aparecem aqui."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {historico.map((e) => (
              <div key={e.id} className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-3">
                <p className="rotulo-dado tabular-nums text-dim">
                  {formatarDataCurta(e.data)} · {TIPO_ROTULO[e.tipo] ?? e.tipo} · {nomeDoMotor(e.equipamento_id)}
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
            titulo="Nenhum alerta nos motores"
            descricao="Tudo que o semáforo vigia está em dia. Alerta aparece aqui quando uma manutenção vence ou encosta no prazo."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {/* ONDA 133 — vidro tintado pelo estado, na dose (a régua está em
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
                  <p className="apoio mt-0.5 text-dim">{nomeDoMotor(item.equipamento_id)}</p>
                </div>
                {estado && <Farol status={estado} />}
                <Icone nome="chevron" className="size-4 shrink-0 text-dim" />
              </Link>
            ))}
          </div>
        )
      )}
    </main>
  )
}
