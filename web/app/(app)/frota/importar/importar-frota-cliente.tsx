"use client"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { CampoTextarea } from "@/components/ui/campo"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { Selo } from "@/components/ui/selo"
import { importarUnidades, type ResultadoDaImportacao } from "@/lib/acoes/importar-frota"
import {
  COLUNAS_IMPORTACAO, importacaoVazia, lerPlanilha, resumoDaImportacao, validarImportacao,
} from "@/lib/domain/afazeres"
import { ACAO_NAO_ESTICA } from "@/lib/ui/superficies"

/**
 * A CONVERSA DA IMPORTAÇÃO (§21) — colar, conferir, confirmar.
 *
 * Client component pelo mesmo motivo da importação de GPX (onda 21): o parser
 * e o validador são puros (`lib/domain/afazeres.ts`) e rodam NO APARELHO, o
 * que faz a crítica aparecer a cada tecla, sem ida ao servidor. Quem cola uma
 * planilha de 40 linhas erra em duas ou três — e corrigir com resposta
 * instantânea é a diferença entre ajustar e desistir.
 *
 * O servidor revalida tudo de novo (`importarUnidades`). Aqui é conveniência,
 * não autoridade.
 */
export function ImportarFrotaCliente() {
  const router = useRouter()
  const [colado, setColado] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoDaImportacao | null>(null)

  // Reparsear a cada tecla é barato (dezenas de linhas) e é o que faz a
  // conferência ser imediata. `useMemo` só pra não refazer em re-render que
  // não mexeu no texto.
  const validacao = useMemo(() => validarImportacao(lerPlanilha(colado)), [colado])
  const temTexto = colado.trim() !== ""
  const vazia = importacaoVazia(validacao)

  async function confirmar() {
    setEnviando(true)
    setResultado(null)
    try {
      const r = await importarUnidades(validacao.validas)
      setResultado(r)
      // Sem `router.refresh()` a lista de unidades do app continuaria a
      // anterior até a próxima navegação dura — a pessoa acabou de criar 40
      // barcos e precisa vê-los.
      if (r.criadas > 0) router.refresh()
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <SecaoPagina icone="mais">Cole a planilha</SecaoPagina>
      <div className="sombra-1 space-y-3 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
        <CampoTextarea
          label="Selecione as linhas no Excel ou no Google Sheets e cole aqui"
          id="planilha"
          name="planilha"
          rows={8}
          value={colado}
          onChange={(e) => { setColado(e.target.value); setResultado(null) }}
          placeholder={"nome\ttipo\tmarca\tmodelo\tano\tserial\thoras\nJet 01\tjet\tSea-Doo\tGTX 170\t2022\tYDV12345\t118,5"}
          dica="Com ou sem a linha de títulos. Tabulação, ponto e vírgula ou vírgula — o app descobre sozinho."
        />
        <p className="apoio text-dim">
          Colunas que o app entende:{" "}
          <span className="font-mono-instr">{COLUNAS_IMPORTACAO.join(" · ")}</span>. Só o{" "}
          <span className="font-mono-instr">nome</span> é obrigatório — é o mesmo que o cadastro
          avulso pede. O que faltar você completa depois, na ficha de cada unidade.
        </p>
      </div>

      {temTexto && (
        <>
          <SecaoPagina icone="relatorio">Conferência</SecaoPagina>
          <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
            <div className="flex items-center gap-2">
              <p className="titulo-card min-w-0 flex-1">{resumoDaImportacao(validacao)}</p>
              {validacao.erros.length > 0 && <Selo estado="atencao">Confira</Selo>}
            </div>

            {validacao.erros.length > 0 && (
              <div className="mt-3 space-y-1">
                {/* O número da linha é o da planilha, com título contado — é o
                    que a pessoa vê no Excel. Sem ele, "nome repetido" numa
                    planilha de 40 linhas é inútil. */}
                {validacao.erros.map((e) => (
                  <p key={`${e.linha}-${e.problema}`} className="apoio text-warn">
                    <span className="font-mono-instr tabular-nums">Linha {e.linha}</span> — {e.problema}
                  </p>
                ))}
                <p className="apoio pt-1 text-dim">
                  Linha com problema não entra. As outras entram normalmente — corrija na planilha e
                  cole de novo se quiser trazer todas.
                </p>
              </div>
            )}

            {validacao.validas.length > 0 && (
              <div className="mt-3 max-h-64 overflow-y-auto rounded-[var(--raio-controle)] border border-line bg-panel2">
                {validacao.validas.map((l) => (
                  <div key={l.linha} className="flex items-center justify-between gap-3 border-b border-line px-3 py-2 last:border-0">
                    <span className="corpo min-w-0 truncate">{l.nome}</span>
                    <span className="apoio shrink-0 truncate text-dim">
                      {[
                        l.tipo,
                        [l.marca, l.modelo].filter(Boolean).join(" ") || null,
                        l.ano != null ? String(l.ano) : null,
                        // Horas é o único que vira MOTOR — vale dizer, porque
                        // é o que liga o semáforo de manutenção da unidade.
                        l.horas != null ? `${l.horas.toLocaleString("pt-BR")} h` : null,
                      ].filter(Boolean).join(" · ") || "só o nome"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {!vazia && (
            <button
              type="button"
              onClick={confirmar}
              disabled={enviando}
              className={`${ACAO_NAO_ESTICA} mt-3 rounded-[var(--raio-controle)] bg-accent py-3.5 font-semibold text-acao-texto disabled:opacity-60`}
            >
              {enviando
                ? "Importando…"
                : `Importar ${validacao.validas.length} ${validacao.validas.length === 1 ? "unidade" : "unidades"}`}
            </button>
          )}
        </>
      )}

      {resultado && (
        <>
          <SecaoPagina icone="calendario">Resultado</SecaoPagina>
          {resultado.recusa ? (
            <p className="corpo rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2">{resultado.recusa}</p>
          ) : (
            <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
              <p className="titulo-card">
                {resultado.criadas === 0
                  ? "Nenhuma unidade entrou"
                  : `${resultado.criadas} ${resultado.criadas === 1 ? "unidade cadastrada" : "unidades cadastradas"}`}
              </p>
              {/* O relatório nome por nome existe porque a importação NÃO é
                  transação: se a de número 31 bateu no limite do plano, as 30
                  primeiras estão criadas e a pessoa precisa saber onde parou —
                  senão refaz o trabalho inteiro no escuro. */}
              {resultado.falhas.length > 0 && (
                <div className="mt-2 space-y-1">
                  {resultado.falhas.map((f, i) => (
                    <p key={`${f.nome}-${i}`} className="apoio text-warn">{f.nome} — {f.motivo}</p>
                  ))}
                </div>
              )}
              {resultado.criadas > 0 && (
                <p className="apoio mt-2 text-dim">
                  As unidades novas já aparecem no seletor do topo e em Custo da frota. O motor só
                  existe onde a planilha trouxe horímetro.
                </p>
              )}
            </div>
          )}
        </>
      )}

      {!temTexto && !resultado && (
        <EstadoVazio
          variant="linha"
          icone="relatorio"
          titulo="Nada colado ainda"
          descricao="A conferência aparece aqui assim que você colar — nada é gravado antes de você confirmar."
        />
      )}
    </>
  )
}
