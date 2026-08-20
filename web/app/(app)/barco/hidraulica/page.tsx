import { redirect } from "next/navigation"
import { Farol, FarolOcorrencia } from "@/components/farol"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { LinhaLista } from "@/components/ui/linha-lista"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { HeroiTecnico } from "@/components/ui/heroi-tecnico"
import { AcaoDoHub, NumerosDoHub } from "@/components/ui/numeros-do-hub"
import { carregarPainel, hojeISO, itemMonitoradoToItemCalc } from "@/lib/consultas"
import { CATEGORIAS_HIDRAULICA, ROTULO_HIDRAULICA } from "@/lib/domain/diario"
import { ESTADOS_QUE_PESAM_NA_SAUDE, ROTULO_ESTADO } from "@/lib/domain/ocorrencias"
import { podeEditar, podeVer } from "@/lib/domain/permissoes"
import { calcularSemaforo, formatarDataCurta, vencimentoPorData } from "@/lib/domain/semaforo"
import { supabaseServer } from "@/lib/supabase/server"
import type { Ocorrencia } from "@/lib/db/types"

export default async function HidraulicaPage() {
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (!podeVer(painel.permissoes, "hidraulica")) {
    redirect(`/hoje?erro=${encodeURIComponent("Seu acesso não inclui a hidráulica.")}`)
  }
  const editavel = podeEditar(painel.permissoes, "hidraulica")
  const hoje = hojeISO()
  const itens = painel.itens.filter((i) => (CATEGORIAS_HIDRAULICA as readonly string[]).includes(i.categoria ?? ""))

  const supabase = await supabaseServer()
  const { data: ocorrenciasBrutas } = await supabase.from("ocorrencias")
    .select("*").eq("embarcacao_id", painel.embarcacao.id).eq("aba", "hidraulica")
    .in("estado", [...ESTADOS_QUE_PESAM_NA_SAUDE]).order("created_at", { ascending: false })
  const ocorrencias = (ocorrenciasBrutas ?? []) as Ocorrencia[]

  // ONDA 109 — a trinca da imagem 3. Mesma régua da lista abaixo
  // (`calcularSemaforo`), calculada uma vez: número do topo que discorda das
  // linhas de baixo é o defeito que a onda 92 já pagou uma vez.
  const estados = itens.map((i) => calcularSemaforo(itemMonitoradoToItemCalc(i), null, hoje).status)
  const emDia = estados.filter((s) => s === "ok").length
  const pedemAtencao = estados.filter((s) => s !== "ok").length

  return (
    <main>
      {/* ONDA 104 (§8 do Guia) — cabeçalho padrão, com a identidade do hub. */}
      <CabecalhoDetalhe
        voltarHref="/barco"
        voltarRotulo="Barco"
        hub="hidraulica"
        descricao="Água doce é o que a embarcação bebe/usa; Grey Water é o esgoto de pia e chuveiro; Black Water é o esgoto do banheiro — sistemas separados, com manutenção própria cada um."
      />

      {/* ONDA 105 — o objeto grande do topo, como nas oito imagens do guia.
          É ilustração técnica, não render 3D nem foto: ver o cabeçalho de
          `components/ui/heroi-tecnico.tsx` e o desvio de biblioteca de assets
          registrado em `docs/DESIGN-SYSTEM.md`. */}
      <HeroiTecnico chave="hidraulica" className="mt-5 mb-4" />

      <NumerosDoHub
        chave="hidraulica"
        className="mb-4"
        numeros={[
          { rotulo: "Itens", valor: String(itens.length), icone: "oleo" },
          { rotulo: "Em dia", valor: String(emDia), icone: "check" },
          {
            rotulo: "Atenção",
            valor: String(pedemAtencao),
            icone: "alerta",
            estado: pedemAtencao > 0 ? "atencao" : undefined,
          },
        ]}
      />

      {editavel && (
        <AcaoDoHub
          chave="hidraulica"
          href={`/barco/itens/novo?alvo=${encodeURIComponent("cat:hidraulica_agua_doce")}`}
          className="mb-6"
        >
          Cadastrar item
        </AcaoDoHub>
      )}

      {ocorrencias.length > 0 && (
        <>
          {/* ONDA 92 (achado 6.1) — "Ver tudo" é o rótulo único do gesto
              "abrir a seção". Eram oito palavras no app pro mesmo gesto; a
              exceção continua sendo só o verbo que muda o que acontece de
              verdade ("Gerenciar", "Editar" — telas de edição, não listas). */}
          <SecaoPagina icone="alerta" acao={{ href: "/barco/ocorrencias?setor=hidraulica", rotulo: "Ver tudo" }}>
            Ocorrências abertas
          </SecaoPagina>
          <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
            {ocorrencias.map((o) => (
              <LinhaLista
                key={o.id}
                href={`/barco/ocorrencias/${o.id}`}
                leading={<FarolOcorrencia estado={o.estado} />}
                titulo={o.titulo}
                valor={ROTULO_ESTADO[o.estado]}
              />
            ))}
          </div>
        </>
      )}

      {CATEGORIAS_HIDRAULICA.map((c) => {
        const doGrupo = itens.filter((i) => i.categoria === c)
        return (
          <div key={c}>
            <SecaoPagina
              acao={editavel ? { href: `/barco/itens/novo?alvo=${encodeURIComponent(`cat:${c}`)}`, rotulo: "Adicionar", icone: "mais" } : undefined}
            >
              {ROTULO_HIDRAULICA[c]}
            </SecaoPagina>
            <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">
              {doGrupo.length === 0 && (
                <EstadoVazio variant="linha" icone="oleo" titulo="Nada cadastrado ainda" />
              )}
              {doGrupo.map((i) => {
                const r = calcularSemaforo(itemMonitoradoToItemCalc(i), null, hoje)
                const venc = vencimentoPorData(itemMonitoradoToItemCalc(i))
                const dias = r.diasRestantes != null
                  ? r.diasRestantes < 0 ? `vencido há ${-r.diasRestantes} d` : `${r.diasRestantes} dias`
                  : "—"
                return (
                  <LinhaLista
                    key={i.id}
                    href={editavel ? `/barco/itens/${i.id}/editar` : undefined}
                    leading={<Farol status={r.status} />}
                    titulo={i.nome}
                    valor={`${dias}${venc ? ` · ${formatarDataCurta(venc)}` : ""}`}
                    valorClassName={r.status === "vencido" ? "text-crit" : r.status === "atencao" ? "text-warn" : "text-dim"}
                  />
                )
              })}
            </div>
          </div>
        )
      })}
    </main>
  )
}
