import Link from "next/link"
import { redirect } from "next/navigation"
import { GraficoMesesGastos } from "@/components/grafico-meses-gastos"
import { Icone } from "@/components/icone"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { LinhaLista } from "@/components/ui/linha-lista"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { carregarPainel, hojeISO } from "@/lib/consultas"
import { grupoDoEvento, TIPO_ROTULO } from "@/lib/domain/diario"
import { formatarReais, resumoGastos } from "@/lib/domain/gastos"
import { podeVer } from "@/lib/domain/permissoes"
import { supabaseServer } from "@/lib/supabase/server"
import type { Evento } from "@/lib/db/types"

export default async function GastosPage() {
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (!podeVer(painel.permissoes, "gastos")) redirect("/hoje?erro=" + encodeURIComponent("Seu acesso não inclui os gastos."))
  const hoje = hojeISO()
  const inicioJanela = `${Number(hoje.slice(0, 4)) - 1}-01-01`
  const supabase = await supabaseServer()
  const { data: eventos, error } = await supabase.from("eventos")
    .select("*").eq("embarcacao_id", painel.embarcacao.id)
    .not("custo_centavos", "is", null).gte("data", inicioJanela)
    .order("data", { ascending: false })
  if (error) throw new Error("Não foi possível carregar os gastos. Recarregue a página.")

  const porId = new Map(painel.equipamentos.map((e) => [e.id, e]))
  const comCusto = ((eventos ?? []) as Evento[]).filter((e) => (e.custo_centavos ?? 0) > 0)
  const recentes = comCusto.slice(0, 20)

  // Nota fiscal anexada ao registrar o gasto — mesmo padrão de URL assinada
  // já usado em Documentos, agora aplicado aqui também.
  const urlsAnexo = new Map(
    await Promise.all(
      recentes
        .filter((e): e is Evento & { anexo_path: string } => e.anexo_path != null)
        .map(async (e) => {
          const { data } = await supabase.storage.from("acervo").createSignedUrl(e.anexo_path, 3600)
          return [e.id, data?.signedUrl ?? null] as const
        }),
    ),
  )
  const entradas = comCusto.map((e) => ({
    data: e.data,
    custoCentavos: e.custo_centavos as number,
    grupo: grupoDoEvento({
      tipo: e.tipo, categoria: e.categoria, custoCentavos: e.custo_centavos,
      tipoEquipamento: e.equipamento_id ? porId.get(e.equipamento_id)?.tipo ?? null : null,
    }),
  }))
  const r = resumoGastos(entradas, hoje)

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref="/barco"
        voltarRotulo="Barco"
        titulo="Gastos"
        acao={
          <Link href="/diario/novo" className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-acao-texto">
            <span className="inline-flex items-center gap-1">
              <Icone nome="mais" className="size-4" /> Registrar
            </span>
          </Link>
        }
      />

      <div className="sombra-1 mt-5 rounded-[14px] border border-line bg-panel p-4">
        <p className="rotulo text-dim inline-flex items-center gap-1.5">
          <Icone nome="cifrao" className="size-3.5" /> Total do mês
        </p>
        <p className="mt-1 font-mono-instr text-3xl tabular-nums">{formatarReais(r.totalMesCentavos)}</p>
        {r.porGrupo.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {r.porGrupo.map((g) => (
              <div key={g.grupo} className="corpo flex justify-between">
                <span className="text-dim">{g.grupo}</span>
                <span className="font-mono-instr tabular-nums">{formatarReais(g.totalCentavos)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <SecaoPagina icone="grafico">Últimos 6 meses</SecaoPagina>
      <GraficoMesesGastos meses={r.meses} mesAtual={hoje.slice(0, 7)} />

      <SecaoPagina>Lançamentos recentes</SecaoPagina>
      <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
        {comCusto.length === 0 && (
          <EstadoVazio
            variant="linha"
            icone="cifrao"
            titulo="Nenhum gasto registrado"
            descricao="Registre custos nos eventos do diário e eles aparecem aqui."
          />
        )}
        {recentes.map((e) => {
          const urlAnexo = e.anexo_path ? urlsAnexo.get(e.id) : null
          return (
            <LinhaLista
              key={e.id}
              titulo={e.descricao ?? TIPO_ROTULO[e.tipo] ?? e.tipo}
              subtitulo={
                <>
                  <span className="font-mono-instr text-[11px] tabular-nums">{e.data.split("-").reverse().join("/")}</span>
                  {urlAnexo && (
                    <a href={urlAnexo} target="_blank" rel="noopener noreferrer" className="ml-2 text-accent-forte">
                      Abrir anexo
                    </a>
                  )}
                </>
              }
              valor={formatarReais(e.custo_centavos as number)}
            />
          )
        })}
      </div>
    </main>
  )
}
