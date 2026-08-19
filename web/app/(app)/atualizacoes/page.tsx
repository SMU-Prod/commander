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
  ROTULO_ACAO_ENVIO, ROTULO_ESTADO_ENVIO, type AcaoSobreEnvio, type EstadoEnvio,
} from "@/lib/domain/cotista-plano"
import { supabaseServer } from "@/lib/supabase/server"
import { ACAO_NAO_ESTICA } from "@/lib/ui/superficies"

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

  type Envio = {
    id: string; cotista_id: string; tipo: string; texto: string | null
    horas: number | null; combustivel_pct: number | null
    estado: EstadoEnvio; acao: AcaoSobreEnvio | null
    decidido_por: string | null; criado_em: string
  }
  const lista = (envios ?? []) as Envio[]
  const nomePorId = new Map((perfis ?? []).map((p: { id: string; nome: string }) => [p.id, p.nome]))
  const aguardando = lista.filter((e) => e.estado === "aguardando")
  const decididos = lista.filter((e) => e.estado !== "aguardando")

  const Cartao = ({ e }: { e: Envio }) => (
    <div
      className={`sombra-1 rounded-[var(--raio-cartao)] border bg-panel p-3.5 ${
        e.estado === "aguardando" ? "border-line border-l-2 border-l-accent" : "border-line"
      }`}
    >
      <div className="flex items-center gap-2">
        <p className="titulo-card min-w-0 flex-1">{e.texto ?? "Envio"}</p>
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
      {erro && <p className="corpo mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      {!ehDono && (
        <>
          <SecaoPagina icone="mais">Informar à administradora</SecaoPagina>
          <form action={enviarAoAdm} className="sombra-1 space-y-3 rounded-[14px] border border-line bg-panel p-4">
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
            <button className={`${ACAO_NAO_ESTICA} rounded-xl bg-accent py-3 font-semibold text-acao-texto`}>
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
