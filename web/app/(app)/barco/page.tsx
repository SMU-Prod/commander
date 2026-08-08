import Link from "next/link"
import { redirect } from "next/navigation"
import { Farol } from "@/components/farol"
import { CardEmbarcacao } from "@/components/card-embarcacao"
import { Horimetro } from "@/components/horimetro"
import { Icone } from "@/components/icone"
import { abaDoItem, CATEGORIAS_CASCO, ROTULO_CASCO } from "@/lib/domain/diario"
import { calcularSemaforo, formatarDataCurta, PESO, vencimentoPorData, type StatusFarol } from "@/lib/domain/semaforo"
import { carregarPainel, carregarSelo, hojeISO, itemMonitoradoToItemCalc } from "@/lib/consultas"
import { podeVer, podeEditar, type Aba } from "@/lib/domain/permissoes"
import { supabaseServer } from "@/lib/supabase/server"

export default async function BarcoPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>
}) {
  const { erro } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const { embarcacao, equipamentos, itens, papel, permissoes } = painel
  const hoje = hojeISO()
  const selo = await carregarSelo()

  const statusDoEquipamento = (eqId: string): StatusFarol =>
    itens
      .filter((i) => i.equipamento_id === eqId)
      .map((i) => {
        const eq = equipamentos.find((e) => e.id === eqId)
        return calcularSemaforo(itemMonitoradoToItemCalc(i), eq?.horas_atuais ?? null, hoje).status
      })
      .sort((a, b) => PESO[b] - PESO[a])[0] ?? "ok"

  const motores = equipamentos.filter((e) => e.tipo === "motor")
  // Duas coisas diferentes que moravam na mesma seção: documentos (categoria
  // "documento") e itens gerais da embarcação, sem motor/elétrica/casco/
  // documento — o item "Embarcação (geral)" do formulário cai aqui.
  const documentos = itens.filter((i) => i.categoria === "documento")
  const outrasManutencoes = itens.filter((i) => i.categoria === null && i.equipamento_id === null)

  const statusGeral: StatusFarol =
    itens
      .map((i) => {
        const eq = equipamentos.find((e) => e.id === i.equipamento_id)
        return calcularSemaforo(itemMonitoradoToItemCalc(i), eq?.horas_atuais ?? null, hoje).status
      })
      .sort((a, b) => PESO[b] - PESO[a])[0] ?? "ok"

  const supabase = await supabaseServer()
  const urlCapa = embarcacao.foto_capa_path
    ? (await supabase.storage.from("acervo").createSignedUrl(embarcacao.foto_capa_path, 3600)).data?.signedUrl ?? null
    : null

  return (
    <main>
      {erro && <p className="corpo mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}
      <CardEmbarcacao
        embarcacao={embarcacao}
        statusGeral={statusGeral}
        urlCapa={urlCapa}
        podeEditarFotos={podeEditar(permissoes, "fotos")}
      />

      <div className="mt-6 mb-2 flex items-baseline justify-between">
        <p className="rotulo flex items-center gap-1.5 text-dim">
          <Icone nome="motor" className="size-3.5" /> Motores
        </p>
        {podeEditar(permissoes, "motores") && (
          <Link href="/barco/equipamento/novo?tipo=motor" className="corpo inline-flex items-center gap-1 text-accent-forte">
            <Icone nome="mais" className="size-4" /> Motor
          </Link>
        )}
      </div>
      {motores.length === 0 && (
        <p className="apoio text-dim">Nenhum motor cadastrado ainda.</p>
      )}
      <div className="grid grid-cols-2 gap-2">
        {motores.map((m) => (
          <Link key={m.id} href={`/barco/equipamento/${m.id}`}>
            <Horimetro
              rotulo={m.posicao ?? "Motor"}
              horas={m.horas_atuais}
              status={statusDoEquipamento(m.id)}
            />
          </Link>
        ))}
      </div>

      <div className="mt-6 mb-2 flex items-baseline justify-between">
        <p className="rotulo flex items-center gap-1.5 text-dim">
          <Icone nome="raio" className="size-3.5" /> Elétrica
        </p>
        <Link href="/barco/eletrica" className="corpo text-accent-forte">Ver tudo</Link>
      </div>
      <Link href="/barco/eletrica" className="sombra-1 block rounded-[14px] border border-line bg-panel p-3.5">
        <p className="titulo-card">
          {equipamentos.filter((e) => e.tipo !== "motor").length === 0
            ? "Cadastre gerador e baterias"
            : `${equipamentos.filter((e) => e.tipo !== "motor").length} equipamentos`}
        </p>
        <p className="apoio mt-0.5 text-dim">Manutenção do gerador, troca das baterias e painel de bordo</p>
      </Link>

      <p className="rotulo text-dim mt-6 mb-2 inline-flex items-center gap-1.5">
        <Icone nome="escudo" className="size-3.5" /> Casco
      </p>
      <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
        {CATEGORIAS_CASCO.map((c) => {
          const doGrupo = itens.filter((i) => i.categoria === c)
          const status = doGrupo
            .map((i) => calcularSemaforo(itemMonitoradoToItemCalc(i), null, hoje).status)
            .sort((a, b) => PESO[b] - PESO[a])[0]
          return (
            <div key={c} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
              {status ? <Farol status={status} /> : <span className="size-2 rounded-full border border-line" />}
              <span className="corpo flex-1">{ROTULO_CASCO[c]}</span>
              {doGrupo.length === 0 ? (
                <Link href={`/barco/itens/novo?alvo=${encodeURIComponent(`cat:${c}`)}`} className="text-xs text-accent-forte">
                  Adicionar
                </Link>
              ) : (
                <span className="font-mono-instr text-xs tabular-nums text-dim">{doGrupo.length} itens</span>
              )}
            </div>
          )
        })}
      </div>

      <p className="rotulo text-dim mt-6 mb-2 inline-flex items-center gap-1.5">
        <Icone nome="documento" className="size-3.5" /> Documentos
      </p>
      <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
        {documentos.length === 0 && (
          <p className="corpo py-4 text-dim">Nenhum documento com vencimento cadastrado ainda.</p>
        )}
        {documentos.map((i) => {
          const r = calcularSemaforo(itemMonitoradoToItemCalc(i), null, hoje)
          const venc = vencimentoPorData(itemMonitoradoToItemCalc(i))
          const editavelItem = podeEditar(permissoes, abaDoItem(i, equipamentos))
          return (
            <div key={i.id} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
              <Farol status={r.status} />
              {editavelItem ? (
                <Link href={`/barco/itens/${i.id}/editar`} className="corpo flex-1">{i.nome}</Link>
              ) : (
                <span className="corpo flex-1">{i.nome}</span>
              )}
              <span className="font-mono-instr text-xs tabular-nums text-dim">
                {r.diasRestantes != null
                  ? r.diasRestantes < 0
                    ? `vencido há ${-r.diasRestantes} d`
                    : `${r.diasRestantes} dias`
                  : "—"}
                {venc ? ` · ${formatarDataCurta(venc)}` : ""}
              </span>
            </div>
          )
        })}
      </div>

      <div className="mt-6 mb-2 flex items-baseline justify-between">
        <p className="rotulo flex items-center gap-1.5 text-dim">
          <Icone nome="ferramenta" className="size-3.5" /> Outras manutenções
        </p>
        {podeEditar(permissoes, "embarcacao") && (
          <Link href="/barco/itens/novo" className="corpo inline-flex items-center gap-1 text-accent-forte">
            <Icone nome="mais" className="size-4" /> Manutenção
          </Link>
        )}
      </div>
      <p className="apoio -mt-1 mb-2 text-dim">Vence, mas não é motor, elétrica, casco nem documento.</p>
      <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
        {outrasManutencoes.length === 0 && (
          <p className="corpo py-4 text-dim">Nenhuma outra manutenção cadastrada ainda.</p>
        )}
        {outrasManutencoes.map((i) => {
          const r = calcularSemaforo(itemMonitoradoToItemCalc(i), null, hoje)
          const venc = vencimentoPorData(itemMonitoradoToItemCalc(i))
          const editavelItem = podeEditar(permissoes, abaDoItem(i, equipamentos))
          return (
            <div key={i.id} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
              <Farol status={r.status} />
              {editavelItem ? (
                <Link href={`/barco/itens/${i.id}/editar`} className="corpo flex-1">{i.nome}</Link>
              ) : (
                <span className="corpo flex-1">{i.nome}</span>
              )}
              <span className="font-mono-instr text-xs tabular-nums text-dim">
                {r.diasRestantes != null
                  ? r.diasRestantes < 0
                    ? `vencido há ${-r.diasRestantes} d`
                    : `${r.diasRestantes} dias`
                  : "—"}
                {venc ? ` · ${formatarDataCurta(venc)}` : ""}
              </span>
            </div>
          )
        })}
      </div>

      <p className="rotulo text-dim mt-6 mb-2 inline-flex items-center gap-1.5">
        <Icone nome="imagem" className="size-3.5" /> Ferramentas do dia a dia
      </p>
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            { href: "/barco/documentos", rotulo: "Documentos", desc: "validade e arquivos", aba: "documentos" },
            { href: "/barco/gastos", rotulo: "Gastos", desc: "custos por mês", aba: "gastos" },
            { href: "/diario", rotulo: "Diário de Bordo", desc: "todo o histórico" },
            { href: "/barco/fotos", rotulo: "Fotos", desc: "álbuns do barco", aba: "fotos" },
            { href: "/barco/contatos", rotulo: "Contatos", desc: "quem cuida do barco", aba: "contatos" },
          ] as { href: string; rotulo: string; desc: string; aba?: Aba }[]
        )
          .filter((c) => !c.aba || podeVer(permissoes, c.aba))
          .map((c) => (
            <Link key={c.href} href={c.href} className="sombra-1 rounded-[14px] border border-line bg-panel p-3.5">
              <p className="titulo-card">{c.rotulo}</p>
              <p className="apoio mt-0.5 text-dim">{c.desc}</p>
            </Link>
          ))}
      </div>

      {selo && (
        <Link
          href="/barco/selo"
          className="sombra-1 mt-6 block rounded-[14px] border border-line bg-panel p-3.5"
        >
          <div className="flex items-center justify-between">
            <p className="titulo-card inline-flex items-center gap-1.5">
              <Icone nome="selo" className="size-4" /> Selo Ouro
            </p>
            <span className="font-mono-instr text-xs tabular-nums text-dim">
              {selo.completos} de {selo.total}
            </span>
          </div>
          <p className="apoio mt-0.5 text-dim">
            {selo.percentual}% do checklist de completude — quanto mais completo, mais o
            histórico vale na hora de vender.
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-panel2">
            <div
              className="h-full rounded-full bg-accent-forte"
              style={{ width: `${Math.max(2, selo.percentual)}%` }}
            />
          </div>
        </Link>
      )}

      <div className="mt-6 flex items-baseline justify-between">
        <p className="rotulo flex items-center gap-1.5 text-dim">
          <Icone nome="embarcacao" className="size-3.5" /> Dados gerais
        </p>
        {papel === "PROP" && (
          <Link href="/barco/editar" className="corpo text-accent-forte">Editar</Link>
        )}
      </div>
      <div className="sombra-1 rounded-[14px] border border-line bg-panel p-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          {([
            ["Comprimento", embarcacao.comprimento_m != null ? `${embarcacao.comprimento_m.toLocaleString("pt-BR")} m` : null],
            ["Boca", embarcacao.boca_m != null ? `${embarcacao.boca_m.toLocaleString("pt-BR")} m` : null],
            ["Calado", embarcacao.calado_m != null ? `${embarcacao.calado_m.toLocaleString("pt-BR")} m` : null],
            ["Casco", [embarcacao.casco_material, embarcacao.casco_numero].filter(Boolean).join(" · ") || null],
            ["Propulsão", embarcacao.propulsao],
            ["TIE", embarcacao.tie],
            ["Capitania", embarcacao.capitania],
          ] as [string, string | null][]).map(([nome, valor]) => (
            <div key={nome}>
              <dt className="rotulo text-dim">{nome}</dt>
              <dd className="corpo mt-0.5">{valor ?? <span className="text-dim">—</span>}</dd>
            </div>
          ))}
        </dl>
      </div>

      {papel === "PROP" && (
        <Link href="/barco/local" className="sombra-1 mt-6 block rounded-[14px] border border-line bg-panel p-3.5">
          <p className="titulo-card">Posição da marina</p>
          <p className="apoio mt-0.5 text-dim">
            {embarcacao.marina_lat != null && embarcacao.marina_lon != null
              ? `${embarcacao.marina_lat.toFixed(4)}, ${embarcacao.marina_lon.toFixed(4)}`
              : "Defina para ligar o boletim do mar"}
          </p>
        </Link>
      )}
    </main>
  )
}
