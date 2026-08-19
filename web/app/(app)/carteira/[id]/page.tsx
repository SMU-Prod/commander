import { notFound, redirect } from "next/navigation"
import { GuardaFormulario } from "@/components/guarda-formulario"
import { Icone } from "@/components/icone"
import { BotaoEnviar } from "@/components/ui/botao-enviar"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { Campo, CampoSelect, CampoTextarea } from "@/components/ui/campo"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { LinhaLista } from "@/components/ui/linha-lista"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import {
  decidirMovimento, registrarDevolucao, registrarGasto, registrarRepasse, salvarRegrasCarteira,
} from "@/lib/acoes/carteira"
import { carregarPainel, hojeISO } from "@/lib/consultas"
import {
  AVISO_NAO_MOVIMENTA, DESCRICAO_MODO, MODOS_CARTEIRA, ROTULO_MODO, ROTULO_MOVIMENTO,
  ROTULO_STATUS_MOVIMENTO, leituraDoSaldo, saldoCarteira,
} from "@/lib/domain/carteira"
import { CATEGORIAS_FINANCEIRAS, ROTULO_CATEGORIA, formatarDataBr } from "@/lib/domain/financeiro"
import { formatarReais } from "@/lib/domain/gastos"
import { podeEditar, podeVer } from "@/lib/domain/permissoes"
import { ALVO_ACAO, PILULA_ACAO } from "@/lib/ui/acoes"
import { campo, rot } from "@/lib/ui/form"
import { supabaseServer } from "@/lib/supabase/server"
import type { Carteira, CarteiraMovimento } from "@/lib/db/types"

/**
 * Extrato de uma Carteira (PRD FINAL §9.4). Uma tela, dois pontos de vista:
 *   · o proprietário repassa, aprova/recusa o que está pendente e muda as
 *     regras;
 *   · o tripulante registra gasto e devolução.
 * Ambos veem o mesmo saldo e o mesmo extrato — é o ponto do módulo: as duas
 * pessoas olhando o mesmo número.
 */
export default async function CarteiraDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ erro?: string }>
}) {
  const { id } = await params
  const { erro } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")

  const supabase = await supabaseServer()
  const { data: bruta } = await supabase.from("carteiras").select("*").eq("id", id).maybeSingle()
  const carteira = bruta as Carteira | null
  if (!carteira) notFound()

  const ehProprietario = painel.papel === "PROP" && painel.embarcacao.id === carteira.embarcacao_id
  const ehDono = carteira.tripulante_id === (await supabase.auth.getUser()).data.user?.id
  if (!ehProprietario && !(ehDono && podeVer(painel.permissoes, "carteira"))) {
    redirect(`/hoje?erro=${encodeURIComponent("Seu acesso não inclui esta Carteira.")}`)
  }
  const podeMovimentar = ehProprietario || podeEditar(painel.permissoes, "carteira")

  const [{ data: movs }, { data: perfis }] = await Promise.all([
    supabase.from("carteira_movimentos").select("*").eq("carteira_id", carteira.id)
      .order("data", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, nome"),
  ])
  const movimentos = (movs ?? []) as CarteiraMovimento[]
  const nomePorId = new Map(((perfis ?? []) as { id: string; nome: string }[]).map((p) => [p.id, p.nome]))
  const nomeTripulante = nomePorId.get(carteira.tripulante_id) ?? "Tripulante"

  const s = saldoCarteira(movimentos.map((m) => ({
    tipo: m.tipo, valorCentavos: m.valor_centavos, status: m.status,
  })))
  const leitura = leituraDoSaldo(s.saldoCentavos)
  const pendentes = movimentos.filter((m) => m.status === "pendente")

  const urlPorMovimento = new Map(
    await Promise.all(
      movimentos
        .filter((m): m is CarteiraMovimento & { comprovante_path: string } => m.comprovante_path != null)
        .slice(0, 30)
        .map(async (m) => {
          const { data } = await supabase.storage.from("acervo").createSignedUrl(m.comprovante_path, 3600)
          return [m.id, data?.signedUrl ?? null] as const
        }),
    ),
  )

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref="/carteira"
        voltarRotulo="Carteira"
        titulo={ehProprietario ? nomeTripulante : "Sua carteira"}
        descricao={`${ROTULO_MODO[carteira.modo]} · ${carteira.exige_comprovante ? "comprovante obrigatório" : "comprovante opcional"}${carteira.ativa ? "" : " · encerrada"}`}
      />
      {erro && <p className="corpo mt-3 rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      <div className="sombra-1 mt-6 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
        <p className="rotulo text-dim">{leitura.rotulo}</p>
        {/* ONDA 87 — o saldo é o assunto da tela (`.valor-instrumento`); as
            três parcelas embaixo são valor de linha (`.valor`). Antes eram
            `text-3xl` e `text-sm`: o primeiro fora de qualquer escala, o
            segundo dando 14px SEM peso, SEM cor e SEM tabular — o mesmo cinza
            do rótulo logo acima, que é o que apagava a hierarquia. */}
        <p className={`mt-1 font-mono-instr valor-instrumento ${leitura.critico ? "text-crit" : ""}`}>
          {formatarReais(s.saldoCentavos)}
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3">
          <div>
            <p className="rotulo text-dim">Repassado</p>
            <p className="mt-0.5 font-mono-instr valor">{formatarReais(s.repassadoCentavos)}</p>
          </div>
          <div>
            <p className="rotulo text-dim">Gasto</p>
            <p className="mt-0.5 font-mono-instr valor">{formatarReais(s.gastoCentavos)}</p>
          </div>
          <div>
            <p className="rotulo text-dim">Devolvido</p>
            <p className="mt-0.5 font-mono-instr valor">{formatarReais(s.devolvidoCentavos)}</p>
          </div>
        </div>
        {s.aguardandoQtd > 0 && (
          <p className="apoio mt-3 text-warn">
            {s.aguardandoQtd} movimento{s.aguardandoQtd > 1 ? "s" : ""} aguardando confirmação
            ({formatarReais(s.aguardandoCentavos)}) — não entra{s.aguardandoQtd > 1 ? "m" : ""} no saldo.
          </p>
        )}
        {carteira.observacao && <p className="apoio mt-3 text-dim">{carteira.observacao}</p>}
      </div>

      <div className="mt-3 flex gap-3 rounded-[var(--raio-cartao)] border border-line bg-panel2 px-4 py-3">
        <Icone nome="escudo" className="mt-0.5 size-4 shrink-0 text-dim" />
        <p className="apoio text-dim">{AVISO_NAO_MOVIMENTA}</p>
      </div>

      {ehProprietario && pendentes.length > 0 && (
        <>
          <SecaoPagina icone="alerta">Esperando sua confirmação</SecaoPagina>
          <div className="space-y-2">
            {pendentes.map((m) => {
              const url = urlPorMovimento.get(m.id)
              return (
                <div key={m.id} className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="titulo-card">{m.descricao}</p>
                      <p className="apoio mt-0.5 text-dim">
                        {ROTULO_MOVIMENTO[m.tipo]} · {formatarDataBr(m.data)}
                        {m.categoria && ` · ${ROTULO_CATEGORIA[m.categoria]}`}
                      </p>
                    </div>
                    <p className="shrink-0 font-mono-instr valor font-semibold">
                      {formatarReais(m.valor_centavos)}
                    </p>
                  </div>
                  {m.observacao && <p className="apoio mt-2 text-dim">{m.observacao}</p>}
                  {/* Era texto dourado de 18px de alvo. Aqui NÃO é link no
                      meio de frase (esse caso fica sublinhado, e é o
                      "comprovante" do extrato lá embaixo) — é a ação do
                      cartão, e ação tem forma. */}
                  {url && (
                    <a href={url} target="_blank" rel="noopener noreferrer" className={`${ALVO_ACAO} mt-2`}>
                      <span className={PILULA_ACAO}>Abrir comprovante</span>
                    </a>
                  )}
                  <form action={decidirMovimento} className="mt-3 space-y-2">
                    <input type="hidden" name="carteira_id" value={carteira.id} />
                    <input type="hidden" name="movimento_id" value={m.id} />
                    <input name="motivo" placeholder="Motivo, se for recusar (opcional)" className={campo} />
                    <div className="flex gap-2">
                      <button name="decisao" value="aprovado"
                        className="h-11 flex-1 rounded-[var(--raio-controle)] bg-accent text-sm font-semibold text-acao-texto">
                        Confirmar
                      </button>
                      <button name="decisao" value="recusado"
                        className="h-11 flex-1 rounded-[var(--raio-controle)] border border-crit/40 text-sm font-semibold text-crit">
                        Recusar
                      </button>
                    </div>
                  </form>
                  {m.tipo === "gasto" && (
                    <p className="apoio mt-2 text-dim">
                      Ao confirmar, este gasto vira despesa da embarcação no Financeiro, na categoria acima.
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* §24, "sem permissão": a Carteira esconde repasse, gasto, devolução e
          regras conforme o papel. Sem uma linha explicando, quem abre a
          própria carteira e não vê botão nenhum conclui que o app quebrou —
          e não dá pra revelar o que ela não pode ver, só POR QUE não pode. */}
      {!podeMovimentar && (
        <p className="apoio mt-4 text-dim">
          Seu acesso a esta Carteira é de leitura: você acompanha saldo e movimentos, mas quem registra
          gasto é quem tem permissão de editar a Carteira.
        </p>
      )}
      {podeMovimentar && !ehProprietario && (
        <p className="apoio mt-4 text-dim">
          Repasse, devolução e regras são do proprietário (PRD §9.4) — você registra os gastos e ele
          confirma.
        </p>
      )}

      {ehProprietario && carteira.ativa && (
        <>
          <SecaoPagina icone="carteira">Registrar repasse</SecaoPagina>
          {/* "Repasse registrado não vira despesa; vira saldo sob
              responsabilidade do tripulante" (PRD §9.4) — e a tela diz isso,
              porque a pessoa que entrega R$ 2.000 espera ver isso no gasto do
              mês se ninguém explicar. */}
          <form action={registrarRepasse} className="space-y-3 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
            {/* Quatro formulários dividem esta URL e o mesmo `?erro=`; por
                isso cada um tem chave própria — uma só faria o rascunho de
                um sobrescrever o do outro. */}
            <GuardaFormulario chave="carteira:repasse" />
            <input type="hidden" name="carteira_id" value={carteira.id} />
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Valor (R$)" id="valor_repasse" name="valor" inputMode="decimal" required placeholder="500,00" />
              <Campo label="Data" id="data_repasse" name="data" type="date" defaultValue={hojeISO()} />
            </div>
            <Campo label="Descrição" id="descricao_repasse" name="descricao" defaultValue="Repasse" />
            <p className="apoio text-dim">
              Repasse não é despesa do barco. Vira saldo sob responsabilidade de {nomeTripulante} — a despesa
              nasce quando o dinheiro for gasto.
            </p>
            {/* ONDA 85 — os quatro formulários desta tela mexem em dinheiro, e
                nenhum deles dizia que estava enviando: o duplo-toque gravava
                o repasse duas vezes. `BotaoEnviar` traz junto a altura da
                régua (48px) no lugar do `py-3` de 52px. */}
            <BotaoEnviar rotulo="Registrar repasse" />
          </form>
        </>
      )}

      {podeMovimentar && carteira.ativa && (
        <>
          <SecaoPagina icone="cifrao">Registrar gasto</SecaoPagina>
          <form action={registrarGasto} className="space-y-3 rounded-[var(--raio-cartao)] border border-line bg-panel p-4" encType="multipart/form-data">
            <GuardaFormulario chave="carteira:gasto" />
            <input type="hidden" name="carteira_id" value={carteira.id} />
            <Campo label="No que foi gasto" id="descricao_gasto" name="descricao" required placeholder="Diesel no posto da marina" />
            <CampoSelect label="Categoria" id="categoria_gasto" name="categoria" required defaultValue="">
              <option value="" disabled>Escolha…</option>
              {CATEGORIAS_FINANCEIRAS.map((c) => (
                <option key={c} value={c}>{ROTULO_CATEGORIA[c]}</option>
              ))}
            </CampoSelect>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Valor (R$)" id="valor_gasto" name="valor" inputMode="decimal" required placeholder="350,00" />
              <Campo label="Data" id="data_gasto" name="data" type="date" defaultValue={hojeISO()} />
            </div>
            <div>
              <label className={rot} htmlFor="comprovante_gasto">
                Comprovante{carteira.exige_comprovante ? "" : " (opcional)"}
              </label>
              <input
                id="comprovante_gasto" type="file" name="comprovante"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                required={carteira.exige_comprovante}
                className={campo}
              />
              <p className="apoio mt-1 text-dim">
                {carteira.exige_comprovante ? "Esta carteira exige comprovante em todo gasto. " : ""}
                Se o envio falhar, valor e descrição voltam preenchidos — só o arquivo precisa ser
                escolhido de novo (o navegador não deixa nenhum site guardá-lo por você).
              </p>
            </div>
            <CampoTextarea label="Observação (opcional)" id="observacao_gasto" name="observacao" rows={2} />
            <p className="apoio text-dim">
              O gasto reduz o saldo em mãos e entra como despesa da embarcação no Financeiro
              {!ehProprietario && carteira.modo === "aprovacao" ? ", depois que o proprietário confirmar." : "."}
            </p>
            <BotaoEnviar rotulo="Registrar gasto" />
          </form>

          <SecaoPagina icone="transferir">Devolver saldo</SecaoPagina>
          <form action={registrarDevolucao} className="space-y-3 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
            <GuardaFormulario chave="carteira:devolucao" />
            <input type="hidden" name="carteira_id" value={carteira.id} />
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Valor (R$)" id="valor_dev" name="valor" inputMode="decimal" required placeholder="150,00" />
              <Campo label="Data" id="data_dev" name="data" type="date" defaultValue={hojeISO()} />
            </div>
            <Campo label="Descrição" id="descricao_dev" name="descricao" defaultValue="Devolução de saldo" />
            <p className="apoio text-dim">
              Devolução não é entrada do barco — é o dinheiro voltando para quem repassou.
              {!ehProprietario && " O proprietário confirma o recebimento."}
            </p>
            {/* `contorno` e não `principal`: devolver saldo é a secundária de
                quem já tem "Registrar gasto" acima como ação da tela. */}
            <BotaoEnviar rotulo="Registrar devolução" variante="contorno" />
          </form>
        </>
      )}

      <SecaoPagina icone="relatorio">Extrato</SecaoPagina>
      <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
        {/* Era "Nenhum movimento ainda." — uma lápide (DESIGN §6 regra 4): a
            frase encerrava o assunto sem explicar o que a área faz nem o que
            fazer a seguir. `EstadoVazio` é o mesmo desenho que as outras 80
            telas usam, e aqui ele diz para que serve o extrato. */}
        {movimentos.length === 0 && (
          <EstadoVazio
            variant="linha"
            icone="relatorio"
            titulo="Nenhum movimento ainda"
            descricao={
              podeMovimentar
                ? "Repasse, gasto e devolução aparecem aqui em ordem, com comprovante e status — é o extrato que os dois lados olham juntos."
                : "Assim que houver repasse, gasto ou devolução nesta carteira, cada movimento aparece aqui com data, valor e comprovante."
            }
          />
        )}
        {movimentos.map((m) => {
          const url = urlPorMovimento.get(m.id)
          return (
            <LinhaLista
              key={m.id}
              titulo={m.descricao}
              subtitulo={
                <>
                  {ROTULO_MOVIMENTO[m.tipo]} · {formatarDataBr(m.data)}
                  {m.categoria && ` · ${ROTULO_CATEGORIA[m.categoria]}`}
                  {m.status !== "aprovado" && ` · ${ROTULO_STATUS_MOVIMENTO[m.status]}`}
                  {m.status === "recusado" && m.motivo_recusa && ` (${m.motivo_recusa})`}
                  {/* A EXCEÇÃO que continua sendo texto: link dentro de frase
                      corrida ("Gasto · 12/08 · Combustível · comprovante").
                      Pílula no meio de uma linha de subtítulo seria pior que
                      o problema; o sublinhado é o affordance certo aqui, e
                      o DESIGN §5 já isenta link de parágrafo da régua de
                      alvo isolado. */}
                  {url && (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="ml-2 text-accent-forte underline">
                      comprovante
                    </a>
                  )}
                </>
              }
              valor={`${m.tipo === "repasse" ? "+" : "−"} ${formatarReais(m.valor_centavos)}`}
              valorClassName={
                m.status !== "aprovado" ? "text-dim" : m.tipo === "repasse" ? "text-ok" : ""
              }
            />
          )
        })}
      </div>

      {ehProprietario && (
        <>
          <SecaoPagina icone="ferramenta">Regras desta carteira</SecaoPagina>
          <form action={salvarRegrasCarteira} className="space-y-4 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
            <input type="hidden" name="carteira_id" value={carteira.id} />
            <CampoSelect label="Como o gasto entra" id="modo" name="modo" defaultValue={carteira.modo}>
              {MODOS_CARTEIRA.map((m) => (
                <option key={m} value={m}>{ROTULO_MODO[m]} — {DESCRICAO_MODO[m]}</option>
              ))}
            </CampoSelect>
            <label className="flex items-center gap-3">
              <input type="checkbox" name="exige_comprovante" defaultChecked={carteira.exige_comprovante}
                className="size-5 accent-[var(--acao)]" />
              <span className="corpo">Exigir comprovante em todo gasto</span>
            </label>
            <label className="flex items-center gap-3">
              <input type="checkbox" name="ativa" defaultChecked={carteira.ativa} className="size-5 accent-[var(--acao)]" />
              <span className="corpo">Carteira ativa</span>
            </label>
            <CampoTextarea label="Observação" id="observacao" name="observacao" rows={2} defaultValue={carteira.observacao ?? ""} />
            <p className="apoio text-dim">
              Encerrar a carteira só impede novos movimentos — o extrato continua aqui, inteiro.
            </p>
            <BotaoEnviar rotulo="Salvar regras" />
          </form>
        </>
      )}
    </main>
  )
}
