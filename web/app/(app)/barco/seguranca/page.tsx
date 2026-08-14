import Link from "next/link"
import { redirect } from "next/navigation"
import { Farol } from "@/components/farol"
import { Icone } from "@/components/icone"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { LinhaLista } from "@/components/ui/linha-lista"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { carregarPainel, hojeISO, itemMonitoradoToItemCalc } from "@/lib/consultas"
import { CATEGORIA_SEGURANCA } from "@/lib/domain/diario"
import { faroDoEstado, ROTULO_ESTADO } from "@/lib/domain/ocorrencias"
import { podeEditar, podeVer } from "@/lib/domain/permissoes"
import { calcularSemaforo, formatarDataCurta, vencimentoPorData } from "@/lib/domain/semaforo"
import { supabaseServer } from "@/lib/supabase/server"
import type { Ocorrencia } from "@/lib/db/types"

export default async function SegurancaPage() {
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (!podeVer(painel.permissoes, "seguranca")) {
    redirect(`/hoje?erro=${encodeURIComponent("Seu acesso não inclui a segurança.")}`)
  }
  const editavel = podeEditar(painel.permissoes, "seguranca")
  const hoje = hojeISO()
  const itens = painel.itens.filter((i) => i.categoria === CATEGORIA_SEGURANCA)

  const supabase = await supabaseServer()
  const { data: ocorrenciasBrutas } = await supabase.from("ocorrencias")
    .select("*").eq("embarcacao_id", painel.embarcacao.id).eq("aba", "seguranca")
    .neq("estado", "resolvida").order("created_at", { ascending: false })
  const ocorrencias = (ocorrenciasBrutas ?? []) as Ocorrencia[]

  return (
    <main>
      <Link href="/barco" className="inline-flex items-center gap-1 rotulo text-accent-forte">
        <Icone nome="voltar" className="size-4" /> Barco
      </Link>
      <div className="mt-3 flex items-baseline justify-between">
        <h1 className="titulo-pagina">Segurança</h1>
        {editavel && (
          <Link href={`/barco/itens/novo?alvo=${encodeURIComponent(`cat:${CATEGORIA_SEGURANCA}`)}`}
            className="inline-flex items-center gap-1 rounded-full bg-accent px-4 py-2 corpo font-semibold text-acao-texto">
            <Icone nome="mais" className="size-4" /> Item
          </Link>
        )}
      </div>
      <p className="apoio mt-1 text-dim">
        Colete, extintor, bengala, balsa — quantidade, validade e último teste de cada item de segurança a bordo.
      </p>

      {ocorrencias.length > 0 && (
        <>
          <SecaoPagina icone="alerta" acao={{ href: "/barco/ocorrencias?setor=seguranca", rotulo: "Ver todas" }}>
            Ocorrências abertas
          </SecaoPagina>
          <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
            {ocorrencias.map((o) => (
              <LinhaLista
                key={o.id}
                href={`/barco/ocorrencias/${o.id}`}
                leading={<Farol status={faroDoEstado(o.estado)} />}
                titulo={o.titulo}
                valor={ROTULO_ESTADO[o.estado]}
              />
            ))}
          </div>
        </>
      )}

      <SecaoPagina icone="seguranca">Itens de segurança</SecaoPagina>
      <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
        {itens.length === 0 && (
          <EstadoVazio
            variant="linha"
            icone="seguranca"
            titulo="Nenhum item de segurança cadastrado ainda"
            descricao="Cadastre coletes, extintores e balsas — o semáforo avisa antes de vencer o teste ou a validade."
            acao={editavel ? { href: `/barco/itens/novo?alvo=${encodeURIComponent(`cat:${CATEGORIA_SEGURANCA}`)}`, rotulo: "Cadastrar item" } : undefined}
          />
        )}
        {itens.map((i) => {
          const r = calcularSemaforo(itemMonitoradoToItemCalc(i), null, hoje)
          const venc = vencimentoPorData(itemMonitoradoToItemCalc(i))
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
        })}
      </div>
    </main>
  )
}
