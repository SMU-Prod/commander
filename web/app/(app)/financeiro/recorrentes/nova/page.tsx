import { redirect } from "next/navigation"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { Campo, CampoSelect, CampoTextarea } from "@/components/ui/campo"
import { criarRecorrente } from "@/lib/acoes/financeiro"
import { carregarPainel, hojeISO } from "@/lib/consultas"
import {
  CATEGORIAS_FINANCEIRAS, FORMAS_PAGAMENTO, FREQUENCIAS, ROTULO_CATEGORIA,
  ROTULO_FORMA_PAGAMENTO, ROTULO_FREQUENCIA,
} from "@/lib/domain/financeiro"
import { podeEditar } from "@/lib/domain/permissoes"

/** Cadastro de uma série recorrente (PRD §9.2). A série guarda a REGRA; os
 *  vencimentos aparecem calculados na lista e só viram lançamento quando
 *  alguém marca como pago. */
export default async function NovaRecorrentePage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (!podeEditar(painel.permissoes, "gastos")) {
    redirect(`/financeiro?erro=${encodeURIComponent("Seu acesso não permite criar recorrentes.")}`)
  }

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref="/financeiro/recorrentes"
        voltarRotulo="Recorrentes"
        titulo="Nova recorrente"
        descricao="O que se repete em intervalo fixo — vaga da marina, seguro, diarista, financiamento."
      />
      {erro && <p className="corpo mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      <form action={criarRecorrente} className="mt-5 space-y-4">
        <CampoSelect label="Tipo" id="tipo" name="tipo" defaultValue="despesa">
          <option value="despesa">Despesa — sai do bolso</option>
          <option value="entrada">Entrada — entra por causa do barco</option>
        </CampoSelect>

        <Campo label="Descrição" id="descricao" name="descricao" required placeholder="Vaga molhada — Marina da Glória" />

        <CampoSelect label="Categoria" id="categoria" name="categoria" required defaultValue="">
          <option value="" disabled>Escolha…</option>
          {CATEGORIAS_FINANCEIRAS.map((c) => (
            <option key={c} value={c}>{ROTULO_CATEGORIA[c]}</option>
          ))}
        </CampoSelect>

        <div className="grid grid-cols-2 gap-3">
          <Campo label="Valor (R$)" id="valor" name="valor" inputMode="decimal" required placeholder="1.850,00" />
          <CampoSelect label="Repete" id="frequencia" name="frequencia" defaultValue="mensal">
            {FREQUENCIAS.map((f) => (
              <option key={f} value={f}>{ROTULO_FREQUENCIA[f]}</option>
            ))}
          </CampoSelect>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Campo
            label="Primeiro vencimento" id="data" name="data" type="date" required defaultValue={hojeISO()}
            dica="O dia do mês vem daqui."
          />
          <Campo label="Até (opcional)" id="fim" name="fim" type="date" dica="Deixe vazio se não tem fim." />
        </div>

        <Campo label="Fornecedor / origem (opcional)" id="fornecedor" name="fornecedor" />

        <CampoSelect label="Forma de pagamento (opcional)" id="forma_pagamento" name="forma_pagamento" defaultValue="">
          <option value="">—</option>
          {FORMAS_PAGAMENTO.map((f) => (
            <option key={f} value={f}>{ROTULO_FORMA_PAGAMENTO[f]}</option>
          ))}
        </CampoSelect>

        <CampoTextarea label="Observação (opcional)" id="observacao" name="observacao" rows={3} />

        <p className="apoio rounded-[12px] border border-line bg-panel2 px-3.5 py-3 text-dim">
          Cada vencimento aparece na lista como pendente. Nenhum é dado como pago sozinho — você marca quando
          o pagamento acontecer de verdade.
        </p>

        <button className="w-full rounded-xl bg-accent py-3.5 font-semibold text-acao-texto">
          Criar recorrente
        </button>
      </form>
    </main>
  )
}
