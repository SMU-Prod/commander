import { redirect } from "next/navigation"
import { Farol } from "@/components/farol"
import { AtivarAlertas } from "@/components/ativar-alertas"
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

  return (
    <main>
      <h1 className="text-xl font-semibold">Notificações</h1>

      <div className="mt-4">
        <AtivarAlertas />
      </div>

      <p className="mt-6 mb-2 font-mono-instr text-[10.5px] uppercase tracking-[.16em] text-dim">
        Alertas ativos
      </p>
      {ativos.length === 0 ? (
        <div className="rounded-[14px] border border-line bg-panel p-4 text-sm text-dim">
          Nada vencido nem na margem. Bom vento e mar calmo.
        </div>
      ) : (
        <div className="rounded-[14px] border border-line bg-panel px-4">
          {ativos.map(({ i, r, onde }) => (
            <div key={i.id} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
              <Farol status={r.status} />
              <p className="min-w-0 flex-1 text-sm font-medium">{onde}</p>
              <span className="font-mono-instr text-xs tabular-nums text-dim">{textoRestante(r)}</span>
            </div>
          ))}
        </div>
      )}

      <p className="mt-6 mb-2 font-mono-instr text-[10.5px] uppercase tracking-[.16em] text-dim">
        Avisos enviados
      </p>
      <div className="rounded-[14px] border border-line bg-panel px-4">
        {(enviados ?? []).length === 0 && (
          <p className="py-4 text-sm text-dim">
            Nenhum aviso enviado ainda. Quando um item entrar na margem, você recebe aqui e no aparelho.
          </p>
        )}
        {((enviados ?? []) as Pick<AlertaEnviado, "id" | "titulo" | "janela" | "enviado_em">[]).map((a) => (
          <div key={a.id} className="border-b border-line py-3 last:border-0">
            <p className="text-sm font-medium">{a.titulo}</p>
            <p className="mt-0.5 font-mono-instr text-[11px] tabular-nums text-dim">
              {new Date(a.enviado_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
            </p>
          </div>
        ))}
      </div>
    </main>
  )
}
