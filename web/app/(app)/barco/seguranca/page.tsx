import Link from "next/link"
import { redirect } from "next/navigation"
import { Farol, FarolOcorrencia } from "@/components/farol"
import { Icone } from "@/components/icone"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { LinhaLista } from "@/components/ui/linha-lista"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { carregarPainel, hojeISO, itemMonitoradoToItemCalc } from "@/lib/consultas"
import { CATEGORIA_SEGURANCA } from "@/lib/domain/diario"
import { ESTADOS_QUE_PESAM_NA_SAUDE, ROTULO_ESTADO } from "@/lib/domain/ocorrencias"
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
    .in("estado", [...ESTADOS_QUE_PESAM_NA_SAUDE]).order("created_at", { ascending: false })
  const ocorrencias = (ocorrenciasBrutas ?? []) as Ocorrencia[]

  return (
    <main>
      {/* ONDA 104 (§8 do Guia) — cabeçalho padrão, com a identidade do hub. */}
      <CabecalhoDetalhe
        voltarHref="/barco"
        voltarRotulo="Barco"
        hub="seguranca"
        descricao="Colete, extintor, bengala, balsa — quantidade, validade e último teste de cada item de segurança a bordo."
        acao={editavel ? (
          <Link
            href={`/barco/itens/novo?alvo=${encodeURIComponent(`cat:${CATEGORIA_SEGURANCA}`)}`}
            className="inline-flex min-h-[var(--altura-controle)] shrink-0 items-center gap-1 rounded-[var(--raio-pilula)] bg-accent px-4 corpo font-semibold text-acao-texto"
          >
            <Icone nome="mais" className="size-4" /> Item
          </Link>
        ) : undefined}
      />

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

      <SecaoPagina icone="seguranca">Itens de segurança</SecaoPagina>
      <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
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
