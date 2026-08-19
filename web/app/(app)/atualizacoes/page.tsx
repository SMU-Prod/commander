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
 * ATUALIZAÃ‡Ã•ES DOS COTISTAS (onda 78 â€” PRD Â§15).
 *
 * Uma tela com dois lados, decidido pelo papel de quem abre:
 *
 *   COTISTA vÃª o formulÃ¡rio de envio e o prÃ³prio histÃ³rico.
 *   PROPRIETÃRIO vÃª a fila do que chegou e decide o que fazer com cada item.
 *
 * A regra que sustenta os dois lados Ã© a mesma (Â§15): *nada enviado pelo
 * cotista altera automaticamente o registro oficial*. O envio Ã© um pedido; a
 * ficha da unidade sÃ³ muda quando o ADM decide â€” e a decisÃ£o fica gravada com
 * as duas pontas da procedÃªncia.
 */

/*
 * A15, A PARTE QUE FICA EM ABERTO â€” E DE PROPÃ“SITO.
 *
 * `envios_cotista.foto_path` existe desde a migration 066 (linha 62) e estÃ¡
 * vazia em 100% das linhas porque NADA no app a escreve: o formulÃ¡rio abaixo
 * nÃ£o pede arquivo e `enviarAoAdm` nÃ£o sobe nenhum. NÃ£o Ã© dado perdido nem
 * render esquecido â€” Ã© uma coluna sem caminho de escrita, e mostrÃ¡-la sÃ³
 * produziria um rÃ³tulo "Foto: â€”" em todo cartÃ£o.
 *
 * O que fecha de verdade Ã© o upload inteiro (campo de arquivo, validaÃ§Ã£o de
 * MIME, bucket `acervo`, URL assinada na leitura), no padrÃ£o que
 * `lib/acoes/ocorrencias.ts` jÃ¡ usa. Ã‰ onda prÃ³pria, deixada fora desta por
 * escolha declarada. E Ã© a coluna que mais valeria: o Â§15 vive de procedÃªncia,
 * e a foto do casco na devoluÃ§Ã£o Ã© a prova que encerra a discussÃ£o sobre quem
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

  // ONDA 99 (P2-5) â€” a forma da linha vem de `lib/db/types.ts`. A cÃ³pia daqui
  // declarava 10 das 13 colunas e escondia `foto_path` e `decidido_em`: a
  // primeira Ã© a foto que o cotista nunca chegou a poder mandar (ver a nota do
  // A15 abaixo), e a segunda Ã© QUANDO o ADM decidiu â€” sem ela a fila nÃ£o tinha
  // como dizer hÃ¡ quanto tempo alguÃ©m estÃ¡ esperando resposta.
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
        {/* A15 â€” o TIPO, ao lado do estado e antes dele. Os dois sÃ£o selos
            porque sÃ£o a mesma pergunta em dois eixos ("o que Ã© isto" e "em que
            pÃ© estÃ¡"), e a ordem Ã© a da leitura: classificar vem antes de
            triar. Neutro de propÃ³sito, inclusive na ocorrÃªncia â€” o farol desta
            tela pertence ao ESTADO (o que ainda aguarda o ADM), e uma
            ocorrÃªncia jÃ¡ analisada nÃ£o deve continuar gritando. */}
        <Selo estado="neutro">{ROTULO_TIPO_ENVIO[e.tipo] ?? e.tipo}</Selo>
        <Selo estado={e.estado === "aguardando" ? "atencao" : e.estado === "incorporado" ? "ok" : "neutro"}>
          {ROTULO_ESTADO_ENVIO[e.estado]}
        </Selo>
      </div>
      {(e.horas != null || e.combustivel_pct != null) && (
        <p className="apoio mt-1 font-mono-instr text-dim">
          {[
            e.horas != null ? `${Number(e.horas).toLocaleString("pt-BR")} h` : null,
            e.combustivel_pct != null ? `${e.combustivel_pct}% combustÃ­vel` : null,
          ].filter(Boolean).join(" Â· ")}
        </p>
      )}
      {/* Â§15: "manter procedÃªncia â€” informado por X, incorporado por Y". Ã‰ o
          produto do hub: o valor nÃ£o estÃ¡ no dado, estÃ¡ em saber de quem veio
          e quem decidiu aceitar. */}
      <p className="apoio mt-1 text-dim">
        {linhaDeProcedencia(
          nomePorId.get(e.cotista_id) ?? "Cotista",
          e.estado,
          e.decidido_por ? nomePorId.get(e.decidido_por) ?? null : null,
        )}
        {e.acao && e.estado !== "aguardando" && ` Â· ${ROTULO_ACAO_ENVIO[e.acao]}`}
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
            Registrar decisÃ£o
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
        titulo="AtualizaÃ§Ãµes"
        descricao={ehDono
          ? "O que os cotistas informaram â€” e o que vocÃª decidiu sobre cada item."
          : "O que vocÃª informou Ã  administradora."}
        selo={ehDono && aguardando.length > 0
          ? <Selo estado="atencao">{`${aguardando.length} aguardando`}</Selo>
          : undefined}
      />
      {erro && <p className="corpo mt-3 rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      {!ehDono && (
        <>
          <SecaoPagina icone="mais">Informar Ã  administradora</SecaoPagina>
          <form action={enviarAoAdm} className="sombra-1 space-y-3 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
            <CampoSelect label="O que Ã©" id="tipo" name="tipo">
              <option value="uso">Uso da unidade</option>
              <option value="ocorrencia">OcorrÃªncia</option>
              <option value="observacao">ObservaÃ§Ã£o</option>
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
              <Campo label="CombustÃ­vel (%)" id="combustivel_pct" name="combustivel_pct" inputMode="numeric" className="font-mono-instr tabular-nums" />
            </div>
            <button className={`${ACAO_NAO_ESTICA} rounded-[var(--raio-controle)] bg-accent py-3 font-semibold text-acao-texto`}>
              Enviar Ã  administradora
            </button>
            {/* Â§15, dito na tela pra ninguÃ©m achar que jÃ¡ alterou a ficha. */}
            <p className="apoio text-dim">
              O que vocÃª envia vai para a administradora analisar. Nada muda no registro oficial da
              unidade sem a decisÃ£o dela.
            </p>
          </form>
        </>
      )}

      {ehDono && (
        <>
          <SecaoPagina icone="alerta">Aguardando anÃ¡lise</SecaoPagina>
          {aguardando.length === 0 ? (
            <EstadoVazio variant="linha" icone="pessoas" titulo="Nada aguardando anÃ¡lise" />
          ) : (
            <div className="space-y-2">{aguardando.map((e) => <Cartao key={e.id} e={e} />)}</div>
          )}
        </>
      )}

      <SecaoPagina icone="calendario">{ehDono ? "JÃ¡ analisados" : "Seus envios"}</SecaoPagina>
      {(ehDono ? decididos : lista).length === 0 ? (
        <EstadoVazio
          variant="linha"
          icone="calendario"
          titulo={ehDono ? "Nenhum envio analisado ainda" : "VocÃª ainda nÃ£o enviou nada"}
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
