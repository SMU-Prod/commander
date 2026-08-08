import Link from "next/link"
import { redirect } from "next/navigation"
import { Farol } from "@/components/farol"
import { Icone } from "@/components/icone"
import { carregarPainel, hojeISO, itemMonitoradoToItemCalc } from "@/lib/consultas"
import { calcularSemaforo, PESO, type StatusFarol } from "@/lib/domain/semaforo"
import { podeEditar, podeVer } from "@/lib/domain/permissoes"
import { supabaseServer } from "@/lib/supabase/server"
import type { Contato } from "@/lib/db/types"

/** Sem acento, minúsculo — "Elétrica"/"eletricista"/"ELETRICISTA" batem todos em "eletric". */
const semAcento = (s: string) =>
  s.toLowerCase()
    .replace(/[áàâã]/g, "a").replace(/[éèê]/g, "e").replace(/[íì]/g, "i")
    .replace(/[óòôõ]/g, "o").replace(/[úù]/g, "u").replace(/ç/g, "c")

export default async function EletricaPage() {
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (!podeVer(painel.permissoes, "eletrica")) {
    redirect(`/hoje?erro=${encodeURIComponent("Seu acesso não inclui a elétrica.")}`)
  }
  const editavel = podeEditar(painel.permissoes, "eletrica")
  const hoje = hojeISO()
  const equipamentos = painel.equipamentos.filter((e) => e.tipo !== "motor")

  const podeVerContatos = podeVer(painel.permissoes, "contatos")
  let contatosEletrica: Contato[] = []
  if (podeVerContatos) {
    const supabase = await supabaseServer()
    const { data } = await supabase.from("contatos")
      .select("*").eq("embarcacao_id", painel.embarcacao.id).order("nome")
    contatosEletrica = ((data ?? []) as Contato[])
      .filter((c) => c.especialidade != null && semAcento(c.especialidade).includes("eletric"))
  }

  const statusDe = (eqId: string): StatusFarol =>
    painel.itens
      .filter((i) => i.equipamento_id === eqId)
      .map((i) => {
        const eq = painel.equipamentos.find((e) => e.id === eqId)
        return calcularSemaforo(itemMonitoradoToItemCalc(i), eq?.horas_atuais ?? null, hoje).status
      })
      .sort((a, b) => PESO[b] - PESO[a])[0] ?? "ok"

  const rotuloTipo: Record<string, string> = {
    gerador: "Gerador", bateria: "Baterias", outro: "Equipamento", motor: "Motor",
  }

  return (
    <main>
      <Link href="/barco" className="inline-flex items-center gap-1 rotulo text-accent-forte">
        <Icone nome="voltar" className="size-4" /> Barco
      </Link>
      <div className="mt-3 flex items-baseline justify-between">
        <h1 className="titulo-pagina">Elétrica</h1>
        {editavel && (
          <Link href="/barco/equipamento/novo?tipo=gerador"
            className="inline-flex items-center gap-1 rounded-full bg-accent px-4 py-2 corpo font-semibold text-acao-texto">
            <Icone nome="mais" className="size-4" /> Equipamento
          </Link>
        )}
      </div>
      <p className="apoio mt-1 text-dim">Gerador, baterias e o que mais tiver manutenção própria a bordo.</p>

      <div className="sombra-1 mt-5 rounded-[14px] border border-line bg-panel px-4">
        {equipamentos.length === 0 && (
          <div className="py-6 text-center">
            <Icone nome="raio" className="mx-auto size-7 text-dim" />
            <p className="corpo mt-2 font-medium">Nada cadastrado ainda</p>
            <p className="apoio mt-1 text-dim">
              Cadastre o gerador e as baterias para o app avisar das manutenções deles também.
            </p>
          </div>
        )}
        {equipamentos.map((e) => {
          const itens = painel.itens.filter((i) => i.equipamento_id === e.id)
          return (
            <Link key={e.id} href={`/barco/equipamento/${e.id}`}
              className="flex items-center gap-3 border-b border-line py-3.5 last:border-0">
              <Farol status={statusDe(e.id)} />
              <div className="min-w-0 flex-1">
                <p className="titulo-card">
                  {rotuloTipo[e.tipo] ?? "Equipamento"}
                  {e.posicao ? ` ${e.posicao}` : ""}
                  {e.quantidade != null ? ` · ${e.quantidade}×` : ""}
                </p>
                <p className="apoio mt-0.5 text-dim">
                  {[e.marca, e.modelo].filter(Boolean).join(" ") || "Sem marca informada"}
                  {e.horas_atuais != null ? ` · ${e.horas_atuais.toLocaleString("pt-BR")} h` : ""}
                  {` · ${itens.length} ${itens.length === 1 ? "item" : "itens"}`}
                </p>
              </div>
              <Icone nome="chevron" className="size-4 text-dim" />
            </Link>
          )
        })}
      </div>

      {podeVerContatos && (
        <>
          <div className="mt-6 mb-2 flex items-baseline justify-between">
            <p className="rotulo flex items-center gap-1.5 text-dim">
              <Icone nome="pessoas" className="size-3.5" /> Suporte e peças
            </p>
            <Link href="/barco/contatos" className="corpo text-accent-forte">Cadastrar contato</Link>
          </div>
          <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
            {contatosEletrica.length === 0 && (
              <p className="corpo py-4 text-dim">
                Nenhum contato de elétrica cadastrado ainda. Salve o eletricista de confiança para
                achar rápido na próxima vez.
              </p>
            )}
            {contatosEletrica.map((c) => (
              <div key={c.id} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="titulo-card">{c.nome}</p>
                  <p className="apoio mt-0.5 text-dim">
                    {[c.especialidade, c.telefone].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {c.telefone && (
                  <a href={`https://wa.me/55${c.telefone.replace(/\D/g, "")}`} target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-ok/40 px-2.5 py-1.5 text-xs text-ok">
                    WhatsApp
                  </a>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  )
}
