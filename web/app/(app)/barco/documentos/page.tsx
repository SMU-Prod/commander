import Link from "next/link"
import { redirect } from "next/navigation"
import { Farol } from "@/components/farol"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { Campo } from "@/components/ui/campo"
import { CampoArquivo } from "@/components/ui/campo-arquivo"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { LinhaLista } from "@/components/ui/linha-lista"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { Selo } from "@/components/ui/selo"
import { anexarArquivo, criarDocumento, excluirDocumento } from "@/lib/acoes/documentos"
import { carregarPainel, hojeISO, itemMonitoradoToItemCalc } from "@/lib/consultas"
import { indiceDoDestaque, resumoDosDocumentos } from "@/lib/domain/documentos"
import { podeEditar, podeVer } from "@/lib/domain/permissoes"
import {
  calcularSemaforo, formatarDataCurta, formatarDataCurtaComAno, PESO, vencimentoPorData,
} from "@/lib/domain/semaforo"
import { supabaseServer } from "@/lib/supabase/server"
import { Confirmar } from "@/components/confirmar"
import type { Documento } from "@/lib/db/types"

const ACEITA_ARQUIVO = "application/pdf,image/jpeg,image/png,image/webp"

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

  // Canvas tela-3d — a lista ordena pior primeiro (MESMO `PESO` do semáforo,
  // nenhuma régua nova) e o vencido há mais tempo SAI da lista pra virar o
  // cartão de destaque: é o único documento que exige algo hoje.
  // O vencimento pode vir de data fixa OU de último ciclo + intervalo em
  // meses — `vencimentoPorData` é a mesma régua da ficha (não ler só
  // `data_fixa`, que fazia duas telas discordarem do mesmo dado).
  const avaliados = itensDocumento
    .map((i) => {
      const calc = itemMonitoradoToItemCalc(i)
      return { item: i, r: calcularSemaforo(calc, null, hoje), venc: vencimentoPorData(calc) }
    })
    .sort((a, b) => PESO[b.r.status] - PESO[a.r.status])
  const idxDestaque = indiceDoDestaque(avaliados.map((a) => a.r))
  const destaque = idxDestaque != null ? avaliados[idxDestaque] : null
  const restantes = avaliados.filter((_, i) => i !== idxDestaque)

  const docDestaque = destaque ? docPorItem.get(destaque.item.id) : undefined
  const urlDestaque = docDestaque?.arquivo_path ? await linkAssinado(docDestaque.arquivo_path) : null

  const resumo = resumoDosDocumentos(
    avaliados.length + avulsos.length,
    avaliados.filter((a) => a.venc != null).length,
    avaliados.filter((a) => a.r.status === "vencido").length,
    avaliados.filter((a) => a.r.status === "atencao").length,
  )

  return (
    <main>
      <CabecalhoDetalhe voltarHref="/barco" voltarRotulo="Barco" titulo="Documentos" descricao={resumo ?? undefined} />
      {erro && <p className="mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 corpo">{erro}</p>}

      {/* O cartão do vencido (canvas tela-3d): borda lateral crítica, a
          palavra no selo e as duas ações — ver o arquivo que está lá e
          anexar o novo. O gate `editavel` vale aqui como na lista: quem só
          vê, não anexa. */}
      {destaque && (
        <div className="sombra-1 mt-4 rounded-[var(--raio-cartao)] border border-line border-l-2 border-l-crit bg-panel p-3.5">
          <div className="flex items-center gap-2.5">
            {editavel ? (
              <Link href={`/barco/itens/${destaque.item.id}/editar`} className="titulo-card min-w-0 flex-1 truncate">
                {destaque.item.nome}
              </Link>
            ) : (
              <p className="titulo-card min-w-0 flex-1 truncate">{destaque.item.nome}</p>
            )}
            <Selo estado="critico">Vencido</Selo>
          </div>
          <p className="apoio mt-1.5 text-dim">
            {destaque.venc ? (
              <>
                Venceu em{" "}
                <span className="font-mono-instr tabular-nums text-crit">
                  {destaque.venc.split("-").reverse().join("/")}
                </span>
              </>
            ) : (
              "Vencido"
            )}
            {docDestaque?.arquivo_path ? " · arquivo anexado" : " · sem arquivo anexado"}
          </p>
          {(urlDestaque || editavel) && (
            <div className="mt-3 flex gap-2">
              {urlDestaque && (
                <a
                  href={urlDestaque}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-11 flex-1 items-center justify-center rounded-[var(--raio-controle)] border border-line text-sm font-medium"
                >
                  Ver arquivo
                </a>
              )}
              {editavel && (
                <form action={anexarArquivo} className="flex flex-1 items-center gap-2">
                  <input type="hidden" name="item_id" value={destaque.item.id} />
                  <label className="flex h-11 flex-1 cursor-pointer items-center justify-center rounded-[var(--raio-controle)] bg-accent text-sm font-semibold text-acao-texto">
                    {docDestaque?.arquivo_path ? "Anexar novo" : "Anexar arquivo"}
                    <input type="file" name="arquivo" accept={ACEITA_ARQUIVO} className="sr-only" />
                  </label>
                  <button className="apoio h-11 shrink-0 rounded-[var(--raio-controle)] border border-line px-3 text-dim">
                    Enviar
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      )}

      <SecaoPagina icone="documento" className={destaque ? undefined : "mt-5"}>Todos os documentos</SecaoPagina>
      <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
        {restantes.length === 0 && avulsos.length === 0 && (
          <EstadoVazio
            variant="linha"
            icone="documento"
            titulo={destaque ? "Nenhum outro documento cadastrado" : "Nenhum documento cadastrado ainda"}
            descricao={editavel && !destaque ? "Cadastre abaixo pra o semáforo avisar antes de vencer." : undefined}
          />
        )}
        {await Promise.all(restantes.map(async ({ item: i, r, venc }) => {
          const doc = docPorItem.get(i.id)
          const url = doc?.arquivo_path ? await linkAssinado(doc.arquivo_path) : null
          const hrefEditar = editavel ? `/barco/itens/${i.id}/editar` : undefined

          // Canvas: item SEM data de validade não finge estado — ponto
          // vazado e "Completar" no lugar da data (a mesma confissão da
          // ficha de equipamento).
          if (venc == null) {
            return (
              <LinhaLista
                key={i.id}
                href={hrefEditar}
                leading={<span aria-label="sem data de validade" className="inline-block size-2 shrink-0 rounded-full border border-dim/60 bg-transparent" />}
                titulo={i.nome}
                subtitulo="Sem data de validade informada"
                trailing={editavel ? <span className="apoio shrink-0 font-medium text-accent-forte">Completar</span> : undefined}
              />
            )
          }

          // Vencimento longe (ok): data completa dd/mm/aa, sem contagem.
          // Na margem ou vencido: dd/mm colorido + os dias embaixo — a
          // anatomia da coluna direita do canvas. "Abrir"/"Anexar" moram na
          // mesma coluna, abaixo da data, pra nenhuma função se perder.
          const dataTxt = r.status === "ok" ? formatarDataCurtaComAno(venc) : formatarDataCurta(venc)
          const corData = r.status === "vencido" ? "text-crit" : r.status === "atencao" ? "text-warn" : ""
          const diasTxt =
            r.diasRestantes != null && r.status !== "ok"
              ? r.diasRestantes < 0
                ? `há ${-r.diasRestantes} dias`
                : `${r.diasRestantes} dias`
              : null
          return (
            <LinhaLista
              key={i.id}
              href={hrefEditar}
              leading={<Farol status={r.status} />}
              titulo={i.nome}
              subtitulo={doc?.arquivo_path ? "Arquivo anexado" : "Sem arquivo anexado"}
              trailing={
                <span className="flex shrink-0 flex-col items-end gap-0.5 text-right">
                  <span className={`font-mono-instr text-sm font-semibold tabular-nums ${corData}`}>{dataTxt}</span>
                  {diasTxt && <span className="apoio font-mono-instr tabular-nums text-dim">{diasTxt}</span>}
                  {url ? (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="apoio text-accent-forte">Abrir</a>
                  ) : editavel ? (
                    <form action={anexarArquivo} className="flex items-center gap-2">
                      <input type="hidden" name="item_id" value={i.id} />
                      <label className="apoio cursor-pointer text-accent-forte">
                        Anexar
                        <input type="file" name="arquivo" accept={ACEITA_ARQUIVO} className="sr-only" />
                      </label>
                      <button className="apoio rounded-lg border border-line px-2.5 py-1 text-dim">Enviar</button>
                    </form>
                  ) : null}
                </span>
              }
            />
          )
        }))}
        {await Promise.all(avulsos.map(async (d) => {
          const url = d.arquivo_path ? await linkAssinado(d.arquivo_path) : null
          return (
            <LinhaLista
              key={d.id}
              leading={<span aria-label="arquivo sem vencimento" className="inline-block size-2 shrink-0 rounded-full border border-dim/60 bg-transparent" />}
              titulo={d.nome}
              subtitulo="Arquivo sem vencimento"
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

      <SecaoPagina icone="mais">Novo documento</SecaoPagina>
      <form action={criarDocumento} className="sombra-1 space-y-3 rounded-[14px] border border-line bg-panel p-4">
        <Campo label="Nome" id="nome" name="nome" required list="tipos-doc" placeholder="Ex.: Seguro da embarcação">
          <datalist id="tipos-doc">
            <option value="Seguro da embarcação" /><option value="TIE" />
            <option value="Vistoria da Marinha" /><option value="Licença de navegação" />
            <option value="Certificado de segurança" /><option value="Documento de propriedade" />
          </datalist>
        </Campo>
        <Campo label="Vence em — opcional" id="validade" name="validade" type="date" />
        {/* Fora da grade de 2 colunas e com `CampoArquivo`: o input nativo
            desenhava "Choose File · No file chosen" em inglês (auditoria
            visual 18/08, §8), e espremido em meia largura o rótulo do
            navegador ainda saía cortado. */}
        <CampoArquivo
          label="Arquivo — opcional"
          name="arquivo"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          ajuda="PDF, JPG, PNG ou WebP"
        />
        <button className="w-full rounded-xl bg-accent py-3 font-semibold text-acao-texto">Salvar documento</button>
      </form>
    </main>
  )
}
