import Link from "next/link"
import { redirect } from "next/navigation"
import { Farol } from "@/components/farol"
import { Abas } from "@/components/ui/abas"
import { BotaoFicha } from "@/components/ui/botao-ficha"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { Campo } from "@/components/ui/campo"
import { CampoArquivo } from "@/components/ui/campo-arquivo"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { LinhaLista } from "@/components/ui/linha-lista"
import { MigalhaPao } from "@/components/ui/migalha-pao"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { Selo } from "@/components/ui/selo"
import { HeroiTecnico } from "@/components/ui/heroi-tecnico"
import { NumerosDoHub } from "@/components/ui/numeros-do-hub"
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

/**
 * ONDA 135 — AS ABAS DO PILOTO (`/barco/motores`, onda 128) NESTE HUB.
 * O mock desenha esta tela com a trinca "12 · 10 · 2" virando recortes, e é
 * exatamente o que as abas fazem: Visão geral (destaque + lista completa +
 * cadastro, o que a tela já mostrava), Em dia (só quem tem validade E prazo
 * folgado, ordenado pelo que vence primeiro) e Atenção (vencidos e na margem
 * — o recorte que exige algo hoje). Documento SEM validade não entra nos dois
 * recortes de propósito: ele não tem estado pra recortar (a mesma régua do
 * selo "Incompleto" da lista), e mora na Visão geral com a confissão dele.
 * As contagens das pílulas leem os MESMOS números da trinca — custam zero.
 */
const ABAS_DOCUMENTOS = ["geral", "em-dia", "atencao"] as const
type AbaDocumentos = (typeof ABAS_DOCUMENTOS)[number]

export default async function DocumentosPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; aba?: string }>
}) {
  const { erro, aba: abaBruta } = await searchParams
  const aba = (ABAS_DOCUMENTOS.some((a) => a === abaBruta) ? abaBruta : "geral") as AbaDocumentos
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (!podeVer(painel.permissoes, "documentos")) redirect("/hoje?erro=" + encodeURIComponent("Seu acesso não inclui os documentos."))
  const editavel = podeEditar(painel.permissoes, "documentos")
  const supabase = await supabaseServer()
  // A consulta de documentos continua fora do gate de aba: as três abas leem
  // "arquivo anexado / sem arquivo" dela — o que fica só na Visão geral é o
  // trabalho de ASSINAR URL, que é uma ida ao Storage por linha.
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

  // ONDA 135 — a URL assinada do destaque só é pedida quando a Visão geral
  // está aberta: é a única aba que desenha o botão "Ver arquivo" dele.
  const docDestaque = destaque ? docPorItem.get(destaque.item.id) : undefined
  const urlDestaque = aba === "geral" && docDestaque?.arquivo_path ? await linkAssinado(docDestaque.arquivo_path) : null

  // ONDA 92 — as quatro contagens saem de dentro da chamada e ganham nome:
  // a frase de resumo e a faixa de KPI passam a ler os MESMOS números, em vez
  // de a faixa recontar por fora e as duas poderem discordar.
  const total = avaliados.length + avulsos.length
  const comValidade = avaliados.filter((a) => a.venc != null).length
  const vencidos = avaliados.filter((a) => a.r.status === "vencido").length
  const emAtencao = avaliados.filter((a) => a.r.status === "atencao").length
  const resumo = resumoDosDocumentos(total, comValidade, vencidos, emAtencao)
  // ONDA 109 — "em dia" é o complemento de vencido e atenção dentro do que TEM
  // validade; documento sem validade não vota, que é a mesma regra de
  // honestidade de `temInformacaoSuficiente`.
  const emDia = comValidade - vencidos - emAtencao

  // ONDA 135 — os dois recortes das abas, com as MESMAS réguas dos números
  // acima: `emDiaLista.length === emDia` e `pedemAlgo.length === vencidos +
  // emAtencao` por construção, senão a pílula e o conteúdo discordariam.
  const emDiaLista = avaliados
    .filter((a) => a.venc != null && a.r.status === "ok")
    .sort((a, b) => (a.venc ?? "").localeCompare(b.venc ?? ""))
  const pedemAlgo = avaliados.filter((a) => a.r.status !== "ok")

  return (
    <main>
      {/* ONDA 92 (eixo 2.2) — migalha + faixa de KPI + barra de ações, a
          mesma anatomia da ficha de equipamento. */}
      <MigalhaPao itens={[{ rotulo: "Barco", href: "/barco" }, { rotulo: "Documentos" }]} />

      {/* Zero AQUI é resposta, não ausência ("Vencidos: 0" é a confirmação
          ativa de que nada venceu — o mesmo raciocínio da aba "Alerts 0" da
          referência). Mas com NENHUM documento cadastrado a faixa inteira
          sai: quatro zeros numa tela vazia é decorar o vazio, que a régua
          proíbe (docs/DESIGN.md §6, regra 4). */}
      <CabecalhoDetalhe
        className="mt-3"
        voltarHref="/barco"
        voltarRotulo="Barco"
        hub="documentos"
        descricao={resumo ?? undefined}
        // O formulário de cadastro mora no fim da Visão geral; a barra de
        // ações da ficha é onde a referência põe a ação de nível "tela".
        // Âncora e não rota nova: o formulário continua sendo parte desta
        // tela, e mandar pra outra rota seria inventar um passo. O href leva
        // a `/barco/documentos#novo` por extenso porque a âncora só existe
        // na aba Visão geral — de outra aba, `#novo` sozinho não acharia nada.
        acoes={editavel ? <BotaoFicha icone="mais" href="/barco/documentos#novo">Novo documento</BotaoFicha> : undefined}
      />

      {/* ONDA 105 — o objeto grande do topo, como nas oito imagens do guia.
          É ilustração técnica, não render 3D nem foto: ver o cabeçalho de
          `components/ui/heroi-tecnico.tsx` e o desvio de biblioteca de assets
          registrado em `docs/DESIGN-SYSTEM.md`. */}
      <HeroiTecnico chave="documentos" className="mt-5 mb-4" />

      {/* ONDA 135 — as abas do piloto, com a pílula ativa na cor DESTE hub.
          As duas contagens leem os números da trinca — custo zero. */}
      <Abas
        className="mb-4"
        ativa={aba}
        pilula
        classeAtiva="border-transparent bg-hub-documentos font-semibold text-acao-texto"
        abas={[
          { valor: "geral", rotulo: "Visão geral", href: "/barco/documentos" },
          { valor: "em-dia", rotulo: "Em dia", href: "/barco/documentos?aba=em-dia", contagem: emDia },
          { valor: "atencao", rotulo: "Atenção", href: "/barco/documentos?aba=atencao", contagem: vencidos + emAtencao },
        ]}
      />

      {/* O erro de uma ação (anexar, criar) fica FORA das abas: ele precisa
          aparecer pra onde quer que o redirect da ação devolva a pessoa. */}
      {erro && <p className="mt-3 rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2 corpo">{erro}</p>}

      {aba === "geral" && (
        <>
          {/* ONDA 109 — A FAIXA DE QUATRO PASTILHAS VIROU A TRINCA DA IMAGEM 5.
              O guia desenha esta tela com TRÊS cartões grandes ("12 documentos ·
              10 em dia · 2 atenção"), e não com quatro pílulas de 28px acima do
              título. Os números são os MESMOS de antes — nenhum cálculo mudou; o
              que saiu foi "Com validade", que é censo e não muda o que a pessoa faz
              hoje (o critério inteiro está em `numeros-do-hub.tsx`).
              "Vencidos" entra como CRÍTICO e não como atenção: vermelho é
              vencido/erro pelo §4, e um documento vencido é exatamente isso. */}
          <NumerosDoHub
            chave="documentos"
            className="mb-4"
            numeros={[
              { rotulo: "Documentos", valor: String(total), icone: "documento" },
              { rotulo: "Em dia", valor: String(emDia), icone: "check" },
              {
                rotulo: vencidos > 0 ? "Vencidos" : "Atenção",
                valor: String(vencidos > 0 ? vencidos : emAtencao),
                icone: "alerta",
                estado: vencidos > 0 ? "critico" : emAtencao > 0 ? "atencao" : undefined,
              },
            ]}
          />

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
                    <span className="tabular-nums tabular-nums text-crit">
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

          {/* ONDA 93 — O `className="mt-5"` QUE ESTAVA AQUI NUNCA FEZ NADA.
              `SecaoPagina` já escreve `mt-6` no mesmo elemento, e o Tailwind emite
              `.mt-5` ANTES de `.mt-6` no CSS gerado: com a mesma especificidade,
              quem vence é a última regra da folha, ou seja, o `mt-6` do
              componente. A seção sempre teve 24px de topo, com e sem destaque — o
              ternário era decoração. É o mesmo defeito que `botao-ficha.tsx`
              documenta para `border-*`/`text-*`: duas utilitárias da mesma família
              no mesmo elemento é loteria de ordem, não sobrescrita.
              Espaçamento de `SecaoPagina` se resolve pela prop `denso`, que é a
              única alavanca que o componente expõe — e aqui a folga larga é a
              certa: esta seção vem depois do cartão de destaque. */}
          <SecaoPagina icone="documento">Todos os documentos</SecaoPagina>
          <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
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
              // vazado no lugar do farol (a mesma confissão da ficha de
              // equipamento).
              //
              // ONDA 92 (achado 6.2) — "COMPLETAR" ERA UM `<span>` QUE NÃO SE
              // TOCA. Verbo imperativo, na cor de ação, sem `href` e sem
              // `button`: a palavra prometia uma ação específica ("completar o
              // campo que falta") e entregava "abrir a ficha". Vira o que de fato
              // é: um estado. Estado é substantivo; ação é verbo.
              //
              // `neutro` e não `atencao` (que era a sugestão da auditoria): este
              // item foi deliberadamente mantido FORA do semáforo — ele não entra
              // na conta da Saúde, nem a favor nem contra —, e pintá-lo de âmbar
              // seria dar a ele um estado de semáforo que a régua se recusa a
              // calcular. "Sem dados" é exatamente o que `neutro` significa no
              // `Selo`. O selo aparece pra todo mundo, não só pra quem edita:
              // saber que o documento está incompleto não depende de poder
              // consertá-lo.
              if (venc == null) {
                return (
                  <LinhaLista
                    key={i.id}
                    href={hrefEditar}
                    leading={<span aria-label="sem data de validade" className="inline-block size-2 shrink-0 rounded-[var(--raio-pilula)] border border-dim/60 bg-transparent" />}
                    titulo={i.nome}
                    subtitulo="Sem data de validade informada"
                    trailing={<Selo estado="neutro">Incompleto</Selo>}
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
                      <span className={`tabular-nums valor font-semibold ${corData}`}>{dataTxt}</span>
                      {diasTxt && <span className="apoio tabular-nums tabular-nums text-dim">{diasTxt}</span>}
                      {url ? (
                        <a href={url} target="_blank" rel="noopener noreferrer" className="apoio text-accent-forte">Abrir</a>
                      ) : editavel ? (
                        <form action={anexarArquivo} className="flex items-center gap-2">
                          <input type="hidden" name="item_id" value={i.id} />
                          <label className="apoio cursor-pointer text-accent-forte">
                            Anexar
                            <input type="file" name="arquivo" accept={ACEITA_ARQUIVO} className="sr-only" />
                          </label>
                          <button className="apoio rounded-[var(--raio-controle)] border border-line px-2.5 py-1 text-dim">Enviar</button>
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
                  leading={<span aria-label="arquivo sem vencimento" className="inline-block size-2 shrink-0 rounded-[var(--raio-pilula)] border border-dim/60 bg-transparent" />}
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

          <SecaoPagina id="novo" className="scroll-mt-4" icone="mais">Novo documento</SecaoPagina>
          <form action={criarDocumento} className="sombra-1 space-y-3 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
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
            <button className="w-full rounded-[var(--raio-controle)] bg-accent py-3 font-semibold text-acao-texto">Salvar documento</button>
          </form>
        </>
      )}

      {aba === "em-dia" && (
        emDiaLista.length === 0 ? (
          <EstadoVazio
            className="mt-6"
            icone="documento"
            titulo="Nenhum documento em dia"
            descricao="Documento entra aqui quando tem validade informada e o prazo está folgado — a mais de 30 dias do vencimento."
          />
        ) : (
          <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
            {/* Ordenado pelo que vence primeiro: a pergunta desta aba é "qual
                é o próximo?", não a ordem do cadastro. Data com ano porque em
                dia significa longe — dd/mm sozinho deixaria ambíguo o ano. */}
            {emDiaLista.map(({ item: i, r, venc }) => (
              <LinhaLista
                key={i.id}
                href={editavel ? `/barco/itens/${i.id}/editar` : undefined}
                leading={<Farol status={r.status} />}
                titulo={i.nome}
                subtitulo={docPorItem.get(i.id)?.arquivo_path ? "Arquivo anexado" : "Sem arquivo anexado"}
                valor={venc ? formatarDataCurtaComAno(venc) : "—"}
              />
            ))}
          </div>
        )
      )}

      {aba === "atencao" && (
        pedemAlgo.length === 0 ? (
          <EstadoVazio
            className="mt-6"
            icone="documento"
            titulo="Nenhum documento pedindo atenção"
            descricao="Documento a menos de 30 dias do vencimento — ou já vencido — aparece aqui."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {/* ONDA 135 — vidro tintado pelo estado, na dose (a régua está em
                app/(app)/diario/page.tsx, no card de avaria): vencido tinge de
                crítico, atenção de âmbar — tinta 10→5% + borda 35%, e SÓ aqui,
                porque esta aba É o alarme. O card vira link só pra quem pode
                editar — documento não tem tela própria de leitura. */}
            {pedemAlgo.map(({ item, r, venc }) => {
              const dias = r.diasRestantes != null
                ? r.diasRestantes < 0 ? `venceu há ${-r.diasRestantes} dias` : `vence em ${r.diasRestantes} dias`
                : null
              const casca = `sombra-1 flex items-center gap-3 rounded-[var(--raio-cartao)] border bg-panel p-3 ${
                r.status === "vencido"
                  ? "border-crit/35 bg-gradient-to-b from-crit/10 to-crit/5"
                  : "border-warn/35 bg-gradient-to-b from-warn/10 to-warn/5"
              }`
              const miolo = (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="titulo-card truncate">{item.nome}</p>
                    <p className="apoio mt-0.5 text-dim">
                      {[dias, venc ? formatarDataCurta(venc) : null].filter(Boolean).join(" · ") || "Vencido"}
                      {docPorItem.get(item.id)?.arquivo_path ? " · arquivo anexado" : " · sem arquivo anexado"}
                    </p>
                  </div>
                  <Farol status={r.status} />
                </>
              )
              return editavel ? (
                <Link key={item.id} href={`/barco/itens/${item.id}/editar`} className={casca}>{miolo}</Link>
              ) : (
                <div key={item.id} className={casca}>{miolo}</div>
              )
            })}
          </div>
        )
      )}
    </main>
  )
}
