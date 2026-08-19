import { redirect } from "next/navigation"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { Campo, CampoSelect, CampoTextarea } from "@/components/ui/campo"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { Selo } from "@/components/ui/selo"
import { decidirEnvio, enviarAoAdm } from "@/lib/acoes/enterprise"
import { carregarPainel } from "@/lib/consultas"
import {
  ACOES_SOBRE_ENVIO, linhaDeProcedencia, RESSALVA_ACESSO_BASICO,
  ROTULO_ACAO_ENVIO, ROTULO_ESTADO_ENVIO, ROTULO_TIPO_ENVIO,
} from "@/lib/domain/cotista-plano"
import { supabaseServer } from "@/lib/supabase/server"
import { ACAO_NAO_ESTICA } from "@/lib/ui/superficies"
import type { EnvioCotista } from "@/lib/db/types"

/**
 * ATUALIZAÇÕES DOS COTISTAS (onda 78 — PRD §15).
 *
 * Uma tela com dois lados, decidido pelo papel de quem abre:
 *
 *   COTISTA vê o formulário de envio e o próprio histórico.
 *   PROPRIETÁRIO vê a fila do que chegou e decide o que fazer com cada item.
 *
 * A regra que sustenta os dois lados é a mesma (§15): *nada enviado pelo
 * cotista altera automaticamente o registro oficial*. O envio é um pedido; a
 * ficha da unidade só muda quando o ADM decide — e a decisão fica gravada com
 * as duas pontas da procedência.
 */

/*
 * A15, A PARTE QUE FICA EM ABERTO — E DE PROPÓSITO.
 *
 * `envios_cotista.foto_path` existe desde a migration 066 (linha 62) e está
 * vazia em 100% das linhas porque NADA no app a escreve: o formulário abaixo
 * não pede arquivo e `enviarAoAdm` não sobe nenhum. Não é dado perdido nem
 * render esquecido — é uma coluna sem caminho de escrita, e mostrá-la só
 * produziria um rótulo "Foto: —" em todo cartão.
 *
 * O que fecha de verdade é o upload inteiro (campo de arquivo, validação de
 * MIME, bucket `acervo`, URL assinada na leitura), no padrão que
 * `lib/acoes/ocorrencias.ts` já usa. É onda própria, deixada fora desta por
 * escolha declarada. E é a coluna que mais valeria: o §15 vive de procedência,
 * e a foto do casco na devolução é a prova que encerra a discussão sobre quem
 * riscou o barco.
 */

export default async function AtualizacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const ehDono = painel.papel === "PROP"

  const supabase = await supabaseServer()
  const [{ data: envios }, { data: perfis }] = await Promise.all([
    supabase.from("envios_cotista").select("*")
      .eq("embarcacao_id", painel.embarcacao.id)
      .order("criado_em", { ascending: false }).limit(40),
    supabase.from("profiles").select("id, nome"),
  ])

  // ONDA 99 (P2-5) — a forma da linha vem de `lib/db/types.ts`. A cópia daqui
  // declarava 10 das 13 colunas e escondia `foto_path` e `decidido_em`: a
  // primeira é a foto que o cotista nunca chegou a poder mandar (ver a nota do
  // A15 abaixo), e a segunda é QUANDO o ADM decidiu — sem ela a fila não tinha
  // como dizer há quanto tempo alguém está esperando resposta.
  const lista = (envios ?? []) as EnvioCotista[]
  const nomePorId = new Map((perfis ?? []).map((p: { id: string; nome: string }) => [p.id, p.nome]))
  const aguardando = lista.filter((e) => e.estado === "aguardando")
  const decididos = lista.filter((e) => e.estado !== "aguardando")

  const Cartao = ({ e }: { e: EnvioCotista }) => (
    <div
      className={`sombra-1 rounded-[var(--raio-cartao)] border bg-panel p-3.5 ${
        e.estado === "aguardando" ? "border-line border-l-2 border-l-accent" : "border-line"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="titulo-card min-w-0 flex-1">{e.texto ?? "Envio"}</p>
        {/* A15 — o TIPO, ao lado do estado e antes dele. Os dois são selos
            porque são a mesma pergunta em dois eixos ("o que é isto" e "em que
            pé está"), e a ordem é a da leitura: classificar vem antes de
            triar. Neutro de propósito, inclusive na ocorrência — o farol desta
            tela pertence ao ESTADO (o que ainda aguarda o ADM), e uma
            ocorrência já analisada não deve continuar gritando. */}
        <Selo estado="neutro">{ROTULO_TIPO_ENVIO[e.tipo] ?? e.tipo}</Selo>
        <Selo estado={e.estado === "aguardando" ? "atencao" : e.estado === "incorporado" ? "ok" : "neutro"}>
          {ROTULO_ESTADO_ENVIO[e.estado]}
        </Selo>
      </div>
      {(e.horas != null || e.combustivel_pct != null) && (
        <p className="apoio mt-1 font-mono-instr text-dim">
          {[
            e.horas != null ? `${Number(e.horas).toLocaleString("pt-BR")} h` : null,
            e.combustivel_pct != null ? `${e.combustivel_pct}% combustível` : null,
          ].filter(Boolean).join(" · ")}
        </p>
      )}
      {/* §15: "manter procedência — informado por X, incorporado por Y". É o
          produto do hub: o valor não está no dado, está em saber de quem veio
          e quem decidiu aceitar. */}
      <p className="apoio mt-1 text-dim">
        {linhaDeProcedencia(
          nomePorId.get(e.cotista_id) ?? "Cotista",
          e.estado,
          e.decidido_por ? nomePorId.get(e.decidido_por) ?? null : null,
        )}
        {e.acao && e.estado !== "aguardando" && ` · ${ROTULO_ACAO_ENVIO[e.acao]}`}
      </p>

      {ehDono && e.estado === "aguardando" && (
        <form action={decidirEnvio} className="mt-3 flex flex-wrap items-end gap-2">
          <input type="hidden" name="envio_id" value={e.id} />
          <CampoSelect label="O que fazer" id={`acao-${e.id}`} name="acao" wrapperClassName="min-w-[11rem] flex-1">
            {ACOES_SOBRE_ENVIO.map((a) => (
              <option key={a} value={a}>{ROTULO_ACAO_ENVIO[a]}</option>
            ))}
          </CampoSelect>
          <button className="h-11 shrink-0 rounded-[var(--raio-controle)] border border-line px-4 text-sm font-medium">
            Registrar decisão
          </button>
        </form>
      )}
    </div>
  )

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref="/menu"
        voltarRotulo="Menu"
        titulo="Atualizações"
        descricao={ehDono
          ? "O que os cotistas informaram — e o que você decidiu sobre cada item."
          : "O que você informou à administradora."}
        selo={ehDono && aguardando.length > 0
          ? <Selo estado="atencao">{`${aguardando.length} aguardando`}</Selo>
          : undefined}
      />
      {erro && <p className="corpo mt-3 rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      {!ehDono && (
        <>
          <SecaoPagina icone="mais">Informar à administradora</SecaoPagina>
          <form action={enviarAoAdm} className="sombra-1 space-y-3 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
            <CampoSelect label="O que é" id="tipo" name="tipo">
              <option value="uso">Uso da unidade</option>
              <option value="ocorrencia">Ocorrência</option>
              <option value="observacao">Observação</option>
            </CampoSelect>
            <CampoTextarea
              label="O que aconteceu"
              id="texto"
              name="texto"
              rows={3}
              placeholder="Ex.: devolvi com o tanque cheio e o casco limpo."
            />
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Horas" id="horas" name="horas" inputMode="decimal" className="font-mono-instr tabular-nums" />
              <Campo label="Combustível (%)" id="combustivel_pct" name="combustivel_pct" inputMode="numeric" className="font-mono-instr tabular-nums" />
            </div>
            <button className={`${ACAO_NAO_ESTICA} rounded-[var(--raio-controle)] bg-accent py-3 font-semibold text-acao-texto`}>
              Enviar à administradora
            </button>
            {/* §15, dito na tela pra ninguém achar que já alterou a ficha. */}
            <p className="apoio text-dim">
              O que você envia vai para a administradora analisar. Nada muda no registro oficial da
              unidade sem a decisão dela.
            </p>
          </form>
        </>
      )}

      {ehDono && (
        <>
          <SecaoPagina icone="alerta">Aguardando análise</SecaoPagina>
          {aguardando.length === 0 ? (
            <EstadoVazio variant="linha" icone="pessoas" titulo="Nada aguardando análise" />
          ) : (
            <div className="space-y-2">{aguardando.map((e) => <Cartao key={e.id} e={e} />)}</div>
          )}
        </>
      )}

      <SecaoPagina icone="calendario">{ehDono ? "Já analisados" : "Seus envios"}</SecaoPagina>
      {(ehDono ? decididos : lista).length === 0 ? (
        <EstadoVazio
          variant="linha"
          icone="calendario"
          titulo={ehDono ? "Nenhum envio analisado ainda" : "Você ainda não enviou nada"}
        />
      ) : (
        <div className="space-y-2">
          {(ehDono ? decididos : lista).map((e) => <Cartao key={e.id} e={e} />)}
        </div>
      )}

      {!ehDono && <p className="apoio mt-4 text-dim">{RESSALVA_ACESSO_BASICO}</p>}
    </main>
  )
}
