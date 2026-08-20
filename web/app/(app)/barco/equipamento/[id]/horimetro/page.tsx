import { notFound, redirect } from "next/navigation"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { Campo, CampoTextarea } from "@/components/ui/campo"
import { registrarLeituraHorimetro } from "@/lib/acoes/horimetro"
import { carregarPainel, hojeISO } from "@/lib/consultas"
import { abaDoEquipamento, nomeDoEquipamento } from "@/lib/domain/diario"
import { podeEditar } from "@/lib/domain/permissoes"

/**
 * FIX-002 DO PRD — A TELA DE LEITURA DO HORÍMETRO, QUE NÃO EXISTIA.
 * ===========================================================================
 * "Informar leitura" na ficha do motor abria o formulário genérico do Diário
 * com o tipo vazio — Data e Descrição, nenhum campo de horas. A auditoria
 * chamou isso de C-02 ("o principal atalho do detalhe do motor não executa
 * sua função") e o PRD pediu a rota própria. É esta.
 *
 * QUATRO CAMPOS, DOIS VISÍVEIS DE VERDADE. O PRD lista equipamento (oculto),
 * leitura, data/hora e observação. A leitura é o assunto; data já vem com
 * hoje e a observação é opcional — a pessoa que desce na sala de máquinas com
 * o telefone na mão digita UM número e pronto. "Uma criança deve saber mexer"
 * vale dobrado num formulário.
 *
 * A LEITURA ATUAL FICA À VISTA NO CARTUCHO DE INSTRUMENTO — sem ela a pessoa
 * não tem contra o que conferir o que acabou de ler no painel, e é a régua
 * contra a qual a validação vai reclamar ("horímetro não anda para trás").
 */
export default async function LeituraHorimetroPage({
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
  const equipamento = painel.equipamentos.find((e) => e.id === id)
  if (!equipamento) notFound()
  if (!podeEditar(painel.permissoes, abaDoEquipamento(equipamento.tipo))) {
    redirect(`/barco/equipamento/${id}?erro=${encodeURIComponent("Seu acesso não permite informar leituras.")}`)
  }

  const nome = nomeDoEquipamento(equipamento)

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref={`/barco/equipamento/${id}`}
        voltarRotulo={nome}
        titulo="Informar leitura"
        descricao={`O número que está no painel do ${nome}, agora.`}
      />

      {erro && (
        <p className="corpo mt-3 rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>
      )}

      {/* A leitura atual, no mesmo cartucho de instrumento da ficha: é a régua
          contra a qual a nova leitura vai ser validada, então ela fica à vista
          — não atrás de um toque. */}
      <div className="mt-4 rounded-[var(--raio-cartao)] border border-line bg-meter p-4 text-meter-texto">
        <p className="rotulo text-meter-dim">Leitura atual</p>
        <div className="mt-2 flex items-baseline gap-2 tabular-nums">
          <span className="text-4xl font-semibold">
            {equipamento.horas_atuais != null
              ? equipamento.horas_atuais.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
              : "—"}
          </span>
          <span className="rotulo text-meter-dim">{equipamento.horas_atuais != null ? "horas" : "sem leitura ainda"}</span>
        </div>
      </div>

      <form action={registrarLeituraHorimetro} className="mt-4 space-y-4">
        <input type="hidden" name="equipamento_id" value={id} />
        <Campo
          label="Nova leitura (horas)"
          id="leitura"
          name="leitura"
          type="text"
          inputMode="decimal"
          required
          placeholder={equipamento.horas_atuais != null
            ? `maior ou igual a ${equipamento.horas_atuais.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}`
            : "ex.: 1250,5"}
          dica="Vírgula ou ponto, com uma casa decimal. Horímetro não anda para trás."
        />
        <Campo
          label="Data da leitura"
          id="data"
          name="data"
          type="date"
          defaultValue={hojeISO()}
          max={hojeISO()}
        />
        <CampoTextarea
          label="Observação (opcional)"
          id="observacao"
          name="observacao"
          rows={2}
          maxLength={300}
          placeholder="ex.: leitura depois da troca de óleo"
        />
        <button
          type="submit"
          className="transicao-ui flex min-h-[var(--altura-campo)] w-full items-center justify-center rounded-[var(--raio-controle)] bg-accent corpo font-semibold text-acao-texto"
        >
          Registrar leitura
        </button>
      </form>
    </main>
  )
}
