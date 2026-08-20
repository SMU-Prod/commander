import Link from "next/link"
import { redirect } from "next/navigation"
import { Farol } from "@/components/farol"
import { Icone } from "@/components/icone"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { LinhaLista } from "@/components/ui/linha-lista"
import { HeroiTecnico } from "@/components/ui/heroi-tecnico"
import { carregarPainel, hojeISO, itemMonitoradoToItemCalc } from "@/lib/consultas"
import { podeEditar, podeVer } from "@/lib/domain/permissoes"
import { calcularSemaforo, formatarDataCurta, PESO, vencimentoPorData } from "@/lib/domain/semaforo"

/**
 * ONDA 101 — O HUB "MANUTENÇÕES", oitavo card da central técnica (spec §3).
 *
 * É o que a /barco chamava de "Outras manutenções": o item que vence e não
 * pertence a motor, elétrica, casco, hidráulica, segurança nem documento — o
 * que o formulário grava quando a pessoa escolhe "Embarcação (geral)" em
 * "Pertence a". Mesmo recorte do card que abre esta tela
 * (`categoria === null && equipamento_id === null`), pra porta e sala nunca
 * discordarem no número.
 *
 * ORDENADO PELO QUE APERTA PRIMEIRO, e isto é diferente da /barco, que
 * mostrava na ordem do banco: numa lista de manutenção o vencido tem que estar
 * em cima. `PESO` é a mesma escala de gravidade que o semáforo usa no app
 * inteiro; o desempate é o menor prazo. Nenhum valor muda — muda a ordem.
 *
 * Sem consulta própria: `carregarPainel` tem `cache()` e já trouxe os itens.
 */
export default async function ManutencoesPage() {
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (!podeVer(painel.permissoes, "embarcacao")) {
    redirect(`/hoje?erro=${encodeURIComponent("Seu acesso não inclui as manutenções gerais.")}`)
  }
  const editavel = podeEditar(painel.permissoes, "embarcacao")
  const hoje = hojeISO()

  const linhas = painel.itens
    .filter((i) => i.categoria === null && i.equipamento_id === null)
    .map((i) => {
      const calc = itemMonitoradoToItemCalc(i)
      return { item: i, r: calcularSemaforo(calc, null, hoje), venc: vencimentoPorData(calc) }
    })
    .sort((a, b) =>
      PESO[b.r.status] - PESO[a.r.status]
      || (a.r.diasRestantes ?? Infinity) - (b.r.diasRestantes ?? Infinity))

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref="/barco"
        voltarRotulo="Barco"
        hub="manutencoes"
        descricao="Vence, mas não é motor, elétrica, casco nem documento."
        acao={editavel ? (
          <Link
            href="/barco/itens/novo"
            className="inline-flex min-h-[var(--altura-controle)] shrink-0 items-center gap-1 rounded-[var(--raio-pilula)] bg-accent px-4 corpo font-semibold text-acao-texto"
          >
            <Icone nome="mais" className="size-4" /> Manutenção
          </Link>
        ) : undefined}
      />

      {/* ONDA 105 — o objeto grande do topo, como nas oito imagens do guia.
          É ilustração técnica, não render 3D nem foto: ver o cabeçalho de
          `components/ui/heroi-tecnico.tsx` e o desvio de biblioteca de assets
          registrado em `docs/DESIGN-SYSTEM.md`. */}
      <HeroiTecnico chave="manutencoes" className="mt-5 mb-4" />

      {linhas.length === 0 ? (
        <EstadoVazio
          className="mt-6"
          icone="relogio"
          titulo="Nenhuma outra manutenção cadastrada ainda"
          descricao="Antifouling, revisão do gerador de emergência, limpeza de tanque — qualquer coisa que vença por horas ou por data."
          acao={editavel ? { href: "/barco/itens/novo", rotulo: "Cadastrar manutenção" } : undefined}
        />
      ) : (
        <div className="sombra-1 mt-6 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
          {linhas.map(({ item, r, venc }) => {
            const dias = r.diasRestantes != null
              ? r.diasRestantes < 0 ? `vencido há ${-r.diasRestantes} d` : `${r.diasRestantes} dias`
              : "—"
            return (
              <LinhaLista
                key={item.id}
                href={editavel ? `/barco/itens/${item.id}/editar` : undefined}
                leading={<Farol status={r.status} />}
                titulo={item.nome}
                valor={`${dias}${venc ? ` · ${formatarDataCurta(venc)}` : ""}`}
                valorClassName={r.status === "vencido" ? "text-crit" : r.status === "atencao" ? "text-warn" : "text-dim"}
              />
            )
          })}
        </div>
      )}
    </main>
  )
}
