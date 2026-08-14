import Link from "next/link"
import { redirect } from "next/navigation"
import { Farol } from "@/components/farol"
import { CardEmbarcacao } from "@/components/card-embarcacao"
import { Horimetro } from "@/components/horimetro"
import { Icone } from "@/components/icone"
import { SeloGold } from "@/components/selos/selo-gold"
import { SeloVerified } from "@/components/selos/selo-verified"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { LinhaLista } from "@/components/ui/linha-lista"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { abaDoItem, CATEGORIAS_CASCO, ROTULO_CASCO } from "@/lib/domain/diario"
import { calcularSemaforo, formatarDataCurta, PESO, vencimentoPorData, type StatusFarol } from "@/lib/domain/semaforo"
import { carregarPainel, carregarVerified, hojeISO, itemMonitoradoToItemCalc } from "@/lib/consultas"
import { carregarSeloGold } from "@/lib/consultas-gold"
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
  const [verified, seloGold] = await Promise.all([carregarVerified(), carregarSeloGold(embarcacao.id)])

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

      <SecaoPagina icone="motor" acao={podeEditar(permissoes, "motores") ? { href: "/barco/equipamento/novo?tipo=motor", rotulo: "Motor", icone: "mais" } : undefined}>
        Motores
      </SecaoPagina>
      {motores.length === 0 && (
        <EstadoVazio
          icone="motor"
          titulo="Nenhum motor cadastrado ainda"
          descricao="Cadastre pra ganhar horímetro e checklist de manutenção automáticos."
          className="mb-2"
        />
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

      <SecaoPagina icone="raio" acao={{ href: "/barco/eletrica", rotulo: "Ver tudo" }}>
        Elétrica
      </SecaoPagina>
      <LinhaLista
        href="/barco/eletrica"
        variant="cartao"
        leading={<Icone nome="raio" className="size-5 shrink-0 text-dim" />}
        titulo={
          equipamentos.filter((e) => e.tipo !== "motor").length === 0
            ? "Cadastre gerador e baterias"
            : `${equipamentos.filter((e) => e.tipo !== "motor").length} equipamentos`
        }
        subtitulo="Manutenção do gerador, troca das baterias e painel de bordo"
      />

      {podeVer(permissoes, "hidraulica") && (
        <LinhaLista
          href="/barco/hidraulica"
          variant="cartao"
          className="mt-2"
          leading={<Icone nome="hidraulica" className="size-5 shrink-0 text-dim" />}
          titulo="Hidráulica"
          subtitulo="Água doce, Grey Water e Black Water"
        />
      )}
      {podeVer(permissoes, "seguranca") && (
        <LinhaLista
          href="/barco/seguranca"
          variant="cartao"
          className="mt-2"
          leading={<Icone nome="seguranca" className="size-5 shrink-0 text-dim" />}
          titulo="Segurança"
          subtitulo="Coletes, extintores, balsa — validade e último teste"
        />
      )}

      <SecaoPagina icone="escudo">Casco</SecaoPagina>
      <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
        {CATEGORIAS_CASCO.map((c) => {
          const doGrupo = itens.filter((i) => i.categoria === c)
          const status = doGrupo
            .map((i) => calcularSemaforo(itemMonitoradoToItemCalc(i), null, hoje).status)
            .sort((a, b) => PESO[b] - PESO[a])[0]
          return (
            <LinhaLista
              key={c}
              leading={status ? <Farol status={status} /> : <span className="size-2 rounded-full border border-line" />}
              titulo={ROTULO_CASCO[c]}
              trailing={
                doGrupo.length === 0 ? (
                  <Link href={`/barco/itens/novo?alvo=${encodeURIComponent(`cat:${c}`)}`} className="shrink-0 text-xs text-accent-forte">
                    Adicionar
                  </Link>
                ) : (
                  <span className="shrink-0 font-mono-instr text-xs tabular-nums text-dim">{doGrupo.length} itens</span>
                )
              }
            />
          )
        })}
      </div>

      <SecaoPagina icone="documento">Documentos</SecaoPagina>
      <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
        {documentos.length === 0 && (
          <EstadoVazio
            variant="linha"
            icone="documento"
            titulo="Nenhum documento com vencimento cadastrado"
            descricao="Seguro, TIE, vistoria — cadastre a validade e o semáforo avisa antes de vencer."
            acao={podeEditar(permissoes, "documentos") ? { href: "/barco/documentos", rotulo: "Adicionar documento" } : undefined}
          />
        )}
        {documentos.map((i) => {
          const r = calcularSemaforo(itemMonitoradoToItemCalc(i), null, hoje)
          const venc = vencimentoPorData(itemMonitoradoToItemCalc(i))
          const editavelItem = podeEditar(permissoes, abaDoItem(i, equipamentos))
          const dias = r.diasRestantes != null
            ? r.diasRestantes < 0 ? `vencido há ${-r.diasRestantes} d` : `${r.diasRestantes} dias`
            : "—"
          return (
            <LinhaLista
              key={i.id}
              href={editavelItem ? `/barco/itens/${i.id}/editar` : undefined}
              leading={<Farol status={r.status} />}
              titulo={i.nome}
              valor={`${dias}${venc ? ` · ${formatarDataCurta(venc)}` : ""}`}
              valorClassName={r.status === "vencido" ? "text-crit" : r.status === "atencao" ? "text-warn" : "text-dim"}
            />
          )
        })}
      </div>

      <SecaoPagina icone="ferramenta" acao={podeEditar(permissoes, "embarcacao") ? { href: "/barco/itens/novo", rotulo: "Manutenção", icone: "mais" } : undefined}>
        Outras manutenções
      </SecaoPagina>
      <p className="apoio -mt-1 mb-2 text-dim">Vence, mas não é motor, elétrica, casco nem documento.</p>
      <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
        {outrasManutencoes.length === 0 && (
          <EstadoVazio variant="linha" icone="ferramenta" titulo="Nenhuma outra manutenção cadastrada ainda" />
        )}
        {outrasManutencoes.map((i) => {
          const r = calcularSemaforo(itemMonitoradoToItemCalc(i), null, hoje)
          const venc = vencimentoPorData(itemMonitoradoToItemCalc(i))
          const editavelItem = podeEditar(permissoes, abaDoItem(i, equipamentos))
          const dias = r.diasRestantes != null
            ? r.diasRestantes < 0 ? `vencido há ${-r.diasRestantes} d` : `${r.diasRestantes} dias`
            : "—"
          return (
            <LinhaLista
              key={i.id}
              href={editavelItem ? `/barco/itens/${i.id}/editar` : undefined}
              leading={<Farol status={r.status} />}
              titulo={i.nome}
              valor={`${dias}${venc ? ` · ${formatarDataCurta(venc)}` : ""}`}
              valorClassName={r.status === "vencido" ? "text-crit" : r.status === "atencao" ? "text-warn" : "text-dim"}
            />
          )
        })}
      </div>

      <SecaoPagina icone="imagem">Ferramentas do dia a dia</SecaoPagina>
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            { href: "/barco/documentos", rotulo: "Documentos", desc: "validade e arquivos", aba: "documentos" },
            { href: "/barco/gastos", rotulo: "Gastos", desc: "custos por mês", aba: "gastos" },
            { href: "/diario", rotulo: "Diário de Bordo", desc: "registrar saídas e serviços" },
            { href: "/barco/ocorrencias", rotulo: "Ocorrências", desc: "abertas, em curso, resolvidas" },
            { href: "/barco/historico", rotulo: "Histórico", desc: "tudo, num lugar só", aba: "historico" },
            { href: "/barco/resumos", rotulo: "Resumos", desc: "relatório do período, em PDF", aba: "historico" },
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

      <SecaoPagina icone="escudo" acao={{ href: "/barco/selos", rotulo: "Ver tudo" }}>
        Selos Commander
      </SecaoPagina>
      <Link
        href="/barco/selos"
        className="sombra-1 block rounded-[14px] border border-line bg-panel p-3.5"
      >
        <div className="flex items-center justify-between">
          <p className="titulo-card inline-flex items-center gap-1.5">
            <SeloVerified size={18} /> Commander Verified
          </p>
          {verified && (
            <span className="font-mono-instr text-xs tabular-nums text-dim">
              {verified.completos} de {verified.total}
            </span>
          )}
        </div>
        {verified && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-panel2">
            <div
              className="h-full rounded-full bg-dim"
              style={{ width: `${Math.max(2, verified.percentual)}%` }}
            />
          </div>
        )}
        <p className="apoio mt-2 inline-flex items-center gap-1.5 text-dim">
          <SeloGold size={16} variant={seloGold ? "ativo" : "convite"} /> Commander Gold — avaliação
          presencial, não depende do Verified.
        </p>
      </Link>

      <Link
        href="/barco/connect"
        className="sombra-1 mt-2 block rounded-[14px] border border-line bg-panel p-3.5"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="titulo-card inline-flex items-center gap-1.5">
            <Icone nome="sinal" className="size-4 text-dim" /> Commander Connect
          </p>
          <span className="shrink-0 rounded-full border border-line bg-panel2 px-2 py-0.5 font-mono-instr text-[10px] uppercase tracking-[.1em] text-dim-chip">
            Em breve
          </span>
        </div>
        <p className="apoio mt-0.5 text-dim">Conectividade NMEA 2000 pro diário automático.</p>
      </Link>

      <SecaoPagina icone="embarcacao" acao={papel === "PROP" ? { href: "/barco/editar", rotulo: "Editar" } : undefined}>
        Dados gerais
      </SecaoPagina>
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
        <LinhaLista
          href="/barco/local"
          variant="cartao"
          className="mt-6"
          leading={<Icone nome="mapa" className="size-5 shrink-0 text-dim" />}
          titulo="Posição da marina"
          subtitulo={
            embarcacao.marina_lat != null && embarcacao.marina_lon != null
              ? `${embarcacao.marina_lat.toFixed(4)}, ${embarcacao.marina_lon.toFixed(4)}`
              : "Defina para ligar o boletim do mar"
          }
        />
      )}
    </main>
  )
}
