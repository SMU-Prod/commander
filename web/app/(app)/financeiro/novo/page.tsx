import { redirect } from "next/navigation"
import { BloqueioPremium } from "@/components/ui/bloqueio-premium"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { Campo, CampoSelect, CampoTextarea } from "@/components/ui/campo"
import { criarLancamento } from "@/lib/acoes/financeiro"
import { carregarNivelPlano, carregarPainel, hojeISO } from "@/lib/consultas"
import { mensagemBloqueio, recursoLiberado } from "@/lib/domain/plano-acesso"
import {
  CATEGORIAS_FINANCEIRAS, FORMAS_PAGAMENTO, ROTULO_CATEGORIA, ROTULO_FORMA_PAGAMENTO,
} from "@/lib/domain/financeiro"
import { podeEditar } from "@/lib/domain/permissoes"
import { rot } from "@/lib/ui/form"
import { supabaseServer } from "@/lib/supabase/server"

/**
 * "+ Despesa" e "+ Entrada" — as duas ações universais do PRD §9.1. Mesmo
 * formulário, só muda o vocabulário: o PRD lista os campos uma vez só
 * ("categoria, descrição, valor, data, pago/pendente ou recebido/pendente,
 * fornecedor/origem opcional, forma de pagamento opcional, comprovante e
 * observação") e duplicar a tela por tipo só criaria dois lugares pra
 * corrigir o mesmo bug.
 *
 * `evento_id` chega quando a pessoa vem de um Hub por "Adicionar ao
 * Financeiro" — o lançamento nasce ligado àquele evento do Diário, e o
 * banco impede que o mesmo evento vire dois lançamentos.
 */
export default async function NovoLancamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; erro?: string; evento_id?: string; descricao?: string }>
}) {
  const { tipo: tipoBruto, erro, evento_id: eventoId, descricao: descricaoInicial } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (!podeEditar(painel.permissoes, "gastos")) {
    redirect(`/financeiro?erro=${encodeURIComponent("Seu acesso não permite lançar no Financeiro.")}`)
  }
  // §2.3 — o Financeiro fica visível como estrutura no Free; o LANÇAMENTO é
  // que vira cadeado. Mesma checagem na action, porque tela não é segurança.
  if (!recursoLiberado("financeiro_lancar", await carregarNivelPlano())) {
    return (
      <main>
        <CabecalhoDetalhe voltarHref="/financeiro" voltarRotulo="Financeiro" titulo="Novo lançamento" />
        <BloqueioPremium {...mensagemBloqueio("financeiro_lancar")} className="mt-5" />
      </main>
    )
  }

  const tipo = tipoBruto === "entrada" ? "entrada" : "despesa"
  const ehEntrada = tipo === "entrada"

  // Veio de um evento do Diário? Traz o que já está preenchido lá pra
  // pessoa não redigitar — e mostra de onde veio.
  let evento: { descricao: string | null; data: string; custo_centavos: number | null } | null = null
  if (eventoId) {
    const supabase = await supabaseServer()
    const { data } = await supabase.from("eventos")
      .select("descricao, data, custo_centavos")
      .eq("id", eventoId).eq("embarcacao_id", painel.embarcacao.id).maybeSingle()
    evento = data
  }
  const valorInicial = evento?.custo_centavos != null
    ? String(evento.custo_centavos / 100).replace(".", ",")
    : ""

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref="/financeiro/lancamentos"
        voltarRotulo="Financeiro"
        titulo={ehEntrada ? "Nova entrada" : "Nova despesa"}
        descricao={ehEntrada
          ? "Dinheiro que entrou por causa do barco — fretamento, venda de equipamento, reembolso."
          : "Só gasto efetivado ou confirmado. Orçamento e proposta não são despesa."}
      />
      {erro && <p className="corpo mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      {evento && (
        <p className="apoio mt-4 rounded-[12px] border border-line bg-panel2 px-3.5 py-3 text-dim">
          Vindo do Diário: {evento.descricao ?? "registro sem descrição"} ({evento.data.split("-").reverse().join("/")}).
          Este lançamento fica ligado àquele registro — não é uma cópia, e ele não entra duas vezes.
        </p>
      )}

      <form action={criarLancamento} className="mt-5 space-y-4" encType="multipart/form-data">
        <input type="hidden" name="tipo" value={tipo} />
        {eventoId && <input type="hidden" name="evento_id" value={eventoId} />}

        <Campo
          label="Descrição"
          id="descricao"
          name="descricao"
          required
          // Vem preenchida quando o atalho de um Hub trouxe a pessoa até aqui
          // (ocorrência, evento do Diário) — o PRD pede o atalho, não o
          // lançamento automático: quem confirma o valor é sempre a pessoa.
          defaultValue={evento?.descricao ?? descricaoInicial?.slice(0, 200) ?? ""}
          placeholder={ehEntrada ? "Fretamento de fim de semana" : "Vaga molhada de agosto"}
        />

        <CampoSelect label="Categoria" id="categoria" name="categoria" required defaultValue="">
          <option value="" disabled>Escolha…</option>
          {CATEGORIAS_FINANCEIRAS.map((c) => (
            <option key={c} value={c}>{ROTULO_CATEGORIA[c]}</option>
          ))}
        </CampoSelect>

        <div className="grid grid-cols-2 gap-3">
          <Campo
            label="Valor (R$)"
            id="valor"
            name="valor"
            inputMode="decimal"
            required
            defaultValue={valorInicial}
            placeholder="1.850,00"
          />
          <Campo label="Data" id="data" name="data" type="date" required defaultValue={evento?.data ?? hojeISO()} />
        </div>

        <label className="flex items-start gap-3 rounded-[12px] border border-line bg-panel px-3.5 py-3">
          <input type="checkbox" name="pago" defaultChecked className="mt-0.5 size-5 accent-[#d4af37]" />
          <span>
            <span className="corpo block font-medium">{ehEntrada ? "Já foi recebido" : "Já foi pago"}</span>
            <span className="apoio block text-dim">
              Desmarque se {ehEntrada ? "ainda vai receber" : "é uma conta assumida que ainda vai pagar"} — fica como pendente.
            </span>
          </span>
        </label>

        <Campo
          label={ehEntrada ? "Origem (opcional)" : "Fornecedor (opcional)"}
          id="fornecedor"
          name="fornecedor"
          placeholder={ehEntrada ? "Quem pagou" : "Marina, oficina, posto…"}
        />

        <CampoSelect label="Forma de pagamento (opcional)" id="forma_pagamento" name="forma_pagamento" defaultValue="">
          <option value="">—</option>
          {FORMAS_PAGAMENTO.map((f) => (
            <option key={f} value={f}>{ROTULO_FORMA_PAGAMENTO[f]}</option>
          ))}
        </CampoSelect>

        <div>
          <label className={rot} htmlFor="comprovante">Comprovante (opcional)</label>
          <input
            id="comprovante"
            type="file"
            name="comprovante"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className="corpo w-full rounded-[10px] border border-line bg-campo px-3 py-2.5"
          />
          <p className="apoio mt-1 text-dim">Nota fiscal ou recibo, em PDF ou foto. Até 10 MB.</p>
        </div>

        <CampoTextarea label="Observação (opcional)" id="observacao" name="observacao" rows={3} />

        <button className="w-full rounded-xl bg-accent py-3.5 font-semibold text-acao-texto">
          {ehEntrada ? "Registrar entrada" : "Registrar despesa"}
        </button>
      </form>
    </main>
  )
}
