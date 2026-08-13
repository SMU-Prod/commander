import { redirect } from "next/navigation"
import { Farol } from "@/components/farol"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { Campo } from "@/components/ui/campo"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { LinhaLista } from "@/components/ui/linha-lista"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { anexarArquivo, criarDocumento, excluirDocumento } from "@/lib/acoes/documentos"
import { carregarPainel, hojeISO, itemMonitoradoToItemCalc } from "@/lib/consultas"
import { podeEditar, podeVer } from "@/lib/domain/permissoes"
import { calcularSemaforo, vencimentoPorData } from "@/lib/domain/semaforo"
import { supabaseServer } from "@/lib/supabase/server"
import { Confirmar } from "@/components/confirmar"
import type { Documento } from "@/lib/db/types"

export default async function DocumentosPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (!podeVer(painel.permissoes, "documentos")) redirect("/hoje?erro=" + encodeURIComponent("Seu acesso não inclui os documentos."))
  const editavel = podeEditar(painel.permissoes, "documentos")
  const supabase = await supabaseServer()
  const { data: docs } = await supabase.from("documentos")
    .select("*").eq("embarcacao_id", painel.embarcacao.id).order("created_at")

  const hoje = hojeISO()
  const itensDocumento = painel.itens.filter((i) => i.categoria === "documento")
  const docPorItem = new Map(((docs ?? []) as Documento[]).filter((d) => d.item_monitorado_id)
    .map((d) => [d.item_monitorado_id as string, d]))
  const avulsos = ((docs ?? []) as Documento[]).filter((d) => !d.item_monitorado_id)

  const linkAssinado = async (path: string) => {
    const { data } = await supabase.storage.from("acervo").createSignedUrl(path, 3600)
    return data?.signedUrl ?? null
  }

  return (
    <main>
      <CabecalhoDetalhe voltarHref="/barco" voltarRotulo="Barco" titulo="Documentos" />
      {erro && <p className="mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 corpo">{erro}</p>}

      <SecaoPagina icone="documento" className="mt-5">Com vencimento</SecaoPagina>
      <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
        {itensDocumento.length === 0 && (
          <EstadoVazio
            variant="linha"
            icone="documento"
            titulo="Nenhum documento com vencimento cadastrado"
            descricao={editavel ? "Cadastre abaixo pra o semáforo avisar antes de vencer." : undefined}
          />
        )}
        {await Promise.all(itensDocumento.map(async (i) => {
          const r = calcularSemaforo(itemMonitoradoToItemCalc(i), null, hoje)
          const doc = docPorItem.get(i.id)
          const url = doc?.arquivo_path ? await linkAssinado(doc.arquivo_path) : null
          // mesma regra da ficha: o vencimento pode vir de data fixa OU de
          // último ciclo + intervalo em meses. Lendo só `data_fixa`, esta tela
          // dizia "sem data" para item que a ficha mostrava com data — duas
          // telas discordando sobre o mesmo dado.
          const venc = vencimentoPorData(itemMonitoradoToItemCalc(i))
          const subtitulo = [
            venc ? `vence ${venc.split("-").reverse().join("/")}` : "sem data",
            r.diasRestantes != null && r.diasRestantes >= 0 ? `${r.diasRestantes} dias` : null,
            r.diasRestantes != null && r.diasRestantes < 0 ? `vencido há ${-r.diasRestantes} dias` : null,
          ].filter(Boolean).join(" · ")
          return (
            <LinhaLista
              key={i.id}
              href={editavel ? `/barco/itens/${i.id}/editar` : undefined}
              leading={<Farol status={r.status} />}
              titulo={i.nome}
              subtitulo={subtitulo}
              trailing={
                url ? (
                  <a href={url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-sm text-accent-forte">Abrir</a>
                ) : (
                  <form action={anexarArquivo} className="flex shrink-0 items-center gap-2">
                    <input type="hidden" name="item_id" value={i.id} />
                    <label className="cursor-pointer text-sm text-accent-forte">
                      Anexar
                      <input type="file" name="arquivo" accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" />
                    </label>
                    <button className="apoio rounded-lg border border-line px-2.5 py-1 text-dim">Enviar</button>
                  </form>
                )
              }
            />
          )
        }))}
      </div>

      {avulsos.length > 0 && (
        <>
          <SecaoPagina icone="imagem">Arquivos sem vencimento</SecaoPagina>
          <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
            {await Promise.all(avulsos.map(async (d) => {
              const url = d.arquivo_path ? await linkAssinado(d.arquivo_path) : null
              return (
                <LinhaLista
                  key={d.id}
                  titulo={d.nome}
                  trailing={
                    <div className="flex shrink-0 items-center gap-3">
                      {url && <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-accent-forte">Abrir</a>}
                      <form action={excluirDocumento}>
                        <input type="hidden" name="documento_id" value={d.id} />
                        <Confirmar mensagem="Excluir documento?" rotulo="Excluir" className="flex h-11 items-center text-xs text-crit" />
                      </form>
                    </div>
                  }
                />
              )
            }))}
          </div>
        </>
      )}

      <SecaoPagina icone="mais">Novo documento</SecaoPagina>
      <form action={criarDocumento} className="sombra-1 space-y-3 rounded-[14px] border border-line bg-panel p-4">
        <Campo label="Nome" id="nome" name="nome" required list="tipos-doc" placeholder="Ex.: Seguro da embarcação">
          <datalist id="tipos-doc">
            <option value="Seguro da embarcação" /><option value="TIE" />
            <option value="Vistoria da Marinha" /><option value="Licença de navegação" />
            <option value="Certificado de segurança" /><option value="Documento de propriedade" />
          </datalist>
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Vence em — opcional" id="validade" name="validade" type="date" />
          <Campo label="Arquivo — opcional" id="arquivo" name="arquivo" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="py-2.5 text-sm" />
        </div>
        <button className="w-full rounded-xl bg-accent py-3 font-semibold text-acao-texto">Salvar documento</button>
      </form>
    </main>
  )
}
