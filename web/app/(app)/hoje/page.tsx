import Link from "next/link"
import { redirect } from "next/navigation"
import { Farol } from "@/components/farol"
import { Logo } from "@/components/logo"
import { Horimetro } from "@/components/horimetro"
import { calcularSemaforo, textoRestante, PESO } from "@/lib/domain/semaforo"
import { carregarPainel, hojeISO, itemMonitoradoToItemCalc } from "@/lib/consultas"
import { nomeDoEquipamento } from "@/lib/domain/diario"
import { boletimDoMar } from "@/lib/mar"

export default async function HojePage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const { embarcacao, equipamentos, itens } = painel
  const hoje = hojeISO()

  const avaliados = itens
    .map((i) => {
      const eq = equipamentos.find((e) => e.id === i.equipamento_id)
      const r = calcularSemaforo(itemMonitoradoToItemCalc(i), eq?.horas_atuais ?? null, hoje)
      const onde = eq ? `${i.nome} — ${nomeDoEquipamento(eq)}` : i.nome
      return { item: i, r, onde }
    })
    .sort((a, b) => PESO[b.r.status] - PESO[a.r.status])

  const alertas = avaliados.filter((a) => a.r.status !== "ok")
  const contagem = {
    vencido: avaliados.filter((a) => a.r.status === "vencido").length,
    atencao: avaliados.filter((a) => a.r.status === "atencao").length,
    ok: avaliados.filter((a) => a.r.status === "ok").length,
  }
  const motores = equipamentos.filter((e) => e.tipo === "motor")

  const boletim =
    embarcacao.marina_lat != null && embarcacao.marina_lon != null
      ? await boletimDoMar(embarcacao.marina_lat, embarcacao.marina_lon)
      : null

  return (
    <main>
      <div className="mb-5 text-[13px]">
        <Logo />
      </div>
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-semibold">{embarcacao.nome}</h1>
          <p className="text-sm text-dim">{embarcacao.marina ?? "Marina não informada"}</p>
        </div>
        <div className="flex gap-2.5 font-mono-instr text-xs tabular-nums text-dim">
          <span className="flex items-center gap-1"><Farol status="vencido" />{contagem.vencido}</span>
          <span className="flex items-center gap-1"><Farol status="atencao" />{contagem.atencao}</span>
          <span className="flex items-center gap-1"><Farol status="ok" />{contagem.ok}</span>
        </div>
      </header>

      {erro && (
        <p className="mt-4 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 text-sm">{erro}</p>
      )}

      <p className="mt-6 mb-2 font-mono-instr text-[10.5px] uppercase tracking-[.16em] text-dim">
        {alertas.length > 0 ? "Precisa de atenção" : "Tudo em dia"}
      </p>
      {alertas.length === 0 && (
        <div className="rounded-[14px] border border-line bg-panel p-4 text-sm text-dim">
          Nenhum vencimento na margem. Bom vento e mar calmo.
        </div>
      )}
      <div className="space-y-2">
        {alertas.map(({ item, r, onde }) => (
          <div key={item.id} className="flex gap-3 rounded-[14px] border border-line bg-panel p-3.5">
            <span className={`w-[3px] shrink-0 self-stretch rounded ${r.status === "vencido" ? "bg-crit" : "bg-warn"}`} />
            <div>
              <p className="text-sm font-semibold">{onde}</p>
              <p className="mt-0.5 text-xs text-dim">{textoRestante(r)}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-6 mb-2 font-mono-instr text-[10.5px] uppercase tracking-[.16em] text-dim">Mar agora</p>
      {embarcacao.marina_lat == null || embarcacao.marina_lon == null ? (
        <Link href="/barco/local" className="block rounded-[14px] border border-line bg-panel p-4">
          <p className="text-sm font-semibold">Ligue o boletim do mar</p>
          <p className="mt-0.5 text-xs text-dim">Defina a posição da marina para ver onda, vento e água aqui.</p>
        </Link>
      ) : boletim == null ? (
        <div className="rounded-[14px] border border-line bg-panel p-4 text-sm text-dim">
          Boletim indisponível agora. Tente mais tarde.
        </div>
      ) : (
        <div className="rounded-[14px] border border-line bg-panel p-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono-instr text-sm tabular-nums">
            <span><span className="mr-1.5 text-[10px] uppercase tracking-[.12em] text-dim">Onda</span>{boletim.ondaM != null ? `${boletim.ondaM.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} m` : "—"}</span>
            <span><span className="mr-1.5 text-[10px] uppercase tracking-[.12em] text-dim">Vento</span>{boletim.ventoKt != null ? `${Math.round(boletim.ventoKt)} kt` : "—"}</span>
            <span><span className="mr-1.5 text-[10px] uppercase tracking-[.12em] text-dim">Água</span>{boletim.aguaC != null ? `${Math.round(boletim.aguaC)} °C` : "—"}</span>
            <span className={`ml-auto rounded px-2 py-0.5 font-mono-instr text-[10px] uppercase tracking-[.1em] ${
              boletim.selo.nivel === "ok" ? "border border-ok/40 text-ok"
              : boletim.selo.nivel === "atencao" ? "border border-warn/40 text-warn"
              : "border border-crit/40 text-crit"
            }`}>{boletim.selo.rotulo}</span>
          </div>
        </div>
      )}

      <Link href="/navegar" className="mt-3 block rounded-[14px] border border-accent/40 bg-panel p-3.5 text-center text-sm font-semibold text-accent-forte">
        ⛵ Iniciar navegação — gravar trilha
      </Link>

      {motores.length > 0 && (
        <>
          <p className="mt-6 mb-2 font-mono-instr text-[10.5px] uppercase tracking-[.16em] text-dim">Horas de motor</p>
          <div className="grid grid-cols-2 gap-2">
            {motores.map((m) => {
              const status =
                avaliados
                  .filter((a) => a.item.equipamento_id === m.id)
                  .map((a) => a.r.status)
                  .sort((a, b) => PESO[b] - PESO[a])[0] ?? "ok"
              return <Horimetro key={m.id} rotulo={m.posicao ?? "Motor"} horas={m.horas_atuais ?? 0} status={status} />
            })}
          </div>
        </>
      )}

      <p className="mt-6 mb-2 font-mono-instr text-[10.5px] uppercase tracking-[.16em] text-dim">Acesso rápido</p>
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          { href: "/barco", rotulo: "Motores" },
          { href: "/barco/documentos", rotulo: "Docs" },
          { href: "/diario", rotulo: "Diário" },
          { href: "/barco/contatos", rotulo: "Contatos" },
        ].map((a) => (
          <Link key={a.href} href={a.href} className="rounded-[12px] border border-line bg-panel px-1 py-3 text-xs font-medium">
            {a.rotulo}
          </Link>
        ))}
      </div>
    </main>
  )
}
