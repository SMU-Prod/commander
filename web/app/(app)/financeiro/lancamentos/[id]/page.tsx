import { notFound, redirect } from "next/navigation"
import { Confirmar } from "@/components/confirmar"
import { BotaoEnviar } from "@/components/ui/botao-enviar"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { Campo, CampoSelect, CampoTextarea } from "@/components/ui/campo"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { alternarStatusLancamento, excluirLancamento, salvarLancamento } from "@/lib/acoes/financeiro"
import { carregarPainel } from "@/lib/consultas"
import {
  CATEGORIAS_FINANCEIRAS, FORMAS_PAGAMENTO, ROTULO_CATEGORIA, ROTULO_FORMA_PAGAMENTO,
  formatarDataBr, rotuloAcaoConfirmar, rotuloStatus,
} from "@/lib/domain/financeiro"
import { formatarReais } from "@/lib/domain/gastos"
import { podeEditar, podeVer } from "@/lib/domain/permissoes"
import { supabaseServer } from "@/lib/supabase/server"
import { ALVO_ACAO, PILULA_ACAO } from "@/lib/ui/acoes"
import type { LancamentoFinanceiro } from "@/lib/db/types"

/** Detalhe de um lançamento: confirmar pagamento/recebimento, corrigir e
 *  excluir. Quem só tem "ver" enxerga os dados sem os controles. */
export default async function LancamentoPage({
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
  if (!podeVer(painel.permissoes, "gastos")) {
    redirect(`/hoje?erro=${encodeURIComponent("Seu acesso não inclui o Financeiro.")}`)
  }
  const editavel = podeEditar(painel.permissoes, "gastos")

  const supabase = await supabaseServer()
  const { data: bruto } = await supabase.from("lancamentos_financeiros")
    .select("*").eq("id", id).eq("embarcacao_id", painel.embarcacao.id).maybeSingle()
  const l = bruto as LancamentoFinanceiro | null
  if (!l) notFound()

  const urlComprovante = l.comprovante_path
    ? (await supabase.storage.from("acervo").createSignedUrl(l.comprovante_path, 3600)).data?.signedUrl ?? null
    : null

  const daCarteira = l.carteira_movimento_id != null

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref="/financeiro/lancamentos"
        voltarRotulo="Lançamentos"
        titulo={l.descricao}
        descricao={`${ROTULO_CATEGORIA[l.categoria]} · ${formatarDataBr(l.data)}`}
      />
      {erro && <p className="corpo mt-3 rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      <div className="sombra-1 mt-6 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
        <p className="rotulo text-dim">{l.tipo === "entrada" ? "Entrada" : "Despesa"}</p>
        {/* O valor É o assunto desta ficha — `.valor-instrumento`, o terceiro
            degrau do número (onda 87). `text-3xl` (30px) não era degrau de
            escala nenhuma. */}
        <p className={`mt-1 tabular-nums valor-instrumento ${l.tipo === "entrada" ? "text-ok" : ""}`}>
          {formatarReais(l.valor_centavos)}
        </p>
        <p className="apoio mt-1 text-dim">{rotuloStatus(l.tipo, l.status)}</p>

        {(l.fornecedor || l.forma_pagamento || l.observacao) && (
          <div className="mt-3 space-y-1 border-t border-line pt-3">
            {l.fornecedor && (
              <p className="corpo flex justify-between gap-3">
                <span className="text-dim">{l.tipo === "entrada" ? "Origem" : "Fornecedor"}</span>
                <span className="text-right">{l.fornecedor}</span>
              </p>
            )}
            {l.forma_pagamento && (
              <p className="corpo flex justify-between gap-3">
                <span className="text-dim">Forma</span>
                <span>{ROTULO_FORMA_PAGAMENTO[l.forma_pagamento]}</span>
              </p>
            )}
            {l.observacao && <p className="apoio mt-1 text-dim">{l.observacao}</p>}
          </div>
        )}

        {/* Era texto dourado de 21px de alvo dentro do cartão — a régua da
            casa é 44px e quem diz "aqui se toca" é a forma (acoes.ts). */}
        {urlComprovante && (
          <a href={urlComprovante} target="_blank" rel="noopener noreferrer" className={`${ALVO_ACAO} mt-3`}>
            <span className={PILULA_ACAO}>Abrir comprovante</span>
          </a>
        )}

        {l.evento_id && (
          <p className="apoio mt-3 text-dim">
            Nasceu de um registro do Diário. O valor aparece nos dois lugares, mas conta uma vez só.
          </p>
        )}
        {daCarteira && (
          <p className="apoio mt-3 text-dim">
            Gasto vindo da Carteira da Tripulação. Para ajustar ou desfazer, use o extrato da carteira.
          </p>
        )}
      </div>

      {/* §24 — sem permissão a área de ação some; sem uma linha
          explicando, a pessoa acha que o app quebrou. */}
      {!editavel && (
        <p className="apoio mt-4 text-dim">
          Seu acesso ao Financeiro é de leitura. Confirmar pagamento, corrigir e excluir são de quem
          tem permissão de editar — fale com o proprietário.
        </p>
      )}
      {editavel && (
        <form action={alternarStatusLancamento} className="mt-3">
          <input type="hidden" name="lancamento_id" value={l.id} />
          <input type="hidden" name="status" value={l.status === "pago" ? "pendente" : "pago"} />
          <button className={`w-full rounded-[var(--raio-controle)] py-3 text-sm font-semibold ${
            l.status === "pago" ? "border border-line" : "bg-accent text-acao-texto"
          }`}>
            {l.status === "pago" ? "Voltar para pendente" : rotuloAcaoConfirmar(l.tipo)}
          </button>
        </form>
      )}

      {editavel && !daCarteira && (
        <>
          <SecaoPagina icone="ferramenta">Corrigir</SecaoPagina>
          <form action={salvarLancamento} className="space-y-4 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
            <input type="hidden" name="lancamento_id" value={l.id} />
            <CampoSelect label="Tipo" id="tipo" name="tipo" defaultValue={l.tipo}>
              <option value="despesa">Despesa</option>
              <option value="entrada">Entrada</option>
            </CampoSelect>
            <Campo label="Descrição" id="descricao" name="descricao" required defaultValue={l.descricao} />
            <CampoSelect label="Categoria" id="categoria" name="categoria" defaultValue={l.categoria}>
              {CATEGORIAS_FINANCEIRAS.map((c) => (
                <option key={c} value={c}>{ROTULO_CATEGORIA[c]}</option>
              ))}
            </CampoSelect>
            <div className="grid grid-cols-2 gap-3">
              <Campo
                label="Valor (R$)" id="valor" name="valor" inputMode="decimal" required
                defaultValue={String(l.valor_centavos / 100).replace(".", ",")}
              />
              <Campo label="Data" id="data" name="data" type="date" required defaultValue={l.data} />
            </div>
            <label className="flex items-center gap-3">
              <input type="checkbox" name="pago" defaultChecked={l.status === "pago"} className="size-5 accent-[var(--acao)]" />
              <span className="corpo">{l.tipo === "entrada" ? "Já foi recebido" : "Já foi pago"}</span>
            </label>
            <Campo
              label={l.tipo === "entrada" ? "Origem" : "Fornecedor"} id="fornecedor" name="fornecedor"
              defaultValue={l.fornecedor ?? ""}
            />
            <CampoSelect label="Forma de pagamento" id="forma_pagamento" name="forma_pagamento" defaultValue={l.forma_pagamento ?? ""}>
              <option value="">—</option>
              {FORMAS_PAGAMENTO.map((f) => (
                <option key={f} value={f}>{ROTULO_FORMA_PAGAMENTO[f]}</option>
              ))}
            </CampoSelect>
            <CampoTextarea label="Observação" id="observacao" name="observacao" rows={3} defaultValue={l.observacao ?? ""} />
            {/* ONDA 85 — o padding vertical de 14px escrito à mão dava a
                sétima altura de controle do app (52px) e o botão não dizia
                que estava salvando. `BotaoEnviar` traz as duas coisas de uma
                vez: a régua de 48px e o aviso de envio. */}
            <BotaoEnviar rotulo="Salvar" />
          </form>

          {/* O vermelho fica no PASSO DA CONFIRMAÇÃO, que o `Confirmar` já
              desenha — aqui a ação é uma pílula de contorno como as outras.
              Texto vermelho de 21px lia como mensagem de erro, não como
              alvo, e ficava 23px abaixo da régua de toque. */}
          <form action={excluirLancamento} className="mt-6 flex justify-center">
            <input type="hidden" name="lancamento_id" value={l.id} />
            <Confirmar mensagem="Excluir este lançamento?" rotulo="Excluir lançamento" className={ALVO_ACAO}>
              <span className={PILULA_ACAO}>Excluir lançamento</span>
            </Confirmar>
          </form>
        </>
      )}
    </main>
  )
}
