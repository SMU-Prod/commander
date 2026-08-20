"use client"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Icone } from "@/components/icone"
import { Campo } from "@/components/ui/campo"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { hashesJaImportados, importarTrilhas, type ResultadoImportacao, type TrilhaParaImportar } from "@/lib/acoes/importar-gpx"
import { dataSP, horaSP } from "@/lib/domain/datas"
import { resumoTrilha } from "@/lib/domain/geo"
import { parseGpx, paraPontosArmazenaveis, type TrilhaGpx } from "@/lib/domain/gpx"

// MESMA chave de localStorage de components/mapa/navegar-mapa.tsx (onda 17) —
// o consentimento de corredores e UM SO, nao um por tela. Mudar aqui tambem
// vale pra proxima trilha gravada ao vivo, e vice-versa.
const CHAVE_CONSENTIMENTO_CORREDOR = "commander:consentimento-corredor"

interface Candidata extends TrilhaGpx {
  id: string
  selecionada: boolean
  duplicada: boolean
  dataManual: string
}

function formatarData(iso: string): string {
  return iso.split("-").reverse().join("/")
}

function periodoDaTrilha(t: TrilhaGpx): string {
  if (t.semHorario || t.pontos.length === 0) return "sem horário no arquivo original"
  const a = t.pontos[0].t as number
  const b = t.pontos[t.pontos.length - 1].t as number
  return dataSP(a) === dataSP(b)
    ? `${formatarData(dataSP(a))} · ${horaSP(a)}–${horaSP(b)}`
    : `${formatarData(dataSP(a))} ${horaSP(a)} → ${formatarData(dataSP(b))} ${horaSP(b)}`
}

function distanciaEstimadaNm(t: TrilhaGpx): number {
  return resumoTrilha(paraPontosArmazenaveis(t.pontos)).distanciaNm
}

/**
 * Fluxo de importação de GPX (onda 21) — escolher arquivo, prévia honesta
 * (o que vai virar saída, o que foi resumido/ignorado, se duplica), escolher
 * o que importar, confirmar. Tudo client: o parser (`lib/domain/gpx.ts`) roda
 * no aparelho antes de qualquer coisa ir pro servidor — o dono vê exatamente
 * o que tem no arquivo antes de decidir.
 */
export function ImportarGpxCliente() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null)
  const [lendo, setLendo] = useState(false)
  const [erroArquivo, setErroArquivo] = useState<string | null>(null)
  const [avisos, setAvisos] = useState<{ trilhasVaziasIgnoradas: number; rotasIgnoradas: number; waypointsIgnorados: number } | null>(null)
  const [candidatas, setCandidatas] = useState<Candidata[]>([])
  const [contribuirCorredor, setContribuirCorredor] = useState(false)
  const [importando, setImportando] = useState(false)
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null)

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- so existe localStorage no cliente
      setContribuirCorredor(localStorage.getItem(CHAVE_CONSENTIMENTO_CORREDOR) === "1")
    } catch {}
  }, [])

  function alternarConsentimentoCorredor(valor: boolean) {
    setContribuirCorredor(valor)
    try {
      localStorage.setItem(CHAVE_CONSENTIMENTO_CORREDOR, valor ? "1" : "0")
    } catch {}
  }

  function limparPrevia() {
    setNomeArquivo(null)
    setErroArquivo(null)
    setAvisos(null)
    setCandidatas([])
    setResultado(null)
    setErroGeral(null)
    if (inputRef.current) inputRef.current.value = ""
  }

  async function aoEscolherArquivo(arquivo: File) {
    limparPrevia()
    setNomeArquivo(arquivo.name)
    setLendo(true)
    try {
      const texto = await arquivo.text()
      const r = parseGpx(texto)
      if (r.erro) {
        setErroArquivo(r.erro)
        return
      }
      if (r.trilhas.length === 0) {
        setErroArquivo(
          r.rotasIgnoradas > 0 || r.waypointsIgnorados > 0
            ? "Esse arquivo só tem rotas planejadas ou waypoints — nada disso vira saída (fora do escopo desta importação)."
            : "Nenhuma trilha encontrada nesse arquivo.",
        )
        return
      }

      let jaImportados = new Set<string>()
      try {
        jaImportados = new Set(await hashesJaImportados(r.trilhas.map((t) => t.hash)))
      } catch {
        // busca de duplicata na previa e um bonus — se falhar, segue sem
        // marcar nada como duplicado aqui; a checagem final (no servidor,
        // dentro de importarTrilhas) continua valendo de qualquer forma.
      }

      setCandidatas(
        r.trilhas.map((t, i) => ({
          ...t,
          id: `${i}-${t.hash || "sh"}`,
          selecionada: !jaImportados.has(t.hash),
          duplicada: jaImportados.has(t.hash),
          dataManual: "",
        })),
      )
      setAvisos({
        trilhasVaziasIgnoradas: r.trilhasVaziasIgnoradas,
        rotasIgnoradas: r.rotasIgnoradas,
        waypointsIgnorados: r.waypointsIgnorados,
      })
    } catch {
      setErroArquivo("Não foi possível ler este arquivo. Confira se é um GPX exportado do plotter.")
    } finally {
      setLendo(false)
    }
  }

  function alternarSelecao(id: string) {
    setCandidatas((cs) => cs.map((c) => (c.id === id ? { ...c, selecionada: !c.selecionada } : c)))
  }

  function definirDataManual(id: string, valor: string) {
    setCandidatas((cs) => cs.map((c) => (c.id === id ? { ...c, dataManual: valor } : c)))
  }

  const selecionadas = candidatas.filter((c) => c.selecionada)
  const faltaData = selecionadas.some((c) => c.semHorario && !c.dataManual)

  async function confirmar() {
    setErroGeral(null)
    if (selecionadas.length === 0) return
    if (faltaData) {
      setErroGeral("Informe uma data para as trilhas sem horário antes de importar — marcadas abaixo.")
      return
    }
    setImportando(true)
    const payload: TrilhaParaImportar[] = selecionadas.map((c) => ({
      pontos: paraPontosArmazenaveis(c.pontos),
      nome: c.nome,
      semHorario: c.semHorario,
      hash: c.hash,
      dataManual: c.semHorario ? c.dataManual : null,
    }))
    try {
      const r = await importarTrilhas(payload, contribuirCorredor)
      setResultado(r)
    } catch {
      setErroGeral("Não foi possível importar agora. A conexão pode ter caído — tente de novo.")
    } finally {
      setImportando(false)
    }
  }

  // Concluido: resumo do que aconteceu, com caminho de volta claro.
  if (resultado) {
    return (
      <div className="sombra-1 mt-4 rounded-[var(--raio-cartao)] border border-line bg-panel p-5">
        <p className="titulo-card">
          {resultado.importadas > 0
            ? `${resultado.importadas} saída${resultado.importadas > 1 ? "s" : ""} importada${resultado.importadas > 1 ? "s" : ""} do plotter`
            : "Nenhuma saída nova importada"}
        </p>
        {resultado.puladasDuplicadas.length > 0 && (
          <p className="mt-2 apoio text-dim">
            {resultado.puladasDuplicadas.length} pulada{resultado.puladasDuplicadas.length > 1 ? "s" : ""} por já
            {resultado.puladasDuplicadas.length > 1 ? " terem" : " ter"} sido importada
            {resultado.puladasDuplicadas.length > 1 ? "s" : ""} antes: {resultado.puladasDuplicadas.join(", ")}.
          </p>
        )}
        {resultado.erros.length > 0 && (
          <div className="mt-2 rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2">
            {resultado.erros.map((e, i) => (
              <p key={i} className="apoio">{e.nome ? `${e.nome}: ` : ""}{e.erro}</p>
            ))}
          </div>
        )}
        <div className="mt-4 flex gap-2">
          {resultado.importadas > 0 && (
            <Link
              href="/diario"
              className="flex min-h-11 flex-1 items-center justify-center rounded-[var(--raio-pilula)] bg-accent px-4 text-sm font-semibold text-acao-texto"
            >
              Ver no Diário
            </Link>
          )}
          <button
            type="button"
            onClick={() => { limparPrevia(); router.refresh() }}
            className="flex min-h-11 flex-1 items-center justify-center rounded-[var(--raio-pilula)] border border-line px-4 text-sm text-dim"
          >
            Importar outro arquivo
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-4">
      {/* Passo 1: escolher arquivo */}
      <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-5 text-center">
        <Icone nome="guardado" className="mx-auto size-7 text-dim" />
        <p className="corpo mt-2 text-dim">
          Escolha o arquivo GPX exportado do seu plotter (Garmin, Raymarine, Navionics — todos exportam nesse formato).
        </p>
        <label className="mt-3 inline-flex min-h-11 cursor-pointer items-center justify-center rounded-[var(--raio-pilula)] border border-accent/40 px-4 text-sm font-semibold text-accent-forte">
          {lendo ? "Lendo arquivo…" : nomeArquivo ? "Escolher outro arquivo" : "Escolher arquivo .gpx"}
          <input
            ref={inputRef}
            type="file"
            accept=".gpx,application/gpx+xml,text/xml,application/xml"
            className="sr-only"
            onChange={(e) => {
              const arquivo = e.target.files?.[0]
              if (arquivo) void aoEscolherArquivo(arquivo)
            }}
          />
        </label>
        {nomeArquivo && !erroArquivo && <p className="mt-2 apoio text-dim">{nomeArquivo}</p>}
      </div>

      {erroArquivo && (
        <p className="mt-3 rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2 corpo">{erroArquivo}</p>
      )}

      {/* Passo 2: previa honesta */}
      {candidatas.length > 0 && (
        <div className="mt-4">
          {avisos && (avisos.rotasIgnoradas > 0 || avisos.waypointsIgnorados > 0 || avisos.trilhasVaziasIgnoradas > 0) && (
            <p className="apoio mb-3 text-dim">
              {[
                avisos.trilhasVaziasIgnoradas > 0 ? `${avisos.trilhasVaziasIgnoradas} trilha(s) sem pontos válidos ignorada(s)` : null,
                avisos.rotasIgnoradas > 0 ? `${avisos.rotasIgnoradas} rota(s) planejada(s) ignorada(s)` : null,
                avisos.waypointsIgnorados > 0 ? `${avisos.waypointsIgnorados} waypoint(s) ignorado(s)` : null,
              ].filter(Boolean).join(" · ")} — fora do escopo desta importação.
            </p>
          )}

          <SecaoPagina>
            {candidatas.length} trilha{candidatas.length > 1 ? "s" : ""} encontrada{candidatas.length > 1 ? "s" : ""}
          </SecaoPagina>

          <div className="space-y-2">
            {candidatas.map((c) => (
              <div key={c.id} className={`sombra-1 rounded-[var(--raio-cartao)] border p-4 ${c.duplicada ? "border-line bg-panel opacity-70" : "border-line bg-panel"}`}>
                <label className="flex min-h-11 cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={c.selecionada}
                    onChange={() => alternarSelecao(c.id)}
                    className="mt-0.5 size-5 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="titulo-card">{c.nome || "Saída sem nome"}</p>
                    <p className="apoio mt-0.5 text-dim">{periodoDaTrilha(c)}</p>
                    <p className="apoio mt-0.5 text-dim">
                      ≈ {distanciaEstimadaNm(c).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MN estimadas
                      {c.pontosResumidosPara != null && ` · resumida de ${c.pontosOriginais} para ${c.pontosResumidosPara} pontos`}
                      {c.pontosDescartados > 0 && ` · ${c.pontosDescartados} ponto(s) com coordenada inválida descartado(s)`}
                    </p>
                    {c.duplicada && (
                      <p className="mt-1 inline-flex items-center gap-1 rounded-[var(--raio-pilula)] border border-line px-2 py-0.5 font-mono-instr text-xs text-dim">
                        Já importada antes — será pulada
                      </p>
                    )}
                    {contribuirCorredor ? (
                      <p className="mt-1 font-mono-instr text-xs text-accent-forte">Vai pro diário e também vira passagens no mapa de corredores</p>
                    ) : (
                      <p className="mt-1 font-mono-instr text-xs text-dim">Vai só para o diário</p>
                    )}
                  </div>
                </label>
                {c.selecionada && c.semHorario && (
                  <div className="mt-3 pl-8">
                    <Campo
                      label="Essa trilha não tem data no arquivo — informe uma"
                      id={`data-${c.id}`}
                      type="date"
                      value={c.dataManual}
                      onChange={(e) => definirDataManual(c.id, e.target.value)}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Consentimento de corredores (onda 17) — mesmo texto e mesma
              chave de navegar-mapa.tsx, so que aqui vale pra TODAS as
              trilhas selecionadas de uma vez. */}
          <label className="mt-4 flex min-h-11 cursor-pointer items-start gap-2.5 text-sm text-dim">
            <input
              type="checkbox"
              checked={contribuirCorredor}
              onChange={(e) => alternarConsentimentoCorredor(e.target.checked)}
              className="mt-0.5 size-5 shrink-0"
            />
            Contribuir com o mapa de corredores — as trilhas importadas viram passagens anônimas, agregadas por
            área, nunca sua rota individual. Ajuda outros barcos a encontrar caminho.
          </label>

          {erroGeral && (
            <p className="mt-3 rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2 corpo">{erroGeral}</p>
          )}

          <button
            type="button"
            onClick={confirmar}
            disabled={selecionadas.length === 0 || importando}
            className="mt-4 flex min-h-11 w-full items-center justify-center rounded-[var(--raio-pilula)] bg-accent px-4 text-sm font-semibold text-acao-texto disabled:opacity-50"
          >
            {importando
              ? "Importando…"
              : `Importar ${selecionadas.length} saída${selecionadas.length === 1 ? "" : "s"}`}
          </button>
        </div>
      )}
    </div>
  )
}
