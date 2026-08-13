import { redirect } from "next/navigation"
import { Farol } from "@/components/farol"
import { AtivarAlertas } from "@/components/ativar-alertas"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { LinhaLista } from "@/components/ui/linha-lista"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { carregarPainel, hojeISO, itemMonitoradoToItemCalc } from "@/lib/consultas"
import { calcularSemaforo, textoRestante, PESO } from "@/lib/domain/semaforo"
import { nomeDoEquipamento } from "@/lib/domain/diario"
import { supabaseServer } from "@/lib/supabase/server"
import type { AlertaEnviado } from "@/lib/db/types"

export default async function NotificacoesPage() {
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const hoje = hojeISO()
  const supabase = await supabaseServer()
  const { data: enviados } = await supabase
    .from("alertas_enviados")
    .select("id, titulo, janela, enviado_em")
    .eq("embarcacao_id", painel.embarcacao.id)
    .order("enviado_em", { ascending: false })
    .limit(20)

  const ativos = painel.itens
    .map((i) => {
      const eq = painel.equipamentos.find((e) => e.id === i.equipamento_id)
      const r = calcularSemaforo(itemMonitoradoToItemCalc(i), eq?.horas_atuais ?? null, hoje)
      const onde = eq ? `${i.nome} — ${nomeDoEquipamento(eq)}` : i.nome
      return { i, r, onde }
    })
    .filter((a) => a.r.status !== "ok")
    .sort((a, b) => PESO[b.r.status] - PESO[a.r.status])

  // Agrupado por severidade (vencido primeiro, sempre) — a mesma convenção
  // de cor de status do resto do app (Farol/AnelStatus), só que aqui como
  // dois grupos nomeados em vez de uma lista só, pra urgência ficar legível
  // de relance em vez de precisar ler linha por linha.
  const vencidos = ativos.filter((a) => a.r.status === "vencido")
  const naMargem = ativos.filter((a) => a.r.status === "atencao")

  return (
    <main>
      <h1 className="titulo-pagina">Avisos</h1>

      <div className="mt-4">
        <AtivarAlertas />
      </div>

      {ativos.length === 0 ? (
        <>
          <SecaoPagina icone="alerta">O que está vencendo</SecaoPagina>
          <EstadoVazio icone="escudo" titulo="Nada vencido nem na margem" descricao="Bom vento e mar calmo." />
        </>
      ) : (
        <>
          {vencidos.length > 0 && (
            <>
              <SecaoPagina icone="alerta">Vencido — {vencidos.length}</SecaoPagina>
              <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
                {vencidos.map(({ i, r, onde }) => (
                  <LinhaLista
                    key={i.id}
                    leading={<Farol status={r.status} />}
                    titulo={onde}
                    valor={textoRestante(r)}
                    valorClassName="text-crit"
                  />
                ))}
              </div>
            </>
          )}
          {naMargem.length > 0 && (
            <>
              <SecaoPagina icone="relogio">Na margem — {naMargem.length}</SecaoPagina>
              <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
                {naMargem.map(({ i, r, onde }) => (
                  <LinhaLista
                    key={i.id}
                    leading={<Farol status={r.status} />}
                    titulo={onde}
                    valor={textoRestante(r)}
                    valorClassName="text-warn"
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}

      <SecaoPagina icone="calendario">Histórico de avisos</SecaoPagina>
      <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
        {(enviados ?? []).length === 0 && (
          <EstadoVazio
            variant="linha"
            icone="calendario"
            titulo="Nenhum aviso enviado ainda"
            descricao="Quando algo entrar na margem, você recebe aqui e no aparelho."
          />
        )}
        {((enviados ?? []) as Pick<AlertaEnviado, "id" | "titulo" | "janela" | "enviado_em">[]).map((a) => (
          <div key={a.id} className="border-b border-line py-3 last:border-0">
            <p className="titulo-card">{a.titulo}</p>
            <p className="mt-0.5 font-mono-instr text-[11px] tabular-nums text-dim">
              {new Date(a.enviado_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
            </p>
          </div>
        ))}
      </div>
    </main>
  )
}
